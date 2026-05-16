-- ═══════════════════════════════════════════════════════════════
-- AgriConnect — Complete MySQL Schema v2
-- Run: mysql -u root -p < database/schema.sql
-- ═══════════════════════════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS agriconnect
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE agriconnect;

SET FOREIGN_KEY_CHECKS = 0;

-- ─── USERS ──────────────────────────────────────────────────────
DROP TABLE IF EXISTS users;
CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100)  NOT NULL,
  mobile        VARCHAR(15)   UNIQUE,
  email         VARCHAR(120)  NOT NULL UNIQUE,
  password_hash VARCHAR(255)  NOT NULL,
  role          ENUM('farmer','buyer','provider','admin') DEFAULT 'farmer',
  state         VARCHAR(60),
  district      VARCHAR(60),
  service_type  VARCHAR(80),
  profile_pic   VARCHAR(500),
  bio           TEXT,
  rating        DECIMAL(3,1)  DEFAULT 5.0,
  total_reviews INT           DEFAULT 0,
  is_verified   TINYINT(1)    DEFAULT 0,
  is_active     TINYINT(1)    DEFAULT 1,
  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_role  (role),
  INDEX idx_state (state),
  INDEX idx_email (email)
) ENGINE=InnoDB;

-- ─── PRODUCTS ────────────────────────────────────────────────────
DROP TABLE IF EXISTS products;
CREATE TABLE products (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  farmer_id     INT           NOT NULL,
  name          VARCHAR(120)  NOT NULL,
  category      ENUM('Grains & Cereals','Vegetables','Fruits','Pulses & Legumes','Spices & Herbs','Oilseeds','Other') DEFAULT 'Other',
  price         DECIMAL(10,2) NOT NULL,
  quantity      INT           NOT NULL DEFAULT 0,
  unit          ENUM('Quintal','Kg','Ton','Dozen','Box','Litre') DEFAULT 'Quintal',
  state         VARCHAR(60),
  district      VARCHAR(60),
  description   TEXT,
  harvest_date  DATE,
  emoji         VARCHAR(10)   DEFAULT '🌾',
  image_url     VARCHAR(500),
  grade         VARCHAR(20)   DEFAULT 'A',
  is_available  TINYINT(1)    DEFAULT 1,
  on_sale       TINYINT(1)    DEFAULT 0,
  discount_pct  DECIMAL(5,2)  DEFAULT 0,
  sale_ends_at  DATE          NULL,
  views         INT           DEFAULT 0,
  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (farmer_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_category  (category),
  INDEX idx_state     (state),
  INDEX idx_available (is_available),
  INDEX idx_farmer    (farmer_id),
  FULLTEXT idx_search (name, description)
) ENGINE=InnoDB;

-- Reviews table (if not exists already)
CREATE TABLE IF NOT EXISTS reviews (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  reviewer_id  INT NOT NULL,
  reviewed_id  INT NOT NULL,
  product_id   INT NULL,
  service_id   INT NULL,
  rating       TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment      TEXT,
  review_type  ENUM('product','service') DEFAULT 'product',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reviewer_id) REFERENCES users(id),
  FOREIGN KEY (reviewed_id) REFERENCES users(id),
  INDEX idx_reviewed (reviewed_id),
  INDEX idx_product  (product_id),
  INDEX idx_service  (service_id)
) ENGINE=InnoDB;

-- ─── CART ITEMS ──────────────────────────────────────────────────
DROP TABLE IF EXISTS cart_items;
CREATE TABLE cart_items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  buyer_id    INT NOT NULL,
  product_id  INT NOT NULL,
  quantity    INT NOT NULL DEFAULT 1,
  added_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_cart_item (buyer_id, product_id),
  FOREIGN KEY (buyer_id)   REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_buyer (buyer_id)
) ENGINE=InnoDB;

-- ─── ORDERS ──────────────────────────────────────────────────────
DROP TABLE IF EXISTS orders;
CREATE TABLE orders (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  product_id       INT           NOT NULL,
  buyer_id         INT           NOT NULL,
  farmer_id        INT           NOT NULL,
  quantity         INT           NOT NULL,
  unit_price       DECIMAL(10,2) NOT NULL,
  total_amount     DECIMAL(10,2) NOT NULL,
  payment_method   ENUM('upi','card','netbanking','cash','razorpay') DEFAULT 'upi',
  payment_status   ENUM('pending','paid','failed','refunded')        DEFAULT 'pending',
  payment_txn_id   VARCHAR(150),
  status           ENUM('pending','processing','shipped','delivered','cancelled') DEFAULT 'pending',
  delivery_address TEXT,
  tracking_id      VARCHAR(100),
  notes            TEXT,
  delivered_at     TIMESTAMP NULL,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (buyer_id)   REFERENCES users(id),
  FOREIGN KEY (farmer_id)  REFERENCES users(id),
  INDEX idx_buyer   (buyer_id),
  INDEX idx_farmer  (farmer_id),
  INDEX idx_status  (status),
  INDEX idx_created (created_at)
) ENGINE=InnoDB;

-- ─── SERVICES ────────────────────────────────────────────────────
DROP TABLE IF EXISTS services;
CREATE TABLE services (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  provider_id  INT           NOT NULL,
  title        VARCHAR(200)  NOT NULL,
  type         ENUM('Tractor / Machinery','Labor / Manpower','Transportation','Irrigation Expert','Pesticide Spraying','Soil Testing','Other'),
  rate         DECIMAL(10,2) NOT NULL,
  rate_per     ENUM('Hour','Day','Acre','Trip','Fixed','Kg','Quintal') DEFAULT 'Hour',
  location     VARCHAR(200),
  state        VARCHAR(60),
  description  TEXT,
  image_url    VARCHAR(500),
  is_available TINYINT(1)    DEFAULT 1,
  created_at   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (provider_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_type     (type),
  INDEX idx_provider (provider_id),
  INDEX idx_state    (state)
) ENGINE=InnoDB;

-- ─── JOB POSTS ───────────────────────────────────────────────────
DROP TABLE IF EXISTS job_posts;
CREATE TABLE job_posts (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  farmer_id    INT           NOT NULL,
  title        VARCHAR(250)  NOT NULL,
  type         VARCHAR(80),
  budget       DECIMAL(10,2),
  location     VARCHAR(200),
  state        VARCHAR(60),
  required_by  DATE,
  description  TEXT,
  status       ENUM('open','in_progress','closed','cancelled') DEFAULT 'open',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (farmer_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_status (status),
  INDEX idx_type   (type),
  INDEX idx_farmer (farmer_id)
) ENGINE=InnoDB;

-- ─── BIDS ────────────────────────────────────────────────────────
DROP TABLE IF EXISTS bids;
CREATE TABLE bids (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  job_id       INT           NOT NULL,
  provider_id  INT           NOT NULL,
  amount       DECIMAL(10,2) NOT NULL,
  timeline     VARCHAR(100),
  message      TEXT,
  status       ENUM('pending','accepted','rejected','withdrawn') DEFAULT 'pending',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_id)      REFERENCES job_posts(id) ON DELETE CASCADE,
  FOREIGN KEY (provider_id) REFERENCES users(id),
  UNIQUE KEY unique_bid (job_id, provider_id),
  INDEX idx_job      (job_id),
  INDEX idx_provider (provider_id),
  INDEX idx_status   (status)
) ENGINE=InnoDB;


-- ─── SERVICE BOOKINGS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS service_bookings ( 
  id               INT AUTO_INCREMENT PRIMARY KEY,
  service_id       INT           NOT NULL,
  farmer_id        INT           NOT NULL,
  provider_id      INT           NOT NULL,
  units            INT           NOT NULL DEFAULT 1,
  unit_rate        DECIMAL(10,2) NOT NULL,
  total_amount     DECIMAL(10,2) NOT NULL,
  payment_method   ENUM('upi','card','cash','razorpay') DEFAULT 'upi',
  payment_status   ENUM('pending','paid','failed','refunded') DEFAULT 'pending',
  payment_txn_id   VARCHAR(150),
  status           ENUM('pending','confirmed','in_progress','completed','cancelled') DEFAULT 'pending',
  notes            TEXT,
  scheduled_date   DATE,
  completed_at     TIMESTAMP NULL,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (service_id)  REFERENCES services(id) ON DELETE CASCADE,
  FOREIGN KEY (farmer_id)   REFERENCES users(id),
  FOREIGN KEY (provider_id) REFERENCES users(id),
  INDEX idx_provider (provider_id),
  INDEX idx_farmer   (farmer_id),
  INDEX idx_status   (status),
  INDEX idx_created  (created_at)
) ENGINE=InnoDB;

-- ─── MESSAGES ────────────────────────────────────────────────────
DROP TABLE IF EXISTS messages;
CREATE TABLE messages (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  sender_id   INT NOT NULL,
  receiver_id INT NOT NULL,
  content     TEXT NOT NULL,
  msg_type    ENUM('text','image','file') DEFAULT 'text',
  file_url    VARCHAR(500),
  is_read     TINYINT(1) DEFAULT 0,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id)   REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_sender       (sender_id),
  INDEX idx_receiver     (receiver_id),
  INDEX idx_conversation (sender_id, receiver_id),
  INDEX idx_created      (created_at)
) ENGINE=InnoDB;


-- ─── REVIEWS ─────────────────────────────────────────────────────
DROP TABLE IF EXISTS reviews;
CREATE TABLE reviews (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  reviewer_id  INT NOT NULL,
  reviewed_id  INT NOT NULL,
  rating       TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment      TEXT,
  order_id     INT,
  review_type  ENUM('product','service','delivery') DEFAULT 'product',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reviewer_id) REFERENCES users(id),
  FOREIGN KEY (reviewed_id) REFERENCES users(id),
  INDEX idx_reviewed (reviewed_id),
  INDEX idx_rating   (rating)
) ENGINE=InnoDB;

-- ─── NOTIFICATIONS ───────────────────────────────────────────────
DROP TABLE IF EXISTS notifications;
CREATE TABLE notifications (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  title      VARCHAR(200),
  message    TEXT,
  type       ENUM('order','bid','message','review','payment','system') DEFAULT 'system',
  ref_id     INT,
  is_read    TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id),
  INDEX idx_read (is_read)
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;

-- ─── USEFUL VIEWS ────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_products_full AS
SELECT p.*,
       u.name        AS farmer_name,
       u.rating      AS farmer_rating,
       u.total_reviews AS farmer_reviews,
       u.mobile      AS farmer_mobile,
       u.is_verified AS farmer_verified
FROM products p JOIN users u ON p.farmer_id = u.id;

CREATE OR REPLACE VIEW v_orders_full AS
SELECT o.*,
       p.name  AS product_name, p.emoji, p.unit AS product_unit,
       b.name  AS buyer_name,   b.mobile AS buyer_mobile,
       f.name  AS farmer_name,  f.mobile AS farmer_mobile
FROM orders o
JOIN products p ON o.product_id = p.id
JOIN users b    ON o.buyer_id   = b.id
JOIN users f    ON o.farmer_id  = f.id;

CREATE OR REPLACE VIEW v_platform_stats AS
SELECT
  (SELECT COUNT(*) FROM users)                                         AS total_users,
  (SELECT COUNT(*) FROM users WHERE role='farmer')                     AS farmers,
  (SELECT COUNT(*) FROM users WHERE role='buyer')                      AS buyers,
  (SELECT COUNT(*) FROM users WHERE role='provider')                   AS providers,
  (SELECT COUNT(*) FROM products WHERE is_available=1)                 AS active_listings,
  (SELECT COUNT(*) FROM orders)                                        AS total_orders,
  (SELECT COALESCE(SUM(total_amount),0) FROM orders WHERE status='delivered') AS total_gmv,
  (SELECT COUNT(*) FROM services WHERE is_available=1)                 AS active_services,
  (SELECT COUNT(*) FROM job_posts WHERE status='open')                 AS open_jobs,
  (SELECT COUNT(*) FROM messages)                                      AS total_messages;

SELECT 'Schema created successfully!' AS status;