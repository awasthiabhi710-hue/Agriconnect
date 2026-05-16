// ═══════════════════════════════════════════
// server.js — AgriConnect Main Entry Point
// ═══════════════════════════════════════════
require('dotenv').config();

const express  = require('express');
const http     = require('http');
const cors     = require('cors');
const path     = require('path');
const passport = require('passport');

// ── Load passport strategies FIRST (before anything uses them)
require('./config/passport');

require('./config/db');
const { chatHandler } = require('./socket/chatHandler');
const { errorHandler } = require('./middleware/errorHandler');

const authRoutes      = require('./routes/authRoutes');
const productRoutes   = require('./routes/productRoutes');
const orderRoutes     = require('./routes/orderRoutes');
const cartRoutes      = require('./routes/cartRoutes');
const serviceRoutes   = require('./routes/serviceRoutes');
const jobRoutes       = require('./routes/jobRoutes');
const chatRoutes      = require('./routes/chatRoutes');
const paymentRoutes   = require('./routes/paymentRoutes');
const userRoutes      = require('./routes/userRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const reviewRoutes    = require('./routes/reviewRoutes');
const bookingRoutes   = require('./routes/bookingRoutes');

// ── Admin routes: try both naming conventions ─────────────────
let adminRoutes;
try {
  adminRoutes = require('./routes/adminRoutes');
  console.log('✅  Admin routes loaded: adminRoutes.js');
} catch (_) {
  try {
    adminRoutes = require('./routes/admin');
    console.log('✅  Admin routes loaded: admin.js');
  } catch (err) {
    console.error('⚠️  Could not load admin routes:', err.message);
    const placeholder = express.Router();
    placeholder.use((_req, res) => {
      res.status(503).json({
        success: false,
        error: 'Admin routes not available — check route file name.',
      });
    });
    adminRoutes = placeholder;
  }
}

// ═══════════════════════════════════════════
// APP + SOCKET.IO SETUP
// ═══════════════════════════════════════════
const app    = express();
const server = http.createServer(app);

const { Server } = require('socket.io');
const io = new Server(server, {
  cors: {
    origin:      process.env.SOCKET_CORS_ORIGIN || '*',
    methods:     ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
});
chatHandler(io);

// ═══════════════════════════════════════════
// MIDDLEWARE — ORDER MATTERS
// ═══════════════════════════════════════════
app.use(cors({
  origin: [
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    process.env.FRONTEND_URL,
  ].filter(Boolean),
  credentials: true,
}));

// Razorpay webhook needs raw body — MUST be before express.json()
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Passport — session: false (we use JWT, no sessions needed)
app.use(passport.initialize());

// ── Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Serve frontend (ALWAYS — dev and prod)
// This lets http://localhost:3000 serve index.html directly
// OAuth redirects back here after Google login
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));
console.log(`📁  Serving frontend from: ${frontendPath}`);

// ── Request logger (dev only)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`[${new Date().toLocaleTimeString('en-IN')}] ${req.method} ${req.originalUrl}`);
    next();
  });
}

// ═══════════════════════════════════════════
// API ROUTES
// ═══════════════════════════════════════════
app.use('/api/auth',      authRoutes);
app.use('/api/products',  productRoutes);
app.use('/api/orders',    orderRoutes);
app.use('/api/cart',      cartRoutes);
app.use('/api/services',  serviceRoutes);
app.use('/api/jobs',      jobRoutes);
app.use('/api/chat',      chatRoutes);
app.use('/api/payments',  paymentRoutes);
app.use('/api/users',     userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/bookings',  bookingRoutes);
app.use('/api/reviews',   reviewRoutes);
app.use('/api/admin',     adminRoutes);

// ═══════════════════════════════════════════
// KISAN AI CHAT — Groq (free, fast)
// ═══════════════════════════════════════════
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { messages, system } = req.body;

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({
        error: { message: 'GROQ_API_KEY not set in .env' },
      });
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model:       'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: system || 'You are a helpful assistant.' },
          ...(messages || []),
        ],
        temperature: 0.7,
        max_tokens:  1000,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error || { message: 'Groq API error' },
      });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// ═══════════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════════
app.get('/api/health', (_req, res) => {
  res.json({
    status:   'ok',
    app:      'AgriConnect API',
    version:  '1.0.0',
    time:     new Date().toISOString(),
    env:      process.env.NODE_ENV || 'development',
    ai:       process.env.GROQ_API_KEY    ? 'Kisan AI ready ✅'       : 'GROQ_API_KEY missing ⚠️',
    google:   process.env.GOOGLE_CLIENT_ID ? 'Google OAuth ready ✅'   : 'GOOGLE_CLIENT_ID missing ⚠️',
    facebook: process.env.FACEBOOK_APP_ID  ? 'Facebook OAuth ready ✅' : 'FACEBOOK_APP_ID missing ⚠️',
  });
});

// ═══════════════════════════════════════════
// CATCH-ALL — serve index.html for any non-API route
// This handles OAuth redirect: GET /?oauth=success&token=...
// ═══════════════════════════════════════════
app.get('*', (req, res) => {
  // Don't catch API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      error:   `Route not found: ${req.originalUrl}`,
    });
  }
  // Serve index.html for everything else (/, /?oauth=success, etc.)
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.use(errorHandler);

// ═══════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════
const PORT = parseInt(process.env.PORT) || 3000;

server.listen(PORT, () => {
  console.log('');
  console.log('🌾  ════════════════════════════════════════════════');
  console.log(`🌾   AgriConnect API  —  v1.0.0`);
  console.log(`🚀   Server      : http://localhost:${PORT}`);
  console.log(`💬   Socket      : ws://localhost:${PORT}`);
  console.log(`🤖   Kisan AI    : http://localhost:${PORT}/api/ai/chat`);
  console.log(`🔐   Google OAuth: http://localhost:${PORT}/api/auth/google`);
  console.log(`🌍   Env         : ${process.env.NODE_ENV || 'development'}`);
  console.log('🌾  ════════════════════════════════════════════════');
  console.log('');
  console.log('📋  API Endpoints:');
  console.log('    POST  /api/auth/register');
  console.log('    POST  /api/auth/login');
  console.log('    GET   /api/auth/google          ← Google OAuth');
  console.log('    GET   /api/auth/google/callback ← Google callback');
  console.log('    GET   /api/auth/facebook        ← Facebook OAuth');
  console.log('    GET   /api/auth/me');
  console.log('    GET   /api/products');
  console.log('    POST  /api/products');
  console.log('    POST  /api/orders');
  console.log('    GET   /api/orders');
  console.log('    GET   /api/cart');
  console.log('    POST  /api/cart/checkout');
  console.log('    GET   /api/services');
  console.log('    GET   /api/jobs');
  console.log('    POST  /api/jobs');
  console.log('    GET   /api/chat/conversations');
  console.log('    POST  /api/payments/create-order');
  console.log('    GET   /api/dashboard');
  console.log('    GET   /api/reviews/user/:id');
  console.log('    POST  /api/reviews');
  console.log('    GET   /api/admin/stats');
  console.log('    POST  /api/ai/chat              ← Kisan AI 🤖');
  console.log('    GET   /api/health');
  console.log('');
  console.log(`🌐   Open app at: http://localhost:${PORT}`);
  console.log('');
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => process.exit(0));
});

module.exports = { app, server };