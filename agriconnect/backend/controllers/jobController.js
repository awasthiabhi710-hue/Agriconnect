// ═══════════════════════════════════════════
// controllers/jobController.js
// Handles: Job posts CRUD + Bids management
// ═══════════════════════════════════════════
const pool            = require('../config/db');
const { createError } = require('../middleware/errorHandler');

// ─────────────────────────────────────────────
// GET /api/jobs  — list open job posts
// ─────────────────────────────────────────────
const getJobs = async (req, res, next) => {
  try {
    const { type, status = 'open', state, page = 1, limit = 20 } = req.query;
    const where  = ['j.status = ?'];
    const params = [status];

    if (type)  { where.push('j.type = ?');         params.push(type); }
    if (state) { where.push('j.state LIKE ?');      params.push(`%${state}%`); }

    const offset = (Number(page) - 1) * Number(limit);

    const [jobs] = await pool.query(
      `SELECT j.*,
              u.name         AS farmer_name,
              u.rating       AS farmer_rating,
              u.is_verified  AS farmer_verified,
              u.profile_pic  AS farmer_pic,
              (SELECT COUNT(*) FROM bids b WHERE b.job_id = j.id) AS bid_count
       FROM job_posts j
       JOIN users u ON j.farmer_id = u.id
       WHERE ${where.join(' AND ')}
       ORDER BY j.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM job_posts j WHERE ${where.join(' AND ')}`,
      params
    );

    res.json({
      success: true,
      jobs,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// GET /api/jobs/:id  — single job post
// ─────────────────────────────────────────────
const getJobById = async (req, res, next) => {
  try {
    const [[job]] = await pool.query(
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
      [req.params.id]
    );
    if (!job) return next(createError('Job post not found.', 404));
    res.json({ success: true, job });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// POST /api/jobs  (farmer or admin)
// ─────────────────────────────────────────────
const createJob = async (req, res, next) => {
  try {
    const { title, type, budget, location, state, required_by, description } = req.body;
    if (!title || !type) return next(createError('title and type are required.', 400));

    const [result] = await pool.query(
      `INSERT INTO job_posts (farmer_id, title, type, budget, location, state, required_by, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id, title, type,
        budget      ? parseFloat(budget) : null,
        location    || null,
        state       || null,
        required_by || null,
        description || null,
      ]
    );

    const [[newJob]] = await pool.query('SELECT * FROM job_posts WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, message: 'Job posted successfully!', job: newJob });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// PUT /api/jobs/:id  (owner or admin)
// ─────────────────────────────────────────────
const updateJob = async (req, res, next) => {
  try {
    const [[job]] = await pool.query('SELECT farmer_id FROM job_posts WHERE id = ?', [req.params.id]);
    if (!job) return next(createError('Job not found.', 404));
    if (job.farmer_id !== req.user.id && req.user.role !== 'admin') {
      return next(createError('Forbidden.', 403));
    }

    const { title, type, budget, location, state, required_by, description, status } = req.body;
    const fields = [];
    const values = [];

    if (title       !== undefined) { fields.push('title = ?');       values.push(title); }
    if (type        !== undefined) { fields.push('type = ?');        values.push(type); }
    if (budget      !== undefined) { fields.push('budget = ?');      values.push(parseFloat(budget)); }
    if (location    !== undefined) { fields.push('location = ?');    values.push(location); }
    if (state       !== undefined) { fields.push('state = ?');       values.push(state); }
    if (required_by !== undefined) { fields.push('required_by = ?'); values.push(required_by); }
    if (description !== undefined) { fields.push('description = ?'); values.push(description); }
    if (status      !== undefined) { fields.push('status = ?');      values.push(status); }

    if (!fields.length) return next(createError('No fields to update.', 400));

    values.push(req.params.id);
    await pool.query(`UPDATE job_posts SET ${fields.join(', ')} WHERE id = ?`, values);

    const [[updated]] = await pool.query('SELECT * FROM job_posts WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Job updated.', job: updated });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// DELETE /api/jobs/:id  (owner or admin)
// ─────────────────────────────────────────────
const deleteJob = async (req, res, next) => {
  try {
    const [[job]] = await pool.query('SELECT farmer_id FROM job_posts WHERE id = ?', [req.params.id]);
    if (!job) return next(createError('Job not found.', 404));
    if (job.farmer_id !== req.user.id && req.user.role !== 'admin') {
      return next(createError('Forbidden.', 403));
    }

    await pool.query('DELETE FROM job_posts WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Job deleted.' });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// GET /api/jobs/:id/bids  (job owner or admin)
// ─────────────────────────────────────────────
const getJobBids = async (req, res, next) => {
  try {
    const [[job]] = await pool.query('SELECT farmer_id FROM job_posts WHERE id = ?', [req.params.id]);
    if (!job) return next(createError('Job not found.', 404));
    if (job.farmer_id !== req.user.id && req.user.role !== 'admin') {
      return next(createError('Forbidden.', 403));
    }

    const [bids] = await pool.query(
      `SELECT b.*,
              u.name         AS provider_name,
              u.rating,
              u.total_reviews,
              u.service_type,
              u.profile_pic,
              u.is_verified  AS provider_verified
       FROM bids b
       JOIN users u ON b.provider_id = u.id
       WHERE b.job_id = ?
       ORDER BY b.amount ASC`,
      [req.params.id]
    );

    res.json({ success: true, bids });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// POST /api/jobs/:id/bids  (provider only)
// ─────────────────────────────────────────────
const submitBid = async (req, res, next) => {
  try {
    const { amount, message, timeline } = req.body;
    const jobId = parseInt(req.params.id);

    if (!amount) return next(createError('Bid amount is required.', 400));

    const [[job]] = await pool.query('SELECT id, status, farmer_id FROM job_posts WHERE id = ?', [jobId]);
    if (!job) return next(createError('Job not found.', 404));
    if (job.status !== 'open') return next(createError('This job is no longer accepting bids.', 400));
    if (job.farmer_id === req.user.id) return next(createError('You cannot bid on your own job.', 400));

    const [existing] = await pool.query(
      'SELECT id FROM bids WHERE job_id = ? AND provider_id = ?',
      [jobId, req.user.id]
    );
    if (existing.length) return next(createError('You already submitted a bid for this job.', 409));

    const [result] = await pool.query(
      'INSERT INTO bids (job_id, provider_id, amount, message, timeline) VALUES (?, ?, ?, ?, ?)',
      [jobId, req.user.id, parseFloat(amount), message || null, timeline || null]
    );

    res.status(201).json({ success: true, message: 'Bid submitted!', bid_id: result.insertId });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// PATCH /api/jobs/bids/:id/accept  (job owner)
// ─────────────────────────────────────────────
const acceptBid = async (req, res, next) => {
  try {
    const [[bid]] = await pool.query(
      'SELECT b.*, j.farmer_id FROM bids b JOIN job_posts j ON b.job_id = j.id WHERE b.id = ?',
      [req.params.id]
    );
    if (!bid) return next(createError('Bid not found.', 404));
    if (bid.farmer_id !== req.user.id && req.user.role !== 'admin') {
      return next(createError('Forbidden.', 403));
    }
    if (bid.status === 'accepted') return next(createError('Bid already accepted.', 400));

    await pool.query('UPDATE bids SET status = "accepted" WHERE id = ?', [req.params.id]);
    await pool.query('UPDATE bids SET status = "rejected" WHERE job_id = ? AND id != ?', [bid.job_id, req.params.id]);
    await pool.query('UPDATE job_posts SET status = "in_progress" WHERE id = ?', [bid.job_id]);

    res.json({ success: true, message: 'Bid accepted. Job marked as in progress.' });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// PATCH /api/jobs/bids/:id/reject  (job owner)
// ─────────────────────────────────────────────
const rejectBid = async (req, res, next) => {
  try {
    const [[bid]] = await pool.query(
      'SELECT b.*, j.farmer_id FROM bids b JOIN job_posts j ON b.job_id = j.id WHERE b.id = ?',
      [req.params.id]
    );
    if (!bid) return next(createError('Bid not found.', 404));
    if (bid.farmer_id !== req.user.id && req.user.role !== 'admin') {
      return next(createError('Forbidden.', 403));
    }

    await pool.query('UPDATE bids SET status = "rejected" WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Bid rejected.' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getJobs, getJobById, createJob, updateJob, deleteJob,
  getJobBids, submitBid, acceptBid, rejectBid,
};