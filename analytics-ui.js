// ============================================================
// Águila Inventario Pro - Módulo: analytics-ui.js
// Visualización de Analytics (con Top 10)
// ============================================================

let analyticsChart = null; // Guardar referencia del gráfico

// ============================================================
// RENDERIZAR TODO EL UI
// ============================================================
window.renderAnalyticsUI = function() {
    console.log('🎨 Renderizando Analytics UI...');
    
    const container = document.getElementById('analytics-container');
    if (!container) {
        console.warn('⚠️ No se encontró analytics-container');
        return;
    }

    const data = window.ANALYTICS_STATE.resumen;

    const hayDatos = window.ANALYTICS_STATE.movimientos.length > 0;

    if (!hayDatos) {
        container.innerHTML = `
            <div class="card" style="text-align:center; padding:40px;">
                <div style="font-size:60px; margin-bottom:15px;">📊</div>
                <h3 style="color:var(--muted); margin:0;">Sin datos todavía</h3>
                <p style="color:var(--muted); font-size:14px; margin-top:10px;">
                    Realiza rellenos o auditorías para ver estadísticas aquí
                </p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <!-- KPIs -->
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:20px;">
            ${renderKPI('🔁 Rellenos', data.totalRellenosHoy, '#2563eb')}
            ${renderKPI('📦 Cajas', data.cajasMovidasHoy, '#10b981')}
            ${renderKPI('🧾 Auditorías', data.auditoriasHoy, '#8b5cf6')}
            ${renderKPI('🏷️ Productos', data.productosDistintos, '#f59e0b')}
        </div>

        <!-- Gráfica de tendencia -->
        <div class="card" style="margin-bottom:20px;">
            <h3 style="font-size:14px; margin-bottom:15px; color:var(--primary);">
                📈 Tendencia de Rellenos (Últimos 7 días)
            </h3>
            <canvas id="chartSemanas" style="max-height:200px;"></canvas>
        </div>

        <!-- Top 5 Productos -->
        <div class="card" style="margin-bottom:20px;">
            <h3 style="font-size:14px; margin-bottom:15px; color:var(--primary);">
                🔥 Top 5 Productos Más Movidos (7 días)
            </h3>
            <div id="top-products-list">
                ${renderTopProductos(data.topProductos)}
            </div>
        </div>

        <!-- Top Marcas -->
        <div class="card" style="margin-bottom:20px;">
            <h3 style="font-size:14px; margin-bottom:15px; color:var(--primary);">
                🏷️ Marcas Más Movidas (7 días)
            </h3>
            <div id="top-brands-list">
                ${renderTopMarcas(data.topMarcas)}
            </div>
        </div>

        <!-- Espacio bottom nav -->
        <div style="height:80px;"></div>
    `;

    // NEW: Render Daily Average Per Product
    const avgContainer = document.getElementById('daily-average-refill-container');
    if (avgContainer) {
        const averages = window.ANALYTICS_STATE.resumen.dailyAveragePiecesPerProduct;

        if (averages && averages.length > 0) {
            avgContainer.innerHTML = averages.map(item => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--border);">
                    <span style="font-size:14px; color:var(--text);">${item.nombre}</span>
                    <span style="font-size:16px; font-weight:700; color:var(--primary);">${item.dailyAverage.toLocaleString('es-MX')} piezas/día</span>
                </div>
            `).join('');
        } else {
            avgContainer.innerHTML = '<p style="color: var(--muted); text-align:center;">No hay datos de relleno en los últimos 7 días.</p>';
        }
    }

    setTimeout(() => {
        renderChart(data.historico7Dias);
    }, 100);
};

// ============================================================
// RENDERIZAR TOP 10 MÁS VENDIDOS (NUEVA FUNCIÓN)
// ============================================================
window.renderTopSellersReport = function(top10Data) {
    const container = document.getElementById('top-sellers-container');
    if (!container) return;

    if (!top10Data || top10Data.length === 0) {
        container.innerHTML = '<p style="text-align:center; color: #6b7280;">No se encontraron datos de ventas.</p>';
        return;
    }
    
    const medallas = ['🥇', '🥈', '🥉'];

    container.innerHTML = top10Data.map((p, i) => `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 0; border-bottom:1px solid var(--border);">
            <div style="display:flex; align-items:center; gap: 12px;">
                <span style="font-size: 1.1em; min-width: 30px; text-align: center;">${i < 3 ? medallas[i] : (i + 1)}</span>
                <div>
                    <div style="font-size:13px; font-weight:600; color:var(--text);">
                        ${p.nombre}
                    </div>
                    <div style="font-size:11px; color:var(--muted); margin-top:2px;">
                        ${p.marca}
                    </div>
                </div>
            </div>
            <div style="font-weight:700; color:#059669; font-size:14px; text-align: right;">
                ${p.totalPiezas.toLocaleString('es-MX')}
                <small style="display: block; color: var(--muted); font-weight: 500;">piezas</small>
            </div>
        </div>
    `).join('');
};


// ============================================================
// RENDERIZAR KPI CARD
// ============================================================
function renderKPI(label, valor, color) {
    return `
        <div class="card" style="padding:15px; text-align:center; border-left:4px solid ${color};">
            <div style="font-size:10px; color:var(--muted); text-transform:uppercase; margin-bottom:5px; font-weight:600;">
                ${label}
            </div>
            <div style="font-size:24px; font-weight:800; color:${color};">
                ${valor}
            </div>
        </div>
    `;
}

// ============================================================
// RENDERIZAR TOP PRODUCTOS
// ============================================================
function renderTopProductos(productos) {
    if (!productos || productos.length === 0) {
        return '<p style="color:var(--muted); font-size:13px; text-align:center;">Sin datos</p>';
    }

    return productos.map((p, i) => `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 0; border-bottom:1px solid var(--border);">
            <div>
                <div style="font-size:13px; font-weight:600; color:var(--text);">
                    ${i + 1}. ${p.nombre}
                </div>
                <div style="font-size:11px; color:var(--muted); margin-top:2px;">
                    ${p.marca}
                </div>
            </div>
            <div style="font-weight:700; color:#2563eb; font-size:14px;">
                ${p.total} 📦
            </div>
        </div>
    `).join('');
}

// ============================================================
// RENDERIZAR TOP MARCAS
// ============================================================
function renderTopMarcas(marcas) {
    if (!marcas || marcas.length === 0) {
        return '<p style="color:var(--muted); font-size:13px; text-align:center;">Sin datos</p>';
    }

    const colores = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

    return marcas.map((m, i) => `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 0; border-bottom:1px solid var(--border);">
            <div style="display:flex; align-items:center; gap:10px;">
                <div style="width:8px; height:8px; border-radius:50%; background:${colores[i]};"></div>
                <span style="font-size:13px; font-weight:600; color:var(--text);">
                    ${m.marca}
                </span>
            </div>
            <div style="font-weight:700; color:${colores[i]}; font-size:14px;">
                ${m.total} cajas
            </div>
        </div>
    `).join('');
}

// ============================================================
// RENDERIZAR GRÁFICO (Chart.js)
// ============================================================
function renderChart(historico) {
    const canvas = document.getElementById('chartSemanas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (analyticsChart) {
        analyticsChart.destroy();
        analyticsChart = null;
    }

    const labels = Object.keys(historico).map(f => new Date(f).getDate());
    const valores = Object.values(historico);

    analyticsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Rellenos',
                data: valores,
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: '#2563eb',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    callbacks: {
                        title: (context) => new Date(Object.keys(historico)[context[0].dataIndex]).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }),
                        label: (context) => `${context.parsed.y} rellenos`
                    }
                }
            },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1, color: '#6b7280' }, grid: { color: 'rgba(0, 0, 0, 0.05)' } },
                x: { ticks: { color: '#6b7280' }, grid: { display: false } }
            }
        }
    });
}

console.log('✅ analytics-ui.js (con Top 10) cargado correctamente');