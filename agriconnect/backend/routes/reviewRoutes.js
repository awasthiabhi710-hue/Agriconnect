// ═══════════════════════════════════════════
// routes/reviewRoutes.js — Full Review System
// Supports: buyer→farmer (product), farmer→provider (service)
// ═══════════════════════════════════════════
const router = require('express').Router();
const { protect } = require('../middleware/auth');
const pool = require('../config/db');

// ─── AUTO-MIGRATE: ensure product_id / service_id columns exist ─────────────
(async () => {
  try {
    const conn = await pool.getConnection();
    // Add product_id if missing
    await conn.query(`
      ALTER TABLE reviews
      ADD COLUMN IF NOT EXISTS product_id INT NULL,
      ADD COLUMN IF NOT EXISTS service_id INT NULL
    `).catch(() => {
      // MySQL < 8 doesn't support IF NOT EXISTS on ALTER — try individually
    });
    conn.release();
  } catch (_) {
    // Silently ignore — columns may already exist
  }

  // Fallback for older MySQL: try each column separately
  for (const col of [
    `ALTER TABLE reviews ADD COLUMN product_id INT NULL`,
    `ALTER TABLE reviews ADD COLUMN service_id INT NULL`,
  ]) {
    try {
      const c = await pool.getConnection();
      await c.query(col);
      c.release();
    } catch (_) { /* column already exists */ }
  }
})();

// ─── GET /reviews/user/:userId ────────────────────────────────────────────────
// Fetch all reviews received by a user (for dashboard "click rating" modal)
router.get('/user/:userId', async (req, res) => {
  try {
    const [reviews] = await pool.query(
      `SELECT r.*,
              u.name         AS reviewer_name,
              u.profile_pic  AS reviewer_pic,
              u.role         AS reviewer_role,
              p.name         AS product_name,
              p.emoji        AS product_emoji,
              s.title        AS service_title
       FROM reviews r
       JOIN users u ON r.reviewer_id = u.id
       LEFT JOIN products p ON r.product_id = p.id
       LEFT JOIN services s ON r.service_id = s.id
       WHERE r.reviewed_id = ?
       ORDER BY r.created_at DESC`,
      [req.params.userId]
    );

    const [[stats]] = await pool.query(
      `SELECT
         COUNT(*)          AS total,
         ROUND(AVG(rating),1) AS average,
         SUM(rating=5)     AS five,
         SUM(rating=4)     AS four,
         SUM(rating=3)     AS three,
         SUM(rating=2)     AS two,
         SUM(rating=1)     AS one
       FROM reviews WHERE reviewed_id = ?`,
      [req.params.userId]
    );

    res.json({ success: true, reviews, stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /reviews/product/:productId ─────────────────────────────────────────
router.get('/product/:productId', async (req, res) => {
  try {
    const [reviews] = await pool.query(
      `SELECT r.*, u.name AS reviewer_name, u.profile_pic AS reviewer_pic, u.role AS reviewer_role
       FROM reviews r
       JOIN users u ON r.reviewer_id = u.id
       WHERE r.product_id = ?
       ORDER BY r.created_at DESC`,
      [req.params.productId]
    );

    const [[stats]] = await pool.query(
      `SELECT COUNT(*) AS total, ROUND(AVG(rating),1) AS average
       FROM reviews WHERE product_id = ?`,
      [req.params.productId]
    );

    res.json({ success: true, reviews, stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /reviews/service/:serviceId ─────────────────────────────────────────
router.get('/service/:serviceId', async (req, res) => {
  try {
    const [reviews] = await pool.query(
      `SELECT r.*, u.name AS reviewer_name, u.profile_pic AS reviewer_pic, u.role AS reviewer_role
       FROM reviews r
       JOIN users u ON r.reviewer_id = u.id
       WHERE r.service_id = ?
       ORDER BY r.created_at DESC`,
      [req.params.serviceId]
    );

    const [[stats]] = await pool.query(
      `SELECT COUNT(*) AS total, ROUND(AVG(rating),1) AS average
       FROM reviews WHERE service_id = ?`,
      [req.params.serviceId]
    );

    res.json({ success: true, reviews, stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /reviews — Submit a review ─────────────────────────────────────────
// Buyer  → reviews Farmer   (product review, product_id required)
// Farmer → reviews Provider (service review, service_id required)
router.post('/', protect, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const {
      reviewed_id,
      product_id,
      service_id,
      rating,
      comment,
      review_type = 'product',
    } = req.body;

    // ── Validate rating ────────────────────────────────────────────────────
    const r = parseInt(rating);
    if (!r || r < 1 || r > 5) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ success: false, error: 'Rating must be between 1 and 5' });
    }

    // ── Prevent self-review ────────────────────────────────────────────────
    if (parseInt(reviewed_id) === req.user.id) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ success: false, error: 'You cannot review yourself' });
    }

    // ── Role-based permission check ────────────────────────────────────────
    const role = req.user.role;
    if (review_type === 'product' && role !== 'buyer') {
      await conn.rollback();
      conn.release();
      return res.status(403).json({ success: false, error: 'Only buyers can review products' });
    }
    if (review_type === 'service' && role !== 'farmer') {
      await conn.rollback();
      conn.release();
      return res.status(403).json({ success: false, error: 'Only farmers can review services' });
    }

    // ── Duplicate check ────────────────────────────────────────────────────
    const checkCol = review_type === 'service' ? 'service_id' : 'product_id';
    const checkVal = review_type === 'service' ? service_id : product_id;

    if (checkVal) {
      const [dup] = await conn.query(
        `SELECT id FROM reviews WHERE reviewer_id = ? AND ${checkCol} = ?`,
        [req.user.id, checkVal]
      );
      if (dup.length) {
        await conn.rollback();
        conn.release();
        return res.status(409).json({
          success: false,
          error: `You have already reviewed this ${review_type}`
        });
      }
    }

    // ── Insert review ──────────────────────────────────────────────────────
    const [result] = await conn.query(
      `INSERT INTO reviews
         (reviewer_id, reviewed_id, product_id, service_id, rating, comment, review_type)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        reviewed_id,
        product_id  || null,
        service_id  || null,
        r,
        comment     || null,
        review_type,
      ]
    );

    // ── Recalculate reviewed user's aggregate rating ───────────────────────
    await conn.query(
      `UPDATE users
       SET rating        = (SELECT ROUND(AVG(rating),1) FROM reviews WHERE reviewed_id = ?),
           total_reviews = (SELECT COUNT(*)             FROM reviews WHERE reviewed_id = ?)
       WHERE id = ?`,
      [reviewed_id, reviewed_id, reviewed_id]
    );

    await conn.commit();

    // Return the full review object for live UI update
    const [[newReview]] = await pool.query(
      `SELECT r.*, u.name AS reviewer_name, u.profile_pic AS reviewer_pic, u.role AS reviewer_role
       FROM reviews r
       JOIN users u ON r.reviewer_id = u.id
       WHERE r.id = ?`,
      [result.insertId]
    );

    res.status(201).json({ success: true, review: newReview });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, error: err.message });
  } finally {
    conn.release();
  }
});

module.exports = router;