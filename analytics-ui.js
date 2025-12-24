// ============================================================
// Águila Inventario Pro - Módulo: analytics-ui.js
// Visualización de Analytics
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

    // Validar si hay datos
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

    // Renderizar estructura completa
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
                🔥 Top 5 Productos Más Movidos
            </h3>
            <div id="top-products-list">
                ${renderTopProductos(data.topProductos)}
            </div>
        </div>

        <!-- Top Marcas -->
        <div class="card" style="margin-bottom:20px;">
            <h3 style="font-size:14px; margin-bottom:15px; color:var(--primary);">
                🏷️ Marcas Más Movidas
            </h3>
            <div id="top-brands-list">
                ${renderTopMarcas(data.topMarcas)}
            </div>
        </div>

        <!-- Espacio bottom nav -->
        <div style="height:80px;"></div>
    `;

    // Renderizar gráfico (después del DOM)
    setTimeout(() => {
        renderChart(data.historico7Dias);
    }, 100);
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
    if (!canvas) {
        console.warn('⚠️ Canvas chartSemanas no encontrado');
        return;
    }

    const ctx = canvas.getContext('2d');

    // Destruir gráfico anterior si existe
    if (analyticsChart) {
        analyticsChart.destroy();
        analyticsChart = null;
    }

    // Preparar datos
    const fechas = Object.keys(historico);
    const valores = Object.values(historico);

    // Formatear labels (solo día del mes)
    const labels = fechas.map(f => {
        const d = new Date(f);
        return d.getDate(); // Solo el día
    });

    // Crear gráfico
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
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#2563eb',
                    borderWidth: 1,
                    displayColors: false,
                    callbacks: {
                        title: function(context) {
                            const fecha = fechas[context[0].dataIndex];
                            const d = new Date(fecha);
                            return d.toLocaleDateString('es-MX', { 
                                weekday: 'short', 
                                day: 'numeric', 
                                month: 'short' 
                            });
                        },
                        label: function(context) {
                            return `${context.parsed.y} rellenos`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        color: '#6b7280',
                        font: {
                            size: 11
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    ticks: {
                        color: '#6b7280',
                        font: {
                            size: 11
                        }
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });

    console.log('✅ Gráfico renderizado');
}

console.log('✅ analytics-ui.js cargado correctamente');