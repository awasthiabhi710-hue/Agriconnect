// routes/chatRoutes.js
const router = require('express').Router();
const { protect } = require('../middleware/auth');
const ctrl = require('../controllers/chatController');

router.use(protect);

router.get('/conversations',        ctrl.getConversations);
router.get('/unread',               ctrl.getUnreadCount);
router.get('/messages/:partnerId',  ctrl.getMessages);
router.post('/send',                ctrl.sendMessage);

module.exports = router;