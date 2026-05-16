// routes/paymentRoutes.js
const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/paymentController');

// Webhook needs raw body — must be registered BEFORE express.json() in server.js
// We handle it here but server.js must use express.raw() for /api/payments/webhook
router.post('/webhook',        express.raw({ type: 'application/json' }), ctrl.webhook);

router.post('/create-order',   protect, ctrl.createPaymentOrder);
router.post('/verify',         protect, ctrl.verifyPayment);

module.exports = router;