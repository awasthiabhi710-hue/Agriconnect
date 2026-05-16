// ═══════════════════════════════════════════
// middleware/auth.js — JWT Authentication
// ═══════════════════════════════════════════
const jwt = require('jsonwebtoken');

/**
 * Protect routes — requires valid JWT in Authorization header
 * Attaches decoded user payload to req.user
 */
const protect = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'agriconnect_secret');
    req.user = decoded;   // { id, name, email, role }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token expired. Please login again.' });
    }
    return res.status(401).json({ success: false, error: 'Invalid token.' });
  }
};

/**
 * Optional auth — attaches user if token present, but does NOT block request
 */
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      req.user = jwt.verify(token, process.env.JWT_SECRET || 'agriconnect_secret');
    }
  } catch {
    // Token invalid — proceed as guest
  }
  next();
};

module.exports = { protect, optionalAuth };