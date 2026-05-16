// ═══════════════════════════════════════════
// models/Job.js
// ═══════════════════════════════════════════
const pool = require('../config/db');

const Job = {
  async findById(id) {
    const [[row]] = await pool.query(
      `SELECT j.*,
              u.name         AS farmer_name,
              u.rating       AS farmer_rating,
              u.is_verified  AS farmer_verified,
              u.mobile       AS farmer_mobile,
              u.profile_pic  AS farmer_pic,
              (SELECT COUNT(*) FROM bids b WHERE b.job_id = j.id) AS bid_count
       FROM job_posts j
       JOIN users u ON j.farmer_id = u.id
       WHERE j.id = ?`,
      [id]
    );
    return row || null;
  },

  async create({ farmer_id, title, type, budget, location, state, required_by, description }) {
    const [result] = await pool.query(
      `INSERT INTO job_posts (farmer_id, title, type, budget, location, state, required_by, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [farmer_id, title, type,
       budget      ? parseFloat(budget) : null,
       location    || null,
       state       || null,
       required_by || null,
       description || null]
    );
    return result.insertId;
  },

  async getBid(bidId) {
    const [[row]] = await pool.query(
      'SELECT b.*, j.farmer_id FROM bids b JOIN job_posts j ON b.job_id = j.id WHERE b.id = ?',
      [bidId]
    );
    return row || null;
  },

  JOB_TYPES: [
    'Tractor / Machinery',
    'Labor / Manpower',
    'Transportation',
    'Irrigation Expert',
    'Pesticide Spraying',
    'Soil Testing',
    'Other',
  ],

  STATUSES: ['open', 'in_progress', 'closed', 'cancelled'],
};

module.exports = Job;