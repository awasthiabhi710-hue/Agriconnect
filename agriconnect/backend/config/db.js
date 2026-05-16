// ═══════════════════════════════════════════
// config/db.js — MySQL Connection Pool
// ═══════════════════════════════════════════
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host:             process.env.DB_HOST     || 'localhost',
  port:             parseInt(process.env.DB_PORT) || 3306,
  user:             process.env.DB_USER     || 'root',
  password:         process.env.DB_PASS     || '',
  database:         process.env.DB_NAME     || 'agriconnect',
  waitForConnections: true,
  connectionLimit:  15,
  queueLimit:       0,
  timezone:         '+05:30',        // IST
  charset:          'utf8mb4',
});

// Test connection on startup
(async () => {
  try {
    const conn = await pool.getConnection();
    console.log('✅  MySQL connected — database:', process.env.DB_NAME || 'agriconnect');
    conn.release();
  } catch (err) {
    console.error('❌  MySQL connection failed:', err.message);
    process.exit(1);
  }
})();

module.exports = pool;