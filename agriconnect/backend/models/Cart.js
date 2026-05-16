// ═══════════════════════════════════════════
// models/Cart.js
// ═══════════════════════════════════════════
const pool = require('../config/db');

const Cart = {
  async getByBuyer(buyerId) {
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
      [buyerId]
    );
    return items;
  },

  async findItem(buyerId, productId) {
    const [rows] = await pool.query(
      'SELECT * FROM cart_items WHERE buyer_id = ? AND product_id = ?',
      [buyerId, productId]
    );
    return rows[0] || null;
  },

  async findItemById(cartItemId, buyerId) {
    const [[row]] = await pool.query(
      `SELECT ci.*, p.quantity AS stock
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.id = ? AND ci.buyer_id = ?`,
      [cartItemId, buyerId]
    );
    return row || null;
  },

  async upsert(buyerId, productId, quantity) {
    const existing = await this.findItem(buyerId, productId);
    if (existing) {
      await pool.query(
        'UPDATE cart_items SET quantity = quantity + ? WHERE id = ?',
        [quantity, existing.id]
      );
    } else {
      await pool.query(
        'INSERT INTO cart_items (buyer_id, product_id, quantity) VALUES (?, ?, ?)',
        [buyerId, productId, quantity]
      );
    }
  },

  async updateQuantity(cartItemId, quantity) {
    await pool.query('UPDATE cart_items SET quantity = ? WHERE id = ?', [quantity, cartItemId]);
  },

  async removeItem(cartItemId, buyerId) {
    const [result] = await pool.query(
      'DELETE FROM cart_items WHERE id = ? AND buyer_id = ?',
      [cartItemId, buyerId]
    );
    return result.affectedRows > 0;
  },

  async clear(buyerId, conn = pool) {
    await conn.query('DELETE FROM cart_items WHERE buyer_id = ?', [buyerId]);
  },

  calcSummary(items) {
    return {
      item_count:      items.length,
      total_qty:       items.reduce((s, i) => s + i.quantity, 0),
      total_amount:    items.reduce((s, i) => s + i.price * i.quantity, 0),
      has_unavailable: items.some(i => !i.is_available || i.quantity > i.stock),
    };
  },
};

module.exports = Cart;