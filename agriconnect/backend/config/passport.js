// ═══════════════════════════════════════════
// config/passport.js
// session: false throughout — we use JWT
// ═══════════════════════════════════════════
const passport       = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const pool           = require('./db');

// ── Google OAuth Strategy ────────────────────────────────────
passport.use(new GoogleStrategy(
  {
    clientID:          process.env.GOOGLE_CLIENT_ID,
    clientSecret:      process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:       `${process.env.OAUTH_CALLBACK_BASE}/api/auth/google/callback`,
    passReqToCallback: false,
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value;
      const name  = profile.displayName || 'Google User';
      const pic   = profile.photos?.[0]?.value || null;

      if (!email) {
        return done(new Error('No email returned from Google'), null);
      }

      // Check if user already exists
      const [[existing]] = await pool.query(
        'SELECT * FROM users WHERE email = ?',
        [email]
      );

      if (existing) {
        // Update profile pic if they don't have one yet
        if (!existing.profile_pic && pic) {
          await pool.query(
            'UPDATE users SET profile_pic = ? WHERE id = ?',
            [pic, existing.id]
          );
          existing.profile_pic = pic;
        }
        return done(null, existing);
      }

      // New user — create account
      const [result] = await pool.query(
        `INSERT INTO users
           (name, email, password_hash, role, is_verified, is_active, profile_pic)
         VALUES (?, ?, 'google_oauth', 'farmer', 1, 1, ?)`,
        [name, email, pic]
      );

      const [[newUser]] = await pool.query(
        'SELECT * FROM users WHERE id = ?',
        [result.insertId]
      );

      return done(null, newUser);
    } catch (err) {
      console.error('Google OAuth strategy error:', err.message);
      return done(err, null);
    }
  }
));

// ── Facebook OAuth Strategy (optional) ──────────────────────
// Only register if credentials are present in .env
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
  const FacebookStrategy = require('passport-facebook').Strategy;

  passport.use(new FacebookStrategy(
    {
      clientID:          process.env.FACEBOOK_APP_ID,
      clientSecret:      process.env.FACEBOOK_APP_SECRET,
      callbackURL:       `${process.env.OAUTH_CALLBACK_BASE}/api/auth/facebook/callback`,
      profileFields:     ['id', 'displayName', 'emails', 'photos'],
      passReqToCallback: false,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value || `fb_${profile.id}@facebook.com`;
        const name  = profile.displayName || 'Facebook User';
        const pic   = profile.photos?.[0]?.value || null;

        const [[existing]] = await pool.query(
          'SELECT * FROM users WHERE email = ?',
          [email]
        );

        if (existing) {
          if (!existing.profile_pic && pic) {
            await pool.query(
              'UPDATE users SET profile_pic = ? WHERE id = ?',
              [pic, existing.id]
            );
            existing.profile_pic = pic;
          }
          return done(null, existing);
        }

        const [result] = await pool.query(
          `INSERT INTO users
             (name, email, password_hash, role, is_verified, is_active, profile_pic)
           VALUES (?, ?, 'facebook_oauth', 'farmer', 1, 1, ?)`,
          [name, email, pic]
        );

        const [[newUser]] = await pool.query(
          'SELECT * FROM users WHERE id = ?',
          [result.insertId]
        );

        return done(null, newUser);
      } catch (err) {
        console.error('Facebook OAuth strategy error:', err.message);
        return done(err, null);
      }
    }
  ));
}

// NOTE: No serializeUser / deserializeUser needed
// because we use session: false (JWT-based auth)

module.exports = passport;