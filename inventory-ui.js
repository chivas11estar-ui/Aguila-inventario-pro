// ============================================================
// Águila Inventario Pro - Módulo: inventory-ui.js
// Fase 2 - Módulo 2.1: Inventario Inteligente por Marca
// RENDER HTML - Versión Pro Multi-Tab (Stock y Agotados)
// Copyright © 2025 José A. G. Betancourt
// ============================================================

// ============================================================
// RENDERIZAR INVENTARIO COMPLETO
// ============================================================
function renderInventoryUI(productos, targetId = 'inventory-list') {
  const listElement = document.getElementById(targetId);
  if (!listElement) {
    console.warn(`⚠️ Elemento ${targetId} no encontrado`);
    return;
  }

  console.log(`🎨 Renderizando ${targetId}:`, productos.length, 'productos');

  // Validar que hay productos
  if (productos.length === 0) {
    const emptyMsg = targetId === 'inventory-list' 
      ? '✅ Sin productos con stock disponible' 
      : '✨ No hay productos agotados';
      
    listElement.innerHTML = `
      <p style="color: var(--muted); text-align: center; padding: 40px;">
        ${emptyMsg}
      </p>
    `;
    return;
  }

  // 1. Agrupar por código de barras
  const productosAgrupados = window.groupProductsByBarcode(productos);

  // 2. Agrupar por marca
  const productosPorMarca = window.groupProductsByBrand(productosAgrupados);

  // 3. Ordenar marcas (prioridad predefinida)
  const marcasOrdenadas = ['Sabritas', 'Gamesa', 'Quaker', "Sonric's", 'Otra']
    .filter(marca => productosPorMarca[marca]);

  // 4. Renderizar HTML
  let html = '';

  marcasOrdenadas.forEach(marca => {
    html += renderBrandSection(marca, productosPorMarca[marca], targetId);
  });

  listElement.innerHTML = html;

  // 5. Configurar eventos de click
  setupBrandClickEvents();

  // 6. Aplicar estados de marcas (expandidas/contraídas)
  applyBrandStates();

  console.log(`✅ ${targetId} renderizado correctamente`);
}

// ============================================================
// RENDERIZAR SECCIÓN DE MARCA
// ============================================================
function renderBrandSection(marca, productos, targetId) {
  const totales = window.calculateBrandTotals(productos);
  const isExpanded = window.INVENTORY_STATE.marcasExpandidas[marca] !== false;

  let html = `
    <div data-brand-section="${marca}" data-container="${targetId}" style="margin-bottom: 24px;">
      <!-- Header de marca -->
      <div 
        data-brand-header 
        data-brand-name="${marca}"
        style="
          background: ${targetId === 'inventory-list' ? 'linear-gradient(135deg, var(--primary), #003a8a)' : 'linear-gradient(135deg, #4b5563, #1f2937)'};
          color: white;
          padding: 12px 16px;
          border-radius: 12px;
          margin-bottom: 12px;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          transition: all 0.3s ease;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        "
      >
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 18px;">${targetId === 'inventory-list' ? '🏷️' : '🚫'} ${marca}</span>
          <span style="font-size: 12px; background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 20px;">
            ${totales.totalProductos} ítems • ${totales.totalCajas} cajas
          </span>
        </div>
        <span data-brand-arrow style="font-size: 12px; transition: transform 0.3s;">
          ${isExpanded ? '▼' : '▶'}
        </span>
      </div>

      <!-- Lista de productos -->
      <div 
        data-products-list 
        style="
          display: ${isExpanded ? 'block' : 'none'};
          transition: all 0.3s ease;
        "
      >
        ${productos.map(product => renderProductCard(product, targetId)).join('')}
      </div>
    </div>
  `;

  return html;
}

// ============================================================
// RENDERIZAR TARJETA DE PRODUCTO
// ============================================================
function renderProductCard(product, targetId) {
  const tieneMuchasBodegas = product.bodegas.length > 1;
  const isOutOfStock = (product.totalCajas || 0) <= 0;
  
  const productName = product.nombre;
  const brandName = product.marca;

  // Calcular info de caducidad
  const expiryInfo = window.calculateExpiryInfo(product, window.BRAND_EXPIRY_CONFIG);
  
  const expiryTag = expiryInfo.text ? `
    <div style="margin-top: 4px;">
      <span style="color: ${expiryInfo.color}; font-weight: 700; font-size: 12px;">
        📅 ${expiryInfo.text}
      </span>
    </div>
  ` : '';

  // Metadata Pro (desde Firestore/RTDB sincronizado)
  let salesAvg = product.daily_sales_avg || (product.analytics ? product.analytics.daily_sales_avg : 0) || 0;

  // Buscar estadísticas en ANALYTICS_STATE si no están en el producto
  if (!salesAvg && typeof window.ANALYTICS_STATE !== 'undefined') {
    const analyticsData = window.ANALYTICS_STATE?.resumen?.dailyAveragePiecesPerProduct || [];
    const productStats = analyticsData.find(p => p.nombre === productName);
    if (productStats) {
      salesAvg = productStats.dailyAverage;
    }
  }

  const lastSale = product.last_sale_date || (product.analytics ? product.analytics.last_sale_date : null);

  // EFECTO DE DESGASTE (DECAY)
  if (salesAvg > 0 && lastSale) {
      const msPerDay = 24 * 60 * 60 * 1000;
      const daysSinceLast = Math.max(0, (Date.now() - new Date(lastSale).getTime()) / msPerDay);
      
      if (daysSinceLast > 1) {
          const alpha = 2 / (30 + 1);
          salesAvg = salesAvg * Math.pow(1 - alpha, daysSinceLast);
          salesAvg = Math.round(salesAvg * 100) / 100;
      }
  }

  return `
    <div 
      data-product-item 
      data-product-name="${productName}"
      data-product-code="${product.codigoBarras}"
      class="card"
      style="
        background: ${isOutOfStock ? 'var(--bg-muted, #f3f4f6)' : 'var(--card-bg, #ffffff)'};
        color: var(--text-main, #1f2937);
        border-left: 6px solid ${isOutOfStock ? '#9ca3af' : 'var(--primary)'};
        margin-bottom: 15px;
        transition: all 0.3s ease;
        opacity: ${isOutOfStock ? '0.9' : '1'};
        box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        border-radius: 12px;
        overflow: hidden;
      "
    >
      <div style="display: flex; justify-content: space-between; align-items: flex-start; padding: 16px;">
        <div style="flex: 1;">
          <h4 style="margin: 0 0 8px 0; color: ${isOutOfStock ? '#4b5563' : 'var(--primary)'}; font-size: 17px; font-weight: 700; letter-spacing: -0.01em;">
            ${productName} ${isOutOfStock ? '<span style="font-size:10px; background:#e5e7eb; padding:2px 8px; border-radius:4px; margin-left:8px; color: #6b7280; vertical-align:middle;">AGOTADO</span>' : ''}
          </h4>
          <div style="font-size: 13px; color: var(--muted); line-height: 1.6;">
            <div>📍 Código: <strong style="color:var(--text-main);">${product.codigoBarras || 'N/A'}</strong></div>
            <div>📦 ${product.piezasPorCaja} piezas/caja</div>
            <div style="display:flex; align-items:center; gap:8px; margin-top:8px;">
              <div style="color:var(--primary); font-weight:700; display:flex; align-items:center; gap:4px; flex:1;">
                <span class="material-icons-round" style="font-size:16px;">trending_up</span>
                Prom: ${salesAvg} pzas/día
              </div>
              ${salesAvg > 0 ? `<span style="background:#dcfce7; color:#166534; padding:3px 8px; border-radius:12px; font-size:11px; font-weight:700;">📈 ${salesAvg}x</span>` : ''}
            </div>
            ${expiryTag}
          </div>
        </div>

        <div style="text-align: right; min-width: 90px; background: ${isOutOfStock ? '#f9fafb' : '#f0f7ff'}; padding: 10px; border-radius: 10px; border: 1px solid ${isOutOfStock ? '#e5e7eb' : '#dbeafe'};">
          <div style="font-size: 32px; font-weight: 800; color: ${isOutOfStock ? '#ef4444' : 'var(--success)'}; line-height: 1;">
            ${product.totalCajas}
          </div>
          <div style="font-size: 11px; color: var(--muted); font-weight: 600; text-transform: uppercase; margin-top: 4px;">cajas</div>
          <div style="font-size: 12px; color: var(--text-main); font-weight: 700; margin-top: 4px;">
            ${product.totalPiezas} <span style="font-weight:400; font-size:10px; color:var(--muted);">pzas</span>
          </div>
        </div>
      </div>

      <div style="padding: 0 16px 16px 16px;">
        <!-- Detalle Bodegas -->
        ${tieneMuchasBodegas 
          ? renderMultipleWarehouses(product, salesAvg) 
          : renderSingleWarehouse(product, salesAvg)
        }

        <!-- Botones de Acción -->
        <div style="margin-top: 16px; display: flex; gap: 10px;">
          <button 
            onclick="window.editarProducto('${product.bodegas[0].id}')"
            style="
              flex: 1;
              padding: 12px;
              background: #f3f4f6;
              color: #374151;
              border: 1px solid #d1d5db;
              border-radius: 8px;
              cursor: pointer;
              font-size: 13px;
              font-weight: 700;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 6px;
              transition: all 0.2s;
            "
          >
            <span class="material-icons-round" style="font-size:18px;">edit</span>
            Editar
          </button>
          
          ${isOutOfStock ? `
            <button 
              onclick="window.switchTab('refill'); setTimeout(() => { document.getElementById('refill-barcode').value = '${product.codigoBarras}'; window.searchProductForRefillSafe('${product.codigoBarras}'); window.setRefillModeSafe('entry'); }, 100);"
              style="
                flex: 1.5;
                padding: 12px;
                background: #10b981;
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-size: 13px;
                font-weight: 700;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                box-shadow: 0 4px 10px rgba(16, 185, 129, 0.2);
              "
            >
              <span class="material-icons-round" style="font-size:18px;">add_shopping_cart</span>
              Resurtir
            </button>
          ` : `
            <button 
              onclick="window.switchTab('refill'); setTimeout(() => { document.getElementById('refill-barcode').value = '${product.codigoBarras}'; window.searchProductForRefillSafe('${product.codigoBarras}'); window.setRefillModeSafe('exit'); }, 100);"
              style="
                flex: 1.5;
                padding: 12px;
                background: var(--primary);
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-size: 13px;
                font-weight: 700;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                box-shadow: 0 4px 10px rgba(0, 74, 173, 0.2);
              "
            >
              <span class="material-icons-round" style="font-size:18px;">sync_alt</span>
              Mover
            </button>
          `}
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
        ${product.bodegas.map(bodega => {
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
function setupBrandClickEvents() {
  // Usar delegación de eventos en lugar de attachar a cada header
  // Esto funciona incluso si el DOM se re-renderiza
  document.addEventListener('click', (e) => {
    const header = e.target.closest('[data-brand-header]');
    if (!header) return;

    const brandName = header.getAttribute('data-brand-name');
    const container = header.closest('[data-container]')?.getAttribute('data-container');

    if (brandName) {
      toggleBrandUI(brandName, container);
    }
  });
}

function toggleBrandUI(brandName, containerId) {
  const isExpanded = window.toggleBrandState(brandName);
  const selector = containerId ? `[data-container="${containerId}"] [data-brand-section="${brandName}"]` : `[data-brand-section="${brandName}"]`;
  
  document.querySelectorAll(selector).forEach(section => {
    const productsList = section.querySelector('[data-products-list]');
    const arrow = section.querySelector('[data-brand-arrow]');
    if (productsList) productsList.style.display = isExpanded ? 'block' : 'none';
    if (arrow) arrow.textContent = isExpanded ? '▼' : '▶';
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
  if (window.SearchController) window.SearchController.renderGlobalSearch('tab-inventory');
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
