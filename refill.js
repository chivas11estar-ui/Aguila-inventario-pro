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
let userDeterminante = null;

// ============================================================
// OBTENER DETERMINANTE DEL USUARIO
// ============================================================
async function getUserDeterminante() {
  const userId = firebase.auth().currentUser?.uid;
  if (!userId) return null;
  
  try {
    const snapshot = await firebase.database().ref('usuarios/' + userId).once('value');
    const userData = snapshot.val();
    return userData?.determinante || null;
  } catch (error) {
    console.error('❌ Error al obtener determinante:', error);
    return null;
  }
}

// ============================================================
// BUSCAR PRODUCTO PARA RELLENO
// ============================================================
async function searchProductForRefill(barcode) {
  console.log('🔍 Buscando producto para relleno:', barcode);
  
  if (!userDeterminante) {
    userDeterminante = await getUserDeterminante();
  }
  
  if (!userDeterminante) {
    showToast('Error: No se encontró información de la tienda', 'error');
    return;
  }
  
  const inventoryRef = firebase.database().ref('inventario/' + userDeterminante);
  
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
async function processRefillMovement(boxes) {
  if (!currentRefillProduct) {
    showToast('Primero busca un producto', 'warning');
    return;
  }
  
  console.log('📦 Procesando relleno:', boxes, 'cajas');
  
  if (!userDeterminante) {
    userDeterminante = await getUserDeterminante();
  }
  
  if (!userDeterminante) {
    showToast('Error: No se encontró información de la tienda', 'error');
    return;
  }
  
  const currentStock = currentRefillProduct.cajas || 0;
  const boxesToMove = parseInt(boxes);
  
  if (boxesToMove > currentStock) {
    showToast(`Stock insuficiente. Solo hay ${currentStock} cajas disponibles`, 'error');
    return;
  }
  
  if (boxesToMove <= 0) {
    showToast('La cantidad debe ser mayor a 0', 'error');
    return;
  }
  
  const newStock = currentStock - boxesToMove;
  const productRef = firebase.database().ref('inventario/' + userDeterminante + '/' + currentRefillProduct.id);
  
  try {
    // Actualizar stock
    await productRef.update({
      cajas: newStock,
      fechaActualizacion: new Date().toISOString(),
      actualizadoPor: firebase.auth().currentUser.email
    });
    
    console.log('✅ Movimiento registrado');
    
    // Registrar movimiento en historial
    await registerMovement(userDeterminante, {
      tipo: 'relleno',
      productoId: currentRefillProduct.id,
      productoNombre: currentRefillProduct.nombre,
      cantidad: boxesToMove,
      stockAnterior: currentStock,
      stockNuevo: newStock,
      fecha: new Date().toISOString(),
      realizadoPor: firebase.auth().currentUser.email
    });
    
    showToast(`Movimiento registrado: ${boxesToMove} cajas al piso de venta`, 'success');
    
    // Limpiar formulario
    document.getElementById('refill-form').reset();
    currentRefillProduct = null;
    hideRefillProductInfo();
    
    // Actualizar estadísticas
    updateTodayMovements();
    
  } catch (error) {
    console.error('❌ Error al registrar movimiento:', error);
    showToast('Error al registrar movimiento: ' + error.message, 'error');
  }
}

// ============================================================
// REGISTRAR MOVIMIENTO EN HISTORIAL
// ============================================================
async function registerMovement(determinante, movementData) {
  const movementsRef = firebase.database().ref('movimientos/' + determinante);
  
  try {
    await movementsRef.push(movementData);
    console.log('✅ Movimiento guardado en historial');
  } catch (error) {
    console.error('⚠️ Error al guardar en historial:', error);
  }
}

// ============================================================
// ACTUALIZAR CONTADOR DE MOVIMIENTOS HOY
// ============================================================
async function updateTodayMovements() {
  if (!userDeterminante) {
    userDeterminante = await getUserDeterminante();
  }
  
  if (!userDeterminante) return;
  
  const today = new Date().toISOString().split('T')[0];
  const movementsRef = firebase.database().ref('movimientos/' + userDeterminante);
  
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
  
  const initInterval = setInterval(() => {
    if (typeof firebase !== 'undefined' && firebase.auth().currentUser) {
      setupRefillForm();
      clearInterval(initInterval);
    }
  }, 500);
  
  setTimeout(() => {
    clearInterval(initInterval);
    setupRefillForm();
  }, 10000);
});

console.log('✅ refill.js (multi-usuario) cargado correctamente');