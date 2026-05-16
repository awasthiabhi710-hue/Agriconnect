// ═══════════════════════════════════════════
// models/Message.js
// ═══════════════════════════════════════════
const pool = require('../config/db');

const Message = {
  async create({ sender_id, receiver_id, content }, conn = pool) {
    const [result] = await conn.query(
      'INSERT INTO messages (sender_id, receiver_id, content, is_read) VALUES (?, ?, ?, 0)',
      [sender_id, parseInt(receiver_id), content.trim()]
    );
    return result.insertId;
  },

  async findById(id) {
    const [[row]] = await pool.query(
      `SELECT m.*, s.name AS sender_name, s.profile_pic AS sender_pic
       FROM messages m JOIN users s ON m.sender_id = s.id
       WHERE m.id = ?`,
      [id]
    );
    return row || null;
  },

  async getHistory(userId, partnerId, page = 1, limit = 50) {
    const offset = (Number(page) - 1) * Number(limit);
    const [messages] = await pool.query(
      `SELECT m.*, s.name AS sender_name, s.profile_pic AS sender_pic
       FROM messages m
       JOIN users s ON m.sender_id = s.id
       WHERE (m.sender_id = ? AND m.receiver_id = ?)
          OR (m.sender_id = ? AND m.receiver_id = ?)
       ORDER BY m.created_at ASC
       LIMIT ? OFFSET ?`,
      [userId, partnerId, partnerId, userId, Number(limit), offset]
    );
    return messages;
  },

  async markRead(receiverId, senderId) {
    await pool.query(
      'UPDATE messages SET is_read = 1 WHERE receiver_id = ? AND sender_id = ? AND is_read = 0',
      [receiverId, senderId]
    );
  },

  async getUnreadCount(userId) {
    const [[{ count }]] = await pool.query(
      'SELECT COUNT(*) AS count FROM messages WHERE receiver_id = ? AND is_read = 0',
      [userId]
    );
    return count;
  },

  async getConversations(userId) {
    const [rows] = await pool.query(
      `SELECT
         u.id, u.name, u.role, u.profile_pic, u.is_verified,
         (SELECT content FROM messages
          WHERE (sender_id = ? AND receiver_id = u.id) OR (sender_id = u.id AND receiver_id = ?)
          ORDER BY created_at DESC LIMIT 1) AS last_message,
         (SELECT created_at FROM messages
          WHERE (sender_id = ? AND receiver_id = u.id) OR (sender_id = u.id AND receiver_id = ?)
          ORDER BY created_at DESC LIMIT 1) AS last_time,
         (SELECT COUNT(*) FROM messages
          WHERE sender_id = u.id AND receiver_id = ? AND is_read = 0) AS unread_count
       FROM users u
       WHERE u.id != ?
         AND EXISTS (
           SELECT 1 FROM messages
           WHERE (sender_id = ? AND receiver_id = u.id) OR (sender_id = u.id AND receiver_id = ?)
         )
       ORDER BY last_time DESC`,
      Array(8).fill(userId)
    );
    return rows;
  },
};

module.exports = Message;