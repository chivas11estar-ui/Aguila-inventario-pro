// ============================================================
// Ãguila Inventario Pro - MÃ³dulo: analytics.js
// LÃ³gica de Analytics (con Top 10)
// Copyright Â© 2025 JosÃ© A. G. Betancourt
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

function isRefillMovement(m) {
    return m && (m.tipo === 'salida' || m.tipo === 'entrada_directa_anaquel');
}

function analyticsDateKey(fecha) {
    if (!fecha) return '';
    return isoToLocalDate(fecha);
}

function movementDateValue(m) {
    return m?.fecha || m?.timestamp || m?.createdAt || m?.date || '';
}

function movementDateKey(m) {
    return analyticsDateKey(movementDateValue(m));
}

function getRecentLocalDateKeys(days, baseDate = new Date()) {
    const keys = new Set();
    for (let i = 0; i < days; i++) {
        const d = new Date(baseDate);
        d.setDate(baseDate.getDate() - i);
        keys.add(getLocalDateString(d));
    }
    return keys;
}

function analyticsTime(fecha) {
    if (!fecha) return 0;
    if (typeof fecha === 'number') return fecha;
    const parsed = new Date(fecha).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
}

function movementTime(m) {
    return analyticsTime(movementDateValue(m));
}

function normalizeAnalyticsKey(value) {
    return String(value || '').trim().toLowerCase();
}

function movementProductKey(m) {
    return normalizeAnalyticsKey(m?.productoCodigo || m?.codigoBarra || m?.productoNombre || 'desconocido');
}

// ============================================================
// INICIALIZACIÃ“N
// ============================================================
async function initAnalytics() {
    console.log('ðŸ“Š Iniciando Analytics...');
    const userId = firebase.auth().currentUser?.uid;
    if (!userId) {
        console.warn('âš ï¸ Analytics: Usuario no autenticado');
        return;
    }

    try {
        const userSnap = await firebase.database().ref(`usuarios/${userId}`).once('value');
        const userData = userSnap.val();

        if (!userData || !userData.determinante) {
            console.error('âŒ Analytics: No se encontrÃ³ determinante');
            showToast('Error: No se encontrÃ³ informaciÃ³n de la tienda', 'error');
            return;
        }

        window.ANALYTICS_STATE.determinante = userData.determinante;
        console.log('âœ… Analytics: Determinante cargado:', window.ANALYTICS_STATE.determinante);

        await window.loadStats(); // Ahora llama a la funciÃ³n loadStats expuesta globalmente

    } catch (error) {
        console.error('âŒ Error en initAnalytics:', error);
        showToast('Error al inicializar Analytics', 'error');
    }
}

// ============================================================
// CARGAR DATOS DE FIREBASE (7 DÃAS) - Renombrado y expuesto como window.loadStats
// ============================================================
window.loadStats = async function () { 
    console.log("ðŸ“Š [ARCHITECT] Verificando requisitos para carga de estadÃ­sticas...");

    // 1. ASIGNACIÃ“N EXPRESA Y SEGURA DEL DETERMINANTE (Fuente de Verdad: PROFILE_STATE)
    const det = window.PROFILE_STATE?.determinante || window.ANALYTICS_STATE?.determinante;

    // 2. VALIDACIÃ“N ESTRICTA (Race Condition evitada)
    if (!det || det === "null" || det === "undefined") {
        console.warn('ðŸ›‘ [ARCHITECT] loadStats cancelada: Determinante no disponible (Evitando Permission Denied).');
        return; 
    }

    const hoy = new Date();
    const hoyStr = getLocalDateString(hoy); 

    const hace30Dias = new Date();
    hace30Dias.setDate(hace30Dias.getDate() - 29);
    const hace30DiasStr = getLocalDateString(hace30Dias);

    try {
        console.log(`ðŸ“¡ [ARCHITECT] Consultando Firebase para Tienda: ${det}`);
        
        const [movSnap, auditSnap] = await Promise.all([
            firebase.database().ref(`movimientos/${det}`).once('value'),
            firebase.database().ref(`auditorias/${det}`).once('value')
        ]);

        const movimientos = [];
        movSnap.forEach(child => { movimientos.push(child.val()); });
        const auditorias = [];
        auditSnap.forEach(child => { auditorias.push(child.val()); });

        // Filtrar solo los Ãºltimos 30 dÃ­as en zona horaria local
        const movimientosFiltrados = movimientos.filter(m => {
            const fechaMov = movementDateKey(m);
            return fechaMov && fechaMov >= hace30DiasStr && fechaMov <= hoyStr;
        });
        const auditoriasFiltradas = auditorias.filter(a => {
            if (!a.fecha) return false;
            const fechaAud = analyticsDateKey(a.fecha);
            return fechaAud >= hace30DiasStr;
        });

        window.ANALYTICS_STATE.movimientos = movimientosFiltrados;
        window.ANALYTICS_STATE.auditorias = auditoriasFiltradas;

        procesarMetricas(hoyStr);

        // ACTUALIZACIÃ“N DINÃMICA: Re-renderizar inventario para mostrar promedios
        if (typeof window.applyFiltersAndRender === 'function') {
            console.log('ðŸ”„ [ANALYTICS] Actualizando promedios en lista de inventario...');
            window.applyFiltersAndRender();
        }

        if (typeof window.renderAnalyticsUI === 'function') {
            setTimeout(() => {
                window.renderAnalyticsUI();
            }, 0);
        }

    } catch (error) {
        console.error('âŒ Error cargando datos de analytics:', error);
        showToast('Error al cargar estadÃ­sticas', 'error');
    }
}

// ============================================================
// PROCESAR MÃ‰TRICAS (7 DÃAS)
// ============================================================
function procesarMetricas(fechaHoy) {
    const movs = window.ANALYTICS_STATE.movimientos;
    const audits = window.ANALYTICS_STATE.auditorias;
    const res = window.ANALYTICS_STATE.resumen;
    const refillMovements = movs.filter(isRefillMovement);

    // MÃ©tricas de Hoy (usando fecha local)
    const movsHoy = refillMovements.filter(m => movementDateKey(m) === fechaHoy);
    res.totalRellenosHoy = movsHoy.length;
    res.cajasMovidasHoy = movsHoy.reduce((acc, m) => acc + (parseFloat(m.cajasMovidas) || 0), 0);
    res.piezasMovidasHoy = movsHoy.reduce((acc, m) => acc + (parseInt(m.piezasMovidas) || 0), 0);
    res.auditoriasHoy = audits.filter(a => a.fecha && analyticsDateKey(a.fecha) === fechaHoy).length;
    res.productosDistintos = new Set(movsHoy.map(m => m.productoNombre).filter(Boolean)).size;

    // Top 5 Productos (basado en cajas en 7 dÃ­as)
    const conteoProd = {};
    refillMovements.forEach(m => {
        const nombre = m.productoNombre || 'Desconocido';
        const cajas = parseFloat(m.cajasMovidas) || 0;
        if (!conteoProd[nombre]) {
            conteoProd[nombre] = { nombre: nombre, marca: m.marca || 'N/A', total: 0 };
        }
        conteoProd[nombre].total += cajas;
    });
    res.topProductos = Object.values(conteoProd).sort((a, b) => b.total - a.total).slice(0, 5);

    // Top 5 Marcas (basado en cajas en 7 dÃ­as)
    const conteoMarcas = {};
    refillMovements.forEach(m => {
        const marca = m.marca || 'Otra';
        const cajas = parseFloat(m.cajasMovidas) || 0;
        conteoMarcas[marca] = (conteoMarcas[marca] || 0) + cajas;
    });
    res.topMarcas = Object.entries(conteoMarcas).map(([marca, total]) => ({ marca, total })).sort((a, b) => b.total - a.total).slice(0, 5);

    // HistÃ³rico de Rellenos (7 dÃ­as) usando zona horaria local
    res.historico7Dias = {};
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const fechaStr = getLocalDateString(d);
        const movimientosDia = refillMovements.filter(m => movementDateKey(m) === fechaStr);
        res.historico7Dias[fechaStr] = movimientosDia.length;
    }

    // Promedios con ventana movil de 30 dias naturales: hoy + 29 dias anteriores.
    // Dia = total 30d / 30, Sem = Dia * 7, Mes = total 30d.

    // Funcion legacy para mantener cycleDaily disponible sin afectar la UI principal.
    const getStartOfCurrentCycle = () => {
        const ahora = new Date();
        const diaSemana = ahora.getDay(); // 0=Dom, 1=Lun, ..., 5=Vie, 6=Sab
        
        // Calcular cuÃ¡ntos dÃ­as restar para llegar al Ãºltimo Viernes
        // Si hoy es Viernes(5), restamos 0. Si es SÃ¡bado(6), restamos 1. Si es Jueves(4), restamos 6.
        const daysToSubtract = (diaSemana + 2) % 7; 
        
        const start = new Date(ahora);
        start.setDate(ahora.getDate() - daysToSubtract);
        start.setHours(0, 0, 0, 0);
        return start.getTime();
    };

    const startOfCycleMs = getStartOfCurrentCycle();
    const hoy = new Date();
    const msPassedInCycle = Date.now() - startOfCycleMs;
    const daysInCurrentCycle = Math.max(1, Math.ceil(msPassedInCycle / (24 * 60 * 60 * 1000)));
    
    const statsPerProduct = {};

    // 1. Calcular sumas por ventana movil de 30 dias
    const last30DateKeys = getRecentLocalDateKeys(30, new Date());

    refillMovements.forEach(m => {
        const productName = m.productoNombre || 'Desconocido';
        const productKey = movementProductKey(m);
        const pieces = parseInt(m.piezasMovidas) || 0;
        const movFecha = movementTime(m);
        const movDateKey = movementDateKey(m);

        if (!statsPerProduct[productKey]) {
            statsPerProduct[productKey] = {
                nombre: productName,
                codigo: m.productoCodigo || m.codigoBarra || '',
                marca: m.marca || 'Otra',
                currentCyclePieces: 0, 
                last30DaysPieces: 0 
            };
        }

        // Ciclo actual (desde el Ãºltimo Viernes 00:00)
        if (movFecha >= startOfCycleMs) {
            statsPerProduct[productKey].currentCyclePieces += pieces;
        }
        
        // Ultimos 30 dias naturales: hoy + 29 dias anteriores en fecha local
        if (last30DateKeys.has(movDateKey)) {
            statsPerProduct[productKey].last30DaysPieces += pieces;
        }
    });

    // 2. Generar objeto de analÃ­tica avanzada
    const analyticsPerProduct = {};
    Object.keys(statsPerProduct).forEach(key => {
        const stats = statsPerProduct[key];
        
        // Promedio Diario: total ultimos 30 dias / 30
        const monthlyTotal = stats.last30DaysPieces;
        const dailyAvg = Math.round(monthlyTotal / 30);
        // Semanal: estimado con base en la ventana movil de 30 dias
        const weeklyTotal = Math.round((monthlyTotal / 30) * 7);

        const result = {
            nombre: stats.nombre,
            codigo: stats.codigo,
            marca: stats.marca,
            daily: dailyAvg,
            weekly: weeklyTotal,
            monthly: monthlyTotal,
            cycleDaily: Math.round(stats.currentCyclePieces / daysInCurrentCycle),
            cycleDays: daysInCurrentCycle
        };

        analyticsPerProduct[key] = result;
        if (stats.nombre) analyticsPerProduct[normalizeAnalyticsKey(stats.nombre)] = result;
        if (stats.codigo) analyticsPerProduct[normalizeAnalyticsKey(stats.codigo)] = result;
    });

    res.analyticsPerProduct = analyticsPerProduct;
    // Compatibilidad con el formato anterior
    const uniqueProducts = {};
    Object.values(analyticsPerProduct).forEach(item => {
        const itemKey = item.codigo || item.nombre;
        if (!itemKey || uniqueProducts[itemKey]) return;
        uniqueProducts[itemKey] = item;
    });
    res.dailyAveragePiecesPerProduct = Object.values(uniqueProducts).map(item => ({
        nombre: item.nombre,
        codigo: item.codigo,
        marca: item.marca,
        dailyAverage: item.daily,
        weekly: item.weekly,
        monthly: item.monthly
    })).sort((a, b) => b.dailyAverage - a.dailyAverage);

    console.log(`ðŸ“Š Motor de AnalÃ­tica Walmart-Style activo:`, res.analyticsPerProduct);
}

// ============================================================
// LÃ“GICA DE EXPORTACIÃ“N A EXCEL/CSV (REPORTE COMPLETO)
// ============================================================
async function generateAndRenderTop10() {
    try {
        showToast('ðŸ”„ Generando reporte de inventario...', 'info');
        
        const productos = window.INVENTORY_STATE?.productos || [];
        const analytics = window.ANALYTICS_STATE?.resumen?.analyticsPerProduct || {};
        const movs = window.ANALYTICS_STATE?.movimientos || [];
        
        if (productos.length === 0) {
            showToast('âš ï¸ No hay productos en el inventario para exportar.', 'warning');
            return;
        }

        // 1. Agrupar productos por nombre para el reporte consolidado
        const reporteData = [];
        const hoyStr = getLocalDateString(new Date());

        // Agrupar productos por cÃ³digo para consolidar stock de diferentes bodegas si es necesario
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
            const cajas = parseFloat(p.stockTotal || p.cajas || p.totalCajas) || 0;
            const piezasPorCaja = parseInt(p.piezasPorCaja, 10) || 0;
            productosConsolidados[p.nombre].cajas += cajas;
            productosConsolidados[p.nombre].piezas += (parseInt(p.piezas || p.totalPiezas) || 0) || (cajas * piezasPorCaja);
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
                movementDateKey(m) === hoyStr &&
                isRefillMovement(m)
            );
            
            const refillCajasHoy = movsHoy.reduce((acc, m) => acc + (parseFloat(m.cajasMovidas) || 0), 0);
            const refillPiezasHoy = movsHoy.reduce((acc, m) => acc + (parseInt(m.piezasMovidas) || 0), 0);

            const fila = [
                `"${p.nombre}"`,
                `"${p.marca}"`,
                `"=""${p.codigo}"""`, // Formato de Excel para mantener el nÃºmero como texto completo
                `"${p.ubicaciones.join('; ')}"`,
                p.cajas,
                p.piezas,
                stats.daily,
                stats.weekly,
                diasInv,
                Math.round(refillCajasHoy),
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
        
        showToast('âœ… Reporte descargado con Ã©xito', 'success');
        console.log('ðŸ“Š Reporte generado y descargado.');

    } catch (error) {
        console.error('âŒ Error generando reporte:', error);
        showToast('Error al generar el archivo', 'error');
    }
}

// ============================================================
// INICIALIZACIÃ“N AUTOMÃTICA Y EVENTOS
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    // NOTA [ARCHITECT]: Desactivado para evitar condiciÃ³n de carrera.
    // La carga ahora es gestionada secuencialmente por auth.js
    /*
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            window.loadStats();
        }
    });
    */
    // app.js centraliza la navegacion y decide cuando refrescar estadisticas.
});

// Exponer funciones globalmente (solo las necesarias)
window.reloadAnalytics = async function () { await window.loadStats(); };
window.initAnalytics = initAnalytics;
// Ya no es necesario exponer fetchAnalyticsData directamente, ya que se ha renombrado a window.loadStats
// window.fetchAnalyticsData = fetchAnalyticsData; 

// Exportador CSV v2 para supervisor (resumen + detalle redondeado)
window.generateAndRenderTop10 = function exportSupervisorReportV2() {
    try {
        showToast('Generando reporte de inventario...', 'info');
        const productos = window.INVENTORY_STATE?.productos || [];
        const analytics = window.ANALYTICS_STATE?.resumen?.analyticsPerProduct || {};
        const movs = window.ANALYTICS_STATE?.movimientos || [];
        const determinante = window.PROFILE_STATE?.determinante || window.ANALYTICS_STATE?.determinante || '';
        const promotor = window.PROFILE_STATE?.nombre || window.PROFILE_STATE?.displayName || window.PROFILE_STATE?.email || firebase.auth().currentUser?.email || '';
        const hoyStr = getLocalDateString(new Date());
        const fechaCorte = getLocalDateString(new Date());
        if (productos.length === 0) {
            showToast('No hay productos en el inventario para exportar.', 'warning');
            return;
        }
        const toInt = (value) => Math.max(0, Math.round(Number(value) || 0));
        const quote = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
        const productosConsolidados = {};
        productos.forEach((p) => {
            if (!productosConsolidados[p.nombre]) {
                productosConsolidados[p.nombre] = { nombre: p.nombre, marca: p.marca || 'Otra', codigo: p.codigoBarras, cajas: 0, piezas: 0, ubicaciones: [] };
            }
            const cajas = parseFloat(p.stockTotal || p.cajas || p.totalCajas) || 0;
            const piezasPorCaja = parseInt(p.piezasPorCaja, 10) || 0;
            productosConsolidados[p.nombre].cajas += cajas;
            productosConsolidados[p.nombre].piezas += (parseInt(p.piezas || p.totalPiezas, 10) || 0) || (cajas * piezasPorCaja);
            if (p.ubicacion && !productosConsolidados[p.nombre].ubicaciones.includes(p.ubicacion)) productosConsolidados[p.nombre].ubicaciones.push(p.ubicacion);
        });
        const rows = Object.values(productosConsolidados).map((p) => {
            const stats = analytics[p.codigo] || analytics[p.nombre] || { daily: 0, weekly: 0, monthly: 0 };
            const stockCajas = toInt(p.cajas);
            const stockPiezas = toInt(p.piezas);
            const ventaDiaria = toInt(stats.daily);
            const ventaSemanal = toInt(stats.weekly);
            const ventaMensual = toInt(stats.monthly);
            const diasInventario = stockPiezas <= 0 ? "AGOTADO" : (ventaDiaria > 0 ? toInt(stockPiezas / ventaDiaria) : "N/D");
            const movsHoy = movs.filter((m) => m.productoNombre === p.nombre && movementDateKey(m) === hoyStr && isRefillMovement(m));
            const rellenoHoyCajas = toInt(movsHoy.reduce((acc, m) => acc + (parseFloat(m.cajasMovidas) || 0), 0));
            const rellenoHoyPiezas = toInt(movsHoy.reduce((acc, m) => acc + (parseInt(m.piezasMovidas, 10) || 0), 0));
            let estado = 'OK', prioridad = 'Baja', accion = 'Mantener';
            if (stockPiezas <= 0) { estado = 'Agotado'; prioridad = 'Alta'; accion = 'Rellenar inmediato'; }
            else if (diasInventario !== "N/D" && diasInventario <= 2) { estado = 'Critico'; prioridad = 'Alta'; accion = 'Rellenar hoy'; }
            else if (diasInventario !== "N/D" && diasInventario <= 5) { estado = 'Bajo'; prioridad = 'Media'; accion = 'Monitorear'; }
            return {
                fecha: fechaCorte, determinante, promotor, producto: p.nombre, marca: p.marca, codigo: p.codigo,
                ubicPrincipal: p.ubicaciones[0] || '', ubicaciones: p.ubicaciones.join('; '), stockCajas, stockPiezas,
                ventaDiaria, ventaSemanal, ventaMensual, diasInventario, rellenoHoyCajas, rellenoHoyPiezas,
                estado, prioridad, accion, observaciones: ''
            };
        });
        const totalProductos = rows.length;
        const agotados = rows.filter((r) => r.stockPiezas === 0).length;
        const conStock = totalProductos - agotados;
        const piezasTotales = rows.reduce((acc, r) => acc + r.stockPiezas, 0);
        const piezasRellenadasHoy = rows.reduce((acc, r) => acc + r.rellenoHoyPiezas, 0);
        const top5Hoy = [...rows].filter((r) => r.rellenoHoyPiezas > 0).sort((a, b) => b.rellenoHoyPiezas - a.rellenoHoyPiezas).slice(0, 5);
        if (!window.XLSX) {
            showToast('No se pudo cargar el motor de Excel. Recarga la app.', 'error');
            return;
        }
        const headers = ["Fecha", "Determinante", "Promotor", "Producto", "Marca", "Codigo", "Ubicacion Principal", "Ubicaciones", "Stock Cajas", "Stock Piezas", "Venta Diaria Pzas", "Venta Semanal Pzas", "Venta Mensual Pzas", "Dias Inventario", "Relleno Hoy Cajas", "Relleno Hoy Piezas", "Estado Operativo", "Prioridad", "Accion Sugerida", "Observaciones"];
        const summaryRows = [
            ['RESUMEN EJECUTIVO', ''],
            ['Fecha', fechaCorte],
            ['Tienda', determinante],
            ['Promotor', promotor],
            ['Total productos', totalProductos],
            ['Con stock', conStock],
            ['Agotados', agotados],
            ['Piezas totales inventario', piezasTotales],
            ['Piezas rellenadas hoy', piezasRellenadasHoy]
        ];
        if (top5Hoy.length > 0) top5Hoy.forEach((r, idx) => summaryRows.push([`Top ${idx + 1} relleno hoy`, `${r.producto} (${r.rellenoHoyPiezas} pzas)`]));
        else summaryRows.push(['Top relleno hoy', 'Sin movimientos']);

        const aoa = [];
        summaryRows.forEach((r) => aoa.push([r[0], r[1]]));
        aoa.push([]);
        aoa.push(headers);
        rows.forEach((r) => aoa.push([
            r.fecha, r.determinante, r.promotor, r.producto, r.marca, r.codigo, r.ubicPrincipal, r.ubicaciones,
            r.stockCajas, r.stockPiezas, r.ventaDiaria, r.ventaSemanal, r.ventaMensual, r.diasInventario,
            r.rellenoHoyCajas, r.rellenoHoyPiezas, r.estado, r.prioridad, r.accion, r.observaciones
        ]));

        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws["!cols"] = [
            { wch: 12 }, { wch: 12 }, { wch: 22 }, { wch: 34 }, { wch: 16 }, { wch: 16 },
            { wch: 22 }, { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 15 },
            { wch: 15 }, { wch: 15 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 20 }, { wch: 22 }
        ];

        const range = XLSX.utils.decode_range(ws['!ref']);
        const styleCenter = { alignment: { horizontal: "center", vertical: "center", wrapText: true } };
        const styleLeft = { alignment: { horizontal: "left", vertical: "center", wrapText: true } };
        const headerRow = summaryRows.length + 2; // +1 por blank y +1 porque base 1

        for (let r = 0; r <= range.e.r; r++) {
            for (let c = 0; c <= range.e.c; c++) {
                const addr = XLSX.utils.encode_cell({ r, c });
                if (!ws[addr]) continue;
                const row1 = r + 1;
                if (row1 === headerRow) {
                    ws[addr].s = { alignment: { horizontal: "center", vertical: "center", wrapText: true }, font: { bold: true } };
                } else if (row1 <= summaryRows.length) {
                    ws[addr].s = c === 0 ? { alignment: { horizontal: "left", vertical: "center", wrapText: true }, font: { bold: true } } : styleLeft;
                } else if (row1 > headerRow) {
                    ws[addr].s = ([3, 4, 6, 7, 16, 17, 18, 19].includes(c)) ? styleLeft : styleCenter;
                }
            }
        }

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Reporte");
        const fechaArchivo = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, `Inventario_Aguila_${fechaArchivo}.xlsx`);
        showToast('Reporte descargado con exito', 'success');
    } catch (error) {
        console.error('Error generando reporte supervisor:', error);
        showToast('Error al generar el archivo', 'error');
    }
};

console.log('âœ… analytics.js (con Top 10) cargado correctamente');
