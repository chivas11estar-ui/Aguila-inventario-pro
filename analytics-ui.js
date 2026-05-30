// ============================================
// ARCHIVO: analytics-ui.js (COMPLETO Y CORREGIDO)
// ============================================

window.renderAnalyticsUI = function() {
    const container = document.getElementById('stats-container');
    if (!container) {
        console.error('âŒ Contenedor stats-container no encontrado');
        return;
    }

    // Obtener datos del estado global
    const res = window.ANALYTICS_STATE?.resumen || {};
    const movs = window.ANALYTICS_STATE?.movimientos || [];

    // Preparar datos para las mÃ©tricas
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
            <button id="btn-generate-top-sellers" class="btn-main mt-4">ðŸ“‹ Ver Reporte Completo</button>
            <div id="top-sellers-container"></div>
        </div>
    `;

    // Asignar evento al botÃ³n de reporte
    const btn = document.getElementById('btn-generate-top-sellers');
    if (btn && typeof window.generateAndRenderTop10 === 'function') {
        btn.addEventListener('click', window.generateAndRenderTop10);
    }
};

/**
 * Crea el grid 2x2 de mÃ©tricas principales.
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
                <span class="metric-label">AuditorÃ­as</span>
            </div>
            <div class="metric-card">
                <span class="metric-value">${data.totalProducts}</span>
                <span class="metric-label">Productos</span>
            </div>
        </div>
    `;
}

/**
 * Crea la secciÃ³n "Top 3 por Marca"
 */
function createTopByBrandSection(refillAverages) {
    if (!refillAverages || refillAverages.length === 0) {
        return `
            <div class="top-by-brand">
                <h2>ðŸ† Top 3 por Marca</h2>
                <p style="text-align: center; color: #94a3b8;">No hay datos disponibles</p>
            </div>
        `;
    }

    // Agrupar por marca usando datos de movimientos y cruce con inventario
    const movimientos = window.ANALYTICS_STATE?.movimientos || [];
    const last7DateKeys = getRecentAnalyticsDateKeys(7);

    const movimientos7Dias = movimientos.filter((m) => {
        return last7DateKeys.has(getAnalyticsLocalDateKey(m.fecha));
    });
    const productosPorMarca = {};

    movimientos7Dias.forEach(m => {
        if (m.tipo !== 'salida' && m.tipo !== 'entrada_directa_anaquel') return;
        
        // Intentar obtener datos mÃ¡s recientes del inventario cargado (que ya vienen desencriptados)
        const productInInventory = window.INVENTORY_STATE?.productos?.find(p => p.codigoBarras === m.productoCodigo);
        
        // RECUPERAR Y DESENCRIPTAR (Fallback a datos de movimiento si no estÃ¡ en inventario local)
        let marca = productInInventory ? productInInventory.marca : m.marca || 'SIN MARCA';
        let producto = productInInventory ? productInInventory.nombre : m.productoNombre || 'Desconocido';

        // Doble capa de seguridad: asegurar desencriptaciÃ³n si los datos vienen de m (movimiento)
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
    const medals = ['ðŸ¥‡', 'ðŸ¥ˆ', 'ðŸ¥‰'];

    for (const brandName in productosPorMarca) {
        const productos = Object.values(productosPorMarca[brandName])
            .sort((a, b) => b.piezas - a.piezas)
            .slice(0, 3);

        if (productos.length > 0) {
            brandGroupsHTML += `
                <div class="brand-group">
                    <h3>${brandName}</h3>
                    ${productos.map((p, index) => {
                        const pzsPorDia = Math.round((p.piezas || 0) / 7);
                        return `
                            <div>
                                ${medals[index]} ${p.nombre} - <strong>${pzsPorDia} pzs/dÃ­a</strong>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }
    }

    return `
        <div class="top-by-brand">
            <h2>ðŸ† Top 3 por Marca (Ãšltimos 7 dÃ­as)</h2>
            ${brandGroupsHTML}
        </div>
    `;
}

/**
 * Crea la secciÃ³n del buscador
 */
function createProductSearchSection() {
    return `
        <div class="product-search">
            <h2>ðŸ” Buscar Producto Individual</h2>
            <div class="search-controls">
                <button onclick="openProductScanner()">ðŸ“· Escanear</button>
                <input type="text" id="search-input" placeholder="Nombre o cÃ³digo de barras...">
                <button onclick="searchProduct()">ðŸ”Ž</button>
            </div>
            <div id="search-results-container"></div>
        </div>
    `;
}

/**
 * Abre el escÃ¡ner
 */
window.openProductScanner = function() {
    if (typeof window.openScanner === 'function') {
        window.showToast && window.showToast('Abriendo escÃ¡ner...', 'info');
        window.openScanner((codigo) => {
            const input = document.getElementById('search-input');
            if (input) {
                input.value = codigo;
                searchProduct();
            }
        });
    } else {
        window.showToast && window.showToast('EscÃ¡ner no disponible', 'error');
        console.error('window.openScanner no estÃ¡ definida');
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

    // Calcular metricas con 7 dias naturales: hoy + 6 dias anteriores
    const last7DateKeys = getRecentAnalyticsDateKeys(7);

    const movimientosProducto = movimientos.filter(m =>
        (m.productoCodigo || m.codigoBarra) === (productInfo.productoCodigo || productInfo.codigoBarra) &&
        (m.tipo === 'salida' || m.tipo === 'entrada_directa_anaquel') &&
        last7DateKeys.has(getAnalyticsLocalDateKey(m.fecha))
    );

    const totalPiezas = movimientosProducto.reduce((sum, m) => 
        sum + (parseInt(m.piezasMovidas) || 0), 0
    );

    const piezasPorDia = Math.round(totalPiezas / 7);
    const promedioMensual = Math.round(piezasPorDia * 30);

    renderSearchResult({
        nombre: productName,
        marca: brandName || 'N/A',
        codigo: productInfo.productoCodigo || productInfo.codigoBarra,
        piezasPorDia: piezasPorDia,
        promedioMensual: promedioMensual
    });
};

/**
 * Renderiza resultado de bÃºsqueda
 */
function renderSearchResult(data) {
    const container = document.getElementById('search-results-container');
    if (!container) return;

    if (!data) {
        container.innerHTML = `
            <div class="search-result-card-empty">
                ðŸ” Producto no encontrado
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
                    <span class="metric-label">pzs/dÃ­a</span>
                </div>
                <div class="metric-display monthly-metric">
                    <span class="metric-value">${data.promedioMensual}</span>
                    <span class="metric-label">pzs/mes (est.)</span>
                </div>
            </div>
            <p class="info-text">*CÃ¡lculos basados en salidas de los Ãºltimos 7 dÃ­as</p>
        </div>
    `;
}

console.log('âœ… analytics-ui.js (Estilo Walmart) cargado correctamente');
// Override V3: buscar primero en inventario y usar estadistica por codigo de barras.
window.searchProduct = function() {
    const query = document.getElementById('search-input')?.value.trim().toLowerCase();
    if (!query) {
        window.showToast && window.showToast('Escribe algo para buscar', 'warning');
        return;
    }

    const movimientos = window.ANALYTICS_STATE?.movimientos || [];
    const inventario = window.INVENTORY_STATE?.productos || [];

    const productFromInventory = inventario.find(p => {
        const nombre = String(p.nombre || '').toLowerCase();
        const codigo = String(p.codigoBarras || '').toLowerCase();
        return nombre.includes(query) || codigo.includes(query);
    });

    const productFromMovement = movimientos.find(m => {
        const nombre = String(m.productoNombre || '').toLowerCase();
        const codigo = String(m.productoCodigo || m.codigoBarra || '').toLowerCase();
        return nombre.includes(query) || codigo.includes(query);
    });

    const productInfo = productFromInventory || (productFromMovement ? {
        nombre: productFromMovement.productoNombre,
        marca: productFromMovement.marca,
        codigoBarras: productFromMovement.productoCodigo || productFromMovement.codigoBarra
    } : null);

    if (!productInfo) {
        renderSearchResult(null);
        return;
    }

    const productName = productInfo.nombre || productInfo.productoNombre;
    const productCode = productInfo.codigoBarras || productInfo.productoCodigo || productInfo.codigoBarra || '';
    const analytics = window.ANALYTICS_STATE?.resumen?.analyticsPerProduct || {};
    const codeKey = String(productCode).trim().toLowerCase();
    const nameKey = String(productName).trim().toLowerCase();
    const stats = analytics[codeKey] || analytics[nameKey] || calculateProductStatsFromMovements(productCode, productName, movimientos);

    renderSearchResult({
        nombre: productName,
        marca: productInfo.marca || 'N/A',
        codigo: productCode,
        piezasPorDia: Math.round(Number(stats.daily || 0)),
        promedioMensual: Math.round(Number(stats.monthly || 0)),
        piezasSemana: Math.round(Number(stats.weekly || 0))
    });
};

function getAnalyticsLocalDateKey(fecha) {
    if (!fecha) return '';
    if (typeof window.analyticsDateKey === 'function') return window.analyticsDateKey(fecha);
    if (typeof window.isoToLocalDate === 'function') return window.isoToLocalDate(fecha);
    const d = new Date(fecha);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

function getRecentAnalyticsDateKeys(days, baseDate = new Date()) {
    const keys = new Set();
    for (let i = 0; i < days; i++) {
        const d = new Date(baseDate);
        d.setDate(baseDate.getDate() - i);
        if (typeof window.getLocalDateString === 'function') {
            keys.add(window.getLocalDateString(d));
        } else {
            keys.add(d.toISOString().slice(0, 10));
        }
    }
    return keys;
}

function calculateProductStatsFromMovements(productCode, productName, movimientos) {
    const last7DateKeys = getRecentAnalyticsDateKeys(7);
    const last30DateKeys = getRecentAnalyticsDateKeys(30);
    const code = String(productCode || '').trim().toLowerCase();
    const name = String(productName || '').trim().toLowerCase();

    const productMovs = movimientos.filter(m => {
        const movCode = String(m.productoCodigo || m.codigoBarra || '').trim().toLowerCase();
        const movName = String(m.productoNombre || '').trim().toLowerCase();
        const isRefill = m.tipo === 'salida' || m.tipo === 'entrada_directa_anaquel';
        return isRefill && (movCode === code || movName === name);
    });

    const weekly = productMovs
        .filter(m => last7DateKeys.has(getAnalyticsLocalDateKey(m.fecha)))
        .reduce((sum, m) => sum + (parseInt(m.piezasMovidas) || 0), 0);
    const monthly = productMovs
        .filter(m => last30DateKeys.has(getAnalyticsLocalDateKey(m.fecha)))
        .reduce((sum, m) => sum + (parseInt(m.piezasMovidas) || 0), 0);

    return { daily: Math.round(weekly / 7), weekly, monthly };
}
