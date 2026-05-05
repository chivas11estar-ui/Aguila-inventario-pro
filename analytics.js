// ============================================================
// Aguila Inventario Pro - Modulo: analytics.js
// Logica de estadisticas de relleno y reportes
// ============================================================

const ANALYTICS_PERIOD_DAYS = 7;

window.ANALYTICS_STATE = {
    determinante: null,
    movimientos: [],
    auditorias: [],
    resumen: {
        totalRellenosHoy: 0,
        cajasMovidasHoy: 0,
        piezasMovidasHoy: 0,
        auditoriasHoy: 0,
        productosDistintos: 0,
        topProductos: [],
        topMarcas: [],
        historico7Dias: {},
        historicoPiezas7Dias: {},
        dailyRefillSummary: {
            periodDays: ANALYTICS_PERIOD_DAYS,
            activeDays: 0,
            avgMovements: 0,
            avgBoxes: 0,
            avgPieces: 0,
            bestDay: null
        },
        dailyAveragePiecesPerProduct: []
    }
};

function toLocalDateKey(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function startOfLocalDay(daysAgo = 0) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    date.setHours(0, 0, 0, 0);
    return date;
}

function buildLastSevenDayKeys() {
    const days = [];
    for (let i = ANALYTICS_PERIOD_DAYS - 1; i >= 0; i--) {
        days.push(toLocalDateKey(startOfLocalDay(i)));
    }
    return days;
}

function asNumber(value) {
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
}

async function initAnalytics() {
    console.log('[Analytics] Iniciando...');
    const userId = firebase.auth().currentUser?.uid;
    if (!userId) {
        console.warn('[Analytics] Usuario no autenticado');
        return;
    }

    try {
        const userSnap = await firebase.database().ref(`usuarios/${userId}`).once('value');
        const userData = userSnap.val();

        if (!userData?.determinante) {
            console.error('[Analytics] No se encontro determinante');
            showToast('Error: No se encontro informacion de la tienda', 'error');
            return;
        }

        window.ANALYTICS_STATE.determinante = userData.determinante;
        await fetchAnalyticsData();
    } catch (error) {
        console.error('[Analytics] Error en initAnalytics:', error);
        showToast('Error al inicializar Analytics', 'error');
    }
}

async function fetchAnalyticsData() {
    const det = window.ANALYTICS_STATE.determinante;
    if (!det) return;

    const fromISO = startOfLocalDay(ANALYTICS_PERIOD_DAYS - 1).toISOString();

    try {
        const [movSnap, auditSnap] = await Promise.all([
            firebase.database().ref(`movimientos/${det}`).orderByChild('fecha').startAt(fromISO).once('value'),
            firebase.database().ref(`auditorias/${det}`).orderByChild('fecha').startAt(fromISO).once('value')
        ]);

        const movimientos = [];
        movSnap.forEach(child => movimientos.push(child.val()));

        const auditorias = [];
        auditSnap.forEach(child => auditorias.push(child.val()));

        window.ANALYTICS_STATE.movimientos = movimientos;
        window.ANALYTICS_STATE.auditorias = auditorias;

        procesarMetricas();

        if (typeof window.renderAnalyticsUI === 'function') {
            window.renderAnalyticsUI();
        }
    } catch (error) {
        console.error('[Analytics] Error cargando datos:', error);
        showToast('Error al cargar estadisticas', 'error');
    }
}

function procesarMetricas() {
    const movs = window.ANALYTICS_STATE.movimientos || [];
    const audits = window.ANALYTICS_STATE.auditorias || [];
    const res = window.ANALYTICS_STATE.resumen;
    const todayKey = toLocalDateKey();
    const dayKeys = buildLastSevenDayKeys();
    const salidaMovs = movs.filter(m => m?.tipo === 'salida');
    const movsHoy = salidaMovs.filter(m => toLocalDateKey(m.fecha) === todayKey);

    res.totalRellenosHoy = movsHoy.length;
    res.cajasMovidasHoy = movsHoy.reduce((acc, m) => acc + asNumber(m.cajasMovidas), 0);
    res.piezasMovidasHoy = movsHoy.reduce((acc, m) => acc + asNumber(m.piezasMovidas), 0);
    res.auditoriasHoy = audits.filter(a => toLocalDateKey(a.fecha) === todayKey).length;
    res.productosDistintos = new Set(movsHoy.map(m => m.productoNombre).filter(Boolean)).size;

    const conteoProd = {};
    const conteoMarcas = {};
    const piezasPorProducto = {};
    const cajasPorProducto = {};
    const movimientosPorProducto = {};

    res.historico7Dias = {};
    res.historicoPiezas7Dias = {};
    dayKeys.forEach(key => {
        res.historico7Dias[key] = 0;
        res.historicoPiezas7Dias[key] = 0;
    });

    salidaMovs.forEach(m => {
        const fechaKey = toLocalDateKey(m.fecha);
        if (!dayKeys.includes(fechaKey)) return;

        const nombre = m.productoNombre || 'Desconocido';
        const marca = m.marca || 'Otra';
        const cajas = asNumber(m.cajasMovidas);
        const piezas = asNumber(m.piezasMovidas);

        res.historico7Dias[fechaKey] += 1;
        res.historicoPiezas7Dias[fechaKey] += piezas;

        if (!conteoProd[nombre]) {
            conteoProd[nombre] = { nombre, marca, total: 0, totalPiezas: 0 };
        }
        conteoProd[nombre].total += cajas;
        conteoProd[nombre].totalPiezas += piezas;

        conteoMarcas[marca] = (conteoMarcas[marca] || 0) + cajas;
        piezasPorProducto[nombre] = (piezasPorProducto[nombre] || 0) + piezas;
        cajasPorProducto[nombre] = (cajasPorProducto[nombre] || 0) + cajas;
        movimientosPorProducto[nombre] = (movimientosPorProducto[nombre] || 0) + 1;
    });

    res.topProductos = Object.values(conteoProd)
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

    res.topMarcas = Object.entries(conteoMarcas)
        .map(([marca, total]) => ({ marca, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

    const totalMovimientos = Object.values(res.historico7Dias).reduce((sum, value) => sum + value, 0);
    const totalPiezas = Object.values(res.historicoPiezas7Dias).reduce((sum, value) => sum + value, 0);
    const totalCajas = salidaMovs
        .filter(m => dayKeys.includes(toLocalDateKey(m.fecha)))
        .reduce((sum, m) => sum + asNumber(m.cajasMovidas), 0);
    const activeDays = Object.values(res.historico7Dias).filter(value => value > 0).length;
    const bestDayEntry = Object.entries(res.historicoPiezas7Dias).sort((a, b) => b[1] - a[1])[0];

    res.dailyRefillSummary = {
        periodDays: ANALYTICS_PERIOD_DAYS,
        activeDays,
        avgMovements: Math.round(totalMovimientos / ANALYTICS_PERIOD_DAYS),
        avgBoxes: Math.round(totalCajas / ANALYTICS_PERIOD_DAYS),
        avgPieces: Math.round(totalPiezas / ANALYTICS_PERIOD_DAYS),
        bestDay: bestDayEntry && bestDayEntry[1] > 0
            ? { fecha: bestDayEntry[0], piezas: bestDayEntry[1] }
            : null
    };

    res.dailyAveragePiecesPerProduct = Object.keys(piezasPorProducto)
        .map(nombre => ({
            nombre,
            totalPiezas: piezasPorProducto[nombre],
            totalCajas: cajasPorProducto[nombre] || 0,
            movimientos: movimientosPorProducto[nombre] || 0,
            dailyAverage: Math.round(piezasPorProducto[nombre] / ANALYTICS_PERIOD_DAYS)
        }))
        .sort((a, b) => b.dailyAverage - a.dailyAverage);

    console.log('[Analytics] Metricas calculadas:', res);
}

async function generateAndRenderTop10() {
    const container = document.getElementById('top-sellers-container');
    const btn = document.getElementById('btn-generate-top-sellers');
    if (!container || !btn) return;

    btn.disabled = true;
    container.innerHTML = '<p style="text-align:center; color:#6b7280;">Cargando historial completo...</p>';

    const det = window.ANALYTICS_STATE.determinante;
    if (!det) {
        container.innerHTML = '<p style="text-align:center; color:#ef4444;">Error: No se pudo identificar la tienda.</p>';
        btn.disabled = false;
        return;
    }

    try {
        const movSnap = await firebase.database()
            .ref(`movimientos/${det}`)
            .orderByChild('tipo')
            .equalTo('salida')
            .once('value');

        if (!movSnap.exists()) {
            container.innerHTML = '<p style="text-align:center; color:#6b7280;">No hay movimientos de salida registrados.</p>';
            return;
        }

        const conteoPiezas = {};
        movSnap.forEach(child => {
            const m = child.val();
            const nombre = m.productoNombre || 'Desconocido';
            if (nombre === 'Desconocido') return;

            const piezas = asNumber(m.piezasMovidas);
            if (!conteoPiezas[nombre]) {
                conteoPiezas[nombre] = {
                    nombre,
                    marca: m.marca || 'N/A',
                    totalPiezas: 0,
                    totalCajas: 0,
                    movimientos: 0
                };
            }

            conteoPiezas[nombre].totalPiezas += piezas;
            conteoPiezas[nombre].totalCajas += asNumber(m.cajasMovidas);
            conteoPiezas[nombre].movimientos += 1;
        });

        const top10Data = Object.values(conteoPiezas)
            .sort((a, b) => b.totalPiezas - a.totalPiezas)
            .slice(0, 10);

        if (typeof window.renderTopSellersReport === 'function') {
            window.renderTopSellersReport(top10Data);
        } else {
            container.innerHTML = '<p style="text-align:center; color:#ef4444;">Error de renderizado. Contacta a soporte.</p>';
        }
    } catch (error) {
        console.error('[Analytics] Error generando Top 10:', error);
        container.innerHTML = '<p style="text-align:center; color:#ef4444;">Ocurrio un error al cargar el reporte.</p>';
    } finally {
        btn.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    firebase.auth().onAuthStateChanged(user => {
        if (user) initAnalytics();
    });

    document.querySelectorAll('[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.dataset.tab === 'analytics' && window.ANALYTICS_STATE.determinante) {
                fetchAnalyticsData();
            }
        });
    });

    const top10Btn = document.getElementById('btn-generate-top-sellers');
    if (top10Btn) {
        top10Btn.addEventListener('click', generateAndRenderTop10);
    }
});

window.reloadAnalytics = async function() { await fetchAnalyticsData(); };
window.initAnalytics = initAnalytics;
window.fetchAnalyticsData = fetchAnalyticsData;
window.generateAndRenderTop10 = generateAndRenderTop10;

console.log('[Analytics] analytics.js cargado correctamente');
