/* ═══════════════════════════════════════════
   AgriConnect — Full Application Logic
   Updated: Provider Dashboard now has full
   Manage Service modal (mirrors farmer flow)
   with status cards, promo/discount, real-time
   refresh of dashboard + service grid on save.
═══════════════════════════════════════════ */

let currentUser = JSON.parse(localStorage.getItem('ac_currentUser') || 'null');
let selectedRole = 'farmer';
let selectedPayMethod = 'upi';
let activeChat = null;

const pageHistory = [];

/* ═══════════════════════════════════════════
   PAGE ROUTING + BACK BUTTON
═══════════════════════════════════════════ */
function showPage(pageId) {
  const current = document.querySelector('.page.active');
  const currentId = current ? current.id.replace('page-', '') : null;
  if (currentId && currentId !== pageId) {
    pageHistory.push(currentId);
    if (pageHistory.length > 20) pageHistory.shift();
  }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById('page-' + pageId);
  if (page) page.classList.add('active');
  window.scrollTo(0, 0);

  if (currentUser && pageId !== 'home' && pageId !== 'auth') {
    localStorage.setItem('ac_lastPage', pageId);
  }

  if (pageId === 'marketplace') loadMarketplace();
  if (pageId === 'services') loadServices();
  if (pageId === 'dashboard') loadDashboard();
  if (pageId === 'chat') loadChat();
  if (pageId === 'orders') loadOrdersPage();
  if (pageId === 'cart') loadCartPage();
  if (pageId === 'my-profile') loadMyProfile();

  if (pageId === 'marketplace') {
    const btn = document.getElementById('addCropBtn');
    if (btn) btn.style.display = currentUser && currentUser.role === 'farmer' ? 'flex' : 'none';
  }
  if (pageId === 'services') updateServiceButtons();
  toggleMenu(false);
  updateCartBadge();
}

function goBack() {
  if (pageHistory.length > 0) {
    const prev = pageHistory.pop();
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const page = document.getElementById('page-' + prev);
    if (page) page.classList.add('active');
    window.scrollTo(0, 0);
    if (prev === 'marketplace') loadMarketplace();
    if (prev === 'services') loadServices();
    if (prev === 'orders') loadOrdersPage();
    if (prev === 'cart') loadCartPage();
    if (prev === 'dashboard') loadDashboard();
    if (prev === 'chat') loadChat();
    if (prev === 'services') updateServiceButtons();
    updateCartBadge();
  } else {
    showPage('home');
  }
}

function scrollToSection(id) {
  showPage('home');
  setTimeout(() => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }, 100);
}

function toggleMenu(force) {
  const nav = document.getElementById('navLinks');
  if (force === false) { nav.classList.remove('open'); return; }
  nav.classList.toggle('open');
}

/* ═══════════════════════════════════════════
   NAV LINKS
═══════════════════════════════════════════ */
function updateNavLinks() {
  const role = currentUser ? currentUser.role : null;
  const navLinks = document.getElementById('navLinks');
  if (!navLinks) return;

  if (!role) {
    navLinks.innerHTML = `
      <a href="#" onclick="showPage('home')">Home</a>
      <a href="#" onclick="scrollToSection('about')">About</a>
      <a href="#" onclick="scrollToSection('contact')">Contact</a>
    `;
  } else {
    const servicesLink = (role !== 'buyer')
      ? `<a href="#" onclick="showPage('services')">Services</a>`
      : '';

    navLinks.innerHTML = `
      <a href="#" onclick="showPage('marketplace')">Marketplace</a>
      ${servicesLink}
      ${role === 'buyer' ? `
        <a href="#" onclick="showPage('orders')">My Orders</a>
        <a href="#" onclick="showPage('cart')" id="cartNavLink">
          🛒 Cart <span id="cartBadgeNav" style="background:#3a9e40;color:white;border-radius:50%;padding:1px 7px;font-size:.72rem;display:none">0</span>
        </a>` : ''}
      ${role === 'farmer' ? `<a href="#" onclick="showPage('orders')">Orders</a>` : ''}
      <a href="#" onclick="showPage('chat')">Messages</a>
      ${role === 'farmer' || role === 'provider' ? `<a href="#" onclick="showPage('dashboard')">Dashboard</a>` : ''}
${role === 'admin' ? `<a href="#" onclick="showPage('dashboard')" style="color:#f59e0b;font-weight:700">🛡️ Admin Panel</a>` : ''}
    `;
  }
  updateCartBadge();
}

/* ═══════════════════════════════════════════
   CART BADGE
═══════════════════════════════════════════ */
async function updateCartBadge() {
  if (!currentUser || currentUser.role !== 'buyer') return;
  try {
    const res = await cartAPI.get();
    const count = (res.items || []).reduce((s, c) => s + c.quantity, 0);
    const badge = document.getElementById('cartBadgeNav');
    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'inline' : 'none';
    }
  } catch {}
}

async function addToCart(productId, qty = 1) {
  if (!currentUser) { showPage('auth'); toast('Please login first', 'error'); return; }
  if (currentUser.role !== 'buyer') { toast('Only buyers can add to cart', 'error'); return; }
  try {
    await cartAPI.add(productId, qty);
    toast('Added to cart! 🛒', 'success');
    updateCartBadge();
  } catch (err) {
    toast(err.message || 'Failed to add to cart', 'error');
  }
}

/* ═══════════════════════════════════════════
   AUTH
═══════════════════════════════════════════ */
function switchAuthTab(tab, btn) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
  document.getElementById('auth-' + tab).classList.add('active');
  if (btn) btn.classList.add('active');
  else document.querySelectorAll('.auth-tab').forEach(t => {
    if (t.textContent.toLowerCase().includes(tab)) t.classList.add('active');
  });
}

function selectRole(el) {
  document.querySelectorAll('.role-opt').forEach(o => o.classList.remove('active'));
  el.classList.add('active');
  selectedRole = el.dataset.role;
  document.getElementById('providerFields').style.display = selectedRole === 'provider' ? 'block' : 'none';
}

async function handleLogin() {
  const email = document.getElementById('loginEmail').value;
  const pass = document.getElementById('loginPass').value;
  try {
    const res = await authAPI.login({ email, password: pass });
    localStorage.setItem('ac_token', res.token);
    localStorage.setItem('ac_currentUser', JSON.stringify(res.user));
    currentUser = res.user;
    updateNavUser();
    updateNavLinks();
    showPage('marketplace');
    toast(`Welcome back, ${res.user.name.split(' ')[0]}! 👋`, 'success');
  } catch (err) {
    toast(err.message || 'Login failed', 'error');
  }
}

async function handleRegister() {
  try {
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const pass = document.getElementById('regPass').value;
    const mobile = document.getElementById('regMobile').value;
    const state = document.getElementById('regState').value;
    let serviceType = null;
    if (selectedRole === 'provider') {
      serviceType = document.getElementById('serviceType')?.value;
    }
    const res = await authAPI.register({ name, email, password: pass, mobile, state, role: selectedRole, service_type: serviceType });
    currentUser = res.user;
    localStorage.setItem('ac_token', res.token);
    localStorage.setItem('ac_currentUser', JSON.stringify(res.user));
    updateNavUser();
    updateNavLinks();
    showPage('marketplace');
    toast('Account created successfully! ✅', 'success');
  } catch (err) {
    toast(err.message || 'Registration failed', 'error');
  }
}

function logout() {
  currentUser = null;
  localStorage.removeItem('ac_token');
  localStorage.removeItem('ac_currentUser');
  localStorage.removeItem('ac_lastPage');
  updateNavUser();
  updateNavLinks();
  pageHistory.splice(0, pageHistory.length);
  showPage('home');
  toast('Logged out successfully');
}

/* ═══════════════════════════════════════════
   NAV USER PILL
═══════════════════════════════════════════ */
function updateNavUser() {
  const pill = document.getElementById('userPill');
  const loginBtn = document.getElementById('loginBtn');
  if (currentUser) {
    pill.style.display = 'flex';
    loginBtn.style.display = 'none';
    const avatarEl = document.getElementById('userAvatar');
    if (currentUser.profile_pic) {
      avatarEl.innerHTML = `<img src="${currentUser.profile_pic}" style="width:30px;height:30px;border-radius:50%;object-fit:cover;"/>`;
      avatarEl.style.background = 'none'; avatarEl.style.padding = '0';
    } else {
      avatarEl.innerHTML = currentUser.name[0].toUpperCase();
      avatarEl.style.background = '';
    }
    document.getElementById('userNameNav').textContent = currentUser.name.split(' ')[0];
    const roleLabels = { farmer: '👨‍🌾 Farmer', buyer: '🛒 Buyer', provider: '🔧 Provider', admin: '🛡️ Admin' };
    document.getElementById('roleBadgeNav').textContent = roleLabels[currentUser.role] || currentUser.role;
    avatarEl.style.cursor = 'pointer';
    avatarEl.onclick = () => showPage('my-profile');
    document.getElementById('userNameNav').style.cursor = 'pointer';
    document.getElementById('userNameNav').onclick = () => showPage('my-profile');
  } else {
    pill.style.display = 'none';
    loginBtn.style.display = 'block';
  }
}

/* ═══════════════════════════════════════════
   IMAGE HELPERS
═══════════════════════════════════════════ */
function previewImage(inputEl, previewId) {
  const file = inputEl.files[0];
  const preview = document.getElementById(previewId);
  if (!preview) return;
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      preview.innerHTML = `<img src="${e.target.result}" style="width:100%;height:140px;object-fit:cover;border-radius:8px;margin-top:8px;border:1px solid #e5e7eb;"/>`;
    };
    reader.readAsDataURL(file);
  } else {
    preview.innerHTML = '';
  }
}

/* ═══════════════════════════════════════════
   MARKETPLACE
═══════════════════════════════════════════ */
const cropEmojis = {
  'Grains & Cereals': '🌾', 'Vegetables': '🥦', 'Fruits': '🍎',
  'Pulses & Legumes': '🫘', 'Spices & Herbs': '🌶️', 'Oilseeds': '🌻'
};

async function loadMarketplace() {
  try {
    renderMarketplaceBanner();
    const res = await productAPI.getAll();
    renderProducts(res.products || []);
  } catch (err) {
    const grid = document.getElementById('productGrid');
    if (grid) grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="es-icon">❌</div><h3>Failed to load</h3><p>${err.message}</p></div>`;
  }
}

async function filterProducts() {
  const search = document.getElementById('searchCrops')?.value || '';
  const cat = document.getElementById('filterCategory')?.value || '';
  const state = document.getElementById('filterState')?.value || '';
  const sort = document.getElementById('filterSort')?.value || 'newest';
  const grid = document.getElementById('productGrid');
  if (grid) grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:#6b7280">Loading...</div>`;
  try {
    const params = {};
    if (search) params.search = search;
    if (cat) params.category = cat;
    if (state) params.state = state;
    if (sort) params.sort = sort;
    const res = await productAPI.getAll(params);
    renderProducts(res.products || []);
  } catch (err) {
    if (grid) grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="es-icon">❌</div><h3>Failed to load</h3></div>`;
  }
}

/* ═══════════════════════════════════════════
   SECTION BANNERS
═══════════════════════════════════════════ */
function renderMarketplaceBanner() {
  const grid = document.getElementById('productGrid');
  if (!grid) return;

  const isBuyer = currentUser && currentUser.role === 'buyer';
  const isFarmer = currentUser && currentUser.role === 'farmer';

  let bannerHTML = '';

  if (isFarmer) {
    bannerHTML = `
      <div class="section-banner" style="background-image:url('https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=1200&q=80')">
        <div class="section-banner-content">
          <div class="section-banner-tag">🌾 For Farmers</div>
          <div class="section-banner-title">Your Farm.<br/><span>Direct to Buyers.</span></div>
          <button class="section-banner-btn" onclick="showModal('addProductModal')">+ List Your Crop</button>
        </div>
      </div>`;
  } else if (isBuyer) {
    bannerHTML = `
      <div class="section-banner" style="background-image:url('https://images.unsplash.com/photo-1518977822534-7049a61ee0c2?w=1200&q=80')">
        <div class="section-banner-content">
          <div class="section-banner-tag">🛒 Fresh Produce</div>
          <div class="section-banner-title">Farm-Fresh Crops.<br/><span>Best Prices.</span></div>
          <button class="section-banner-btn" onclick="document.getElementById('searchCrops').focus()">Explore Now →</button>
        </div>
      </div>`;
  } else {
    bannerHTML = `
      <div class="section-banner" style="background-image:url('https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=1200&q=80')">
        <div class="section-banner-content">
          <div class="section-banner-tag">🌱 AgriConnect</div>
          <div class="section-banner-title">India's Freshest<br/><span>Agricultural Market</span></div>
          <button class="section-banner-btn" onclick="showPage('auth')">Join Free →</button>
        </div>
      </div>`;
  }

  const existing = document.getElementById('marketplaceBanner');
  if (existing) existing.remove();
  const wrapper = document.createElement('div');
  wrapper.id = 'marketplaceBanner';
  wrapper.innerHTML = bannerHTML;
  grid.parentNode.insertBefore(wrapper, grid);
}

function renderProducts(products) {
  const grid = document.getElementById('productGrid');
  if (!grid) return;
  if (!products.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="es-icon">🌾</div><h3>No crops found</h3><p>Try adjusting your search filters</p></div>`;
    return;
  }
  const isFarmer = currentUser && currentUser.role === 'farmer';
  const isBuyer = currentUser && currentUser.role === 'buyer';

  grid.innerHTML = products.map(p => {
    const farmer = { id: p.farmer_id, name: p.farmer_name || 'Farmer', rating: p.farmer_rating || 5, total_reviews: p.farmer_reviews || 0 };
    const stars = '★'.repeat(Math.floor(farmer.rating)) + '☆'.repeat(5 - Math.floor(farmer.rating));
    const isOwn = currentUser && currentUser.id === p.farmer_id;
    const emoji = cropEmojis[p.category] || '🌾';

    const imageHTML = p.image_url
      ? `<img src="${p.image_url}" style="width:100%;height:100%;object-fit:cover;" />`
      : `<div style="width:100%;height:100%;background:linear-gradient(135deg,#e8f5e9,#fef3c7);display:flex;align-items:center;justify-content:center;font-size:3.5rem">${emoji}</div>`;

    let footerButtons = '';
    if (isFarmer && isOwn) {
      footerButtons = `
        <button class="btn-order" style="background:#1e4620;flex:1" onclick="event.stopPropagation();openProductDetailModal(${p.id})">📋 Manage</button>
        <button class="btn-chat-small" onclick="event.stopPropagation();confirmDeleteProduct(${p.id},'${p.name.replace(/'/g,"\\'")}')">🗑️</button>`;
    } else if (isBuyer) {
      footerButtons = `
        <button class="btn-order" style="flex:1" onclick="event.stopPropagation();openProductDetailModal(${p.id})">🛒 View & Order</button>
        <button class="btn-chat-small" onclick="event.stopPropagation();addToCart(${p.id},1)" title="Quick add to cart">+🛒</button>
        <button class="btn-chat-small" onclick="event.stopPropagation();startChatAndGo(${farmer.id})">💬</button>`;
    } else if (isFarmer && !isOwn) {
      footerButtons = `
        <button class="btn-order" style="flex:1" onclick="event.stopPropagation();openProductDetailModal(${p.id})">👁️ View Details</button>
        <button class="btn-chat-small" onclick="event.stopPropagation();startChatAndGo(${farmer.id})">💬</button>`;
    } else {
      footerButtons = `
        <button class="btn-order" style="flex:1" onclick="event.stopPropagation();openProductDetailModal(${p.id})">🛒 View & Order</button>
        <button class="btn-chat-small" onclick="event.stopPropagation();startChatAndGo(${farmer.id})">💬</button>`;
    }

    return `
    <div class="product-card" onclick="openProductDetailModal(${p.id})">
      <div class="pc-image" style="padding:0;overflow:hidden;position:relative;height:180px;">
        ${imageHTML}
        <span class="pc-badge" style="position:absolute;top:10px;right:10px;font-size:.68rem">${p.category}</span>
        ${isOwn ? `<span style="position:absolute;top:10px;left:10px;background:#1e4620;color:white;padding:3px 9px;border-radius:20px;font-size:.68rem;font-weight:700">Your Crop</span>` : ''}
        <div style="position:absolute;bottom:0;left:0;right:0;height:50px;background:linear-gradient(transparent,rgba(0,0,0,.35))"></div>
        <div style="position:absolute;bottom:10px;left:12px;font-family:'Space Mono',monospace;font-size:1.1rem;font-weight:700;color:white">
          ${p.on_sale && p.discount_pct > 0
            ? `<span style="text-decoration:line-through;font-size:.75rem;opacity:.7">₹${p.price.toLocaleString()}</span>
               <span style="margin-left:5px">₹${Math.round(p.price*(1-p.discount_pct/100)).toLocaleString()}</span>
               <span style="background:#ef4444;color:white;padding:1px 6px;border-radius:10px;font-size:.6rem;margin-left:4px">${p.discount_pct}% OFF</span>`
            : `₹${p.price.toLocaleString()}`
          }<small style="font-size:.6rem;opacity:.85">/${p.unit}</small>
        </div>
      </div>
      <div class="pc-body">
        <div class="pc-title" style="font-size:1rem;font-weight:700;margin-bottom:3px">${p.name}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <span style="font-size:.78rem;color:#2d7a31;font-weight:500">
            👨‍🌾 ${farmer.name}
            ${p.farmer_verified ? `<span style="background:#dcfce7;color:#166534;padding:1px 6px;border-radius:20px;font-size:.65rem;font-weight:700;margin-left:4px">✅</span>` : ''}
          </span>
          <span style="font-size:.75rem;color:#9ca3af">📍 ${p.state || ''}</span>
        </div>
        <div style="font-size:.78rem;color:#6b7280;background:#f9fafb;padding:7px 10px;border-radius:7px;border-left:2px solid #e5e7eb;margin-bottom:10px;line-height:1.5;min-height:36px">${(p.description || 'No description provided.').substring(0, 75)}${(p.description||'').length > 75 ? '…' : ''}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <span style="font-size:.78rem;color:#f59e0b">${stars} <span style="color:#9ca3af">(${farmer.total_reviews})</span></span>
          <span style="font-size:.75rem;color:#6b7280">Qty: ${p.quantity} ${p.unit}</span>
        </div>
        <div class="pc-footer">${footerButtons}</div>
      </div>
    </div>`;
  }).join('');
}

/* ═══════════════════════════════════════════
   PRODUCT DETAIL MODAL
═══════════════════════════════════════════ */
async function openProductDetailModal(productId) {
  try {
    const res = await productAPI.getById(productId);
    const p = res.product;
    if (!p) { toast('Product not found', 'error'); return; }

    const isFarmer = currentUser && currentUser.role === 'farmer';
    const isBuyer = currentUser && currentUser.role === 'buyer';
    const isOwn = currentUser && currentUser.id === p.farmer_id;
    const stars = '★'.repeat(Math.floor(p.farmer_rating || 5)) + '☆'.repeat(5 - Math.floor(p.farmer_rating || 5));
    const emoji = cropEmojis[p.category] || '🌾';

    const imageHTML = p.image_url
      ? `<img src="${p.image_url}" style="width:100%;height:100%;object-fit:cover;border-radius:14px;" />`
      : `<div style="width:100%;height:100%;background:linear-gradient(135deg,#e8f5e9,#fef3c7);display:flex;align-items:center;justify-content:center;font-size:5rem;border-radius:14px">${emoji}</div>`;

    let actionHTML = '';

    if (isBuyer) {
      actionHTML = `
        <div style="background:#f9fafb;border-radius:12px;padding:16px;margin-bottom:16px">
          <label style="font-size:.82rem;font-weight:600;color:#374151;display:block;margin-bottom:8px">Quantity (${p.unit})</label>
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
            <button onclick="changeModalQty(-1,${p.price})" style="width:36px;height:36px;border-radius:8px;border:1.5px solid #d1d5db;background:white;cursor:pointer;font-size:1.2rem;font-weight:700;display:flex;align-items:center;justify-content:center">−</button>
            <span id="modalQty" style="font-size:1.2rem;font-weight:700;min-width:50px;text-align:center">1</span>
            <button onclick="changeModalQty(1,${p.price})" style="width:36px;height:36px;border-radius:8px;border:1.5px solid #d1d5db;background:white;cursor:pointer;font-size:1.2rem;font-weight:700;display:flex;align-items:center;justify-content:center">+</button>
            <span style="font-size:.8rem;color:#9ca3af">Max: ${p.quantity} ${p.unit}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;background:white;padding:10px 14px;border-radius:8px;border:1px solid #e5e7eb">
            <span style="font-size:.85rem;color:#6b7280;font-weight:600">Total Amount</span>
            <span id="modalTotal" style="font-family:'Space Mono',monospace;font-size:1.3rem;font-weight:700;color:#2d7a31">₹${p.price.toLocaleString()}</span>
          </div>
        </div>
        <div class="form-group">
          <label>Delivery Address</label>
          <textarea id="modalDeliveryAddr" placeholder="Enter your full delivery address..." style="height:80px;resize:none"></textarea>
        </div>
        <label style="font-size:.85rem;font-weight:600;color:#374151;display:block;margin-bottom:8px">Payment Method</label>
        <div class="payment-methods" style="margin-bottom:16px">
          <div class="pay-opt active" onclick="selectPay(this,'upi')">📱 UPI</div>
          <div class="pay-opt" onclick="selectPay(this,'card')">💳 Card</div>
          <div class="pay-opt" onclick="selectPay(this,'cash')">💵 Cash</div>
        </div>
        <div style="display:flex;gap:10px">
          <button onclick="addToCart(${p.id},parseInt(document.getElementById('modalQty').textContent))" style="flex:1;padding:12px;background:#fef3c7;color:#92400e;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-size:.9rem;font-family:'DM Sans',sans-serif">🛒 Add to Cart</button>
          <button onclick="placeOrderFromModal(${p.id},${p.farmer_id},${p.price},${p.quantity})" style="flex:2;padding:12px;background:linear-gradient(135deg,#2d7a31,#3a9e40);color:white;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-size:.9rem;font-family:'DM Sans',sans-serif">⚡ Buy Now</button>
        </div>
        <button onclick="openSubmitReview({reviewed_id:${p.farmer_id},product_id:${p.id},type:'product',name:'${(p.name||'').replace(/'/g,"\\'")}'})" style="width:100%;margin-top:10px;padding:11px;background:white;border:2px solid #f59e0b;border-radius:10px;color:#92400e;font-weight:700;font-size:.9rem;cursor:pointer;font-family:'DM Sans',sans-serif">⭐ Write a Review</button>
        <div style="margin-top:16px">
          <div style="font-weight:700;font-size:.9rem;color:#374151;margin-bottom:10px">Reviews <span id="productReviewCount" style="color:#9ca3af;font-weight:400"></span></div>
          <div id="productReviewsList"><div style="text-align:center;color:#9ca3af;font-size:.82rem;padding:16px">Loading reviews...</div></div>
        </div>`;
    } else if (isFarmer && isOwn) {
      actionHTML = `
        <div style="background:#f0fdf4;border-radius:12px;padding:16px;margin-bottom:16px">
          <h4 style="font-size:.95rem;font-weight:700;color:#166534;margin-bottom:14px">✏️ Update Your Listing</h4>
          <div class="form-row">
            <div class="form-group"><label>Price (₹/${p.unit})</label><input type="number" id="editProdPrice" value="${p.price}"/></div>
            <div class="form-group"><label>Quantity (${p.unit})</label><input type="number" id="editProdQty" value="${p.quantity}"/></div>
          </div>
          <div class="form-group"><label>Description</label><textarea id="editProdDesc" style="height:70px;resize:none">${p.description || ''}</textarea></div>
          <div class="form-group">
            <label>Availability</label>
            <select id="editProdAvail">
              <option value="1" ${p.is_available ? 'selected' : ''}>✅ Available</option>
              <option value="0" ${!p.is_available ? 'selected' : ''}>❌ Sold Out</option>
            </select>
          </div>
        </div>
        <div style="display:flex;gap:10px">
          <button onclick="updateProduct(${p.id})" style="flex:2;padding:12px;background:linear-gradient(135deg,#2d7a31,#3a9e40);color:white;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-size:.9rem;font-family:'DM Sans',sans-serif">💾 Save Changes</button>
          <button onclick="confirmDeleteProduct(${p.id},'${p.name.replace(/'/g,"\\'")}');closeModal('orderModal')" style="flex:1;padding:12px;background:#fee2e2;color:#991b1b;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-size:.9rem;font-family:'DM Sans',sans-serif">🗑️ Delete</button>
        </div>`;
    } else if (isFarmer && !isOwn) {
      actionHTML = `
        <div style="background:#f0fdf4;border-radius:10px;padding:14px;margin-bottom:14px">
          <p style="font-size:.88rem;color:#166534;font-weight:500">This listing is from a fellow farmer. You can chat with them about bulk deals or partnerships.</p>
        </div>
        <button onclick="startChatAndGo(${p.farmer_id})" style="width:100%;padding:12px;background:linear-gradient(135deg,#2d7a31,#3a9e40);color:white;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-size:.9rem;font-family:'DM Sans',sans-serif">💬 Chat with Farmer</button>`;
    } else {
      actionHTML = `<button onclick="showPage('auth')" style="width:100%;padding:12px;background:#2d7a31;color:white;border:none;border-radius:10px;font-weight:700;cursor:pointer">Login to Order</button>`;
    }

    document.getElementById('orderModalBody').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start">
        <div>
          <div style="height:220px;border-radius:14px;overflow:hidden;margin-bottom:14px">${imageHTML}</div>
          <div style="background:#f9fafb;border-radius:10px;padding:12px">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
              <div style="width:36px;height:36px;border-radius:50%;background:#255c28;color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.85rem;flex-shrink:0">${(p.farmer_name||'F')[0]}</div>
              <div>
                <div style="font-weight:700;font-size:.88rem">${p.farmer_name || 'Farmer'}</div>
                <div style="font-size:.75rem;color:#6b7280">${p.farmer_verified ? '✅ Verified Seller' : 'Seller'}</div>
              </div>
            </div>
            <div style="font-size:.8rem;color:#f59e0b;margin-bottom:4px">${stars} <span style="color:#6b7280">(${p.farmer_reviews || 0} reviews)</span></div>
            <div style="font-size:.78rem;color:#6b7280">📍 ${p.state || '—'}</div>
          </div>
        </div>
        <div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">
            <span style="background:#e8f5e9;color:#2d7a31;padding:3px 10px;border-radius:20px;font-size:.72rem;font-weight:700">${p.category}</span>
            ${p.harvest_date ? `<span style="background:#fef3c7;color:#92400e;padding:3px 10px;border-radius:20px;font-size:.72rem;font-weight:600">🌾 Harvested: ${formatDate(p.harvest_date)}</span>` : ''}
          </div>
          <h2 style="font-family:'Playfair Display',serif;font-size:1.5rem;font-weight:700;color:#111827;margin-bottom:6px">${p.name}</h2>
          <div style="font-family:'Space Mono',monospace;font-size:1.8rem;font-weight:700;color:#2d7a31;margin-bottom:4px">₹${p.price.toLocaleString()}<small style="font-size:.8rem;font-weight:400;color:#6b7280">/${p.unit}</small></div>
          <div style="font-size:.82rem;color:#6b7280;margin-bottom:12px">Available: <strong style="color:#111827">${p.quantity} ${p.unit}</strong> ${p.is_available ? '<span style="color:#16a34a">● In Stock</span>' : '<span style="color:#ef4444">● Out of Stock</span>'}</div>
          ${p.description ? `<div style="font-size:.85rem;color:#374151;line-height:1.6;background:#f9fafb;padding:10px 12px;border-radius:8px;border-left:3px solid #3a9e40;margin-bottom:14px">${p.description}</div>` : ''}
          ${actionHTML}
        </div>
      </div>`;
    window._modalMaxQty = p.quantity;
    window._modalPricePerUnit = p.price;
    window._modalQty = 1;
    showModal('orderModal');
    loadProductReviews(p.id);
  } catch (err) {
    toast('Failed to load product', 'error');
  }
}

function changeModalQty(delta, price) {
  window._modalQty = Math.max(1, Math.min(window._modalMaxQty || 999, (window._modalQty || 1) + delta));
  const qtyEl = document.getElementById('modalQty');
  const totalEl = document.getElementById('modalTotal');
  if (qtyEl) qtyEl.textContent = window._modalQty;
  if (totalEl) totalEl.textContent = '₹' + (window._modalQty * price).toLocaleString();
}

function selectPay(el, method) {
  document.querySelectorAll('.pay-opt').forEach(o => o.classList.remove('active'));
  el.classList.add('active');
  selectedPayMethod = method;
}

async function placeOrderFromModal(productId, farmerId, price, maxQty) {
  if (!currentUser) { showPage('auth'); return; }
  const qty = window._modalQty || 1;
  const addr = document.getElementById('modalDeliveryAddr')?.value.trim();
  if (!addr) { toast('Please enter delivery address', 'error'); return; }
  await doPlaceOrder(productId, qty, addr);
}

async function doPlaceOrder(productId, quantity, deliveryAddress) {
  try {
    const orderRes = await orderAPI.place({ product_id: productId, quantity, delivery_address: deliveryAddress, payment_method: selectedPayMethod });
    const ourOrderId = orderRes.order.id;
    if (selectedPayMethod !== 'cash') {
      await openRazorpay(ourOrderId);
    } else {
      closeModal('orderModal');
      toast(`Order #${ourOrderId} placed! Pay on delivery 🎉`, 'success');
      showPage('orders');
    }
  } catch (err) {
    toast(err.message || 'Order failed', 'error');
  }
}

async function openRazorpay(ourOrderId, description = `Order #${ourOrderId}`) {
  try {
    const rzpRes = await paymentAPI.createOrder(ourOrderId);
    const options = {
      key: rzpRes.key_id,
      amount: rzpRes.amount,
      currency: rzpRes.currency,
      name: 'AgriConnect',
      description,
      order_id: rzpRes.razorpay_order_id,
      prefill: rzpRes.prefill,
      theme: { color: '#3a9e40' },
      handler: async function (response) {
        try {
          await paymentAPI.verify({ razorpay_order_id: response.razorpay_order_id, razorpay_payment_id: response.razorpay_payment_id, razorpay_signature: response.razorpay_signature, order_id: ourOrderId });
          closeModal('orderModal');
          toast(`Payment successful! 🎉`, 'success');
          showPage('orders');
        } catch (err) {
          toast('Payment verification failed. Contact support.', 'error');
        }
      },
      modal: { ondismiss: () => toast('Payment cancelled', '') },
    };
    const loadRzp = () => new window.Razorpay(options).open();
    if (!window.Razorpay) {
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.onload = loadRzp;
      document.body.appendChild(s);
    } else {
      loadRzp();
    }
  } catch (err) {
    toast(err.message || 'Payment setup failed', 'error');
  }
}

async function loadProductReviews(productId) {
  try {
    const res = await reviewAPI.getByProduct(productId);
    const reviews = res.reviews || [];
    const stats   = res.stats   || {};
    const countEl = document.getElementById('productReviewCount');
    if (countEl) countEl.textContent = `(${stats.total||0} · avg ${stats.average||'—'}★)`;
    const listEl = document.getElementById('productReviewsList');
    if (!listEl) return;
    if (!reviews.length) {
      listEl.innerHTML = `<div style="text-align:center;color:#9ca3af;font-size:.82rem;padding:16px">No reviews yet. Be the first!</div>`;
      return;
    }
    listEl.innerHTML = reviews.map(r => `
      <div style="border-top:1px solid #f3f4f6;padding:12px 0">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <div style="width:28px;height:28px;border-radius:50%;background:#255c28;color:white;display:flex;align-items:center;justify-content:center;font-size:.72rem;font-weight:700">${r.reviewer_name[0]}</div>
          <span style="font-weight:600;font-size:.85rem">${r.reviewer_name}</span>
          <span style="color:#f59e0b;font-size:.85rem">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</span>
          <span style="font-size:.72rem;color:#9ca3af;margin-left:auto">${timeAgo(r.created_at)}</span>
        </div>
        ${r.comment ? `<div style="font-size:.85rem;color:#4b5563;font-style:italic">"${r.comment}"</div>` : ''}
      </div>`).join('');
  } catch(err) {
    const listEl = document.getElementById('productReviewsList');
    if (listEl) listEl.innerHTML = '';
  }
}

async function loadServiceReviews(serviceId) {
  try {
    const res = await reviewAPI.getByService(serviceId);
    const reviews = res.reviews || [];
    const stats   = res.stats   || {};
    const countEl = document.getElementById('serviceReviewCount');
    if (countEl) countEl.textContent = `(${stats.total||0} · avg ${stats.average||'—'}★)`;
    const listEl = document.getElementById('serviceReviewsList');
    if (!listEl) return;
    if (!reviews.length) {
      listEl.innerHTML = `<div style="text-align:center;color:#9ca3af;font-size:.82rem;padding:16px">No reviews yet. Be the first!</div>`;
      return;
    }
    listEl.innerHTML = reviews.map(r => `
      <div style="border-top:1px solid #f3f4f6;padding:12px 0">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <div style="width:28px;height:28px;border-radius:50%;background:#255c28;color:white;display:flex;align-items:center;justify-content:center;font-size:.72rem;font-weight:700">${r.reviewer_name ? r.reviewer_name[0] : 'U'}</div>
          <span style="font-weight:600;font-size:.85rem">${r.reviewer_name || 'User'}</span>
          <span style="color:#f59e0b;font-size:.85rem">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</span>
          <span style="font-size:.72rem;color:#9ca3af;margin-left:auto">${timeAgo(r.created_at)}</span>
        </div>
        ${r.comment ? `<div style="font-size:.85rem;color:#4b5563;font-style:italic">"${r.comment}"</div>` : ''}
      </div>`).join('');
  } catch(err) {
    const listEl = document.getElementById('serviceReviewsList');
    if (listEl) listEl.innerHTML = '<div style="text-align:center;color:#9ca3af;font-size:.82rem;padding:16px">Could not load reviews.</div>';
  }
}

/* ═══════════════════════════════════════════
   FARMER: UPDATE / DELETE PRODUCT
═══════════════════════════════════════════ */
async function updateProduct(productId) {
  const price = document.getElementById('editProdPrice')?.value;
  const qty = document.getElementById('editProdQty')?.value;
  const desc = document.getElementById('editProdDesc')?.value;
  const avail = document.getElementById('editProdAvail')?.value;
  try {
    await productAPI.update(productId, { price: parseFloat(price), quantity: parseInt(qty), description: desc, is_available: parseInt(avail) });
    closeModal('orderModal');
    toast('Product updated! ✅', 'success');
    loadMarketplace();
  } catch (err) {
    toast(err.message || 'Update failed', 'error');
  }
}

function confirmDeleteProduct(productId, productName) {
  if (confirm(`Delete "${productName}"? This cannot be undone.`)) {
    deleteProduct(productId);
  }
}

async function deleteProduct(productId) {
  try {
    await productAPI.delete(productId);
    toast('Product deleted', 'success');
    closeModal('orderModal');
    loadMarketplace();
  } catch (err) {
    toast(err.message || 'Delete failed', 'error');
  }
}

async function addProduct() {
  if (!currentUser || currentUser.role !== 'farmer') { toast('Only farmers can list products', 'error'); return; }
  const name = document.getElementById('cropName').value.trim();
  const price = document.getElementById('cropPrice').value;
  const qty = document.getElementById('cropQty').value;
  if (!name || !price || !qty) { toast('Please fill all required fields', 'error'); return; }
  const formData = new FormData();
  formData.append('name', name);
  formData.append('category', document.getElementById('cropCat').value);
  formData.append('price', price);
  formData.append('quantity', qty);
  formData.append('unit', document.getElementById('cropUnit').value);
  formData.append('state', document.getElementById('cropState').value);
  formData.append('description', document.getElementById('cropDesc').value);
  formData.append('harvest_date', document.getElementById('cropHarvest').value);
  const imgFile = document.getElementById('cropImage').files[0];
  if (imgFile) formData.append('image', imgFile);
  try {
    const res = await productAPI.create(formData);
    closeModal('addProductModal');
    toast(`${res.product.name} listed! ✅`, 'success');
    filterProducts();
  } catch (err) {
    toast(err.message || 'Failed to list product', 'error');
  }
}

/* ═══════════════════════════════════════════
   SERVICES MODULE
═══════════════════════════════════════════ */
const serviceEmojis = {
  'Tractor / Machinery': '🚜', 'Transportation': '🚚',
  'Labor / Manpower': '👷', 'Irrigation Expert': '💧',
  'Pesticide Spraying': '🌿', 'Soil Testing': '🔬'
};

function updateServiceButtons() {
  const addSvcBtn = document.getElementById('addServiceBtn');
  const postJobBtn = document.getElementById('postJobBtn');
  if (addSvcBtn) addSvcBtn.style.display = currentUser && currentUser.role === 'provider' ? 'block' : 'none';
  if (postJobBtn) postJobBtn.style.display = currentUser && (currentUser.role === 'farmer' || currentUser.role === 'admin') ? 'block' : 'none';
}

function loadServices() {
  renderServicesBanner();
  filterProviders();
  loadJobs();
  updateServiceButtons();
}

function renderServicesBanner() {
  const grid = document.getElementById('serviceGrid');
  if (!grid) return;

  const isProvider = currentUser && currentUser.role === 'provider';
  const isFarmer = currentUser && currentUser.role === 'farmer';

  let bannerHTML = '';

  if (isProvider) {
    bannerHTML = `
      <div class="section-banner" style="background-image:url('https://images.unsplash.com/photo-1530267981375-f0de937f5f13?w=1200&q=80')">
        <div class="section-banner-content">
          <div class="section-banner-tag">🔧 For Providers</div>
          <div class="section-banner-title">List Your Services.<br/><span>Get Hired Today.</span></div>
          <button class="section-banner-btn" onclick="showModal('addServiceModal')">+ Offer a Service</button>
        </div>
      </div>`;
  } else if (isFarmer) {
    bannerHTML = `
      <div class="section-banner" style="background-image:url('https://images.unsplash.com/photo-1590682680695-43b964a3ae17?w=1200&q=80')">
        <div class="section-banner-content">
          <div class="section-banner-tag">🚜 Farm Services</div>
          <div class="section-banner-title">Hire Tractors,<br/><span>Labor & More.</span></div>
          <button class="section-banner-btn" onclick="showModal('postJobModal')">+ Post a Job</button>
        </div>
      </div>`;
  } else {
    bannerHTML = `
      <div class="section-banner" style="background-image:url('https://images.unsplash.com/photo-1592878904946-b3cd8ae243d0?w=1200&q=80')">
        <div class="section-banner-content">
          <div class="section-banner-tag">⚙️ Services Hub</div>
          <div class="section-banner-title">Agricultural<br/><span>Services Near You</span></div>
          <button class="section-banner-btn" onclick="showPage('auth')">Get Started →</button>
        </div>
      </div>`;
  }

  const existing = document.getElementById('servicesBanner');
  if (existing) existing.remove();
  const wrapper = document.createElement('div');
  wrapper.id = 'servicesBanner';
  wrapper.innerHTML = bannerHTML;
  grid.parentNode.insertBefore(wrapper, grid);
}

function switchServiceTab(tab, btn) {
  document.querySelectorAll('.stab').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.service-section').forEach(s => s.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('svc-' + tab).classList.add('active');
}

async function filterProviders() {
  const search = document.getElementById('searchProviders')?.value || '';
  const type = document.getElementById('filterServiceType')?.value || '';
  const grid = document.getElementById('serviceGrid');
  if (grid) grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:#6b7280">Loading...</div>`;
  try {
    const params = {};
    if (search) params.search = search;
    if (type) params.type = type;
    const res = await serviceAPI.getAll(params);
    renderServices(res.services || []);
  } catch (err) {
    if (grid) grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="es-icon">❌</div><h3>Failed to load services</h3></div>`;
  }
}

function renderServices(services) {
  const grid = document.getElementById('serviceGrid');
  if (!grid) return;
  if (!services.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="es-icon">⚙️</div><h3>No services found</h3></div>`;
    return;
  }
  const isFarmer = currentUser && currentUser.role === 'farmer';
  const isProvider = currentUser && currentUser.role === 'provider';

  grid.innerHTML = services.map(s => {
    const provider = { id: s.provider_id, name: s.provider_name || 'Provider', rating: s.rating || 5, total_reviews: s.total_reviews || 0 };
    const stars = '★'.repeat(Math.floor(provider.rating)) + '☆'.repeat(5 - Math.floor(provider.rating));
    const isOwn = currentUser && currentUser.id === s.provider_id;

    const imageArea = s.image_url || s.image
      ? `<img src="${s.image_url || s.image}" style="width:52px;height:52px;object-fit:cover;border-radius:10px;flex-shrink:0;" />`
      : `<div class="sc-icon" style="flex-shrink:0">${serviceEmojis[s.type] || '⚙️'}</div>`;

    let actionButtons = '';
    if (isProvider && isOwn) {
      actionButtons = `
        <button onclick="event.stopPropagation();openManageService(${s.id})" style="flex:2;padding:9px;background:linear-gradient(135deg,#1e4620,#255c28);color:white;border:none;border-radius:8px;font-size:.85rem;font-weight:600;cursor:pointer;white-space:nowrap">⚙️ Manage Service</button>
        <button onclick="event.stopPropagation();confirmDeleteService(${s.id},'${s.title.replace(/'/g,"\\'")}');" style="flex:1;padding:9px;background:#fee2e2;color:#991b1b;border:none;border-radius:8px;font-size:.85rem;font-weight:600;cursor:pointer">🗑️</button>`;
    } else if (isFarmer) {
      actionButtons = `
        <button onclick="event.stopPropagation();openServiceDetailModal(${s.id})" style="flex:1;padding:9px;background:linear-gradient(135deg,#2d7a31,#3a9e40);color:white;border:none;border-radius:8px;font-size:.85rem;font-weight:600;cursor:pointer;white-space:nowrap">👁️ View & Book</button>
        <button onclick="event.stopPropagation();startChatAndGo(${provider.id})" style="padding:9px 12px;background:#e8f5e9;color:#2d7a31;border:none;border-radius:8px;cursor:pointer;font-size:.85rem">💬</button>`;
    } else {
      actionButtons = `
        <button onclick="event.stopPropagation();openServiceDetailModal(${s.id})" style="flex:1;padding:9px;background:linear-gradient(135deg,#2d7a31,#3a9e40);color:white;border:none;border-radius:8px;font-size:.85rem;font-weight:600;cursor:pointer;white-space:nowrap">📋 View Details</button>
        <button onclick="event.stopPropagation();startChatAndGo(${provider.id})" style="padding:9px 12px;background:#e8f5e9;color:#2d7a31;border:none;border-radius:8px;cursor:pointer;font-size:.85rem">💬</button>`;
    }

    // Show promo badge if on_promo
    const promoBadge = s.on_promo && s.discount_pct > 0
      ? `<span style="background:#ef4444;color:white;padding:1px 7px;border-radius:10px;font-size:.65rem;font-weight:700;margin-left:6px">${s.discount_pct}% OFF</span>`
      : '';

    return `
    <div class="service-card" onclick="openServiceDetailModal(${s.id})" style="cursor:pointer;overflow:hidden">
      <div class="sc-header" style="min-width:0">
        <div style="display:flex;gap:12px;align-items:center;min-width:0;flex:1;overflow:hidden">
          ${imageArea}
          <div style="flex:1;min-width:0;overflow:hidden">
            <div class="sc-title" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%">${s.title}</div>
            <div class="sc-provider">
              by <strong style="color:#2d7a31">${provider.name}</strong>
              ${s.provider_verified ? `<span style="background:#dcfce7;color:#166534;padding:1px 6px;border-radius:20px;font-size:.65rem;font-weight:700;margin-left:4px">✅</span>` : ''}
            </div>
          </div>
        </div>
        <span class="sc-badge" style="flex-shrink:0;margin-left:8px;white-space:nowrap">${s.type}</span>
      </div>
      <div class="sc-stars">${stars} <span style="color:#6b7280;font-size:.75rem">(${provider.total_reviews} reviews)</span></div>
      ${s.description ? `<div style="font-size:.82rem;color:#6b7280;line-height:1.5;margin-bottom:10px;background:#f9fafb;padding:10px;border-radius:8px;border-left:2px solid #e5e7eb;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;word-break:break-word">${s.description}</div>` : ''}
      <div class="sc-rate" style="word-break:break-word">
        ${s.on_promo && s.discount_pct > 0
          ? `<span style="text-decoration:line-through;font-size:.8rem;color:#9ca3af">₹${s.rate.toLocaleString()}</span>
             <span style="margin-left:6px;color:#ef4444;font-weight:700">₹${Math.round(s.rate*(1-s.discount_pct/100)).toLocaleString()}</span>${promoBadge}`
          : `₹${s.rate.toLocaleString()}`
        }
        <span style="font-size:.8rem;font-weight:400;color:#6b7280"> / ${s.rate_per}</span>
      </div>
      <div class="sc-location" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">📍 ${s.location || '—'}</div>
      <div style="display:flex;gap:8px;margin-top:12px">${actionButtons}</div>
    </div>`;
  }).join('');
}

/* ═══════════════════════════════════════════
   SERVICE DETAIL MODAL
═══════════════════════════════════════════ */
async function openServiceDetailModal(serviceId) {
  try {
    const res = await serviceAPI.getById(serviceId);
    const s = res.service;
    if (!s) { toast('Service not found', 'error'); return; }

    const isFarmer = currentUser && currentUser.role === 'farmer';
    const isProvider = currentUser && currentUser.role === 'provider';
    const isOwn = currentUser && currentUser.id === s.provider_id;
    const stars = '★'.repeat(Math.floor(s.rating || 5)) + '☆'.repeat(5 - Math.floor(s.rating || 5));

    const imageHTML = s.image_url || s.image
      ? `<img src="${s.image_url || s.image}" style="width:100%;height:100%;object-fit:cover;border-radius:14px;" />`
      : `<div style="width:100%;height:100%;background:linear-gradient(135deg,#e8f5e9,#fef3c7);display:flex;align-items:center;justify-content:center;font-size:5rem;border-radius:14px">${serviceEmojis[s.type] || '⚙️'}</div>`;

    let actionHTML = '';
    if (isFarmer) {
      actionHTML = `
        <div style="background:#f9fafb;border-radius:12px;padding:16px;margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <span style="font-size:.85rem;font-weight:600;color:#374151">Service Rate</span>
            <span style="font-family:'Space Mono',monospace;font-size:1.3rem;font-weight:700;color:#2d7a31">₹${s.rate.toLocaleString()}/${s.rate_per}</span>
          </div>
          <div style="font-size:.78rem;color:#6b7280;background:#e8f5e9;padding:8px;border-radius:6px">Payment will be processed securely via Razorpay</div>
        </div>
        <div class="form-group">
          <label>Duration / Units <span style="color:#9ca3af;font-weight:400">(e.g. 3 for 3 Hours)</span></label>
          <input type="number" id="svcBookUnits" value="1" min="1" oninput="updateSvcTotal(${s.rate})"/>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;background:#f0fdf4;padding:10px 14px;border-radius:8px;margin-bottom:14px">
          <span style="font-size:.85rem;color:#166534;font-weight:600">Estimated Total</span>
          <span id="svcBookTotal" style="font-family:'Space Mono',monospace;font-size:1.2rem;font-weight:700;color:#16a34a">₹${s.rate.toLocaleString()}</span>
        </div>
        <label style="font-size:.85rem;font-weight:600;color:#374151;display:block;margin-bottom:8px">Payment Method</label>
        <div class="payment-methods" style="margin-bottom:14px">
          <div class="pay-opt active" onclick="selectPay(this,'upi')">📱 UPI</div>
          <div class="pay-opt" onclick="selectPay(this,'card')">💳 Card</div>
          <div class="pay-opt" onclick="selectPay(this,'cash')">💵 Cash</div>
        </div>
        <div style="display:flex;gap:10px">
          <button onclick="bookService(${s.id},${s.rate},'${s.title.replace(/'/g,"\\'")}','${s.provider_id}')" style="flex:2;padding:12px;background:linear-gradient(135deg,#2d7a31,#3a9e40);color:white;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-size:.9rem;font-family:'DM Sans',sans-serif">⚡ Book &amp; Pay</button>
          <button onclick="startChatAndGo(${s.provider_id})" style="flex:1;padding:12px;background:#e8f5e9;color:#2d7a31;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-size:.9rem;font-family:'DM Sans',sans-serif">💬 Chat</button>
        </div>
        <button onclick="openSubmitReview({reviewed_id:${s.provider_id},service_id:${s.id},type:'service',name:'${(s.title||'').replace(/'/g,"\\'")}'})" style="width:100%;margin-top:10px;padding:11px;background:white;border:2px solid #f59e0b;border-radius:10px;color:#92400e;font-weight:700;font-size:.9rem;cursor:pointer;font-family:'DM Sans',sans-serif">⭐ Write a Review</button>
        <div style="margin-top:16px">
          <div style="font-weight:700;font-size:.9rem;color:#374151;margin-bottom:10px">Reviews <span id="serviceReviewCount" style="color:#9ca3af;font-weight:400"></span></div>
          <div id="serviceReviewsList"><div style="text-align:center;color:#9ca3af;font-size:.82rem;padding:16px">Loading reviews...</div></div>
        </div>`;
    } else if (isProvider && isOwn) {
      actionHTML = `
        <div style="background:#fef3c7;border-radius:10px;padding:14px;margin-bottom:12px">
          <p style="font-size:.88rem;color:#92400e;font-weight:500">This is your own service listing.</p>
        </div>
        <button onclick="closeModal('svcDetailModal');openManageService(${s.id})" style="width:100%;padding:12px;background:linear-gradient(135deg,#1e4620,#255c28);color:white;border:none;border-radius:10px;font-weight:700;cursor:pointer">⚙️ Manage This Service</button>`;
    } else if (isProvider && !isOwn) {
      actionHTML = `
        <div style="background:#f0fdf4;border-radius:10px;padding:14px;margin-bottom:12px">
          <p style="font-size:.88rem;color:#166534;font-weight:500">This service is offered by another provider.</p>
        </div>
        <button onclick="startChatAndGo(${s.provider_id})" style="width:100%;padding:12px;background:linear-gradient(135deg,#2d7a31,#3a9e40);color:white;border:none;border-radius:10px;font-weight:700;cursor:pointer">💬 Chat with Provider</button>`;
    } else {
      actionHTML = `<button onclick="showPage('auth')" style="width:100%;padding:12px;background:#2d7a31;color:white;border:none;border-radius:10px;font-weight:700;cursor:pointer">Login to Book</button>`;
    }

    document.getElementById('svcDetailModalBody').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start">
        <div>
          <div style="height:220px;border-radius:14px;overflow:hidden;margin-bottom:14px">${imageHTML}</div>
          <div style="background:#f9fafb;border-radius:10px;padding:12px">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
              <div style="width:36px;height:36px;border-radius:50%;background:#255c28;color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.85rem;flex-shrink:0">${(s.provider_name||'P')[0]}</div>
              <div>
                <div style="font-weight:700;font-size:.88rem">${s.provider_name || 'Provider'}</div>
                <div style="font-size:.75rem;color:#6b7280">${s.provider_verified ? '✅ Verified Provider' : 'Service Provider'}</div>
              </div>
            </div>
            <div style="font-size:.8rem;color:#f59e0b;margin-bottom:4px">${stars} <span style="color:#6b7280">(${s.total_reviews || 0} reviews)</span></div>
            <div style="font-size:.78rem;color:#6b7280">📍 ${s.location || '—'}</div>
          </div>
        </div>
        <div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
            <span style="background:#fef3c7;color:#92400e;padding:3px 10px;border-radius:20px;font-size:.72rem;font-weight:700">${s.type}</span>
            ${s.is_available
              ? `<span style="background:#dcfce7;color:#166534;padding:3px 10px;border-radius:20px;font-size:.72rem;font-weight:700">✅ Available</span>`
              : `<span style="background:#fee2e2;color:#991b1b;padding:3px 10px;border-radius:20px;font-size:.72rem;font-weight:700">❌ Unavailable</span>`}
            ${s.on_promo ? `<span style="background:#fef3c7;color:#92400e;padding:3px 10px;border-radius:20px;font-size:.72rem;font-weight:700">🏷️ On Promo</span>` : ''}
          </div>
          <h2 style="font-family:'Playfair Display',serif;font-size:1.4rem;font-weight:700;color:#111827;margin-bottom:8px;word-break:break-word">${s.title}</h2>
          <div style="font-family:'Space Mono',monospace;font-size:1.8rem;font-weight:700;color:#2d7a31;margin-bottom:4px">
            ${s.on_promo && s.discount_pct > 0
              ? `<span style="text-decoration:line-through;font-size:1rem;color:#9ca3af;font-weight:400">₹${s.rate.toLocaleString()}</span>
                 <span style="margin-left:8px">₹${Math.round(s.rate*(1-s.discount_pct/100)).toLocaleString()}</span>
                 <span style="background:#ef4444;color:white;padding:2px 8px;border-radius:20px;font-size:.65rem;margin-left:8px">${s.discount_pct}% OFF</span>`
              : `₹${s.rate.toLocaleString()}`}
            <small style="font-size:.8rem;font-weight:400;color:#6b7280">/${s.rate_per}</small>
          </div>
          ${s.description ? `<div style="font-size:.85rem;color:#374151;line-height:1.6;background:#f9fafb;padding:10px 12px;border-radius:8px;border-left:3px solid #3a9e40;margin-bottom:14px;word-break:break-word">${s.description}</div>` : ''}
          ${actionHTML}
        </div>
      </div>`;
    showModal('svcDetailModal');
    loadServiceReviews(s.id);
  } catch (err) {
    toast('Failed to load service', 'error');
  }
}

function updateSvcTotal(rate) {
  const units = parseInt(document.getElementById('svcBookUnits')?.value) || 1;
  const totalEl = document.getElementById('svcBookTotal');
  if (totalEl) totalEl.textContent = '₹' + (units * rate).toLocaleString();
}

async function bookService(serviceId, rate, title, providerId) {
  if (!currentUser) { showPage('auth'); return; }
  const units = parseInt(document.getElementById('svcBookUnits')?.value) || 1;
  const total = units * rate;

  if (selectedPayMethod !== 'cash') {
    toast('Processing payment...', '');
    try {
      const options = {
        key: 'rzp_test_Sa3UpO1fmklpdB',
        amount: total * 100,
        currency: 'INR',
        name: 'AgriConnect',
        description: `Service: ${title} × ${units} ${rate > 0 ? 'units' : ''}`,
        prefill: { name: currentUser.name, email: currentUser.email || '' },
        theme: { color: '#3a9e40' },
        handler: async function (response) {
          closeModal('svcDetailModal');
          toast(`Service booked! Payment ID: ${response.razorpay_payment_id} ✅`, 'success');
          startChatAndGo(parseInt(providerId));
        },
        modal: { ondismiss: () => toast('Payment cancelled', '') },
      };
      const loadRzp = () => new window.Razorpay(options).open();
      if (!window.Razorpay) {
        const sc = document.createElement('script');
        sc.src = 'https://checkout.razorpay.com/v1/checkout.js';
        sc.onload = loadRzp;
        document.body.appendChild(sc);
      } else {
        loadRzp();
      }
    } catch (err) {
      toast(err.message || 'Booking failed', 'error');
    }
  } else {
    closeModal('svcDetailModal');
    toast(`Service booked! Pay ₹${total.toLocaleString()} on delivery 🎉`, 'success');
    startChatAndGo(parseInt(providerId));
  }
}

/* ═══════════════════════════════════════════
   PROVIDER: MANAGE SERVICE MODAL
   ── Mirrors farmer openManageProduct exactly
   ── Status: Available · On Promo · Unavailable
   ── Promo: discount % + live price preview
   ── Save refreshes dashboard + service grid
═══════════════════════════════════════════ */
async function openManageService(serviceId) {
  try {
    const res = await serviceAPI.getById(serviceId);
    const s   = res.service;
    if (!s) { toast('Service not found', 'error'); return; }

    const currentStatus = s.on_promo ? 'on_promo' : (s.is_available ? 'available' : 'unavailable');

    document.getElementById('manageServiceBody').innerHTML = `
      <!-- Service Info Header -->
      <div style="background:#e8f5e9;border-radius:12px;padding:16px;margin-bottom:20px;display:flex;align-items:center;gap:14px">
        ${s.image_url || s.image
          ? `<img src="${s.image_url||s.image}" style="width:64px;height:64px;object-fit:cover;border-radius:10px;flex-shrink:0"/>`
          : `<div style="width:64px;height:64px;background:#e8f5e9;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:2.5rem;flex-shrink:0">${serviceEmojis[s.type]||'⚙️'}</div>`}
        <div>
          <div style="font-size:1.1rem;font-weight:700;color:#111827">${s.title}</div>
          <div style="font-size:.85rem;color:#6b7280">${s.type} · ₹${s.rate.toLocaleString()}/${s.rate_per} · ${s.location||'—'}</div>
        </div>
      </div>

      <!-- STATUS CARDS -->
      <div style="background:white;border:1.5px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:16px">
        <div style="font-size:.9rem;font-weight:700;color:#374151;margin-bottom:14px">📋 Service Status</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px" id="svcStatusOptions">

          <div class="svc-status-opt"
               onclick="selectManageSvcStatus(this,'available')"
               style="border:2px solid ${currentStatus==='available'?'#3a9e40':'#e5e7eb'};border-radius:10px;padding:14px;text-align:center;cursor:pointer;transition:all .2s;background:${currentStatus==='available'?'#e8f5e9':'white'}">
            <div style="font-size:1.6rem;margin-bottom:6px">✅</div>
            <div style="font-weight:700;font-size:.9rem;color:#111827">Available</div>
            <div style="font-size:.75rem;color:#6b7280;margin-top:3px">Listed for hire</div>
          </div>

          <div class="svc-status-opt"
               onclick="selectManageSvcStatus(this,'on_promo')"
               style="border:2px solid ${currentStatus==='on_promo'?'#f59e0b':'#e5e7eb'};border-radius:10px;padding:14px;text-align:center;cursor:pointer;transition:all .2s;background:${currentStatus==='on_promo'?'#fef3c7':'white'}">
            <div style="font-size:1.6rem;margin-bottom:6px">🏷️</div>
            <div style="font-weight:700;font-size:.9rem;color:#111827">On Promo</div>
            <div style="font-size:.75rem;color:#6b7280;margin-top:3px">Special offer</div>
          </div>

          <div class="svc-status-opt"
               onclick="selectManageSvcStatus(this,'unavailable')"
               style="border:2px solid ${currentStatus==='unavailable'?'#ef4444':'#e5e7eb'};border-radius:10px;padding:14px;text-align:center;cursor:pointer;transition:all .2s;background:${currentStatus==='unavailable'?'#fee2e2':'white'}">
            <div style="font-size:1.6rem;margin-bottom:6px">❌</div>
            <div style="font-weight:700;font-size:.9rem;color:#111827">Unavailable</div>
            <div style="font-size:.75rem;color:#6b7280;margin-top:3px">Hide from market</div>
          </div>

        </div>
      </div>

      <!-- PROMO SECTION (shows only when On Promo selected) -->
      <div id="svcPromoSection" style="display:${currentStatus==='on_promo'?'block':'none'};background:white;border:1.5px solid #fbbf24;border-radius:12px;padding:20px;margin-bottom:16px">
        <div style="font-size:.9rem;font-weight:700;color:#374151;margin-bottom:14px">🏷️ Promo Settings</div>
        <div class="form-row">
          <div class="form-group">
            <label>Discount %</label>
            <input type="number" id="svcDiscountPct" min="1" max="80" value="${s.discount_pct||10}"
                   placeholder="e.g. 20" oninput="updateSvcPromoPreview(${s.rate})"/>
          </div>
          <div class="form-group">
            <label>Promo Ends On</label>
            <input type="date" id="svcPromoEndsAt" value="${s.promo_ends_at||''}"/>
          </div>
        </div>
        <div id="svcPromoPreview" style="background:#fef3c7;border-radius:8px;padding:12px;margin-top:8px">
          <span style="font-size:.85rem;color:#92400e">
            Original: <strong>₹${s.rate.toLocaleString()}/${s.rate_per}</strong> →
            Promo Rate: <strong id="svcSalePriceDisplay">₹${Math.round(s.rate*(1-(s.discount_pct||10)/100)).toLocaleString()}/${s.rate_per}</strong>
            <span style="background:#ef4444;color:white;padding:2px 8px;border-radius:20px;font-size:.75rem;margin-left:8px" id="svcPromoOffBadge">${s.discount_pct||10}% OFF</span>
          </span>
        </div>
      </div>

      <!-- EDIT DETAILS -->
      <div style="background:white;border:1.5px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:16px">
        <div style="font-size:.9rem;font-weight:700;color:#374151;margin-bottom:14px">✏️ Update Details</div>
        <div class="form-row">
          <div class="form-group">
            <label>Rate (₹)</label>
            <input type="number" id="manageSvcRate" value="${s.rate}" placeholder="Current rate"/>
          </div>
          <div class="form-group">
            <label>Rate Per</label>
            <select id="manageSvcPer">
              ${['Hour','Day','Acre','Trip','Fixed'].map(u=>`<option ${u===s.rate_per?'selected':''}>${u}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Location</label>
          <input type="text" id="manageSvcLocation" value="${s.location||''}" placeholder="District, State"/>
        </div>
        <div class="form-group">
          <label>Description / Notes</label>
          <textarea id="manageSvcDesc" style="height:80px">${s.description||''}</textarea>
        </div>
      </div>

      <!-- ACTION BUTTONS -->
      <div style="display:flex;gap:10px">
        <button class="btn-auth" style="flex:1" onclick="saveManageService(${s.id},${s.rate})">
          💾 Save Changes
        </button>
        <button onclick="confirmDeleteService(${s.id},'${s.title.replace(/'/g,"\\'")}')"
                style="padding:14px 20px;background:white;color:#ef4444;border:2px solid #ef4444;border-radius:10px;font-size:.9rem;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif">
          🗑️ Delete
        </button>
      </div>`;

    window._manageSvcStatus = currentStatus;
    showModal('manageServiceModal');

  } catch (err) {
    toast(err.message || 'Failed to load service', 'error');
  }
}

/* ── Status card selection ─────────────────────────────────── */
function selectManageSvcStatus(el, status) {
  document.querySelectorAll('.svc-status-opt').forEach(o => {
    o.style.border     = '2px solid #e5e7eb';
    o.style.background = 'white';
  });
  const colors = {
    available:   { border: '#3a9e40', bg: '#e8f5e9' },
    on_promo:    { border: '#f59e0b', bg: '#fef3c7' },
    unavailable: { border: '#ef4444', bg: '#fee2e2' },
  };
  el.style.border     = `2px solid ${colors[status].border}`;
  el.style.background = colors[status].bg;
  window._manageSvcStatus = status;
  const ps = document.getElementById('svcPromoSection');
  if (ps) ps.style.display = status === 'on_promo' ? 'block' : 'none';
}

/* ── Live promo preview ────────────────────────────────────── */
function updateSvcPromoPreview(originalRate) {
  const pct      = parseFloat(document.getElementById('svcDiscountPct')?.value) || 0;
  const ratePer  = document.getElementById('manageSvcPer')?.value || '';
  const promoRate = Math.round(originalRate * (1 - pct / 100));
  const display  = document.getElementById('svcSalePriceDisplay');
  const badge    = document.getElementById('svcPromoOffBadge');
  if (display) display.textContent = `₹${promoRate.toLocaleString()}/${ratePer}`;
  if (badge)   badge.textContent   = `${pct}% OFF`;
}

/* ── Save changes ──────────────────────────────────────────── */
async function saveManageService(serviceId, originalRate) {
  const status      = window._manageSvcStatus || 'available';
  const rate        = document.getElementById('manageSvcRate')?.value;
  const ratePer     = document.getElementById('manageSvcPer')?.value;
  const location    = document.getElementById('manageSvcLocation')?.value;
  const desc        = document.getElementById('manageSvcDesc')?.value;
  const discountPct = parseFloat(document.getElementById('svcDiscountPct')?.value) || 0;
  const promoEndsAt = document.getElementById('svcPromoEndsAt')?.value;

  const payload = {
    rate:         rate    ? parseFloat(rate) : undefined,
    rate_per:     ratePer || undefined,
    location:     location !== undefined ? location : undefined,
    description:  desc    !== undefined  ? desc     : undefined,
    is_available: status !== 'unavailable' ? 1 : 0,
    on_promo:     status === 'on_promo'    ? 1 : 0,
    discount_pct: status === 'on_promo'    ? discountPct : 0,
    promo_ends_at: status === 'on_promo'   ? (promoEndsAt || null) : null,
  };

  try {
    await serviceAPI.update(serviceId, payload);
    closeModal('manageServiceModal');

    const statusMsg = {
      available:   'Service is now Active ✅',
      on_promo:    `Promo applied! ${discountPct}% OFF 🏷️`,
      unavailable: 'Service marked as Unavailable ❌',
    };
    toast(statusMsg[status], 'success');

    // Real-time: refresh both dashboard table AND marketplace service grid
    loadDashboard();
    filterProviders();

  } catch (err) {
    toast(err.message || 'Failed to save changes', 'error');
  }
}

/* ── Keep old openServiceManageModal as alias (no-op fallback) ─ */
async function openServiceManageModal(serviceId) {
  openManageService(serviceId);
}

function confirmDeleteService(serviceId, serviceTitle) {
  if (confirm(`Delete "${serviceTitle}"? This cannot be undone.`)) {
    deleteService(serviceId);
  }
}

async function deleteService(serviceId) {
  try {
    await serviceAPI.delete(serviceId);
    toast('Service deleted', 'success');
    closeModal('manageServiceModal');
    closeModal('svcDetailModal');
    loadDashboard();
    filterProviders();
  } catch (err) {
    toast(err.message || 'Delete failed', 'error');
  }
}

async function updateService(serviceId) {
  const rate = document.getElementById('editSvcRate')?.value;
  const ratePer = document.getElementById('editSvcPer')?.value;
  const location = document.getElementById('editSvcLoc')?.value;
  const description = document.getElementById('editSvcDesc')?.value;
  const isAvailable = document.getElementById('editSvcAvail')?.value;
  try {
    await serviceAPI.update(serviceId, { rate: parseFloat(rate), rate_per: ratePer, location, description, is_available: parseInt(isAvailable) });
    closeModal('svcDetailModal');
    toast('Service updated! ✅', 'success');
    filterProviders();
  } catch (err) {
    toast(err.message || 'Update failed', 'error');
  }
}

async function hireService(serviceId) {
  if (!currentUser) { showPage('auth'); return; }
  openServiceDetailModal(serviceId);
}

async function addService() {
  if (!currentUser || currentUser.role !== 'provider') { toast('Only service providers can list services', 'error'); return; }
  const title = document.getElementById('svcTitle').value.trim();
  const rate = document.getElementById('svcRate').value;
  if (!title || !rate) { toast('Please fill title and rate', 'error'); return; }
  const formData = new FormData();
  formData.append('title', title);
  formData.append('type', document.getElementById('svcType').value);
  formData.append('rate', rate);
  formData.append('rate_per', document.getElementById('svcPer').value);
  formData.append('location', document.getElementById('svcLocation').value);
  formData.append('description', document.getElementById('svcDesc').value);
  const imgFile = document.getElementById('svcImage').files[0];
  if (imgFile) formData.append('image', imgFile);
  try {
    await serviceAPI.create(formData);
    closeModal('addServiceModal');
    toast('Service listed! ✅', 'success');
    filterProviders();
  } catch (err) {
    toast(err.message || 'Failed to list service', 'error');
  }
}

/* ═══════════════════════════════════════════
   JOBS
═══════════════════════════════════════════ */
async function loadJobs() {
  const grid = document.getElementById('jobsGrid');
  if (!grid) return;
  try {
    const res = await jobAPI.getAll();
    const jobs = res.jobs || [];
    if (!jobs.length) {
      grid.innerHTML = `<div class="empty-state"><div class="es-icon">📋</div><h3>No jobs posted</h3><p>Post a job to receive bids from service providers</p></div>`;
      return;
    }
    grid.innerHTML = jobs.map(j => `
      <div class="job-card">
        <div class="job-icon">${serviceEmojis[j.type]||'⚙️'}</div>
        <div class="job-info">
          <div class="job-title">${j.title}</div>
          <div class="job-meta">
            <span class="job-tag">${j.type}</span>
            ${j.location ? `<span class="job-tag">📍 ${j.location}</span>` : ''}
            ${j.required_by ? `<span class="job-tag">📅 ${formatDate(j.required_by)}</span>` : ''}
            <span class="job-tag">${j.bid_count || 0} bids</span>
          </div>
          <div class="job-desc">${j.description || ''}</div>
        </div>
        <div class="job-actions">
          <div class="job-budget">₹${(j.budget||0).toLocaleString()}</div>
          ${currentUser && currentUser.role === 'provider' ? `<button class="btn-bid" onclick="openBid(${j.id})">Place Bid</button>` : ''}
          ${currentUser && currentUser.id === j.farmer_id ? `<button class="btn-bid" style="background:#1e4620" onclick="viewJobBids(${j.id})">View Bids</button>` : ''}
        </div>
      </div>`).join('');
  } catch (err) {
    grid.innerHTML = `<div class="empty-state"><div class="es-icon">❌</div><h3>Failed to load jobs</h3></div>`;
  }
}

async function postJob() {
  if (!currentUser) { showPage('auth'); return; }
  const title = document.getElementById('jobTitle').value.trim();
  const budget = parseFloat(document.getElementById('jobBudget').value);
  if (!title || !budget) { toast('Please fill title and budget', 'error'); return; }
  try {
    const res = await jobAPI.create({ title, type: document.getElementById('jobType').value, budget, location: document.getElementById('jobLocation').value, required_by: document.getElementById('jobDate').value, description: document.getElementById('jobDesc').value });
    closeModal('postJobModal');
    toast(`Job posted! #${res.job.id} 📋`, 'success');
    loadJobs();
  } catch (err) {
    toast(err.message || 'Failed to post job', 'error');
  }
}

async function openBid(jobId) {
  if (!currentUser) { showPage('auth'); return; }
  let job = null;
  try {
    const res = await jobAPI.getAll();
    job = (res.jobs || []).find(j => j.id === jobId);
  } catch (err) { toast('Failed to load job', 'error'); return; }
  if (!job) { toast('Job not found', 'error'); return; }
  document.getElementById('bidModalBody').innerHTML = `
    <div class="bid-job-info"><h4>${job.title}</h4><p>${job.description||''}</p><p style="margin-top:8px;font-weight:700;color:#2d7a31">Budget: ₹${(job.budget||0).toLocaleString()}</p></div>
    <div class="form-group"><label>Your Bid Amount (₹)</label><input type="number" id="bidAmount" value="${job.budget}"/></div>
    <div class="form-group"><label>Proposal Message</label><textarea id="bidMessage" placeholder="Explain your experience and timeline..."></textarea></div>
    <button class="btn-auth" onclick="submitBid(${jobId})">Submit Bid →</button>`;
  showModal('bidModal');
}

async function submitBid(jobId) {
  const amount = parseFloat(document.getElementById('bidAmount').value);
  const message = document.getElementById('bidMessage').value.trim();
  if (!amount || !message) { toast('Please fill all fields', 'error'); return; }
  try {
    await jobAPI.submitBid(jobId, { amount, message });
    closeModal('bidModal');
    toast('Bid submitted! 🎯', 'success');
    loadJobs();
  } catch (err) {
    toast(err.message || 'Failed to submit bid', 'error');
  }
}

function viewJobBids(jobId) {
  toast('Bids view coming soon', '');
}

/* ═══════════════════════════════════════════
   CART PAGE
═══════════════════════════════════════════ */
async function loadCartPage() {
  const cartEl = document.getElementById('cartContent');
  if (!cartEl) return;

  if (!currentUser || currentUser.role !== 'buyer') {
    cartEl.innerHTML = `<div class="empty-state"><div class="es-icon">🔐</div><h3>Buyers Only</h3><p>Please login as a buyer to use the cart</p><button class="btn-primary" style="margin-top:20px" onclick="showPage('auth')">Login</button></div>`;
    return;
  }

  cartEl.innerHTML = `<div style="text-align:center;padding:60px;color:#6b7280">Loading cart...</div>`;

  try {
    const res = await cartAPI.get();
    const items = res.items || [];

    if (!items.length) {
      cartEl.innerHTML = `
        <div class="empty-state">
          <div class="es-icon">🛒</div>
          <h3>Your cart is empty</h3>
          <p>Browse the marketplace and add some fresh produce!</p>
          <button class="btn-primary" style="margin-top:20px" onclick="showPage('marketplace')">Browse Market</button>
        </div>`;
      return;
    }

    const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const deliveryCharge = subtotal > 200 ? 0 : 50;
    const total = subtotal + deliveryCharge;

    cartEl.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 380px;gap:24px;padding:24px;max-width:1200px;margin:0 auto">
        <div>
          <div style="background:white;border-radius:16px;padding:20px;box-shadow:0 1px 4px rgba(0,0,0,.06);margin-bottom:16px">
            <h3 style="font-family:'Playfair Display',serif;font-size:1.1rem;font-weight:700;margin-bottom:4px">Shopping Cart</h3>
            <p style="font-size:.82rem;color:#6b7280">${items.length} item${items.length !== 1 ? 's' : ''} · from ${[...new Set(items.map(i => i.farmer_name))].length} seller${[...new Set(items.map(i => i.farmer_name))].length !== 1 ? 's' : ''}</p>
          </div>
          ${items.map(i => `
          <div style="background:white;border-radius:14px;padding:16px;margin-bottom:12px;box-shadow:0 1px 4px rgba(0,0,0,.06);display:flex;gap:14px;align-items:center;border:1px solid #f3f4f6">
            <div style="width:80px;height:80px;border-radius:10px;overflow:hidden;flex-shrink:0;background:linear-gradient(135deg,#e8f5e9,#fef3c7);display:flex;align-items:center;justify-content:center">
              ${i.image_url ? `<img src="${i.image_url}" style="width:100%;height:100%;object-fit:cover"/>` : `<span style="font-size:2.2rem">${cropEmojis[i.category]||'🌾'}</span>`}
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-weight:700;font-size:.95rem;margin-bottom:2px">${i.name}</div>
              <div style="font-size:.78rem;color:#6b7280;margin-bottom:8px">👨‍🌾 ${i.farmer_name} · 📍 ${i.state||'—'}</div>
              <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
                <span style="font-family:'Space Mono',monospace;font-size:.95rem;font-weight:700;color:#2d7a31">₹${i.price.toLocaleString()}/${i.unit}</span>
                <div style="display:flex;align-items:center;gap:6px;background:#f3f4f6;border-radius:8px;padding:4px 8px">
                  <button onclick="updateCartQty(${i.cart_item_id},${i.quantity-1})" style="background:none;border:none;cursor:pointer;font-size:1rem;color:#374151;width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-weight:700">−</button>
                  <span style="font-size:.88rem;font-weight:700;min-width:20px;text-align:center">${i.quantity}</span>
                  <button onclick="updateCartQty(${i.cart_item_id},${i.quantity+1})" style="background:none;border:none;cursor:pointer;font-size:1rem;color:#374151;width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-weight:700">+</button>
                </div>
                <button onclick="removeCartItem(${i.cart_item_id})" style="background:none;border:none;cursor:pointer;color:#ef4444;font-size:.8rem;font-weight:600;padding:4px 8px;border-radius:6px;background:#fee2e2">🗑️ Remove</button>
              </div>
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-family:'Space Mono',monospace;font-size:1.1rem;font-weight:700;color:#111827">₹${(i.price * i.quantity).toLocaleString()}</div>
              <div style="font-size:.72rem;color:#9ca3af;margin-top:2px">${i.quantity} × ₹${i.price.toLocaleString()}</div>
            </div>
          </div>`).join('')}
        </div>
        <div>
          <div style="background:white;border-radius:16px;padding:24px;box-shadow:0 4px 16px rgba(0,0,0,.08);position:sticky;top:90px">
            <h3 style="font-family:'Playfair Display',serif;font-size:1.1rem;font-weight:700;margin-bottom:18px">Order Summary</h3>
            <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px">
              <div style="display:flex;justify-content:space-between;font-size:.88rem">
                <span style="color:#6b7280">Subtotal (${items.reduce((s,i)=>s+i.quantity,0)} items)</span>
                <span style="font-weight:600">₹${subtotal.toLocaleString()}</span>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:.88rem">
                <span style="color:#6b7280">Delivery Charges</span>
                <span style="font-weight:600;color:${deliveryCharge===0?'#16a34a':'#111827'}">${deliveryCharge === 0 ? 'FREE' : '₹'+deliveryCharge}</span>
              </div>
              ${deliveryCharge > 0 ? `<div style="font-size:.75rem;color:#6b7280;background:#f9fafb;padding:6px 10px;border-radius:6px">Add ₹${(200-subtotal).toLocaleString()} more for free delivery!</div>` : `<div style="font-size:.75rem;color:#16a34a;background:#f0fdf4;padding:6px 10px;border-radius:6px">🎉 You've unlocked free delivery!</div>`}
            </div>
            <div style="border-top:1px solid #f3f4f6;padding-top:14px;display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
              <span style="font-weight:700;font-size:1rem">Total</span>
              <span style="font-family:'Space Mono',monospace;font-size:1.4rem;font-weight:700;color:#2d7a31">₹${total.toLocaleString()}</span>
            </div>
            <div class="form-group" style="margin-bottom:14px">
              <label>Delivery Address</label>
              <textarea id="cartDeliveryAddr" placeholder="Enter your full delivery address..." style="height:80px;resize:none"></textarea>
            </div>
            <label style="font-size:.85rem;font-weight:600;color:#374151;display:block;margin-bottom:8px">Payment Method</label>
            <div class="payment-methods" style="margin-bottom:16px;grid-template-columns:repeat(3,1fr)">
              <div class="pay-opt active" onclick="selectPay(this,'upi')">📱 UPI</div>
              <div class="pay-opt" onclick="selectPay(this,'card')">💳 Card</div>
              <div class="pay-opt" onclick="selectPay(this,'cash')">💵 Cash</div>
            </div>
            <button onclick="checkoutCart()" style="width:100%;padding:14px;background:linear-gradient(135deg,#f59e0b,#fbbf24);color:#2d1a0a;border:none;border-radius:12px;font-size:1rem;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;box-shadow:0 4px 12px rgba(245,158,11,.3)">
              🛒 Proceed to Checkout · ₹${total.toLocaleString()}
            </button>
            <div style="margin-top:12px;text-align:center">
              <button onclick="clearCart()" style="background:none;border:none;color:#6b7280;font-size:.8rem;cursor:pointer;text-decoration:underline">Clear all items</button>
            </div>
            <div style="margin-top:16px;padding-top:14px;border-top:1px solid #f3f4f6">
              <div style="display:flex;flex-direction:column;gap:6px">
                <div style="display:flex;align-items:center;gap:8px;font-size:.78rem;color:#6b7280"><span style="color:#16a34a">🔒</span> Secure payments via Razorpay</div>
                <div style="display:flex;align-items:center;gap:8px;font-size:.78rem;color:#6b7280"><span style="color:#16a34a">✅</span> Fresh produce guarantee</div>
                <div style="display:flex;align-items:center;gap:8px;font-size:.78rem;color:#6b7280"><span style="color:#16a34a">🔄</span> Easy returns & refunds</div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  } catch (err) {
    cartEl.innerHTML = `<div class="empty-state"><div class="es-icon">❌</div><h3>Failed to load cart</h3><p>${err.message}</p></div>`;
  }
}

async function updateCartQty(cartItemId, newQty) {
  if (newQty < 1) { removeCartItem(cartItemId); return; }
  try {
    await cartAPI.update(cartItemId, newQty);
    loadCartPage();
    updateCartBadge();
  } catch (err) {
    toast(err.message || 'Update failed', 'error');
  }
}

async function removeCartItem(cartItemId) {
  try {
    await cartAPI.remove(cartItemId);
    toast('Item removed', '');
    loadCartPage();
    updateCartBadge();
  } catch (err) {
    toast(err.message || 'Remove failed', 'error');
  }
}

async function clearCart() {
  if (!confirm('Remove all items from cart?')) return;
  try {
    await apiFetch('/cart', { method: 'DELETE' });
    toast('Cart cleared', '');
    loadCartPage();
    updateCartBadge();
  } catch (err) {
    toast('Failed to clear cart', 'error');
  }
}

async function checkoutCart() {
  if (!currentUser) return;
  const addr = document.getElementById('cartDeliveryAddr')?.value.trim();
  if (!addr) { toast('Please enter delivery address', 'error'); return; }
  try {
    const res = await cartAPI.checkout({ delivery_address: addr, payment_method: selectedPayMethod });
    if (selectedPayMethod !== 'cash' && res.order_ids && res.order_ids.length > 0) {
      const firstOrderId = res.order_ids[0];
      await openRazorpay(firstOrderId);
    } else {
      toast(`${res.order_ids.length} order(s) placed! 🎉`, 'success');
      updateCartBadge();
      showPage('orders');
    }
  } catch (err) {
    toast(err.message || 'Checkout failed', 'error');
  }
}

/* ═══════════════════════════════════════════
   ORDERS PAGE
═══════════════════════════════════════════ */
async function loadOrdersPage() {
  const el = document.getElementById('ordersContent');
  if (!el) return;
  if (!currentUser) {
    el.innerHTML = `<div class="empty-state"><div class="es-icon">🔐</div><h3>Please login</h3><button class="btn-primary" style="margin-top:20px" onclick="showPage('auth')">Login</button></div>`;
    return;
  }
  el.innerHTML = `<div style="text-align:center;padding:60px;color:#6b7280">Loading orders...</div>`;
  try {
    const res = await orderAPI.getAll();
    let orders = (res.orders || []).slice().reverse();
    const statusSteps = ['pending', 'processing', 'shipped', 'delivered'];
    const isBuyer = currentUser.role === 'buyer';
    const isFarmer = currentUser.role === 'farmer';

    el.innerHTML = `<div style="max-width:900px;margin:0 auto;padding:28px 24px">
      ${!orders.length
        ? `<div class="empty-state"><div class="es-icon">📦</div><h3>No orders yet</h3>${isBuyer ? `<button class="btn-primary" style="margin-top:20px" onclick="showPage('marketplace')">Browse Market</button>` : ''}</div>`
        : orders.map(o => {
            const currentStep = statusSteps.indexOf(o.status);
            const isCancelled = o.status === 'cancelled';
            const otherName = isBuyer ? (o.farmer_name || '—') : (o.buyer_name || '—');
            const otherIdField = isBuyer ? o.farmer_id : o.buyer_id;
            return `
            <div style="background:white;border-radius:16px;padding:22px 24px;margin-bottom:18px;border:1px solid #f3f4f6;box-shadow:0 2px 8px rgba(0,0,0,.06)">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:16px">
                <div>
                  <div style="font-weight:700;font-size:1rem;margin-bottom:3px">${o.emoji||'🌾'} ${o.product_name||'Product'}</div>
                  <div style="font-size:.82rem;color:#6b7280">Order #${o.id} · ${isBuyer?'Seller: ':'Buyer: '}<span style="color:#2d7a31;font-weight:600">${otherName}</span></div>
                </div>
                <div style="text-align:right">
                  <div style="font-family:'Space Mono',monospace;font-size:1.2rem;font-weight:700;color:#2d7a31">₹${o.total_amount.toLocaleString()}</div>
                  <div style="font-size:.78rem;color:#9ca3af">${o.quantity} unit${o.quantity>1?'s':''} · ${(o.payment_method||'').toUpperCase()}</div>
                </div>
              </div>
              ${!isCancelled ? `
              <div style="margin-bottom:16px">
                <div style="display:flex;align-items:center;position:relative">
                  ${statusSteps.map((step, i) => {
                    const done = i <= currentStep; const active = i === currentStep;
                    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;position:relative;z-index:1">
                      <div style="width:28px;height:28px;border-radius:50%;border:2px solid ${done?'#3a9e40':'#d1d5db'};background:${done?'#3a9e40':'white'};display:flex;align-items:center;justify-content:center;font-size:.75rem;color:${done?'white':'#9ca3af'};font-weight:700;margin-bottom:6px">${done?'✓':(i+1)}</div>
                      <div style="font-size:.7rem;font-weight:${active?'700':'500'};color:${active?'#2d7a31':done?'#6b7280':'#9ca3af'};text-align:center;text-transform:capitalize">${step}</div>
                      ${i<statusSteps.length-1?`<div style="position:absolute;top:14px;left:50%;width:100%;height:2px;background:${i<currentStep?'#3a9e40':'#e5e7eb'};z-index:0"></div>`:''}
                    </div>`;
                  }).join('')}
                </div>
              </div>` : `<div style="margin-bottom:16px"><span class="status-badge status-cancelled" style="font-size:.85rem;padding:6px 16px">❌ Order Cancelled</span></div>`}
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;padding-top:12px;border-top:1px solid #f3f4f6">
                <div style="font-size:.78rem;color:#9ca3af">Placed: ${formatDate(o.created_at)}</div>
                <div style="display:flex;gap:8px">
                  <button onclick="startChatAndGo(${otherIdField})" style="padding:6px 14px;background:#e8f5e9;color:#2d7a31;border:none;border-radius:6px;font-size:.8rem;font-weight:600;cursor:pointer">💬 Chat</button>
                  ${isFarmer && o.status==='pending' ? `<button onclick="updateOrderStatus(${o.id},'processing')" style="padding:6px 14px;background:#dbeafe;color:#1e40af;border:none;border-radius:6px;font-size:.8rem;font-weight:600;cursor:pointer">Mark Processing</button>` : ''}
                  ${isFarmer && o.status==='processing' ? `<button onclick="updateOrderStatus(${o.id},'shipped')" style="padding:6px 14px;background:#fef3c7;color:#92400e;border:none;border-radius:6px;font-size:.8rem;font-weight:600;cursor:pointer">Mark Shipped</button>` : ''}
                  ${isFarmer && o.status==='shipped' ? `<button onclick="updateOrderStatus(${o.id},'delivered')" style="padding:6px 14px;background:#dcfce7;color:#166534;border:none;border-radius:6px;font-size:.8rem;font-weight:600;cursor:pointer">Mark Delivered</button>` : ''}
                </div>
              </div>
            </div>`;
          }).join('')}
    </div>`;
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><div class="es-icon">❌</div><h3>Failed to load orders</h3><p>${err.message}</p></div>`;
  }
}

async function updateOrderStatus(orderId, newStatus) {
  try {
    await orderAPI.updateStatus(orderId, newStatus);
    toast(`Order #${orderId} marked as ${newStatus}`, 'success');
    loadOrdersPage();
  } catch (err) {
    toast(err.message || 'Failed to update order', 'error');
  }
}

/* ═══════════════════════════════════════════
   MY PROFILE PAGE
═══════════════════════════════════════════ */
function loadMyProfile() {
  const el = document.getElementById('myProfileContent');
  if (!el) return;
  if (!currentUser) {
    el.innerHTML = `<div class="empty-state"><div class="es-icon">🔐</div><h3>Please login first</h3><button class="btn-primary" style="margin-top:20px" onclick="showPage('auth')">Login</button></div>`;
    return;
  }
  const fresh = currentUser;
  const roleEmoji = { farmer: '👨‍🌾', buyer: '🛒', provider: '🔧', admin: '🛡️' };
  const stars = '★'.repeat(Math.floor(fresh.rating || 5)) + '☆'.repeat(5 - Math.floor(fresh.rating || 5));
  el.innerHTML = `
    <div style="max-width:900px;margin:0 auto;padding:28px 24px">
      <div style="background:white;border-radius:20px;padding:32px;box-shadow:0 4px 16px rgba(0,0,0,.08);margin-bottom:20px">
        <div style="display:flex;align-items:flex-start;gap:24px;flex-wrap:wrap">
          <div style="display:flex;flex-direction:column;align-items:center;gap:10px;flex-shrink:0">
            <div style="position:relative;cursor:pointer" onclick="document.getElementById('profilePicInput').click()">
              ${fresh.profile_pic ? `<img src="${fresh.profile_pic}" style="width:90px;height:90px;border-radius:50%;object-fit:cover;border:3px solid #3a9e40;" />` : `<div style="width:90px;height:90px;border-radius:50%;background:#255c28;color:white;display:flex;align-items:center;justify-content:center;font-size:2.4rem;font-weight:700;border:3px solid #3a9e40">${fresh.name[0]}</div>`}
              <div style="position:absolute;bottom:0;right:0;background:#3a9e40;color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.9rem;border:2px solid white">📷</div>
            </div>
            <input type="file" id="profilePicInput" accept="image/*" style="display:none" onchange="updateProfilePic(this)"/>
          </div>
          <div style="flex:1;min-width:220px">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px">
              <h2 style="font-family:'Playfair Display',serif;font-size:1.7rem;font-weight:700;color:#111827;margin:0">${fresh.name}</h2>
              ${fresh.is_verified
                ? `<span style="background:linear-gradient(135deg,#dcfce7,#bbf7d0);color:#166534;padding:4px 14px;border-radius:20px;font-size:.78rem;font-weight:700;border:1px solid #86efac;display:inline-flex;align-items:center;gap:4px">
                    <span style="font-size:1rem">✅</span> Verified Account
                   </span>`
                : `<span style="background:#fef3c7;color:#92400e;padding:4px 14px;border-radius:20px;font-size:.78rem;font-weight:700;border:1px solid #fcd34d">
                    ⏳ Pending Verification
                   </span>`
              }
            </div>
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px">
              <span style="background:#e8f5e9;color:#2d7a31;padding:5px 14px;border-radius:20px;font-size:.85rem;font-weight:600">${roleEmoji[fresh.role]} ${fresh.role.charAt(0).toUpperCase()+fresh.role.slice(1)}</span>
              ${fresh.service_type ? `<span style="background:#fef3c7;color:#92400e;padding:5px 14px;border-radius:20px;font-size:.85rem;font-weight:600">${fresh.service_type}</span>` : ''}
            </div>
            <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
              <span style="color:#f59e0b">${stars}</span>
              <span style="font-size:.85rem;color:#6b7280">${fresh.rating || '5.0'} · ${fresh.total_reviews || 0} reviews</span>
              <span style="font-size:.85rem;color:#6b7280">📍 ${fresh.district?fresh.district+', ':''}${fresh.state||'—'}</span>
            </div>
          </div>
        </div>
      </div>
      <div style="background:white;border-radius:20px;padding:32px;box-shadow:0 4px 16px rgba(0,0,0,.08)">
        <h3 style="font-family:'Playfair Display',serif;font-size:1.2rem;font-weight:700;margin-bottom:22px;color:#111827">✏️ Edit Your Profile</h3>
        <div class="form-row">
          <div class="form-group"><label>Full Name</label><input type="text" id="editName" value="${fresh.name}"/></div>
          <div class="form-group"><label>Mobile Number</label><input type="text" id="editMobile" value="${fresh.mobile||''}"/></div>
        </div>
        <div class="form-group"><label>Email Address</label><input type="email" id="editEmail" value="${fresh.email}"/></div>
        <div class="form-row">
          <div class="form-group"><label>State</label>
            <select id="editState">${['Punjab','Haryana','Uttar Pradesh','Maharashtra','Madhya Pradesh','Rajasthan','Bihar','West Bengal','Andhra Pradesh','Karnataka','Gujarat','Tamil Nadu','Delhi'].map(s=>`<option ${s===(fresh.state||'')?'selected':''}>${s}</option>`).join('')}</select>
          </div>
          <div class="form-group"><label>District / City</label><input type="text" id="editDistrict" value="${fresh.district||''}"/></div>
        </div>
        ${fresh.role === 'provider' ? `<div class="form-group"><label>Service Type</label><select id="editServiceType">${['Tractor / Machinery','Labor / Manpower','Transportation','Irrigation Expert','Pesticide Spraying','Soil Testing'].map(s=>`<option ${s===(fresh.service_type||'')?'selected':''}>${s}</option>`).join('')}</select></div>` : ''}
        <div class="form-group"><label>Bio / About</label><textarea id="editBio" style="height:100px">${fresh.bio||''}</textarea></div>
        <div style="border-top:1px solid #f3f4f6;padding-top:20px;margin-top:4px">
          <h4 style="font-size:.95rem;font-weight:700;margin-bottom:14px;color:#374151">
            🔒 Change Password
            <span style="font-weight:400;color:#9ca3af;font-size:.82rem">(leave blank to keep current)</span>
          </h4>
          <div class="form-group">
            <label>Current Password</label>
            <input type="password" id="editCurrentPass" placeholder="Enter current password to confirm change"/>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>New Password</label>
              <input type="password" id="editNewPass" placeholder="Min 6 characters"/>
            </div>
            <div class="form-group">
              <label>Confirm New Password</label>
              <input type="password" id="editConfirmPass" placeholder="Repeat new password"/>
            </div>
          </div>
        </div>
        <button class="btn-auth" onclick="saveMyProfile()" style="margin-top:8px">💾 Save Profile Changes</button>
      </div>
    </div>`;
}

function updateProfilePic(inputEl) {
  const file = inputEl.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const res = await authAPI.updateProfile({ profile_pic: e.target.result });
      currentUser = res.user;
      localStorage.setItem('ac_currentUser', JSON.stringify(res.user));
      updateNavUser();
      toast('Profile photo updated! 📷', 'success');
      loadMyProfile();
    } catch (err) {
      toast('Failed to update photo', 'error');
    }
  };
  reader.readAsDataURL(file);
}

async function saveMyProfile() {
  if (!currentUser) return;

  const name        = document.getElementById('editName')?.value.trim();
  const mobile      = document.getElementById('editMobile')?.value.trim();
  const email       = document.getElementById('editEmail')?.value.trim();
  const state       = document.getElementById('editState')?.value;
  const district    = document.getElementById('editDistrict')?.value.trim();
  const bio         = document.getElementById('editBio')?.value.trim();
  const newPass     = document.getElementById('editNewPass')?.value;
  const confirmPass = document.getElementById('editConfirmPass')?.value;
  const currentPass = document.getElementById('editCurrentPass')?.value;
  const serviceType = document.getElementById('editServiceType')?.value;

  if (!name) { toast('Name is required', 'error'); return; }

  // Step 1 — Update profile info
  try {
    const payload = { name, mobile, state, district, bio };
    if (serviceType) payload.service_type = serviceType;

    const res = await authAPI.updateProfile(payload);
    currentUser = res.user;
    localStorage.setItem('ac_currentUser', JSON.stringify(res.user));
    updateNavUser();
    updateNavLinks();
    toast('Profile updated! ✅', 'success');
  } catch (err) {
    toast(err.message || 'Failed to update profile', 'error');
    return;
  }

  // Step 2 — Change password separately if filled
  if (newPass) {
    if (!currentPass) { toast('Enter your current password to change it', 'error'); return; }
    if (newPass.length < 6) { toast('New password must be at least 6 characters', 'error'); return; }
    if (newPass !== confirmPass) { toast('Passwords do not match', 'error'); return; }

    try {
      await apiFetch('/auth/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword: currentPass, newPassword: newPass }),
      });
      toast('Password changed! Please login again.', 'success');
      setTimeout(() => logout(), 2000);
    } catch (err) {
      toast(err.message || 'Failed to change password', 'error');
    }
  }

  loadMyProfile();
}

/* ═══════════════════════════════════════════
   DASHBOARD
═══════════════════════════════════════════ */
async function loadDashboard() {

    if (currentUser && currentUser.role === 'admin') {
    loadAdminDashboard();
    return;
  }

  const el = document.getElementById('dashContent');

  if (window._dashTimer) clearInterval(window._dashTimer);
  window._dashTimer = setInterval(() => {
    const dashPage = document.getElementById('page-dashboard');
    if (dashPage && dashPage.classList.contains('active')) {
      loadDashboard();
    } else {
      clearInterval(window._dashTimer);
    }
  }, 30000);

  if (!currentUser) { el.innerHTML = `<div class="empty-state"><div class="es-icon">🔐</div><h3>Please login to view dashboard</h3></div>`; return; }
  el.innerHTML = `<div style="text-align:center;padding:60px;color:#6b7280">Loading dashboard...</div>`;
  try {
    const res = await dashAPI.get();
    document.getElementById('dashTitle').textContent = currentUser.role === 'admin' ? '🛡️ Admin Dashboard' : currentUser.role === 'farmer' ? '📊 Farmer Dashboard' : '🔧 Provider Dashboard';
    document.getElementById('dashSubtitle').textContent = `Welcome, ${currentUser.name}!`;

    if (currentUser.role === 'farmer') {
      const s = res.stats;
      el.innerHTML = `
        <div class="dash-grid">
          <div class="dash-stat" style="--c:#4CAF50"><div class="ds-label">Listings</div><div class="ds-num" id="dashListings">0</div></div>
          <div class="dash-stat" style="--c:#FF9800"><div class="ds-label">Pending Orders</div><div class="ds-num" id="dashPending">0</div></div>
          <div class="dash-stat" style="--c:#2196F3"><div class="ds-label">Revenue</div><div class="ds-num" id="dashRevenue">₹0K</div></div>
          <div class="dash-stat" style="--c:#F44336;cursor:pointer" onclick="openReviewsPage(${currentUser.id})">
            <div class="ds-label">Rating</div>
            <div class="ds-num">${currentUser.rating||'5.0'}⭐</div>
            <div class="ds-sub" style="font-size:.72rem;color:#9ca3af;margin-top:4px">Click to see reviews</div>
          </div>
        </div>
        <div class="dash-section"><h3>My Crop Listings</h3>
          <div class="orders-table"><table><thead><tr><th>Crop</th><th>Price</th><th>Qty</th><th>State</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>${(res.my_listings||[]).map(p=>`<tr>
              <td><strong>${p.emoji||'🌾'} ${p.name}</strong></td>
              <td>
                ${p.on_sale && p.discount_pct > 0
                  ? `<span style="text-decoration:line-through;font-size:.8rem;color:#9ca3af">₹${p.price.toLocaleString()}</span>
                     <span style="color:#ef4444;margin-left:4px;font-weight:700">₹${Math.round(p.price*(1-p.discount_pct/100)).toLocaleString()}</span>
                     <span style="background:#ef4444;color:white;padding:1px 6px;border-radius:20px;font-size:.68rem;margin-left:4px">${p.discount_pct}% OFF</span>`
                  : `₹${p.price.toLocaleString()}`}/${p.unit}
              </td>
              <td>${p.quantity} ${p.unit}</td>
              <td>${p.state||'—'}</td>
              <td>
                ${p.on_sale
                  ? `<span class="status-badge" style="background:#fef3c7;color:#92400e">🏷️ On Sale</span>`
                  : `<span class="status-badge ${p.is_available?'status-delivered':'status-cancelled'}">${p.is_available?'Active':'Sold Out'}</span>`}
              </td>
              <td><button onclick="openManageProduct(${p.id})" style="padding:4px 12px;background:#e8f5e9;color:#2d7a31;border:none;border-radius:6px;cursor:pointer;font-size:.78rem;font-weight:600">⚙️ Manage</button></td>
            </tr>`).join('')||'<tr><td colspan="6" style="text-align:center;padding:30px;color:#9ca3af">No listings yet</td></tr>'}</tbody>
          </table></div>
        </div>`;

      setTimeout(() => {
        animateNumber('dashListings', s.total_listings || 0, 800);
        animateNumber('dashPending',  s.pending_orders || 0, 800);
        const revenueEl = document.getElementById('dashRevenue');
        if (revenueEl) {
          const target = s.total_revenue || 0;
          const startTime = performance.now();
          function updateRevenue(currentTime) {
            const progress = Math.min((currentTime - startTime) / 1200, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = (target * eased / 1000).toFixed(1);
            revenueEl.textContent = `₹${current}K`;
            if (progress < 1) requestAnimationFrame(updateRevenue);
          }
          requestAnimationFrame(updateRevenue);
        }
      }, 100);

    } else if (currentUser.role === 'provider') {
      const s = res.stats;
      el.innerHTML = `
        <div class="dash-grid">
          <div class="dash-stat" style="--c:#4CAF50"><div class="ds-label">Services</div><div class="ds-num" id="dashSvcCount">0</div></div>
          <div class="dash-stat" style="--c:#FF9800"><div class="ds-label">Bids Sent</div><div class="ds-num" id="dashBids">0</div></div>
          <div class="dash-stat" style="--c:#2196F3"><div class="ds-label">Jobs Won</div><div class="ds-num" id="dashWon">0</div></div>
          <div class="dash-stat" style="--c:#F44336;cursor:pointer" onclick="openReviewsPage(${currentUser.id})">
            <div class="ds-label">Rating</div>
            <div class="ds-num">${currentUser.rating||'5.0'}⭐</div>
            <div class="ds-sub" style="font-size:.72rem;color:#9ca3af;margin-top:4px">Click to see reviews</div>
          </div>
        </div>
        <div class="dash-section"><h3>My Services</h3>
          <div class="orders-table"><table><thead><tr><th>Service</th><th>Type</th><th>Rate</th><th>Location</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>${(res.my_services||[]).map(sv=>`<tr>
              <td><strong>${sv.title}</strong></td>
              <td>${sv.type}</td>
              <td>
                ${sv.on_promo && sv.discount_pct > 0
                  ? `<span style="text-decoration:line-through;font-size:.8rem;color:#9ca3af">₹${sv.rate.toLocaleString()}</span>
                     <span style="color:#ef4444;margin-left:4px;font-weight:700">₹${Math.round(sv.rate*(1-sv.discount_pct/100)).toLocaleString()}</span>
                     <span style="background:#ef4444;color:white;padding:1px 6px;border-radius:20px;font-size:.68rem;margin-left:4px">${sv.discount_pct}% OFF</span>`
                  : `₹${sv.rate.toLocaleString()}`}/${sv.rate_per}
              </td>
              <td>${sv.location||'—'}</td>
              <td>
                ${sv.on_promo
                  ? `<span class="status-badge" style="background:#fef3c7;color:#92400e">🏷️ On Promo</span>`
                  : `<span class="status-badge ${sv.is_available?'status-delivered':'status-cancelled'}">${sv.is_available?'Active':'Unavailable'}</span>`}
              </td>
              <td><button onclick="openManageService(${sv.id})" style="padding:4px 12px;background:#e8f5e9;color:#2d7a31;border:none;border-radius:6px;cursor:pointer;font-size:.78rem;font-weight:600">⚙️ Manage</button></td>
            </tr>`).join('')||'<tr><td colspan="6" style="text-align:center;padding:30px;color:#9ca3af">No services listed</td></tr>'}</tbody>
          </table></div>
        </div>`;

      // Animate stat numbers
      setTimeout(() => {
        animateNumber('dashSvcCount', s.total_services || 0, 800);
        animateNumber('dashBids',     s.total_bids     || 0, 800);
        animateNumber('dashWon',      s.won_bids       || 0, 800);
      }, 100);

    } else if (currentUser.role === 'admin') {
      await loadAdminDashboard();
    }
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><div class="es-icon">❌</div><h3>Failed to load dashboard</h3><p>${err.message}</p></div>`;
  }
}

/* ═══════════════════════════════════════════
   FULL ADMIN DASHBOARD
═══════════════════════════════════════════ */
async function loadAdminDashboard() {
  const el = document.getElementById('dashContent');
  document.getElementById('dashTitle').textContent = '🛡️ Admin Dashboard';
  document.getElementById('dashSubtitle').textContent = 'Full platform control';

  el.innerHTML = `
    <!-- Admin Tab Navigation -->
    <div style="display:flex;gap:0;padding:0 0 0 0;background:white;border-bottom:2px solid #f3f4f6;overflow-x:auto;flex-wrap:nowrap">
      ${[
        ['overview',  '📊 Overview'],
        ['users',     '👥 Users'],
        ['products',  '🌾 Products'],
        ['orders',    '📦 Orders'],
        ['services',  '⚙️ Services'],
        ['jobs',      '📋 Jobs'],
        ['reviews',   '⭐ Reviews'],
        ['revenue',   '💰 Revenue'],
      ].map(([tab, label]) => `
        <button onclick="switchAdminTab('${tab}')"
                id="atab-${tab}"
                style="padding:14px 20px;background:none;border:none;font-family:'DM Sans',sans-serif;
                       font-size:.88rem;font-weight:600;cursor:pointer;color:#6b7280;white-space:nowrap;
                       border-bottom:3px solid transparent;transition:all .2s;margin-bottom:-2px">
          ${label}
        </button>`).join('')}
    </div>

    <!-- Tab Content -->
    <div id="adminTabContent" style="padding:24px"></div>`;

  // Load overview by default
  switchAdminTab('overview');
}

function switchAdminTab(tab) {
  // Update tab styles
  document.querySelectorAll('[id^="atab-"]').forEach(btn => {
    btn.style.color = '#6b7280';
    btn.style.borderBottomColor = 'transparent';
    btn.style.background = 'none';
  });
  const active = document.getElementById(`atab-${tab}`);
  if (active) {
    active.style.color = '#2d7a31';
    active.style.borderBottomColor = '#3a9e40';
  }

  const content = document.getElementById('adminTabContent');
  if (content) content.innerHTML = `<div style="text-align:center;padding:60px;color:#6b7280">Loading...</div>`;

  const loaders = {
    overview: loadAdminOverview,
    users:    loadAdminUsers,
    products: loadAdminProducts,
    orders:   loadAdminOrders,
    services: loadAdminServices,
    jobs:     loadAdminJobs,
    reviews:  loadAdminReviews,
    revenue:  loadAdminRevenue,
  };
  if (loaders[tab]) loaders[tab]();
}

// ── OVERVIEW TAB ──────────────────────────────
async function loadAdminOverview() {
  try {
    const res = await adminAPI.getStats();
    const s = res.stats;

    document.getElementById('adminTabContent').innerHTML = `
      <!-- Today's Stats -->
      <div style="background:linear-gradient(135deg,#1a3a1e,#255c28);border-radius:16px;padding:24px;margin-bottom:24px;color:white">
        <div style="font-size:.85rem;color:rgba(255,255,255,.7);margin-bottom:12px;font-weight:600;letter-spacing:1px">TODAY</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:16px">
          ${[
            { label: 'New Users',    val: s.new_users_today,  icon: '👥' },
            { label: 'Orders Today', val: s.orders_today,     icon: '📦' },
            { label: 'Revenue Today',val: `₹${Number(s.revenue_today||0).toLocaleString()}`, icon: '💰' },
          ].map(st => `
            <div style="background:rgba(255,255,255,.1);border-radius:12px;padding:16px">
              <div style="font-size:1.6rem;margin-bottom:6px">${st.icon}</div>
              <div style="font-size:1.5rem;font-weight:700">${st.val}</div>
              <div style="font-size:.78rem;color:rgba(255,255,255,.7);margin-top:2px">${st.label}</div>
            </div>`).join('')}
        </div>
      </div>

      <!-- Overall Stats Grid -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px;margin-bottom:24px">
        ${[
          { label:'Total Users',       val: s.total_users,       color:'#4CAF50', icon:'👥' },
          { label:'Farmers',           val: s.total_farmers,     color:'#8BC34A', icon:'👨‍🌾' },
          { label:'Buyers',            val: s.total_buyers,      color:'#2196F3', icon:'🛒' },
          { label:'Providers',         val: s.total_providers,   color:'#FF9800', icon:'🔧' },
          { label:'Verified Users',    val: s.verified_users,    color:'#009688', icon:'✅' },
          { label:'Pending Verify',    val: s.unverified_users,  color:'#FFC107', icon:'⏳' },
          { label:'Banned Users',      val: s.banned_users,      color:'#F44336', icon:'🚫' },
          { label:'Active Listings',   val: s.active_listings,   color:'#3a9e40', icon:'🌾' },
          { label:'Total Orders',      val: s.total_orders,      color:'#673AB7', icon:'📦' },
          { label:'Pending Orders',    val: s.pending_orders,    color:'#FF5722', icon:'⏳' },
          { label:'Delivered Orders',  val: s.delivered_orders,  color:'#4CAF50', icon:'✅' },
          { label:'Total GMV',         val: `₹${(Number(s.total_gmv||0)/1000).toFixed(1)}K`, color:'#E91E63', icon:'💰' },
          { label:'Active Services',   val: s.active_services,   color:'#00BCD4', icon:'⚙️' },
          { label:'Open Jobs',         val: s.open_jobs,         color:'#795548', icon:'📋' },
          { label:'Total Reviews',     val: s.total_reviews,     color:'#FF9800', icon:'⭐' },
          { label:'Total Messages',    val: s.total_messages,    color:'#607D8B', icon:'💬' },
        ].map(st => `
          <div style="background:white;border-radius:12px;padding:18px;border-left:4px solid ${st.color};box-shadow:0 1px 4px rgba(0,0,0,.06)">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
              <span style="font-size:.75rem;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.5px">${st.label}</span>
              <span style="font-size:1.2rem">${st.icon}</span>
            </div>
            <div style="font-size:1.6rem;font-weight:700;color:#111827">${st.val}</div>
          </div>`).join('')}
      </div>

      <!-- Quick Actions -->
      <div style="background:white;border-radius:14px;padding:20px;box-shadow:0 1px 4px rgba(0,0,0,.06)">
        <div style="font-weight:700;font-size:1rem;margin-bottom:14px">⚡ Quick Actions</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button onclick="switchAdminTab('users')" style="padding:10px 18px;background:#e8f5e9;color:#2d7a31;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:.88rem">👥 Manage Users</button>
          <button onclick="switchAdminTab('users');setTimeout(()=>document.getElementById('adminUserVerifyFilter')?.click(),500)" style="padding:10px 18px;background:#fef3c7;color:#92400e;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:.88rem">⏳ Verify Pending Users</button>
          <button onclick="switchAdminTab('orders')" style="padding:10px 18px;background:#dbeafe;color:#1e40af;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:.88rem">📦 View All Orders</button>
          <button onclick="switchAdminTab('revenue')" style="padding:10px 18px;background:#fce7f3;color:#9d174d;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:.88rem">💰 Revenue Report</button>
        </div>
      </div>`;
  } catch (err) {
    document.getElementById('adminTabContent').innerHTML =
      `<div style="text-align:center;color:#ef4444;padding:40px">${err.message}</div>`;
  }
}

// ── USERS TAB ─────────────────────────────────
async function loadAdminUsers(params = {}) {
  try {
    const res = await adminAPI.getUsers(params);
    const users = res.users || [];
    const pagination = res.pagination || {};

    document.getElementById('adminTabContent').innerHTML = `
      <!-- Filters -->
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px">
        <input type="text" id="adminUserSearch" placeholder="🔍 Search name, email, mobile..."
               onkeydown="if(event.key==='Enter')loadAdminUsers({search:this.value,role:document.getElementById('adminUserRole').value,is_verified:document.getElementById('adminUserVerified').value})"
               style="flex:1;min-width:220px;padding:10px 14px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:.9rem;font-family:'DM Sans',sans-serif;outline:none"/>
        <select id="adminUserRole" onchange="loadAdminUsers({role:this.value,is_verified:document.getElementById('adminUserVerified').value})"
                style="padding:10px 14px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:.88rem;background:white;outline:none">
          <option value="">All Roles</option>
          <option value="farmer">👨‍🌾 Farmer</option>
          <option value="buyer">🛒 Buyer</option>
          <option value="provider">🔧 Provider</option>
        </select>
        <select id="adminUserVerified" onchange="loadAdminUsers({role:document.getElementById('adminUserRole').value,is_verified:this.value})"
                style="padding:10px 14px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:.88rem;background:white;outline:none">
          <option value="">All Status</option>
          <option value="0" id="adminUserVerifyFilter">⏳ Unverified</option>
          <option value="1">✅ Verified</option>
        </select>
        <button onclick="loadAdminUsers({search:document.getElementById('adminUserSearch').value,role:document.getElementById('adminUserRole').value,is_verified:document.getElementById('adminUserVerified').value})"
                style="padding:10px 18px;background:#3a9e40;color:white;border:none;border-radius:8px;font-weight:600;cursor:pointer">Search</button>
      </div>

      <div style="font-size:.82rem;color:#6b7280;margin-bottom:12px">${pagination.total || 0} users found</div>

      <!-- Users Table -->
      <div style="background:white;border-radius:14px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.06)">
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:#f9fafb">
                <th style="padding:12px 16px;text-align:left;font-size:.78rem;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.5px">User</th>
                <th style="padding:12px 16px;text-align:left;font-size:.78rem;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.5px">Role</th>
                <th style="padding:12px 16px;text-align:left;font-size:.78rem;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.5px">Stats</th>
                <th style="padding:12px 16px;text-align:left;font-size:.78rem;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.5px">Status</th>
                <th style="padding:12px 16px;text-align:left;font-size:.78rem;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.5px">Joined</th>
                <th style="padding:12px 16px;text-align:left;font-size:.78rem;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.5px">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${users.map(u => `
              <tr style="border-top:1px solid #f3f4f6;transition:background .15s" onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background=''">
                <td style="padding:14px 16px">
                  <div style="display:flex;align-items:center;gap:10px">
                    <div style="width:36px;height:36px;border-radius:50%;background:#255c28;color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.85rem;flex-shrink:0">
                      ${u.profile_pic ? `<img src="${u.profile_pic}" style="width:36px;height:36px;border-radius:50%;object-fit:cover"/>` : u.name[0].toUpperCase()}
                    </div>
                    <div>
                      <div style="font-weight:700;font-size:.9rem">${u.name}</div>
                      <div style="font-size:.75rem;color:#6b7280">${u.email}</div>
                      <div style="font-size:.72rem;color:#9ca3af">${u.mobile || '—'} · ${u.state || '—'}</div>
                    </div>
                  </div>
                </td>
                <td style="padding:14px 16px">
                  <span style="background:${u.role==='farmer'?'#e8f5e9':u.role==='buyer'?'#dbeafe':u.role==='provider'?'#fef3c7':'#f3e8ff'};
                               color:${u.role==='farmer'?'#2d7a31':u.role==='buyer'?'#1e40af':u.role==='provider'?'#92400e':'#6b21a8'};
                               padding:3px 10px;border-radius:20px;font-size:.75rem;font-weight:700">
                    ${u.role === 'farmer' ? '👨‍🌾' : u.role === 'buyer' ? '🛒' : u.role === 'provider' ? '🔧' : '🛡️'} ${u.role}
                  </span>
                  ${u.service_type ? `<div style="font-size:.7rem;color:#9ca3af;margin-top:3px">${u.service_type}</div>` : ''}
                </td>
                <td style="padding:14px 16px;font-size:.8rem;color:#6b7280">
                  ${u.role==='farmer' ? `🌾 ${u.product_count} listings<br>₹${Number(u.revenue||0).toLocaleString()} earned` : ''}
                  ${u.role==='buyer'  ? `📦 ${u.order_count} orders` : ''}
                  ${u.role==='provider' ? `⚙️ ${u.service_count} services` : ''}
                  <br>⭐ ${u.rating} (${u.total_reviews})
                </td>
                <td style="padding:14px 16px">
                  <div style="display:flex;flex-direction:column;gap:4px">
                    <span style="background:${u.is_verified?'#dcfce7':'#fef3c7'};color:${u.is_verified?'#166534':'#92400e'};padding:2px 8px;border-radius:20px;font-size:.72rem;font-weight:700;display:inline-block">
                      ${u.is_verified ? '✅ Verified' : '⏳ Unverified'}
                    </span>
                    <span style="background:${u.is_active?'#dcfce7':'#fee2e2'};color:${u.is_active?'#166534':'#991b1b'};padding:2px 8px;border-radius:20px;font-size:.72rem;font-weight:700;display:inline-block">
                      ${u.is_active ? '🟢 Active' : '🔴 Banned'}
                    </span>
                  </div>
                </td>
                <td style="padding:14px 16px;font-size:.78rem;color:#6b7280">${formatDate(u.created_at)}</td>
                <td style="padding:14px 16px">
                  <div style="display:flex;flex-direction:column;gap:5px">
                    ${!u.is_verified
                      ? `<button onclick="adminVerifyUser(${u.id})" style="padding:5px 10px;background:#dcfce7;color:#166534;border:none;border-radius:6px;font-size:.75rem;font-weight:600;cursor:pointer;white-space:nowrap">✅ Verify</button>`
                      : `<button onclick="adminUnverifyUser(${u.id})" style="padding:5px 10px;background:#fef3c7;color:#92400e;border:none;border-radius:6px;font-size:.75rem;font-weight:600;cursor:pointer;white-space:nowrap">↩ Unverify</button>`
                    }
                    ${u.is_active
                      ? `<button onclick="adminBanUser(${u.id},'${u.name.replace(/'/g,"\\'")}')" style="padding:5px 10px;background:#fee2e2;color:#991b1b;border:none;border-radius:6px;font-size:.75rem;font-weight:600;cursor:pointer;white-space:nowrap">🚫 Ban</button>`
                      : `<button onclick="adminUnbanUser(${u.id})" style="padding:5px 10px;background:#dcfce7;color:#166534;border:none;border-radius:6px;font-size:.75rem;font-weight:600;cursor:pointer;white-space:nowrap">✅ Unban</button>`
                    }
                    <button onclick="adminDeleteUser(${u.id},'${u.name.replace(/'/g,"\\'")}')" style="padding:5px 10px;background:#111827;color:white;border:none;border-radius:6px;font-size:.75rem;font-weight:600;cursor:pointer;white-space:nowrap">🗑️ Delete</button>
                  </div>
                </td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  } catch (err) {
    document.getElementById('adminTabContent').innerHTML =
      `<div style="text-align:center;color:#ef4444;padding:40px">${err.message}</div>`;
  }
}

// User action functions
async function adminVerifyUser(id) {
  try {
    await adminAPI.verifyUser(id);
    toast('User verified ✅', 'success');
    loadAdminUsers();
  } catch (err) { toast(err.message, 'error'); }
}

async function adminUnverifyUser(id) {
  try {
    await adminAPI.unverifyUser(id);
    toast('User unverified', '');
    loadAdminUsers();
  } catch (err) { toast(err.message, 'error'); }
}

async function adminBanUser(id, name) {
  if (!confirm(`Ban "${name}"? They won't be able to login.`)) return;
  try {
    await adminAPI.banUser(id);
    toast(`${name} has been banned 🚫`, 'success');
    loadAdminUsers();
  } catch (err) { toast(err.message, 'error'); }
}

async function adminUnbanUser(id) {
  try {
    await adminAPI.unbanUser(id);
    toast('User unbanned ✅', 'success');
    loadAdminUsers();
  } catch (err) { toast(err.message, 'error'); }
}

async function adminDeleteUser(id, name) {
  if (!confirm(`PERMANENTLY DELETE "${name}"? This cannot be undone. All their data will be lost.`)) return;
  try {
    await adminAPI.deleteUser(id);
    toast(`${name} deleted permanently`, 'success');
    loadAdminUsers();
  } catch (err) { toast(err.message, 'error'); }
}

// ── PRODUCTS TAB ──────────────────────────────
async function loadAdminProducts() {
  try {
    const res = await adminAPI.getProducts();
    const products = res.products || [];

    document.getElementById('adminTabContent').innerHTML = `
      <div style="font-size:.82rem;color:#6b7280;margin-bottom:14px">${res.pagination?.total || products.length} total products</div>
      <div style="background:white;border-radius:14px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.06)">
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:#f9fafb">
                <th style="padding:12px 16px;text-align:left;font-size:.78rem;color:#6b7280;font-weight:600;text-transform:uppercase">Product</th>
                <th style="padding:12px 16px;text-align:left;font-size:.78rem;color:#6b7280;font-weight:600;text-transform:uppercase">Farmer</th>
                <th style="padding:12px 16px;text-align:left;font-size:.78rem;color:#6b7280;font-weight:600;text-transform:uppercase">Price</th>
                <th style="padding:12px 16px;text-align:left;font-size:.78rem;color:#6b7280;font-weight:600;text-transform:uppercase">Stock</th>
                <th style="padding:12px 16px;text-align:left;font-size:.78rem;color:#6b7280;font-weight:600;text-transform:uppercase">Orders</th>
                <th style="padding:12px 16px;text-align:left;font-size:.78rem;color:#6b7280;font-weight:600;text-transform:uppercase">Status</th>
                <th style="padding:12px 16px;text-align:left;font-size:.78rem;color:#6b7280;font-weight:600;text-transform:uppercase">Action</th>
              </tr>
            </thead>
            <tbody>
              ${products.map(p => `
              <tr style="border-top:1px solid #f3f4f6">
                <td style="padding:12px 16px">
                  <div style="display:flex;align-items:center;gap:10px">
                    <div style="width:40px;height:40px;border-radius:8px;overflow:hidden;background:#f3f4f6;display:flex;align-items:center;justify-content:center;font-size:1.4rem;flex-shrink:0">
                      ${p.image_url ? `<img src="${p.image_url}" style="width:100%;height:100%;object-fit:cover"/>` : (p.emoji||'🌾')}
                    </div>
                    <div>
                      <div style="font-weight:700;font-size:.88rem">${p.name}</div>
                      <div style="font-size:.72rem;color:#9ca3af">${p.category}</div>
                    </div>
                  </div>
                </td>
                <td style="padding:12px 16px;font-size:.82rem">
                  <div style="font-weight:600">${p.farmer_name}</div>
                  <div style="color:#9ca3af;font-size:.72rem">${p.farmer_email}</div>
                </td>
                <td style="padding:12px 16px;font-family:'Space Mono',monospace;font-size:.88rem;font-weight:700;color:#2d7a31">
                  ₹${Number(p.price).toLocaleString()}/${p.unit}
                </td>
                <td style="padding:12px 16px;font-size:.85rem">${p.quantity} ${p.unit}</td>
                <td style="padding:12px 16px;font-size:.85rem">${p.order_count} orders</td>
                <td style="padding:12px 16px">
                  <span style="background:${p.is_available?'#dcfce7':'#fee2e2'};color:${p.is_available?'#166534':'#991b1b'};padding:3px 10px;border-radius:20px;font-size:.72rem;font-weight:700">
                    ${p.is_available ? 'Active' : 'Sold Out'}
                  </span>
                </td>
                <td style="padding:12px 16px">
                  <button onclick="adminDeleteProduct(${p.id},'${p.name.replace(/'/g,"\\'")}')"
                          style="padding:5px 10px;background:#fee2e2;color:#991b1b;border:none;border-radius:6px;font-size:.75rem;font-weight:600;cursor:pointer">
                    🗑️ Delete
                  </button>
                </td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  } catch (err) {
    document.getElementById('adminTabContent').innerHTML =
      `<div style="text-align:center;color:#ef4444;padding:40px">${err.message}</div>`;
  }
}

async function adminDeleteProduct(id, name) {
  if (!confirm(`Delete product "${name}"?`)) return;
  try {
    await adminAPI.deleteProduct(id);
    toast('Product deleted', 'success');
    loadAdminProducts();
  } catch (err) { toast(err.message, 'error'); }
}

// ── ORDERS TAB ────────────────────────────────
async function loadAdminOrders(status = '') {
  try {
    const res = await adminAPI.getOrders(status ? { status } : {});
    const orders = res.orders || [];

    document.getElementById('adminTabContent').innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
        ${['', 'pending', 'processing', 'shipped', 'delivered', 'cancelled'].map(s => `
          <button onclick="loadAdminOrders('${s}')"
                  style="padding:7px 14px;background:${s===status?'#3a9e40':'white'};color:${s===status?'white':'#374151'};
                         border:1.5px solid ${s===status?'#3a9e40':'#e5e7eb'};border-radius:8px;font-size:.82rem;font-weight:600;cursor:pointer">
            ${s || 'All'} ${s ? `(${orders.filter(o=>o.status===s).length})` : `(${orders.length})`}
          </button>`).join('')}
      </div>

      <div style="background:white;border-radius:14px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.06)">
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:#f9fafb">
                <th style="padding:12px 16px;text-align:left;font-size:.78rem;color:#6b7280;font-weight:600;text-transform:uppercase">#</th>
                <th style="padding:12px 16px;text-align:left;font-size:.78rem;color:#6b7280;font-weight:600;text-transform:uppercase">Product</th>
                <th style="padding:12px 16px;text-align:left;font-size:.78rem;color:#6b7280;font-weight:600;text-transform:uppercase">Buyer</th>
                <th style="padding:12px 16px;text-align:left;font-size:.78rem;color:#6b7280;font-weight:600;text-transform:uppercase">Farmer</th>
                <th style="padding:12px 16px;text-align:left;font-size:.78rem;color:#6b7280;font-weight:600;text-transform:uppercase">Amount</th>
                <th style="padding:12px 16px;text-align:left;font-size:.78rem;color:#6b7280;font-weight:600;text-transform:uppercase">Status</th>
                <th style="padding:12px 16px;text-align:left;font-size:.78rem;color:#6b7280;font-weight:600;text-transform:uppercase">Date</th>
                <th style="padding:12px 16px;text-align:left;font-size:.78rem;color:#6b7280;font-weight:600;text-transform:uppercase">Action</th>
              </tr>
            </thead>
            <tbody>
              ${orders.map(o => `
              <tr style="border-top:1px solid #f3f4f6">
                <td style="padding:12px 16px;font-family:'Space Mono',monospace;font-size:.82rem;color:#6b7280">#${o.id}</td>
                <td style="padding:12px 16px;font-size:.85rem;font-weight:600">${o.emoji||'🌾'} ${o.product_name}</td>
                <td style="padding:12px 16px;font-size:.82rem">
                  <div>${o.buyer_name}</div>
                  <div style="color:#9ca3af;font-size:.72rem">${o.buyer_email}</div>
                </td>
                <td style="padding:12px 16px;font-size:.82rem">
                  <div>${o.farmer_name}</div>
                  <div style="color:#9ca3af;font-size:.72rem">${o.farmer_email}</div>
                </td>
                <td style="padding:12px 16px;font-family:'Space Mono',monospace;font-size:.88rem;font-weight:700;color:#2d7a31">
                  ₹${Number(o.total_amount).toLocaleString()}
                </td>
                <td style="padding:12px 16px">
                  <select onchange="adminUpdateOrderStatus(${o.id},this.value)"
                          style="padding:4px 8px;border:1.5px solid #e5e7eb;border-radius:6px;font-size:.78rem;background:white;outline:none">
                    ${['pending','processing','shipped','delivered','cancelled'].map(s =>
                      `<option value="${s}" ${s===o.status?'selected':''}>${s}</option>`
                    ).join('')}
                  </select>
                </td>
                <td style="padding:12px 16px;font-size:.78rem;color:#6b7280">${formatDate(o.created_at)}</td>
                <td style="padding:12px 16px;font-size:.78rem;color:#6b7280">${o.payment_method?.toUpperCase()}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  } catch (err) {
    document.getElementById('adminTabContent').innerHTML =
      `<div style="text-align:center;color:#ef4444;padding:40px">${err.message}</div>`;
  }
}

async function adminUpdateOrderStatus(id, status) {
  try {
    await adminAPI.updateOrderStatus(id, status);
    toast(`Order #${id} → ${status}`, 'success');
  } catch (err) { toast(err.message, 'error'); }
}

// ── SERVICES TAB ──────────────────────────────
async function loadAdminServices() {
  try {
    const res = await adminAPI.getServices();
    const services = res.services || [];

    document.getElementById('adminTabContent').innerHTML = `
      <div style="font-size:.82rem;color:#6b7280;margin-bottom:14px">${services.length} services</div>
      <div style="background:white;border-radius:14px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.06)">
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:#f9fafb">
                <th style="padding:12px 16px;text-align:left;font-size:.78rem;color:#6b7280;font-weight:600;text-transform:uppercase">Service</th>
                <th style="padding:12px 16px;text-align:left;font-size:.78rem;color:#6b7280;font-weight:600;text-transform:uppercase">Provider</th>
                <th style="padding:12px 16px;text-align:left;font-size:.78rem;color:#6b7280;font-weight:600;text-transform:uppercase">Type</th>
                <th style="padding:12px 16px;text-align:left;font-size:.78rem;color:#6b7280;font-weight:600;text-transform:uppercase">Rate</th>
                <th style="padding:12px 16px;text-align:left;font-size:.78rem;color:#6b7280;font-weight:600;text-transform:uppercase">Status</th>
                <th style="padding:12px 16px;text-align:left;font-size:.78rem;color:#6b7280;font-weight:600;text-transform:uppercase">Action</th>
              </tr>
            </thead>
            <tbody>
              ${services.map(s => `
              <tr style="border-top:1px solid #f3f4f6">
                <td style="padding:12px 16px">
                  <div style="font-weight:700;font-size:.88rem">${s.title}</div>
                  <div style="font-size:.72rem;color:#9ca3af">📍 ${s.location||'—'}</div>
                </td>
                <td style="padding:12px 16px;font-size:.82rem">
                  <div>${s.provider_name}</div>
                  <div style="color:#9ca3af;font-size:.72rem">${s.provider_email}</div>
                </td>
                <td style="padding:12px 16px">
                  <span style="background:#fef3c7;color:#92400e;padding:3px 8px;border-radius:20px;font-size:.72rem;font-weight:700">${s.type}</span>
                </td>
                <td style="padding:12px 16px;font-family:'Space Mono',monospace;font-size:.85rem;font-weight:700;color:#2d7a31">
                  ₹${Number(s.rate).toLocaleString()}/${s.rate_per}
                </td>
                <td style="padding:12px 16px">
                  <span style="background:${s.is_available?'#dcfce7':'#fee2e2'};color:${s.is_available?'#166534':'#991b1b'};padding:3px 8px;border-radius:20px;font-size:.72rem;font-weight:700">
                    ${s.is_available?'Active':'Unavailable'}
                  </span>
                </td>
                <td style="padding:12px 16px">
                  <button onclick="adminDeleteService(${s.id},'${s.title.replace(/'/g,"\\'")}')"
                          style="padding:5px 10px;background:#fee2e2;color:#991b1b;border:none;border-radius:6px;font-size:.75rem;font-weight:600;cursor:pointer">
                    🗑️ Delete
                  </button>
                </td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  } catch (err) {
    document.getElementById('adminTabContent').innerHTML =
      `<div style="text-align:center;color:#ef4444;padding:40px">${err.message}</div>`;
  }
}

async function adminDeleteService(id, title) {
  if (!confirm(`Delete service "${title}"?`)) return;
  try {
    await adminAPI.deleteService(id);
    toast('Service deleted', 'success');
    loadAdminServices();
  } catch (err) { toast(err.message, 'error'); }
}

// ── JOBS TAB ──────────────────────────────────
async function loadAdminJobs() {
  try {
    const res = await adminAPI.getJobs();
    const jobs = res.jobs || [];

    document.getElementById('adminTabContent').innerHTML = `
      <div style="font-size:.82rem;color:#6b7280;margin-bottom:14px">${jobs.length} job posts</div>
      <div style="display:flex;flex-direction:column;gap:12px">
        ${jobs.map(j => `
        <div style="background:white;border-radius:12px;padding:18px;box-shadow:0 1px 4px rgba(0,0,0,.06);display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap">
          <div style="font-size:2rem">${serviceEmojis[j.type]||'📋'}</div>
          <div style="flex:1;min-width:200px">
            <div style="font-weight:700;font-size:.95rem;margin-bottom:4px">${j.title}</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px">
              <span style="background:#f3f4f6;color:#374151;padding:2px 8px;border-radius:20px;font-size:.72rem">${j.type}</span>
              <span style="background:#f3f4f6;color:#374151;padding:2px 8px;border-radius:20px;font-size:.72rem">📍 ${j.location||'—'}</span>
              <span style="background:#f3f4f6;color:#374151;padding:2px 8px;border-radius:20px;font-size:.72rem">💬 ${j.bid_count} bids</span>
              <span style="background:${j.status==='open'?'#dcfce7':'#f3f4f6'};color:${j.status==='open'?'#166534':'#374151'};padding:2px 8px;border-radius:20px;font-size:.72rem;font-weight:700">${j.status}</span>
            </div>
            <div style="font-size:.8rem;color:#6b7280">By: <strong>${j.farmer_name}</strong> · ${formatDate(j.created_at)}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
            <div style="font-family:'Space Mono',monospace;font-size:1.1rem;font-weight:700;color:#2d7a31">₹${Number(j.budget||0).toLocaleString()}</div>
            <button onclick="adminDeleteJob(${j.id},'${j.title.replace(/'/g,"\\'")}')"
                    style="padding:5px 12px;background:#fee2e2;color:#991b1b;border:none;border-radius:6px;font-size:.75rem;font-weight:600;cursor:pointer">
              🗑️ Delete
            </button>
          </div>
        </div>`).join('')}
      </div>`;
  } catch (err) {
    document.getElementById('adminTabContent').innerHTML =
      `<div style="text-align:center;color:#ef4444;padding:40px">${err.message}</div>`;
  }
}

async function adminDeleteJob(id, title) {
  if (!confirm(`Delete job "${title}"?`)) return;
  try {
    await adminAPI.deleteJob(id);
    toast('Job deleted', 'success');
    loadAdminJobs();
  } catch (err) { toast(err.message, 'error'); }
}

// ── REVIEWS TAB ───────────────────────────────
async function loadAdminReviews() {
  try {
    const res = await adminAPI.getReviews();
    const reviews = res.reviews || [];

    document.getElementById('adminTabContent').innerHTML = `
      <div style="font-size:.82rem;color:#6b7280;margin-bottom:14px">${reviews.length} reviews</div>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${reviews.map(r => `
        <div style="background:white;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.06);display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap">
          <div style="flex:1;min-width:200px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">
              <span style="font-weight:700;font-size:.88rem">${r.reviewer_name}</span>
              <span style="color:#9ca3af;font-size:.78rem">→ reviewed →</span>
              <span style="font-weight:700;font-size:.88rem;color:#2d7a31">${r.reviewed_name}</span>
              <span style="color:#f59e0b">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</span>
            </div>
            ${r.product_name ? `<div style="font-size:.75rem;background:#e8f5e9;color:#2d7a31;padding:2px 8px;border-radius:20px;display:inline-block;margin-bottom:6px">🌾 ${r.product_name}</div>` : ''}
            ${r.service_title ? `<div style="font-size:.75rem;background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:20px;display:inline-block;margin-bottom:6px">⚙️ ${r.service_title}</div>` : ''}
            ${r.comment ? `<div style="font-size:.85rem;color:#4b5563;font-style:italic">"${r.comment}"</div>` : '<div style="font-size:.78rem;color:#9ca3af">No comment</div>'}
            <div style="font-size:.72rem;color:#9ca3af;margin-top:4px">${timeAgo(r.created_at)}</div>
          </div>
          <button onclick="adminDeleteReview(${r.id})"
                  style="padding:5px 10px;background:#fee2e2;color:#991b1b;border:none;border-radius:6px;font-size:.75rem;font-weight:600;cursor:pointer;flex-shrink:0">
            🗑️ Remove
          </button>
        </div>`).join('')}
      </div>`;
  } catch (err) {
    document.getElementById('adminTabContent').innerHTML =
      `<div style="text-align:center;color:#ef4444;padding:40px">${err.message}</div>`;
  }
}

async function adminDeleteReview(id) {
  if (!confirm('Remove this review?')) return;
  try {
    await adminAPI.deleteReview(id);
    toast('Review removed', 'success');
    loadAdminReviews();
  } catch (err) { toast(err.message, 'error'); }
}

// ── REVENUE TAB ───────────────────────────────
async function loadAdminRevenue() {
  try {
    const res = await adminAPI.getRevenue();
    const monthly    = res.monthly    || [];
    const topFarmers = res.topFarmers || [];
    const topProducts= res.topProducts|| [];
    const byRole     = res.byRole     || [];

    const totalGMV = monthly.reduce((s, m) => s + Number(m.revenue||0), 0);

    document.getElementById('adminTabContent').innerHTML = `
      <!-- GMV Summary -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px;margin-bottom:24px">
        <div style="background:linear-gradient(135deg,#1a3a1e,#3a9e40);border-radius:14px;padding:20px;color:white">
          <div style="font-size:.78rem;opacity:.8;margin-bottom:6px">TOTAL GMV (Delivered)</div>
          <div style="font-size:1.8rem;font-weight:700">₹${(totalGMV/1000).toFixed(1)}K</div>
        </div>
        <div style="background:white;border-radius:14px;padding:20px;box-shadow:0 1px 4px rgba(0,0,0,.06)">
          <div style="font-size:.78rem;color:#6b7280;margin-bottom:6px">TOTAL ORDERS</div>
          <div style="font-size:1.8rem;font-weight:700">${monthly.reduce((s,m)=>s+Number(m.order_count||0),0)}</div>
        </div>
        <div style="background:white;border-radius:14px;padding:20px;box-shadow:0 1px 4px rgba(0,0,0,.06)">
          <div style="font-size:.78rem;color:#6b7280;margin-bottom:6px">AVG ORDER VALUE</div>
          <div style="font-size:1.8rem;font-weight:700">
            ₹${monthly.reduce((s,m)=>s+Number(m.order_count||0),0) > 0
              ? Math.round(totalGMV / monthly.reduce((s,m)=>s+Number(m.order_count||0),0)).toLocaleString()
              : '0'}
          </div>
        </div>
      </div>

      <!-- Monthly Revenue -->
      <div style="background:white;border-radius:14px;padding:20px;margin-bottom:20px;box-shadow:0 1px 4px rgba(0,0,0,.06)">
        <div style="font-weight:700;font-size:1rem;margin-bottom:16px">📈 Monthly Revenue (Last 12 Months)</div>
        ${monthly.length ? monthly.map(m => {
          const maxRev = Math.max(...monthly.map(x => Number(x.revenue||0)));
          const pct = maxRev > 0 ? Math.round((Number(m.revenue||0)/maxRev)*100) : 0;
          return `
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
            <div style="width:70px;font-size:.78rem;color:#6b7280;text-align:right">${m.month}</div>
            <div style="flex:1;background:#f3f4f6;border-radius:4px;height:24px;position:relative">
              <div style="width:${pct}%;background:linear-gradient(135deg,#2d7a31,#3a9e40);height:24px;border-radius:4px;transition:width .5s"></div>
            </div>
            <div style="width:100px;font-family:'Space Mono',monospace;font-size:.78rem;font-weight:700;color:#2d7a31">₹${Number(m.revenue||0).toLocaleString()}</div>
            <div style="width:60px;font-size:.72rem;color:#9ca3af">${m.order_count} orders</div>
          </div>`;
        }).join('') : '<div style="text-align:center;color:#9ca3af;padding:20px">No delivered orders yet</div>'}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
        <!-- Top Farmers -->
        <div style="background:white;border-radius:14px;padding:20px;box-shadow:0 1px 4px rgba(0,0,0,.06)">
          <div style="font-weight:700;font-size:1rem;margin-bottom:14px">🏆 Top Earning Farmers</div>
          ${topFarmers.map((f, i) => `
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
            <div style="width:24px;height:24px;border-radius:50%;background:${i===0?'#f59e0b':i===1?'#9ca3af':i===2?'#92400e':'#f3f4f6'};color:${i<3?'white':'#374151'};display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:700;flex-shrink:0">${i+1}</div>
            <div style="flex:1">
              <div style="font-weight:600;font-size:.85rem">${f.name}</div>
              <div style="font-size:.72rem;color:#9ca3af">${f.state||'—'} · ${f.orders} orders</div>
            </div>
            <div style="font-family:'Space Mono',monospace;font-size:.85rem;font-weight:700;color:#2d7a31">₹${Number(f.revenue||0).toLocaleString()}</div>
          </div>`).join('') || '<div style="color:#9ca3af;font-size:.85rem">No data yet</div>'}
        </div>

        <!-- Top Products -->
        <div style="background:white;border-radius:14px;padding:20px;box-shadow:0 1px 4px rgba(0,0,0,.06)">
          <div style="font-weight:700;font-size:1rem;margin-bottom:14px">🌾 Top Selling Products</div>
          ${topProducts.map((p, i) => `
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
            <div style="width:24px;height:24px;border-radius:50%;background:${i===0?'#f59e0b':i===1?'#9ca3af':i===2?'#92400e':'#f3f4f6'};color:${i<3?'white':'#374151'};display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:700;flex-shrink:0">${i+1}</div>
            <div style="font-size:1.2rem">${p.emoji||'🌾'}</div>
            <div style="flex:1">
              <div style="font-weight:600;font-size:.85rem">${p.name}</div>
              <div style="font-size:.72rem;color:#9ca3af">${p.category} · ${p.orders} orders</div>
            </div>
            <div style="font-family:'Space Mono',monospace;font-size:.85rem;font-weight:700;color:#2d7a31">₹${Number(p.revenue||0).toLocaleString()}</div>
          </div>`).join('') || '<div style="color:#9ca3af;font-size:.85rem">No data yet</div>'}
        </div>
      </div>`;
  } catch (err) {
    document.getElementById('adminTabContent').innerHTML =
      `<div style="text-align:center;color:#ef4444;padding:40px">${err.message}</div>`;
  }
}

/* ═══════════════════════════════════════════
   FARMER: MANAGE PRODUCT MODAL
═══════════════════════════════════════════ */
async function openManageProduct(productId) {
  try {
    const res = await productAPI.getById(productId);
    const p = res.product;
    if (!p) { toast('Product not found', 'error'); return; }

    document.getElementById('manageProductBody').innerHTML = `
      <div style="background:#e8f5e9;border-radius:12px;padding:16px;margin-bottom:20px;display:flex;align-items:center;gap:14px">
        <div style="font-size:2.5rem">${p.emoji || '🌾'}</div>
        <div>
          <div style="font-size:1.1rem;font-weight:700;color:#111827">${p.name}</div>
          <div style="font-size:.85rem;color:#6b7280">${p.category} · ₹${p.price}/${p.unit} · ${p.quantity} ${p.unit} remaining</div>
        </div>
      </div>
      <div style="background:white;border:1.5px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:16px">
        <div style="font-size:.9rem;font-weight:700;color:#374151;margin-bottom:14px">📋 Listing Status</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px" id="statusOptions">
          <div class="status-opt"
               onclick="selectManageStatus(this,'available')"
               style="border:2px solid ${p.is_available && !p.on_sale ? '#3a9e40' : '#e5e7eb'};border-radius:10px;padding:14px;text-align:center;cursor:pointer;transition:all .2s;background:${p.is_available && !p.on_sale ? '#e8f5e9' : 'white'}">
            <div style="font-size:1.6rem;margin-bottom:6px">✅</div>
            <div style="font-weight:700;font-size:.9rem;color:#111827">Available</div>
            <div style="font-size:.75rem;color:#6b7280;margin-top:3px">Listed for sale</div>
          </div>
          <div class="status-opt"
               onclick="selectManageStatus(this,'on_sale')"
               style="border:2px solid ${p.on_sale ? '#f59e0b' : '#e5e7eb'};border-radius:10px;padding:14px;text-align:center;cursor:pointer;transition:all .2s;background:${p.on_sale ? '#fef3c7' : 'white'}">
            <div style="font-size:1.6rem;margin-bottom:6px">🏷️</div>
            <div style="font-weight:700;font-size:.9rem;color:#111827">On Sale</div>
            <div style="font-size:.75rem;color:#6b7280;margin-top:3px">With discount</div>
          </div>
          <div class="status-opt"
               onclick="selectManageStatus(this,'sold_out')"
               style="border:2px solid ${!p.is_available ? '#ef4444' : '#e5e7eb'};border-radius:10px;padding:14px;text-align:center;cursor:pointer;transition:all .2s;background:${!p.is_available ? '#fee2e2' : 'white'}">
            <div style="font-size:1.6rem;margin-bottom:6px">❌</div>
            <div style="font-weight:700;font-size:.9rem;color:#111827">Sold Out</div>
            <div style="font-size:.75rem;color:#6b7280;margin-top:3px">Hide from market</div>
          </div>
        </div>
      </div>
      <div id="discountSection" style="display:${p.on_sale ? 'block' : 'none'};background:white;border:1.5px solid #fbbf24;border-radius:12px;padding:20px;margin-bottom:16px">
        <div style="font-size:.9rem;font-weight:700;color:#374151;margin-bottom:14px">🏷️ Discount Settings</div>
        <div class="form-row">
          <div class="form-group">
            <label>Discount %</label>
            <input type="number" id="discountPct" min="1" max="90" value="${p.discount_pct || 10}"
                   placeholder="e.g. 20" oninput="updateDiscountPreview(${p.price})"/>
          </div>
          <div class="form-group">
            <label>Sale Ends On</label>
            <input type="date" id="saleEndsAt" value="${p.sale_ends_at || ''}"/>
          </div>
        </div>
        <div id="discountPreview" style="background:#fef3c7;border-radius:8px;padding:12px;margin-top:8px">
          <span style="font-size:.85rem;color:#92400e">
            Original: <strong>₹${p.price}/${p.unit}</strong> →
            Sale Price: <strong id="salePriceDisplay">₹${Math.round(p.price * (1 - (p.discount_pct||10)/100))}/${p.unit}</strong>
            <span style="background:#ef4444;color:white;padding:2px 8px;border-radius:20px;font-size:.75rem;margin-left:8px" id="discountBadge">${p.discount_pct||10}% OFF</span>
          </span>
        </div>
      </div>
      <div style="background:white;border:1.5px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:16px">
        <div style="font-size:.9rem;font-weight:700;color:#374151;margin-bottom:14px">✏️ Update Details</div>
        <div class="form-row">
          <div class="form-group">
            <label>Price (₹ per ${p.unit})</label>
            <input type="number" id="managePrice" value="${p.price}" placeholder="Current price"/>
          </div>
          <div class="form-group">
            <label>Available Quantity (${p.unit})</label>
            <input type="number" id="manageQty" value="${p.quantity}" placeholder="Current qty"/>
          </div>
        </div>
        <div class="form-group">
          <label>Description / Quality Notes</label>
          <textarea id="manageDesc" style="height:80px">${p.description || ''}</textarea>
        </div>
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn-auth" style="flex:1" onclick="saveManageProduct(${p.id})">💾 Save Changes</button>
        <button onclick="confirmDeleteProduct(${p.id}, '${p.name}')"
                style="padding:14px 20px;background:white;color:#ef4444;border:2px solid #ef4444;border-radius:10px;font-size:.9rem;font-weight:700;cursor:pointer">
          🗑️ Delete Listing
        </button>
      </div>`;

    window._manageStatus = p.on_sale ? 'on_sale' : (p.is_available ? 'available' : 'sold_out');
    showModal('manageProductModal');

  } catch (err) {
    toast(err.message || 'Failed to load product', 'error');
  }
}

function selectManageStatus(el, status) {
  document.querySelectorAll('.status-opt').forEach(o => {
    o.style.border = '2px solid #e5e7eb';
    o.style.background = 'white';
  });
  const colors = {
    available: { border: '#3a9e40', bg: '#e8f5e9' },
    on_sale:   { border: '#f59e0b', bg: '#fef3c7' },
    sold_out:  { border: '#ef4444', bg: '#fee2e2' },
  };
  el.style.border = `2px solid ${colors[status].border}`;
  el.style.background = colors[status].bg;
  window._manageStatus = status;
  const ds = document.getElementById('discountSection');
  if (ds) ds.style.display = status === 'on_sale' ? 'block' : 'none';
}

function updateDiscountPreview(originalPrice) {
  const pct = parseFloat(document.getElementById('discountPct')?.value) || 0;
  const salePrice = Math.round(originalPrice * (1 - pct / 100));
  const display = document.getElementById('salePriceDisplay');
  const badge   = document.getElementById('discountBadge');
  if (display) display.textContent = `₹${salePrice}`;
  if (badge)   badge.textContent   = `${pct}% OFF`;
}

async function saveManageProduct(productId) {
  const status      = window._manageStatus || 'available';
  const price       = document.getElementById('managePrice')?.value;
  const qty         = document.getElementById('manageQty')?.value;
  const desc        = document.getElementById('manageDesc')?.value;
  const discountPct = document.getElementById('discountPct')?.value;
  const saleEndsAt  = document.getElementById('saleEndsAt')?.value;

  const payload = {
    price:        price ? parseFloat(price)  : undefined,
    quantity:     qty   ? parseInt(qty)      : undefined,
    description:  desc  || undefined,
    is_available: status !== 'sold_out' ? 1 : 0,
    on_sale:      status === 'on_sale'  ? 1 : 0,
    discount_pct: status === 'on_sale'  ? parseFloat(discountPct) : 0,
    sale_ends_at: status === 'on_sale'  ? saleEndsAt : null,
  };

  try {
    await apiFetch(`/products/${productId}`, { method: 'PUT', body: JSON.stringify(payload) });
    closeModal('manageProductModal');
    const statusMsg = {
      available: 'Listing is now Active ✅',
      on_sale:   `Discount applied! ${discountPct}% OFF 🏷️`,
      sold_out:  'Listing marked as Sold Out ❌',
    };
    toast(statusMsg[status], 'success');
    loadDashboard();
  } catch (err) {
    toast(err.message || 'Failed to save changes', 'error');
  }
}

async function confirmDeleteProduct(productId, name) {
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
  try {
    await productAPI.delete(productId);
    closeModal('manageProductModal');
    toast(`"${name}" deleted successfully`, 'success');
    loadDashboard();
  } catch (err) {
    toast(err.message || 'Failed to delete', 'error');
  }
}

/* ═══════════════════════════════════════════
   CHAT — Real-time Socket.io
═══════════════════════════════════════════ */
let socket = null;
let activeChatPartnerId = null;

function initSocket() {
  if (socket && socket.connected) return;
  const token = localStorage.getItem('ac_token');
  if (!token || !window.io) return;

  socket = io('http://localhost:3000', { auth: { token } });

  socket.on('connect', () => console.log('Socket connected'));
  socket.on('disconnect', () => console.log('Socket disconnected'));

  socket.on('chat:message', (msg) => {
    const myId = String(currentUser.id);
    const partnerId = String(activeChatPartnerId);
    const senderId = String(msg.sender_id);
    const receiverId = String(msg.receiver_id);

    const belongsToActiveChat =
      (senderId === myId && receiverId === partnerId) ||
      (senderId === partnerId && receiverId === myId);

    if (belongsToActiveChat) {
      const temps = document.querySelectorAll('[data-temp="true"]');
      temps.forEach(el => {
        if (el.dataset.content === msg.content && senderId === myId) el.remove();
      });
      appendMessage(msg);
      scrollChatToBottom();
    }
    loadConversationList();
  });

  socket.on('chat:notification', (data) => {
    toast(`💬 New message from ${data.from_name}: ${data.preview}`, '');
  });

  socket.on('chat:typing', ({ name, isTyping }) => {
    const el = document.getElementById('typingIndicator');
    if (el) el.textContent = isTyping ? `${name} is typing...` : '';
  });

  socket.on('user:online',  ({ userId }) => updateOnlineStatus(userId, true));
  socket.on('user:offline', ({ userId }) => updateOnlineStatus(userId, false));

  socket.on('review:new', (data) => {
    toast(`⭐ ${data.reviewer_name} gave you a ${data.rating}-star review!`, 'success');
    const dashPage = document.getElementById('page-dashboard');
    if (dashPage && dashPage.classList.contains('active')) loadDashboard();
  });

  // ← ADD THESE HERE INSIDE initSocket
  socket.on('user:verified', (data) => {
    toast('🎉 Your account is now Verified! ✅', 'success');
    if (currentUser && currentUser.id === data.userId) {
      currentUser.is_verified = 1;
      localStorage.setItem('ac_currentUser', JSON.stringify(currentUser));
      updateNavUser();
      const profilePage = document.getElementById('page-my-profile');
      if (profilePage && profilePage.classList.contains('active')) loadMyProfile();
    }
  });

  socket.on('user:unverified', (data) => {
    if (currentUser && currentUser.id === data.userId) {
      currentUser.is_verified = 0;
      localStorage.setItem('ac_currentUser', JSON.stringify(currentUser));
      updateNavUser();
      const profilePage = document.getElementById('page-my-profile');
      if (profilePage && profilePage.classList.contains('active')) loadMyProfile();
    }
  });
}


function updateOnlineStatus(userId, isOnline) {
  const dot = document.getElementById(`online-${userId}`);
  if (dot) dot.style.background = isOnline ? '#22c55e' : '#d1d5db';
}

function loadChat() {
  const main = document.getElementById('chatMain');
  if (!currentUser) {
    main.innerHTML = `<div class="chat-empty"><div class="ce-icon">🔐</div><h3>Please login</h3></div>`;
    return;
  }
  initSocket();
  loadConversationList();

  if (activeChatPartnerId) {
    chatAPI.getMessages(activeChatPartnerId).then(res => {
      const p = res.partner;
      if (p) openChat(p.id, p.name, p.role);
    }).catch(() => {});
  } else {
    main.innerHTML = `
      <div class="chat-empty">
        <div class="ce-icon">💬</div>
        <h3>Select a conversation</h3>
        <p>Choose from your message list or click 💬 on any listing</p>
      </div>`;
  }
}

async function loadConversationList() {
  const listEl = document.getElementById('chatList');
  if (!listEl) return;
  try {
    const res = await chatAPI.getConversations();
    const convs = res.conversations || [];
    if (!convs.length) {
      listEl.innerHTML = `<div style="padding:20px;text-align:center;color:#9ca3af;font-size:.85rem">No conversations yet</div>`;
      return;
    }
    const roleEmoji = { farmer:'👨‍🌾', buyer:'🛒', provider:'🔧', admin:'🛡️' };
    listEl.innerHTML = convs.map(c => `
      <div class="chat-conv-item ${String(activeChatPartnerId)===String(c.id)?'active':''}"
           onclick="openChat(${c.id},'${c.name.replace(/'/g,"\\'")}','${c.role}')">
        <div style="position:relative;flex-shrink:0">
          <div style="width:42px;height:42px;border-radius:50%;background:#255c28;color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1rem">
            ${c.profile_pic ? `<img src="${c.profile_pic}" style="width:42px;height:42px;border-radius:50%;object-fit:cover"/>` : c.name[0].toUpperCase()}
          </div>
          <div id="online-${c.id}" style="position:absolute;bottom:1px;right:1px;width:10px;height:10px;border-radius:50%;background:#d1d5db;border:2px solid white"></div>
        </div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px">
            <span style="font-weight:600;font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px">${c.name}</span>
            <span style="font-size:.7rem;color:#9ca3af">${timeAgo(c.last_time)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:.78rem;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:130px">${c.last_message || 'Start chatting'}</span>
            ${c.unread_count > 0 ? `<span style="background:#3a9e40;color:white;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:.65rem;font-weight:700;flex-shrink:0">${c.unread_count}</span>` : ''}
          </div>
          <span style="font-size:.68rem;color:#9ca3af">${roleEmoji[c.role]||''} ${c.role}</span>
        </div>
      </div>`).join('');
  } catch (err) {
    console.error('Failed to load conversations', err);
  }
}

async function openChat(partnerId, partnerName, partnerRole) {
  activeChatPartnerId = partnerId;
  if (socket) {
    socket.emit('chat:join', { partnerId });
    socket.emit('chat:read', { partnerId });
  }
  loadConversationList();

  const main = document.getElementById('chatMain');
  main.innerHTML = `
    <div style="display:flex;flex-direction:column;height:100%">
      <div style="padding:16px 20px;background:white;border-bottom:1px solid #f3f4f6;display:flex;align-items:center;gap:12px">
        <div style="width:38px;height:38px;border-radius:50%;background:#255c28;color:white;display:flex;align-items:center;justify-content:center;font-weight:700">${partnerName[0]}</div>
        <div>
          <div style="font-weight:700;font-size:.95rem">${partnerName}</div>
          <div style="font-size:.75rem;color:#6b7280">${partnerRole}</div>
        </div>
        <div id="typingIndicator" style="margin-left:auto;font-size:.78rem;color:#3a9e40;font-style:italic"></div>
      </div>
      <div id="chatMessages" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;background:#f9fafb">
        <div style="text-align:center;color:#9ca3af;font-size:.8rem">Loading messages...</div>
      </div>
      <div style="padding:12px 16px;background:white;border-top:1px solid #f3f4f6;display:flex;gap:10px">
        <input type="text" id="chatInput" placeholder="Type a message..."
               style="flex:1;padding:10px 14px;border:1.5px solid #e5e7eb;border-radius:24px;font-size:.9rem;font-family:'DM Sans',sans-serif;outline:none"
               onkeydown="if(event.key==='Enter')sendChatMessage(${partnerId})"
               oninput="socket&&socket.emit('chat:typing',{partnerId:${partnerId},isTyping:this.value.length>0})"/>
        <button onclick="sendChatMessage(${partnerId})"
                style="padding:10px 20px;background:linear-gradient(135deg,#2d7a31,#3a9e40);color:white;border:none;border-radius:24px;font-weight:600;cursor:pointer;font-size:.88rem">Send</button>
      </div>
    </div>`;

  try {
    const res = await chatAPI.getMessages(partnerId);
    const msgs = res.messages || [];
    const container = document.getElementById('chatMessages');
    if (!container) return;
    if (!msgs.length) {
      container.innerHTML = `<div style="text-align:center;color:#9ca3af;font-size:.8rem;margin-top:40px">No messages yet. Say hello! 👋</div>`;
    } else {
      container.innerHTML = '';
      msgs.forEach(m => appendMessage(m));
    }
    scrollChatToBottom();
  } catch (err) {
    const container = document.getElementById('chatMessages');
    if (container) container.innerHTML = `<div style="text-align:center;color:#ef4444">Failed to load messages</div>`;
  }
}

function appendMessage(msg) {
  const container = document.getElementById('chatMessages');
  if (!container) return;
  const isMe = String(msg.sender_id) === String(currentUser.id);
  const div = document.createElement('div');
  div.style.cssText = `display:flex;flex-direction:column;align-items:${isMe ? 'flex-end' : 'flex-start'};margin-bottom:4px`;
  div.innerHTML = `
    <div style="max-width:70%;padding:10px 14px;border-radius:${isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px'};background:${isMe ? 'linear-gradient(135deg,#2d7a31,#3a9e40)' : 'white'};color:${isMe ? 'white' : '#111827'};box-shadow:0 1px 3px rgba(0,0,0,.08);font-size:.88rem;line-height:1.5;word-break:break-word">${msg.content}</div>
    <span style="font-size:.65rem;color:#9ca3af;margin-top:2px">${timeAgo(msg.created_at)}</span>`;
  container.appendChild(div);
}

function scrollChatToBottom() {
  const el = document.getElementById('chatMessages');
  if (el) el.scrollTop = el.scrollHeight;
}

async function sendChatMessage(partnerId) {
  const input = document.getElementById('chatInput');
  if (!input) return;
  const content = input.value.trim();
  if (!content) return;
  input.value = '';

  if (socket) socket.emit('chat:typing', { partnerId, isTyping: false });

  const tempDiv = document.createElement('div');
  tempDiv.setAttribute('data-temp', 'true');
  tempDiv.setAttribute('data-content', content);
  tempDiv.style.cssText = 'display:flex;flex-direction:column;align-items:flex-end;margin-bottom:4px';
  tempDiv.innerHTML = `
    <div style="max-width:70%;padding:10px 14px;border-radius:18px 18px 4px 18px;background:linear-gradient(135deg,#2d7a31,#3a9e40);color:white;box-shadow:0 1px 3px rgba(0,0,0,.08);font-size:.88rem;line-height:1.5;word-break:break-word;opacity:0.75">${content}</div>
    <span style="font-size:.65rem;color:#9ca3af;margin-top:2px">Sending...</span>`;

  const container = document.getElementById('chatMessages');
  if (container) { container.appendChild(tempDiv); scrollChatToBottom(); }

  if (socket && socket.connected) {
    socket.emit('chat:message', { receiverId: partnerId, content, tempId: Date.now() });
  } else {
    try {
      const res = await chatAPI.send(partnerId, content);
      if (tempDiv.parentNode) tempDiv.remove();
      appendMessage(res.message);
      scrollChatToBottom();
      loadConversationList();
    } catch (err) {
      if (tempDiv.parentNode) tempDiv.remove();
      toast('Failed to send message', 'error');
    }
  }
}

async function showNewChatSearch() {
  const listEl = document.getElementById('chatList');
  listEl.innerHTML = `
    <div style="padding:12px">
      <input type="text" id="userSearchInput" placeholder="Search farmers, buyers, providers..."
             style="width:100%;padding:8px 12px;border:1.5px solid #e5e7eb;border-radius:8px;font-size:.85rem;font-family:'DM Sans',sans-serif;outline:none;box-sizing:border-box"
             oninput="searchUsersForChat(this.value)"/>
      <div id="userSearchResults" style="margin-top:8px"></div>
    </div>`;
  document.getElementById('userSearchInput').focus();
}

async function searchUsersForChat(query) {
  const resultsEl = document.getElementById('userSearchResults');
  if (!query || query.length < 2) { resultsEl.innerHTML = ''; return; }
  try {
    const res = await userAPI.search({ q: query });
    const users = (res.users || []).filter(u => u.id !== currentUser.id);
    if (!users.length) {
      resultsEl.innerHTML = `<div style="padding:10px;color:#9ca3af;font-size:.82rem">No users found</div>`;
      return;
    }
    const roleEmoji = { farmer:'👨‍🌾', buyer:'🛒', provider:'🔧' };
    resultsEl.innerHTML = users.map(u => `
      <div onclick="openChat(${u.id},'${u.name.replace(/'/g,"\\'")}','${u.role}')"
           style="padding:10px;border-radius:8px;cursor:pointer;display:flex;align-items:center;gap:10px;transition:background .15s"
           onmouseover="this.style.background='#f0fdf4'" onmouseout="this.style.background=''">
        <div style="width:34px;height:34px;border-radius:50%;background:#255c28;color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.85rem;flex-shrink:0">${u.name[0]}</div>
        <div>
          <div style="font-weight:600;font-size:.88rem">${u.name}</div>
          <div style="font-size:.72rem;color:#6b7280">${roleEmoji[u.role]||''} ${u.role} · ${u.state||''}</div>
        </div>
      </div>`).join('');
  } catch (err) {
    resultsEl.innerHTML = `<div style="padding:10px;color:#ef4444;font-size:.82rem">Search failed</div>`;
  }
}

function startChatAndGo(userId) {
  if (!currentUser) { showPage('auth'); toast('Please login first', ''); return; }
  activeChatPartnerId = userId;
  showPage('chat');
}

/* ═══════════════════════════════════════════
   MODALS
═══════════════════════════════════════════ */
function showModal(id) { const el = document.getElementById(id); if (el) el.classList.add('open'); }
function closeModal(id) { const el = document.getElementById(id); if (el) el.classList.remove('open'); }

/* ═══════════════════════════════════════════
   TOAST
═══════════════════════════════════════════ */
function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type} show`;
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => el.classList.remove('show'), 3500);
}

function animateNumber(elementId, targetValue, duration = 1000) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const startTime = performance.now();
  function update(currentTime) {
    const progress = Math.min((currentTime - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(targetValue * eased);
    el.textContent = current.toLocaleString();
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

/* ═══════════════════════════════════════════
   REVIEWS & RATINGS
═══════════════════════════════════════════ */
async function openReviewsPage(userId) {
  document.getElementById('reviewsModalTitle').textContent = '⭐ Reviews & Ratings';
  document.getElementById('reviewsModalBody').innerHTML = `<div style="text-align:center;padding:40px;color:#6b7280">Loading reviews...</div>`;
  showModal('reviewsPageModal');
  try {
    const res = await reviewAPI.getByUser(userId);
    renderReviewsModal(res.reviews || [], res.stats || {}, userId);
  } catch (err) {
    document.getElementById('reviewsModalBody').innerHTML = `<div style="text-align:center;color:#ef4444;padding:30px">${err.message}</div>`;
  }
}

function renderReviewsModal(reviews, stats, userId) {
  const avg   = stats.average || 0;
  const total = stats.total   || 0;

  const bars = [5,4,3,2,1].map(n => {
    const count = stats[['','one','two','three','four','five'][n]] || 0;
    const pct   = total > 0 ? Math.round((count/total)*100) : 0;
    return `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <span style="font-size:.82rem;color:#374151;width:30px">${n}★</span>
      <div style="flex:1;background:#f3f4f6;border-radius:4px;height:8px">
        <div style="width:${pct}%;background:#f59e0b;height:8px;border-radius:4px;transition:width .5s"></div>
      </div>
      <span style="font-size:.78rem;color:#6b7280;width:28px">${count}</span>
    </div>`;
  }).join('');

  const reviewCards = reviews.length ? reviews.map(r => `
    <div style="background:white;border:1px solid #f3f4f6;border-radius:12px;padding:16px;margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div style="width:36px;height:36px;border-radius:50%;background:#255c28;color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.85rem;flex-shrink:0">${r.reviewer_name ? r.reviewer_name[0].toUpperCase() : 'U'}</div>
        <div style="flex:1">
          <div style="font-weight:700;font-size:.9rem">${r.reviewer_name || 'User'}</div>
          <div style="font-size:.75rem;color:#9ca3af">${timeAgo(r.created_at)}</div>
        </div>
        <div style="color:#f59e0b;font-size:1rem">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div>
      </div>
      ${r.product_name ? `<div style="font-size:.78rem;color:#2d7a31;margin-bottom:6px;background:#e8f5e9;padding:4px 10px;border-radius:20px;display:inline-block">${r.product_emoji||'🌾'} ${r.product_name}</div>` : ''}
      ${r.service_title ? `<div style="font-size:.78rem;color:#92400e;margin-bottom:6px;background:#fef3c7;padding:4px 10px;border-radius:20px;display:inline-block">⚙️ ${r.service_title}</div>` : ''}
      ${r.comment ? `<div style="font-size:.88rem;color:#4b5563;line-height:1.6;font-style:italic">"${r.comment}"</div>` : '<div style="font-size:.82rem;color:#9ca3af">No comment left.</div>'}
    </div>`).join('')
    : `<div style="text-align:center;padding:40px;color:#9ca3af"><div style="font-size:2.5rem;margin-bottom:10px">⭐</div><div>No reviews yet</div></div>`;

  document.getElementById('reviewsModalTitle').textContent = `⭐ ${avg} Rating · ${total} Review${total !== 1 ? 's' : ''}`;
  document.getElementById('reviewsModalBody').innerHTML = `
    <div style="background:#f9fafb;border-radius:12px;padding:20px;margin-bottom:20px;display:flex;gap:24px;align-items:center;flex-wrap:wrap">
      <div style="text-align:center;min-width:80px">
        <div style="font-size:3rem;font-weight:700;color:#111827;line-height:1">${avg || '—'}</div>
        <div style="color:#f59e0b;font-size:1.2rem;margin:4px 0">${'★'.repeat(Math.round(avg))}${'☆'.repeat(5-Math.round(avg))}</div>
        <div style="font-size:.78rem;color:#6b7280">${total} review${total !== 1 ? 's' : ''}</div>
      </div>
      <div style="flex:1;min-width:200px">${bars}</div>
    </div>
    <div id="liveReviewsList">${reviewCards}</div>`;
}

function openSubmitReview(params) {
  if (!currentUser) { showPage('auth'); toast('Please login to leave a review', ''); return; }
  const canReview =
    (params.type === 'product' && currentUser.role === 'buyer') ||
    (params.type === 'service' && currentUser.role === 'farmer');
  if (!canReview) {
    toast(params.type === 'product' ? 'Only buyers can review farmer products' : 'Only farmers can review provider services', '');
    return;
  }
  window._reviewParams = params;
  const typeLabel = params.type === 'service' ? 'Service Review' : 'Product Review';
  const typeEmoji = params.type === 'service' ? '⚙️' : '🌾';
  document.getElementById('submitReviewBody').innerHTML = `
    <div style="background:#f9fafb;border-radius:10px;padding:14px;margin-bottom:18px">
      <div style="font-weight:700;font-size:.95rem;color:#111827">${typeEmoji} ${params.name}</div>
      <div style="font-size:.8rem;color:#6b7280;margin-top:3px">${typeLabel}</div>
    </div>
    <div style="margin-bottom:18px">
      <label style="font-size:.85rem;font-weight:600;color:#374151;display:block;margin-bottom:10px">Your Rating</label>
      <div style="display:flex;gap:8px" id="starSelector">
        ${[1,2,3,4,5].map(n => `
          <button onclick="selectStar(${n})" id="star-${n}"
                  style="font-size:2rem;background:none;border:none;cursor:pointer;color:#d1d5db;transition:all .15s;padding:4px"
                  onmouseover="hoverStar(${n})" onmouseout="unhoverStar()">★</button>
        `).join('')}
      </div>
      <div id="starLabel" style="font-size:.82rem;color:#6b7280;margin-top:6px">Click a star to rate</div>
    </div>
    <div class="form-group">
      <label>Your Review <span style="font-weight:400;color:#9ca3af">(optional)</span></label>
      <textarea id="reviewComment" placeholder="Share your experience — quality, delivery, communication..." style="height:100px"></textarea>
    </div>
    <button class="btn-auth" onclick="submitReview()" id="submitReviewBtn" disabled style="opacity:0.5;cursor:not-allowed">⭐ Submit Review</button>`;
  window._selectedRating = 0;
  showModal('submitReviewModal');
}

function hoverStar(n) {
  [1,2,3,4,5].forEach(i => { document.getElementById(`star-${i}`).style.color = i <= n ? '#f59e0b' : '#d1d5db'; });
}

function unhoverStar() {
  const sel = window._selectedRating || 0;
  [1,2,3,4,5].forEach(i => { document.getElementById(`star-${i}`).style.color = i <= sel ? '#f59e0b' : '#d1d5db'; });
}

function selectStar(n) {
  window._selectedRating = n;
  const labels = ['','Terrible','Poor','Average','Good','Excellent'];
  const colors = ['','#ef4444','#f97316','#f59e0b','#84cc16','#22c55e'];
  document.getElementById('starLabel').textContent = `${n}/5 — ${labels[n]}`;
  document.getElementById('starLabel').style.color = colors[n];
  [1,2,3,4,5].forEach(i => {
    document.getElementById(`star-${i}`).style.color = i <= n ? '#f59e0b' : '#d1d5db';
    document.getElementById(`star-${i}`).style.transform = i <= n ? 'scale(1.15)' : 'scale(1)';
  });
  const btn = document.getElementById('submitReviewBtn');
  btn.disabled = false; btn.style.opacity = '1'; btn.style.cursor = 'pointer';
}

async function submitReview() {
  const params  = window._reviewParams;
  const rating  = window._selectedRating;
  const comment = document.getElementById('reviewComment')?.value.trim();
  if (!rating) { toast('Please select a star rating', 'error'); return; }
  const btn = document.getElementById('submitReviewBtn');
  btn.textContent = 'Submitting...';
  btn.disabled = true;
  try {
    const payload = { reviewed_id: params.reviewed_id, rating, comment, review_type: params.type, product_id: params.product_id || null, service_id: params.service_id || null };
    const res = await reviewAPI.submit(payload);
    closeModal('submitReviewModal');
    toast('Review submitted! ⭐ Thank you!', 'success');
    const liveList = document.getElementById('liveReviewsList');
    if (liveList) {
      const newCard = document.createElement('div');
      newCard.style.cssText = 'animation:fadeIn .4s ease';
      newCard.innerHTML = `
        <div style="background:#fffbeb;border:1px solid #fbbf24;border-radius:12px;padding:16px;margin-bottom:12px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            <div style="width:36px;height:36px;border-radius:50%;background:#255c28;color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.85rem">${currentUser.name[0].toUpperCase()}</div>
            <div style="flex:1">
              <div style="font-weight:700;font-size:.9rem">${currentUser.name} <span style="background:#dcfce7;color:#166534;padding:1px 8px;border-radius:20px;font-size:.7rem">You</span></div>
              <div style="font-size:.75rem;color:#9ca3af">just now</div>
            </div>
            <div style="color:#f59e0b">${'★'.repeat(rating)}${'☆'.repeat(5-rating)}</div>
          </div>
          ${comment ? `<div style="font-size:.88rem;color:#4b5563;font-style:italic">"${comment}"</div>` : ''}
        </div>`;
      liveList.insertBefore(newCard, liveList.firstChild);
    }
    if (window._socket && window._socket.connected) {
      window._socket.emit('review:new', { reviewed_id: params.reviewed_id, rating, reviewer_name: currentUser.name });
    }
  } catch (err) {
    toast(err.message || 'Failed to submit review', 'error');
    btn.textContent = '⭐ Submit Review';
    btn.disabled = false;
  }
}

/* ═══════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════ */
function formatDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return d; }
}
function timeAgo(d) {
  if (!d) return '';
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/* ═══════════════════════════════════════════
   INIT
═══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  
  // ── Handle OAuth redirect ──────────────────
  const urlParams = new URLSearchParams(window.location.search);
  const oauthStatus = urlParams.get('oauth');

  if (oauthStatus === 'success') {
    try {
      const token = urlParams.get('token');
      const user  = JSON.parse(decodeURIComponent(urlParams.get('user')));

      localStorage.setItem('ac_token', token);
      localStorage.setItem('ac_currentUser', JSON.stringify(user));
      currentUser = user;

      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);

      updateNavUser();
      updateNavLinks();
      showPage('marketplace');
      toast(`Welcome, ${user.name.split(' ')[0]}! 🌾`, 'success');
    } catch (e) {
      toast('Login failed. Please try again.', 'error');
      showPage('auth');
    }
  } else if (oauthStatus === 'failed') {
    window.history.replaceState({}, document.title, window.location.pathname);
    toast('Social login failed. Please try again.', 'error');
    showPage('auth');
  } else {
    // Normal app init
    const savedUser = localStorage.getItem('ac_currentUser');
    currentUser = savedUser ? JSON.parse(savedUser) : null;
    updateNavUser();
    updateNavLinks();

    if (currentUser) {
      const lastPage = localStorage.getItem('ac_lastPage');
      const validPages = ['marketplace','services','orders','cart','chat','dashboard','my-profile'];
      const blockedForBuyer = currentUser.role === 'buyer' ? ['services'] : [];
      if (lastPage && validPages.includes(lastPage) && !blockedForBuyer.includes(lastPage)) {
        showPage(lastPage);
      } else {
        showPage('marketplace');
      }
    } else {
      showPage('home');
    }
  }
});