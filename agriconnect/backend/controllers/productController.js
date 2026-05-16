// ═══════════════════════════════════════════
// controllers/productController.js
// Handles: List, Create, Update, Delete products
// ═══════════════════════════════════════════
const pool               = require('../config/db');
const { createError }    = require('../middleware/errorHandler');
const { handleSingleUpload, getFileUrl } = require('../middleware/upload');

// Emoji map for categories
const CATEGORY_EMOJI = {
  'Grains & Cereals': '🌾',
  'Vegetables':       '🥦',
  'Fruits':           '🍎',
  'Pulses & Legumes': '🫘',
  'Spices & Herbs':   '🌶️',
  'Oilseeds':         '🌻',
  'Other':            '🌱',
};

// ─────────────────────────────────────────────
// GET /api/products
// Query params: search, category, state, sort, page, limit
// ─────────────────────────────────────────────
const getProducts = async (req, res, next) => {
  try {
    const {
      search   = '',
      category = '',
      state    = '',
      sort     = 'newest',
      page     = 1,
      limit    = 20,
    } = req.query;

    const where  = ['p.is_available = 1'];
    const params = [];

    if (search) {
      where.push('(p.name LIKE ? OR p.description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    if (category) { where.push('p.category = ?'); params.push(category); }
    if (state)    { where.push('p.state LIKE ?'); params.push(`%${state}%`); }

    const sortMap = {
      newest:       'p.created_at DESC',
      'price-low':  'p.price ASC',
      'price-high': 'p.price DESC',
      rating:       'u.rating DESC',
    };
    const orderBy = sortMap[sort] || sortMap.newest;

    const offset = (Number(page) - 1) * Number(limit);

    const sql = `
      SELECT p.*,
             u.name            AS farmer_name,
             u.rating          AS farmer_rating,
             u.total_reviews   AS farmer_reviews,
             u.is_verified     AS farmer_verified,
             u.profile_pic     AS farmer_pic,
             u.state           AS farmer_state
      FROM   products p
      JOIN   users u ON p.farmer_id = u.id
      WHERE  ${where.join(' AND ')}
      ORDER  BY ${orderBy}
      LIMIT  ? OFFSET ?`;

    const [products] = await pool.query(sql, [...params, Number(limit), offset]);

    // Count total for pagination
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM products p JOIN users u ON p.farmer_id = u.id WHERE ${where.join(' AND ')}`,
      params
    );

    res.json({
      success: true,
      products,
      pagination: {
        total,
        page:  Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// GET /api/products/:id
// ─────────────────────────────────────────────
const getProductById = async (req, res, next) => {
  try {
    const [[product]] = await pool.query(
      `SELECT p.*,
              u.name          AS farmer_name,
              u.mobile        AS farmer_mobile,
              u.rating        AS farmer_rating,
              u.total_reviews AS farmer_reviews,
              u.is_verified   AS farmer_verified,
              u.bio           AS farmer_bio,
              u.profile_pic   AS farmer_pic
       FROM   products p
       JOIN   users u ON p.farmer_id = u.id
       WHERE  p.id = ?`,
      [req.params.id]
    );
    if (!product) return next(createError('Product not found.', 404));

    // Increment views
    await pool.query('UPDATE products SET views = views + 1 WHERE id = ?', [req.params.id]);

    res.json({ success: true, product });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// POST /api/products  (farmer only)
// ─────────────────────────────────────────────
const createProduct = async (req, res, next) => {
  try {
    // Handle image upload
    await handleSingleUpload(req, res);
    const imageUrl = getFileUrl(req.file);

    const {
      name, category, price, quantity, unit,
      state, district, description, harvest_date,
    } = req.body;

    if (!name || !price || !quantity || !category) {
      return next(createError('name, category, price, and quantity are required.', 400));
    }

    const emoji = CATEGORY_EMOJI[category] || '🌾';

    const [result] = await pool.query(
      `INSERT INTO products
         (farmer_id, name, category, price, quantity, unit, state, district, description, harvest_date, emoji, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id, name, category,
        parseFloat(price), parseInt(quantity),
        unit || 'Quintal',
        state || null, district || null,
        description || null,
        harvest_date || null,
        emoji, imageUrl,
      ]
    );

    const [[newProduct]] = await pool.query('SELECT * FROM products WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, message: `${name} listed successfully!`, product: newProduct });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// PUT /api/products/:id  (owner or admin)
// ─────────────────────────────────────────────
const updateProduct = async (req, res, next) => {
  try {
    // Allow image update
    await handleSingleUpload(req, res);

    const [[existing]] = await pool.query('SELECT farmer_id FROM products WHERE id = ?', [req.params.id]);
    if (!existing) return next(createError('Product not found.', 404));
    if (existing.farmer_id !== req.user.id && req.user.role !== 'admin') {
      return next(createError('Forbidden.', 403));
    }

    const { name, price, quantity, description, is_available, state } = req.body;
    const fields = [];
    const values = [];

    if (name         !== undefined) { fields.push('name = ?');         values.push(name); }
    if (price        !== undefined) { fields.push('price = ?');        values.push(parseFloat(price)); }
    if (quantity     !== undefined) { fields.push('quantity = ?');     values.push(parseInt(quantity)); }
    if (description  !== undefined) { fields.push('description = ?');  values.push(description); }
    if (is_available !== undefined) { fields.push('is_available = ?'); values.push(is_available); }
    if (state        !== undefined) { fields.push('state = ?');        values.push(state); }
    if (req.file) {
      fields.push('image_url = ?');
      values.push(getFileUrl(req.file));
    }

    if (!fields.length) return next(createError('No fields to update.', 400));

    values.push(req.params.id);
    await pool.query(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, values);

    const [[updated]] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Product updated.', product: updated });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// DELETE /api/products/:id  (owner or admin)
// ─────────────────────────────────────────────
const deleteProduct = async (req, res, next) => {
  try {
    const [[existing]] = await pool.query('SELECT farmer_id FROM products WHERE id = ?', [req.params.id]);
    if (!existing) return next(createError('Product not found.', 404));
    if (existing.farmer_id !== req.user.id && req.user.role !== 'admin') {
      return next(createError('Forbidden.', 403));
    }

    await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Product deleted.' });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// GET /api/products/my  (farmer — own listings)
// ─────────────────────────────────────────────
const getMyProducts = async (req, res, next) => {
  try {
    const [products] = await pool.query(
      'SELECT p.*, (SELECT COUNT(*) FROM orders o WHERE o.product_id = p.id) AS total_orders FROM products p WHERE p.farmer_id = ? ORDER BY p.created_at DESC',
      [req.user.id]
    );
    res.json({ success: true, products });
  } catch (err) {
    next(err);
  }
};

module.exports = { getProducts, getProductById, createProduct, updateProduct, deleteProduct, getMyProducts };