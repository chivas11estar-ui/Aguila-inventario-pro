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
window.loadStats = async function () { 
    console.log("📊 [ARCHITECT] Verificando requisitos para carga de estadísticas...");

    // 1. ASIGNACIÓN EXPRESA Y SEGURA DEL DETERMINANTE (Fuente de Verdad: PROFILE_STATE)
    const det = window.PROFILE_STATE?.determinante || window.ANALYTICS_STATE?.determinante;

    // 2. VALIDACIÓN ESTRICTA (Race Condition evitada)
    if (!det || det === "null" || det === "undefined") {
        console.warn('🛑 [ARCHITECT] loadStats cancelada: Determinante no disponible (Evitando Permission Denied).');
        return; 
    }

    const hoy = new Date();
    const hoyStr = getLocalDateString(hoy); 

    const hace7Dias = new Date();
    hace7Dias.setDate(hace7Dias.getDate() - 7);
    const hace7DiasStr = getLocalDateString(hace7Dias);

    try {
        console.log(`📡 [ARCHITECT] Consultando Firebase para Tienda: ${det}`);
        
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
            setTimeout(() => {
                window.renderAnalyticsUI();
            }, 0);
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

    // NUEVO: Promedio Diario Inteligente (Ciclo Viernes-Jueves) + Semanal + Mensual
    const refillMovements = movs.filter(m => m.tipo === 'salida' || m.tipo === 'entrada_directa_anaquel');
    
    // Función para calcular días transcurridos en el ciclo actual (Viernes a Hoy)
    const getDaysInCycle = () => {
        const hoy = new Date();
        const diaSemana = hoy.getDay(); // 0=Dom, 1=Lun, ..., 5=Vie, 6=Sab
        // Mapeo: Vie=1, Sab=2, Dom=3, Lun=4, Mar=5, Mie=6, Jue=7
        const mapping = { 5: 1, 6: 2, 0: 3, 1: 4, 2: 5, 3: 6, 4: 7 };
        return mapping[diaSemana] || 1;
    };

    const daysInCurrentCycle = getDaysInCycle();
    const statsPerProduct = {};

    // 1. Calcular sumas por periodos
    const ahora = Date.now();
    const unaSemanaMs = 7 * 24 * 60 * 60 * 1000;
    const unMesMs = 30 * 24 * 60 * 60 * 1000;

    refillMovements.forEach(m => {
        const productName = m.productoNombre || 'Desconocido';
        const pieces = parseInt(m.piezasMovidas) || 0;
        const movFecha = m.fecha;

        if (!statsPerProduct[productName]) {
            statsPerProduct[productName] = { 
                currentCyclePieces: 0, 
                last7DaysPieces: 0, 
                last30DaysPieces: 0 
            };
        }

        const diffMs = ahora - movFecha;
        // Ciclo actual (desde el Viernes)
        if (diffMs <= (daysInCurrentCycle * 24 * 60 * 60 * 1000)) {
            statsPerProduct[productName].currentCyclePieces += pieces;
        }
        // Últimos 7 días
        if (diffMs <= unaSemanaMs) {
            statsPerProduct[productName].last7DaysPieces += pieces;
        }
        // Últimos 30 días
        if (diffMs <= unMesMs) {
            statsPerProduct[productName].last30DaysPieces += pieces;
        }
    });

    // 2. Generar objeto de analítica avanzada
    const analyticsPerProduct = {};
    Object.keys(statsPerProduct).forEach(name => {
        const stats = statsPerProduct[name];
        
        // Promedio Diario: Ciclo actual / días ciclo
        const dailyAvg = Math.round(stats.currentCyclePieces / daysInCurrentCycle);
        // Semanal: Total últimos 7 días
        const weeklyTotal = stats.last7DaysPieces;
        // Mensual: Total últimos 30 días
        const monthlyTotal = stats.last30DaysPieces;

        analyticsPerProduct[name] = {
            daily: dailyAvg,
            weekly: weeklyTotal,
            monthly: monthlyTotal,
            cycleDays: daysInCurrentCycle
        };
    });

    res.analyticsPerProduct = analyticsPerProduct;
    // Compatibilidad con el formato anterior
    res.dailyAveragePiecesPerProduct = Object.keys(analyticsPerProduct).map(name => ({
        nombre: name,
        dailyAverage: analyticsPerProduct[name].daily
    })).sort((a, b) => b.dailyAverage - a.dailyAverage);

    console.log(`📊 Motor de Analítica Walmart-Style activo:`, res.analyticsPerProduct);
}

// ============================================================
// LÓGICA DE EXPORTACIÓN A EXCEL/CSV (REPORTE COMPLETO)
// ============================================================
async function generateAndRenderTop10() {
    try {
        showToast('🔄 Generando reporte de inventario...', 'info');
        
        const productos = window.INVENTORY_STATE?.productos || [];
        const analytics = window.ANALYTICS_STATE?.resumen?.analyticsPerProduct || {};
        const movs = window.ANALYTICS_STATE?.movimientos || [];
        
        if (productos.length === 0) {
            showToast('⚠️ No hay productos en el inventario para exportar.', 'warning');
            return;
        }

        // 1. Agrupar productos por nombre para el reporte consolidado
        const reporteData = [];
        const hoyStr = getLocalDateString(new Date());

        // Agrupar productos por código para consolidar stock de diferentes bodegas si es necesario
        const productosConsolidados = {};
        productos.forEach(p => {
            if (!productosConsolidados[p.nombre]) {
                productosConsolidados[p.nombre] = {
                    nombre: p.nombre,
                    marca: p.marca || 'Otra',
                    codigo: p.codigoBarras,
                    cajas: 0,
                    piezas: 0,
                    ubicaciones: []
                };
            }
            productosConsolidados[p.nombre].cajas += (parseInt(p.cajas || p.totalCajas) || 0);
            productosConsolidados[p.nombre].piezas += (parseInt(p.piezas || p.totalPiezas) || 0);
            if (p.ubicacion && !productosConsolidados[p.nombre].ubicaciones.includes(p.ubicacion)) {
                productosConsolidados[p.nombre].ubicaciones.push(p.ubicacion);
            }
        });

        // 2. Construir filas del CSV
        const encabezados = [
            "Producto", "Marca", "Codigo", "Ubicaciones", 
            "Stock (Cajas)", "Stock (Piezas)", 
            "Venta Diaria (Prom)", "Venta Semanal (Total)", 
            "Dias de Inventario", "Relleno Hoy (Cajas)", "Relleno Hoy (Piezas)"
        ];

        let csvContent = "\uFEFF"; // BOM para Excel
        csvContent += encabezados.join(",") + "\n";

        Object.values(productosConsolidados).forEach(p => {
            const stats = analytics[p.nombre] || { daily: 0, weekly: 0 };
            const diasInv = stats.daily > 0 ? Math.ceil(p.piezas / stats.daily) : 0;
            
            // Movimientos de hoy para este producto
            const movsHoy = movs.filter(m => 
                m.productoNombre === p.nombre && 
                isoToLocalDate(m.fecha) === hoyStr &&
                (m.tipo === 'salida' || m.tipo === 'entrada_directa_anaquel')
            );
            
            const refillCajasHoy = movsHoy.reduce((acc, m) => acc + (parseFloat(m.cajasMovidas) || 0), 0);
            const refillPiezasHoy = movsHoy.reduce((acc, m) => acc + (parseInt(m.piezasMovidas) || 0), 0);

            const fila = [
                `"${p.nombre}"`,
                `"${p.marca}"`,
                `"=""${p.codigo}"""`, // Formato de Excel para mantener el número como texto completo
                `"${p.ubicaciones.join('; ')}"`,
                p.cajas,
                p.piezas,
                stats.daily,
                stats.weekly,
                diasInv,
                refillCajasHoy.toFixed(2),
                refillPiezasHoy
            ];
            
            csvContent += fila.join(",") + "\n";
        });

        // 3. Descargar el archivo
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const fechaArchivo = new Date().toISOString().slice(0, 10);
        
        link.setAttribute("href", url);
        link.setAttribute("download", `Inventario_Aguila_${fechaArchivo}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast('✅ Reporte descargado con éxito', 'success');
        console.log('📊 Reporte generado y descargado.');

    } catch (error) {
        console.error('❌ Error generando reporte:', error);
        showToast('Error al generar el archivo', 'error');
    }
}

// ============================================================
// INICIALIZACIÓN AUTOMÁTICA Y EVENTOS
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    // NOTA [ARCHITECT]: Desactivado para evitar condición de carrera.
    // La carga ahora es gestionada secuencialmente por auth.js
    /*
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            window.loadStats();
        }
    });
    */

    // Listener para el botón de la pestaña analytics (ahora llama a window.loadStats)
    document.querySelectorAll('[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.dataset.tab === 'analytics' && window.ANALYTICS_STATE.determinante) {
                window.loadStats();
            }
        });
    });


});

// Exponer funciones globalmente (solo las necesarias)
window.reloadAnalytics = async function () { await window.loadStats(); };
window.initAnalytics = initAnalytics;
// Ya no es necesario exponer fetchAnalyticsData directamente, ya que se ha renombrado a window.loadStats
// window.fetchAnalyticsData = fetchAnalyticsData; 

console.log('✅ analytics.js (con Top 10) cargado correctamente');