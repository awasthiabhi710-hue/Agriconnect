// ═══════════════════════════════════════════
// routes/bookingRoutes.js
// ═══════════════════════════════════════════
const router = require('express').Router();
const { protect }    = require('../middleware/auth');
const { allowRoles } = require('../middleware/roleCheck');
const ctrl = require('../controllers/bookingController');

router.use(protect);

router.get('/stats',               allowRoles('provider', 'admin'), ctrl.getBookingStats);
router.get('/',                                                      ctrl.getBookings);
router.post('/',                   allowRoles('farmer'),             ctrl.createBooking);
router.get('/:id',                                                   ctrl.getBookingById);
router.patch('/:id/status',        allowRoles('provider', 'admin'),  ctrl.updateBookingStatus);
router.patch('/:id/payment',                                         ctrl.updatePaymentStatus);

module.exports = router;