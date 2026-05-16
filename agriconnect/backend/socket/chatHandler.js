// ═══════════════════════════════════════════
// socket/chatHandler.js
// Real-time chat via Socket.io
// Persists every message to MySQL
// ═══════════════════════════════════════════
const jwt  = require('jsonwebtoken');
const pool = require('../config/db');

// Map: userId (string) → Set of socketIds (user can have multiple tabs)
const onlineUsers = new Map();

function chatHandler(io) {
  // ── Auth middleware for socket connections ──
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      return next(new Error('Authentication required.'));
    }
    try {
      socket.user = jwt.verify(token, process.env.JWT_SECRET || 'agriconnect_secret');
      next();
    } catch {
      next(new Error('Invalid or expired token.'));
    }
  });

  io.on('connection', (socket) => {
    const userId = String(socket.user.id);
    console.log(`💬 Chat connected: User ${userId} (${socket.user.name}) — socket ${socket.id}`);

    // ── Register user as online ──────────────
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socket.id);

    // Broadcast online status to everyone
    io.emit('user:online', { userId, name: socket.user.name });

    // ── Join private room with a partner ────
    socket.on('chat:join', ({ partnerId }) => {
      const room = getRoomId(userId, String(partnerId));
      socket.join(room);
      socket.currentRoom = room;
      socket.partnerId   = String(partnerId);
    });

    // ── Send message ────────────────────────
    socket.on('chat:message', async ({ receiverId, content, tempId }) => {
      if (!content?.trim()) return;

      try {
        // Persist to DB
        const [result] = await pool.query(
          'INSERT INTO messages (sender_id, receiver_id, content, is_read) VALUES (?, ?, ?, 0)',
          [socket.user.id, parseInt(receiverId), content.trim()]
        );

        const msgData = {
          id:          result.insertId,
          tempId,                          // client-side temp id for optimistic UI
          sender_id:   socket.user.id,
          receiver_id: parseInt(receiverId),
          sender_name: socket.user.name,
          content:     content.trim(),
          is_read:     false,
          created_at:  new Date().toISOString(),
        };

        const room = getRoomId(userId, String(receiverId));
        // Deliver to both users in the room
        io.to(room).emit('chat:message', msgData);

        // If receiver is NOT in the room (different page), send notification
        const receiverSockets = onlineUsers.get(String(receiverId));
        if (receiverSockets) {
          receiverSockets.forEach((sid) => {
            const receiverSocket = io.sockets.sockets.get(sid);
            if (receiverSocket && receiverSocket.currentRoom !== room) {
              receiverSocket.emit('chat:notification', {
                from_id:   socket.user.id,
                from_name: socket.user.name,
                preview:   content.trim().substring(0, 60),
              });
            }
          });
        }
      } catch (err) {
        socket.emit('chat:error', { message: 'Failed to send message. Please try again.' });
        console.error('Socket message error:', err.message);
      }
    });

    // ── Mark messages as read ───────────────
    socket.on('chat:read', async ({ partnerId }) => {
      try {
        await pool.query(
          'UPDATE messages SET is_read = 1 WHERE receiver_id = ? AND sender_id = ? AND is_read = 0',
          [socket.user.id, parseInt(partnerId)]
        );
        const room = getRoomId(userId, String(partnerId));
        io.to(room).emit('chat:read', { by: socket.user.id, partnerId });
      } catch (err) {
        console.error('Mark read error:', err.message);
      }
    });

    // ── Typing indicator ────────────────────
    socket.on('chat:typing', ({ partnerId, isTyping }) => {
      const room = getRoomId(userId, String(partnerId));
      socket.to(room).emit('chat:typing', {
        userId,
        name:     socket.user.name,
        isTyping: Boolean(isTyping),
      });
    });

    // ── Disconnect ──────────────────────────
    socket.on('review:new', (data) => {
      io.to(`user_${data.reviewed_id}`).emit('review:new', data);
    });

    socket.on('disconnect', () => {
      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(userId);
          io.emit('user:offline', { userId });
        }
      }
      console.log(`💬 Chat disconnected: User ${userId} — socket ${socket.id}`);
    });
  });
}

// Deterministic room id: smaller_id_larger_id
function getRoomId(a, b) {
  return [a, b].sort((x, y) => Number(x) - Number(y)).join('_');
}

// Expose online users map for REST endpoints
function isUserOnline(userId) {
  return onlineUsers.has(String(userId));
}

module.exports = { chatHandler, isUserOnline };