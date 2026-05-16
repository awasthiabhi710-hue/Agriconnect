// ═══════════════════════════════════════════
// config/socket.js — Socket.io Setup
// ═══════════════════════════════════════════
const { Server } = require('socket.io');
require('dotenv').config();

let io;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.SOCKET_CORS_ORIGIN || 'http://localhost:5500',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
  });

  // Map userId → socketId for direct messaging
  const onlineUsers = new Map();

  io.on('connection', (socket) => {
    console.log(`🔌  Socket connected: ${socket.id}`);

    // Register user as online
    socket.on('user:online', (userId) => {
      onlineUsers.set(String(userId), socket.id);
      socket.userId = String(userId);
      // Broadcast online status
      io.emit('user:status', { userId, online: true });
    });

    // Join a private room (conversation between two users)
    socket.on('chat:join', ({ userId, partnerId }) => {
      const room = getRoomId(userId, partnerId);
      socket.join(room);
    });

    // Send private message
    socket.on('chat:message', ({ senderId, receiverId, content, tempId }) => {
      const room = getRoomId(senderId, receiverId);
      const msgData = {
        tempId,
        senderId,
        receiverId,
        content,
        created_at: new Date().toISOString(),
        is_read: false,
      };
      // Emit to both users in the room
      io.to(room).emit('chat:message', msgData);
    });

    // Mark messages as read
    socket.on('chat:read', ({ userId, partnerId }) => {
      const room = getRoomId(userId, partnerId);
      io.to(room).emit('chat:read', { userId, partnerId });
    });

    // Typing indicator
    socket.on('chat:typing', ({ senderId, receiverId, isTyping }) => {
      const room = getRoomId(senderId, receiverId);
      socket.to(room).emit('chat:typing', { senderId, isTyping });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      if (socket.userId) {
        onlineUsers.delete(socket.userId);
        io.emit('user:status', { userId: socket.userId, online: false });
      }
      console.log(`🔌  Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

// Consistent room ID regardless of who initiates
function getRoomId(a, b) {
  return [String(a), String(b)].sort().join('_');
}

function getIo() {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}

module.exports = { initSocket, getIo };