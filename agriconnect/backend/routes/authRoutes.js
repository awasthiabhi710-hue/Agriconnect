// ═══════════════════════════════════════════
// routes/authRoutes.js
// ═══════════════════════════════════════════
const router   = require('express').Router();
const passport = require('passport');
const jwt      = require('jsonwebtoken');
const { protect } = require('../middleware/auth');
const { handleSingleUpload, getFileUrl } = require('../middleware/upload');
const {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  getPublicProfile,
} = require('../controllers/authController');

/* ─────────────────────────────────────────
   Helper: sign a 7-day JWT
───────────────────────────────────────── */
function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/* ─────────────────────────────────────────
   Helper: strip sensitive fields from user
───────────────────────────────────────── */
function safeUser(user) {
  return {
    id:            user.id,
    name:          user.name,
    email:         user.email,
    role:          user.role,
    mobile:        user.mobile        || null,
    state:         user.state         || null,
    district:      user.district      || null,
    service_type:  user.service_type  || null,
    profile_pic:   user.profile_pic   || null,
    is_verified:   user.is_verified   || 0,
    is_active:     user.is_active     || 1,
    rating:        user.rating        || 5,
    total_reviews: user.total_reviews || 0,
    bio:           user.bio           || null,
  };
}

/* ─────────────────────────────────────────
   Multer middleware for profile pic upload
───────────────────────────────────────── */
const withPic = async (req, res, next) => {
  try {
    await handleSingleUpload(req, res);
    req.fileUrl = getFileUrl(req.file);
    next();
  } catch (err) {
    next(err);
  }
};

/* ═══════════════════════════════════════════
   STANDARD AUTH ROUTES
═══════════════════════════════════════════ */
router.post('/register',         register);
router.post('/login',            login);
router.get('/me',       protect, getMe);
router.put('/update',   protect, withPic, updateProfile);
router.put('/password', protect, changePassword);
router.get('/profile/:userId',   getPublicProfile);

/* ═══════════════════════════════════════════
   GOOGLE OAUTH
   session: false → JWT only, no sessions
═══════════════════════════════════════════ */

// Step 1 — Send user to Google consent screen
router.get(
  '/google',
  passport.authenticate('google', {
    session: false,
    scope:   ['profile', 'email'],
  })
);

// Step 2 — Google calls back here with the user
router.get(
  '/google/callback',
  passport.authenticate('google', {
    session:         false,
    failureRedirect: `${process.env.FRONTEND_URL}?oauth=failed`,
  }),
  (req, res) => {
    try {
      const token = signToken(req.user);
      const user  = encodeURIComponent(JSON.stringify(safeUser(req.user)));
      res.redirect(
        `${process.env.FRONTEND_URL}?oauth=success&token=${token}&user=${user}`
      );
    } catch (err) {
      console.error('Google callback error:', err.message);
      res.redirect(`${process.env.FRONTEND_URL}?oauth=failed`);
    }
  }
);

/* ═══════════════════════════════════════════
   FACEBOOK OAUTH
   session: false → JWT only, no sessions
═══════════════════════════════════════════ */

// Step 1 — Send user to Facebook consent screen
router.get(
  '/facebook',
  passport.authenticate('facebook', {
    session: false,
    scope:   ['email'],
  })
);

// Step 2 — Facebook calls back here with the user
router.get(
  '/facebook/callback',
  passport.authenticate('facebook', {
    session:         false,
    failureRedirect: `${process.env.FRONTEND_URL}?oauth=failed`,
  }),
  (req, res) => {
    try {
      const token = signToken(req.user);
      const user  = encodeURIComponent(JSON.stringify(safeUser(req.user)));
      res.redirect(
        `${process.env.FRONTEND_URL}?oauth=success&token=${token}&user=${user}`
      );
    } catch (err) {
      console.error('Facebook callback error:', err.message);
      res.redirect(`${process.env.FRONTEND_URL}?oauth=failed`);
    }
  }
);

module.exports = router;