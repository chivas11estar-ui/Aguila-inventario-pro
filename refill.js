// ============================================================
// Águila Inventario Pro - Módulo: refill.js
// VERSIÓN CON AUTOFILL AUTOMÁTICO
// Copyright © 2025 José A. G. Betancourt
// ============================================================

let currentRefillProduct = null;
let userDeterminanteRefill = null;

// ============================================================
// OBTENER DETERMINANTE DEL USUARIO
// ============================================================
async function getUserDeterminanteRefill() {
  const userId = firebase.auth().currentUser?.uid;
  if (!userId) {
    console.error('❌ No hay usuario autenticado');
    return null;
  }
  
  try {
    const snapshot = await firebase.database().ref('usuarios/' + userId).once('value');
    const userData = snapshot.val();
    const determinante = userData?.determinante;
    
    if (!determinante) {
      console.error('❌ Usuario sin determinante asignado');
    }
    
    return determinante || null;
  } catch (error) {
    console.error('❌ Error al obtener determinante:', error);
    return null;
  }
}

// ============================================================
// BUSCAR PRODUCTO PARA RELLENO CON AUTOFILL
// ============================================================
async function searchProductForRefill(barcode) {
  console.log('🔍 Buscando producto para relleno:', barcode);
  
  if (!barcode || barcode.length < 8) {
    showToast('⚠️ Código de barras inválido (mínimo 8 dígitos)', 'warning');
    return false;
  }
  
  // Obtener determinante si no está cargado
  if (!userDeterminanteRefill) {
    userDeterminanteRefill = await getUserDeterminanteRefill();
  }
  
  if (!userDeterminanteRefill) {
    showToast('❌ Error: No se encontró información de la tienda', 'error');
    return false;
  }
  
  const inventoryRef = firebase.database().ref('inventario/' + userDeterminanteRefill);
  
  try {
    const snapshot = await inventoryRef.orderByChild('codigoBarras').equalTo(barcode).once('value');
    
    if (snapshot.exists()) {
      const products = snapshot.val();
      const productId = Object.keys(products)[0];
      const productData = products[productId];
      
      currentRefillProduct = {
        id: productId,
        ...productData
      };
      
      console.log('✅ Producto encontrado:', currentRefillProduct);
      
      // ✅ AUTOFILL - Rellenar campos automáticamente
      const nombreInput = document.getElementById('refill-nombre');
      const marcaInput = document.getElementById('refill-marca');
      const piezasInput = document.getElementById('refill-piezas');
      
      if (nombreInput) {
        nombreInput.value = productData.nombre || '';
        nombreInput.style.background = '#ecfdf5';
        nombreInput.style.borderColor = '#10b981';
      }
      
      if (marcaInput) {
        marcaInput.value = productData.marca || '';
        marcaInput.style.background = '#ecfdf5';
        marcaInput.style.borderColor = '#10b981';
      }
      
      if (piezasInput) {
        piezasInput.value = productData.piezasPorCaja || '';
        piezasInput.style.background = '#ecfdf5';
        piezasInput.style.borderColor = '#10b981';
      }
      
      // Mostrar información del producto
      displayRefillProductInfo(currentRefillProduct);
      showToast('✅ Producto encontrado: ' + productData.nombre, 'success');
      
      // Focus en el campo de cajas
      const boxesInput = document.getElementById('refill-boxes');
      if (boxesInput) {
        setTimeout(() => {
          boxesInput.focus();
          boxesInput.select();
        }, 300);
      }
      
      return true;
      
    } else {
      console.log('⚠️ Producto no encontrado');
      currentRefillProduct = null;
      
      // Limpiar campos autofill
      const nombreInput = document.getElementById('refill-nombre');
      const marcaInput = document.getElementById('refill-marca');
      const piezasInput = document.getElementById('refill-piezas');
      
      if (nombreInput) {
        nombreInput.value = '';
        nombreInput.style.background = '';
        nombreInput.style.borderColor = '';
      }
      if (marcaInput) {
        marcaInput.value = '';
        marcaInput.style.background = '';
        marcaInput.style.borderColor = '';
      }
      if (piezasInput) {
        piezasInput.value = '';
        piezasInput.style.background = '';
        piezasInput.style.borderColor = '';
      }
      
      hideRefillProductInfo();
      showToast('⚠️ Producto no encontrado en el inventario', 'warning');
      
      return false;
    }
  } catch (error) {
    console.error('❌ Error al buscar producto:', error);
    showToast('❌ Error al buscar producto: ' + error.message, 'error');
    return false;
  }
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
    stockEl.textContent = 'Stock actual: ' + (product.cajas || 0) + ' cajas en ' + (product.ubicacion || 'almacén');
    infoDiv.style.display = 'block';
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
    showToast('⚠️ Primero busca un producto', 'warning');
    return;
  }
  
  console.log('📦 Procesando relleno:', boxes, 'cajas');
  
  if (!userDeterminanteRefill) {
    userDeterminanteRefill = await getUserDeterminanteRefill();
  }
  
  if (!userDeterminanteRefill) {
    showToast('❌ Error: No se encontró información de la tienda', 'error');
    return;
  }
  
  const currentStock = currentRefillProduct.cajas || 0;
  const boxesToMove = parseInt(boxes);
  
  // Validaciones
  if (isNaN(boxesToMove) || boxesToMove <= 0) {
    showToast('❌ La cantidad debe ser mayor a 0', 'error');
    return;
  }
  
  if (boxesToMove > currentStock) {
    showToast(`❌ Stock insuficiente. Solo hay ${currentStock} cajas disponibles`, 'error');
    return;
  }
  
  const newStock = currentStock - boxesToMove;
  
  const movementData = {
    tipo: 'relleno',
    productoId: currentRefillProduct.id,
    productoNombre: currentRefillProduct.nombre,
    productoCodigo: currentRefillProduct.codigoBarras || 'N/A',
    marca: currentRefillProduct.marca || 'N/A',
    ubicacion: currentRefillProduct.ubicacion || 'N/A',
    cajasMovidas: boxesToMove,
    stockAnterior: currentStock,
    stockNuevo: newStock,
    fecha: new Date().toISOString(),
    realizadoPor: firebase.auth().currentUser.email
  };
  
  try {
    await firebase.database()
      .ref('inventario/' + userDeterminanteRefill + '/' + currentRefillProduct.id)
      .update({
        cajas: newStock,
        fechaActualizacion: new Date().toISOString(),
        actualizadoPor: firebase.auth().currentUser.email
      });
    
    await firebase.database()
      .ref('movimientos/' + userDeterminanteRefill)
      .push(movementData);
    
    showToast(`✅ Movimiento registrado: ${boxesToMove} cajas. Stock restante: ${newStock}`, 'success');
    
    // Limpiar formulario y estilos
    const refillForm = document.getElementById('refill-form');
    if (refillForm) {
      refillForm.reset();
    }
    
    // Limpiar estilos de autofill
    ['refill-nombre', 'refill-marca', 'refill-piezas'].forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.style.background = '';
        input.style.borderColor = '';
      }
    });
    
    currentRefillProduct = null;
    hideRefillProductInfo();
    
    const barcodeInput = document.getElementById('refill-barcode');
    if (barcodeInput) {
      barcodeInput.focus();
    }
    
    updateTodayMovements();
    
  } catch (error) {
    console.error('❌ Error al registrar movimiento:', error);
    showToast('❌ Error al registrar movimiento: ' + error.message, 'error');
  }
}

// ============================================================
// ACTUALIZAR CONTADOR DE MOVIMIENTOS HOY
// ============================================================
async function updateTodayMovements() {
  if (!userDeterminanteRefill) {
    userDeterminanteRefill = await getUserDeterminanteRefill();
  }
  
  if (!userDeterminanteRefill) return;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();
  
  const movementsRef = firebase.database().ref('movimientos/' + userDeterminanteRefill);
  
  try {
    const snapshot = await movementsRef.orderByChild('fecha').startAt(todayISO).once('value');
    const count = snapshot.exists() ? snapshot.numChildren() : 0;
    
    const countEl = document.getElementById('total-movements');
    if (countEl) {
      countEl.textContent = count;
    }
  } catch (error) {
    console.error('❌ Error al actualizar movimientos:', error);
  }
}

// ============================================================
// BUSCAR PRODUCTO MANUALMENTE
// ============================================================
async function buscarProductoManual() {
  const barcodeInput = document.getElementById('refill-barcode');
  if (!barcodeInput) return;
  
  const barcode = barcodeInput.value.trim();
  
  if (!barcode) {
    showToast('⚠️ Ingresa un código de barras', 'warning');
    barcodeInput.focus();
    return;
  }
  
  if (barcode.length < 8) {
    showToast('⚠️ Código demasiado corto (mínimo 8 dígitos)', 'warning');
    barcodeInput.focus();
    return;
  }
  
  await searchProductForRefill(barcode);
}

// ============================================================
// CONFIGURAR EVENTOS DEL FORMULARIO
// ============================================================
function setupRefillForm() {
  console.log('🔧 Configurando formulario de relleno...');
  
  const barcodeInput = document.getElementById('refill-barcode');
  if (barcodeInput) {
    barcodeInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        buscarProductoManual();
      }
    });
    
    barcodeInput.addEventListener('input', () => {
      if (currentRefillProduct) {
        currentRefillProduct = null;
        hideRefillProductInfo();
        
        // Limpiar estilos autofill
        ['refill-nombre', 'refill-marca', 'refill-piezas'].forEach(id => {
          const input = document.getElementById(id);
          if (input) {
            input.style.background = '';
            input.style.borderColor = '';
          }
        });
      }
    });
  }
  
  const refillForm = document.getElementById('refill-form');
  if (refillForm) {
    refillForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const barcodeInput = document.getElementById('refill-barcode');
      const boxesInput = document.getElementById('refill-boxes');
      const boxes = boxesInput?.value;
      
      if (!currentRefillProduct) {
        const barcode = barcodeInput?.value.trim();
        
        if (!barcode) {
          showToast('⚠️ Ingresa un código de barras', 'warning');
          barcodeInput?.focus();
          return;
        }
        
        const found = await searchProductForRefill(barcode);
        
        if (!found) {
          return;
        }
      }
      
      if (!boxes || boxes === '') {
        showToast('❌ Ingresa una cantidad válida', 'error');
        boxesInput?.focus();
        return;
      }
      
      await processRefillMovement(boxes);
    });
  }
  
  console.log('✅ Formulario de relleno configurado');
}

// ============================================================
// INICIALIZACIÓN
// ============================================================
function initRefillModule() {
  console.log('🎯 Inicializando módulo de relleno...');
  
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      console.log('✅ Usuario autenticado, configurando relleno...');
      
      setTimeout(() => { 
        setupRefillForm();
        updateTodayMovements();
      }, 500);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initRefillModule);
} else {
  initRefillModule();
}

console.log('✅ refill.js con AUTOFILL cargado correctamente');

window.searchProductForRefill = searchProductForRefill;