// ═══════════════════════════════════════════
// models/Review.js
// ═══════════════════════════════════════════
const pool = require('../config/db');

const Review = {
  async create({ reviewer_id, reviewed_id, rating, comment, order_id, review_type = 'product' }, conn = pool) {
    const [result] = await conn.query(
      'INSERT INTO reviews (reviewer_id, reviewed_id, rating, comment, order_id, review_type) VALUES (?, ?, ?, ?, ?, ?)',
      [reviewer_id, reviewed_id, rating, comment || null, order_id || null, review_type]
    );
    return result.insertId;
  },

  async checkDuplicate(reviewer_id, reviewed_id, order_id) {
    const [rows] = await pool.query(
      'SELECT id FROM reviews WHERE reviewer_id = ? AND reviewed_id = ? AND order_id = ?',
      [reviewer_id, reviewed_id, order_id]
    );
    return rows.length > 0;
  },

  async getByUser(reviewed_id) {
    const [rows] = await pool.query(
      `SELECT r.id, r.rating, r.comment, r.review_type, r.created_at,
              u.id AS reviewer_id, u.name AS reviewer_name,
              u.profile_pic AS reviewer_pic, u.role AS reviewer_role
       FROM reviews r JOIN users u ON r.reviewer_id = u.id
       WHERE r.reviewed_id = ?
       ORDER BY r.created_at DESC`,
      [reviewed_id]
    );
    return rows;
  },

  async getStats(reviewed_id) {
    const [[stats]] = await pool.query(
      `SELECT
         COUNT(*)                   AS total,
         ROUND(AVG(rating), 1)      AS average,
         SUM(rating = 5)            AS five_star,
         SUM(rating = 4)            AS four_star,
         SUM(rating = 3)            AS three_star,
         SUM(rating <= 2)           AS low_star
       FROM reviews WHERE reviewed_id = ?`,
      [reviewed_id]
    );
    return stats;
  },
};

module.exports = Review;