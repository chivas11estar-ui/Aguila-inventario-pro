// ============================================================
// Águila Inventario Pro - Módulo: analytics.js
// Dashboard de movimientos semanales y mensuales
// Copyright © 2025 José A. G. Betancourt
// ============================================================

let userDeterminanteAnalytics = null;
let movementsData = [];

// ============================================================
// OBTENER DETERMINANTE
// ============================================================
async function getUserDeterminanteAnalytics() {
  const userId = firebase.auth().currentUser?.uid;
  if (!userId) return null;
  
  try {
    const snapshot = await firebase.database().ref('usuarios/' + userId).once('value');
    const userData = snapshot.val();
    return userData?.determinante || null;
  } catch (error) {
    console.error('Error obtener determinante:', error);
    return null;
  }
}

// ============================================================
// CARGAR MOVIMIENTOS DE LA SEMANA
// ============================================================
async function loadWeeklyMovements() {
  console.log('📊 Cargando movimientos semanales...');
  
  if (!userDeterminanteAnalytics) {
    userDeterminanteAnalytics = await getUserDeterminanteAnalytics();
  }
  
  if (!userDeterminanteAnalytics) {
    showToast('Error: No se encontró información de la tienda', 'error');
    return;
  }
  
  try {
    // Calcular hace 7 días
    const hace7Dias = new Date();
    hace7Dias.setDate(hace7Dias.getDate() - 7);
    hace7Dias.setHours(0, 0, 0, 0);
    
    const snapshot = await firebase.database()
      .ref('movimientos/' + userDeterminanteAnalytics)
      .orderByChild('fecha')
      .startAt(hace7Dias.toISOString())
      .once('value');
    
    const movimientos = [];
    
    if (snapshot.exists()) {
      snapshot.forEach(child => {
        movimientos.push(child.val());
      });
    }
    
    // Agrupar por día de semana
    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const dataByDay = {
      'Lunes': 0,
      'Martes': 0,
      'Miércoles': 0,
      'Jueves': 0,
      'Viernes': 0,
      'Sábado': 0,
      'Domingo': 0
    };
    
    movimientos.forEach(mov => {
      const fecha = new Date(mov.fecha);
      const diaSemana = diasSemana[fecha.getDay()];
      dataByDay[diaSemana] = (dataByDay[diaSemana] || 0) + 1;
    });
    
    console.log('📊 Datos semanales:', dataByDay);
    renderWeeklyChart(dataByDay, movimientos.length);
    
  } catch (error) {
    console.error('❌ Error cargando movimientos:', error);
    showToast('Error al cargar datos: ' + error.message, 'error');
  }
}

// ============================================================
// RENDERIZAR GRÁFICO SEMANAL CON CHARTS.JS
// ============================================================
function renderWeeklyChart(dataByDay, totalMovements) {
  const container = document.getElementById('weekly-chart-container');
  if (!container) return;
  
  const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const data = dias.map(dia => dataByDay[dia] || 0);
  
  // Limpiar canvas anterior
  container.innerHTML = '<canvas id="weeklyChart" style="max-height: 300px;"></canvas>';
  
  const ctx = document.getElementById('weeklyChart');
  if (!ctx) return;
  
  if (window.weeklyChartInstance) {
    window.weeklyChartInstance.destroy();
  }
  
  window.weeklyChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: dias,
      datasets: [{
        label: 'Productos Movidos',
        data: data,
        backgroundColor: [
          '#004aad', '#003a8a', '#002d6a', '#1e40af', '#0048d4',
          '#0056d4', '#004aad'
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
        legend: {
          display: true,
          position: 'top'
        },
        title: {
          display: true,
          text: '📊 Movimientos de la Semana',
          font: { size: 14, weight: 'bold' }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1
          }
        }
      }
    }
  });
  
  // Mostrar total
  const totalEl = document.getElementById('weekly-total');
  if (totalEl) {
    totalEl.innerHTML = `<strong>Total esta semana:</strong> ${totalMovements} productos movidos`;
  }
}

// ============================================================
// CARGAR MOVIMIENTOS DEL MES
// ============================================================
async function loadMonthlyMovements() {
  console.log('📊 Cargando movimientos mensuales...');
  
  if (!userDeterminanteAnalytics) {
    userDeterminanteAnalytics = await getUserDeterminanteAnalytics();
  }
  
  if (!userDeterminanteAnalytics) {
    showToast('Error: No se encontró información de la tienda', 'error');
    return;
  }
  
  try {
    // Calcular hace 30 días
    const hace30Dias = new Date();
    hace30Dias.setDate(hace30Dias.getDate() - 30);
    hace30Dias.setHours(0, 0, 0, 0);
    
    const snapshot = await firebase.database()
      .ref('movimientos/' + userDeterminanteAnalytics)
      .orderByChild('fecha')
      .startAt(hace30Dias.toISOString())
      .once('value');
    
    const movimientos = [];
    
    if (snapshot.exists()) {
      snapshot.forEach(child => {
        movimientos.push(child.val());
      });
    }
    
    // Calcular promedio diario
    const promedioDiario = Math.round(movimientos.length / 30);
    
    renderMonthlyChart(movimientos);
    
    // Mostrar estadísticas
    const statsEl = document.getElementById('monthly-stats');
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
    console.error('❌ Error cargando movimientos:', error);
    showToast('Error al cargar datos: ' + error.message, 'error');
  }
}

// ============================================================
// RENDERIZAR GRÁFICO MENSUAL
// ============================================================
function renderMonthlyChart(movimientos) {
  const container = document.getElementById('monthly-chart-container');
  if (!container) return;
  
  // Agrupar por días del mes
  const dataByDate = {};
  
  movimientos.forEach(mov => {
    const fecha = new Date(mov.fecha);
    const dia = fecha.getDate();
    const clave = `${dia} ${['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][fecha.getMonth()]}`;
    
    dataByDate[clave] = (dataByDate[clave] || 0) + 1;
  });
  
  // Ordenar por fecha
  const sortedDates = Object.keys(dataByDate).sort((a, b) => {
    const diaA = parseInt(a.split(' ')[0]);
    const diaB = parseInt(b.split(' ')[0]);
    return diaA - diaB;
  });
  
  const data = sortedDates.map(d => dataByDate[d]);
  
  // Limpiar canvas anterior
  container.innerHTML = '<canvas id="monthlyChart" style="max-height: 300px;"></canvas>';
  
  const ctx = document.getElementById('monthlyChart');
  if (!ctx) return;
  
  if (window.monthlyChartInstance) {
    window.monthlyChartInstance.destroy();
  }
  
  window.monthlyChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: sortedDates,
      datasets: [{
        label: 'Movimientos Diarios',
        data: data,
        borderColor: '#004aad',
        backgroundColor: 'rgba(0, 74, 173, 0.1)',
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
        legend: {
          display: true,
          position: 'top'
        },
        title: {
          display: true,
          text: '📈 Tendencia Mensual (Últimos 30 días)',
          font: { size: 14, weight: 'bold' }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1
          }
        }
      }
    }
  });
}

// ============================================================
// CARGAR TOP PRODUCTOS POR MOVIMIENTO
// ============================================================
async function loadTopProducts() {
  console.log('🏆 Cargando top productos...');
  
  if (!userDeterminanteAnalytics) {
    userDeterminanteAnalytics = await getUserDeterminanteAnalytics();
  }
  
  if (!userDeterminanteAnalytics) return;
  
  try {
    // Semanal
    const hace7Dias = new Date();
    hace7Dias.setDate(hace7Dias.getDate() - 7);
    hace7Dias.setHours(0, 0, 0, 0);
    
    const weekSnapshot = await firebase.database()
      .ref('movimientos/' + userDeterminanteAnalytics)
      .orderByChild('fecha')
      .startAt(hace7Dias.toISOString())
      .once('value');
    
    const weeklyProducts = {};
    const monthlyProducts = {};
    
    if (weekSnapshot.exists()) {
      weekSnapshot.forEach(child => {
        const mov = child.val();
        const nombre = mov.productoNombre || 'Desconocido';
        weeklyProducts[nombre] = (weeklyProducts[nombre] || 0) + 1;
        monthlyProducts[nombre] = (monthlyProducts[nombre] || 0) + 1;
      });
    }
    
    // Mensual
    const hace30Dias = new Date();
    hace30Dias.setDate(hace30Dias.getDate() - 30);
    hace30Dias.setHours(0, 0, 0, 0);
    
    const monthSnapshot = await firebase.database()
      .ref('movimientos/' + userDeterminanteAnalytics)
      .orderByChild('fecha')
      .startAt(hace30Dias.toISOString())
      .once('value');
    
    if (monthSnapshot.exists()) {
      monthSnapshot.forEach(child => {
        const mov = child.val();
        const nombre = mov.productoNombre || 'Desconocido';
        if (!monthlyProducts[nombre]) {
          monthlyProducts[nombre] = 0;
        }
        monthlyProducts[nombre]++;
      });
    }
    
    // Renderizar top 5
    const weekTopContainer = document.getElementById('top-products-weekly');
    const monthTopContainer = document.getElementById('top-products-monthly');
    
    if (weekTopContainer) {
      renderTopProductsList(weeklyProducts, weekTopContainer, 'Semanal');
    }
    
    if (monthTopContainer) {
      renderTopProductsList(monthlyProducts, monthTopContainer, 'Mensual');
    }
    
  } catch (error) {
    console.error('❌ Error cargando top productos:', error);
  }
}

// ============================================================
// RENDERIZAR LISTA DE TOP PRODUCTOS
// ============================================================
function renderTopProductsList(productsData, container, periodo) {
  const sorted = Object.entries(productsData)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  let html = `<h4 style="margin: 0 0 12px 0;">🏆 Top ${periodo}</h4>`;
  
  sorted.forEach((item, idx) => {
    const nombre = item[0];
    const count = item[1];
    const porcentaje = Math.round((count / Object.values(productsData).reduce((a, b) => a + b, 0)) * 100);
    
    const colores = ['#004aad', '#0056d4', '#1e40af', '#2d5aa5', '#3d6ab5'];
    const color = colores[idx] || '#004aad';
    
    html += `
      <div style="margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span style="font-weight: 600; font-size: 13px;">
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

// ============================================================
// INICIALIZACIÓN
// ============================================================
function initAnalyticsModule() {
  console.log('📊 Inicializando módulo de analytics...');
  
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      console.log('✅ Usuario autenticado, cargando analytics...');
      
      setTimeout(() => {
        loadWeeklyMovements();
        loadMonthlyMovements();
        loadTopProducts();
        
        // Actualizar cada 5 minutos
        setInterval(() => {
          loadWeeklyMovements();
          loadMonthlyMovements();
          loadTopProducts();
        }, 300000);
        
      }, 1000);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAnalyticsModule);
} else {
  initAnalyticsModule();
}

console.log('✅ analytics.js cargado correctamente');

window.loadWeeklyMovements = loadWeeklyMovements;
window.loadMonthlyMovements = loadMonthlyMovements;
window.loadTopProducts = loadTopProducts;