# 🌾 AgriConnect — Backend Setup Guide

## Quick Start

### 1. Install Dependencies
```bash
cd agriconnect
npm install
```

### 2. Setup Database
```bash
# Create and seed the MySQL database
mysql -u root -p < database/schema.sql
mysql -u root -p agriconnect < database/seed.sql
```

### 3. Configure Environment
```bash
cp .env.example .env
# Edit .env with your MySQL password and Razorpay keys
```

Minimum `.env` to get started:
```
DB_PASS=your_mysql_password
JWT_SECRET=any_long_random_string
RAZORPAY_KEY_ID=rzp_test_xxxx       # from razorpay.com dashboard
RAZORPAY_KEY_SECRET=your_secret
```

### 4. Run
```bash
npm run dev      # development (nodemon)
npm start        # production
```

Server starts at: **http://localhost:3000**

---

## Demo Login Credentials

| Role     | Email              | Password |
|----------|--------------------|----------|
| Farmer   | ramesh@demo.com    | demo123  |
| Farmer   | priya@demo.com     | demo123  |
| Buyer    | suresh@demo.com    | demo123  |
| Provider | anil@demo.com      | demo123  |
| Admin    | admin@demo.com     | demo123  |

---

## API Reference

### Auth
| Method | Endpoint                  | Auth     | Description          |
|--------|---------------------------|----------|----------------------|
| POST   | /api/auth/register        | No       | Register new user    |
| POST   | /api/auth/login           | No       | Login                |
| GET    | /api/auth/me              | Required | Get own profile      |
| PUT    | /api/auth/update          | Required | Update profile       |
| PUT    | /api/auth/password        | Required | Change password      |
| GET    | /api/auth/profile/:userId | No       | View public profile  |

### Products (Marketplace)
| Method | Endpoint             | Auth         | Description          |
|--------|----------------------|--------------|----------------------|
| GET    | /api/products        | Optional     | List + filter crops  |
| GET    | /api/products/my     | Farmer       | My listings          |
| GET    | /api/products/:id    | Optional     | Product detail       |
| POST   | /api/products        | Farmer/Admin | List new crop        |
| PUT    | /api/products/:id    | Owner/Admin  | Update listing       |
| DELETE | /api/products/:id    | Owner/Admin  | Delete listing       |

### Orders
| Method | Endpoint                  | Auth         | Description          |
|--------|---------------------------|--------------|----------------------|
| POST   | /api/orders               | Buyer        | Place order          |
| GET    | /api/orders               | Required     | My orders            |
| GET    | /api/orders/stats         | Required     | Order statistics     |
| GET    | /api/orders/:id           | Buyer/Farmer | Order detail         |
| PATCH  | /api/orders/:id/status    | Farmer/Admin | Update order status  |

### Cart (Buyer only)
| Method | Endpoint                  | Auth  | Description           |
|--------|---------------------------|-------|-----------------------|
| GET    | /api/cart                 | Buyer | Get cart              |
| POST   | /api/cart                 | Buyer | Add item              |
| PUT    | /api/cart/:cartItemId     | Buyer | Update quantity       |
| DELETE | /api/cart/:cartItemId     | Buyer | Remove item           |
| DELETE | /api/cart/clear           | Buyer | Clear cart            |
| POST   | /api/cart/checkout        | Buyer | Checkout all items    |

### Services & Jobs
| Method | Endpoint                    | Auth          | Description      |
|--------|-----------------------------|---------------|------------------|
| GET    | /api/services               | Optional      | List services    |
| POST   | /api/services               | Provider      | Add service      |
| GET    | /api/services/jobs          | Optional      | Open job posts   |
| POST   | /api/services/jobs          | Farmer        | Post a job       |
| GET    | /api/services/jobs/:id/bids | Farmer        | View bids        |
| POST   | /api/services/jobs/:id/bids | Provider      | Submit a bid     |
| PATCH  | /api/services/bids/:id/accept | Farmer      | Accept a bid     |

### Chat
| Method | Endpoint                        | Auth     | Description            |
|--------|---------------------------------|----------|------------------------|
| GET    | /api/chat/conversations         | Required | All conversations      |
| GET    | /api/chat/messages/:partnerId   | Required | Chat history           |
| POST   | /api/chat/send                  | Required | Send message           |
| GET    | /api/chat/unread                | Required | Unread count           |

### Payments (Razorpay)
| Method | Endpoint                    | Auth     | Description            |
|--------|-----------------------------|----------|------------------------|
| POST   | /api/payments/create-order  | Required | Create Razorpay order  |
| POST   | /api/payments/verify        | Required | Verify payment         |
| POST   | /api/payments/webhook       | None     | Razorpay webhook       |

### Dashboard
| Method | Endpoint                           | Auth  | Description            |
|--------|------------------------------------|-------|------------------------|
| GET    | /api/dashboard                     | Any   | Role-based stats       |
| GET    | /api/dashboard/admin/users         | Admin | All users              |
| PATCH  | /api/dashboard/admin/users/:id/verify   | Admin | Verify user      |
| PATCH  | /api/dashboard/admin/users/:id/deactivate | Admin | Deactivate user |

---

## Real-time Chat (Socket.io)

Connect from your frontend:
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: { token: localStorage.getItem('token') }
});

// Join a chat room with a partner
socket.emit('chat:join', { partnerId: 3 });

// Send a message
socket.emit('chat:message', {
  receiverId: 3,
  content: 'Hello! Is wheat available?',
  tempId: Date.now()   // for optimistic UI
});

// Listen for incoming messages
socket.on('chat:message', (msg) => {
  console.log(msg);  // { id, sender_id, content, created_at, ... }
});

// Typing indicator
socket.emit('chat:typing', { partnerId: 3, isTyping: true });
socket.on('chat:typing', ({ userId, isTyping }) => { /* show indicator */ });

// Online status
socket.on('user:online',  ({ userId }) => { /* mark online  */ });
socket.on('user:offline', ({ userId }) => { /* mark offline */ });
```

---

## Connecting Frontend to Backend

In your `frontend/app.js`, replace the localStorage DB with API calls:

```javascript
const API = 'http://localhost:3000/api';
const token = () => localStorage.getItem('ac_token');

// Login
const res = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password, role })
});
const { token: jwt, user } = await res.json();
localStorage.setItem('ac_token', jwt);

// Authenticated request
const products = await fetch(`${API}/products`, {
  headers: { Authorization: `Bearer ${token()}` }
}).then(r => r.json());
```

---

## Razorpay Payment Flow

1. **Frontend** calls `POST /api/payments/create-order` with `{ order_id }`
2. **Backend** creates Razorpay order, returns `razorpay_order_id + key_id`
3. **Frontend** opens Razorpay checkout modal
4. On success, **frontend** calls `POST /api/payments/verify` with the three Razorpay fields
5. **Backend** verifies HMAC signature and marks order as paid

---

## File Upload (Images)

- With Cloudinary configured: images stored on cloud, returned as CDN URL
- Without Cloudinary: images stored in `/uploads/`, served at `/uploads/filename.jpg`
- Max size: 5MB (configurable via `MAX_FILE_SIZE_MB` in `.env`)
- Accepted formats: JPG, PNG, WEBP