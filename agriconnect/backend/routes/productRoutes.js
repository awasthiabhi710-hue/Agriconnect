// ═══════════════════════════════
// routes/productRoutes.js
// ═══════════════════════════════
const router  = require('express').Router();
const { protect, optionalAuth } = require('../middleware/auth');
const { allowRoles } = require('../middleware/roleCheck');
const ctrl = require('../controllers/productController');

router.get('/',         optionalAuth, ctrl.getProducts);
router.get('/my',       protect, allowRoles('farmer', 'admin'), ctrl.getMyProducts);
router.get('/:id',      optionalAuth, ctrl.getProductById);
router.post('/',        protect, allowRoles('farmer', 'admin'), ctrl.createProduct);
router.put('/:id',      protect, ctrl.updateProduct);
router.delete('/:id',   protect, ctrl.deleteProduct);

module.exports = router;