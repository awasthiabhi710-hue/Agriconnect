// ═══════════════════════════════════════════
// models/Order.js
// ═══════════════════════════════════════════
const pool = require('../config/db');

const Order = {
  async findById(id) {
    const [[row]] = await pool.query(
      `SELECT o.*,
              p.name          AS product_name,
              p.emoji,
              p.unit          AS product_unit,
              p.image_url     AS product_image,
              b.name          AS buyer_name,
              b.mobile        AS buyer_mobile,
              b.email         AS buyer_email,
              f.name          AS farmer_name,
              f.mobile        AS farmer_mobile
       FROM orders o
       JOIN products p ON o.product_id = p.id
       JOIN users b    ON o.buyer_id   = b.id
       JOIN users f    ON o.farmer_id  = f.id
       WHERE o.id = ?`,
      [id]
    );
    return row || null;
  },

  async create({ product_id, buyer_id, farmer_id, quantity, unit_price, total_amount, payment_method, delivery_address }, conn = pool) {
    const [result] = await conn.query(
      `INSERT INTO orders
         (product_id, buyer_id, farmer_id, quantity, unit_price, total_amount, payment_method, delivery_address, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [product_id, buyer_id, farmer_id, quantity, unit_price, total_amount, payment_method || 'upi', delivery_address]
    );
    return result.insertId;
  },

  async updateStatus(id, status) {
    const deliveredAt = status === 'delivered' ? new Date() : null;
    await pool.query(
      'UPDATE orders SET status = ?, delivered_at = COALESCE(?, delivered_at) WHERE id = ?',
      [status, deliveredAt, id]
    );
  },

  async markPaid(id, paymentTxnId) {
    await pool.query(
      `UPDATE orders SET payment_status = 'paid', payment_txn_id = ?, status = 'processing' WHERE id = ?`,
      [paymentTxnId, id]
    );
  },

  VALID_STATUSES: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
};

module.exports = Order;