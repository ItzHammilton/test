const STORAGE_KEY = 'invfact_data_v1';
const SESSION_KEY = 'invfact_session_v1';

const rolePermissions = {
  Admin: ['dashboard', 'inventario', 'movimientos', 'facturacion', 'usuarios', 'configuracion'],
  Bodeguero: ['dashboard', 'inventario', 'movimientos'],
  Cajero: ['dashboard', 'facturacion']
};

const sectionLabels = {
  dashboard: 'Dashboard',
  inventario: 'Inventario',
  movimientos: 'Entradas y Salidas',
  facturacion: 'Facturación',
  usuarios: 'Usuarios y Roles',
  configuracion: 'Configuración'
};

const emptyData = {
  settings: { companyName: 'Mi Empresa', currency: 'USD', taxRate: 12 },
  users: [
    { id: crypto.randomUUID(), username: 'admin', password: '1234', role: 'Admin', name: 'Administrador General' },
    { id: crypto.randomUUID(), username: 'bodeguero', password: '1234', role: 'Bodeguero', name: 'Bodega Principal' },
    { id: crypto.randomUUID(), username: 'cajero', password: '1234', role: 'Cajero', name: 'Caja 1' }
  ],
  products: [
    { id: crypto.randomUUID(), name: 'Laptop Pro 14"', sku: 'LP-14', stock: 8, price: 950 },
    { id: crypto.randomUUID(), name: 'Mouse Inalámbrico', sku: 'MI-01', stock: 25, price: 18 }
  ],
  movements: [],
  invoices: []
};

let state = loadData();
let session = loadSession();
let currentSection = 'dashboard';

const appEl = document.getElementById('app');
const loginView = document.getElementById('loginView');
const loginForm = document.getElementById('loginForm');
const menuEl = document.getElementById('menu');
const viewEl = document.getElementById('view');
const titleEl = document.getElementById('sectionTitle');
const currentUserName = document.getElementById('currentUserName');
const currentUserRole = document.getElementById('currentUserRole');
const logoutBtn = document.getElementById('logoutBtn');

loginForm.addEventListener('submit', onLogin);
logoutBtn.addEventListener('click', logout);

bootstrap();

function bootstrap() {
  if (session) {
    showApp();
  } else {
    showLogin();
  }
}

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(emptyData));
    return structuredClone(emptyData);
  }
  return JSON.parse(raw);
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

function saveSession(newSession) {
  session = newSession;
  if (newSession) localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
  else localStorage.removeItem(SESSION_KEY);
}

function onLogin(e) {
  e.preventDefault();
  const user = document.getElementById('loginUser').value.trim();
  const pass = document.getElementById('loginPass').value;

  const found = state.users.find(u => u.username === user && u.password === pass);
  if (!found) {
    alert('Credenciales inválidas');
    return;
  }

  saveSession({ userId: found.id });
  showApp();
}

function logout() {
  saveSession(null);
  showLogin();
}

function getCurrentUser() {
  return state.users.find(u => u.id === session?.userId) || null;
}

function showLogin() {
  appEl.classList.add('hidden');
  loginView.classList.remove('hidden');
  loginForm.reset();
}

function showApp() {
  const user = getCurrentUser();
  if (!user) return logout();

  appEl.classList.remove('hidden');
  loginView.classList.add('hidden');
  currentUserName.textContent = user.name;
  currentUserRole.textContent = user.role;

  const allowed = rolePermissions[user.role] || [];
  if (!allowed.includes(currentSection)) currentSection = allowed[0] || 'dashboard';

  renderMenu(allowed);
  renderSection();
}

function renderMenu(sections) {
  menuEl.innerHTML = '';
  sections.forEach(section => {
    const btn = document.createElement('button');
    btn.textContent = sectionLabels[section];
    btn.className = section === currentSection ? 'active' : '';
    btn.addEventListener('click', () => {
      currentSection = section;
      renderMenu(sections);
      renderSection();
    });
    menuEl.appendChild(btn);
  });
}

function renderSection() {
  titleEl.textContent = sectionLabels[currentSection] || 'Módulo';
  switch (currentSection) {
    case 'dashboard': return renderDashboard();
    case 'inventario': return renderInventario();
    case 'movimientos': return renderMovimientos();
    case 'facturacion': return renderFacturacion();
    case 'usuarios': return renderUsuarios();
    case 'configuracion': return renderConfiguracion();
  }
}

function renderDashboard() {
  const totalStock = state.products.reduce((acc, p) => acc + Number(p.stock), 0);
  const totalValue = state.products.reduce((acc, p) => acc + Number(p.stock) * Number(p.price), 0);
  const entries = state.movements.filter(m => m.type === 'Entrada').length;
  const exits = state.movements.filter(m => m.type === 'Salida').length;

  viewEl.innerHTML = `
    <div class="grid cols-4">
      ${metricCard('Productos', state.products.length)}
      ${metricCard('Stock total', totalStock)}
      ${metricCard('Entradas', entries)}
      ${metricCard('Salidas', exits)}
    </div>
    <div class="grid cols-2">
      <div class="card">
        <h3>Valor de inventario</h3>
        <p class="hint">${money(totalValue)}</p>
      </div>
      <div class="card">
        <h3>Facturas emitidas</h3>
        <p class="hint">${state.invoices.length}</p>
      </div>
      <div class="card">
        <h3>Movimientos recientes</h3>
        ${renderTable(
          ['Fecha', 'Tipo', 'Producto', 'Cantidad'],
          state.movements.slice(-5).reverse().map(m => [fmtDate(m.date), m.type, productName(m.productId), m.qty])
        )}
      </div>
      <div class="card">
        <h3>Facturas recientes</h3>
        ${renderTable(
          ['Fecha', 'Cliente', 'Total'],
          state.invoices.slice(-5).reverse().map(i => [fmtDate(i.date), i.customer, money(i.total)])
        )}
      </div>
    </div>
  `;
}

function renderInventario() {
  viewEl.innerHTML = `
    <div class="card">
      <h3>Nuevo producto</h3>
      <form id="productForm" class="form-inline">
        <label>Nombre <input required name="name" /></label>
        <label>SKU <input required name="sku" /></label>
        <label>Stock inicial <input required type="number" min="0" step="1" name="stock" /></label>
        <label>Precio <input required type="number" min="0" step="0.01" name="price" /></label>
        <button class="btn" type="submit">Agregar</button>
      </form>
    </div>
    <div class="card">
      <h3>Catálogo</h3>
      ${renderTable(
        ['SKU', 'Producto', 'Stock', 'Precio'],
        state.products.map(p => [p.sku, p.name, p.stock, money(p.price)])
      )}
    </div>
  `;

  document.getElementById('productForm').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    state.products.push({
      id: crypto.randomUUID(),
      name: String(fd.get('name')),
      sku: String(fd.get('sku')),
      stock: Number(fd.get('stock')),
      price: Number(fd.get('price'))
    });
    saveData();
    renderInventario();
  });
}

function renderMovimientos() {
  viewEl.innerHTML = `
    <div class="card">
      <h3>Registrar entrada o salida</h3>
      <form id="movementForm" class="form-inline">
        <label>Tipo
          <select name="type"><option>Entrada</option><option>Salida</option></select>
        </label>
        <label>Producto
          <select name="productId">${state.products.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}</select>
        </label>
        <label>Cantidad <input required type="number" min="1" step="1" name="qty" /></label>
        <button class="btn btn-warning" type="submit">Registrar</button>
      </form>
    </div>
    <div class="card">
      <h3>Historial</h3>
      ${renderTable(
        ['Fecha', 'Tipo', 'Producto', 'Cantidad', 'Usuario'],
        state.movements.slice().reverse().map(m => [fmtDate(m.date), m.type, productName(m.productId), m.qty, userName(m.userId)])
      )}
    </div>
  `;

  document.getElementById('movementForm').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const type = String(fd.get('type'));
    const productId = String(fd.get('productId'));
    const qty = Number(fd.get('qty'));
    const product = state.products.find(p => p.id === productId);
    if (!product) return;
    if (type === 'Salida' && product.stock < qty) {
      alert('No hay stock suficiente para la salida.');
      return;
    }
    product.stock += type === 'Entrada' ? qty : -qty;
    state.movements.push({ id: crypto.randomUUID(), type, productId, qty, date: new Date().toISOString(), userId: getCurrentUser().id });
    saveData();
    renderMovimientos();
  });
}

function renderFacturacion() {
  viewEl.innerHTML = `
    <div class="card">
      <h3>Nueva factura</h3>
      <form id="invoiceForm" class="form-inline">
        <label>Cliente <input required name="customer" /></label>
        <label>Producto
          <select name="productId">${state.products.map(p => `<option value="${p.id}">${p.name} (${p.stock})</option>`).join('')}</select>
        </label>
        <label>Cantidad <input required type="number" min="1" step="1" name="qty" /></label>
        <button class="btn btn-success" type="submit">Emitir</button>
      </form>
    </div>
    <div class="card">
      <h3>Facturas</h3>
      ${renderTable(
        ['Nro', 'Fecha', 'Cliente', 'Subtotal', 'Impuesto', 'Total'],
        state.invoices.slice().reverse().map(i => [i.number, fmtDate(i.date), i.customer, money(i.subtotal), money(i.tax), money(i.total)])
      )}
    </div>
  `;

  document.getElementById('invoiceForm').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const customer = String(fd.get('customer'));
    const productId = String(fd.get('productId'));
    const qty = Number(fd.get('qty'));
    const product = state.products.find(p => p.id === productId);
    if (!product || product.stock < qty) {
      alert('Stock insuficiente para facturar.');
      return;
    }
    product.stock -= qty;
    const subtotal = product.price * qty;
    const tax = subtotal * (Number(state.settings.taxRate) / 100);
    const total = subtotal + tax;

    state.invoices.push({
      id: crypto.randomUUID(),
      number: `F-${String(state.invoices.length + 1).padStart(4, '0')}`,
      date: new Date().toISOString(),
      customer,
      productId,
      qty,
      subtotal,
      tax,
      total,
      userId: getCurrentUser().id
    });

    state.movements.push({ id: crypto.randomUUID(), type: 'Salida', productId, qty, date: new Date().toISOString(), userId: getCurrentUser().id });
    saveData();
    renderFacturacion();
  });
}

function renderUsuarios() {
  viewEl.innerHTML = `
    <div class="card">
      <h3>Registrar usuario</h3>
      <form id="userForm" class="form-inline">
        <label>Nombre <input required name="name" /></label>
        <label>Usuario <input required name="username" /></label>
        <label>Contraseña <input required name="password" /></label>
        <label>Rol
          <select name="role"><option>Admin</option><option>Bodeguero</option><option>Cajero</option></select>
        </label>
        <button class="btn" type="submit">Crear</button>
      </form>
    </div>
    <div class="card">
      <h3>Usuarios existentes</h3>
      ${renderTable(['Nombre', 'Usuario', 'Rol'], state.users.map(u => [u.name, u.username, u.role]))}
    </div>
  `;

  document.getElementById('userForm').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const username = String(fd.get('username'));
    if (state.users.some(u => u.username === username)) {
      alert('Usuario ya existe.');
      return;
    }
    state.users.push({
      id: crypto.randomUUID(),
      name: String(fd.get('name')),
      username,
      password: String(fd.get('password')),
      role: String(fd.get('role'))
    });
    saveData();
    renderUsuarios();
  });
}

function renderConfiguracion() {
  viewEl.innerHTML = `
    <div class="card">
      <h3>Preferencias del sistema</h3>
      <form id="settingsForm" class="form-inline">
        <label>Empresa <input required name="companyName" value="${state.settings.companyName}" /></label>
        <label>Moneda
          <select name="currency">
            ${['USD', 'EUR', 'COP', 'MXN', 'PEN'].map(c => `<option ${state.settings.currency === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </label>
        <label>Impuesto % <input required type="number" min="0" max="100" step="0.1" name="taxRate" value="${state.settings.taxRate}" /></label>
        <button class="btn" type="submit">Guardar</button>
      </form>
      <div class="actions" style="margin-top:1rem;">
        <button class="btn btn-danger" id="resetDataBtn">Restablecer datos demo</button>
      </div>
    </div>
  `;

  document.getElementById('settingsForm').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    state.settings = {
      companyName: String(fd.get('companyName')),
      currency: String(fd.get('currency')),
      taxRate: Number(fd.get('taxRate'))
    };
    saveData();
    alert('Configuración guardada.');
  });

  document.getElementById('resetDataBtn').addEventListener('click', () => {
    if (!confirm('¿Seguro que deseas restablecer todos los datos?')) return;
    state = structuredClone(emptyData);
    saveData();
    showApp();
  });
}

function metricCard(label, value) {
  return `<article class="card metric"><h4>${label}</h4><strong>${value}</strong></article>`;
}

function renderTable(headers, rows) {
  if (!rows.length) return '<p class="hint">Sin registros.</p>';
  return `
    <div class="table-wrap">
      <table class="table">
        <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>
          ${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function productName(id) {
  return state.products.find(p => p.id === id)?.name || 'Producto eliminado';
}

function userName(id) {
  return state.users.find(u => u.id === id)?.name || '-';
}

function money(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: state.settings.currency || 'USD' }).format(Number(n || 0));
}

function fmtDate(iso) {
  return new Date(iso).toLocaleString('es-ES');
}
