// ============================================================
// Águila Inventario Pro - Módulo: analytics.js
// VERSIÓN CORREGIDA, OPTIMIZADA Y PROTEGIDA
// Copyright © 2025 José A. G. Betancourt
// ============================================================

/*
  Principales mejoras:
  - Caché de determinante (evita múltiples lecturas concurrentes).
  - Función reutilizable para filtrar movimientos por rango de fechas.
  - Uso de limitToLast() y startAt() para reducir carga en nodos grandes.
  - Evitar snapshot.forEach en favor de Object.values cuando sea posible.
  - Limpieza robusta de listeners y destrucción de instancias Chart.
  - Manejo protegido de errores (logout / PERMISSION_DENIED).
  - Renderización defensiva (elementos DOM comprobados).
*/

let userDeterminanteAnalytics = null;
let determinantePromise = null;

let weeklyListener = null;
let weeklyPath = null;
let monthlyListener = null;
let monthlyPath = null;

let weeklyChartInstance = null;
let monthlyChartInstance = null;

// -------------------- UTILIDADES --------------------
function safeGetEl(id) {
  return document.getElementById(id) || null;
}

function toDateSafe(value) {
  // Intenta convertir a Date de forma tolerante.
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d;
}

function logDebug(...args) {
  if (console && console.log) console.log(...args);
}

// -------------------- DETENER LISTENERS --------------------
function stopAnalyticsListeners() {
  logDebug('🛑 Deteniendo listeners de analytics...');

  try {
    if (weeklyListener && weeklyPath) {
      firebase.database().ref(weeklyPath).off('value', weeklyListener);
      logDebug('✅ Listener semanal detenido:', weeklyPath);
    }
  } catch (err) {
    console.warn('⚠️ Error deteniendo listener semanal:', err);
  }

  try {
    if (monthlyListener && monthlyPath) {
      firebase.database().ref(monthlyPath).off('value', monthlyListener);
      logDebug('✅ Listener mensual detenido:', monthlyPath);
    }
  } catch (err) {
    console.warn('⚠️ Error deteniendo listener mensual:', err);
  }

  weeklyListener = null;
  weeklyPath = null;
  monthlyListener = null;
  monthlyPath = null;

  // destruir charts si existen
  try { if (window.weeklyChartInstance) { window.weeklyChartInstance.destroy(); window.weeklyChartInstance = null; } } catch(e){/*ignore*/}
  try { if (window.monthlyChartInstance) { window.monthlyChartInstance.destroy(); window.monthlyChartInstance = null; } } catch(e){/*ignore*/}
}

// Integrar con stopAllListeners global (si existe)
if (typeof window.stopAllListeners === 'function') {
  const originalStop = window.stopAllListeners;
  window.stopAllListeners = function() {
    originalStop();
    stopAnalyticsListeners();
  };
} else {
  window.stopAllListeners = function() {
    stopAnalyticsListeners();
  };
}

// -------------------- OBTENER DETERMINANTE (CACHEADO) --------------------
async function getUserDeterminanteAnalytics() {
  // Evitar llamadas repetidas concurrentes usando determinantePromise
  if (userDeterminanteAnalytics) return userDeterminanteAnalytics;
  if (determinantePromise) return determinantePromise;

  determinantePromise = (async () => {
    try {
      const userId = firebase.auth().currentUser?.uid;
      if (!userId) return null;
      const snap = await firebase.database().ref('usuarios/' + userId).once('value');
      const data = snap.val();
      userDeterminanteAnalytics = data?.determinante || null;
      return userDeterminanteAnalytics;
    } catch (error) {
      console.error('❌ Error obtener determinante:', error);
      userDeterminanteAnalytics = null;
      return null;
    } finally {
      determinantePromise = null; // permitir reintento después
    }
  })();

  return determinantePromise;
}

// -------------------- FILTRAR MOVIMIENTOS POR RANGO (REUTILIZABLE) --------------------
function filtrarMovimientosPorRango(snapshotVal, desde, hasta) {
  // snapshotVal puede ser objeto o null
  const out = [];
  if (!snapshotVal) return out;

  // snapshotVal probablemente es { id: mov, id2: mov2, ... }
  const arr = Array.isArray(snapshotVal) ? snapshotVal : Object.values(snapshotVal);
  const desdeTs = desde ? desde.getTime() : null;
  const hastaTs = hasta ? hasta.getTime() : null;

  for (let i = 0; i < arr.length; i++) {
    const mov = arr[i];
    const fecha = toDateSafe(mov?.fecha);
    if (!fecha) continue;
    const t = fecha.getTime();
    if ((desdeTs === null || t >= desdeTs) && (hastaTs === null || t <= hastaTs)) {
      out.push(mov);
    }
  }
  return out;
}

// -------------------- CARGAR MOVIMIENTOS SEMANALES --------------------
async function loadWeeklyMovements() {
  logDebug('📊 Cargando movimientos semanales...');

  // detener listener previo si existe
  if (weeklyListener && weeklyPath) {
    try { firebase.database().ref(weeklyPath).off('value', weeklyListener); } catch(e){/*ignore*/}
    weeklyListener = null;
    weeklyPath = null;
  }

  const determinante = await getUserDeterminanteAnalytics();
  if (!determinante) {
    if (typeof showToast === 'function') showToast('Error: No se encontró información de la tienda', 'error');
    return;
  }

  // Rango: últimos 7 días (desde 00:00)
  const ahora = new Date();
  const hace7Dias = new Date();
  hace7Dias.setDate(ahora.getDate() - 7);
  hace7Dias.setHours(0, 0, 0, 0);

  weeklyPath = 'movimientos/' + determinante;

  weeklyListener = (snapshot) => {
    try {
      const raw = snapshot.val();
      // Filtrar en memoria usando función reusable
      const movimientos = filtrarMovimientosPorRango(raw, hace7Dias, ahora);

      // Agrupar por día de la semana (Lunes..Domingo)
      const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const dataByDay = {
        'Lunes': 0,'Martes': 0,'Miércoles': 0,'Jueves': 0,'Viernes': 0,'Sábado': 0,'Domingo': 0
      };

      movimientos.forEach(mov => {
        const fecha = toDateSafe(mov.fecha);
        if (!fecha) return;
        const dia = diasSemana[fecha.getDay()];
        dataByDay[dia] = (dataByDay[dia] || 0) + 1;
      });

      logDebug('📊 Datos semanales actualizados:', dataByDay);
      renderWeeklyChart(dataByDay, movimientos.length);
    } catch (error) {
      console.error('❌ Error procesando movimientos semanales:', error);
    }
  };

  const errorCallback = (error) => {
    if (!firebase.auth().currentUser) {
      logDebug('🛑 Error semanal ignorado: sesión cerrada');
      return;
    }
    if (error && error.code === 'PERMISSION_DENIED') {
      logDebug('🛑 Error de permisos semanal ignorado');
      return;
    }
    console.error('❌ Error en listener semanal:', error);
    if (typeof showToast === 'function') showToast('Error al cargar datos semanales', 'error');
  };

  try {
    // Limitar resultados servirá si tienes muchos movimientos: startAt + limitToLast
    firebase.database()
      .ref(weeklyPath)
      .orderByChild('fecha')
      .startAt(hace7Dias.toISOString())
      .limitToLast(2000) // límite razonable para reducir carga; ajustar según tu UX
      .on('value', weeklyListener, errorCallback);
  } catch (err) {
    console.error('❌ No se pudo iniciar listener semanal:', err);
  }
}

// -------------------- RENDERIZAR GRÁFICO SEMANAL --------------------
function renderWeeklyChart(dataByDay, totalMovements) {
  const container = safeGetEl('weekly-chart-container');
  if (!container) return;

  const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const data = dias.map(d => dataByDay[d] || 0);

  // Limpiar canvas anterior
  container.innerHTML = '<canvas id="weeklyChart" style="max-height: 300px;"></canvas>';
  const ctx = safeGetEl('weeklyChart');
  if (!ctx) return;

  // Destruir instancia previa si existe
  try { if (window.weeklyChartInstance) { window.weeklyChartInstance.destroy(); window.weeklyChartInstance = null; } } catch(e){/*ignore*/}

  window.weeklyChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: dias,
      datasets: [{
        label: 'Productos Movidos',
        data: data,
        // Nota: colores píntalos desde CSS si quieres tema dinámico; aquí dejamos valores por defecto
        backgroundColor: [
          '#004aad', '#003a8a', '#002d6a', '#1e40af', '#0048d4', '#0056d4', '#004aad'
        ],
        borderRadius: 8,
        borderSkipped: false,
        borderColor: '#004aad',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: true, position: 'top' },
        title: { display: true, text: '📊 Movimientos de la Semana', font: { size: 14, weight: 'bold' } }
      },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } }
      }
    }
  });

  // Mostrar total
  const totalEl = safeGetEl('weekly-total');
  if (totalEl) {
    totalEl.innerHTML = `<strong>Total esta semana:</strong> ${totalMovements} productos movidos`;
  }
}

// -------------------- CARGAR MOVIMIENTOS MENSUALES --------------------
async function loadMonthlyMovements() {
  logDebug('📊 Cargando movimientos mensuales...');

  if (monthlyListener && monthlyPath) {
    try { firebase.database().ref(monthlyPath).off('value', monthlyListener); } catch(e){/*ignore*/}
    monthlyListener = null;
    monthlyPath = null;
  }

  const determinante = await getUserDeterminanteAnalytics();
  if (!determinante) {
    if (typeof showToast === 'function') showToast('Error: No se encontró información de la tienda', 'error');
    return;
  }

  const ahora = new Date();
  const hace30Dias = new Date();
  hace30Dias.setDate(ahora.getDate() - 30);
  hace30Dias.setHours(0, 0, 0, 0);

  monthlyPath = 'movimientos/' + determinante;

  monthlyListener = (snapshot) => {
    try {
      const raw = snapshot.val();
      const movimientos = filtrarMovimientosPorRango(raw, hace30Dias, ahora);

      // Calcular promedio diario (precaución dividir por 30)
      const promedioDiario = Math.round((movimientos.length / 30) || 0);

      renderMonthlyChart(movimientos);

      // Mostrar estadísticas
      const statsEl = safeGetEl('monthly-stats');
      if (statsEl) {
        statsEl.innerHTML = `
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
            <div style="padding: 12px; background: #f0f9ff; border-radius: 8px; text-align: center;">
              <div style="font-size: 24px; font-weight: 700; color: #004aad;">${movimientos.length}</div>
              <div style="font-size: 12px; color: #6b7280;">Movimientos</div>
            </div>
            <div style="padding: 12px; background: #ecfdf5; border-radius: 8px; text-align: center;">
              <div style="font-size: 24px; font-weight: 700; color: #10b981;">${promedioDiario}</div>
              <div style="font-size: 12px; color: #6b7280;">Promedio/día</div>
            </div>
            <div style="padding: 12px; background: #fef3c7; border-radius: 8px; text-align: center;">
              <div style="font-size: 24px; font-weight: 700; color: #f59e0b;">📈</div>
              <div style="font-size: 12px; color: #6b7280;">Tendencia</div>
            </div>
          </div>
        `;
      }
    } catch (error) {
      console.error('❌ Error procesando movimientos mensuales:', error);
    }
  };

  const errorCallback = (error) => {
    if (!firebase.auth().currentUser) {
      logDebug('🛑 Error mensual ignorado: sesión cerrada');
      return;
    }
    if (error && error.code === 'PERMISSION_DENIED') {
      logDebug('🛑 Error de permisos mensual ignorado');
      return;
    }
    console.error('❌ Error en listener mensual:', error);
    if (typeof showToast === 'function') showToast('Error al cargar datos mensuales', 'error');
  };

  try {
    firebase.database()
      .ref(monthlyPath)
      .orderByChild('fecha')
      .startAt(hace30Dias.toISOString())
      .limitToLast(5000) // límite razonable, ajustar según tamaño de datos
      .on('value', monthlyListener, errorCallback);
  } catch (err) {
    console.error('❌ No se pudo iniciar listener mensual:', err);
  }
}

// -------------------- RENDERIZAR GRÁFICO MENSUAL --------------------
function renderMonthlyChart(movimientos) {
  const container = safeGetEl('monthly-chart-container');
  if (!container) return;

  // Agrupar por dia (día + mes corto)
  const monthsShort = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const dataByDate = {};

  movimientos.forEach(mov => {
    const fecha = toDateSafe(mov.fecha);
    if (!fecha) return;
    const dia = fecha.getDate();
    const clave = `${dia} ${monthsShort[fecha.getMonth()]}`;
    dataByDate[clave] = (dataByDate[clave] || 0) + 1;
  });

  const sortedDates = Object.keys(dataByDate).sort((a, b) => {
    const diaA = parseInt(a.split(' ')[0], 10);
    const diaB = parseInt(b.split(' ')[0], 10);
    return diaA - diaB;
  });

  const data = sortedDates.map(d => dataByDate[d]);

  // Limpiar canvas anterior
  container.innerHTML = '<canvas id="monthlyChart" style="max-height: 300px;"></canvas>';
  const ctx = safeGetEl('monthlyChart');
  if (!ctx) return;

  try { if (window.monthlyChartInstance) { window.monthlyChartInstance.destroy(); window.monthlyChartInstance = null; } } catch(e){/*ignore*/}

  window.monthlyChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: sortedDates,
      datasets: [{
        label: 'Movimientos Diarios',
        data: data,
        borderColor: '#004aad',
        backgroundColor: 'rgba(0,74,173,0.08)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointBackgroundColor: '#004aad',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: true, position: 'top' },
        title: { display: true, text: '📈 Tendencia Mensual (Últimos 30 días)', font: { size: 14, weight: 'bold' } }
      },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } }
      }
    }
  });
}

// -------------------- CARGAR TOP PRODUCTS (OPERACIÓN ONCE) --------------------
async function loadTopProducts() {
  logDebug('🏆 Cargando top productos...');

  const determinante = await getUserDeterminanteAnalytics();
  if (!determinante) return;

  try {
    // Rango semanal
    const ahora = new Date();
    const hace7Dias = new Date();
    hace7Dias.setDate(ahora.getDate() - 7);
    hace7Dias.setHours(0, 0, 0, 0);

    const weekSnap = await firebase.database()
      .ref('movimientos/' + determinante)
      .orderByChild('fecha')
      .startAt(hace7Dias.toISOString())
      .limitToLast(2000)
      .once('value');

    const weeklyProducts = {};
    if (weekSnap.exists()) {
      const raw = weekSnap.val();
      const movs = Object.values(raw || {});
      movs.forEach(mov => {
        const nombre = mov.productoNombre || 'Desconocido';
        weeklyProducts[nombre] = (weeklyProducts[nombre] || 0) + 1;
      });
    }

    // Rango mensual
    const hace30Dias = new Date();
    hace30Dias.setDate(ahora.getDate() - 30);
    hace30Dias.setHours(0, 0, 0, 0);

    const monthSnap = await firebase.database()
      .ref('movimientos/' + determinante)
      .orderByChild('fecha')
      .startAt(hace30Dias.toISOString())
      .limitToLast(5000)
      .once('value');

    const monthlyProducts = {};
    if (monthSnap.exists()) {
      const raw = monthSnap.val();
      const movs = Object.values(raw || {});
      movs.forEach(mov => {
        const nombre = mov.productoNombre || 'Desconocido';
        monthlyProducts[nombre] = (monthlyProducts[nombre] || 0) + 1;
      });
    }

    // Render top 5
    const weekTopContainer = safeGetEl('top-products-weekly');
    const monthTopContainer = safeGetEl('top-products-monthly');

    if (weekTopContainer) renderTopProductsList(weeklyProducts, weekTopContainer);
    if (monthTopContainer) renderTopProductsList(monthlyProducts, monthTopContainer);
  } catch (error) {
    if (!firebase.auth().currentUser || error.code === 'PERMISSION_DENIED') {
      logDebug('🛑 Error top productos ignorado (logout)');
      return;
    }
    console.error('❌ Error cargando top productos:', error);
  }
}

// -------------------- RENDER LISTA TOP PRODUCTS --------------------
function renderTopProductsList(productsData, container) {
  const sorted = Object.entries(productsData)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (sorted.length === 0) {
    container.innerHTML = '<p style="color: var(--muted);">Sin datos</p>';
    return;
  }

  const totalCount = Object.values(productsData).reduce((a, b) => a + b, 0) || 1;

  let html = '';
  const colores = ['#004aad', '#0056d4', '#1e40af', '#2d5aa5', '#3d6ab5'];

  sorted.forEach((item, idx) => {
    const nombre = item[0];
    const count = item[1];
    const porcentaje = Math.round((count / totalCount) * 100);
    const color = colores[idx] || '#004aad';

    html += `
      <div style="margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span style="font-weight: 600; font-size: 13px; color:#111827;">
            ${idx + 1}. ${nombre}
          </span>
          <span style="font-weight: 700; color: ${color};">${count}x</span>
        </div>
        <div style="background: #e5e7eb; border-radius: 4px; height: 8px; overflow: hidden;">
          <div style="background: ${color}; height: 100%; width: ${porcentaje}%;"></div>
        </div>
        <div style="font-size: 11px; color: #6b7280; margin-top: 2px;">
          ${porcentaje}% del total
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// -------------------- INITIALIZATION --------------------
function initAnalyticsModule() {
  logDebug('📊 Inicializando módulo de analytics...');

  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      logDebug('✅ Usuario autenticado, cargando analytics...');
      // Esperar un poco para seguridad (y permitir que otros módulos inicialicen)
      setTimeout(() => {
        loadWeeklyMovements();
        loadMonthlyMovements();
        loadTopProducts();
      }, 800);
    } else {
      logDebug('⏳ Sin usuario, deteniendo analytics...');
      stopAnalyticsListeners();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAnalyticsModule);
} else {
  initAnalyticsModule();
}

// -------------------- EXPOSICIÓN GLOBAL --------------------
window.loadWeeklyMovements = loadWeeklyMovements;
window.loadMonthlyMovements = loadMonthlyMovements;
window.loadTopProducts = loadTopProducts;
window.stopAnalyticsListeners = stopAnalyticsListeners;

logDebug('✅ analytics.js CORREGIDO, OPTIMIZADO y CARGADO correctamente');