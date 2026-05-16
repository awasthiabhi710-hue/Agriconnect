// ═══════════════════════════════════════════
// models/Product.js
// ═══════════════════════════════════════════
const pool = require('../config/db');

const CATEGORY_EMOJI = {
  'Grains & Cereals': '🌾',
  'Vegetables':       '🥦',
  'Fruits':           '🍎',
  'Pulses & Legumes': '🫘',
  'Spices & Herbs':   '🌶️',
  'Oilseeds':         '🌻',
  'Other':            '🌱',
};

const Product = {
  CATEGORY_EMOJI,

  async findById(id) {
    const [[row]] = await pool.query(
      `SELECT p.*,
              u.name          AS farmer_name,
              u.mobile        AS farmer_mobile,
              u.rating        AS farmer_rating,
              u.total_reviews AS farmer_reviews,
              u.is_verified   AS farmer_verified,
              u.bio           AS farmer_bio,
              u.profile_pic   AS farmer_pic
       FROM products p
       JOIN users u ON p.farmer_id = u.id
       WHERE p.id = ?`,
      [id]
    );
    return row || null;
  },

  async create({ farmer_id, name, category, price, quantity, unit, state, district, description, harvest_date, image_url }) {
    const emoji = CATEGORY_EMOJI[category] || '🌾';
    const [result] = await pool.query(
      `INSERT INTO products
         (farmer_id, name, category, price, quantity, unit, state, district, description, harvest_date, emoji, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [farmer_id, name, category, parseFloat(price), parseInt(quantity),
       unit || 'Quintal', state || null, district || null,
       description || null, harvest_date || null, emoji, image_url || null]
    );
    return this.findById(result.insertId);
  },

  async incrementViews(id) {
    await pool.query('UPDATE products SET views = views + 1 WHERE id = ?', [id]);
  },

  async deductStock(id, quantity, conn = pool) {
    const [[p]] = await conn.query('SELECT quantity FROM products WHERE id = ? FOR UPDATE', [id]);
    const newQty = p.quantity - quantity;
    await conn.query(
      'UPDATE products SET quantity = ?, is_available = ? WHERE id = ?',
      [newQty, newQty > 0 ? 1 : 0, id]
    );
    return newQty;
  },

  async restoreStock(id, quantity) {
    await pool.query(
      'UPDATE products SET quantity = quantity + ?, is_available = 1 WHERE id = ?',
      [quantity, id]
    );
  },
};

module.exports = Product;