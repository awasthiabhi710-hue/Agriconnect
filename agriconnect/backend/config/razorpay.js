// ═══════════════════════════════════════════
// config/razorpay.js — Razorpay Payment Gateway
// ═══════════════════════════════════════════
const Razorpay = require('razorpay');
require('dotenv').config();

console.log("KEY:", process.env.RAZORPAY_KEY_ID);

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});
module.exports = razorpay;