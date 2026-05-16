# 🌾 AgriConnect — Agricultural Marketplace

A full-stack platform connecting farmers, buyers and service providers.

## Tech Stack
Node.js | Express.js | MySQL | Socket.io | Razorpay | JWT | Cloudinary

## Features
- Role-based auth (farmer, buyer, provider, admin)
- Product marketplace with real-time inventory
- Service job posting and bidding system
- Real-time chat with Socket.io
- Razorpay payment integration

## Setup
1. Clone the repo
2. Run `npm install`
3. Copy `.env.example` to `.env` and fill values
4. Run `mysql -u root -p < database/schema.sql`
5. Run `mysql -u root -p agriconnect < database/seed.sql`
6. Run `npm run dev`
