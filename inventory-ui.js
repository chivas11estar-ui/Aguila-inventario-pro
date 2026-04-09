// ============================================================
// Águila Inventario Pro - Módulo: inventory-ui.js
// Fase 2 - Módulo 2.1: Inventario Inteligente por Marca
// RENDER HTML - Soporte para múltiples contenedores (Stock vs Agotados)
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
          border-radius: 8px;
          margin-bottom: 12px;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          transition: all 0.3s ease;
        "
      >
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 16px;">${targetId === 'inventory-list' ? '🏷️' : '🚫'} ${marca}</span>
          <span style="font-size: 12px; opacity: 0.9;">
            ${totales.totalProductos} productos • ${totales.totalCajas} cajas
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
  const lastSale = product.last_sale_date || (product.analytics ? product.analytics.last_sale_date : null);

  // EFECTO DE DESGASTE (DECAY): Bajar el promedio visualmente si pasan los días sin ventas
  if (salesAvg > 0 && lastSale) {
      const msPerDay = 24 * 60 * 60 * 1000;
      const daysSinceLast = Math.max(0, (Date.now() - new Date(lastSale).getTime()) / msPerDay);
      
      if (daysSinceLast > 1) {
          const alpha = 2 / (30 + 1);
          // Aplicar decay: promedio * (1 - alpha)^días
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
        border-left: 4px solid ${isOutOfStock ? '#9ca3af' : 'var(--primary)'};
        margin-bottom: 10px;
        transition: all 0.3s ease;
        opacity: ${isOutOfStock ? '0.85' : '1'};
      "
    >
      <!-- Header del producto -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; padding: 12px;">
        <div style="flex: 1;">
          <h4 style="margin: 0 0 8px 0; color: ${isOutOfStock ? '#4b5563' : 'var(--primary)'}; font-size: 16px; font-weight: 700;">
            ${productName} ${isOutOfStock ? '<span style="font-size:10px; background:#e5e7eb; padding:2px 6px; border-radius:4px; margin-left:8px; color: #6b7280;">AGOTADO</span>' : ''}
          </h4>
          <div style="font-size: 13px; color: var(--muted); line-height: 1.8;">
            <div>📍 Código: <strong>${product.codigoBarras || 'N/A'}</strong></div>
            <div>🏷️ Marca: <strong>${brandName}</strong></div>
            <div>📦 ${product.piezasPorCaja} piezas/caja</div>
            <div style="color:var(--primary); font-weight:600;">📈 Venta prom: ${salesAvg} pzas/día</div>
            ${expiryTag}
          </div>
        </div>

        <!-- Total de cajas -->
        <div style="text-align: right; min-width: 100px;">
          <div style="font-size: 32px; font-weight: 700; color: ${isOutOfStock ? '#ef4444' : 'var(--success)'};">
            ${product.totalCajas}
          </div>
          <div style="font-size: 12px; color: var(--muted);">cajas totales</div>
          <div style="font-size: 11px; color: var(--muted); margin-top: 4px;">
            ${product.totalPiezas} piezas
          </div>
        </div>
      </div>

      <!-- Bodegas -->
      ${tieneMuchasBodegas 
        ? renderMultipleWarehouses(product, salesAvg) 
        : renderSingleWarehouse(product, salesAvg)
      }

      <!-- Botón acciones -->
      <div style="margin-top: 12px; display: flex; gap: 8px;">
        <button 
          onclick="window.editarProducto('${product.bodegas[0].id}')"
          style="
            flex: 1;
            padding: 10px;
            background: #2563eb;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 600;
            transition: all 0.2s ease;
          "
        >
          ✏️ Editar
        </button>
        ${isOutOfStock ? `
          <button 
            onclick="window.switchTab('refill'); setTimeout(() => { document.getElementById('refill-barcode').value = '${product.codigoBarras}'; window.searchProductForRefillSafe('${product.codigoBarras}'); window.setRefillModeSafe('entry'); }, 100);"
            style="
              flex: 1;
              padding: 10px;
              background: #10b981;
              color: white;
              border: none;
              border-radius: 6px;
              cursor: pointer;
              font-size: 13px;
              font-weight: 600;
            "
          >
            ➕ Resurtir
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

// ============================================================
// RENDERIZAR MÚLTIPLES BODEGAS (COLAPSABLE)
// ============================================================
function renderMultipleWarehouses(product, salesAvg = 0) {
  return `
    <details class="bodega-details" style="margin-top: 12px; background: #f8fafc; border-radius: 8px; padding: 4px;">
      <summary style="cursor: pointer; font-weight: 600; color: #2563eb; padding: 8px; font-size: 13px;">
        📍 Ver stock en ${product.bodegas.length} ubicaciones
      </summary>
      <ul class="bodega-list" style="list-style: none; padding: 8px; margin: 0; display: flex; flex-direction: column; gap: 8px;">
        ${product.bodegas.map(bodega => {
          const bodegaExpiry = bodega.fechaCaducidad ? new Date(bodega.fechaCaducidad) : null;
          const bodegaDays = bodegaExpiry 
            ? Math.ceil((bodegaExpiry.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
            : null;

          return `
            <li style="
              padding: 10px;
              background: white;
              border-left: 3px solid #2563eb;
              border-radius: 6px;
              box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            ">
              <div style="display: flex; justify-content: space-between;">
                <strong>${bodega.ubicacion}</strong>
                <span style="font-weight: 700; color: #2563eb;">${bodega.cajas} cajas</span>
              </div>
              <div style="color:var(--primary); font-weight:600; font-size:11px; margin-top:2px;">📈 Venta prom: ${salesAvg} pzas/día</div>
              ${bodegaDays !== null ? `
                <div style="color: #64748b; font-size: 11px; margin-top: 4px;">
                  📅 Caducidad: ${bodega.fechaCaducidad} (${bodegaDays} días)
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
  
  return `
    <div style="margin-top: 10px; padding: 10px; background: #f8fafc; border-radius: 8px; font-size: 13px; color: #1f2937; border: 1px solid #e5e7eb;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span><strong>🏢 Bodega:</strong> ${bodega.ubicacion}</span>
      </div>
      <div style="color:var(--primary); font-weight:600; font-size:12px; margin-top:4px;">📈 Venta prom: ${salesAvg} pzas/día</div>
      ${bodega.fechaCaducidad ? `
        <div style="margin-top: 4px; color: #64748b;">📅 Caducidad: <strong>${bodega.fechaCaducidad}</strong></div>
      ` : ''}
    </div>
  `;
}

// ============================================================
// CONFIGURAR EVENTOS DE CLICK EN MARCAS
// ============================================================
function setupBrandClickEvents() {
  const brandHeaders = document.querySelectorAll('[data-brand-header]');
  
  brandHeaders.forEach(header => {
    const brandName = header.getAttribute('data-brand-name');
    const container = header.closest('[data-container]')?.getAttribute('data-container');
    
    if (!brandName) return;

    // Remover listeners anteriores (prevenir duplicados)
    const newHeader = header.cloneNode(true);
    header.parentNode.replaceChild(newHeader, header);

    // Agregar nuevo listener
    newHeader.addEventListener('click', () => {
      toggleBrandUI(brandName, container);
    });
  });
}

// ============================================================
// TOGGLE MARCA (UI)
// ============================================================
function toggleBrandUI(brandName, containerId) {
  const isExpanded = window.toggleBrandState(brandName);

  // Actualizar todos los headers de esa marca en el contenedor específico
  const selector = containerId ? `[data-container="${containerId}"] [data-brand-section="${brandName}"]` : `[data-brand-section="${brandName}"]`;
  const sections = document.querySelectorAll(selector);
  
  sections.forEach(section => {
    const productsList = section.querySelector('[data-products-list]');
    const arrow = section.querySelector('[data-brand-arrow]');

    if (productsList) {
      productsList.style.display = isExpanded ? 'block' : 'none';
    }

    if (arrow) {
      arrow.textContent = isExpanded ? '▼' : '▶';
    }
  });
}

// ============================================================
// APLICAR ESTADOS DE MARCAS (AL CARGAR)
// ============================================================
function applyBrandStates() {
  Object.keys(window.INVENTORY_STATE.marcasExpandidas).forEach(marca => {
    const isExpanded = window.INVENTORY_STATE.marcasExpandidas[marca];
    const sections = document.querySelectorAll(`[data-brand-section="${marca}"]`);
    
    sections.forEach(section => {
      const productsList = section.querySelector('[data-products-list]');
      const arrow = section.querySelector('[data-brand-arrow]');

      if (productsList) {
        productsList.style.display = isExpanded ? 'block' : 'none';
      }

      if (arrow) {
        arrow.textContent = isExpanded ? '▼' : '▶';
      }
    });
  });
}

// ============================================================
// CONFIGURAR BUSCADOR (V4 - HYBRID PRO)
// ============================================================
function setupSearchBar() {
  console.log('🔍 [UI] Inyectando Buscador Híbrido Pro...');
  if (window.SearchController) {
    window.SearchController.renderGlobalSearch('tab-inventory');
  }
}

// ============================================================
// INICIALIZACIÓN
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('🎨 Inicializando módulo de inventario (UI)...');

  setTimeout(() => {
    setupSearchBar();
    setupVisualScan(); 
  }, 1000);
});

function setupVisualScan() {
  const btn = document.getElementById('btn-visual-scan');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    if (typeof openScanner === 'function') {
      openScanner({
        continuous: true,
        onScan: async (code) => { console.log("🔍 Código visto:", code); }
      });

      const overlay = document.querySelector('.scanner-overlay');
      if (overlay) overlay.style.display = 'none';

      injectCaptureButton();
    }
  });
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
    btn.style.background = '#4b5563';

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg');

    if (window.VisionAI) {
      const results = await window.VisionAI.analyzeShelf(dataUrl);
      if (results) {
        if (typeof showToast === 'function') showToast(`📊 Pepsico: ${results.pepsico_frentes} frentes`, "success");
        alert(`🔎 RESULTADO DE AUDITORÍA:\n\n` +
              `📦 Frentes PepsiCo: ${results.pepsico_frentes}\n` +
              `🚫 Competencia: ${results.competencia_frentes}\n` +
              `📈 Total en Anaquel: ${results.total_frentes}\n\n` +
              `💬 IA dice: ${results.mensaje || 'Buen trabajo'}`);
      }
    }

    btn.disabled = false;
    btn.innerHTML = '<span class="material-icons-round" style="font-size:28px;">analytics</span><br>Analizar Anaquel';
    btn.style.background = '#10b981';
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
// EXPONER FUNCIONES PÚBLICAS
// ============================================================
window.renderInventoryUI = renderInventoryUI;
window.setupSearchBar = setupSearchBar;

console.log('✅ inventory-ui.js (V3 - Multi-Container) cargado');
