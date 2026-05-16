// routes/userRoutes.js
const router = require('express').Router();
const { protect, optionalAuth } = require('../middleware/auth');
const { allowRoles } = require('../middleware/roleCheck');
const ctrl = require('../controllers/userController');

router.get('/search',          optionalAuth, ctrl.searchUsers);
router.get('/:id',             ctrl.getUserProfile);
router.get('/:id/reviews',     ctrl.getUserReviews);
router.post('/:id/reviews',    protect, ctrl.submitReview);

module.exports = router;