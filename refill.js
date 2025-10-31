// ============================================================
// Águila Inventario Pro - Módulo: refill.js
// Copyright © 2025 José A. G. Betancourt
// Todos los derechos reservados
// VERSIÓN CORREGIDA - Búsqueda manual funcionando y SIN TEMPORIZADOR
// ============================================================

let currentRefillProduct = null;
let userDeterminanteRefill = null;

// ============================================================
// OBTENER DETERMINANTE DEL USUARIO (Versión Refill)
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
// BUSCAR PRODUCTO PARA RELLENO
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
      displayRefillProductInfo(currentRefillProduct);
      showToast('✅ Producto encontrado: ' + productData.nombre, 'success');
      
      return true;
      
    } else {
      console.log('⚠️ Producto no encontrado');
      currentRefillProduct = null;
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
    
    const boxesInput = document.getElementById('refill-boxes');
    if (boxesInput) {
      boxesInput.focus();
      boxesInput.select();
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
    showToast('⚠️ Primero busca un producto', 'warning');
    return;
  }
  
  console.log('📦 Procesando relleno:', boxes, 'cajas');
  
  // Obtener determinante si no está cargado
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
  
  // Preparar datos del movimiento
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
    // 1. Actualizar stock en inventario
    await firebase.database()
      .ref('inventario/' + userDeterminanteRefill + '/' + currentRefillProduct.id)
      .update({
        cajas: newStock,
        fechaActualizacion: new Date().toISOString(),
        actualizadoPor: firebase.auth().currentUser.email
      });
    
    console.log('✅ Stock actualizado');
    
    // 2. Registrar movimiento en historial
    await firebase.database()
      .ref('movimientos/' + userDeterminanteRefill)
      .push(movementData);
    
    console.log('✅ Movimiento registrado en historial');
    
    // Mensaje de éxito
    showToast(`✅ Movimiento registrado: ${boxesToMove} cajas al piso de venta. Stock restante: ${newStock}`, 'success');
    
    // Limpiar formulario
    const refillForm = document.getElementById('refill-form');
    if (refillForm) {
      refillForm.reset();
    }
    
    currentRefillProduct = null;
    hideRefillProductInfo();
    
    // Focus en código de barras para siguiente producto
    const barcodeInput = document.getElementById('refill-barcode');
    if (barcodeInput) {
      barcodeInput.focus();
    }
    
    // Actualizar contador de movimientos
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
    
    console.log('📊 Movimientos hoy:', count);
  } catch (error) {
    console.error('❌ Error al actualizar movimientos:', error);
  }
}

// ============================================================
// BUSCAR PRODUCTO MANUALMENTE
// ============================================================
async function buscarProductoManual() {
  const barcodeInput = document.getElementById('refill-barcode');
  if (!barcodeInput) {
    console.error('❌ Input de código de barras no encontrado');
    return;
  }
  
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
  
  // Input de código de barras
  const barcodeInput = document.getElementById('refill-barcode');
  if (barcodeInput) {
    // Buscar al presionar Enter
    barcodeInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        buscarProductoManual();
      }
    });
    
    // Limpiar producto actual cuando se edita el código
    barcodeInput.addEventListener('input', () => {
      if (currentRefillProduct) {
        console.log('ℹ️ Código modificado, limpiando producto actual');
        currentRefillProduct = null;
        hideRefillProductInfo();
      }
    });
  }
  
  // Submit del formulario
  const refillForm = document.getElementById('refill-form');
  if (refillForm) {
    refillForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      console.log('📝 Submit de formulario de relleno');
      
      const barcodeInput = document.getElementById('refill-barcode');
      const boxesInput = document.getElementById('refill-boxes');
      const boxes = boxesInput?.value;
      
      // Si no hay producto seleccionado, buscar primero
      if (!currentRefillProduct) {
        const barcode = barcodeInput?.value.trim();
        
        if (!barcode) {
          showToast('⚠️ Ingresa un código de barras', 'warning');
          barcodeInput?.focus();
          return;
        }
        
        console.log('🔍 Buscando producto antes de registrar...');
        const found = await searchProductForRefill(barcode);
        
        if (!found) {
          console.log('❌ Producto no encontrado, abortando');
          return;
        }
      }
      
      // Validar cantidad
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
// INICIALIZACIÓN (CORREGIDA - SIN TEMPORIZADOR INESTABLE)
// ============================================================
function initRefillModule() {
  console.log('🎯 Inicializando módulo de relleno...');
  
  // Verificar autenticación
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      console.log('✅ Usuario autenticado, configurando relleno...');
      
      // Mantenemos un pequeño delay ya que onAuthStateChanged se dispara antes de que el DOM esté completamente listo
      setTimeout(() => { 
        setupRefillForm();
        updateTodayMovements();
      }, 500);
    } else {
      console.log('⏳ Esperando autenticación para módulo de relleno...');
    }
  });
}

// Inicialización al cargar el DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initRefillModule);
} else {
  initRefillModule();
}

console.log('✅ refill.js cargado correctamente');

// Exponer función para que pueda ser usada en ui.js al escanear
window.searchProductForRefill = searchProductForRefill;