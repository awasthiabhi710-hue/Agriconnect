// frontend/api.js
const API = 'http://localhost:3000/api';

const getToken = () => localStorage.getItem('ac_token');

async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  const res = await fetch(API + endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

// ── Auth ─────────────────────────────────────
const authAPI = {
  async register(payload) {
    return apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(payload) });
  },
  async login(payload) {
    return apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(payload) });
  },
  async getMe() {
    return apiFetch('/auth/me');
  },
  async updateProfile(payload) {
    return apiFetch('/auth/update', { method: 'PUT', body: JSON.stringify(payload) });
  },
};

// ── Products ──────────────────────────────────
const productAPI = {
  async getAll(params = {}) {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`/products?${q}`);
  },
  async getById(id) {
    return apiFetch(`/products/${id}`);
  },
  async create(formData) {
    const token = getToken();
    const res = await fetch(`${API}/products`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },
  async update(id, payload) {
    return apiFetch(`/products/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  },
  async delete(id) {
    return apiFetch(`/products/${id}`, { method: 'DELETE' });
  },
  async getMyProducts() {
    return apiFetch('/products/my');
  },
};

// ── Orders ────────────────────────────────────
const orderAPI = {
  async place(payload) {
    return apiFetch('/orders', { method: 'POST', body: JSON.stringify(payload) });
  },
  async getAll(params = {}) {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`/orders?${q}`);
  },
  async getById(id) {
    return apiFetch(`/orders/${id}`);
  },
  async updateStatus(id, status) {
    return apiFetch(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
  },
};

// ── Cart ──────────────────────────────────────
const cartAPI = {
  async get() {
    return apiFetch('/cart');
  },
  async add(product_id, quantity = 1) {
    return apiFetch('/cart', { method: 'POST', body: JSON.stringify({ product_id, quantity }) });
  },
  async update(cartItemId, quantity) {
    return apiFetch(`/cart/${cartItemId}`, { method: 'PUT', body: JSON.stringify({ quantity }) });
  },
  async remove(cartItemId) {
    return apiFetch(`/cart/${cartItemId}`, { method: 'DELETE' });
  },
  async checkout(payload) {
    return apiFetch('/cart/checkout', { method: 'POST', body: JSON.stringify(payload) });
  },
};

// ── Services ──────────────────────────────────
const serviceAPI = {
  async getAll(params = {}) {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`/services?${q}`);
  },
  async getById(id) {
    return apiFetch(`/services/${id}`);
  },
  async create(formData) {
    const token = getToken();
    const res = await fetch(`${API}/services`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },
  async update(id, payload) {
    return apiFetch(`/services/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  },
  async delete(id) {
    return apiFetch(`/services/${id}`, { method: 'DELETE' });
  },
};

// ── Jobs ──────────────────────────────────────
const jobAPI = {
  async getAll(params = {}) {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`/jobs?${q}`);
  },
  async getById(id) {
    return apiFetch(`/jobs/${id}`);
  },
  async create(payload) {
    return apiFetch('/jobs', { method: 'POST', body: JSON.stringify(payload) });
  },
  async update(id, payload) {
    return apiFetch(`/jobs/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  },
  async delete(id) {
    return apiFetch(`/jobs/${id}`, { method: 'DELETE' });
  },
  async submitBid(jobId, payload) {
    return apiFetch(`/jobs/${jobId}/bids`, { method: 'POST', body: JSON.stringify(payload) });
  },
  async getJobBids(jobId) {
    return apiFetch(`/jobs/${jobId}/bids`);
  },
  async acceptBid(bidId) {
    return apiFetch(`/jobs/bids/${bidId}/accept`, { method: 'PATCH' });
  },
  async rejectBid(bidId) {
    return apiFetch(`/jobs/bids/${bidId}/reject`, { method: 'PATCH' });
  },
};

// ── Chat ──────────────────────────────────────
const chatAPI = {
  async getConversations() {
    return apiFetch('/chat/conversations');
  },
  async getMessages(partnerId) {
    return apiFetch(`/chat/messages/${partnerId}`);
  },
  async send(receiver_id, content) {
    return apiFetch('/chat/send', { method: 'POST', body: JSON.stringify({ receiver_id, content }) });
  },
  async getUnreadCount() {
    return apiFetch('/chat/unread');
  },
};

// ── Payments ──────────────────────────────────
const paymentAPI = {
  async createOrder(order_id) {
    return apiFetch('/payments/create-order', { method: 'POST', body: JSON.stringify({ order_id }) });
  },
  async verify(payload) {
    return apiFetch('/payments/verify', { method: 'POST', body: JSON.stringify(payload) });
  },
};

// ── Dashboard ─────────────────────────────────
const dashAPI = {
  async get() {
    return apiFetch('/dashboard');
  },
};

// ── Users ─────────────────────────────────────
const userAPI = {
  async getProfile(id) {
    return apiFetch(`/users/${id}`);
  },
  async submitReview(id, payload) {
    return apiFetch(`/users/${id}/reviews`, { method: 'POST', body: JSON.stringify(payload) });
  },
  async getReviews(id) {
    return apiFetch(`/users/${id}/reviews`);
  },
  async search(params = {}) {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`/users/search?${q}`);
  },
};

// ── Reviews ──────────────────────────────────
// Tries /reviews/* endpoints. If the backend route doesn't exist yet
// (returns "Route not found" or similar), falls back gracefully to
// empty data so the UI never shows an error modal.
const reviewAPI = {

  _isRouteMissing(err) {
    if (!err || !err.message) return false;
    const msg = err.message.toLowerCase();
    return (
      msg.includes('route not found') ||
      msg.includes('cannot get') ||
      msg.includes('not found') ||
      msg.includes('no route') ||
      msg.includes('404')
    );
  },

  async getByUser(userId) {
    try {
      return await apiFetch(`/reviews/user/${userId}`);
    } catch (err) {
      if (this._isRouteMissing(err)) {
        // Try legacy users endpoint as fallback
        try {
          return await apiFetch(`/users/${userId}/reviews`);
        } catch (_) {
          return { reviews: [], stats: { total: 0, average: 0 } };
        }
      }
      return { reviews: [], stats: { total: 0, average: 0 } };
    }
  },

  async getByProduct(productId) {
    try {
      return await apiFetch(`/reviews/product/${productId}`);
    } catch (err) {
      if (this._isRouteMissing(err)) {
        return { reviews: [], stats: { total: 0, average: 0 } };
      }
      return { reviews: [], stats: { total: 0, average: 0 } };
    }
  },

  async getByService(serviceId) {
    try {
      return await apiFetch(`/reviews/service/${serviceId}`);
    } catch (err) {
      if (this._isRouteMissing(err)) {
        return { reviews: [], stats: { total: 0, average: 0 } };
      }
      return { reviews: [], stats: { total: 0, average: 0 } };
    }
  },

  async submit(payload) {
    // Try /reviews first
    try {
      return await apiFetch('/reviews', { method: 'POST', body: JSON.stringify(payload) });
    } catch (err) {
      if (this._isRouteMissing(err)) {
        // Fallback to legacy users endpoint
        try {
          return await apiFetch(`/users/${payload.reviewed_id}/reviews`, {
            method: 'POST',
            body: JSON.stringify(payload),
          });
        } catch (_) {
          throw new Error('Review submission is not available yet. Please check back later.');
        }
      }
      throw err;
    }
  },
};

// ── Admin API ─────────────────────────────────
const adminAPI = {
  async getStats() {
    return apiFetch('/admin/stats');
  },
  async getUsers(params = {}) {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`/admin/users?${q}`);
  },
  async verifyUser(id) {
    return apiFetch(`/admin/users/${id}/verify`, { method: 'PATCH' });
  },
  async unverifyUser(id) {
    return apiFetch(`/admin/users/${id}/unverify`, { method: 'PATCH' });
  },
  async banUser(id) {
    return apiFetch(`/admin/users/${id}/ban`, { method: 'PATCH' });
  },
  async unbanUser(id) {
    return apiFetch(`/admin/users/${id}/unban`, { method: 'PATCH' });
  },
  async deleteUser(id) {
    return apiFetch(`/admin/users/${id}`, { method: 'DELETE' });
  },
  async getProducts(params = {}) {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`/admin/products?${q}`);
  },
  async deleteProduct(id) {
    return apiFetch(`/admin/products/${id}`, { method: 'DELETE' });
  },
  async getOrders(params = {}) {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`/admin/orders?${q}`);
  },
  async updateOrderStatus(id, status) {
    return apiFetch(`/admin/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
  },
  async getServices() {
    return apiFetch('/admin/services');
  },
  async deleteService(id) {
    return apiFetch(`/admin/services/${id}`, { method: 'DELETE' });
  },
  async getReviews() {
    return apiFetch('/admin/reviews');
  },
  async deleteReview(id) {
    return apiFetch(`/admin/reviews/${id}`, { method: 'DELETE' });
  },
  async getRevenue() {
    return apiFetch('/admin/revenue');
  },
  async getJobs() {
    return apiFetch('/admin/jobs');
  },
  async deleteJob(id) {
    return apiFetch(`/admin/jobs/${id}`, { method: 'DELETE' });
  },
};