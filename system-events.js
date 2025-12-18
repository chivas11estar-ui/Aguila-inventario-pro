// ============================================================
// Águila Inventario Pro - System Events
// Manejo robusto y seguro de eventos del sistema
// Versión optimizada 8.3
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('⚙️ Inicializando eventos del sistema...');

  // Utilidad segura para asignar eventos
  function safeBind(id, actionName, fnName) {
    const btn = document.getElementById(id);
    if (!btn) {
      console.warn(`⚠️ Botón "${id}" no encontrado en el DOM.`);
      return;
    }

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log(`🔧 Acción solicitada: ${actionName}`);

      if (typeof window[fnName] === 'function') {
        try {
          window[fnName]();
        } catch (error) {
          console.error(`❌ Error ejecutando ${fnName}:`, error);
          alert(`❌ Ocurrió un error al ejecutar: ${actionName}`);
        }
      } else {
        console.warn(`⚠️ Función "${fnName}" no existe`);
        alert(`⚠️ La función "${actionName}" no está disponible`);
      }
    });

    console.log(`✅ Evento configurado: ${actionName}`);
  }

  // ============================================================
  // ASIGNACIÓN DE EVENTOS (MEJORADA)
  // ============================================================

  safeBind('btn-diagnostico', 'Ejecutar diagnóstico', 'diagnosticoFirebase');
  safeBind('btn-stats', 'Mostrar estadísticas del sistema', 'showSystemStats');
  safeBind('btn-clear-data', 'Limpiar todos los datos locales', 'clearAllData');

  console.log('✅ Todos los eventos del sistema quedaron configurados correctamente');
});