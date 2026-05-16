// routes/dashboardRoutes.js
const router = require('express').Router();
const { protect }    = require('../middleware/auth');
const { allowRoles } = require('../middleware/roleCheck');
const ctrl = require('../controllers/dashboardController');

router.get('/',                                    protect, ctrl.getDashboard);
router.get('/admin/users',                         protect, allowRoles('admin'), ctrl.getAllUsers);
router.patch('/admin/users/:id/verify',            protect, allowRoles('admin'), ctrl.verifyUser);
router.patch('/admin/users/:id/deactivate',        protect, allowRoles('admin'), ctrl.deactivateUser);

module.exports = router;