// ============================================
// Águila Inventario Pro - Módulo: analytics-ui.js
// RENDER UI - Versión Eagle Pro (Bento Analytics)
// ============================================

window.renderAnalyticsUI = function() {
    const container = document.getElementById('stats-container');
    if (!container) return;

    const res = window.ANALYTICS_STATE?.resumen || {};
    const analyticsData = {
        refillsToday: res.totalRellenosHoy || 0,
        boxesMoved: res.cajasMovidasHoy || 0,
        audits: res.auditoriasHoy || 0,
        totalProducts: res.productosDistintos || 0
    };

    container.innerHTML = `
        <div class="space-y-8 animate-in fade-in duration-500">
            <!-- Header section -->
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 class="text-headline-xl text-primary font-black">Análisis de Operación</h2>
                    <p class="text-sm text-slate-500">Métricas de rendimiento en tiempo real</p>
                </div>
                <button id="btn-generate-report" class="bg-primary text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-100 active:scale-95 transition-all flex items-center gap-2">
                    <span class="material-symbols-outlined text-lg">description</span> Generar Reporte Completo
                </button>
            </div>

            <!-- Bento Metrics Grid -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                ${renderKPICard('Rellenos', analyticsData.refillsToday, 'cached', 'text-blue-600', 'bg-blue-50')}
                ${renderKPICard('Cajas', analyticsData.boxesMoved, 'package_2', 'text-emerald-600', 'bg-emerald-50')}
                ${renderKPICard('Auditorías', analyticsData.audits, 'task_alt', 'text-amber-600', 'bg-amber-50')}
                ${renderKPICard('Productos', analyticsData.totalProducts, 'inventory_2', 'text-purple-600', 'bg-purple-50')}
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <!-- Top Brands Section -->
                ${createTopByBrandSection()}
                
                <!-- Individual Search Section -->
                <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                    <div class="flex items-center gap-2 mb-6">
                        <span class="material-symbols-outlined text-primary">search_insights</span>
                        <h3 class="font-bold text-slate-800">Rendimiento Individual</h3>
                    </div>
                    <div class="flex gap-2 mb-6">
                        <div class="relative flex-grow">
                            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">barcode_scanner</span>
                            <input type="text" id="search-input" class="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20" placeholder="Nombre o código...">
                        </div>
                        <button onclick="searchProduct()" class="bg-primary text-white p-3 rounded-xl active:scale-95 transition-all">
                            <span class="material-symbols-outlined">search</span>
                        </button>
                    </div>
                    <div id="search-results-container">
                        <div class="text-center py-10 text-slate-300">
                            <span class="material-symbols-outlined text-4xl mb-2">find_in_page</span>
                            <p class="text-xs font-bold uppercase tracking-widest">Busca un producto para ver su métrica</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <div id="top-sellers-container"></div>
        </div>
    `;

    const btn = document.getElementById('btn-generate-report');
    if (btn && typeof window.generateAndRenderTop10 === 'function') {
        btn.addEventListener('click', window.generateAndRenderTop10);
    }
};

function renderKPICard(label, value, icon, colorClass, bgClass) {
    return `
        <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-50 flex flex-col items-center text-center group hover:shadow-md transition-all">
            <div class="w-12 h-12 ${bgClass} ${colorClass} rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <span class="material-symbols-outlined">${icon}</span>
            </div>
            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">${label}</p>
            <p class="text-3xl font-black text-slate-900">${value}</p>
        </div>
    `;
}

function createTopByBrandSection() {
    const movimientos = window.ANALYTICS_STATE?.movimientos || [];
    const productosPorMarca = {};

    movimientos.forEach(m => {
        if (m.tipo !== 'salida') return;
        const p = window.INVENTORY_STATE?.productos?.find(prod => prod.codigoBarras === m.productoCodigo);
        let marca = p ? p.marca : (m.marca || 'Otra');
        let nombre = p ? p.nombre : (m.productoNombre || 'Desconocido');

        if (!productosPorMarca[marca]) productosPorMarca[marca] = {};
        if (!productosPorMarca[marca][nombre]) productosPorMarca[marca][nombre] = { nombre, piezas: 0 };
        productosPorMarca[marca][nombre].piezas += parseInt(m.piezasMovidas) || 0;
    });

    let brandsHTML = '';
    const medals = ['🥇', '🥈', '🥉'];
    const brands = Object.keys(productosPorMarca).slice(0, 3);

    if (brands.length === 0) {
        brandsHTML = `<div class="text-center py-20 text-slate-300">No hay datos de movimiento</div>`;
    } else {
        brands.forEach(brand => {
            const topProducts = Object.values(productosPorMarca[brand])
                .sort((a, b) => b.piezas - a.piezas)
                .slice(0, 3);
            
            brandsHTML += `
                <div class="bg-slate-50/50 rounded-xl p-4 border border-slate-100">
                    <h4 class="font-black text-xs text-primary uppercase tracking-widest mb-3 flex items-center gap-2">
                        <span class="material-symbols-outlined text-sm">stars</span> ${brand}
                    </h4>
                    <div class="space-y-2">
                        ${topProducts.map((p, i) => `
                            <div class="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm border border-slate-50">
                                <div class="flex items-center gap-2 overflow-hidden">
                                    <span class="text-lg">${medals[i]}</span>
                                    <span class="text-xs font-bold text-slate-700 truncate">${p.nombre}</span>
                                </div>
                                <span class="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded whitespace-nowrap">${(p.piezas/7).toFixed(1)} p/d</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        });
    }

    return `
        <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div class="flex items-center gap-2 mb-6">
                <span class="material-symbols-outlined text-primary">trending_up</span>
                <h3 class="font-bold text-slate-800">Top Productos (7 días)</h3>
            </div>
            <div class="space-y-4">
                ${brandsHTML}
            </div>
        </div>
    `;
}

window.searchProduct = function() {
    const query = document.getElementById('search-input').value.trim().toLowerCase();
    const container = document.getElementById('search-results-container');
    if (!query || !container) return;

    const movimientos = window.ANALYTICS_STATE?.movimientos || [];
    const prod = movimientos.find(m => (m.productoNombre || "").toLowerCase().includes(query) || (m.productoCodigo || "").includes(query));

    if (!prod) {
        container.innerHTML = `<div class="bg-error/5 text-error p-6 rounded-xl text-center text-xs font-bold border border-error/10">Producto no encontrado</div>`;
        return;
    }

    const hace7Dias = new Date(); hace7Dias.setDate(hace7Dias.getDate() - 7);
    const mProd = movimientos.filter(m => m.productoCodigo === prod.productoCodigo && m.tipo === 'salida' && new Date(m.fecha) >= hace7Dias);
    const totalP = mProd.reduce((sum, m) => sum + (parseInt(m.piezasMovidas) || 0), 0);
    const pD = (totalP / 7).toFixed(2);

    container.innerHTML = `
        <div class="bg-primary/5 rounded-2xl p-6 border border-primary/10 animate-in zoom-in-95 duration-300">
            <div class="flex justify-between items-start mb-4">
                <div>
                    <h4 class="font-black text-primary-dark">${prod.productoNombre}</h4>
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">${prod.marca || 'Genérico'} • ${prod.productoCodigo}</p>
                </div>
                <div class="bg-white p-2 rounded-lg shadow-sm border border-slate-100">
                   <span class="material-symbols-outlined text-primary">analytics</span>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-50 text-center">
                    <p class="text-2xl font-black text-slate-900">${pD}</p>
                    <p class="text-[9px] font-bold text-slate-400 uppercase">Piezas / Día</p>
                </div>
                <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-50 text-center">
                    <p class="text-2xl font-black text-slate-900">${(pD * 30).toFixed(0)}</p>
                    <p class="text-[9px] font-bold text-slate-400 uppercase">Proyección Mes</p>
                </div>
            </div>
        </div>
    `;
};


console.log('✅ analytics-ui.js (Estilo Walmart) cargado correctamente');