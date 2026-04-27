// ============================================================
// Águila Inventario Pro - Módulo: inventory-ui.js
// RENDER HTML - Versión Eagle Pro (Bento Grid & Modern Cards)
// ============================================================

function renderInventoryUI(productos, targetId = 'inventory-list') {
  try {
    const listElement = document.getElementById(targetId);
    if (!listElement) return;

    if (productos.length === 0) {
      listElement.innerHTML = `
        <div class="flex flex-col items-center justify-center py-20 text-slate-400">
          <span class="material-symbols-outlined text-6xl mb-4">inventory_2</span>
          <p class="font-medium">${targetId === 'inventory-list' ? 'Sin productos disponibles' : 'No hay productos agotados'}</p>
        </div>
      `;
      return;
    }

    // Si es la pestaña principal, renderizamos primero el Dashboard Summary
    let html = '';
    if (targetId === 'inventory-list') {
      html += renderDashboardSummary(productos);
    }

    const productosAgrupados = window.groupProductsByBarcode(productos);
    const productosPorMarca = window.groupProductsByBrand(productosAgrupados);
    const marcasOrdenadas = ['Sabritas', 'Gamesa', 'Quaker', "Sonric's", 'Cacahuates', 'Otra']
      .filter(marca => productosPorMarca[marca]);

    html += `<div class="space-y-8 mt-6">`;
    marcasOrdenadas.forEach(marca => {
      html += renderBrandSection(marca, productosPorMarca[marca], targetId);
    });
    html += `</div>`;

    listElement.innerHTML = html;
    setupBrandClickEvents();
    applyBrandStates();

  } catch (error) {
    console.error(`❌ [RENDER ERROR] ${targetId}:`, error);
  }
}

function renderDashboardSummary(productos) {
  const totalItems = productos.length;
  const criticalItems = productos.filter(p => (parseInt(p.cajas) || 0) <= 2).length;
  
  return `
    <div class="grid grid-cols-1 md:grid-cols-12 gap-6 mb-8">
      <!-- Total Products -->
      <div class="md:col-span-4 bg-white rounded-xl shadow-sm border-l-4 border-blue-700 p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
        <div class="flex justify-between items-start">
          <span class="material-symbols-outlined text-blue-700 bg-blue-50 p-2 rounded-lg">inventory_2</span>
          <span class="text-xs font-bold text-success bg-success/10 px-2 py-1 rounded">Live</span>
        </div>
        <div>
          <p class="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Total Productos</p>
          <p class="text-4xl font-extrabold text-primary">${totalItems.toLocaleString()}</p>
        </div>
      </div>

      <!-- Critical Stock -->
      <div class="md:col-span-4 bg-white rounded-xl shadow-sm border-l-4 border-error p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
        <div class="flex justify-between items-start">
          <span class="material-symbols-outlined text-error bg-error-container p-2 rounded-lg">warning</span>
          <span class="text-xs font-bold text-error bg-error/10 px-2 py-1 rounded">Atención</span>
        </div>
        <div>
          <p class="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Stock Crítico</p>
          <p class="text-4xl font-extrabold text-error">${criticalItems}</p>
        </div>
      </div>

      <!-- Scanner CTA -->
      <div onclick="window.switchTab('refill')" class="md:col-span-4 bg-primary-dark text-on-primary rounded-xl shadow-xl p-6 flex flex-col justify-center items-center text-center relative overflow-hidden group cursor-pointer active:scale-95 transition-transform duration-200">
        <div class="absolute top-0 right-0 w-32 h-32 bg-primary-container opacity-20 rounded-full -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-500"></div>
        <span class="material-symbols-outlined text-4xl mb-2">barcode_scanner</span>
        <h3 class="font-bold text-lg">¿Nuevo Cargamento?</h3>
        <p class="text-xs opacity-90 mb-4">Usa el Escáner Eagle</p>
        <button class="bg-white text-primary text-xs font-bold py-2 px-6 rounded-lg shadow-lg hover:bg-primary-light transition-colors">Abrir Escáner</button>
      </div>
    </div>
  `;
}

function renderBrandSection(marca, productos, targetId) {
  const totales = window.calculateBrandTotals(productos);
  const isExpanded = window.INVENTORY_STATE.marcasExpandidas[marca] !== false;

  return `
    <div data-brand-section="${marca}" data-container="${targetId}" class="mb-6">
      <div data-brand-header data-brand-name="${marca}" class="flex justify-between items-center bg-white border border-slate-200 p-4 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors shadow-sm">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center text-primary">
            <span class="material-symbols-outlined">${targetId === 'inventory-list' ? 'label' : 'block'}</span>
          </div>
          <div>
            <h3 class="font-bold text-slate-800">${marca}</h3>
            <p class="text-[10px] font-bold text-slate-400 uppercase">${totales.totalProductos} Items • ${totales.totalCajas} Cajas</p>
          </div>
        </div>
        <span data-brand-arrow class="material-symbols-outlined text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}">expand_more</span>
      </div>

      <div data-products-list class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-4 ${isExpanded ? '' : 'hidden'}">
        ${productos.map(product => renderProductCard(product, targetId)).join('')}
      </div>
    </div>
  `;
}

function renderProductCard(product, targetId) {
  const totalCajas = parseInt(product.totalCajas || product.cajas) || 0;
  const totalPiezas = parseInt(product.totalPiezas || product.piezas) || 0;
  const isLowStock = totalCajas > 0 && totalCajas <= 3;
  const isOutOfStock = totalCajas <= 0;
  
  let borderColor = 'border-success';
  let statusLabel = 'En Stock';
  let statusClass = 'bg-success/10 text-success-dark';
  
  if (isOutOfStock) {
    borderColor = 'border-error';
    statusLabel = 'Agotado';
    statusClass = 'bg-error/10 text-error-dark';
  } else if (isLowStock) {
    borderColor = 'border-warning';
    statusLabel = 'Bajo Stock';
    statusClass = 'bg-warning/10 text-warning-dark';
  }

  // Placeholder image based on brand for a visual look
  const brandLogos = {
    'Sabritas': 'https://www.pepsico.com.mx/images/librariesprovider18/marcas/sabritas-logo.png',
    'Gamesa': 'https://www.pepsico.com.mx/images/librariesprovider18/marcas/gamesa-logo.png',
    'Pepsi': 'https://www.pepsico.com.mx/images/librariesprovider18/marcas/pepsi-logo.png'
  };
  const imgUrl = product.imageUrl || 'https://via.placeholder.com/300x200?text=' + encodeURIComponent(product.nombre);

  return `
    <div class="bg-white rounded-xl shadow-sm border-l-4 ${borderColor} overflow-hidden hover:shadow-md transition-all group flex flex-col h-full" data-product-item data-product-name="${product.nombre}" data-product-code="${product.codigoBarras}">
      <div class="relative aspect-[16/10] overflow-hidden bg-slate-50">
        <img src="${imgUrl}" alt="${product.nombre}" class="w-full h-full object-contain p-4 group-hover:scale-110 transition-transform duration-500 ${isOutOfStock ? 'grayscale opacity-50' : ''}">
        <div class="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded text-[9px] font-bold text-slate-800 shadow-sm border border-slate-100">
          ${product.codigoBarras}
        </div>
      </div>
      
      <div class="p-4 flex flex-col flex-grow">
        <div class="flex justify-between items-start mb-3">
          <h3 class="text-sm font-bold text-slate-800 line-clamp-2 leading-tight">${product.nombre}</h3>
          <span class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase whitespace-nowrap ${statusClass}">${statusLabel}</span>
        </div>

        <div class="mt-auto">
          <div class="flex items-end justify-between mb-4">
            <div>
              <p class="text-[9px] font-bold text-slate-400 uppercase mb-1">Stock Actual</p>
              <div class="flex items-baseline gap-1">
                <span class="text-2xl font-black text-slate-900">${totalCajas}</span>
                <span class="text-[10px] font-bold text-slate-500">CAJAS</span>
              </div>
            </div>
            <div class="text-right">
              <p class="text-[9px] font-bold text-slate-400 uppercase mb-1">Piezas</p>
              <p class="text-sm font-bold text-slate-700">${totalPiezas} pzs</p>
            </div>
          </div>

          <div class="flex gap-2">
            <button onclick="window.editarProducto('${product.bodegas[0].id}')" class="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-1 border border-slate-100">
              <span class="material-symbols-outlined text-sm">edit</span> Editar
            </button>
            <button onclick="event.stopPropagation(); window.switchTab('refill'); setTimeout(() => { document.getElementById('refill-barcode').value = '${product.codigoBarras}'; window.searchProductForRefillSafe('${product.codigoBarras}'); }, 100);" class="flex-1 bg-primary text-white font-bold py-2 rounded-lg text-xs shadow-md shadow-blue-100 active:scale-95 transition-all flex items-center justify-center gap-1">
              <span class="material-symbols-outlined text-sm">sync_alt</span> Mover
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}


// ============================================================
// RENDERIZAR MÚLTIPLES BODEGAS
// ============================================================
function renderMultipleWarehouses(product, salesAvg = 0) {
  return `
    <details class="bodega-details" style="background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0;">
      <summary style="cursor: pointer; font-weight: 700; color: #2563eb; padding: 12px; font-size: 13px; display: flex; align-items: center; gap: 8px;">
        <span class="material-icons-round" style="font-size:18px;">place</span>
        Ubicado en ${product.bodegas.length} bodegas
      </summary>
      <ul style="list-style: none; padding: 0 12px 12px 12px; margin: 0; display: flex; flex-direction: column; gap: 8px;">
        ${product.bodegas.filter(b => b.cajas > 0).map(bodega => {
          const bodegaExpiry = bodega.fechaCaducidad ? new Date(bodega.fechaCaducidad) : null;
          const bodegaDays = bodegaExpiry 
            ? Math.ceil((bodegaExpiry.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
            : null;

          return `
            <li style="padding: 10px; background: white; border-radius: 8px; border: 1px solid #f1f5f9; display: flex; flex-direction: column; gap: 2px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 700; color: #1e293b;">${bodega.ubicacion}</span>
                <span style="font-weight: 800; color: #2563eb; font-size: 15px;">${bodega.cajas} <small style="font-weight:400; color:var(--muted);">caj</small></span>
              </div>
              <div style="font-size: 11px; color: var(--primary); font-weight: 600;">📈 Promedio: ${salesAvg} pzas/día</div>
              ${bodegaDays !== null ? `
                <div style="font-size: 11px; color: ${bodegaDays <= 30 ? '#ef4444' : '#64748b'}; font-weight: 500; margin-top: 2px;">
                  📅 Cad: ${bodega.fechaCaducidad} (${bodegaDays} días)
                </div>
              ` : ''}
            </li>
          `;
        }).join('')}
      </ul>
    </details>
  `;
}

// ============================================================
// RENDERIZAR BODEGA ÚNICA
// ============================================================
function renderSingleWarehouse(product, salesAvg = 0) {
  const bodega = product.bodegas[0];
  const bodegaExpiry = bodega.fechaCaducidad ? new Date(bodega.fechaCaducidad) : null;
  const bodegaDays = bodegaExpiry 
    ? Math.ceil((bodegaExpiry.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null;
  
  return `
    <div style="padding: 12px; background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 4px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 13px; color: #475569; display: flex; align-items: center; gap: 6px;">
          <span class="material-icons-round" style="font-size:16px;">business</span>
          <strong>Bodega:</strong> ${bodega.ubicacion}
        </span>
      </div>
      <div style="font-size: 11px; color: var(--primary); font-weight: 600;">📈 Promedio de venta: ${salesAvg} pzas/día</div>
      ${bodega.fechaCaducidad ? `
        <div style="font-size: 11px; color: ${bodegaDays <= 30 ? '#ef4444' : '#64748b'}; font-weight: 500;">
          📅 Caducidad: <strong>${bodega.fechaCaducidad}</strong> (${bodegaDays || '?'} días)
        </div>
      ` : ''}
    </div>
  `;
}

// ============================================================
// EDITAR PRODUCTO (GLOBAL WINDOW)
// ============================================================
window.editarProducto = async function(productId) {
  console.log('✏️ Editando producto:', productId);

  const product = window.INVENTORY_STATE.productos.find(p => p.id === productId);

  if (!product) {
    if (typeof showToast === 'function') showToast('❌ Producto no encontrado', 'error');
    return;
  }

  if (typeof window.switchTab === 'function') window.switchTab('add');

  setTimeout(() => {
    document.getElementById('add-barcode').value = product.codigoBarras || '';
    document.getElementById('add-product-name').value = product.nombre || '';
    document.getElementById('add-brand').value = product.marca || '';
    document.getElementById('add-pieces-per-box').value = product.piezasPorCaja || '';
    document.getElementById('add-warehouse').value = product.ubicacion || '';
    document.getElementById('add-expiry-date').value = product.fechaCaducidad || '';
    document.getElementById('add-boxes').value = product.stockTotal || product.cajas || '';

    const formTitle = document.querySelector('#tab-add h2');
    if (formTitle) formTitle.textContent = '✏️ Editar Producto';

    const submitBtn = document.querySelector('#add-product-form button[type="submit"]');
    if (submitBtn) {
      submitBtn.textContent = '💾 Actualizar Producto';
      submitBtn.style.background = '#f59e0b';
    }

    window.EDITING_PRODUCT_ID = productId;
    if (typeof showToast === 'function') showToast('✏️ Editando: ' + product.nombre, 'info');
  }, 100);
};

// ============================================================
// HELPERS UI
// ============================================================
let brandClickEventsSetup = false; // Bandera para evitar múltiples listeners

function setupBrandClickEvents() {
  if (brandClickEventsSetup) return; // Si ya se configuró, no configurar de nuevo

  // Usar delegación de eventos en el document
  document.addEventListener('click', function handleBrandClick(e) {
    // Buscar el elemento más cercano con data-brand-header
    const header = e.target.closest('[data-brand-header]');
    if (!header) return;

    const brandName = header.getAttribute('data-brand-name');
    const container = header.closest('[data-container]');
    const containerId = container ? container.getAttribute('data-container') : null;

    if (brandName) {
      console.log('🔄 Click en marca:', brandName);
      toggleBrandUI(brandName, containerId);
    }
  });

  brandClickEventsSetup = true;
  console.log('✅ Brand click events configurados');
}

function toggleBrandUI(brandName, containerId) {
  const isExpanded = window.toggleBrandState(brandName);

  // Buscar TODOS los elementos con data-brand-section que coincidan con la marca
  const allSections = document.querySelectorAll(`[data-brand-section="${brandName}"]`);

  console.log(`📍 Buscando secciones para marca "${brandName}":`, allSections.length, 'encontradas');

  allSections.forEach(section => {
    // Si se especificó containerId, solo actualizar si está en ese contenedor
    if (containerId && section.getAttribute('data-container') !== containerId) {
      return;
    }

    const productsList = section.querySelector('[data-products-list]');
    const arrow = section.querySelector('[data-brand-arrow]');

    console.log(`  - Actualizando lista de productos:`, !!productsList, 'arrow:', !!arrow);

    if (productsList) {
      productsList.style.display = isExpanded ? 'block' : 'none';
      console.log(`    ✅ Display cambiado a: ${isExpanded ? 'block' : 'none'}`);
    }

    if (arrow) {
      arrow.textContent = isExpanded ? '▼' : '▶';
      console.log(`    ✅ Flecha cambiada a: ${isExpanded ? '▼' : '▶'}`);
    }
  });
}

function applyBrandStates() {
  Object.keys(window.INVENTORY_STATE.marcasExpandidas).forEach(marca => {
    const isExpanded = window.INVENTORY_STATE.marcasExpandidas[marca];
    document.querySelectorAll(`[data-brand-section="${marca}"]`).forEach(section => {
      const productsList = section.querySelector('[data-products-list]');
      const arrow = section.querySelector('[data-brand-arrow]');
      if (productsList) productsList.style.display = isExpanded ? 'block' : 'none';
      if (arrow) arrow.textContent = isExpanded ? '▼' : '▶';
    });
  });
}

function setupSearchBar() {
  if (window.SearchController) {
    window.SearchController.renderGlobalSearch('tab-inventory');
    window.SearchController.renderGlobalSearch('tab-out-of-stock');
  }
}

function setupVisualScan() {
  const btn = document.getElementById('btn-visual-scan');
  if (!btn) return;

  btn.onclick = async () => {
    if (typeof openScanner === 'function') {
      openScanner({
        continuous: true,
        onScan: async (code) => { console.log("🔍 Código visto:", code); }
      });
      const overlay = document.querySelector('.scanner-overlay');
      if (overlay) overlay.style.display = 'none';
      injectCaptureButton();
    }
  };
}

function injectCaptureButton() {
  const modal = document.getElementById('scanner-modal');
  if (!modal || document.getElementById('btn-capture-shelf')) return;

  const btn = document.createElement('button');
  btn.id = 'btn-capture-shelf';
  btn.innerHTML = '<span class="material-icons-round" style="font-size:28px;">analytics</span><br>Analizar Anaquel';
  btn.style.cssText = `
    position: absolute; bottom: 120px; left: 50%; transform: translateX(-50%);
    background: #10b981; color: white; border: none; padding: 12px 25px;
    border-radius: 12px; font-weight: 700; z-index: 3000; box-shadow: 0 10px 25px rgba(0,0,0,0.4);
    cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px;
    width: 200px; border: 2px solid white;
  `;

  btn.onclick = async () => {
    const video = document.getElementById('scanner-video');
    if (!video) return;
    btn.disabled = true;
    btn.innerHTML = '🧠 Analizando...';
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg');

    if (window.VisionAI) {
      const results = await window.VisionAI.analyzeShelf(dataUrl);
      if (results) {
        if (typeof showToast === 'function') showToast(`📊 Pepsico: ${results.pepsico_frentes} frentes`, "success");
        alert(`🔎 RESULTADO DE AUDITORÍA:\n\n📦 Frentes PepsiCo: ${results.pepsico_frentes}\n🚫 Competencia: ${results.competencia_frentes}\n📈 Total en Anaquel: ${results.total_frentes}\n\n💬 IA dice: ${results.mensaje || 'Buen trabajo'}`);
      }
    }
    btn.disabled = false;
    btn.innerHTML = '<span class="material-icons-round" style="font-size:28px;">analytics</span><br>Analizar Anaquel';
  };

  modal.appendChild(btn);
  const closeBtn = document.getElementById('close-scanner');
  if (closeBtn) {
    const originalClose = closeBtn.onclick;
    closeBtn.onclick = () => {
      btn.remove();
      const overlay = document.querySelector('.scanner-overlay');
      if (overlay) overlay.style.display = 'flex';
      if (originalClose) originalClose();
      if (window.ScannerService) window.ScannerService.hardStop();
      modal.classList.add('hidden');
    };
  }
}

// ============================================================
// INICIALIZACIÓN
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    setupSearchBar();
    setupVisualScan(); 
  }, 1000);
});

// ============================================================
// EXPONER FUNCIONES PÚBLICAS
// ============================================================
window.renderInventoryUI = renderInventoryUI;
window.setupSearchBar = setupSearchBar;

console.log('✅ inventory-ui.js V3 (Pro Multi-Container) cargado');
