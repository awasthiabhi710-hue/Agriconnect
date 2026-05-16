// routes/orderRoutes.js
const router = require('express').Router();
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/orderController');

router.post('/',              protect, ctrl.placeOrder);
router.get('/',               protect, ctrl.getOrders);
router.get('/stats',          protect, ctrl.getOrderStats);
router.get('/:id',            protect, ctrl.getOrderById);
router.patch('/:id/status',   protect, ctrl.updateOrderStatus);

module.exports = router;