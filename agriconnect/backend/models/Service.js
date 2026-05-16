// ═══════════════════════════════════════════
// models/Service.js
// ═══════════════════════════════════════════
const pool = require('../config/db');

const Service = {
  async findById(id) {
    const [[row]] = await pool.query(
      `SELECT s.*,
              u.name        AS provider_name,
              u.rating,
              u.total_reviews,
              u.is_verified AS provider_verified,
              u.profile_pic AS provider_pic
       FROM services s
       JOIN users u ON s.provider_id = u.id
       WHERE s.id = ?`,
      [id]
    );
    return row || null;
  },

  async create({ provider_id, title, type, rate, rate_per, location, state, description, image_url }) {
    const [result] = await pool.query(
      `INSERT INTO services (provider_id, title, type, rate, rate_per, location, state, description, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [provider_id, title, type, parseFloat(rate), rate_per || 'Hour',
       location || null, state || null, description || null, image_url || null]
    );
    return this.findById(result.insertId);
  },

  SERVICE_TYPES: [
    'Tractor / Machinery',
    'Labor / Manpower',
    'Transportation',
    'Irrigation Expert',
    'Pesticide Spraying',
    'Soil Testing',
    'Other',
  ],

  RATE_UNITS: ['Hour', 'Day', 'Acre', 'Trip', 'Fixed', 'Kg', 'Quintal'],
};

module.exports = Service;