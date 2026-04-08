// ============================================================
// Águila Inventario Pro - Módulo: inventory-ui.js
// Fase 2 - Módulo 2.1: Inventario Inteligente por Marca
// RENDER HTML - Solo UI
// Copyright © 2025 José A. G. Betancourt
// ============================================================

// ============================================================
// RENDERIZAR INVENTARIO COMPLETO
// ============================================================
function renderInventoryUI(productos) {
  const listElement = document.getElementById('inventory-list');
  if (!listElement) {
    console.warn('⚠️ Elemento inventory-list no encontrado');
    return;
  }

  console.log('🎨 Renderizando inventario:', productos.length, 'productos');

  // Validar que hay productos
  if (productos.length === 0) {
    listElement.innerHTML = `
      <p style="color: var(--muted); text-align: center; padding: 40px;">
        ✅ Sin productos con stock disponible
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
    html += renderBrandSection(marca, productosPorMarca[marca]);
  });

  listElement.innerHTML = html;

  // 5. Configurar eventos de click
  setupBrandClickEvents();

  // 6. Aplicar estados de marcas (expandidas/contraídas)
  applyBrandStates();

  console.log('✅ Inventario renderizado');
}

// ============================================================
// RENDERIZAR SECCIÓN DE MARCA
// ============================================================
function renderBrandSection(marca, productos) {
  const totales = window.calculateBrandTotals(productos);
  const isExpanded = window.INVENTORY_STATE.marcasExpandidas[marca] !== false;

  let html = `
    <div data-brand-section="${marca}" style="margin-bottom: 24px;">
      <!-- Header de marca -->
      <div 
        data-brand-header 
        data-brand-name="${marca}"
        style="
          background: linear-gradient(135deg, var(--primary), #003a8a);
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
          <span style="font-size: 16px;">🏷️ ${marca}</span>
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
        ${productos.map(product => renderProductCard(product)).join('')}
      </div>
    </div>
  `;

  return html;
}

// ============================================================
// RENDERIZAR TARJETA DE PRODUCTO
// ============================================================
function renderProductCard(product) {
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
  const salesAvg = product.daily_sales_avg || (product.analytics ? product.analytics.daily_sales_avg : 0) || 0;

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
        opacity: ${isOutOfStock ? '0.7' : '1'};
      "
    >
      <!-- Header del producto -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; padding: 12px;">
        <div style="flex: 1;">
          <h4 style="margin: 0 0 8px 0; color: ${isOutOfStock ? 'var(--text-muted)' : 'var(--primary)'}; font-size: 16px; font-weight: 700;">
            ${productName} ${isOutOfStock ? '<span style="font-size:10px; background:var(--bg-muted); padding:2px 6px; border-radius:4px; margin-left:8px; color: var(--text-muted);">AGOTADO</span>' : ''}
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
        ? renderMultipleWarehouses(product) 
        : renderSingleWarehouse(product)
      }

      <!-- Botón editar -->
      <div style="margin-top: 12px;">
        <button 
          onclick="window.editarProducto('${product.bodegas[0].id}')"
          style="
            width: 100%;
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
          onmouseover="this.style.background='#1d4ed8'"
          onmouseout="this.style.background='#2563eb'"
        >
          ✏️ Editar Producto
        </button>
      </div>
    </div>
  `;
}

// ============================================================
// RENDERIZAR MÚLTIPLES BODEGAS (COLAPSABLE)
// ============================================================
function renderMultipleWarehouses(product) {
  return `
    <details class="bodega-details" style="margin-top: 12px;">
      <summary style="cursor: pointer; font-weight: 600; color: #2563eb; padding: 5px;">
        📍 Bodegas (${product.bodegas.length})
      </summary>
      <ul class="bodega-list" style="list-style: none; padding: 10px 0 0 0; margin: 0;">
        ${product.bodegas.map(bodega => {
          const bodegaExpiry = bodega.fechaCaducidad ? new Date(bodega.fechaCaducidad) : null;
          const bodegaDays = bodegaExpiry 
            ? Math.ceil((bodegaExpiry.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
            : null;

          return `
            <li style="
              padding: 8px;
              margin: 5px 0;
              background: #f8fafc;
              border-left: 3px solid #2563eb;
              border-radius: 4px;
            ">
              <strong>${bodega.ubicacion}:</strong> ${bodega.cajas} cajas
              ${bodegaDays !== null ? `
                <br>
                <small style="color: #64748b; font-size: 0.85em;">
                  Cad: ${bodega.fechaCaducidad} (${bodegaDays} días)
                </small>
              ` : ''}
              <br>
              <button 
                onclick="window.editarProducto('${bodega.id}')"
                style="
                  margin-top: 6px;
                  padding: 4px 8px;
                  background: #2563eb;
                  color: white;
                  border: none;
                  border-radius: 4px;
                  cursor: pointer;
                  font-size: 11px;
                "
              >
                ✏️ Editar
              </button>
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
function renderSingleWarehouse(product) {
  const bodega = product.bodegas[0];
  
  return `
    <div style="margin-top: 10px; font-size: 13px; color: #6b7280;">
      <strong>🏢 Bodega:</strong> ${bodega.ubicacion}
      ${bodega.fechaCaducidad ? `
        <br><strong>📅 Caducidad:</strong> ${bodega.fechaCaducidad}
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
    
    if (!brandName) return;

    // Remover listeners anteriores (prevenir duplicados)
    const newHeader = header.cloneNode(true);
    header.parentNode.replaceChild(newHeader, header);

    // Agregar nuevo listener
    newHeader.addEventListener('click', () => {
      toggleBrandUI(brandName);
    });

    // Hover effect
    newHeader.addEventListener('mouseenter', () => {
      newHeader.style.transform = 'translateY(-1px)';
      newHeader.style.boxShadow = '0 4px 12px rgba(0, 74, 173, 0.2)';
    });

    newHeader.addEventListener('mouseleave', () => {
      newHeader.style.transform = '';
      newHeader.style.boxShadow = '';
    });
  });

  console.log('✅ Eventos de marca configurados');
}

// ============================================================
// TOGGLE MARCA (UI)
// ============================================================
function toggleBrandUI(brandName) {
  // Actualizar estado en lógica
  const isExpanded = window.toggleBrandState(brandName);

  // Actualizar UI
  const section = document.querySelector(`[data-brand-section="${brandName}"]`);
  if (!section) return;

  const productsList = section.querySelector('[data-products-list]');
  const arrow = section.querySelector('[data-brand-arrow]');

  if (productsList) {
    productsList.style.display = isExpanded ? 'block' : 'none';
  }

  if (arrow) {
    arrow.textContent = isExpanded ? '▼' : '▶';
  }

  console.log(`🔄 UI actualizado: ${brandName} → ${isExpanded ? 'expandida' : 'contraída'}`);
}

// ============================================================
// APLICAR ESTADOS DE MARCAS (AL CARGAR)
// ============================================================
function applyBrandStates() {
  Object.keys(window.INVENTORY_STATE.marcasExpandidas).forEach(marca => {
    const isExpanded = window.INVENTORY_STATE.marcasExpandidas[marca];
    const section = document.querySelector(`[data-brand-section="${marca}"]`);
    
    if (!section) return;

    const productsList = section.querySelector('[data-products-list]');
    const arrow = section.querySelector('[data-brand-arrow]');

    if (productsList) {
      productsList.style.display = isExpanded ? 'block' : 'none';
    }

    if (arrow) {
      arrow.textContent = isExpanded ? '▼' : '▶';
    }
  });

  console.log('✅ Estados de marcas aplicados');
}

// ============================================================
// CONFIGURAR BUSCADOR (V4 - HYBRID PRO)
// ============================================================
function setupSearchBar() {
  console.log('🔍 [UI] Inyectando Buscador Híbrido Pro...');
  if (window.SearchController) {
    window.SearchController.renderGlobalSearch('tab-inventory');
  } else {
    console.error('❌ SearchController no disponible');
  }
}

// ============================================================
// INICIALIZACIÓN
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('🎨 Inicializando módulo de inventario (UI)...');

  // Configurar buscador híbrido después de un breve delay para asegurar el DOM
  setTimeout(() => {
    setupSearchBar();
    setupVisualScan(); // Iniciar Ojo de Águila
  }, 1000);
});

function setupVisualScan() {
  const btn = document.getElementById('btn-visual-scan');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    console.log('📸 Iniciando Auditoría Visual...');
    
    if (typeof openScanner === 'function') {
      // Abrimos el escáner pero con un callback especial
      openScanner({
        continuous: true,
        onScan: async (code) => {
          // Si detecta un código mientras mira, genial, pero...
          console.log("🔍 Código visto en auditoría:", code);
        }
      });

      // Añadir botón flotante de "CAPTURAR ANAQUEL" sobre el video
      injectCaptureButton();
    }
  });
}

function injectCaptureButton() {
  const modal = document.getElementById('scanner-modal');
  if (!modal) return;

  // Evitar duplicados
  if (document.getElementById('btn-capture-shelf')) return;

  const btn = document.createElement('button');
  btn.id = 'btn-capture-shelf';
  btn.innerHTML = '<span class="material-icons-round" style="font-size:32px;">analytics</span><br>Analizar Anaquel';
  btn.style.cssText = `
    position: absolute; bottom: 100px; left: 50%; transform: translateX(-50%);
    background: var(--success); color: white; border: none; padding: 15px 25px;
    border-radius: 50px; font-weight: 700; z-index: 3000; box-shadow: 0 10px 25px rgba(0,0,0,0.3);
    cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 5px;
  `;

  btn.onclick = async () => {
    const video = document.getElementById('scanner-video');
    if (!video) return;

    btn.disabled = true;
    btn.innerHTML = '🧠 Analizando...';
    btn.style.background = '#6b7280';

    // 1. Capturar Frame
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg');

    // 2. Pasar a VisionAI
    if (window.VisionAI) {
      const results = await window.VisionAI.analyzeShelf(dataUrl);
      
      if (results) {
        if (typeof showToast === 'function') showToast(`✅ Detectados ${results.length} productos`, "success");
        console.log("📊 RESULTADOS VISIÓN:", results);
        // Aquí integraremos el cálculo de Share of Shelf después
      } else {
        if (typeof showToast === 'function') showToast("❌ No se detectaron productos", "error");
      }
    }

    btn.disabled = false;
    btn.innerHTML = '<span class="material-icons-round" style="font-size:32px;">analytics</span><br>Analizar Anaquel';
    btn.style.background = 'var(--success)';
  };

  modal.appendChild(btn);

  // Limpiar botón cuando se cierre el escáner
  const closeBtn = document.getElementById('close-scanner');
  if (closeBtn) {
    const originalClose = closeBtn.onclick;
    closeBtn.onclick = () => {
      btn.remove();
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

console.log('✅ inventory-ui.js (Fase 2 - Render HTML) cargado correctamente');