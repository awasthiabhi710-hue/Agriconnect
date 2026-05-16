-- ═══════════════════════════════════════════════════════════════
-- AgriConnect — Complete MySQL Database Schema
-- Run this in MySQL to set up the database
-- ═══════════════════════════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS agriconnect CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE agriconnect;

-- ─── USERS TABLE ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  mobile        VARCHAR(15) UNIQUE,
  email         VARCHAR(120) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('farmer','buyer','provider','admin') DEFAULT 'farmer',
  state         VARCHAR(60),
  district      VARCHAR(60),
  service_type  VARCHAR(80),
  profile_pic   VARCHAR(255),
  bio           TEXT,
  rating        DECIMAL(2,1) DEFAULT 5.0,
  total_reviews INT DEFAULT 0,
  is_verified   BOOLEAN DEFAULT FALSE,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_role (role),
  INDEX idx_state (state)
) ENGINE=InnoDB;

-- ─── PRODUCTS TABLE ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  farmer_id     INT NOT NULL,
  name          VARCHAR(120) NOT NULL,
  category      ENUM('Grains & Cereals','Vegetables','Fruits','Pulses & Legumes','Spices & Herbs','Oilseeds','Other') DEFAULT 'Other',
  price         DECIMAL(10,2) NOT NULL,
  quantity      INT NOT NULL,
  unit          ENUM('Quintal','Kg','Ton','Dozen','Box','Litre') DEFAULT 'Quintal',
  state         VARCHAR(60),
  district      VARCHAR(60),
  description   TEXT,
  harvest_date  DATE,
  emoji         VARCHAR(10) DEFAULT '🌾',
  images        JSON,
  grade         VARCHAR(20) DEFAULT 'A',
  is_available  BOOLEAN DEFAULT TRUE,
  views         INT DEFAULT 0,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (farmer_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_category (category),
  INDEX idx_state (state),
  INDEX idx_available (is_available),
  INDEX idx_farmer (farmer_id),
  FULLTEXT idx_search (name, description)
) ENGINE=InnoDB;

-- ─── ORDERS TABLE ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  product_id       INT NOT NULL,
  buyer_id         INT NOT NULL,
  farmer_id        INT NOT NULL,
  quantity         INT NOT NULL,
  unit_price       DECIMAL(10,2) NOT NULL,
  total_amount     DECIMAL(10,2) NOT NULL,
  payment_method   ENUM('upi','card','netbanking','cash') DEFAULT 'upi',
  payment_status   ENUM('pending','paid','failed','refunded') DEFAULT 'pending',
  payment_txn_id   VARCHAR(100),
  status           ENUM('pending','processing','shipped','delivered','cancelled') DEFAULT 'pending',
  delivery_address TEXT,
  tracking_id      VARCHAR(100),
  notes            TEXT,
  delivered_at     TIMESTAMP NULL,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (buyer_id) REFERENCES users(id),
  FOREIGN KEY (farmer_id) REFERENCES users(id),
  INDEX idx_buyer (buyer_id),
  INDEX idx_farmer (farmer_id),
  INDEX idx_status (status),
  INDEX idx_created (created_at)
) ENGINE=InnoDB;

-- ─── SERVICES TABLE ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS services (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  provider_id  INT NOT NULL,
  title        VARCHAR(200) NOT NULL,
  type         ENUM('Tractor / Machinery','Labor / Manpower','Transportation','Irrigation Expert','Pesticide Spraying','Soil Testing','Other'),
  rate         DECIMAL(10,2) NOT NULL,
  rate_per     ENUM('Hour','Day','Acre','Trip','Fixed','Kg','Quintal') DEFAULT 'Hour',
  location     VARCHAR(200),
  state        VARCHAR(60),
  description  TEXT,
  equipment    JSON,
  is_available BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (provider_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_type (type),
  INDEX idx_provider (provider_id),
  INDEX idx_state (state)
) ENGINE=InnoDB;

-- ─── JOB POSTS TABLE ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_posts (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  farmer_id    INT NOT NULL,
  title        VARCHAR(250) NOT NULL,
  type         VARCHAR(80),
  budget       DECIMAL(10,2),
  budget_max   DECIMAL(10,2),
  location     VARCHAR(200),
  state        VARCHAR(60),
  required_by  DATE,
  description  TEXT,
  attachments  JSON,
  status       ENUM('open','in_progress','closed','cancelled') DEFAULT 'open',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (farmer_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_status (status),
  INDEX idx_type (type),
  INDEX idx_farmer (farmer_id)
) ENGINE=InnoDB;

-- ─── BIDS TABLE ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bids (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  job_id       INT NOT NULL,
  provider_id  INT NOT NULL,
  amount       DECIMAL(10,2) NOT NULL,
  timeline     VARCHAR(100),
  message      TEXT,
  status       ENUM('pending','accepted','rejected','withdrawn') DEFAULT 'pending',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_id) REFERENCES job_posts(id) ON DELETE CASCADE,
  FOREIGN KEY (provider_id) REFERENCES users(id),
  UNIQUE KEY unique_bid (job_id, provider_id),
  INDEX idx_job (job_id),
  INDEX idx_provider (provider_id),
  INDEX idx_status (status)
) ENGINE=InnoDB;

-- ─── SERVICE BOOKINGS TABLE ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  service_id     INT NOT NULL,
  farmer_id      INT NOT NULL,
  provider_id    INT NOT NULL,
  booking_date   DATE NOT NULL,
  hours_or_units DECIMAL(6,2),
  total_amount   DECIMAL(10,2),
  status         ENUM('pending','confirmed','in_progress','completed','cancelled') DEFAULT 'pending',
  notes          TEXT,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (service_id) REFERENCES services(id),
  FOREIGN KEY (farmer_id) REFERENCES users(id),
  FOREIGN KEY (provider_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- ─── MESSAGES TABLE ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  sender_id   INT NOT NULL,
  receiver_id INT NOT NULL,
  content     TEXT NOT NULL,
  msg_type    ENUM('text','image','file','offer') DEFAULT 'text',
  file_url    VARCHAR(255),
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_sender (sender_id),
  INDEX idx_receiver (receiver_id),
  INDEX idx_conversation (sender_id, receiver_id),
  INDEX idx_created (created_at)
) ENGINE=InnoDB;

-- ─── REVIEWS TABLE ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  reviewer_id  INT NOT NULL,
  reviewed_id  INT NOT NULL,
  rating       TINYINT CHECK(rating BETWEEN 1 AND 5),
  comment      TEXT,
  order_id     INT,
  review_type  ENUM('product','service','delivery') DEFAULT 'product',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reviewer_id) REFERENCES users(id),
  FOREIGN KEY (reviewed_id) REFERENCES users(id),
  INDEX idx_reviewed (reviewed_id),
  INDEX idx_rating (rating)
) ENGINE=InnoDB;

-- ─── NOTIFICATIONS TABLE ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  title      VARCHAR(200),
  message    TEXT,
  type       ENUM('order','bid','message','review','system') DEFAULT 'system',
  ref_id     INT,
  is_read    BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id),
  INDEX idx_read (is_read)
) ENGINE=InnoDB;

-- ─── SAMPLE SEED DATA ──────────────────────────────────────────
INSERT IGNORE INTO users (id, name, mobile, email, password_hash, role, state, rating, total_reviews, is_verified) VALUES
(1, 'Ramesh Singh', '9876543210', 'ramesh@demo.com', '$2a$12$demo_hash_farmer1', 'farmer', 'Punjab', 4.8, 34, 1),
(2, 'Priya Sharma', '9876543211', 'priya@demo.com', '$2a$12$demo_hash_farmer2', 'farmer', 'Haryana', 4.9, 28, 1),
(3, 'Suresh Mehta', '9876543212', 'suresh@demo.com', '$2a$12$demo_hash_buyer1', 'buyer', 'Delhi', 4.7, 12, 1),
(4, 'Anil Verma', '9876543213', 'anil@demo.com', '$2a$12$demo_hash_provider1', 'provider', 'Haryana', 4.6, 45, 1),
(5, 'Admin User', '9000000000', 'admin@demo.com', '$2a$12$demo_hash_admin1', 'admin', 'Delhi', 5.0, 0, 1);

-- NOTE: Replace password_hash values with proper bcrypt hashes before production use
-- Use: bcrypt.hash('demo123', 12) for each user

-- ─── USEFUL VIEWS ───────────────────────────────────────────────

CREATE OR REPLACE VIEW v_products_with_farmer AS
SELECT p.*, u.name AS farmer_name, u.rating AS farmer_rating,
       u.mobile AS farmer_mobile, u.is_verified AS farmer_verified
FROM products p JOIN users u ON p.farmer_id = u.id;

CREATE OR REPLACE VIEW v_orders_full AS
SELECT o.*, p.name AS product_name, p.emoji,
       b.name AS buyer_name, b.mobile AS buyer_mobile,
       f.name AS farmer_name, f.mobile AS farmer_mobile
FROM orders o
JOIN products p ON o.product_id = p.id
JOIN users b ON o.buyer_id = b.id
JOIN users f ON o.farmer_id = f.id;

CREATE OR REPLACE VIEW v_platform_stats AS
SELECT
  (SELECT COUNT(*) FROM users) AS total_users,
  (SELECT COUNT(*) FROM users WHERE role='farmer') AS total_farmers,
  (SELECT COUNT(*) FROM users WHERE role='buyer') AS total_buyers,
  (SELECT COUNT(*) FROM users WHERE role='provider') AS total_providers,
  (SELECT COUNT(*) FROM products WHERE is_available=1) AS active_listings,
  (SELECT COUNT(*) FROM orders) AS total_orders,
  (SELECT COALESCE(SUM(total_amount),0) FROM orders WHERE status='delivered') AS total_gmv,
  (SELECT COUNT(*) FROM services WHERE is_available=1) AS active_services,
  (SELECT COUNT(*) FROM job_posts WHERE status='open') AS open_jobs;
