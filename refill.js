/* ============================================================
   Águila Inventario Pro - Módulo: styles.css
   Copyright © 2025 José A. G. Betancourt
   Todos los derechos reservados
   
   Este archivo forma parte del sistema Águila Inventario Pro,
   desarrollado para promotores de PepsiCo con funcionalidades
   de gestión, auditoría y sincronización de inventario.
   
   Queda prohibida la reproducción, distribución o modificación
   sin autorización expresa del autor.
   ============================================================ */

let currentRefillProduct = null;

// ============================================================
// BUSCAR PRODUCTO PARA RELLENO
// ============================================================
function searchProductForRefill(barcode) {
  console.log('🔍 Buscando producto para relleno:', barcode);
  
  const userId = firebase.auth().currentUser?.uid;
  if (!userId) {
    showToast('No hay usuario autenticado', 'error');
    return;
  }
  
  const inventoryRef = firebase.database().ref('inventario/' + userId);
  
  inventoryRef.orderByChild('codigoBarras').equalTo(barcode).once('value')
    .then((snapshot) => {
      if (snapshot.exists()) {
        const products = snapshot.val();
        const productId = Object.keys(products)[0];
        const productData = products[productId];
        
        currentRefillProduct = {
          id: productId,
          ...productData
        };
        
        console.log('✅ Producto encontrado:', currentRefillProduct);
        displayRefillProductInfo(currentRefillProduct);
        showToast('Producto encontrado: ' + productData.nombre, 'success');
        
      } else {
        console.log('⚠️ Producto no encontrado');
        currentRefillProduct = null;
        hideRefillProductInfo();
        showToast('Producto no encontrado en el inventario', 'warning');
      }
    })
    .catch((error) => {
      console.error('❌ Error al buscar producto:', error);
      showToast('Error al buscar producto: ' + error.message, 'error');
    });
}

// ============================================================
// MOSTRAR INFORMACIÓN DEL PRODUCTO
// ============================================================
function displayRefillProductInfo(product) {
  const infoDiv = document.getElementById('refill-product-info');
  const nameEl = document.getElementById('refill-product-name');
  const stockEl = document.getElementById('refill-current-stock');
  
  if (infoDiv && nameEl && stockEl) {
    nameEl.innerHTML = '<strong>Producto:</strong> ' + product.nombre;
    stockEl.textContent = 'Stock actual: ' + (product.cajas || 0) + ' cajas en almacén';
    infoDiv.style.display = 'block';
    
    // Enfocar campo de cajas
    const boxesInput = document.getElementById('refill-boxes');
    if (boxesInput) {
      boxesInput.focus();
    }
  }
}

function hideRefillProductInfo() {
  const infoDiv = document.getElementById('refill-product-info');
  if (infoDiv) {
    infoDiv.style.display = 'none';
  }
}

// ============================================================
// REGISTRAR MOVIMIENTO DE RELLENO
// ============================================================
function processRefillMovement(boxes) {
  if (!currentRefillProduct) {
    showToast('Primero busca un producto', 'warning');
    return;
  }
  
  console.log('📦 Procesando relleno:', boxes, 'cajas');
  
  const userId = firebase.auth().currentUser?.uid;
  if (!userId) {
    showToast('No hay usuario autenticado', 'error');
    return;
  }
  
  const currentStock = currentRefillProduct.cajas || 0;
  const boxesToMove = parseInt(boxes);
  
  // Validar que haya suficiente stock
  if (boxesToMove > currentStock) {
    showToast(`Stock insuficiente. Solo hay ${currentStock} cajas disponibles`, 'error');
    return;
  }
  
  if (boxesToMove <= 0) {
    showToast('La cantidad debe ser mayor a 0', 'error');
    return;
  }
  
  // Actualizar stock en Firebase
  const newStock = currentStock - boxesToMove;
  const productRef = firebase.database().ref('inventario/' + userId + '/' + currentRefillProduct.id);
  
  productRef.update({
    cajas: newStock,
    fechaActualizacion: new Date().toISOString()
  })
    .then(() => {
      console.log('✅ Movimiento registrado');
      
      // Registrar movimiento en historial
      registerMovement(userId, {
        tipo: 'relleno',
        productoId: currentRefillProduct.id,
        productoNombre: currentRefillProduct.nombre,
        cantidad: boxesToMove,
        stockAnterior: currentStock,
        stockNuevo: newStock,
        fecha: new Date().toISOString()
      });
      
      showToast(`Movimiento registrado: ${boxesToMove} cajas al piso de venta`, 'success');
      
      // Limpiar formulario
      document.getElementById('refill-form').reset();
      currentRefillProduct = null;
      hideRefillProductInfo();
      
      // Actualizar estadísticas si es hoy
      updateTodayMovements();
      
    })
    .catch((error) => {
      console.error('❌ Error al registrar movimiento:', error);
      showToast('Error al registrar movimiento: ' + error.message, 'error');
    });
}

// ============================================================
// REGISTRAR MOVIMIENTO EN HISTORIAL
// ============================================================
function registerMovement(userId, movementData) {
  const movementsRef = firebase.database().ref('movimientos/' + userId);
  
  movementsRef.push(movementData)
    .then(() => {
      console.log('✅ Movimiento guardado en historial');
    })
    .catch((error) => {
      console.error('⚠️ Error al guardar en historial:', error);
    });
}

// ============================================================
// ACTUALIZAR CONTADOR DE MOVIMIENTOS HOY
// ============================================================
function updateTodayMovements() {
  const userId = firebase.auth().currentUser?.uid;
  if (!userId) return;
  
  const today = new Date().toISOString().split('T')[0];
  const movementsRef = firebase.database().ref('movimientos/' + userId);
  
  movementsRef.orderByChild('fecha').startAt(today).once('value')
    .then((snapshot) => {
      const count = snapshot.exists() ? snapshot.numChildren() : 0;
      const countEl = document.getElementById('total-movements');
      if (countEl) {
        countEl.textContent = count;
      }
    })
    .catch((error) => {
      console.error('❌ Error al actualizar movimientos:', error);
    });
}

// ============================================================
// CONFIGURAR EVENTOS DEL FORMULARIO
// ============================================================
function setupRefillForm() {
  console.log('🔧 Configurando formulario de relleno...');
  
  // Botón de escaneo
  const scanBtn = document.getElementById('refill-scan-btn');
  if (scanBtn) {
    scanBtn.addEventListener('click', () => {
      if (typeof openScanner === 'function') {
        openScanner((code) => {
          const barcodeInput = document.getElementById('refill-barcode');
          if (barcodeInput) {
            barcodeInput.value = code;
            searchProductForRefill(code);
          }
        });
      } else {
        showToast('El escáner no está disponible', 'error');
      }
    });
  }
  
  // Buscar al escribir código
  const barcodeInput = document.getElementById('refill-barcode');
  if (barcodeInput) {
    barcodeInput.addEventListener('blur', (e) => {
      const code = e.target.value.trim();
      if (code.length >= 8) {
        searchProductForRefill(code);
      }
    });
    
    // Buscar al presionar Enter
    barcodeInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const code = e.target.value.trim();
        if (code.length >= 8) {
          searchProductForRefill(code);
        }
      }
    });
  }
  
  // Submit del formulario
  const refillForm = document.getElementById('refill-form');
  if (refillForm) {
    refillForm.addEventListener('submit', (e) => {
      e.preventDefault();
      console.log('📝 Submit de formulario de relleno');
      
      const boxes = document.getElementById('refill-boxes').value;
      
      if (!currentRefillProduct) {
        showToast('Primero escanea o busca un producto', 'warning');
        return;
      }
      
      if (!boxes || boxes <= 0) {
        showToast('Ingresa una cantidad válida', 'error');
        return;
      }
      
      processRefillMovement(boxes);
    });
  }
  
  console.log('✅ Formulario de relleno configurado');
}

// ============================================================
// INICIALIZACIÓN
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('🔄 Inicializando módulo de relleno...');
  
  // Esperar a que Firebase esté listo
  const initInterval = setInterval(() => {
    if (typeof firebase !== 'undefined' && firebase.auth().currentUser) {
      setupRefillForm();
      clearInterval(initInterval);
    }
  }, 500);
  
  // Timeout de seguridad (10 segundos)
  setTimeout(() => {
    clearInterval(initInterval);
    setupRefillForm();
  }, 10000);
});

console.log('✅ Módulo de relleno cargado');