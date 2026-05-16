// ═══════════════════════════════════════════
// controllers/dashboardController.js
// Returns real-time stats for each role
// ═══════════════════════════════════════════
const pool            = require('../config/db');
const { createError } = require('../middleware/errorHandler');

// ─────────────────────────────────────────────
// GET /api/dashboard  (role-aware)
// ─────────────────────────────────────────────
const getDashboard = async (req, res, next) => {
  try {
    const { role, id } = req.user;

    if (role === 'farmer')   return farmerDash(req, res, next, id);
    if (role === 'buyer')    return buyerDash(req, res, next, id);
    if (role === 'provider') return providerDash(req, res, next, id);
    if (role === 'admin')    return adminDash(req, res, next);

    next(createError('Unauthorized.', 403));
  } catch (err) {
    next(err);
  }
};

// ── Farmer Dashboard ────────────────────────
async function farmerDash(req, res, next, userId) {
  const [[stats]] = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM products WHERE farmer_id = ?)             AS total_listings,
       (SELECT COUNT(*) FROM products WHERE farmer_id = ? AND is_available = 1) AS active_listings,
       (SELECT COUNT(*) FROM orders   WHERE farmer_id = ?)             AS total_orders,
       (SELECT COUNT(*) FROM orders   WHERE farmer_id = ? AND status = 'pending') AS pending_orders,
       (SELECT COALESCE(SUM(total_amount),0) FROM orders WHERE farmer_id = ? AND status = 'delivered') AS total_revenue,
       (SELECT COUNT(*) FROM job_posts WHERE farmer_id = ? AND status = 'open') AS open_jobs`,
    Array(6).fill(userId)
  );

  const [recentOrders] = await pool.query(
    `SELECT o.id, o.quantity, o.total_amount, o.status, o.created_at,
            p.name AS product_name, p.emoji,
            b.name AS buyer_name
     FROM orders o
     JOIN products p ON o.product_id = p.id
     JOIN users b    ON o.buyer_id   = b.id
     WHERE o.farmer_id = ?
     ORDER BY o.created_at DESC LIMIT 5`,
    [userId]
  );

  const [myListings] = await pool.query(
    `SELECT p.id, p.name, p.emoji, p.price, p.quantity, p.unit, p.is_available,
            (SELECT COUNT(*) FROM orders WHERE product_id = p.id) AS total_orders
     FROM products p WHERE p.farmer_id = ? ORDER BY p.created_at DESC LIMIT 8`,
    [userId]
  );

  res.json({ success: true, role: 'farmer', stats, recent_orders: recentOrders, my_listings: myListings });
}

// ── Buyer Dashboard ─────────────────────────
async function buyerDash(req, res, next, userId) {
  const [[stats]] = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM orders WHERE buyer_id = ?)                          AS total_orders,
       (SELECT COUNT(*) FROM orders WHERE buyer_id = ? AND status = 'pending')   AS pending_orders,
       (SELECT COUNT(*) FROM orders WHERE buyer_id = ? AND status = 'delivered') AS delivered_orders,
       (SELECT COALESCE(SUM(total_amount),0) FROM orders WHERE buyer_id = ?)     AS total_spent`,
    Array(4).fill(userId)
  );

  const [recentOrders] = await pool.query(
    `SELECT o.id, o.quantity, o.total_amount, o.status, o.created_at,
            p.name AS product_name, p.emoji,
            f.name AS farmer_name
     FROM orders o
     JOIN products p ON o.product_id = p.id
     JOIN users f    ON o.farmer_id  = f.id
     WHERE o.buyer_id = ?
     ORDER BY o.created_at DESC LIMIT 8`,
    [userId]
  );

  res.json({ success: true, role: 'buyer', stats, recent_orders: recentOrders });
}

// ── Provider Dashboard ──────────────────────
async function providerDash(req, res, next, userId) {
  const [[stats]] = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM services WHERE provider_id = ?)                         AS total_services,
       (SELECT COUNT(*) FROM services WHERE provider_id = ? AND is_available = 1)    AS active_services,
       (SELECT COUNT(*) FROM bids    WHERE provider_id = ?)                          AS total_bids,
       (SELECT COUNT(*) FROM bids    WHERE provider_id = ? AND status = 'accepted')  AS won_bids,
       (SELECT COUNT(*) FROM bids    WHERE provider_id = ? AND status = 'pending')   AS pending_bids`,
    Array(5).fill(userId)
  );

  const [myBids] = await pool.query(
    `SELECT b.id, b.amount, b.status, b.created_at,
            j.title AS job_title, j.type, j.location, j.budget,
            u.name  AS farmer_name
     FROM bids b
     JOIN job_posts j ON b.job_id  = j.id
     JOIN users u     ON j.farmer_id = u.id
     WHERE b.provider_id = ?
     ORDER BY b.created_at DESC LIMIT 8`,
    [userId]
  );

  const [myServices] = await pool.query(
    'SELECT * FROM services WHERE provider_id = ? ORDER BY created_at DESC LIMIT 8',
    [userId]
  );

  res.json({ success: true, role: 'provider', stats, my_bids: myBids, my_services: myServices });
}

// ── Admin Dashboard ─────────────────────────
async function adminDash(req, res) {
  const [[platform]] = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM users)                          AS total_users,
      (SELECT COUNT(*) FROM users WHERE role = 'farmer')   AS farmers,
      (SELECT COUNT(*) FROM users WHERE role = 'buyer')    AS buyers,
      (SELECT COUNT(*) FROM users WHERE role = 'provider') AS providers,
      (SELECT COUNT(*) FROM products WHERE is_available = 1) AS active_listings,
      (SELECT COUNT(*) FROM orders)                        AS total_orders,
      (SELECT COALESCE(SUM(total_amount),0) FROM orders WHERE status = 'delivered') AS total_gmv,
      (SELECT COUNT(*) FROM services WHERE is_available = 1) AS active_services,
      (SELECT COUNT(*) FROM job_posts WHERE status = 'open') AS open_jobs,
      (SELECT COUNT(*) FROM messages)                      AS total_messages`
  );

  const [recentUsers] = await pool.query(
    'SELECT id, name, email, role, state, is_verified, created_at FROM users ORDER BY created_at DESC LIMIT 10'
  );

  const [recentOrders] = await pool.query(
    `SELECT o.id, o.total_amount, o.status, o.created_at,
            p.name AS product_name, b.name AS buyer_name, f.name AS farmer_name
     FROM orders o
     JOIN products p ON o.product_id = p.id
     JOIN users b    ON o.buyer_id   = b.id
     JOIN users f    ON o.farmer_id  = f.id
     ORDER BY o.created_at DESC LIMIT 10`
  );

  const [revenueByMonth] = await pool.query(
    `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, SUM(total_amount) AS revenue
     FROM orders WHERE status = 'delivered'
     GROUP BY month ORDER BY month DESC LIMIT 6`
  );

  res.json({ success: true, role: 'admin', platform, recent_users: recentUsers, recent_orders: recentOrders, revenue_by_month: revenueByMonth });
}

// ─────────────────────────────────────────────
// GET /api/dashboard/admin/users  (admin — list all users)
// ─────────────────────────────────────────────
const getAllUsers = async (req, res, next) => {
  try {
    const { search, role, page = 1, limit = 20 } = req.query;
    const where  = [];
    const params = [];

    if (search) { where.push('(name LIKE ? OR email LIKE ? OR mobile LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (role)   { where.push('role = ?'); params.push(role); }

    const offset = (Number(page) - 1) * Number(limit);
    const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [users] = await pool.query(
      `SELECT id, name, email, mobile, role, state, is_verified, rating, total_reviews, created_at
       FROM users ${whereSQL} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM users ${whereSQL}`, params);

    res.json({ success: true, users, pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) } });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// PATCH /api/dashboard/admin/users/:id/verify
// ─────────────────────────────────────────────
const verifyUser = async (req, res, next) => {
  try {
    await pool.query('UPDATE users SET is_verified = 1 WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'User verified.' });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// PATCH /api/dashboard/admin/users/:id/deactivate
// ─────────────────────────────────────────────
const deactivateUser = async (req, res, next) => {
  try {
    await pool.query('UPDATE users SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'User deactivated.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getDashboard, getAllUsers, verifyUser, deactivateUser };