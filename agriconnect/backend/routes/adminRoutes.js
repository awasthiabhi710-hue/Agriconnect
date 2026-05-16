const router = require('express').Router();
const pool = require('../config/db');
const { protect } = require('../middleware/auth');
const { allowRoles } = require('../middleware/roleCheck');

// All admin routes require login + admin role
router.use(protect);
router.use(allowRoles('admin'));

// ── GET /api/admin/stats — Platform overview
router.get('/stats', async (req, res) => {
  try {
    const [[stats]] = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM users)                                          AS total_users,
        (SELECT COUNT(*) FROM users WHERE role='farmer')                      AS total_farmers,
        (SELECT COUNT(*) FROM users WHERE role='buyer')                       AS total_buyers,
        (SELECT COUNT(*) FROM users WHERE role='provider')                    AS total_providers,
        (SELECT COUNT(*) FROM users WHERE is_verified=1)                      AS verified_users,
        (SELECT COUNT(*) FROM users WHERE is_verified=0 AND role!='admin')    AS unverified_users,
        (SELECT COUNT(*) FROM users WHERE is_active=0)                        AS banned_users,
        (SELECT COUNT(*) FROM products WHERE is_available=1)                  AS active_listings,
        (SELECT COUNT(*) FROM products)                                       AS total_listings,
        (SELECT COUNT(*) FROM orders)                                         AS total_orders,
        (SELECT COUNT(*) FROM orders WHERE status='pending')                  AS pending_orders,
        (SELECT COUNT(*) FROM orders WHERE status='delivered')                AS delivered_orders,
        (SELECT COUNT(*) FROM orders WHERE status='cancelled')                AS cancelled_orders,
        (SELECT COALESCE(SUM(total_amount),0) FROM orders WHERE status='delivered') AS total_gmv,
        (SELECT COUNT(*) FROM services WHERE is_available=1)                  AS active_services,
        (SELECT COUNT(*) FROM job_posts WHERE status='open')                  AS open_jobs,
        (SELECT COUNT(*) FROM messages)                                       AS total_messages,
        (SELECT COUNT(*) FROM reviews)                                        AS total_reviews,
        (SELECT COUNT(*) FROM users WHERE DATE(created_at)=CURDATE())         AS new_users_today,
        (SELECT COUNT(*) FROM orders WHERE DATE(created_at)=CURDATE())        AS orders_today,
        (SELECT COALESCE(SUM(total_amount),0) FROM orders WHERE DATE(created_at)=CURDATE()) AS revenue_today
    `);
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/admin/users — All users with filters
router.get('/users', async (req, res) => {
  try {
    const { search, role, is_verified, is_active, page = 1, limit = 20 } = req.query;
    const where = [];
    const params = [];

    if (search) {
      where.push('(u.name LIKE ? OR u.email LIKE ? OR u.mobile LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (role)        { where.push('u.role = ?');        params.push(role); }
    if (is_verified !== undefined && is_verified !== '') {
      where.push('u.is_verified = ?');
      params.push(parseInt(is_verified));
    }
    if (is_active !== undefined && is_active !== '') {
      where.push('u.is_active = ?');
      params.push(parseInt(is_active));
    }

    const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const offset = (Number(page) - 1) * Number(limit);

    const [users] = await pool.query(
      `SELECT
         u.id, u.name, u.email, u.mobile, u.role, u.state, u.district,
         u.service_type, u.rating, u.total_reviews, u.is_verified,
         u.is_active, u.profile_pic, u.created_at,
         (SELECT COUNT(*) FROM products  WHERE farmer_id  = u.id) AS product_count,
         (SELECT COUNT(*) FROM orders    WHERE buyer_id   = u.id) AS order_count,
         (SELECT COUNT(*) FROM services  WHERE provider_id= u.id) AS service_count,
         (SELECT COALESCE(SUM(total_amount),0) FROM orders WHERE farmer_id=u.id AND status='delivered') AS revenue
       FROM users u
       ${whereSQL}
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM users u ${whereSQL}`, params
    );

    res.json({ success: true, users, pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── PATCH /api/admin/users/:id/verify — with real-time badge
router.patch('/users/:id/verify', async (req, res) => {
  try {
    await pool.query('UPDATE users SET is_verified=1 WHERE id=?', [req.params.id]);

    // Emit real-time event to the verified user
    try {
      const { getIo } = require('../config/socket');
      const io = getIo();
      io.to(`user_${req.params.id}`).emit('user:verified', {
        userId:  parseInt(req.params.id),
        message: '🎉 Your account has been verified by admin! You now have a verified badge.'
      });
    } catch (e) { /* socket might not be ready */ }

    res.json({ success: true, message: 'User verified' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── PATCH /api/admin/users/:id/unverify
router.patch('/users/:id/unverify', async (req, res) => {
  try {
    await pool.query('UPDATE users SET is_verified=0 WHERE id=?', [req.params.id]);

    try {
      const { getIo } = require('../config/socket');
      const io = getIo();
      io.to(`user_${req.params.id}`).emit('user:unverified', {
        userId: parseInt(req.params.id)
      });
    } catch (e) {}

    res.json({ success: true, message: 'User unverified' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── PATCH /api/admin/users/:id/ban
router.patch('/users/:id/ban', async (req, res) => {
  try {
    if (req.params.id == req.user.id) {
      return res.status(400).json({ success: false, error: 'Cannot ban yourself' });
    }
    await pool.query('UPDATE users SET is_active=0 WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'User banned' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── PATCH /api/admin/users/:id/unban
router.patch('/users/:id/unban', async (req, res) => {
  try {
    await pool.query('UPDATE users SET is_active=1 WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'User unbanned' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── DELETE /api/admin/users/:id
router.delete('/users/:id', async (req, res) => {
  try {
    if (req.params.id == req.user.id) {
      return res.status(400).json({ success: false, error: 'Cannot delete yourself' });
    }
    await pool.query('DELETE FROM users WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'User deleted permanently' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/admin/products — All products
router.get('/products', async (req, res) => {
  try {
    const { search, category, is_available, page = 1, limit = 20 } = req.query;
    const where = [];
    const params = [];

    if (search)       { where.push('(p.name LIKE ? OR u.name LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
    if (category)     { where.push('p.category=?');      params.push(category); }
    if (is_available !== undefined && is_available !== '') {
      where.push('p.is_available=?');
      params.push(parseInt(is_available));
    }

    const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const offset = (Number(page) - 1) * Number(limit);

    const [products] = await pool.query(
      `SELECT p.*, u.name AS farmer_name, u.email AS farmer_email,
              (SELECT COUNT(*) FROM orders WHERE product_id=p.id) AS order_count
       FROM products p
       JOIN users u ON p.farmer_id = u.id
       ${whereSQL}
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM products p JOIN users u ON p.farmer_id=u.id ${whereSQL}`, params
    );

    res.json({ success: true, products, pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── DELETE /api/admin/products/:id
router.delete('/products/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM products WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/admin/orders — All orders
router.get('/orders', async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const where = status ? 'WHERE o.status=?' : '';
    const params = status ? [status] : [];
    const offset = (Number(page) - 1) * Number(limit);

    const [orders] = await pool.query(
      `SELECT o.*,
              p.name AS product_name, p.emoji,
              b.name AS buyer_name,  b.email AS buyer_email,
              f.name AS farmer_name, f.email AS farmer_email
       FROM orders o
       JOIN products p ON o.product_id = p.id
       JOIN users b    ON o.buyer_id   = b.id
       JOIN users f    ON o.farmer_id  = f.id
       ${where}
       ORDER BY o.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM orders o ${where}`, params
    );

    res.json({ success: true, orders, pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── PATCH /api/admin/orders/:id/status
router.patch('/orders/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    await pool.query('UPDATE orders SET status=? WHERE id=?', [status, req.params.id]);
    res.json({ success: true, message: `Order marked as ${status}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/admin/services
router.get('/services', async (req, res) => {
  try {
    const [services] = await pool.query(
      `SELECT s.*, u.name AS provider_name, u.email AS provider_email
       FROM services s
       JOIN users u ON s.provider_id = u.id
       ORDER BY s.created_at DESC`
    );
    res.json({ success: true, services });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── DELETE /api/admin/services/:id
router.delete('/services/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM services WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Service deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/admin/reviews
router.get('/reviews', async (req, res) => {
  try {
    const [reviews] = await pool.query(
      `SELECT r.*,
              u1.name AS reviewer_name,
              u2.name AS reviewed_name,
              p.name  AS product_name,
              s.title AS service_title
       FROM reviews r
       JOIN users u1   ON r.reviewer_id = u1.id
       JOIN users u2   ON r.reviewed_id = u2.id
       LEFT JOIN products p ON r.product_id = p.id
       LEFT JOIN services s ON r.service_id = s.id
       ORDER BY r.created_at DESC
       LIMIT 100`
    );
    res.json({ success: true, reviews });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── DELETE /api/admin/reviews/:id
router.delete('/reviews/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM reviews WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Review deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/admin/revenue — Monthly revenue chart data
router.get('/revenue', async (req, res) => {
  try {
    const [monthly] = await pool.query(
      `SELECT
         DATE_FORMAT(created_at,'%Y-%m') AS month,
         COUNT(*)                         AS order_count,
         SUM(total_amount)                AS revenue
       FROM orders
       WHERE status='delivered'
       GROUP BY month
       ORDER BY month DESC
       LIMIT 12`
    );
    const [byRole] = await pool.query(
      `SELECT role, COUNT(*) AS count FROM users GROUP BY role`
    );
    const [topFarmers] = await pool.query(
      `SELECT u.name, u.state,
              COUNT(o.id) AS orders,
              SUM(o.total_amount) AS revenue
       FROM orders o
       JOIN users u ON o.farmer_id = u.id
       WHERE o.status='delivered'
       GROUP BY o.farmer_id
       ORDER BY revenue DESC
       LIMIT 5`
    );
    const [topProducts] = await pool.query(
      `SELECT p.name, p.emoji, p.category,
              COUNT(o.id) AS orders,
              SUM(o.total_amount) AS revenue
       FROM orders o
       JOIN products p ON o.product_id = p.id
       WHERE o.status='delivered'
       GROUP BY o.product_id
       ORDER BY revenue DESC
       LIMIT 5`
    );
    res.json({ success: true, monthly, byRole, topFarmers, topProducts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/admin/jobs
router.get('/jobs', async (req, res) => {
  try {
    const [jobs] = await pool.query(
      `SELECT j.*, u.name AS farmer_name,
              (SELECT COUNT(*) FROM bids WHERE job_id=j.id) AS bid_count
       FROM job_posts j
       JOIN users u ON j.farmer_id = u.id
       ORDER BY j.created_at DESC`
    );
    res.json({ success: true, jobs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── DELETE /api/admin/jobs/:id
router.delete('/jobs/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM job_posts WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Job deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;