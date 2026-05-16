// ═══════════════════════════════════════════
// controllers/authController.js
// Handles: Register, Login, Get Me, Update Profile
// ═══════════════════════════════════════════
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const pool       = require('../config/db');
const { createError } = require('../middleware/errorHandler');

// ── Generate signed JWT ──────────────────────
const signToken = (user) =>
  jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    process.env.JWT_SECRET || 'agriconnect_secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

// ── Safe user object (no password) ──────────
const safeUser = (u) => {
  const { password_hash, ...rest } = u;
  return rest;
};

// ─────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────
const register = async (req, res, next) => {
  try {
    const { name, mobile, email, password, role, state, district, service_type } = req.body;

    if (!name || !email || !password || !role) {
      return next(createError('name, email, password, and role are required.', 400));
    }
    if (!['farmer', 'buyer', 'provider'].includes(role)) {
      return next(createError('Invalid role. Choose farmer, buyer, or provider.', 400));
    }
    if (password.length < 6) {
      return next(createError('Password must be at least 6 characters.', 400));
    }
    if (role === 'provider' && !service_type) {
      return next(createError('service_type is required for providers.', 400));
    }

    // Check existing email
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE email = ? OR (mobile = ? AND mobile IS NOT NULL AND mobile != "")',
      [email, mobile || '']
    );
    if (existing.length) {
      return next(createError('Email or mobile already registered.', 409));
    }

    const hash = await bcrypt.hash(password, 12);

    const [result] = await pool.query(
      `INSERT INTO users (name, mobile, email, password_hash, role, state, district, service_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, mobile || null, email, hash, role, state || null, district || null, service_type || null]
    );

    const [[newUser]] = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
    const token = signToken(newUser);

    res.status(201).json({
      success: true,
      message: `Welcome to AgriConnect, ${name}!`,
      token,
      user: safeUser(newUser),
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return next(createError('Email/mobile and password are required.', 400));
    }

    // Find by email or mobile, optionally filter by role
    let query = 'SELECT * FROM users WHERE (email = ? OR mobile = ?)';
    const params = [email, email];

    if (role) {
      query += ' AND role = ?';
      params.push(role);
    }

    const [rows] = await pool.query(query, params);
    if (!rows.length) {
      return next(createError('Invalid credentials.', 401));
    }

    const user = rows[0];
    if (!user.is_active) {
      return next(createError('Account deactivated. Contact support.', 403));
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return next(createError('Invalid credentials.', 401));
    }

    const token = signToken(user);

    res.json({
      success: true,
      message: `Welcome back, ${user.name}!`,
      token,
      user: safeUser(user),
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// GET /api/auth/me  (protected)
// ─────────────────────────────────────────────
const getMe = async (req, res, next) => {
  try {
    const [[user]] = await pool.query(
      'SELECT id, name, email, mobile, role, state, district, service_type, bio, profile_pic, rating, total_reviews, is_verified, is_active, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!user) return next(createError('User not found.', 404));
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/auth/update — Real profile update
const updateProfile = async (req, res, next) => {
  try {
    await handleSingleUpload(req, res);

    const { name, mobile, state, district, bio, service_type } = req.body;
    const userId = req.user.id;

    const fields = [];
    const values = [];

    if (name)         { fields.push('name=?');         values.push(name.trim()); }
    if (mobile)       { fields.push('mobile=?');       values.push(mobile.trim()); }
    if (state)        { fields.push('state=?');        values.push(state); }
    if (district)     { fields.push('district=?');     values.push(district.trim()); }
    if (bio !== undefined) { fields.push('bio=?');     values.push(bio); }
    if (service_type) { fields.push('service_type=?'); values.push(service_type); }

    // Handle profile pic upload
    if (req.file) {
      const imageUrl = getFileUrl(req.file);
      fields.push('profile_pic=?');
      values.push(imageUrl);
    }

    // Handle base64 profile pic (from frontend preview)
    if (req.body.profile_pic && req.body.profile_pic.startsWith('data:image')) {
      fields.push('profile_pic=?');
      values.push(req.body.profile_pic);
    }

    if (!fields.length) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    values.push(userId);
    await pool.query(`UPDATE users SET ${fields.join(',')} WHERE id=?`, values);

    const [[updated]] = await pool.query(
      `SELECT id, name, email, mobile, role, state, district, service_type,
              bio, profile_pic, rating, total_reviews, is_verified, is_active, created_at
       FROM users WHERE id=?`,
      [userId]
    );

    res.json({ success: true, message: 'Profile updated successfully', user: updated });
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/auth/password — Real password change
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Both passwords are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'New password must be at least 6 characters' });
    }

    const [[user]] = await pool.query(
      'SELECT id, password_hash FROM users WHERE id=?', [req.user.id]
    );

    // Check if OAuth user (no real password)
    if (user.password_hash.startsWith('oauth_')) {
      return res.status(400).json({
        success: false,
        error: 'You signed up with Google/Facebook. Password cannot be changed here.'
      });
    }

    // Verify current password
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Current password is incorrect' });
    }

    // Hash and save new password
    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash=? WHERE id=?', [hash, req.user.id]);

    res.json({ success: true, message: 'Password changed successfully. Please login again.' });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// GET /api/auth/profile/:userId  (public)
// ─────────────────────────────────────────────
const getPublicProfile = async (req, res, next) => {
  try {
    const [[user]] = await pool.query(
      'SELECT id, name, role, state, district, service_type, bio, profile_pic, rating, total_reviews, is_verified, created_at FROM users WHERE id = ? AND is_active = 1',
      [req.params.userId]
    );
    if (!user) return next(createError('User not found.', 404));

    // Also get their active listings or services
    let listings = [];
    if (user.role === 'farmer') {
      const [products] = await pool.query(
        'SELECT id, name, category, price, unit, quantity, state, emoji, is_available FROM products WHERE farmer_id = ? AND is_available = 1 LIMIT 8',
        [user.id]
      );
      listings = products;
    } else if (user.role === 'provider') {
      const [services] = await pool.query(
        'SELECT id, title, type, rate, rate_per, location FROM services WHERE provider_id = ? AND is_available = 1 LIMIT 8',
        [user.id]
      );
      listings = services;
    }

    res.json({ success: true, user, listings });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, getMe, updateProfile, changePassword, getPublicProfile };