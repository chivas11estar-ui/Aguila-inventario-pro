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
  try {
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
    const marcasOrdenadas = ['Sabritas', 'Gamesa', 'Quaker', "Sonric's", 'Cacahuates', 'Otra']
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
  } catch (error) {
    console.error(`❌ [RENDER ERROR] ${targetId}:`, error);
    const listElement = document.getElementById(targetId);
    if (listElement) {
      listElement.innerHTML = `
        <p style="color: var(--muted); text-align: center; padding: 40px;">
          ⚠️ Error al cargar inventario. Por favor recarga la página.
        </p>
      `;
    }
  }
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
        class="card"
        style="
          background: ${targetId === 'inventory-list' ? 'var(--primary-container)' : 'var(--secondary)'};
          color: white;
          padding: 16px var(--spacing-lg);
          margin-bottom: 16px;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border: none;
        "
      >
        <div style="display: flex; align-items: center; gap: 16px;">
          <span class="material-icons-round" style="font-size: 24px; opacity: 0.9;">
            ${targetId === 'inventory-list' ? 'local_offer' : 'block'}
          </span>
          <div style="display: flex; flex-direction: column;">
            <span style="font-size: 16px; font-weight: 800; letter-spacing: -0.02em;">${marca}</span>
            <span style="font-size: 11px; opacity: 0.8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">
              ${totales.totalProductos} productos • ${totales.totalCajas} cajas
            </span>
          </div>
        </div>
        <span data-brand-arrow class="material-icons-round" style="font-size: 20px; transition: transform 0.3s;">
          ${isExpanded ? 'expand_more' : 'chevron_right'}
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
  const totalCajas = parseInt(product.totalCajas || product.cajas) || 0;
  const totalPiezas = parseInt(product.totalPiezas || product.piezas || product.piezasSueltas) || 0;
  const totalAntiguo = parseInt(product.stockTotal) || 0;
  const isOutOfStock = totalCajas <= 0 && totalPiezas <= 0 && totalAntiguo <= 0;
  
  const productName = product.nombre;
  const brandName = product.marca;

  // Calcular info de caducidad
  const expiryInfo = window.calculateExpiryInfo(product, window.BRAND_EXPIRY_CONFIG);
  
  const expiryTag = expiryInfo.text ? `
    <div style="margin-top: 6px; display: flex; align-items: center; gap: 4px;">
      <span class="material-icons-round" style="font-size: 14px; color: ${expiryInfo.color};">event_note</span>
      <span style="color: ${expiryInfo.color}; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 0.02em;">
        ${expiryInfo.text}
      </span>
    </div>
  ` : '';

  // Metadata Avanzada
  let analytics = { daily: 0, weekly: 0, monthly: 0 };
  const analyticsData = window.ANALYTICS_STATE?.resumen?.analyticsPerProduct || {};
  if (analyticsData[productName]) {
    analytics = analyticsData[productName];
  }

  const diasInventario = analytics.daily > 0 ? Math.ceil(product.totalPiezas / analytics.daily) : 0;

  // Lógica de Colores de Estado (Indigo Horizon)
  let statusBorder = 'var(--border)';
  let statusIcon = '';
  
  if (isOutOfStock) {
    statusBorder = 'var(--error)';
  } else if (analytics.daily > 0) {
    if (diasInventario <= 2) {
      statusBorder = 'var(--primary)'; // Pick urgente
      statusIcon = '<span style="background:var(--primary); color:white; padding:2px 8px; border-radius:10px; font-size:9px; font-weight:800; margin-left:8px; text-transform:uppercase;">Pick</span>';
    } else if (diasInventario <= 5) {
      statusBorder = 'var(--success)';
    }
  }

  return `
    <div
      data-product-item
      data-product-name="${productName}"
      data-product-code="${product.codigoBarras}"
      class="product-card"
      style="border-left: 6px solid ${statusBorder};"
    >
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
        <div style="flex: 1;">
          <h4 style="margin: 0 0 8px 0; color: var(--text); font-size: 17px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.2;">
            ${productName} ${statusIcon}
          </h4>
          <div style="font-size: 13px; color: var(--muted); font-weight: 500; line-height: 1.4;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="material-icons-round" style="font-size: 14px; opacity: 0.6;">qr_code_2</span>
              <span>${product.codigoBarras || 'N/A'}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px; margin-top: 2px;">
              <span class="material-icons-round" style="font-size: 14px; opacity: 0.6;">layers</span>
              <span>${product.piezasPorCaja} pzs/caj</span>
            </div>

            <!-- Dashboard de Ventas Sutil -->
            <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:8px; margin-top:12px;">
              <div style="background:var(--bg); padding:8px; border-radius:12px; text-align:center; border: 1px solid var(--border);">
                <div style="font-size:9px; color:var(--primary); font-weight:800; text-transform:uppercase;">Día</div>
                <div style="font-size:15px; font-weight:800; color:var(--text);">${analytics.daily}</div>
              </div>
              <div style="background:var(--bg); padding:8px; border-radius:12px; text-align:center; border: 1px solid var(--border);">
                <div style="font-size:9px; color:var(--secondary); font-weight:800; text-transform:uppercase;">Sem</div>
                <div style="font-size:15px; font-weight:800; color:var(--text);">${analytics.weekly}</div>
              </div>
              <div style="background:var(--bg); padding:8px; border-radius:12px; text-align:center; border: 1px solid var(--border);">
                <div style="font-size:9px; color:var(--muted); font-weight:800; text-transform:uppercase;">Mes</div>
                <div style="font-size:15px; font-weight:800; color:var(--text);">${analytics.monthly}</div>
              </div>
            </div>

            ${expiryTag}
          </div>
        </div>

        <div class="product-stock" style="background: ${isOutOfStock ? 'var(--error-container)' : 'var(--primary-container)'}; color: white; box-shadow: var(--shadow-md);">
          <div style="display: flex; flex-direction: column; align-items: center;">
            <span style="font-size: 24px; font-weight: 900;">${product.totalCajas}</span>
            <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; margin-top: -4px; opacity: 0.9;">cajas</span>
            <div style="width: 24px; height: 1.5px; background: rgba(255,255,255,0.3); margin: 4px 0;"></div>
            <span style="font-size: 11px; font-weight: 700;">${product.totalPiezas} pzs</span>
          </div>
        </div>
      </div>

      <div style="margin-top: 16px;">
        <!-- Detalle Bodegas -->
        ${tieneMuchasBodegas 
          ? renderMultipleWarehouses(product, analytics.daily) 
          : renderSingleWarehouse(product, analytics.daily)
        }

        <!-- Botones de Acción Estilo Indigo -->
        <div style="margin-top: 16px; display: flex; gap: 10px;">
          <button 
            onclick="window.editarProducto('${product.bodegas[0].id}')"
            class="secondary"
            style="flex: 1; padding: 10px; font-size: 13px; margin: 0; background: var(--surface-container); color: var(--text);"
          >
            <span class="material-icons-round" style="font-size:18px;">edit</span>
            Editar
          </button>
          
          ${isOutOfStock ? `
            <button 
              onclick="window.switchTab('refill'); setTimeout(() => { document.getElementById('refill-barcode').value = '${product.codigoBarras}'; window.searchProductForRefillSafe('${product.codigoBarras}'); window.setRefillModeSafe('entry'); }, 100);"
              class="primary"
              style="flex: 1.5; padding: 10px; font-size: 13px; margin: 0; background: var(--success);"
            >
              <span class="material-icons-round" style="font-size:18px;">add_shopping_cart</span>
              Resurtir
            </button>
          ` : `
            <button 
              onclick="event.stopPropagation(); window.moverProducto && window.moverProducto('${product.bodegas[0].id}')"
              class="primary"
              style="flex: 1.5; padding: 10px; font-size: 13px; margin: 0;"
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
