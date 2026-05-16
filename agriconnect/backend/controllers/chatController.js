// ═══════════════════════════════════════════
// controllers/chatController.js
// Handles: Conversations list, message history, send message
// Real-time handled via Socket.io (socket/chatHandler.js)
// ═══════════════════════════════════════════
const pool            = require('../config/db');
const { createError } = require('../middleware/errorHandler');

// ─────────────────────────────────────────────
// GET /api/chat/conversations
// Returns all conversation partners with last message + unread count
// ─────────────────────────────────────────────
const getConversations = async (req, res, next) => {
  try {
    const myId = req.user.id;

    const [conversations] = await pool.query(
      `SELECT
         u.id,
         u.name,
         u.role,
         u.profile_pic,
         u.is_verified,
         (
           SELECT content
           FROM messages
           WHERE (sender_id = ? AND receiver_id = u.id)
              OR (sender_id = u.id AND receiver_id = ?)
           ORDER BY created_at DESC
           LIMIT 1
         ) AS last_message,
         (
           SELECT created_at
           FROM messages
           WHERE (sender_id = ? AND receiver_id = u.id)
              OR (sender_id = u.id AND receiver_id = ?)
           ORDER BY created_at DESC
           LIMIT 1
         ) AS last_time,
         (
           SELECT COUNT(*)
           FROM messages
           WHERE sender_id = u.id AND receiver_id = ? AND is_read = 0
         ) AS unread_count
       FROM users u
       WHERE u.id != ?
         AND EXISTS (
           SELECT 1 FROM messages
           WHERE (sender_id = ? AND receiver_id = u.id)
              OR (sender_id = u.id AND receiver_id = ?)
         )
       ORDER BY last_time DESC`,
      [myId, myId, myId, myId, myId, myId, myId, myId]
    );

    res.json({ success: true, conversations });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// GET /api/chat/messages/:partnerId
// Returns full message history with a partner
// ─────────────────────────────────────────────
const getMessages = async (req, res, next) => {
  try {
    const myId      = req.user.id;
    const partnerId = parseInt(req.params.partnerId);
    const { page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const [messages] = await pool.query(
      `SELECT m.*,
              s.name       AS sender_name,
              s.profile_pic AS sender_pic
       FROM messages m
       JOIN users s ON m.sender_id = s.id
       WHERE (m.sender_id = ? AND m.receiver_id = ?)
          OR (m.sender_id = ? AND m.receiver_id = ?)
       ORDER BY m.created_at ASC
       LIMIT ? OFFSET ?`,
      [myId, partnerId, partnerId, myId, Number(limit), offset]
    );

    // Mark all received messages as read
    await pool.query(
      'UPDATE messages SET is_read = 1 WHERE receiver_id = ? AND sender_id = ? AND is_read = 0',
      [myId, partnerId]
    );

    // Get partner info
    const [[partner]] = await pool.query(
      'SELECT id, name, role, profile_pic, is_verified FROM users WHERE id = ?',
      [partnerId]
    );
    if (!partner) return next(createError('User not found.', 404));

    res.json({ success: true, messages, partner });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// POST /api/chat/send
// Send a message (also persists to DB; real-time via socket)
// ─────────────────────────────────────────────
const sendMessage = async (req, res, next) => {
  try {
    const { receiver_id, content } = req.body;

    if (!receiver_id || !content?.trim()) {
      return next(createError('receiver_id and content are required.', 400));
    }
    if (parseInt(receiver_id) === req.user.id) {
      return next(createError('Cannot send a message to yourself.', 400));
    }

    const [[receiver]] = await pool.query('SELECT id, name FROM users WHERE id = ?', [receiver_id]);
    if (!receiver) return next(createError('Receiver not found.', 404));

    const [result] = await pool.query(
      'INSERT INTO messages (sender_id, receiver_id, content, is_read) VALUES (?, ?, ?, 0)',
      [req.user.id, parseInt(receiver_id), content.trim()]
    );

    const [[message]] = await pool.query(
      `SELECT m.*, s.name AS sender_name, s.profile_pic AS sender_pic
       FROM messages m JOIN users s ON m.sender_id = s.id
       WHERE m.id = ?`,
      [result.insertId]
    );

    res.status(201).json({ success: true, message });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────
// GET /api/chat/unread-count
// Total unread messages for the logged-in user
// ─────────────────────────────────────────────
const getUnreadCount = async (req, res, next) => {
  try {
    const [[{ count }]] = await pool.query(
      'SELECT COUNT(*) AS count FROM messages WHERE receiver_id = ? AND is_read = 0',
      [req.user.id]
    );
    res.json({ success: true, unread: count });
  } catch (err) {
    next(err);
  }
};

module.exports = { getConversations, getMessages, sendMessage, getUnreadCount };