// ============================================================
// Águila Inventario Pro - System Events
// Maneja eventos de los botones del sistema
// Copyright © 2025 José A. G. Betancourt
// ============================================================

document.addEventListener('DOMContentLoaded', function () {
  console.log('⚙️ Configurando eventos del sistema...');

  // BOTÓN: DIAGNÓSTICO
  const btnDiagnostico = document.getElementById('btn-diagnostico');
  if (btnDiagnostico) {
    btnDiagnostico.addEventListener('click', function (e) {
      e.preventDefault();
      console.log('🔍 Abriendo diagnóstico...');

      if (typeof window.diagnosticoFirebase === 'function') {
        window.diagnosticoFirebase();
      } else {
        alert('⚠️ Función de diagnóstico no disponible');
      }
    });
  }

  // BOTÓN: ESTADÍSTICAS
  const btnStats = document.getElementById('btn-stats');
  if (btnStats) {
    btnStats.addEventListener('click', function (e) {
      e.preventDefault();
      console.log('📊 Mostrando estadísticas...');

      if (typeof window.showSystemStats === 'function') {
        window.showSystemStats();
      } else {
        alert('⚠️ Función de estadísticas no disponible');
      }
    });
  }

  // BOTÓN: LIMPIAR DATOS
  const btnClearData = document.getElementById('btn-clear-data');
  if (btnClearData) {
    btnClearData.addEventListener('click', function (e) {
      e.preventDefault();
      console.log('🗑️ Limpiando datos...');

      if (typeof window.clearAllData === 'function') {
        window.clearAllData();
      } else {
        alert('⚠️ Función de limpiar datos no disponible');
      }
    });
  }

  console.log('✅ Eventos del sistema configurados');
});