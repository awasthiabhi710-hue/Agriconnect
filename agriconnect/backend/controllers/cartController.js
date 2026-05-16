// ═══════════════════════════════════════════
// controllers/cartController.js
// Handles: Add, Update, Remove, Get, Checkout cart
// Cart is stored per-user in DB (cart_items table)
// ═══════════════════════════════════════════
const pool            = require('../config/db');
const { createError } = require('../middleware/errorHandler');

// ─────────────────────────────────────────────
// GET /api/cart
// ─────────────────────────────────────────────
const getCart = async (req, res, next) => {
  try {
    const [items] = await pool.query(
      `SELECT ci.id AS cart_item_id, ci.quantity, ci.added_at,
              p.id AS product_id, p.name, p.emoji, p.price, p.unit,
              p.quantity AS stock, p.is_available, p.state, p.image_url,
              u.name AS farmer_name, u.id AS farmer_id, u.rating AS farmer_rating
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       JOIN users u    ON p.farmer_id   = u.id
       WHERE ci.buyer_id = ?
       ORDER BY ci.added_at DESC`,
      [req.user.id]
    );

    const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const unavailable = items.filter(i => !i.is_available || i.quantity > i.stock);

    res.json({
      success: true,
      items,
      summary: {
        item_count:  items.length,
        total_qty:   items.reduce((s, i) => s + i.quantity, 0),
        total_amount: total,
        has_unavailable: unavailable.length > 0,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// POST /api/cart  — add or update item
// ─────────────────────────────────────────────
const addToCart = async (req, res, next) => {
  try {
    const { product_id, quantity = 1 } = req.body;
    if (!product_id) return next(createError('product_id is required.', 400));

    const [[product]] = await pool.query(
      'SELECT id, name, price, quantity, is_available, farmer_id FROM products WHERE id = ?',
      [product_id]
    );
    if (!product)              return next(createError('Product not found.', 404));
    if (!product.is_available) return next(createError('Product is no longer available.', 400));
    if (product.farmer_id === req.user.id) return next(createError('You cannot add your own product to cart.', 400));
    if (parseInt(quantity) > product.quantity) {
      return next(createError(`Only ${product.quantity} units available.`, 400));
    }

    // Upsert — if already in cart, update quantity
    const [existing] = await pool.query(
      'SELECT id, quantity FROM cart_items WHERE buyer_id = ? AND product_id = ?',
      [req.user.id, product_id]
    );

    if (existing.length) {
      const newQty = existing[0].quantity + parseInt(quantity);
      if (newQty > product.quantity) {
        return next(createError(`Cannot add more. Only ${product.quantity} units available.`, 400));
      }
      await pool.query('UPDATE cart_items SET quantity = ? WHERE id = ?', [newQty, existing[0].id]);
    } else {
      await pool.query(
        'INSERT INTO cart_items (buyer_id, product_id, quantity) VALUES (?, ?, ?)',
        [req.user.id, product_id, parseInt(quantity)]
      );
    }

    res.json({ success: true, message: `${product.name} added to cart!` });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// PUT /api/cart/:cartItemId  — update quantity
// ─────────────────────────────────────────────
const updateCartItem = async (req, res, next) => {
  try {
    const { quantity } = req.body;
    if (!quantity || parseInt(quantity) < 1) return next(createError('quantity must be >= 1.', 400));

    const [[item]] = await pool.query(
      'SELECT ci.*, p.quantity AS stock FROM cart_items ci JOIN products p ON ci.product_id = p.id WHERE ci.id = ? AND ci.buyer_id = ?',
      [req.params.cartItemId, req.user.id]
    );
    if (!item) return next(createError('Cart item not found.', 404));
    if (parseInt(quantity) > item.stock) {
      return next(createError(`Only ${item.stock} units available.`, 400));
    }

    await pool.query('UPDATE cart_items SET quantity = ? WHERE id = ?', [parseInt(quantity), req.params.cartItemId]);
    res.json({ success: true, message: 'Cart updated.' });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// DELETE /api/cart/:cartItemId
// ─────────────────────────────────────────────
const removeFromCart = async (req, res, next) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM cart_items WHERE id = ? AND buyer_id = ?',
      [req.params.cartItemId, req.user.id]
    );
    if (!result.affectedRows) return next(createError('Cart item not found.', 404));
    res.json({ success: true, message: 'Item removed from cart.' });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// DELETE /api/cart  — clear entire cart
// ─────────────────────────────────────────────
const clearCart = async (req, res, next) => {
  try {
    await pool.query('DELETE FROM cart_items WHERE buyer_id = ?', [req.user.id]);
    res.json({ success: true, message: 'Cart cleared.' });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// POST /api/cart/checkout  — place orders for all cart items
// ─────────────────────────────────────────────
const checkout = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { delivery_address, payment_method = 'upi' } = req.body;
    if (!delivery_address) {
      await conn.rollback();
      return next(createError('delivery_address is required.', 400));
    }

    // Get all cart items with lock
    const [cartItems] = await conn.query(
      `SELECT ci.*, p.name, p.price, p.farmer_id, p.quantity AS stock, p.is_available
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.buyer_id = ?
       FOR UPDATE`,
      [req.user.id]
    );

    if (!cartItems.length) {
      await conn.rollback();
      return next(createError('Your cart is empty.', 400));
    }

    // Validate all items
    for (const item of cartItems) {
      if (!item.is_available) {
        await conn.rollback();
        return next(createError(`"${item.name}" is no longer available.`, 400));
      }
      if (item.quantity > item.stock) {
        await conn.rollback();
        return next(createError(`"${item.name}": only ${item.stock} units available.`, 400));
      }
    }

    const orderIds = [];
    let totalSpent = 0;

    for (const item of cartItems) {
      const total = item.price * item.quantity;
      totalSpent += total;

      const [result] = await conn.query(
        `INSERT INTO orders (product_id, buyer_id, farmer_id, quantity, unit_price, total_amount, payment_method, delivery_address, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [item.product_id, req.user.id, item.farmer_id, item.quantity, item.price, total, payment_method, delivery_address]
      );
      orderIds.push(result.insertId);

      // Deduct stock
      const newStock = item.stock - item.quantity;
      await conn.query(
        'UPDATE products SET quantity = ?, is_available = ? WHERE id = ?',
        [newStock, newStock > 0 ? 1 : 0, item.product_id]
      );
    }

    // Clear the cart
    await conn.query('DELETE FROM cart_items WHERE buyer_id = ?', [req.user.id]);
    await conn.commit();

    res.status(201).json({
      success: true,
      message: `${orderIds.length} order(s) placed successfully!`,
      order_ids:   orderIds,
      total_spent: totalSpent,
      payment_method,
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

module.exports = { getCart, addToCart, updateCartItem, removeFromCart, clearCart, checkout };