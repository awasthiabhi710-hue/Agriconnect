// ═══════════════════════════════════════════
// routes/jobRoutes.js
// ═══════════════════════════════════════════
const router = require('express').Router();
const { protect, optionalAuth } = require('../middleware/auth');
const { allowRoles }            = require('../middleware/roleCheck');
const ctrl                      = require('../controllers/jobController');

// Open job listings (public)
router.get('/',                   optionalAuth, ctrl.getJobs);

// Create a job post (farmer/admin only)
router.post('/',                  protect, allowRoles('farmer', 'admin'), ctrl.createJob);

// Get a single job post
router.get('/:id',                optionalAuth, ctrl.getJobById);

// Update / delete a job post (owner/admin)
router.put('/:id',                protect, ctrl.updateJob);
router.delete('/:id',             protect, ctrl.deleteJob);

// Bids on a job
router.get('/:id/bids',           protect, ctrl.getJobBids);
router.post('/:id/bids',          protect, allowRoles('provider'), ctrl.submitBid);

// Accept/reject a specific bid
router.patch('/bids/:id/accept',  protect, allowRoles('farmer', 'admin'), ctrl.acceptBid);
router.patch('/bids/:id/reject',  protect, allowRoles('farmer', 'admin'), ctrl.rejectBid);

module.exports = router;