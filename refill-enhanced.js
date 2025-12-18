// ============================================================
// Águila Inventario Pro - Módulo: refill-enhanced.js
// VERSIÓN: GOLD (Validación en tiempo real + Sin Bloqueos)
// ============================================================

let currentRefillProduct = null;
let userDeterminanteRefill = null;
let isCreatingNewProduct = false;

// 🔑 VARIABLES PARA CONTROL DE LISTENERS
let refillListener = null;
let refillPath = null;

// ============================================================
// 1. GESTIÓN DE LISTENERS (Evita fugas de memoria)
// ============================================================
function stopRefillListeners() {
  console.log('🛑 [Refill] Deteniendo listeners...');
  
  if (refillListener && refillPath) {
    try {
      firebase.database().ref(refillPath).off('value', refillListener);
      console.log('✅ [Refill] Listener detenido.');
    } catch (error) {
      console.warn('⚠️ Error deteniendo listener:', error);
    }
  }
  
  refillListener = null;
  refillPath = null;
  currentRefillProduct = null;
  isCreatingNewProduct = false;
}

// Integración con el sistema global de limpieza
if (typeof window.stopAllListeners === 'function') {
  const originalStop = window.stopAllListeners;
  window.stopAllListeners = function() {
    originalStop();
    stopRefillListeners();
  };
} else {
  window.stopAllListeners = function() {
    stopRefillListeners();
  };
}

// ============================================================
// 2. UTILIDADES DE USUARIO
// ============================================================
async function getUserDeterminanteRefill() {
  const userId = firebase.auth().currentUser?.uid;
  if (!userId) return null;
  
  try {
    // Intentamos leer de caché local si existe para velocidad
    const cached = localStorage.getItem('aguila_user_det');
    if (cached) return cached;

    const snapshot = await firebase.database().ref('usuarios/' + userId).once('value');
    const userData = snapshot.val();
    const det = userData?.determinante || null;
    
    if (det) localStorage.setItem('aguila_user_det', det);
    return det;
  } catch (error) {
    console.error('❌ Error determinante:', error);
    return null;
  }
}

// ============================================================
// 3. BUSCADOR DE PRODUCTO
// ============================================================
async function searchProductForRefill(barcode) {
  console.log('🔍 [Refill] Buscando:', barcode);
  
  if (!barcode || barcode.length < 3) {
    showToast('⚠️ Código inválido', 'warning');
    return false;
  }
  
  stopRefillListeners(); // Limpiar búsqueda anterior
  
  if (!userDeterminanteRefill) {
    userDeterminanteRefill = await getUserDeterminanteRefill();
  }
  
  if (!userDeterminanteRefill) {
    showToast('❌ Error: No se identifica la tienda (determinante)', 'error');
    return false;
  }
  
  const inventoryRef = firebase.database().ref('inventario/' + userDeterminanteRefill);
  
  try {
    // Búsqueda exacta
    const snapshot = await inventoryRef.orderByChild('codigoBarras').equalTo(barcode).once('value');
    
    if (snapshot.exists()) {
      const products = snapshot.val();
      const productId = Object.keys(products)[0];
      const productData = products[productId];
      
      currentRefillProduct = {
        id: productId,
        ...productData
      };
      
      isCreatingNewProduct = false;
      
      // Llenar UI (Campos de solo lectura)
      fillRefillUI(productData);
      
      // Iniciar escucha en tiempo real para este producto
      startProductListener(productId);
      
      showToast('✅ Producto listo para rellenar', 'success');
      setTimeout(() => document.getElementById('refill-boxes')?.focus(), 300);
      return true;
      
    } else {
      console.log('⚠️ Producto no existe. Iniciando flujo de creación.');
      mostrarModalCrearProducto(barcode);
      return false;
    }
  } catch (error) {
    console.error('❌ Error búsqueda:', error);
    showToast('Error de conexión: ' + error.message, 'error');
    return false;
  }
}

function fillRefillUI(data) {
  const ids = {
    nombre: 'refill-nombre',
    marca: 'refill-marca',
    piezas: 'refill-piezas',
    warehouse: 'refill-warehouse'
  };

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) {
      el.value = val || '';
      el.readOnly = true;
      el.style.background = '#ecfdf5'; // Verde suave
      el.style.borderColor = '#d1d5db';
    }
  };

  setVal(ids.nombre, data.nombre);
  setVal(ids.marca, data.marca);
  setVal(ids.piezas, data.piezasPorCaja);
  setVal(ids.warehouse, data.ubicacion);
  
  displayRefillProductInfo(currentRefillProduct);
}

// ============================================================
// 4. LISTENER EN TIEMPO REAL (Live Updates)
// ============================================================
function startProductListener(productId) {
  if (!userDeterminanteRefill) return;
  refillPath = 'inventario/' + userDeterminanteRefill + '/' + productId;
  
  refillListener = (snapshot) => {
    const productData = snapshot.val();
    if (productData && currentRefillProduct) {
      currentRefillProduct.cajas = productData.cajas; // Mantener sync
      const stockEl = document.getElementById('refill-current-stock');
      if (stockEl) {
        // ParseInt asegura que se muestre como número
        const stock = parseInt(productData.cajas) || 0;
        stockEl.textContent = `Stock actual: ${stock} cajas`;
        
        // Cambio visual si es 0 o negativo
        stockEl.style.color = stock <= 0 ? '#ef4444' : '#10b981';
      }
    }
  };
  
  // Ignoramos errores de permisos al cerrar sesión
  const errHandler = (err) => {
    if (firebase.auth().currentUser) console.warn('Listener error:', err);
  };
  
  firebase.database().ref(refillPath).on('value', refillListener, errHandler);
}

// ============================================================
// 5. PROCESAR MOVIMIENTO (Lógica Blindada)
// ============================================================
async function processRefillMovement(boxesInput) {
  // 1. Validaciones básicas
  if (!currentRefillProduct) {
    showToast('⚠️ Primero escanea o busca un producto', 'warning');
    return;
  }
  
  const boxesToMove = parseInt(boxesInput);
  if (isNaN(boxesToMove) || boxesToMove <= 0) {
    showToast('❌ Ingresa una cantidad válida', 'error');
    return;
  }

  if (!userDeterminanteRefill) userDeterminanteRefill = await getUserDeterminanteRefill();

  // 2. OBTENER STOCK REAL "EN VIVO" (Sin confiar en caché)
  // Esto soluciona el problema de "dice 0 pero hay 3"
  let realStock = 0;
  try {
    if (currentRefillProduct.id) {
      const freshSnap = await firebase.database()
        .ref(`inventario/${userDeterminanteRefill}/${currentRefillProduct.id}/cajas`)
        .once('value');
      realStock = parseInt(freshSnap.val()) || 0;
    }
  } catch (e) {
    console.warn('No se pudo verificar stock en vivo, usando local');
    realStock = parseInt(currentRefillProduct.cajas) || 0;
  }

  // 3. VALIDACIÓN HÍBRIDA (La parte inteligente)
  if (currentRefillProduct.id && boxesToMove > realStock) {
    // Usamos confirm nativo del navegador para bloquear la ejecución hasta que responda
    const aceptar = confirm(
      `⚠️ ADVERTENCIA DE STOCK\n\n` +
      `• Stock en sistema: ${realStock}\n` +
      `• Quieres rellenar: ${boxesToMove}\n\n` +
      `El inventario quedará en NEGATIVO (${realStock - boxesToMove}).\n` +
      `¿Confirmas que tienes el producto físico y quieres proceder?`
    );
    
    if (!aceptar) {
      showToast('❌ Operación cancelada', 'info');
      return; // Aquí se detiene si el usuario dice NO
    }
  }

  // 4. EJECUCIÓN DEL MOVIMIENTO
  const newStock = realStock - boxesToMove;
  
  const movementData = {
    tipo: 'relleno',
    productoId: currentRefillProduct.id || 'NUEVO',
    productoNombre: document.getElementById('refill-nombre').value,
    cajasMovidas: boxesToMove,
    stockAnterior: realStock,
    stockNuevo: newStock,
    fecha: new Date().toISOString(),
    realizadoPor: firebase.auth().currentUser.email
  };
  
  try {
    const updates = {};
    const refBase = `inventario/${userDeterminanteRefill}`;

    if (!currentRefillProduct.id) {
       // A) Crear Producto Nuevo
       const newRef = firebase.database().ref(refBase).push();
       const newId = newRef.key;
       
       updates[`${refBase}/${newId}`] = {
         codigoBarras: currentRefillProduct.codigoBarras,
         nombre: movementData.productoNombre,
         marca: document.getElementById('refill-marca').value || 'General',
         ubicacion: document.getElementById('refill-warehouse').value || 'Bodega',
         piezasPorCaja: parseInt(document.getElementById('refill-piezas').value) || 1,
         cajas: 0 - boxesToMove, // Nace debiendo
         fechaCreacion: new Date().toISOString()
       };
       movementData.productoId = newId;
    } else {
       // B) Actualizar Existente
       updates[`${refBase}/${currentRefillProduct.id}/cajas`] = newStock;
       updates[`${refBase}/${currentRefillProduct.id}/fechaActualizacion`] = new Date().toISOString();
    }
    
    // Ejecutar actualización atómica (Producto + Historial)
    await firebase.database().ref().update(updates);
    await firebase.database().ref(`movimientos/${userDeterminanteRefill}`).push(movementData);
    
    showToast(`✅ Relleno exitoso (-${boxesToMove} cajas)`, 'success');
    
    // 5. LIMPIEZA POST-OPERACIÓN
    stopRefillListeners();
    document.getElementById('refill-form').reset();
    document.getElementById('refill-product-info').style.display = 'none';
    document.getElementById('refill-barcode').focus();
    updateTodayMovements(); // Actualizar contador visual
    
  } catch (error) {
    console.error('❌ Error crítico al guardar:', error);
    showToast('❌ Falló el guardado: ' + error.message, 'error');
  }
}

// ============================================================
// 6. FUNCIONES DE UI Y MODALES
// ============================================================
function displayRefillProductInfo(product) {
  const infoDiv = document.getElementById('refill-product-info');
  const nameEl = document.getElementById('refill-product-name');
  const stockEl = document.getElementById('refill-current-stock');
  
  if (infoDiv && nameEl) {
    nameEl.innerHTML = `<strong>Producto:</strong> ${product.nombre || 'Sin nombre'}`;
    if(stockEl) {
        const stock = parseInt(product.cajas) || 0;
        stockEl.textContent = `Stock actual: ${stock} cajas`;
    }
    infoDiv.style.display = 'block';
  }
}

function mostrarModalCrearProducto(barcode) {
  // Lógica simple para habilitar campos manuales
  if(confirm(`El producto ${barcode} no existe. ¿Quieres crearlo ahora?`)) {
      habilitarCamposManuales(barcode);
  }
}

function habilitarCamposManuales(barcode) {
  isCreatingNewProduct = true;
  const ids = ['refill-nombre', 'refill-marca', 'refill-piezas', 'refill-warehouse'];
  
  ids.forEach(id => {
    const el = document.getElementById(id);
    if(el) {
        el.readOnly = false;
        el.value = '';
        el.style.background = '#ffffff';
        el.style.borderColor = '#f59e0b'; // Naranja para indicar "nuevo"
    }
  });

  document.getElementById('refill-nombre')?.focus();
  currentRefillProduct = { id: null, codigoBarras: barcode, cajas: 0 };
  
  const infoDiv = document.getElementById('refill-product-info');
  infoDiv.style.display = 'block';
  document.getElementById('refill-product-name').innerHTML = `<span style="color:#f59e0b">📝 REGISTRANDO NUEVO: ${barcode}</span>`;
  document.getElementById('refill-current-stock').textContent = 'Stock inicial: 0';
}

async function updateTodayMovements() {
  // Pequeña función para mostrar conteo rápido
  if (!userDeterminanteRefill) return;
  const todayStart = new Date();
  todayStart.setHours(0,0,0,0);
  
  try {
      const snap = await firebase.database().ref(`movimientos/${userDeterminanteRefill}`)
        .orderByChild('fecha')
        .startAt(todayStart.toISOString())
        .once('value');
      
      const count = snap.numChildren();
      const el = document.getElementById('total-movements');
      if(el) el.textContent = `${count} movs. hoy`;
  } catch(e) {}
}

// ============================================================
// 7. INICIALIZACIÓN DEL MÓDULO
// ============================================================
function initRefillModule() {
  console.log('🚀 [Refill] Módulo inicializado (Modo Senior).');
  
  // Configurar listeners del formulario
  const form = document.getElementById('refill-form');
  if (form) {
      form.removeEventListener('submit', handleRefillSubmit); // Prevenir duplicados
      form.addEventListener('submit', handleRefillSubmit);
  }

  const barcodeInput = document.getElementById('refill-barcode');
  if (barcodeInput) {
      barcodeInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
              e.preventDefault();
              searchProductForRefill(e.target.value.trim());
          }
      });
  }

  // Verificar Auth
  firebase.auth().onAuthStateChanged((user) => {
    if (!user) stopRefillListeners();
    else setTimeout(updateTodayMovements, 1000);
  });
}

// Wrapper para el evento submit para mantener el código limpio
function handleRefillSubmit(e) {
    e.preventDefault();
    const boxes = document.getElementById('refill-boxes').value;
    processRefillMovement(boxes);
}

// Auto-arranque
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initRefillModule);
} else {
  initRefillModule();
}

// ============================================================
// 8. EXPOSICIÓN GLOBAL (Sin llaves extra)
// ============================================================
window.searchProductForRefill = searchProductForRefill;
window.processRefillMovement = processRefillMovement;
