// ============================================================
// Águila Inventario Pro - inventory.js (VERSIÓN PRO 2025)
// Motor de inventario: eficiente, seguro y diseñado para promotores.
// - Render visual (cards) optimizado
// - Integración con inventory-enhanced.js (buscador/collapsibles)
// - Protección de listeners y manejo de errores
// - Debounce y batching para rendimiento móvil
// ============================================================

/* global firebase, showToast, switchTab */

(() => {
  'use strict';

  // --------------------------
  // Estado
  // --------------------------
  let inventoryData = [];        // lista completa desde Firebase
  let filteredInventory = [];    // lista luego de filtros/búsqueda
  let currentBrandFilter = localStorage.getItem('aguila_brand_filter') || 'all';
  let userDeterminante = null;
  let mostrarProductosSinStock = false;
  let currentEditingProduct = null;

  // Listeners controla
  let inventoryListener = null;
  let currentInventoryPath = null;

  // DOM cache
  const DOM = {
    list: () => document.getElementById('inventory-list'),
    search: () => document.getElementById('inventory-search'),
    brandFilters: () => document.getElementById('brand-filters')
  };

  // Config expiries
  const BRAND_EXPIRY_CONFIG = {
    'Sabritas': 30,
    'Gamesa': 60,
    'Quaker': 60,
    "Sonric's": 60,
    'Cacahuate': 30,
    'default': 60
  };

  // --------------------------
  // Utilities
  // --------------------------
  function log(...args) { console.log('[inventory]', ...args); }
  function safeToast(msg, type = 'info') { try { if (typeof showToast === 'function') showToast(msg, type); else console.log('[toast]', type, msg); } catch(e) { console.log('[toast fail]', msg, e); } }

  function toInt(v, fallback = 0) {
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? fallback : n;
  }

  function formatDateIfAny(d) {
    if (!d) return '';
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return '';
      return dt.toLocaleDateString('es-MX');
    } catch (e) { return d; }
  }

  // Debounce helper
  function debounce(fn, wait = 200) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  // --------------------------
  // Stop listeners (expuesto)
  // --------------------------
  window.stopAllListeners = function() {
    log('Stopping inventory listeners...');
    try {
      if (inventoryListener && currentInventoryPath && firebase && firebase.database) {
        firebase.database().ref(currentInventoryPath).off('value', inventoryListener);
        log('Inventory listener detached.');
      }
    } catch (err) {
      console.warn('Error detaching inventory listener', err);
    } finally {
      inventoryListener = null;
      currentInventoryPath = null;
      inventoryData = [];
      filteredInventory = [];
    }
  };

  // --------------------------
  // Obtener determinante
  // --------------------------
  async function getUserDeterminante() {
    if (userDeterminante) return userDeterminante;
    try {
      const user = firebase.auth().currentUser;
      if (!user) {
        log('No firebase user for determinante.');
        return null;
      }
      const snap = await firebase.database().ref('usuarios/' + user.uid).once('value');
      const data = snap.val();
      if (!data) return null;
      // Normalizar a string (ej: 5232 -> "5232")
      userDeterminante = data.determinante !== undefined && data.determinante !== null ? String(data.determinante) : null;
      return userDeterminante;
    } catch (err) {
      console.error('Error getting determinante', err);
      return null;
    }
  }

  // --------------------------
  // Load inventory (listener protegido)
  // --------------------------
  async function loadInventory() {
    const listEl = DOM.list();
    if (!listEl) {
      console.warn('inventory-list element not found');
      return;
    }

    // Mensaje inicial
    listEl.innerHTML = `<p style="color:var(--text-muted)">Cargando inventario...</p>`;

    // Detener listeners previos
    window.stopAllListeners();

    userDeterminante = await getUserDeterminante();
    if (!userDeterminante) {
      if (firebase.auth().currentUser) {
        listEl.innerHTML = `<p style="color:#ef4444">❌ No se encontró ID de tienda.</p>`;
        safeToast('Error: No se encontró ID de su tienda', 'error');
      } else {
        listEl.innerHTML = `<p style="color:var(--text-muted)">Inicia sesión para ver inventario.</p>`;
      }
      return;
    }

    currentInventoryPath = 'inventario/' + userDeterminante;

    inventoryListener = snapshot => {
      try {
        const raw = snapshot.val();
        inventoryData = [];

        if (raw) {
          inventoryData = Object.keys(raw).map(key => ({ id: key, ...raw[key] }));
          log('Inventory loaded:', inventoryData.length);
          applyFiltersAndRender();            // filtro y render
          updateDashboardStats(inventoryData); // estadisticas
          generateBrandFilters(inventoryData); // filtros por marca
        } else {
          inventoryData = [];
          filteredInventory = [];
          listEl.innerHTML = `<p style="color:var(--text-muted)">Aún no hay productos registrados. Usa "Agregar".</p>`;
          updateDashboardStats([]);
          generateBrandFilters([]);
        }
      } catch (err) {
        console.error('Error processing inventory snapshot', err);
        listEl.innerHTML = `<p style="color:#ef4444">❌ Error procesando inventario.</p>`;
      }
    };

    const errorCallback = error => {
      if (!firebase.auth().currentUser) {
        log('Inventory error ignored (no user).');
        return;
      }
      if (error && error.code === 'PERMISSION_DENIED') {
        log('Inventory permission denied (likely logging out).');
        return;
      }
      console.error('Firebase inventory error', error);
      const el = DOM.list();
      if (el) el.innerHTML = `<p style="color:#ef4444">❌ Error de conexión. Verifica tu internet.</p>`;
      safeToast('Error de conexión: ' + (error?.message || 'unknown'), 'error');
    };

    try {
      firebase.database().ref(currentInventoryPath).on('value', inventoryListener, errorCallback);
    } catch (err) {
      console.error('Error attaching inventory listener', err);
      safeToast('No se pudo conectar con inventario', 'error');
    }
  }

  // --------------------------
  // Render (optimized batch)
  // --------------------------
  function renderInventoryList() {
    const listEl = DOM.list();
    if (!listEl) return;

    // Si no hay elementos filtrados
    const visible = filteredInventory.filter(p => mostrarProductosSinStock ? true : (toInt(p.cajas, 0) > 0));
    if (!visible.length) {
      listEl.innerHTML = `<p style="color:var(--text-muted)">✅ Sin productos que mostrar</p>`;
      return;
    }

    // Agrupar por codigoBarras y sumar totales (map)
    const grouped = {};
    visible.forEach(prod => {
      const code = prod.codigoBarras || prod.id;
      if (!grouped[code]) {
        grouped[code] = {
          nombre: prod.nombre || 'Sin nombre',
          marca: prod.marca || 'Otra',
          codigoBarras: prod.codigoBarras || '',
          piezasPorCaja: toInt(prod.piezasPorCaja, 0),
          bodegas: [],
          totalCajas: 0
        };
      }
      grouped[code].bodegas.push({
        id: prod.id,
        ubicacion: prod.ubicacion || 'Sin bodega',
        cajas: toInt(prod.cajas, 0),
        fechaCaducidad: prod.fechaCaducidad || ''
      });
      grouped[code].totalCajas += toInt(prod.cajas, 0);
    });

    // Agrupar por marca
    const byBrand = {};
    Object.values(grouped).forEach(prod => {
      const marca = prod.marca || 'Otra';
      if (!byBrand[marca]) byBrand[marca] = [];
      // calcular totalPiezas
      prod.totalPiezas = prod.totalCajas * (prod.piezasPorCaja || 0);
      byBrand[marca].push(prod);
    });

    // Orden de marcas preferido
    const preferred = ['Sabritas', 'Gamesa', 'Quaker', "Sonric's", 'Otra'];
    const marcas = Array.from(new Set([...preferred.filter(m => byBrand[m]), ...Object.keys(byBrand).filter(m => !preferred.includes(m))]));

    // Construir HTML por batch usando DocumentFragment -> innerHTML por marca
    const fragment = document.createDocumentFragment();
    const container = document.createElement('div');

    marcas.forEach(marca => {
      const products = (byBrand[marca] || []).sort((a,b) => a.nombre.localeCompare(b.nombre));

      // Marca header
      const brandSection = document.createElement('div');
      brandSection.setAttribute('data-brand-section', marca);
      brandSection.style.marginBottom = '24px';

      // Header HTML
      const header = document.createElement('div');
      header.setAttribute('data-brand-header', '');
      header.setAttribute('data-brand-name', marca);
      header.style.cssText = `background:linear-gradient(135deg,var(--primary),#003a8a);
                              color:white;padding:12px 16px;border-radius:8px;
                              margin-bottom:12px;font-weight:700;font-size:14px;
                              cursor:pointer;display:flex;justify-content:space-between;align-items:center;`;
      header.innerHTML = `<span>🏷️ ${marca} (<span data-product-count>${products.length}</span> productos)</span><span style="font-size:12px;">▼</span>`;

      brandSection.appendChild(header);

      // Products list (use innerHTML building for performance)
      const productsDiv = document.createElement('div');
      productsDiv.setAttribute('data-products-list', '');
      productsDiv.style.display = 'block';
      productsDiv.style.transition = 'all .25s';

      // Build inner HTML for products of this brand
      let inner = '';
      products.forEach(product => {
        const tieneMuchasBodegas = (product.bodegas || []).length > 1;

        // compute nearest expiry days
        let minDays = Infinity;
        (product.bodegas || []).forEach(b => {
          if (b.fechaCaducidad) {
            const d = new Date(b.fechaCaducidad);
            if (!isNaN(d.getTime())) {
              const diff = Math.ceil((d.getTime() - Date.now()) / (1000*60*60*24));
              if (diff < minDays) minDays = diff;
            }
          }
        });
        const threshold = BRAND_EXPIRY_CONFIG[product.marca] || BRAND_EXPIRY_CONFIG['default'];
        let expiryTag = '';
        if (minDays === Infinity) {
          expiryTag = '';
        } else if (minDays <= 0) {
          expiryTag = `<span class="expiry-badge expired">🔴 VENCIDO</span>`;
        } else if (minDays <= threshold) {
          expiryTag = `<span class="expiry-badge warning">🟡 VENCE EN ${minDays} DÍAS</span>`;
        } else {
          expiryTag = `<span class="expiry-badge good">✅ ${minDays} días</span>`;
        }

        // Bodegas list HTML
        const bodegasHtml = product.bodegas.map(b => {
          const days = b.fechaCaducidad ? (() => {
            const d = new Date(b.fechaCaducidad);
            if (isNaN(d.getTime())) return '';
            return Math.ceil((d.getTime() - Date.now()) / (1000*60*60*24));
          })() : '';
          return `<li style="padding:8px;margin:5px 0;background:#f8fafc;border-left:3px solid var(--primary);border-radius:4px;">
                    <strong>${b.ubicacion}:</strong> ${b.cajas} cajas
                    ${b.fechaCaducidad ? `<br><small style="color:var(--text-muted);font-size:0.85em;">Cad: ${formatDateIfAny(b.fechaCaducidad)} ${days !== ''? '('+days+' días)':''}</small>` : ''}
                    <br><button onclick="inventoryEditProduct('${b.id}')" style="margin-top:6px;padding:4px 8px;background:var(--primary);color:white;border:none;border-radius:4px;cursor:pointer;font-size:11px;">✏️ Editar</button>
                  </li>`;
        }).join('');

        inner += `
          <div data-product-item data-product-name="${escapeHtml(product.nombre)}" data-product-code="${escapeHtml(product.codigoBarras)}"
               class="card" style="background:var(--bg-card);border-left:4px solid var(--primary);margin-bottom:10px;padding:12px;border-radius:8px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
              <div style="flex:1;">
                <h4 style="margin:0 0 8px 0;color:var(--primary);">${escapeHtml(product.nombre)}</h4>
                <div style="font-size:13px;color:var(--text-muted);line-height:1.6;">
                  <div>📍 Código: <strong>${escapeHtml(product.codigoBarras || 'N/A')}</strong></div>
                  <div>📦 ${product.piezasPorCaja || 0} piezas/caja</div>
                  <div>${expiryTag}</div>
                </div>
              </div>
              <div style="text-align:right;min-width:110px;">
                <div style="font-size:28px;font-weight:700;color:var(--success);">${product.totalCajas}</div>
                <div style="font-size:12px;color:var(--text-muted);">cajas totales</div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${product.totalPiezas || 0} piezas</div>
              </div>
            </div>

            ${tieneMuchasBodegas ? `
              <details class="bodega-details" style="margin-top:12px;border:1px solid var(--border);border-radius:8px;padding:10px;">
                <summary style="cursor:pointer;font-weight:600;color:var(--primary);padding:5px;">📍 Bodegas (${product.bodegas.length})</summary>
                <ul class="bodega-list" style="list-style:none;padding:10px 0 0 0;margin:0;">${bodegasHtml}</ul>
              </details>` : `
              <div style="margin-top:10px;font-size:13px;color:var(--text-muted);">
                <strong>🏢 Bodega:</strong> ${escapeHtml((product.bodegas[0]||{}).ubicacion || 'N/A')}
                ${(product.bodegas[0] && product.bodegas[0].fechaCaducidad) ? `<br><strong>📅 Caducidad:</strong> ${formatDateIfAny(product.bodegas[0].fechaCaducidad)}` : ''}
              </div>`}

            <div style="margin-top:12px;">
              <button onclick="inventoryEditProduct('${(product.bodegas[0]||{}).id || ''}')" style="width:100%;padding:10px;background:var(--primary);color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;">✏️ Editar Producto</button>
            </div>
          </div>
        `;
      });

      productsDiv.innerHTML = inner;
      brandSection.appendChild(productsDiv);
      container.appendChild(brandSection);
    });

    fragment.appendChild(container);

    // Replace list content in one operation
    listEl.innerHTML = '';
    listEl.appendChild(fragment);

    // After DOM is updated, init collapsibles and ensure search bar
    if (typeof ensureSearchBar === 'function') {
      try { ensureSearchBar(); } catch(e) { /* ignore */ }
    }
    if (typeof initCollapsibles === 'function') {
      try { initCollapsibles(); } catch(e) { /* ignore */ }
    }
  }

  // --------------------------
  // Apply filters and search
  // --------------------------
  function applyFiltersAndRender() {
    const searchInput = DOM.search();
    const searchTerm = (searchInput && searchInput.value) ? String(searchInput.value).toLowerCase() : '';

    filteredInventory = inventoryData.filter(p => {
      if (!mostrarProductosSinStock && toInt(p.cajas,0) === 0) return false;
      if (currentBrandFilter && currentBrandFilter !== 'all' && p.marca !== currentBrandFilter) return false;
      if (searchTerm) {
        const name = (p.nombre || '').toLowerCase();
        const brand = (p.marca || '').toLowerCase();
        const code = (p.codigoBarras || '').toLowerCase();
        return name.includes(searchTerm) || brand.includes(searchTerm) || code.includes(searchTerm);
      }
      return true;
    });

    renderInventoryList();
  }

  const debouncedApply = debounce(applyFiltersAndRender, 150);

  // --------------------------
  // Generate brand filters UI
  // --------------------------
  function generateBrandFilters(data) {
    const filterContainer = DOM.brandFilters();
    if (!filterContainer) return;

    const brands = Array.from(new Set(data.map(p => p.marca || 'Otra')));
    brands.sort((a,b) => a.localeCompare(b));

    let html = `<button class="brand-filter-btn ${currentBrandFilter === 'all' ? 'active' : ''}" data-brand="all" style="${filterButtonStyle(currentBrandFilter==='all')}">Todos</button>`;
    brands.forEach(brand => {
      const active = currentBrandFilter === brand;
      html += `<button class="brand-filter-btn ${active ? 'active' : ''}" data-brand="${escapeHtml(brand)}" style="${filterButtonStyle(active)}">${escapeHtml(brand)}</button>`;
    });

    filterContainer.innerHTML = html;

    // Attach listeners
    filterContainer.querySelectorAll('.brand-filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const b = btn.dataset.brand;
        currentBrandFilter = b || 'all';
        localStorage.setItem('aguila_brand_filter', currentBrandFilter);
        // visual feedback
        filterContainer.querySelectorAll('.brand-filter-btn').forEach(x => x.classList.remove('active'));
        btn.classList.add('active');
        debouncedApply();
      });
    });
  }

  function filterButtonStyle(active) {
    return `padding:8px 16px;border:1px solid var(--border);background:${active ? 'var(--primary)' : 'white'};color:${active ? 'white' : 'var(--text)'};border-radius:8px;cursor:pointer;margin:4px;font-size:12px;`;
  }

  // --------------------------
  // Placeholder for dashboard stats
  // --------------------------
  function updateDashboardStats(data) {
    // puedes añadir métricas reales aqui. Actualmente solo log.
    log('Updating dashboard stats. products:', data.length);
  }

  // --------------------------
  // Editing product - wrapper for onclicks in render
  // --------------------------
  async function inventoryEditProduct(productId) {
    // find the product in inventoryData by id
    const product = inventoryData.find(p => p.id === productId);
    if (!product) {
      safeToast('Producto no encontrado', 'error');
      return;
    }
    // set currentEditingProduct and open add tab with form filled
    currentEditingProduct = product;
    // Reuse the existing editarProducto logic if present, otherwise fill basic fields
    if (typeof editarProducto === 'function') {
      try { editarProducto(productId); return; } catch(e){ /* fallback below */ }
    }

    // Minimal fallback: fill form elements if exist
    const addTab = document.getElementById('tab-add');
    const inventoryTab = document.getElementById('tab-inventory');
    if (addTab && inventoryTab) {
      inventoryTab.classList.remove('active'); inventoryTab.classList.add('hidden');
      addTab.classList.remove('hidden'); addTab.classList.add('active');
      document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
      document.querySelector('[data-tab="add"]')?.classList.add('active');
    }

    const formTitle = document.querySelector('#tab-add h2');
    if (formTitle) formTitle.textContent = '✏️ Editar Producto';
    const f = document.getElementById('add-product-form');
    if (f) {
      f.querySelector('#add-barcode') && (f.querySelector('#add-barcode').value = product.codigoBarras || '');
      f.querySelector('#add-product-name') && (f.querySelector('#add-product-name').value = product.nombre || '');
      f.querySelector('#add-brand') && (f.querySelector('#add-brand').value = product.marca || '');
      f.querySelector('#add-pieces-per-box') && (f.querySelector('#add-pieces-per-box').value = product.piezasPorCaja || '');
      f.querySelector('#add-warehouse') && (f.querySelector('#add-warehouse').value = product.ubicacion || '');
      f.querySelector('#add-expiry-date') && (f.querySelector('#add-expiry-date').value = product.fechaCaducidad || '');
      f.querySelector('#add-boxes') && (f.querySelector('#add-boxes').value = product.cajas || 0);
    }
    safeToast('✏️ Editando ' + (product.nombre || ''), 'info');
  }

  // Expose for onclicks rendered in HTML
  window.inventoryEditProduct = inventoryEditProduct;

  // --------------------------
  // Helpers: escape html to mitigate