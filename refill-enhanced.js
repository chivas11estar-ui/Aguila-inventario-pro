// ============================================================
// Águila Inventario Pro - Módulo: refill-enhanced.js
// VERSIÓN MEJORADA CON CREACIÓN DE PRODUCTOS NUEVOS
// Copyright © 2025 José A. G. Betancourt
// ============================================================

let currentRefillProduct = null;
let userDeterminanteRefill = null;
let isCreatingNewProduct = false;

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
      isCreatingNewProduct = false;
      
      // ✅ AUTOFILL - Rellenar campos automáticamente
      const nombreInput = document.getElementById('refill-nombre');
      const marcaInput = document.getElementById('refill-marca');
      const piezasInput = document.getElementById('refill-piezas');
      const warehouseInput = document.getElementById('refill-warehouse');
      
      if (nombreInput) {
        nombreInput.value = productData.nombre || '';
        nombreInput.style.background = '#ecfdf5';
        nombreInput.style.borderColor = '#10b981';
        nombreInput.readOnly = true;
      }
      
      if (marcaInput) {
        marcaInput.value = productData.marca || '';
        marcaInput.style.background = '#ecfdf5';
        marcaInput.style.borderColor = '#10b981';
        marcaInput.readOnly = true;
      }
      
      if (piezasInput) {
        piezasInput.value = productData.piezasPorCaja || '';
        piezasInput.style.background = '#ecfdf5';
        piezasInput.style.borderColor = '#10b981';
        piezasInput.readOnly = true;
      }
      
      if (warehouseInput) {
        warehouseInput.value = productData.ubicacion || '';
        warehouseInput.style.background = '#ecfdf5';
        warehouseInput.style.borderColor = '#10b981';
        warehouseInput.readOnly = true;
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
      console.log('⚠️ Producto no encontrado - Opción de crear nuevo');
      currentRefillProduct = null;
      isCreatingNewProduct = false;
      
      // Mostrar modal para crear nuevo producto
      mostrarModalCrearProducto(barcode);
      
      return false;
    }
  } catch (error) {
    console.error('❌ Error al buscar producto:', error);
    showToast('❌ Error al buscar producto: ' + error.message, 'error');
    return false;
  }
}

// ============================================================
// MOSTRAR MODAL PARA CREAR PRODUCTO NUEVO
// ============================================================
function mostrarModalCrearProducto(barcode) {
  const modal = document.getElementById('create-product-modal');
  if (!modal) {
    console.warn('⚠️ Modal de crear producto no existe en HTML');
    
    // Si no existe, mostrar opción manual
    const confirmado = confirm(
      '❌ Producto no encontrado.\n\n' +
      '¿Quieres crear un producto nuevo con este código?\n\n' +
      'Código: ' + barcode
    );
    
    if (confirmado) {
      habilitarCreacionManual(barcode);
    }
    return;
  }
  
  // Llenar código en el modal
  const barcodeField = document.getElementById('create-product-barcode');
  if (barcodeField) {
    barcodeField.value = barcode;
    barcodeField.readOnly = true;
  }
  
  // Mostrar modal
  modal.style.display = 'flex';
  modal.classList.remove('hidden');
  
  // Focus en nombre
  const nameField = document.getElementById('create-product-name');
  if (nameField) {
    nameField.focus();
  }
  
  showToast('📝 Completa los datos del nuevo producto', 'info');
}

// ============================================================
// HABILITAR CREACIÓN MANUAL SIN MODAL
// ============================================================
function habilitarCreacionManual(barcode) {
  isCreatingNewProduct = true;
  
  // Habilitar campos
  document.getElementById('refill-nombre').readOnly = false;
  document.getElementById('refill-nombre').style.background = '#fff';
  document.getElementById('refill-nombre').style.borderColor = '#f59e0b';
  document.getElementById('refill-nombre').style.borderWidth = '2px';
  
  document.getElementById('refill-marca').readOnly = false;
  document.getElementById('refill-marca').style.background = '#fff';
  document.getElementById('refill-marca').style.borderColor = '#f59e0b';
  document.getElementById('refill-marca').style.borderWidth = '2px';
  
  document.getElementById('refill-piezas').readOnly = false;
  document.getElementById('refill-piezas').style.background = '#fff';
  document.getElementById('refill-piezas').style.borderColor = '#f59e0b';
  document.getElementById('refill-piezas').style.borderWidth = '2px';
  
  document.getElementById('refill-warehouse').readOnly = false;
  document.getElementById('refill-warehouse').style.background = '#fff';
  document.getElementById('refill-warehouse').style.borderColor = '#f59e0b';
  document.getElementById('refill-warehouse').style.borderWidth = '2px';
  
  // Limpiar campos
  document.getElementById('refill-nombre').value = '';
  document.getElementById('refill-marca').value = 'Otra';
  document.getElementById('refill-piezas').value = '24';
  document.getElementById('refill-warehouse').value = '';
  
  // Guardar el código
  currentRefillProduct = {
    id: null,
    codigoBarras: barcode,
    nombre: '',
    marca: '',
    piezasPorCaja: 24,
    ubicacion: '',
    cajas: 0
  };
  
  // Mostrar info
  const infoDiv = document.getElementById('refill-product-info');
  if (infoDiv) {
    infoDiv.innerHTML = `
      <strong style="color:#f59e0b;">📝 NUEVO PRODUCTO</strong><br>
      Código: ${barcode}<br>
      <small style="color:#6b7280;">Completa los campos destacados en amarillo</small>
    `;
    infoDiv.style.display = 'block';
    infoDiv.style.borderColor = '#f59e0b';
  }
  
  showToast('📝 Nuevo producto - Completa los datos', 'warning');
  document.getElementById('refill-nombre').focus();
}

// ============================================================
// GUARDAR NUEVO PRODUCTO DESDE MODAL
// ============================================================
async function guardarProductoDelModal() {
  const barcode = document.getElementById('create-product-barcode')?.value;
  const nombre = document.getElementById('create-product-name')?.value.trim();
  const marca = document.getElementById('create-product-marca')?.value;
  const piezas = parseInt(document.getElementById('create-product-piezas')?.value || 24);
  const warehouse = document.getElementById('create-product-warehouse')?.value.trim();
  
  if (!nombre || !warehouse) {
    showToast('❌ Completa todos los campos', 'error');
    return;
  }
  
  if (!userDeterminanteRefill) {
    userDeterminanteRefill = await getUserDeterminanteRefill();
  }
  
  try {
    const newProductRef = firebase.database()
      .ref('inventario/' + userDeterminanteRefill)
      .push();
    
    const productData = {
      codigoBarras: barcode,
      nombre: nombre,
      marca: marca || 'Otra',
      piezasPorCaja: piezas || 24,
      ubicacion: warehouse,
      cajas: 0,
      fechaCaducidad: '',
      fechaCreacion: new Date().toISOString(),
      creadoPor: firebase.auth().currentUser.email
    };
    
    await newProductRef.set(productData);
    
    currentRefillProduct = {
      id: newProductRef.key,
      ...productData
    };
    
    // Cerrar modal
    const modal = document.getElementById('create-product-modal');
    if (modal) {
      modal.style.display = 'none';
    }
    
    // Llenar formulario de relleno
    document.getElementById('refill-nombre').value = nombre;
    document.getElementById('refill-marca').value = marca || 'Otra';
    document.getElementById('refill-piezas').value = piezas;
    document.getElementById('refill-warehouse').value = warehouse;
    
    isCreatingNewProduct = false;
    displayRefillProductInfo(currentRefillProduct);
    
    showToast('✅ Producto creado: ' + nombre, 'success');
    
    // Focus en cajas
    document.getElementById('refill-boxes').focus();
    
  } catch (error) {
    console.error('❌ Error guardando producto:', error);
    showToast('❌ Error: ' + error.message, 'error');
  }
}

// ============================================================
// CERRAR MODAL
// ============================================================
function cerrarModalCrearProducto() {
  const modal = document.getElementById('create-product-modal');
  if (modal) {
    modal.style.display = 'none';
  }
  document.getElementById('refill-barcode').focus();
}

// ============================================================
// MOSTRAR INFORMACIÓN DEL PRODUCTO
// ============================================================
function displayRefillProductInfo(product) {
  const infoDiv = document.getElementById('refill-product-info');
  const nameEl = document.getElementById('refill-product-name');
  const stockEl = document.getElementById('refill-current-stock');
  
  if (infoDiv && nameEl && stockEl) {
    if (product.id) {
      nameEl.innerHTML = '<strong>Producto:</strong> ' + product.nombre;
      stockEl.textContent = 'Stock actual: ' + (product.cajas || 0) + ' cajas en ' + (product.ubicacion || 'almacén');
    } else {
      nameEl.innerHTML = '<strong style="color:#f59e0b;">📝 NUEVO:</strong> ' + product.nombre;
      stockEl.textContent = 'Bodega: ' + product.ubicacion;
    }
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
  
  if (boxesToMove > currentStock && currentRefillProduct.id) {
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
    diaSemana: new Date().toLocaleDateString('es-MX', { weekday: 'long' }),
    realizadoPor: firebase.auth().currentUser.email,
    esProductoNuevo: !currentRefillProduct.id || isCreatingNewProduct
  };
  
  try {
    // Si es producto nuevo, establecer el stock
    if (!currentRefillProduct.id || isCreatingNewProduct) {
      // Crear producto si no existe
      const inventoryRef = firebase.database()
        .ref('inventario/' + userDeterminanteRefill);
      
      const snapshot = await inventoryRef
        .orderByChild('codigoBarras')
        .equalTo(currentRefillProduct.codigoBarras)
        .once('value');
      
      if (!snapshot.exists()) {
        const newProductRef = inventoryRef.push();
        currentRefillProduct.id = newProductRef.key;
        
        await newProductRef.set({
          codigoBarras: currentRefillProduct.codigoBarras,
          nombre: currentRefillProduct.nombre,
          marca: currentRefillProduct.marca || 'Otra',
          piezasPorCaja: currentRefillProduct.piezasPorCaja || 24,
          ubicacion: currentRefillProduct.ubicacion,
          cajas: boxesToMove,
          fechaCaducidad: '',
          fechaCreacion: new Date().toISOString(),
          fechaActualizacion: new Date().toISOString(),
          actualizadoPor: firebase.auth().currentUser.email
        });
      }
    } else {
      // Actualizar stock existente
      await firebase.database()
        .ref('inventario/' + userDeterminanteRefill + '/' + currentRefillProduct.id)
        .update({
          cajas: newStock,
          fechaActualizacion: new Date().toISOString(),
          actualizadoPor: firebase.auth().currentUser.email
        });
    }
    
    // Registrar movimiento
    await firebase.database()
      .ref('movimientos/' + userDeterminanteRefill)
      .push(movementData);
    
    showToast(`✅ Movimiento registrado: ${boxesToMove} cajas`, 'success');
    
    // Limpiar
    document.getElementById('refill-form').reset();
    ['refill-nombre', 'refill-marca', 'refill-piezas', 'refill-warehouse'].forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.style.background = '';
        input.style.borderColor = '';
        input.readOnly = false;
      }
    });
    
    currentRefillProduct = null;
    isCreatingNewProduct = false;
    hideRefillProductInfo();
    
    document.getElementById('refill-barcode').focus();
    updateTodayMovements();
    
  } catch (error) {
    console.error('❌ Error al registrar movimiento:', error);
    showToast('❌ Error: ' + error.message, 'error');
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
// CONFIGURAR EVENTOS DEL FORMULARIO
// ============================================================
function setupRefillForm() {
  console.log('🔧 Configurando formulario de relleno mejorado...');
  
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
        
        ['refill-nombre', 'refill-marca', 'refill-piezas', 'refill-warehouse'].forEach(id => {
          const input = document.getElementById(id);
          if (input) {
            input.style.background = '';
            input.style.borderColor = '';
            input.readOnly = false;
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
  
  // Eventos del modal
  const saveModalBtn = document.getElementById('save-product-modal-btn');
  if (saveModalBtn) {
    saveModalBtn.addEventListener('click', guardarProductoDelModal);
  }
  
  const closeModalBtn = document.getElementById('close-product-modal-btn');
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', cerrarModalCrearProducto);
  }
  
  console.log('✅ Formulario de relleno mejorado configurado');
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
// INICIALIZACIÓN
// ============================================================
function initRefillModule() {
  console.log('🎯 Inicializando módulo de relleno mejorado...');
  
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

console.log('✅ refill-enhanced.js cargado correctamente');

window.searchProductForRefill = searchProductForRefill;
window.processRefillMovement = processRefillMovement;
window.guardarProductoDelModal = guardarProductoDelModal;
window.cerrarModalCrearProducto = cerrarModalCrearProducto;