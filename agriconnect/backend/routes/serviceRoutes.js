// ═══════════════════════════════════════════
// routes/serviceRoutes.js
// Service provider listings ONLY.
// Jobs and bids live in routes/jobRoutes.js
// ═══════════════════════════════════════════
const router = require('express').Router();
const { protect, optionalAuth } = require('../middleware/auth');
const { allowRoles } = require('../middleware/roleCheck');
const ctrl = require('../controllers/serviceController');

console.log('✅ serviceRoutes loaded — routes: GET /, GET /:id, POST /, PUT /:id, DELETE /:id');


router.get('/',       optionalAuth,                             ctrl.getServices);
router.get('/:id', optionalAuth, ctrl.getServiceById);
router.post('/',      protect, allowRoles('provider', 'admin'), ctrl.createService);
router.put('/:id',    protect,                                  ctrl.updateService);
router.delete('/:id', protect,                                  ctrl.deleteService);

module.exports = router;