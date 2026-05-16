// routes/cartRoutes.js
const router = require('express').Router();
const { protect }    = require('../middleware/auth');
const { allowRoles } = require('../middleware/roleCheck');
const ctrl = require('../controllers/cartController');

router.use(protect);
router.use(allowRoles('buyer'));

router.get('/',                  ctrl.getCart);
router.post('/',                 ctrl.addToCart);
router.put('/:cartItemId',       ctrl.updateCartItem);
router.delete('/clear',          ctrl.clearCart);
router.delete('/:cartItemId',    ctrl.removeFromCart);
router.post('/checkout',         ctrl.checkout);

module.exports = router;