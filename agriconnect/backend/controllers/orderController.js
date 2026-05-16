// ═══════════════════════════════════════════
// controllers/orderController.js
// Handles: Place order, Get orders, Update status
// Uses DB transactions to prevent overselling
// ═══════════════════════════════════════════
const pool            = require('../config/db');
const { createError } = require('../middleware/errorHandler');

// ─────────────────────────────────────────────
// POST /api/orders  (buyer or guest)
// ─────────────────────────────────────────────
const placeOrder = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { product_id, quantity, delivery_address, payment_method = 'upi' } = req.body;

    if (!product_id || !quantity || !delivery_address) {
      await conn.rollback();
      return next(createError('product_id, quantity, and delivery_address are required.', 400));
    }

    // Lock the product row while checking stock
    const [[product]] = await conn.query(
      'SELECT * FROM products WHERE id = ? AND is_available = 1 FOR UPDATE',
      [product_id]
    );

    if (!product) {
      await conn.rollback();
      return next(createError('Product not found or unavailable.', 404));
    }
    if (product.quantity < parseInt(quantity)) {
      await conn.rollback();
      return next(createError(`Only ${product.quantity} ${product.unit} available.`, 400));
    }

    const total = product.price * parseInt(quantity);

    const [result] = await conn.query(
      `INSERT INTO orders (product_id, buyer_id, farmer_id, quantity, unit_price, total_amount, payment_method, delivery_address, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [product_id, req.user.id, product.farmer_id, parseInt(quantity), product.price, total, payment_method, delivery_address]
    );

    // Deduct stock
    const newQty = product.quantity - parseInt(quantity);
    await conn.query(
      'UPDATE products SET quantity = ?, is_available = ? WHERE id = ?',
      [newQty, newQty > 0 ? 1 : 0, product_id]
    );

    await conn.commit();

    res.status(201).json({
      success: true,
      message: `Order placed successfully!`,
      order: {
        id:           result.insertId,
        product_name: product.name,
        quantity:     parseInt(quantity),
        total_amount: total,
        status:       'pending',
        payment_method,
      },
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

// ─────────────────────────────────────────────
// GET /api/orders  (role-aware)
// ─────────────────────────────────────────────
const getOrders = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const role = req.user.role;

    let whereClause = '';
    const params = [];

    if (role === 'buyer') {
      whereClause = 'WHERE o.buyer_id = ?';
      params.push(req.user.id);
    } else if (role === 'farmer') {
      whereClause = 'WHERE o.farmer_id = ?';
      params.push(req.user.id);
    } else if (role === 'admin') {
      whereClause = '';
    } else {
      return next(createError('Unauthorized.', 403));
    }

    if (status) {
      whereClause += (whereClause ? ' AND ' : 'WHERE ') + 'o.status = ?';
      params.push(status);
    }

    const sql = `
      SELECT o.*,
             p.name          AS product_name,
             p.emoji,
             p.unit          AS product_unit,
             p.image_url     AS product_image,
             b.name          AS buyer_name,
             b.mobile        AS buyer_mobile,
             f.name          AS farmer_name,
             f.mobile        AS farmer_mobile
      FROM   orders o
      JOIN   products p ON o.product_id  = p.id
      JOIN   users b    ON o.buyer_id    = b.id
      JOIN   users f    ON o.farmer_id   = f.id
      ${whereClause}
      ORDER  BY o.created_at DESC
      LIMIT  ? OFFSET ?`;

    const [orders] = await pool.query(sql, [...params, Number(limit), offset]);

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM orders o ${whereClause}`,
      params
    );

    res.json({
      success: true,
      orders,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// GET /api/orders/:id
// ─────────────────────────────────────────────
const getOrderById = async (req, res, next) => {
  try {
    const [[order]] = await pool.query(
      `SELECT o.*,
              p.name AS product_name, p.emoji, p.unit AS product_unit, p.image_url AS product_image,
              b.name AS buyer_name,  b.mobile AS buyer_mobile, b.email AS buyer_email,
              f.name AS farmer_name, f.mobile AS farmer_mobile
       FROM orders o
       JOIN products p ON o.product_id = p.id
       JOIN users b    ON o.buyer_id   = b.id
       JOIN users f    ON o.farmer_id  = f.id
       WHERE o.id = ?`,
      [req.params.id]
    );
    if (!order) return next(createError('Order not found.', 404));

    // Only buyer, farmer, or admin can see this order
    const uid = req.user.id;
    const role = req.user.role;
    if (role !== 'admin' && order.buyer_id !== uid && order.farmer_id !== uid) {
      return next(createError('Forbidden.', 403));
    }

    res.json({ success: true, order });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// PATCH /api/orders/:id/status  (farmer or admin)
// ─────────────────────────────────────────────
const updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

    if (!validStatuses.includes(status)) {
      return next(createError(`Invalid status. Valid values: ${validStatuses.join(', ')}`, 400));
    }

    const [[order]] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) return next(createError('Order not found.', 404));

    if (req.user.role !== 'admin' && order.farmer_id !== req.user.id) {
      return next(createError('Forbidden. Only the seller or admin can update order status.', 403));
    }

    const deliveredAt = status === 'delivered' ? new Date() : null;
    await pool.query(
      'UPDATE orders SET status = ?, delivered_at = COALESCE(?, delivered_at) WHERE id = ?',
      [status, deliveredAt, req.params.id]
    );

    // If cancelled — restore stock
    if (status === 'cancelled' && order.status !== 'cancelled') {
      await pool.query(
        'UPDATE products SET quantity = quantity + ?, is_available = 1 WHERE id = ?',
        [order.quantity, order.product_id]
      );
    }

    res.json({ success: true, message: `Order #${req.params.id} marked as ${status}.`, status });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// GET /api/orders/stats  (farmer dashboard)
// ─────────────────────────────────────────────
const getOrderStats = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const role   = req.user.role;

    const col = role === 'buyer' ? 'buyer_id' : 'farmer_id';
    const [[stats]] = await pool.query(
      `SELECT
         COUNT(*)                                     AS total_orders,
         SUM(status = 'pending')                      AS pending,
         SUM(status = 'processing')                   AS processing,
         SUM(status = 'shipped')                      AS shipped,
         SUM(status = 'delivered')                    AS delivered,
         SUM(status = 'cancelled')                    AS cancelled,
         COALESCE(SUM(CASE WHEN status = 'delivered' THEN total_amount ELSE 0 END), 0) AS total_revenue
       FROM orders WHERE ${col} = ?`,
      [userId]
    );

    res.json({ success: true, stats });
  } catch (err) {
    next(err);
  }
};

module.exports = { placeOrder, getOrders, getOrderById, updateOrderStatus, getOrderStats };