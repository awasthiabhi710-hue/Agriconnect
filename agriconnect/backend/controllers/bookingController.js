// ═══════════════════════════════════════════
// controllers/bookingController.js
// Handles: Service bookings for providers
// ═══════════════════════════════════════════
const pool            = require('../config/db');
const { createError } = require('../middleware/errorHandler');

// ─────────────────────────────────────────────
// POST /api/bookings  — create a booking (farmer pays for a service)
// ─────────────────────────────────────────────
const createBooking = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { service_id, units = 1, notes, payment_method = 'upi' } = req.body;
    if (!service_id) {
      await conn.rollback();
      return next(createError('service_id is required.', 400));
    }

    const [[service]] = await conn.query(
      `SELECT s.*, u.name AS provider_name
       FROM services s JOIN users u ON s.provider_id = u.id
       WHERE s.id = ? AND s.is_available = 1 FOR UPDATE`,
      [service_id]
    );
    if (!service) {
      await conn.rollback();
      return next(createError('Service not found or unavailable.', 404));
    }
    if (service.provider_id === req.user.id) {
      await conn.rollback();
      return next(createError('Cannot book your own service.', 400));
    }

    const total_amount = service.rate * parseInt(units);

    const [result] = await conn.query(
      `INSERT INTO service_bookings
         (service_id, farmer_id, provider_id, units, unit_rate, total_amount, payment_method, notes, status, payment_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [
        service_id, req.user.id, service.provider_id,
        parseInt(units), service.rate, total_amount,
        payment_method, notes || null,
        payment_method === 'cash' ? 'pending' : 'pending',
      ]
    );

    // If cash — mark as confirmed immediately
    if (payment_method === 'cash') {
      await conn.query(
        `UPDATE service_bookings SET status = 'confirmed', payment_status = 'pending' WHERE id = ?`,
        [result.insertId]
      );
    }

    await conn.commit();

    const [[booking]] = await pool.query(
      `SELECT sb.*,
              s.title AS service_title, s.type AS service_type, s.rate_per,
              u.name AS farmer_name, u.mobile AS farmer_mobile,
              p.name AS provider_name
       FROM service_bookings sb
       JOIN services s ON sb.service_id = s.id
       JOIN users u    ON sb.farmer_id  = u.id
       JOIN users p    ON sb.provider_id = p.id
       WHERE sb.id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'Service booked successfully!',
      booking,
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

// ─────────────────────────────────────────────
// GET /api/bookings  — role-aware list
// ─────────────────────────────────────────────
const getBookings = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const role = req.user.role;

    let whereClause = '';
    const params = [];

    if (role === 'provider') {
      whereClause = 'WHERE sb.provider_id = ?';
      params.push(req.user.id);
    } else if (role === 'farmer') {
      whereClause = 'WHERE sb.farmer_id = ?';
      params.push(req.user.id);
    } else if (role === 'admin') {
      whereClause = '';
    } else {
      return next(createError('Unauthorized.', 403));
    }

    if (status) {
      whereClause += (whereClause ? ' AND ' : 'WHERE ') + 'sb.status = ?';
      params.push(status);
    }

    const [bookings] = await pool.query(
      `SELECT sb.*,
              s.title    AS service_title,
              s.type     AS service_type,
              s.rate_per AS rate_per,
              s.image_url AS service_image,
              u.name     AS farmer_name,
              u.mobile   AS farmer_mobile,
              u.state    AS farmer_state,
              p.name     AS provider_name,
              p.mobile   AS provider_mobile
       FROM service_bookings sb
       JOIN services s ON sb.service_id  = s.id
       JOIN users u    ON sb.farmer_id   = u.id
       JOIN users p    ON sb.provider_id = p.id
       ${whereClause}
       ORDER BY sb.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM service_bookings sb ${whereClause}`,
      params
    );

    res.json({
      success: true,
      bookings,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// GET /api/bookings/:id
// ─────────────────────────────────────────────
const getBookingById = async (req, res, next) => {
  try {
    const [[booking]] = await pool.query(
      `SELECT sb.*,
              s.title AS service_title, s.type AS service_type, s.rate_per,
              s.description AS service_description, s.image_url AS service_image,
              u.name AS farmer_name, u.mobile AS farmer_mobile, u.state AS farmer_state,
              p.name AS provider_name, p.mobile AS provider_mobile
       FROM service_bookings sb
       JOIN services s ON sb.service_id  = s.id
       JOIN users u    ON sb.farmer_id   = u.id
       JOIN users p    ON sb.provider_id = p.id
       WHERE sb.id = ?`,
      [req.params.id]
    );
    if (!booking) return next(createError('Booking not found.', 404));

    const uid  = req.user.id;
    const role = req.user.role;
    if (role !== 'admin' && booking.farmer_id !== uid && booking.provider_id !== uid) {
      return next(createError('Forbidden.', 403));
    }

    res.json({ success: true, booking });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// PATCH /api/bookings/:id/status  (provider or admin)
// ─────────────────────────────────────────────
const updateBookingStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];

    if (!validStatuses.includes(status)) {
      return next(createError(`Invalid status. Valid: ${validStatuses.join(', ')}`, 400));
    }

    const [[booking]] = await pool.query(
      'SELECT * FROM service_bookings WHERE id = ?',
      [req.params.id]
    );
    if (!booking) return next(createError('Booking not found.', 404));

    const uid  = req.user.id;
    const role = req.user.role;
    if (role !== 'admin' && booking.provider_id !== uid) {
      return next(createError('Only the provider can update booking status.', 403));
    }

    const completedAt = status === 'completed' ? new Date() : null;
    await pool.query(
      'UPDATE service_bookings SET status = ?, completed_at = COALESCE(?, completed_at) WHERE id = ?',
      [status, completedAt, req.params.id]
    );

    const [[updated]] = await pool.query(
      `SELECT sb.*,
              s.title AS service_title, s.type AS service_type, s.rate_per,
              u.name AS farmer_name, p.name AS provider_name
       FROM service_bookings sb
       JOIN services s ON sb.service_id  = s.id
       JOIN users u    ON sb.farmer_id   = u.id
       JOIN users p    ON sb.provider_id = p.id
       WHERE sb.id = ?`,
      [req.params.id]
    );

    res.json({ success: true, message: `Booking marked as ${status}.`, booking: updated });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// PATCH /api/bookings/:id/payment  (mark payment received)
// ─────────────────────────────────────────────
const updatePaymentStatus = async (req, res, next) => {
  try {
    const { payment_status, payment_txn_id } = req.body;
    const validPayStatuses = ['pending', 'paid', 'failed', 'refunded'];

    if (!validPayStatuses.includes(payment_status)) {
      return next(createError('Invalid payment_status.', 400));
    }

    const [[booking]] = await pool.query(
      'SELECT * FROM service_bookings WHERE id = ?',
      [req.params.id]
    );
    if (!booking) return next(createError('Booking not found.', 404));

    const uid  = req.user.id;
    if (req.user.role !== 'admin' && booking.provider_id !== uid && booking.farmer_id !== uid) {
      return next(createError('Forbidden.', 403));
    }

    await pool.query(
      `UPDATE service_bookings SET payment_status = ?, payment_txn_id = COALESCE(?, payment_txn_id),
       status = CASE WHEN ? = 'paid' THEN 'confirmed' ELSE status END
       WHERE id = ?`,
      [payment_status, payment_txn_id || null, payment_status, req.params.id]
    );

    res.json({ success: true, message: 'Payment status updated.' });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// GET /api/bookings/stats  (provider dashboard stats)
// ─────────────────────────────────────────────
const getBookingStats = async (req, res, next) => {
  try {
    const uid = req.user.id;
    const [[stats]] = await pool.query(
      `SELECT
         COUNT(*) AS total,
         SUM(status = 'pending')     AS pending,
         SUM(status = 'confirmed')   AS confirmed,
         SUM(status = 'in_progress') AS in_progress,
         SUM(status = 'completed')   AS completed,
         SUM(status = 'cancelled')   AS cancelled,
         COALESCE(SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END), 0) AS total_earned
       FROM service_bookings WHERE provider_id = ?`,
      [uid]
    );
    res.json({ success: true, stats });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createBooking,
  getBookings,
  getBookingById,
  updateBookingStatus,
  updatePaymentStatus,
  getBookingStats,
};