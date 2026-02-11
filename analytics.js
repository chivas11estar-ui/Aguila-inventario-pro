// ============================================================
// Águila Inventario Pro - Módulo: analytics.js
// Lógica de Analytics (con Top 10)
// Copyright © 2025 José A. G. Betancourt
// ============================================================

window.ANALYTICS_STATE = {
    determinante: null,
    movimientos: [],
    auditorias: [],
    resumen: {
        totalRellenosHoy: 0,
        cajasMovidasHoy: 0,
        auditoriasHoy: 0,
        productosDistintos: 0,
        topProductos: [],
        topMarcas: [],
        historico7Dias: {},
        dailyAveragePiecesPerProduct: [] // Nueva propiedad para el promedio por producto
    }
};

// ============================================================
// INICIALIZACIÓN
// ============================================================
async function initAnalytics() {
    console.log('📊 Iniciando Analytics...');
    const userId = firebase.auth().currentUser?.uid;
    if (!userId) {
        console.warn('⚠️ Analytics: Usuario no autenticado');
        return;
    }

    try {
        const userSnap = await firebase.database().ref(`usuarios/${userId}`).once('value');
        const userData = userSnap.val();

        if (!userData || !userData.determinante) {
            console.error('❌ Analytics: No se encontró determinante');
            showToast('Error: No se encontró información de la tienda', 'error');
            return;
        }

        window.ANALYTICS_STATE.determinante = userData.determinante;
        console.log('✅ Analytics: Determinante cargado:', window.ANALYTICS_STATE.determinante);

        await window.loadStats(); // Ahora llama a la función loadStats expuesta globalmente

    } catch (error) {
        console.error('❌ Error en initAnalytics:', error);
        showToast('Error al inicializar Analytics', 'error');
    }
}

// ============================================================
// CARGAR DATOS DE FIREBASE (7 DÍAS) - Renombrado y expuesto como window.loadStats
// ============================================================
window.loadStats = async function () { // Expuesto globalmente como loadStats
    console.log("📊 Cargando estadísticas..."); // Log de inicio de carga
    const det = window.ANALYTICS_STATE.determinante;
    if (!det) {
        console.warn('⚠️ loadStats: Determinante no disponible, no se pueden cargar las estadísticas.');
        // Intentar obtener el determinante si no está cargado (útil si la función se llama directamente sin pasar por initAnalytics)
        const userId = firebase.auth().currentUser?.uid;
        if (userId) {
            const userSnap = await firebase.database().ref(`usuarios/${userId}`).once('value');
            const userData = userSnap.val();
            if (userData && userData.determinante) {
                window.ANALYTICS_STATE.determinante = userData.determinante;
                console.log('✅ loadStats: Determinante recuperado:', window.ANALYTICS_STATE.determinante);
            } else {
                showToast('Error: Determinante no disponible para cargar estadísticas', 'error');
                return;
            }
        } else {
            showToast('Error: Usuario no autenticado y determinante no disponible', 'error');
            return;
        }
    }

    const hoy = new Date();
    const hoyStr = getLocalDateString(hoy); // "2026-02-10"

    const hace7Dias = new Date();
    hace7Dias.setDate(hace7Dias.getDate() - 7);
    const hace7DiasStr = getLocalDateString(hace7Dias);

    try {
        const [movSnap, auditSnap] = await Promise.all([
            firebase.database().ref(`movimientos/${det}`).once('value'),
            firebase.database().ref(`auditorias/${det}`).once('value')
        ]);

        const movimientos = [];
        movSnap.forEach(child => { movimientos.push(child.val()); });
        const auditorias = [];
        auditSnap.forEach(child => { auditorias.push(child.val()); });

        // Filtrar solo los últimos 7 días en zona horaria local
        const movimientosFiltrados = movimientos.filter(m => {
            if (!m.fecha) return false;
            const fechaMov = isoToLocalDate(m.fecha);
            return fechaMov >= hace7DiasStr;
        });
        const auditoriasFiltradas = auditorias.filter(a => {
            if (!a.fecha) return false;
            const fechaAud = isoToLocalDate(a.fecha);
            return fechaAud >= hace7DiasStr;
        });

        window.ANALYTICS_STATE.movimientos = movimientosFiltrados;
        window.ANALYTICS_STATE.auditorias = auditoriasFiltradas;

        procesarMetricas(hoyStr);

        if (typeof window.renderAnalyticsUI === 'function') {
            window.renderAnalyticsUI();
        }

    } catch (error) {
        console.error('❌ Error cargando datos de analytics:', error);
        showToast('Error al cargar estadísticas', 'error');
    }
}

// ============================================================
// PROCESAR MÉTRICAS (7 DÍAS)
// ============================================================
function procesarMetricas(fechaHoy) {
    const movs = window.ANALYTICS_STATE.movimientos;
    const audits = window.ANALYTICS_STATE.auditorias;
    const res = window.ANALYTICS_STATE.resumen;

    // Métricas de Hoy (usando fecha local)
    const movsHoy = movs.filter(m => m.fecha && isoToLocalDate(m.fecha) === fechaHoy);
    res.totalRellenosHoy = movsHoy.length;
    res.cajasMovidasHoy = movsHoy.reduce((acc, m) => acc + (parseInt(m.cajasMovidas) || 0), 0);
    res.auditoriasHoy = audits.filter(a => a.fecha && isoToLocalDate(a.fecha) === fechaHoy).length;
    res.productosDistintos = new Set(movsHoy.map(m => m.productoNombre).filter(Boolean)).size;

    // Top 5 Productos (basado en cajas en 7 días)
    const conteoProd = {};
    movs.forEach(m => {
        if (m.tipo !== 'salida') return;
        const nombre = m.productoNombre || 'Desconocido';
        const cajas = parseInt(m.cajasMovidas) || 0;
        if (!conteoProd[nombre]) {
            conteoProd[nombre] = { nombre: nombre, marca: m.marca || 'N/A', total: 0 };
        }
        conteoProd[nombre].total += cajas;
    });
    res.topProductos = Object.values(conteoProd).sort((a, b) => b.total - a.total).slice(0, 5);

    // Top 5 Marcas (basado en cajas en 7 días)
    const conteoMarcas = {};
    movs.forEach(m => {
        if (m.tipo !== 'salida') return;
        const marca = m.marca || 'Otra';
        const cajas = parseInt(m.cajasMovidas) || 0;
        conteoMarcas[marca] = (conteoMarcas[marca] || 0) + cajas;
    });
    res.topMarcas = Object.entries(conteoMarcas).map(([marca, total]) => ({ marca, total })).sort((a, b) => b.total - a.total).slice(0, 5);

    // Histórico de Rellenos (7 días) usando zona horaria local
    res.historico7Dias = {};
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const fechaStr = getLocalDateString(d);
        const movimientosDia = movs.filter(m => m.fecha && isoToLocalDate(m.fecha) === fechaStr && m.tipo === 'salida');
        res.historico7Dias[fechaStr] = movimientosDia.length;
    }

    // Nuevo: Promedio Diario de Piezas POR PRODUCTO (7 días)
    const refillMovements = movs.filter(m => m.tipo === 'salida');
    const piecesPerProduct = {};

    refillMovements.forEach(m => {
        const productName = m.productoNombre || 'Desconocido';
        const pieces = parseInt(m.piezasMovidas) || 0;
        if (!piecesPerProduct[productName]) {
            piecesPerProduct[productName] = 0;
        }
        piecesPerProduct[productName] += pieces;
    });

    const dailyAveragePiecesPerProduct = Object.keys(piecesPerProduct).map(productName => {
        return {
            nombre: productName,
            dailyAverage: Math.round(piecesPerProduct[productName] / 7)
        };
    }).sort((a, b) => b.dailyAverage - a.dailyAverage); // Ordenar por promedio diario más alto

    res.dailyAveragePiecesPerProduct = dailyAveragePiecesPerProduct;
    console.log(`📊 Promedio diario de piezas POR PRODUCTO calculado:`, res.dailyAveragePiecesPerProduct);
} // <--- Corregido: Agregado el corchete de cierre que faltaba aquí

// ============================================================
// LÓGICA TOP 10 MÁS VENDIDOS (HISTÓRICO COMPLETO)
// ============================================================
async function generateAndRenderTop10() {
    const container = document.getElementById('top-sellers-container');
    const btn = document.getElementById('btn-generate-top-sellers');
    if (!container || !btn) return;

    btn.disabled = true;
    container.innerHTML = '<p style="text-align:center; color: #6b7280;">🔄 Cargando historial completo...</p>';

    const det = window.ANALYTICS_STATE.determinante;
    if (!det) {
        container.innerHTML = '<p style="text-align:center; color: #ef4444;">Error: No se pudo identificar la tienda.</p>';
        btn.disabled = false;
        return;
    }

    try {
        const movSnap = await firebase.database().ref(`movimientos/${det}`).orderByChild('tipo').equalTo('salida').once('value');

        if (!movSnap.exists()) {
            container.innerHTML = '<p style="text-align:center; color: #6b7280;">No hay movimientos de salida registrados.</p>';
            btn.disabled = false;
            return;
        }

        const movimientos = movSnap.val();
        const conteoPiezas = {};

        Object.values(movimientos).forEach(m => {
            const nombre = m.productoNombre || 'Desconocido';
            if (nombre === 'Desconocido') return;

            const piezas = parseInt(m.piezasMovidas) || 0;
            if (!conteoPiezas[nombre]) {
                conteoPiezas[nombre] = { nombre: nombre, marca: m.marca || 'N/A', totalPiezas: 0 };
            }
            conteoPiezas[nombre].totalPiezas += piezas;
        });

        const top10Data = Object.values(conteoPiezas)
            .sort((a, b) => b.totalPiezas - a.totalPiezas)
            .slice(0, 10);

        if (typeof window.renderTopSellersReport === 'function') {
            window.renderTopSellersReport(top10Data);
        } else {
            container.innerHTML = '<p style="text-align:center; color: #ef4444;">Error de renderizado. Contacta a soporte.</p>';
        }

    } catch (error) {
        console.error("Error generando Top 10:", error);
        container.innerHTML = `<p style="text-align:center; color: #ef4444;">Ocurrió un error al cargar el reporte.</p>`;
    } finally {
        btn.disabled = false;
    }
}

// ============================================================
// INICIALIZACIÓN AUTOMÁTICA Y EVENTOS
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            initAnalytics();
        }
    });

    // Listener para el botón de la pestaña analytics (ahora llama a window.loadStats)
    document.querySelectorAll('[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.dataset.tab === 'analytics' && window.ANALYTICS_STATE.determinante) {
                window.loadStats();
            }
        });
    });

    // Listener para el nuevo botón del Top 10
    const top10Btn = document.getElementById('btn-generate-top-sellers');
    if (top10Btn) {
        top10Btn.addEventListener('click', generateAndRenderTop10);
    }
});

// Exponer funciones globalmente (solo las necesarias)
window.reloadAnalytics = async function () { await window.loadStats(); };
window.initAnalytics = initAnalytics;
// Ya no es necesario exponer fetchAnalyticsData directamente, ya que se ha renombrado a window.loadStats
// window.fetchAnalyticsData = fetchAnalyticsData; 

console.log('✅ analytics.js (con Top 10) cargado correctamente');