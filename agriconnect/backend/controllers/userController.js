// ═══════════════════════════════════════════
// controllers/userController.js
// Handles: Public profiles, Reviews, User search
// ═══════════════════════════════════════════
const pool            = require('../config/db');
const { createError } = require('../middleware/errorHandler');

// ─────────────────────────────────────────────
// GET /api/users/:id  — public profile
// ─────────────────────────────────────────────
const getUserProfile = async (req, res, next) => {
  try {
    const [[user]] = await pool.query(
      `SELECT id, name, role, state, district, service_type, bio,
              profile_pic, rating, total_reviews, is_verified, created_at
       FROM users WHERE id = ? AND is_active = 1`,
      [req.params.id]
    );
    if (!user) return next(createError('User not found.', 404));

    let listings = [];
    if (user.role === 'farmer') {
      const [products] = await pool.query(
        `SELECT id, name, category, price, unit, quantity, state, emoji, image_url, is_available, created_at
         FROM products WHERE farmer_id = ? AND is_available = 1
         ORDER BY created_at DESC LIMIT 8`,
        [user.id]
      );
      listings = products;
    } else if (user.role === 'provider') {
      const [services] = await pool.query(
        `SELECT id, title, type, rate, rate_per, location, image_url, is_available
         FROM services WHERE provider_id = ? AND is_available = 1
         ORDER BY created_at DESC LIMIT 8`,
        [user.id]
      );
      listings = services;
    }

    // Recent reviews
    const [reviews] = await pool.query(
      `SELECT r.rating, r.comment, r.created_at, u.name AS reviewer_name, u.profile_pic AS reviewer_pic
       FROM reviews r JOIN users u ON r.reviewer_id = u.id
       WHERE r.reviewed_id = ?
       ORDER BY r.created_at DESC LIMIT 5`,
      [user.id]
    );

    res.json({ success: true, user, listings, reviews });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// POST /api/users/:id/reviews  (protected)
// ─────────────────────────────────────────────
const submitReview = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { rating, comment, order_id } = req.body;
    const reviewedId = parseInt(req.params.id);

    if (!rating || rating < 1 || rating > 5) {
      await conn.rollback();
      return next(createError('rating must be between 1 and 5.', 400));
    }
    if (reviewedId === req.user.id) {
      await conn.rollback();
      return next(createError('You cannot review yourself.', 400));
    }

    // Check if already reviewed for this order
    if (order_id) {
      const [dup] = await conn.query(
        'SELECT id FROM reviews WHERE reviewer_id = ? AND reviewed_id = ? AND order_id = ?',
        [req.user.id, reviewedId, order_id]
      );
      if (dup.length) {
        await conn.rollback();
        return next(createError('You already reviewed this transaction.', 409));
      }
    }

    await conn.query(
      'INSERT INTO reviews (reviewer_id, reviewed_id, rating, comment, order_id) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, reviewedId, rating, comment || null, order_id || null]
    );

    // Recalculate user rating
    await conn.query(
      `UPDATE users
       SET rating        = (SELECT ROUND(AVG(rating), 1) FROM reviews WHERE reviewed_id = ?),
           total_reviews = (SELECT COUNT(*)              FROM reviews WHERE reviewed_id = ?)
       WHERE id = ?`,
      [reviewedId, reviewedId, reviewedId]
    );

    await conn.commit();
    res.status(201).json({ success: true, message: 'Review submitted. Thank you!' });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

// ─────────────────────────────────────────────
// GET /api/users/:id/reviews
// ─────────────────────────────────────────────
const getUserReviews = async (req, res, next) => {
  try {
    const [reviews] = await pool.query(
      `SELECT r.id, r.rating, r.comment, r.review_type, r.created_at,
              u.id AS reviewer_id, u.name AS reviewer_name, u.profile_pic AS reviewer_pic, u.role AS reviewer_role
       FROM reviews r JOIN users u ON r.reviewer_id = u.id
       WHERE r.reviewed_id = ?
       ORDER BY r.created_at DESC`,
      [req.params.id]
    );

    const [[stats]] = await pool.query(
      `SELECT
         COUNT(*)                                  AS total,
         ROUND(AVG(rating), 1)                     AS average,
         SUM(rating = 5)                           AS five_star,
         SUM(rating = 4)                           AS four_star,
         SUM(rating = 3)                           AS three_star,
         SUM(rating <= 2)                          AS low_star
       FROM reviews WHERE reviewed_id = ?`,
      [req.params.id]
    );

    res.json({ success: true, reviews, stats });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// GET /api/users/search  — search farmers/providers
// ─────────────────────────────────────────────
const searchUsers = async (req, res, next) => {
  try {
    const { q, role, state } = req.query;
    if (!q) return next(createError('Search query (q) is required.', 400));

    const where  = ['is_active = 1', '(name LIKE ? OR bio LIKE ?)'];
    const params = [`%${q}%`, `%${q}%`];

    if (role)  { where.push('role = ?');        params.push(role); }
    if (state) { where.push('state LIKE ?');    params.push(`%${state}%`); }
    // Only show farmers and providers in search
    if (!role) { where.push('role IN ("farmer","provider")'); }

    const [users] = await pool.query(
      `SELECT id, name, role, state, service_type, profile_pic, rating, total_reviews, is_verified
       FROM users WHERE ${where.join(' AND ')}
       ORDER BY rating DESC, total_reviews DESC LIMIT 20`,
      params
    );

    res.json({ success: true, users });
  } catch (err) {
    next(err);
  }
};

module.exports = { getUserProfile, submitReview, getUserReviews, searchUsers };