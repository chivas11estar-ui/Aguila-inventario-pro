// ============================================
// ARCHIVO: analytics-ui.js (COMPLETO Y CORREGIDO)
// ============================================

window.renderAnalyticsUI = function() {
    const container = document.getElementById('stats-container');
    if (!container) {
        console.error('❌ Contenedor stats-container no encontrado');
        return;
    }

    // Obtener datos del estado global
    const res = window.ANALYTICS_STATE?.resumen || {};
    const movs = window.ANALYTICS_STATE?.movimientos || [];

    // Preparar datos para las métricas
    const analyticsData = {
        refillsToday: res.totalRellenosHoy || 0,
        boxesMoved: res.cajasMovidasHoy || 0,
        audits: res.auditoriasHoy || 0,
        totalProducts: res.productosDistintos || 0,
        refillAverages: res.dailyAveragePiecesPerProduct || []
    };

    container.innerHTML = `
        <div class="analytics-walmart">
            ${createMetricsGrid(analyticsData)}
            ${createTopByBrandSection(analyticsData.refillAverages)}
            ${createProductSearchSection()}
            <button id="btn-generate-top-sellers" class="btn-main mt-4">📋 Ver Reporte Completo</button>
            <div id="top-sellers-container"></div>
        </div>
    `;

    // Asignar evento al botón de reporte
    const btn = document.getElementById('btn-generate-top-sellers');
    if (btn && typeof window.generateAndRenderTop10 === 'function') {
        btn.addEventListener('click', window.generateAndRenderTop10);
    }
};

/**
 * Crea el grid 2x2 de métricas principales.
 */
function createMetricsGrid(data) {
    return `
        <div class="metrics-grid">
            <div class="metric-card">
                <span class="metric-value">${data.refillsToday}</span>
                <span class="metric-label">Rellenos Hoy</span>
            </div>
            <div class="metric-card">
                <span class="metric-value">${data.boxesMoved}</span>
                <span class="metric-label">Cajas Movidas</span>
            </div>
            <div class="metric-card">
                <span class="metric-value">${data.audits}</span>
                <span class="metric-label">Auditorías</span>
            </div>
            <div class="metric-card">
                <span class="metric-value">${data.totalProducts}</span>
                <span class="metric-label">Productos</span>
            </div>
        </div>
    `;
}

/**
 * Crea la sección "Top 3 por Marca"
 */
function createTopByBrandSection(refillAverages) {
    if (!refillAverages || refillAverages.length === 0) {
        return `
            <div class="top-by-brand">
                <h2>🏆 Top 3 por Marca</h2>
                <p style="text-align: center; color: #94a3b8;">No hay datos disponibles</p>
            </div>
        `;
    }

    // Agrupar por marca usando datos de movimientos y cruce con inventario
    const movimientos = window.ANALYTICS_STATE?.movimientos || [];
    const productosPorMarca = {};

    movimientos.forEach(m => {
        if (m.tipo !== 'salida' && m.tipo !== 'entrada_directa_anaquel') return;
        
        // Intentar obtener datos más recientes del inventario cargado (que ya vienen desencriptados)
        const productInInventory = window.INVENTORY_STATE?.productos?.find(p => p.codigoBarras === m.productoCodigo);
        
        // RECUPERAR Y DESENCRIPTAR (Fallback a datos de movimiento si no está en inventario local)
        let marca = productInInventory ? productInInventory.marca : m.marca || 'SIN MARCA';
        let producto = productInInventory ? productInInventory.nombre : m.productoNombre || 'Desconocido';

        // Doble capa de seguridad: asegurar desencriptación si los datos vienen de m (movimiento)
        if (typeof window.decryptData === 'function') {
            marca = window.decryptData(marca) || marca;
            producto = window.decryptData(producto) || producto;
        }
        
        if (!productosPorMarca[marca]) {
            productosPorMarca[marca] = {};
        }
        
        if (!productosPorMarca[marca][producto]) {
            productosPorMarca[marca][producto] = {
                nombre: producto,
                piezas: 0
            };
        }
        
        productosPorMarca[marca][producto].piezas += parseInt(m.piezasMovidas) || 0;
    });

    // Generar HTML para cada marca
    let brandGroupsHTML = '';
    const medals = ['🥇', '🥈', '🥉'];

    for (const brandName in productosPorMarca) {
        const productos = Object.values(productosPorMarca[brandName])
            .sort((a, b) => b.piezas - a.piezas)
            .slice(0, 3);

        if (productos.length > 0) {
            brandGroupsHTML += `
                <div class="brand-group">
                    <h3>${brandName}</h3>
                    ${productos.map((p, index) => {
                        const pzsPorDia = (p.piezas / 7).toFixed(1);
                        return `
                            <div>
                                ${medals[index]} ${p.nombre} - <strong>${pzsPorDia} pzs/día</strong>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }
    }

    return `
        <div class="top-by-brand">
            <h2>🏆 Top 3 por Marca (Últimos 7 días)</h2>
            ${brandGroupsHTML}
        </div>
    `;
}

/**
 * Crea la sección del buscador
 */
function createProductSearchSection() {
    return `
        <div class="product-search">
            <h2>🔍 Buscar Producto Individual</h2>
            <div class="search-controls">
                <button onclick="openProductScanner()">📷 Escanear</button>
                <input type="text" id="search-input" placeholder="Nombre o código de barras...">
                <button onclick="searchProduct()">🔎</button>
            </div>
            <div id="search-results-container"></div>
        </div>
    `;
}

/**
 * Abre el escáner
 */
window.openProductScanner = function() {
    if (typeof window.openScanner === 'function') {
        window.showToast && window.showToast('Abriendo escáner...', 'info');
        window.openScanner((codigo) => {
            const input = document.getElementById('search-input');
            if (input) {
                input.value = codigo;
                searchProduct();
            }
        });
    } else {
        window.showToast && window.showToast('Escáner no disponible', 'error');
        console.error('window.openScanner no está definida');
    }
};

/**
 * Busca un producto
 */
window.searchProduct = function() {
    const query = document.getElementById('search-input').value.trim().toLowerCase();
    
    if (!query) {
        window.showToast && window.showToast('Escribe algo para buscar', 'warning');
        return;
    }

    const movimientos = window.ANALYTICS_STATE?.movimientos || [];
    
    if (movimientos.length === 0) {
        window.showToast && window.showToast('No hay datos disponibles', 'error');
        renderSearchResult(null);
        return;
    }

    // Buscar producto en texto plano
    const productInfo = movimientos.find(m => {
        const nombre = (m.productoNombre || "").toLowerCase();
        const codigo = String(m.productoCodigo || m.codigoBarra || '').toLowerCase();
        return nombre.includes(query) || codigo.includes(query);
    });

    if (!productInfo) {
        renderSearchResult(null);
        return;
    }

    const productName = productInfo.productoNombre;
    const brandName = productInfo.marca;

    // Calcular métricas
    const hace7Dias = new Date();
    hace7Dias.setDate(hace7Dias.getDate() - 7);

    const movimientosProducto = movimientos.filter(m =>
        (m.productoCodigo || m.codigoBarra) === (productInfo.productoCodigo || productInfo.codigoBarra) &&
        (m.tipo === 'salida' || m.tipo === 'entrada_directa_anaquel') &&
        new Date(m.fecha) >= hace7Dias
    );

    const totalPiezas = movimientosProducto.reduce((sum, m) => 
        sum + (parseInt(m.piezasMovidas) || 0), 0
    );

    const piezasPorDia = (totalPiezas / 7).toFixed(2);
    const promedioMensual = (piezasPorDia * 30).toFixed(2);

    renderSearchResult({
        nombre: productName,
        marca: brandName || 'N/A',
        codigo: productInfo.productoCodigo || productInfo.codigoBarra,
        piezasPorDia: piezasPorDia,
        promedioMensual: promedioMensual
    });
};

/**
 * Renderiza resultado de búsqueda
 */
function renderSearchResult(data) {
    const container = document.getElementById('search-results-container');
    if (!container) return;

    if (!data) {
        container.innerHTML = `
            <div class="search-result-card-empty">
                🔍 Producto no encontrado
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="search-result-card">
            <h3>${data.nombre}</h3>
            <p class="brand-code">${data.marca} - ${data.codigo}</p>
            <div class="result-metrics">
                <div class="metric-display daily-metric">
                    <span class="metric-value">${data.piezasPorDia}</span>
                    <span class="metric-label">pzs/día</span>
                </div>
                <div class="metric-display monthly-metric">
                    <span class="metric-value">${data.promedioMensual}</span>
                    <span class="metric-label">pzs/mes (est.)</span>
                </div>
            </div>
            <p class="info-text">*Cálculos basados en salidas de los últimos 7 días</p>
        </div>
    `;
}

console.log('✅ analytics-ui.js (Estilo Walmart) cargado correctamente');
