// ═══════════════════════════════════════════
// controllers/serviceController.js
// Handles: Services CRUD only.
// Jobs and bids are in controllers/jobController.js
// ═══════════════════════════════════════════
const pool            = require('../config/db');
const { createError } = require('../middleware/errorHandler');
const { handleSingleUpload, getFileUrl } = require('../middleware/upload');

// ─────────────────────────────────────────────
// GET /api/services
// ─────────────────────────────────────────────
const getServices = async (req, res, next) => {
  try {
    const { type, search, state, page = 1, limit = 20 } = req.query;
    const where  = ['s.is_available = 1'];
    const params = [];

    if (type)   { where.push('s.type = ?');                                        params.push(type); }
    if (search) { where.push('(s.title LIKE ? OR s.description LIKE ?)');          params.push(`%${search}%`, `%${search}%`); }
    if (state)  { where.push('s.location LIKE ?');                                 params.push(`%${state}%`); }

    const offset = (Number(page) - 1) * Number(limit);

    const [services] = await pool.query(
      `SELECT s.*, u.name AS provider_name, u.rating, u.total_reviews, u.is_verified, u.profile_pic AS provider_pic
       FROM services s
       JOIN users u ON s.provider_id = u.id
       WHERE ${where.join(' AND ')}
       ORDER BY u.rating DESC, s.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM services s JOIN users u ON s.provider_id = u.id WHERE ${where.join(' AND ')}`,
      params
    );

    res.json({
      success: true,
      services,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// POST /api/services  (provider only)
// ─────────────────────────────────────────────
const createService = async (req, res, next) => {
  try {
    await handleSingleUpload(req, res);
    const imageUrl = getFileUrl(req.file);

    const { title, type, rate, rate_per, location, state, description } = req.body;
    if (!title || !type || !rate) return next(createError('title, type, and rate are required.', 400));

    const [result] = await pool.query(
      `INSERT INTO services (provider_id, title, type, rate, rate_per, location, state, description, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, title, type, parseFloat(rate), rate_per || 'Hour',
       location || null, state || null, description || null, imageUrl]
    );

    const [[svc]] = await pool.query('SELECT * FROM services WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, message: 'Service listed!', service: svc });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// PUT /api/services/:id  (owner or admin)
// ─────────────────────────────────────────────
const updateService = async (req, res, next) => {
  try {
    const [[svc]] = await pool.query('SELECT provider_id FROM services WHERE id = ?', [req.params.id]);
    if (!svc) return next(createError('Service not found.', 404));
    if (svc.provider_id !== req.user.id && req.user.role !== 'admin') return next(createError('Forbidden.', 403));

    const { title, rate, rate_per, location, state, description, is_available } = req.body;
    const fields = [];
    const values = [];

    if (title        !== undefined) { fields.push('title = ?');        values.push(title); }
    if (rate         !== undefined) { fields.push('rate = ?');         values.push(parseFloat(rate)); }
    if (rate_per     !== undefined) { fields.push('rate_per = ?');     values.push(rate_per); }
    if (location     !== undefined) { fields.push('location = ?');     values.push(location); }
    if (state        !== undefined) { fields.push('state = ?');        values.push(state); }
    if (description  !== undefined) { fields.push('description = ?');  values.push(description); }
    if (is_available !== undefined) { fields.push('is_available = ?'); values.push(is_available ? 1 : 0); }

    if (!fields.length) return next(createError('No fields to update.', 400));
    values.push(req.params.id);
    await pool.query(`UPDATE services SET ${fields.join(', ')} WHERE id = ?`, values);

    const [[updated]] = await pool.query('SELECT * FROM services WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Service updated.', service: updated });
  } catch (err) {
    next(err);
  }
};

const getServiceById = async (req, res, next) => {
  try {
    const [[service]] = await pool.query(
      `SELECT s.*, 
              u.name AS provider_name,
              u.rating,
              u.total_reviews,
              u.is_verified AS provider_verified,
              u.profile_pic AS provider_pic
       FROM services s
       JOIN users u ON s.provider_id = u.id
       WHERE s.id = ?`,
      [req.params.id]
    );

    if (!service) {
      return next(createError('Service not found', 404));
    }

    res.json({
      success: true,
      service
    });

  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// DELETE /api/services/:id  (owner or admin)
// ─────────────────────────────────────────────
const deleteService = async (req, res, next) => {
  try {
    const [[svc]] = await pool.query('SELECT provider_id FROM services WHERE id = ?', [req.params.id]);
    if (!svc) return next(createError('Service not found.', 404));
    if (svc.provider_id !== req.user.id && req.user.role !== 'admin') return next(createError('Forbidden.', 403));
    await pool.query('DELETE FROM services WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Service deleted.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getServices, getServiceById, createService, updateService, deleteService };