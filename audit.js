// ============================================================
// Águila Inventario Pro - audit.js (FIX VISUAL)
// Arregla el problema de "Bodega no seleccionada"
// ============================================================

/* global firebase, showToast */

(() => {
  'use strict';

  let currentAuditWarehouse = null;

  // --- 1. Iniciar Auditoría (Seleccionar Bodega) ---
  window.saveBodega = function() {
    const input = document.getElementById('audit-warehouse');
    const display = document.getElementById('current-warehouse-display');
    const warehouseSection = document.getElementById('audit-warehouse-section');
    const scanSection = document.getElementById('audit-scan-section');

    const nombreBodega = input.value.trim();

    if (!nombreBodega) {
      alert('⚠️ Escribe el nombre de la bodega (ej. Bodega 1)');
      return;
    }

    // Guardar en memoria
    currentAuditWarehouse = nombreBodega;

    // ACTUALIZACIÓN VISUAL FORZADA
    // 1. Ocultar input
    if(warehouseSection) warehouseSection.style.display = 'none';
    
    // 2. Mostrar sección de escaneo
    if(scanSection) {
        scanSection.classList.remove('hidden');
        scanSection.style.display = 'block';
    }
    
    // 3. Poner nombre en el título
    if(display) display.textContent = `Auditando: ${nombreBodega}`;

    if(window.showToast) window.showToast(`✅ Bodega "${nombreBodega}" seleccionada`, 'success');
  };

  // --- 2. Terminar Auditoría ---
  window.terminarAuditoria = function() {
    if(!confirm('¿Terminar auditoría de esta bodega?')) return;

    currentAuditWarehouse = null;
    
    // Restaurar vista
    document.getElementById('audit-warehouse').value = '';
    document.getElementById('audit-warehouse-section').style.display = 'block';
    document.getElementById('audit-scan-section').style.display = 'none'; // O usar classList.add('hidden')
    
    // Limpiar campos
    document.getElementById('audit-barcode').value = '';
    document.getElementById('audit-count').value = '';
  };

  // --- 3. Buscar en Auditoría ---
  window.buscarProductoAudit = async function(barcode) {
    if (!barcode) barcode = document.getElementById('audit-barcode').value;
    if (!barcode) return;

    // Aquí iría la lógica de buscar y comparar stock vs conteo real
    // Por ahora, solo simulación visual para que veas que funciona el escáner
    if(window.showToast) window.showToast(`Escaneado en ${currentAuditWarehouse || '?'}: ${barcode}`, 'info');
  };

})();