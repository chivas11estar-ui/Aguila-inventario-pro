// ============================================================
// Aguila Inventario Pro - Modulo: analytics-ui.js
// Visualizacion de estadisticas
// ============================================================

let analyticsChart = null;

window.renderAnalyticsUI = function() {
    console.log('[Analytics UI] Renderizando...');

    const container = document.getElementById('analytics-container');
    if (!container) {
        console.warn('[Analytics UI] No se encontro analytics-container');
        return;
    }

    const data = window.ANALYTICS_STATE.resumen;
    const hayRellenos = (window.ANALYTICS_STATE.movimientos || []).some(m => m.tipo === 'salida');

    if (!hayRellenos) {
        container.innerHTML = `
            <div class="card" style="text-align:center; padding:40px;">
                <div style="font-size:42px; margin-bottom:15px;">📊</div>
                <h3 style="color:var(--muted); margin:0;">Sin rellenos todavia</h3>
                <p style="color:var(--muted); font-size:14px; margin-top:10px;">
                    Registra salidas de relleno para ver estadisticas aqui.
                </p>
            </div>
        `;
        renderDailyAverageRefill(data);
        return;
    }

    container.innerHTML = `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:20px;">
            ${renderKPI('Rellenos hoy', data.totalRellenosHoy, '#2563eb')}
            ${renderKPI('Cajas hoy', data.cajasMovidasHoy, '#10b981')}
            ${renderKPI('Piezas hoy', data.piezasMovidasHoy, '#f59e0b')}
            ${renderKPI('Productos hoy', data.productosDistintos, '#8b5cf6')}
        </div>

        <div class="card" style="margin-bottom:20px;">
            <h3 style="font-size:14px; margin-bottom:15px; color:var(--primary);">
                Tendencia de rellenos (ultimos 7 dias)
            </h3>
            <canvas id="chartSemanas" style="max-height:200px;"></canvas>
        </div>

        <div class="card" style="margin-bottom:20px;">
            <h3 style="font-size:14px; margin-bottom:15px; color:var(--primary);">
                Top 5 productos mas movidos (7 dias)
            </h3>
            <div id="top-products-list">
                ${renderTopProductos(data.topProductos)}
            </div>
        </div>

        <div class="card" style="margin-bottom:20px;">
            <h3 style="font-size:14px; margin-bottom:15px; color:var(--primary);">
                Marcas mas movidas (7 dias)
            </h3>
            <div id="top-brands-list">
                ${renderTopMarcas(data.topMarcas)}
            </div>
        </div>
    `;

    renderDailyAverageRefill(data);

    setTimeout(() => {
        renderChart(data.historico7Dias);
    }, 100);
};

function renderDailyAverageRefill(data) {
    const avgContainer = document.getElementById('daily-average-refill-container');
    if (!avgContainer) return;

    const summary = data.dailyRefillSummary || {};
    const averages = data.dailyAveragePiecesPerProduct || [];

    if (!averages.length && !summary.avgPieces) {
        avgContainer.innerHTML = '<p style="color:var(--muted); text-align:center;">No hay datos de relleno en los ultimos 7 dias.</p>';
        return;
    }

    avgContainer.innerHTML = `
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-bottom:14px;">
            ${renderMiniMetric('Mov/dia', summary.avgMovements || 0)}
            ${renderMiniMetric('Cajas/dia', summary.avgBoxes || 0)}
            ${renderMiniMetric('Piezas/dia', summary.avgPieces || 0)}
        </div>
        <div style="font-size:12px; color:var(--muted); margin-bottom:12px; text-align:left;">
            ${summary.activeDays || 0} de ${summary.periodDays || 7} dias tuvieron relleno.
            ${summary.bestDay ? ` Dia pico: ${formatDateLabel(summary.bestDay.fecha)} con ${summary.bestDay.piezas.toLocaleString('es-MX')} piezas.` : ''}
        </div>
        <div style="text-align:left;">
            ${averages.slice(0, 10).map(item => `
                <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; padding:9px 0; border-bottom:1px solid var(--border);">
                    <div style="min-width:0;">
                        <div style="font-size:13px; font-weight:600; color:var(--text); overflow:hidden; text-overflow:ellipsis;">
                            ${escapeHtml(item.nombre)}
                        </div>
                        <div style="font-size:11px; color:var(--muted); margin-top:2px;">
                            ${item.totalCajas.toLocaleString('es-MX')} cajas en ${item.movimientos.toLocaleString('es-MX')} movimientos
                        </div>
                    </div>
                    <div style="font-size:14px; font-weight:800; color:var(--primary); white-space:nowrap;">
                        ${item.dailyAverage.toLocaleString('es-MX')} pz/dia
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

window.renderTopSellersReport = function(top10Data) {
    const container = document.getElementById('top-sellers-container');
    if (!container) return;

    if (!top10Data || top10Data.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#6b7280;">No se encontraron datos de ventas.</p>';
        return;
    }

    const medals = ['1', '2', '3'];

    container.innerHTML = top10Data.map((p, i) => `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 0; border-bottom:1px solid var(--border);">
            <div style="display:flex; align-items:center; gap:12px; min-width:0;">
                <span style="font-size:13px; min-width:30px; text-align:center; font-weight:800; color:var(--primary);">
                    ${i < 3 ? medals[i] : (i + 1)}
                </span>
                <div style="min-width:0;">
                    <div style="font-size:13px; font-weight:600; color:var(--text); overflow:hidden; text-overflow:ellipsis;">
                        ${escapeHtml(p.nombre)}
                    </div>
                    <div style="font-size:11px; color:var(--muted); margin-top:2px;">
                        ${escapeHtml(p.marca)} · ${p.movimientos.toLocaleString('es-MX')} movimientos
                    </div>
                </div>
            </div>
            <div style="font-weight:700; color:#059669; font-size:14px; text-align:right; white-space:nowrap;">
                ${p.totalPiezas.toLocaleString('es-MX')}
                <small style="display:block; color:var(--muted); font-weight:500;">piezas</small>
            </div>
        </div>
    `).join('');
};

function renderKPI(label, valor, color) {
    return `
        <div class="card" style="padding:15px; text-align:center; border-left:4px solid ${color};">
            <div style="font-size:10px; color:var(--muted); text-transform:uppercase; margin-bottom:5px; font-weight:600;">
                ${label}
            </div>
            <div style="font-size:24px; font-weight:800; color:${color};">
                ${Number(valor || 0).toLocaleString('es-MX')}
            </div>
        </div>
    `;
}

function renderMiniMetric(label, value) {
    return `
        <div style="border:1px solid var(--border); border-radius:8px; padding:10px; text-align:center; background:#fff;">
            <div style="font-size:10px; color:var(--muted); text-transform:uppercase; font-weight:700;">${label}</div>
            <div style="font-size:18px; color:var(--primary); font-weight:800; margin-top:4px;">${Number(value || 0).toLocaleString('es-MX')}</div>
        </div>
    `;
}

function renderTopProductos(productos) {
    if (!productos || productos.length === 0) {
        return '<p style="color:var(--muted); font-size:13px; text-align:center;">Sin datos</p>';
    }

    return productos.map((p, i) => `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 0; border-bottom:1px solid var(--border);">
            <div style="min-width:0;">
                <div style="font-size:13px; font-weight:600; color:var(--text); overflow:hidden; text-overflow:ellipsis;">
                    ${i + 1}. ${escapeHtml(p.nombre)}
                </div>
                <div style="font-size:11px; color:var(--muted); margin-top:2px;">
                    ${escapeHtml(p.marca)} · ${p.totalPiezas.toLocaleString('es-MX')} piezas
                </div>
            </div>
            <div style="font-weight:700; color:#2563eb; font-size:14px; white-space:nowrap;">
                ${p.total.toLocaleString('es-MX')} cajas
            </div>
        </div>
    `).join('');
}

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
                    ${escapeHtml(m.marca)}
                </span>
            </div>
            <div style="font-weight:700; color:${colores[i]}; font-size:14px;">
                ${m.total.toLocaleString('es-MX')} cajas
            </div>
        </div>
    `).join('');
}

function renderChart(historico) {
    const canvas = document.getElementById('chartSemanas');
    if (!canvas || typeof Chart === 'undefined') return;

    const ctx = canvas.getContext('2d');
    if (analyticsChart) {
        analyticsChart.destroy();
        analyticsChart = null;
    }

    const keys = Object.keys(historico || {});
    const labels = keys.map(formatDateLabel);
    const valores = Object.values(historico || {});

    analyticsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Rellenos',
                data: valores,
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.35,
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

function formatDateLabel(dateKey) {
    if (!dateKey) return '';
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('es-MX', {
        weekday: 'short',
        day: 'numeric'
    });
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

console.log('[Analytics UI] analytics-ui.js cargado correctamente');
