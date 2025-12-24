// ============================================================
// Águila Inventario Pro - Módulo: analytics.js
// Lógica de Analytics (Solo Lectura)
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
        historico7Dias: {}
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
        
        await fetchAnalyticsData();

    } catch (error) {
        console.error('❌ Error en initAnalytics:', error);
        showToast('Error al inicializar Analytics', 'error');
    }
}

// ============================================================
// CARGAR DATOS DE FIREBASE
// ============================================================
async function fetchAnalyticsData() {
    const det = window.ANALYTICS_STATE.determinante;
    if (!det) return;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const hoyISO = hoy.toISOString();

    const hace7Dias = new Date();
    hace7Dias.setDate(hace7Dias.getDate() - 7);
    hace7Dias.setHours(0, 0, 0, 0);
    const hace7DiasISO = hace7Dias.toISOString();

    console.log('📅 Rango de fechas:', hace7DiasISO, '-', hoyISO);

    try {
        // Consultar movimientos y auditorías en paralelo
        const [movSnap, auditSnap] = await Promise.all([
            firebase.database()
                .ref(`movimientos/${det}`)
                .orderByChild('fecha')
                .startAt(hace7DiasISO)
                .once('value'),
            firebase.database()
                .ref(`auditorias/${det}`)
                .orderByChild('fecha')
                .startAt(hace7DiasISO)
                .once('value')
        ]);

        // Convertir snapshots a arrays
        const movimientos = [];
        movSnap.forEach(child => {
            movimientos.push(child.val());
        });

        const auditorias = [];
        auditSnap.forEach(child => {
            auditorias.push(child.val());
        });

        window.ANALYTICS_STATE.movimientos = movimientos;
        window.ANALYTICS_STATE.auditorias = auditorias;

        console.log('✅ Datos cargados:', {
            movimientos: movimientos.length,
            auditorias: auditorias.length
        });

        // Procesar métricas
        procesarMetricas(hoyISO);

        // Renderizar UI (si existe la función)
        if (typeof window.renderAnalyticsUI === 'function') {
            window.renderAnalyticsUI();
        } else {
            console.warn('⚠️ renderAnalyticsUI no está disponible');
        }

    } catch (error) {
        console.error('❌ Error cargando datos de analytics:', error);
        showToast('Error al cargar estadísticas', 'error');
    }
}

// ============================================================
// PROCESAR MÉTRICAS
// ============================================================
function procesarMetricas(fechaHoy) {
    const movs = window.ANALYTICS_STATE.movimientos;
    const audits = window.ANALYTICS_STATE.auditorias;
    const res = window.ANALYTICS_STATE.resumen;

    console.log('🧮 Procesando métricas...');

    // 1️⃣ KPIs de HOY
    const movsHoy = movs.filter(m => m.fecha && m.fecha.startsWith(fechaHoy.split('T')[0]));
    
    res.totalRellenosHoy = movsHoy.length;
    res.cajasMovidasHoy = movsHoy.reduce((acc, m) => acc + (parseInt(m.cajasMovidas) || 0), 0);
    res.auditoriasHoy = audits.filter(a => a.fecha && a.fecha.startsWith(fechaHoy.split('T')[0])).length;
    
    // Productos distintos movidos hoy
    const productosUnicos = new Set(movsHoy.map(m => m.productoNombre).filter(Boolean));
    res.productosDistintos = productosUnicos.size;

    // 2️⃣ TOP 5 PRODUCTOS (por cajas movidas en 7 días)
    const conteoProd = {};
    movs.forEach(m => {
        const nombre = m.productoNombre || 'Desconocido';
        const cajas = parseInt(m.cajasMovidas) || 0;
        
        if (!conteoProd[nombre]) {
            conteoProd[nombre] = {
                nombre: nombre,
                marca: m.marca || 'N/A',
                total: 0
            };
        }
        conteoProd[nombre].total += cajas;
    });

    res.topProductos = Object.values(conteoProd)
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

    // 3️⃣ TOP MARCAS (por cajas movidas en 7 días)
    const conteoMarcas = {};
    movs.forEach(m => {
        const marca = m.marca || 'Otra';
        const cajas = parseInt(m.cajasMovidas) || 0;
        conteoMarcas[marca] = (conteoMarcas[marca] || 0) + cajas;
    });

    res.topMarcas = Object.entries(conteoMarcas)
        .map(([marca, total]) => ({ marca, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

    // 4️⃣ HISTÓRICO 7 DÍAS (para gráfica)
    res.historico7Dias = {};
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
        const fechaStr = d.toISOString().split('T')[0];
        
        const movimientosDia = movs.filter(m => 
            m.fecha && m.fecha.startsWith(fechaStr)
        );
        
        res.historico7Dias[fechaStr] = movimientosDia.length;
    }

    console.log('✅ Métricas procesadas:', res);
}

// ============================================================
// RECARGAR ANALYTICS (público)
// ============================================================
window.reloadAnalytics = async function() {
    console.log('🔄 Recargando analytics...');
    await fetchAnalyticsData();
};

// ============================================================
// INICIALIZACIÓN AUTOMÁTICA
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('📊 Analytics: Esperando autenticación...');
    
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            console.log('✅ Analytics: Usuario autenticado');
            initAnalytics();
        }
    });

    // Escuchar cambio a pestaña analytics
    document.querySelectorAll('[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.dataset.tab === 'analytics') {
                console.log('📊 Tab analytics activado');
                // Recargar datos si ya existe determinante
                if (window.ANALYTICS_STATE.determinante) {
                    fetchAnalyticsData();
                }
            }
        });
    });
});

// Exponer funciones
window.initAnalytics = initAnalytics;
window.fetchAnalyticsData = fetchAnalyticsData;

console.log('✅ analytics.js cargado correctamente');