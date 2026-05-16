// ═══════════════════════════════════════════
// models/User.js
// Utility helpers for the users table
// ═══════════════════════════════════════════
const pool = require('../config/db');

const User = {
  // Find by id
  async findById(id) {
    const [[row]] = await pool.query(
      'SELECT * FROM users WHERE id = ? AND is_active = 1',
      [id]
    );
    return row || null;
  },

  // Find by email
  async findByEmail(email) {
    const [[row]] = await pool.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    return row || null;
  },

  // Find by email or mobile
  async findByEmailOrMobile(identifier) {
    const [[row]] = await pool.query(
      'SELECT * FROM users WHERE email = ? OR mobile = ?',
      [identifier, identifier]
    );
    return row || null;
  },

  // Safe public profile (no password)
  async getPublicProfile(id) {
    const [[row]] = await pool.query(
      `SELECT id, name, role, state, district, service_type, bio,
              profile_pic, rating, total_reviews, is_verified, created_at
       FROM users WHERE id = ? AND is_active = 1`,
      [id]
    );
    return row || null;
  },

  // Create user
  async create({ name, mobile, email, password_hash, role, state, district, service_type }) {
    const [result] = await pool.query(
      `INSERT INTO users (name, mobile, email, password_hash, role, state, district, service_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, mobile || null, email, password_hash, role, state || null, district || null, service_type || null]
    );
    return this.findById(result.insertId);
  },

  // Update profile fields
  async update(id, fields) {
    const keys   = Object.keys(fields);
    const values = Object.values(fields);
    if (!keys.length) return null;
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    await pool.query(`UPDATE users SET ${setClause} WHERE id = ?`, [...values, id]);
    return this.findById(id);
  },

  // Recalculate rating from reviews table
  async recalcRating(id) {
    await pool.query(
      `UPDATE users
       SET rating        = (SELECT ROUND(AVG(rating), 1) FROM reviews WHERE reviewed_id = ?),
           total_reviews = (SELECT COUNT(*)              FROM reviews WHERE reviewed_id = ?)
       WHERE id = ?`,
      [id, id, id]
    );
  },

  // Strip password from user object
  safe(user) {
    if (!user) return null;
    const { password_hash, ...rest } = user;
    return rest;
  },
};

module.exports = User;