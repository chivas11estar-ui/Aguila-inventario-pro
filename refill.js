// ============================================================
// Águila Inventario Pro - refill.js (VERSIÓN FIX DEFINITIVA)
// Soluciona el error "Producto no encontrado" usando caché local.
// ============================================================

/* global firebase, showToast, APP */

(() => {
  'use strict';
  
  let currentRefillProduct = null;
  let refillListener = null;

  // --- 1. Obtener ID Tienda (Determinante) INSTANTÁNEO ---
  function getDeterminante() {
    return localStorage.getItem('aguila_det');
  }

  // --- 2. Buscar Producto (Core) ---
  window.searchProductForRefill = async function(barcode) {
    const det = getDeterminante();
    if (!det) {
      alert('Error crítico: No hay ID de tienda. Cierra sesión y vuelve a entrar.');
      return;
    }

    if (!barcode) return;
    
    // UI Feedback
    if(window.showToast) window.showToast('🔍 Buscando...', 'info');

    try {
      // Búsqueda directa por ID
      const path = `inventario/${det}`;
      
      // Primero intentamos buscar si el barcode es la clave directa (optimización)
      // Pero como suele ser un array o ID generado, mejor filtramos.
      const snapshot = await firebase.database().ref(path)
        .orderByChild('codigoBarras')
        .equalTo(barcode)
        .once('value');

      const data = snapshot.val();

      if (!data) {
        // Sonido de error (si quieres)
        if(window.navigator.vibrate) window.navigator.vibrate([100,50,100]);
        if(window.showToast) window.showToast('❌ Producto NO existe en tu inventario.', 'error');
        
        // Limpiar formulario
        document.getElementById('refill-product-name').value = '';
        document.getElementById('refill-current-stock').value = '';
        currentRefillProduct = null;
        return;
      }

      // Producto encontrado
      const id = Object.keys(data)[0];
      const product = data[id];
      product.id = id; // Guardamos el ID de Firebase
      currentRefillProduct = product;

      // Llenar UI
      const nameEl = document.getElementById('refill-product-name');
      const stockEl = document.getElementById('refill-current-stock');
      const boxesEl = document.getElementById('refill-boxes');

      if(nameEl) nameEl.value = product.nombre || 'Sin nombre';
      if(stockEl) stockEl.value = product.cajas || 0;
      
      if(window.showToast) window.showToast('✅ Producto encontrado', 'success');
      
      // Auto-foco en cajas para escribir rápido
      if(boxesEl) {
        boxesEl.value = '';
        boxesEl.focus();
      }

    } catch (e) {
      console.error(e);
      if(window.showToast) window.showToast('Error de conexión', 'error');
    }
  };

  // --- 3. Guardar Relleno ---
  window.processRefillMovement = async function() {
    if (!currentRefillProduct) {
      alert('Primero escanea un producto.');
      return;
    }

    const boxesInput = document.getElementById('refill-boxes');
    const cantidad = parseInt(boxesInput.value);

    if (isNaN(cantidad) || cantidad <= 0) {
      alert('Ingresa una cantidad válida de cajas.');
      return;
    }

    const det = getDeterminante();
    const newStock = (parseInt(currentRefillProduct.cajas) || 0) + cantidad;

    try {
      // 1. Actualizar Stock
      await firebase.database().ref(`inventario/${det}/${currentRefillProduct.id}`).update({
        cajas: newStock,
        ultimaActualizacion: new Date().toISOString()
      });

      // 2. Registrar Movimiento (Historial)
      const movement = {
        tipo: 'relleno',
        producto: currentRefillProduct.nombre,
        codigo: currentRefillProduct.codigoBarras,
        cantidad: cantidad,
        fecha: new Date().toISOString()
      };
      await firebase.database().ref(`movimientos/${det}`).push(movement);

      if(window.showToast) window.showToast(`✅ Agregadas ${cantidad} cajas. Nuevo total: ${newStock}`, 'success');
      
      // Limpiar para el siguiente
      boxesInput.value = '';
      document.getElementById('refill-barcode').value = '';
      document.getElementById('refill-barcode').focus();
      currentRefillProduct = null;

    } catch (e) {
      console.error(e);
      alert('Error al guardar. Verifica tu internet.');
    }
  };

  // --- Inicialización ---
  document.addEventListener('DOMContentLoaded', () => {
    // Vincular botón Guardar manual si existe
    const btnSave = document.getElementById('btn-save-refill'); // Asegúrate que este ID exista en tu HTML o agrégalo
    if(btnSave) {
        btnSave.addEventListener('click', (e) => {
            e.preventDefault();
            window.processRefillMovement();
        });
    }
    
    // Listener para Enter en el input de cajas
    const boxesInput = document.getElementById('refill-boxes');
    if(boxesInput) {
        boxesInput.addEventListener('keypress', (e) => {
            if(e.key === 'Enter') window.processRefillMovement();
        });
    }
  });

})();ductForRefill;