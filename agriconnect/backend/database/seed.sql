-- ═══════════════════════════════════════════════════════════════
-- AgriConnect — Seed Data
-- Run AFTER schema.sql:  mysql -u root -p agriconnect < database/seed.sql
-- Passwords are bcrypt hashes of 'demo123' (for demo users)
-- ═══════════════════════════════════════════════════════════════

USE agriconnect;

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE reviews;
TRUNCATE TABLE messages;
TRUNCATE TABLE bids;
TRUNCATE TABLE job_posts;
TRUNCATE TABLE cart_items;
TRUNCATE TABLE orders;
TRUNCATE TABLE services;
TRUNCATE TABLE products;
TRUNCATE TABLE users;
SET FOREIGN_KEY_CHECKS = 1;

-- ─── USERS ──────────────────────────────────────────────────────
-- password = 'demo123'  →  bcrypt hash (cost 12)
INSERT INTO users (id, name, mobile, email, password_hash, role, state, district, service_type, bio, rating, total_reviews, is_verified) VALUES
(1,  'Ramesh Singh',    '9876543210', 'ramesh@demo.com',  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGniB5fq8PKlQkN0Z2W2i5a3a7m', 'farmer',   'Punjab',       'Amritsar',   NULL,                   'Wheat and rice farmer with 15 years of experience. Growing premium quality Sharbati wheat on 50-acre farm.', 4.8, 34, 1),
(2,  'Priya Sharma',    '9876543211', 'priya@demo.com',   '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGniB5fq8PKlQkN0Z2W2i5a3a7m', 'farmer',   'Haryana',      'Karnal',     NULL,                   'Organic farmer specializing in Basmati rice and seasonal vegetables. APEDA certified organic producer.', 4.9, 28, 1),
(3,  'Suresh Mehta',    '9876543212', 'suresh@demo.com',  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGniB5fq8PKlQkN0Z2W2i5a3a7m', 'buyer',    'Delhi',        'New Delhi',  NULL,                   'Bulk buyer for grocery chains across Delhi NCR. Looking for consistent quality farm produce suppliers.', 4.7, 12, 1),
(4,  'Anil Verma',      '9876543213', 'anil@demo.com',    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGniB5fq8PKlQkN0Z2W2i5a3a7m', 'provider', 'Haryana',      'Ambala',     'Tractor / Machinery',  'Experienced tractor operator with Mahindra 575 DI and combine harvester. Serving Punjab & Haryana 10+ years.', 4.6, 45, 1),
(5,  'Ravi Transport',  '9876543214', 'ravi@demo.com',    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGniB5fq8PKlQkN0Z2W2i5a3a7m', 'provider', 'Punjab',       'Ludhiana',   'Transportation',       'Fleet of 5 transport vehicles (10–20 ton) for agricultural produce. Punjab, Haryana, Delhi routes covered.', 4.5, 22, 0),
(6,  'Kiran Labor',     '9876543215', 'kiran@demo.com',   '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGniB5fq8PKlQkN0Z2W2i5a3a7m', 'provider', 'Uttar Pradesh','Bareilly',   'Labor / Manpower',     'Managing team of 50+ skilled agricultural laborers. Specializing in harvesting and planting operations.', 4.3, 18, 1),
(7,  'Admin User',      '9000000000', 'admin@demo.com',   '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGniB5fq8PKlQkN0Z2W2i5a3a7m', 'admin',    'Delhi',        'New Delhi',  NULL,                   'Platform administrator.', 5.0, 0, 1),
(8,  'Gurpreet Kaur',   '9876501234', 'gurpreet@demo.com','$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGniB5fq8PKlQkN0Z2W2i5a3a7m', 'farmer',   'Punjab',       'Jalandhar',  NULL,                   'Vegetable and fruit farmer. Specializing in seasonal tomatoes, cucumbers and mangoes. 20 acres, natural farming.', 4.7, 19, 1),
(9,  'Mohammed Farooq', '9876509876', 'farooq@demo.com',  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGniB5fq8PKlQkN0Z2W2i5a3a7m', 'buyer',    'Maharashtra',  'Mumbai',     NULL,                   'Wholesale buyer for restaurant chain and export business. Require consistent quality in bulk quantities.', 4.5, 8,  1),
(10, 'Deepak Irrigation','9876507654','deepak@demo.com',  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGniB5fq8PKlQkN0Z2W2i5a3a7m', 'provider', 'Rajasthan',    'Jaipur',     'Irrigation Expert',    'Drip and sprinkler irrigation specialist. 12 years experience. Covers Rajasthan and MP. PMKSY certified.', 4.8, 31, 1);

-- ─── PRODUCTS ────────────────────────────────────────────────────
INSERT INTO products (id, farmer_id, name, category, price, quantity, unit, state, district, description, harvest_date, emoji, grade, is_available) VALUES
(1,  1, 'Premium Wheat (Sharbati)',  'Grains & Cereals', 2240.00, 500,  'Quintal', 'Punjab',       'Amritsar', 'Grade A Sharbati wheat, moisture < 12%, clean & processed. Suitable for flour milling and export. Procured from our 50-acre farm. Minimum order: 10 quintals.',                   '2025-04-01', '🌾', 'A', 1),
(2,  2, 'Basmati Rice 1121',         'Grains & Cereals', 4800.00, 200,  'Quintal', 'Haryana',      'Karnal',   'Extra long grain Basmati 1121. Export quality. Grain length 8.5mm+. Aged 1 year for better aroma. APEDA certified. Free from pesticide residue. Fragrant and fresh.',        '2025-03-20', '🍚', 'A', 1),
(3,  8, 'Fresh Tomatoes (Hybrid)',    'Vegetables',       18.00,  3000, 'Kg',      'Punjab',       'Jalandhar','Fresh ripe hybrid tomatoes. Brix value 4.5+. Harvested twice a week. Excellent for processing & retail. Free from pesticide residue. 20kg boxes available.',              '2025-04-15', '🍅', 'A', 1),
(4,  2, 'Yellow Mustard Seeds',       'Oilseeds',         5200.00,150,  'Quintal', 'Haryana',      'Rohtak',   'High oil content (42%) yellow mustard. Clean and graded. Ready for crushing. Moisture < 8%. Procured from prime mustard growing belt in Rohtak district.',                 '2025-03-15', '🌻', 'A', 1),
(5,  1, 'Arhar Dal (Toor)',           'Pulses & Legumes', 7800.00, 80,  'Quintal', 'Punjab',       'Amritsar', 'Fresh Arhar dal. Bold variety. Protein content 22%. Cleaned and free from admixture. Best for wholesale buyers and dal mills. Minimum order: 5 quintals.',                  '2025-04-02', '🫘', 'A', 1),
(6,  2, 'Green Chillies (Export)',    'Spices & Herbs',   32.00,  800,  'Kg',      'Haryana',      'Karnal',   'Fresh hot green chillies. Capsaicin rich. Ideal for pickle & spice industry. Harvested fresh every 2-3 days. Length 8-12cm. Export grade quality.',                       '2025-04-14', '🌶️','A', 1),
(7,  8, 'Alphonso Mangoes (GI Tag)',  'Fruits',           420.00, 500,  'Dozen',   'Punjab',       'Jalandhar','Premium GI-tagged Alphonso mangoes. 250–300g each. Natural ripening only. No carbide used. Packed in ventilated boxes. Minimum order: 10 dozen.',                         '2025-05-01', '🥭', 'A', 1),
(8,  2, 'Organic Onions (NPOP)',      'Vegetables',       22.00,  5000, 'Kg',      'Haryana',      'Rohtak',   'NPOP certified organic onions. Large size 60mm+. No pesticides. Perfect for export. Stored in ventilated facility. Available year-round.',                                 '2025-04-10', '🧅', 'A', 1),
(9,  1, 'Chana Dal (Bengal Gram)',    'Pulses & Legumes', 6200.00, 60,  'Quintal', 'Punjab',       'Amritsar', 'Premium chana dal. Uniform size. Clean and graded. Protein 17.5%. Low moisture. Suitable for retail packaging and food processing industry.',                              '2025-03-28', '🫛', 'A', 1),
(10, 8, 'Green Peas (Fresh)',         'Vegetables',       28.00,  2000, 'Kg',      'Punjab',       'Jalandhar','Fresh sweet green peas. Sugar-to-starch conversion optimized for sweetness. Perfect for restaurants. Harvested early morning. 24hr fresh delivery possible.',             '2025-04-16', '🟢', 'A', 1);

-- ─── SERVICES ────────────────────────────────────────────────────
INSERT INTO services (id, provider_id, title, type, rate, rate_per, location, state, description, is_available) VALUES
(1, 4, 'Mahindra 575 DI Tractor + Rotavator',     'Tractor / Machinery',  850.00, 'Hour',  'Ambala, Haryana',    'Haryana',      '50HP tractor with rotavator and disc harrow attachments. Available for plowing, tilling, sowing. Fuel extra. Minimum booking 4 hours.', 1),
(2, 5, 'Agricultural Transport — 10 Wheeler',      'Transportation',       12.00,  'Km',    'Ludhiana, Punjab',   'Punjab',       'Mandi to warehouse grain transport. Tarpaulin covered. 15-ton capacity. Punjab, Haryana, Delhi routes. Loading & unloading extra.', 1),
(3, 6, 'Skilled Labor Team (10 workers)',           'Labor / Manpower',    4500.00,'Day',   'Bareilly, UP',       'Uttar Pradesh','Experienced harvesting and planting labor team. Paddy/wheat specialists. Local transport included. PAN India deployment possible.', 1),
(4, 4, 'Combine Harvester — Wheat/Paddy',          'Tractor / Machinery', 2200.00,'Acre',  'Karnal, Haryana',    'Haryana',      'Modern combine harvester. Punjab & Haryana coverage. Fast turnaround, minimal grain loss. GPS guided precision harvesting.', 1),
(5, 10,'Drip Irrigation Setup (up to 5 acres)',    'Irrigation Expert',   8500.00,'Fixed', 'Jaipur, Rajasthan',  'Rajasthan',    'Complete drip irrigation design & installation. Covers up to 5 acres per project. 1-year maintenance included. PMKSY subsidy guidance.', 1),
(6, 4, 'Drone Pesticide Spraying (DGCA Certified)','Pesticide Spraying',   400.00,'Acre',  'Patiala, Punjab',    'Punjab',       'Agricultural drone spraying. Covers 30 acres/day. GPS guided. DGCA certified operator. Chemicals not included. Next-day booking available.', 1),
(7, 5, 'Cold Storage Transport (Refrigerated)',    'Transportation',       18.00, 'Km',    'Chandigarh, Punjab', 'Punjab',       'Refrigerated truck for perishable produce. Maintains 2–8°C. Ideal for fruits, vegetables, dairy. 8-ton capacity. Punjab-Delhi-Haryana.', 1),
(8, 10,'Soil Testing & Fertilizer Advisory',       'Soil Testing',        1200.00,'Fixed', 'Alwar, Rajasthan',   'Rajasthan',    'Complete soil health card: pH, NPK, micronutrients. 48hr report. Fertilizer and crop recommendation included. Government accredited lab.', 1);

-- ─── JOB POSTS ───────────────────────────────────────────────────
INSERT INTO job_posts (id, farmer_id, title, type, budget, location, state, required_by, description, status) VALUES
(1, 1, 'Need tractor for 8-acre wheat field plowing — urgent', 'Tractor / Machinery', 6500.00,  'Amritsar, Punjab',   'Punjab',       '2025-04-20', 'Need tractor with rotavator for 8-acre field. Must complete in 2 days. Starting April 18. Fuel will be provided.', 'open'),
(2, 2, 'Transport: Panipat to Delhi Mandi — 10 Tons Basmati', 'Transportation',       8000.00,  'Panipat, Haryana',   'Haryana',      '2025-04-18', 'Need covered truck transport for 10 tons basmati rice to Azadpur Mandi, Delhi. Loading at our farm. Same day delivery preferred.', 'open'),
(3, 1, '20 labor workers needed for tomato harvesting — 3 days','Labor / Manpower',   12000.00, 'Ludhiana, Punjab',   'Punjab',       '2025-04-22', '20 workers needed for 3 consecutive days. Tomato harvesting and packing. Accommodation and meals provided.', 'open'),
(4, 2, 'Drip irrigation for 3-acre onion field',               'Irrigation Expert',   25000.00, 'Rohtak, Haryana',    'Haryana',      '2025-05-01', 'Need complete drip irrigation system for 3 acres. Quote required with site visit. PMKSY subsidy application assistance preferred.', 'open'),
(5, 8, 'Sprinkler system for 2-acre vegetable farm',           'Irrigation Expert',   15000.00, 'Jalandhar, Punjab',  'Punjab',       '2025-04-30', 'Need portable sprinkler system installed. 2 acres. Vegetables mainly. Site visit welcome. Budget negotiable for quality work.', 'open');

-- ─── ORDERS ──────────────────────────────────────────────────────
INSERT INTO orders (id, product_id, buyer_id, farmer_id, quantity, unit_price, total_amount, payment_method, payment_status, status, delivery_address, created_at) VALUES
(1, 2, 3, 2, 10,  4800.00, 48000.00, 'upi',  'paid',    'delivered', '12 Connaught Place, New Delhi - 110001', '2025-04-01 10:00:00'),
(2, 1, 3, 1, 25,  2240.00, 56000.00, 'card', 'paid',    'processing','12 Connaught Place, New Delhi - 110001', '2025-04-10 10:00:00'),
(3, 3, 3, 8, 200, 18.00,   3600.00,  'cash', 'pending', 'pending',   '12 Connaught Place, New Delhi - 110001', '2025-04-14 10:00:00'),
(4, 8, 9, 2, 500, 22.00,   11000.00, 'upi',  'paid',    'shipped',   'Wholesale Market, Mumbai - 400001',       '2025-04-09 10:00:00'),
(5, 4, 9, 2, 20,  5200.00, 104000.00,'card', 'paid',    'delivered', 'Wholesale Market, Mumbai - 400001',       '2025-03-25 10:00:00');

-- ─── MESSAGES ────────────────────────────────────────────────────
INSERT INTO messages (sender_id, receiver_id, content, is_read, created_at) VALUES
(3, 1, 'Hello! Is your wheat still available? We need 50 quintals urgently.',    1, '2025-04-13 09:00:00'),
(1, 3, 'Yes, we have 500 quintals available. Price ₹2,240/q. Want to inspect?',  1, '2025-04-13 09:15:00'),
(3, 1, 'Great! Can you do ₹2,200 for bulk order of 50 quintals?',               0, '2025-04-13 10:00:00'),
(4, 1, 'I saw your job post. My tractor is available April 18–19. ₹6,200 for full job.', 1, '2025-04-13 11:00:00'),
(1, 4, 'Sounds good! Can you come for a site visit first? Tomorrow at 10am?',    0, '2025-04-13 11:30:00'),
(9, 2, 'Hi Priya, we need 100 quintals of Basmati for our restaurant chain.',    1, '2025-04-12 14:00:00'),
(2, 9, 'Sure! Current stock 200 quintals. ₹4,800/q. We can discuss discount for bulk.', 1, '2025-04-12 14:30:00'),
(9, 2, 'Can you do ₹4,600 if we take 100 quintals? We will pay in advance.',    0, '2025-04-12 15:00:00');

-- ─── REVIEWS ─────────────────────────────────────────────────────
INSERT INTO reviews (reviewer_id, reviewed_id, rating, comment, order_id, review_type) VALUES
(3, 2, 5, 'Excellent quality Basmati! Exactly as described. Will order again.',    1, 'product'),
(3, 2, 5, 'Priya is very professional. Fast communication, honest about quality.', 1, 'product'),
(3, 1, 4, 'Good wheat quality. Delivery was slightly delayed but overall satisfied.', 2, 'product'),
(9, 2, 5, 'Best Basmati supplier in Haryana. Always delivers premium quality.',    5, 'product'),
(9, 2, 5, 'Organic onions were perfect. No damage, fresh and clean.',              4, 'product');

-- ─── BIDS ────────────────────────────────────────────────────────
INSERT INTO bids (job_id, provider_id, amount, message, timeline, status) VALUES
(1, 4, 6200.00, 'I can do the job with my Mahindra 575 DI. Available April 18 morning. Experienced in wheat fields.', '2 days', 'pending'),
(1, 5, 6800.00, 'I have a partner with tractor service. April 17-18 available.', '2 days', 'pending'),
(2, 5, 7500.00, 'Can arrange 15-ton truck. Same day delivery to Azadpur possible. Insurance covered.', '1 day', 'pending'),
(3, 6, 11000.00,'Team of 20 available. Experienced in tomato harvesting. Can start April 20.', '3 days', 'pending'),
(4, 10, 22000.00,'I specialize in drip irrigation. Can do site visit this weekend. PMKSY subsidy process handled.', '7 days', 'pending');

-- ─── Update auto-increment values ────────────────────────────────
ALTER TABLE users     AUTO_INCREMENT = 20;
ALTER TABLE products  AUTO_INCREMENT = 20;
ALTER TABLE services  AUTO_INCREMENT = 20;
ALTER TABLE orders    AUTO_INCREMENT = 20;
ALTER TABLE messages  AUTO_INCREMENT = 20;
ALTER TABLE job_posts AUTO_INCREMENT = 20;
ALTER TABLE bids      AUTO_INCREMENT = 20;

SELECT 'Seed data inserted successfully!' AS status;
SELECT CONCAT('Users: ', COUNT(*))    AS info FROM users    UNION ALL
SELECT CONCAT('Products: ', COUNT(*)) FROM products         UNION ALL
SELECT CONCAT('Orders: ', COUNT(*))   FROM orders           UNION ALL
SELECT CONCAT('Services: ', COUNT(*)) FROM services         UNION ALL
SELECT CONCAT('Messages: ', COUNT(*)) FROM messages;