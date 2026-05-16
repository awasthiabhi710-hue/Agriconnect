// ═══════════════════════════════════════════
// controllers/paymentController.js
// Handles: Razorpay order creation & verification
// ═══════════════════════════════════════════
const crypto          = require('crypto');
const pool            = require('../config/db');
const razorpay        = require('../config/razorpay');
const { createError } = require('../middleware/errorHandler');

// ─────────────────────────────────────────────
// POST /api/payments/create-order
// Creates a Razorpay order before actual payment
// ─────────────────────────────────────────────
const createPaymentOrder = async (req, res, next) => {
  try {
    const { order_id } = req.body;  // Our DB order id
    if (!order_id) return next(createError('order_id is required.', 400));

    const [[order]] = await pool.query(
      'SELECT * FROM orders WHERE id = ? AND buyer_id = ?',
      [order_id, req.user.id]
    );
    if (!order) return next(createError('Order not found.', 404));
    if (order.payment_status === 'paid') return next(createError('Order already paid.', 400));

    // Amount in paise (multiply by 100)
    const rzpOrder = await razorpay.orders.create({
      amount:   Math.round(order.total_amount * 100),
      currency: 'INR',
      receipt:  `agriconnect_order_${order_id}`,
      notes: {
        order_id:   String(order_id),
        buyer_id:   String(req.user.id),
        farmer_id:  String(order.farmer_id),
      },
    });

    // Store Razorpay order id for later verification
    await pool.query(
      'UPDATE orders SET payment_txn_id = ? WHERE id = ?',
      [rzpOrder.id, order_id]
    );

    res.json({
      success: true,
      razorpay_order_id: rzpOrder.id,
      amount:            rzpOrder.amount,
      currency:          rzpOrder.currency,
      key_id:            process.env.RAZORPAY_KEY_ID,
      prefill: {
        name:  req.user.name,
        email: req.user.email,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// POST /api/payments/verify
// Verify Razorpay signature after payment success
// ─────────────────────────────────────────────
const verifyPayment = async (req, res, next) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      order_id,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return next(createError('Missing payment verification fields.', 400));
    }

    // HMAC-SHA256 verification
    const body      = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected  = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(body)
      .digest('hex');

    if (expected !== razorpay_signature) {
      return next(createError('Payment signature verification failed.', 400));
    }

    // Mark order as paid
    await pool.query(
      `UPDATE orders
       SET payment_status = 'paid',
           payment_txn_id  = ?,
           status          = 'processing'
       WHERE id = ? AND buyer_id = ?`,
      [razorpay_payment_id, order_id, req.user.id]
    );

    res.json({
      success: true,
      message: 'Payment verified. Order is now processing!',
      payment_id: razorpay_payment_id,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// POST /api/payments/webhook  (Razorpay webhook)
// For server-to-server payment confirmation
// ─────────────────────────────────────────────
const webhook = async (req, res, next) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const body      = JSON.stringify(req.body);

    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(body)
      .digest('hex');

    if (expected !== signature) {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    const event = req.body.event;

    if (event === 'payment.captured') {
      const payment = req.body.payload.payment.entity;
      const orderId = payment.notes?.order_id;
      if (orderId) {
        await pool.query(
          `UPDATE orders SET payment_status = 'paid', status = 'processing', payment_txn_id = ? WHERE id = ?`,
          [payment.id, orderId]
        );
      }
    }

    if (event === 'payment.failed') {
      const payment = req.body.payload.payment.entity;
      const orderId = payment.notes?.order_id;
      if (orderId) {
        await pool.query(
          `UPDATE orders SET payment_status = 'failed' WHERE id = ?`,
          [orderId]
        );
      }
    }

    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
};

module.exports = { createPaymentOrder, verifyPayment, webhook };