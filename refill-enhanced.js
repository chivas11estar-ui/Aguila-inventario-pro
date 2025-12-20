// ============================================================
// Águila Inventario Pro - Módulo: refill-enhanced.js
// Fase 1 – Estabilización
// Copyright © 2025 José A. G. Betancourt
// Relleno inteligente con autofill y validación de stock real
// ============================================================

let currentRefillProduct = null; // ✅ FUENTE ÚNICA DE VERDAD
let userDeterminanteRefill = null;
let todayMovementsCount = 0;

// ============================================================
// OBTENER DETERMINANTE
// ============================================================
async function getUserDeterminanteRefill() {
  const userId = firebase.auth().currentUser?.uid;
  if (!userId) return null;

  try {
    const snapshot = await firebase.database().ref('usuarios/' + userId).once('value');
    const userData = snapshot.val();
    return userData?.determinante || null;
  } catch (error) {
    console.error('Error obtener determinante:', error);
    return null;
  }
}

// ============================================================
// BUSCAR PRODUCTO PARA RELLENO
// ============================================================
async function searchProductForRefill(barcode) {
  if (!barcode || barcode.length < 8) {
    showToast('Código inválido (mínimo 8 dígitos)', 'warning');
    return;
  }

  console.log('🔍 Buscando producto para relleno:', barcode);

  if (!userDeterminanteRefill) {
    userDeterminanteRefill = await getUserDeterminanteRefill();
  }

  if (!userDeterminanteRefill) {
    showToast('Error: No se encontró información de la tienda', 'error');
    return;
  }

  try {
    const snapshot = await firebase.database()
      .ref('inventario/' + userDeterminanteRefill)
      .orderByChild('codigoBarras')
      .equalTo(barcode)
      .once('value');

    if (snapshot.exists()) {
      const products = snapshot.val();
      
      // ✅ TOMAR EL PRIMER PRODUCTO ENCONTRADO
      const productId = Object.keys(products)[0];
      const productData = products[productId];

      console.log('✅ Producto encontrado:', productData.nombre);
      console.log('📦 Stock actual en Firebase:', productData.cajas);

      // ✅ ASIGNAR CORRECTAMENTE EL STOCK REAL
      currentRefillProduct = {
        id: productId,
        nombre: productData.nombre,
        marca: productData.marca,
        codigoBarras: productData.codigoBarras,
        piezasPorCaja: productData.piezasPorCaja,
        ubicacion: productData.ubicacion,
        cajas: productData.cajas || 0  // ✅ Stock real de Firebase
      };

      console.log('✅ Producto cargado con stock:', currentRefillProduct.cajas);

      // AUTOFILL DE CAMPOS
      document.getElementById('refill-nombre').value = currentRefillProduct.nombre;
      document.getElementById('refill-marca').value = currentRefillProduct.marca;
      document.getElementById('refill-piezas').value = currentRefillProduct.piezasPorCaja;
      document.getElementById('refill-warehouse').value = currentRefillProduct.ubicacion;

      // ✅ MOSTRAR STOCK REAL DEL SISTEMA
      const infoDiv = document.getElementById('refill-product-info');
      if (infoDiv) {
        infoDiv.style.display = 'block';
        document.getElementById('refill-product-name').innerHTML = 
          `<strong>📦 ${currentRefillProduct.nombre}</strong>`;
        document.getElementById('refill-current-stock').innerHTML = 
          `📊 Stock disponible: <strong>${currentRefillProduct.cajas} cajas</strong> (${currentRefillProduct.cajas * currentRefillProduct.piezasPorCaja} piezas)`;
      }

      showToast('✅ Producto encontrado: ' + currentRefillProduct.nombre, 'success');
      document.getElementById('refill-boxes').focus();

    } else {
      console.warn('⚠️ Producto no encontrado:', barcode);
      showToast('⚠️ Producto no registrado. Agrégalo primero.', 'warning');
      clearRefillForm();
    }
  } catch (error) {
    console.error('❌ Error al buscar producto:', error);
    showToast('Error: ' + error.message, 'error');
    clearRefillForm();
  }
}

// ============================================================
// REGISTRAR MOVIMIENTO DE RELLENO
// ============================================================
async function registerRefillMovement(event) {
  if (event) event.preventDefault();

  // VALIDACIÓN 1: Producto seleccionado
  if (!currentRefillProduct || !currentRefillProduct.id) {
    showToast('⚠️ Primero escanea un producto', 'warning');
    document.getElementById('refill-barcode').focus();
    return false;
  }

  const boxesInput = document.getElementById('refill-boxes');
  const boxesToMove = parseInt(boxesInput.value);

  // VALIDACIÓN 2: Cantidad válida
  if (isNaN(boxesToMove) || boxesToMove <= 0) {
    showToast('Ingresa una cantidad válida (mayor a 0)', 'error');
    boxesInput.focus();
    return false;
  }

  // ✅ VALIDACIÓN 3: Stock suficiente (usar el stock real de currentRefillProduct)
  const stockActual = currentRefillProduct.cajas;
  
  console.log('📊 Validando stock:');
  console.log('   - Stock disponible:', stockActual);
  console.log('   - Cajas a mover:', boxesToMove);

  if (boxesToMove > stockActual) {
    showToast(`❌ Stock insuficiente. Disponible: ${stockActual} cajas`, 'error');
    boxesInput.focus();
    return false;
  }

  if (!userDeterminanteRefill) {
    userDeterminanteRefill = await getUserDeterminanteRefill();
  }

  // ✅ CALCULAR NUEVO STOCK
  const nuevoStock = stockActual - boxesToMove;

  console.log('💾 Preparando movimiento:');
  console.log('   - Stock anterior:', stockActual);
  console.log('   - Cajas movidas:', boxesToMove);
  console.log('   - Stock nuevo:', nuevoStock);

  const movementData = {
    tipo: 'relleno',
    productoId: currentRefillProduct.id,
    productoNombre: currentRefillProduct.nombre,
    productoCodigo: currentRefillProduct.codigoBarras,
    marca: currentRefillProduct.marca,
    cajasMovidas: boxesToMove,
    stockAnterior: stockActual,
    stockNuevo: nuevoStock,
    ubicacion: currentRefillProduct.ubicacion,
    fecha: new Date().toISOString(),
    realizadoPor: firebase.auth().currentUser.email
  };

  try {
    // 1. REGISTRAR MOVIMIENTO
    await firebase.database()
      .ref('movimientos/' + userDeterminanteRefill)
      .push(movementData);

    // 2. ACTUALIZAR STOCK EN INVENTARIO
    await firebase.database()
      .ref('inventario/' + userDeterminanteRefill + '/' + currentRefillProduct.id)
      .update({
        cajas: nuevoStock,
        fechaActualizacion: new Date().toISOString(),
        actualizadoPor: firebase.auth().currentUser.email
      });

    console.log('✅ Movimiento registrado exitosamente');

    // 3. ACTUALIZAR CONTADOR DE MOVIMIENTOS
    todayMovementsCount += boxesToMove;
    updateMovementsCounter();

    // 4. FEEDBACK VISUAL
    showSuccessAnimation();
    playBeepSound();
    
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }

    showToast(`✅ ${boxesToMove} cajas movidas de ${currentRefillProduct.nombre}`, 'success');

    // 5. LIMPIAR FORMULARIO
    clearRefillForm();
    document.getElementById('refill-barcode').focus();

    return true;
  } catch (error) {
    console.error('❌ Error al registrar movimiento:', error);
    showToast('Error: ' + error.message, 'error');
    return false;
  }
}

// ============================================================
// LIMPIAR FORMULARIO
// ============================================================
function clearRefillForm() {
  document.getElementById('refill-barcode').value = '';
  document.getElementById('refill-nombre').value = '';
  document.getElementById('refill-marca').value = '';
  document.getElementById('refill-piezas').value = '';
  document.getElementById('refill-warehouse').value = '';
  document.getElementById('refill-boxes').value = '';

  const infoDiv = document.getElementById('refill-product-info');
  if (infoDiv) {
    infoDiv.style.display = 'none';
  }

  currentRefillProduct = null;
  console.log('🧹 Formulario limpiado');
}

// ============================================================
// ACTUALIZAR CONTADOR DE MOVIMIENTOS
// ============================================================
function updateMovementsCounter() {
  const counter = document.getElementById('total-movements');
  if (counter) {
    counter.textContent = todayMovementsCount;
  }
}

// ============================================================
// ANIMACIÓN DE ÉXITO
// ============================================================
function showSuccessAnimation() {
  const checkmark = document.createElement('div');
  checkmark.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 100px;
    z-index: 2000;
    pointer-events: none;
    animation: successPop 0.6s ease-out forwards;
  `;
  checkmark.innerHTML = '✅';

  document.body.appendChild(checkmark);
  setTimeout(() => checkmark.remove(), 600);
}

// ============================================================
// SONIDO DE CONFIRMACIÓN
// ============================================================
function playBeepSound() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 600;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.15);
  } catch (e) {
    // Si falla, continuar sin sonido
  }
}

// ============================================================
// CARGAR MOVIMIENTOS DEL DÍA
// ============================================================
async function loadTodayMovements() {
  if (!userDeterminanteRefill) {
    userDeterminanteRefill = await getUserDeterminanteRefill();
  }

  if (!userDeterminanteRefill) return;

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const snapshot = await firebase.database()
      .ref('movimientos/' + userDeterminanteRefill)
      .orderByChild('fecha')
      .startAt(today.toISOString())
      .once('value');

    if (snapshot.exists()) {
      const movements = snapshot.val();
      todayMovementsCount = Object.values(movements)
        .filter(m => m.tipo === 'relleno')
        .reduce((sum, m) => sum + (m.cajasMovidas || 0), 0);

      updateMovementsCounter();
      console.log('📊 Movimientos de hoy cargados:', todayMovementsCount);
    }
  } catch (error) {
    console.error('Error al cargar movimientos del día:', error);
  }
}

// ============================================================
// ANIMACIÓN CSS
// ============================================================
const style = document.createElement('style');
style.textContent = `
  @keyframes successPop {
    0% {
      transform: translate(-50%, -50%) scale(0);
      opacity: 0;
    }
    50% {
      transform: translate(-50%, -50%) scale(1.2);
      opacity: 1;
    }
    100% {
      transform: translate(-50%, -50%) scale(1);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// ============================================================
// INICIALIZACIÓN
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
  console.log('🔄 Inicializando módulo de relleno...');

  const refillForm = document.getElementById('refill-form');
  if (refillForm) {
    refillForm.addEventListener('submit', registerRefillMovement);
    console.log('✅ Formulario de relleno configurado');
  }

  // Cargar movimientos del día
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      loadTodayMovements();
    }
  });

  console.log('✅ Módulo de relleno iniciado');
});

// ============================================================
// EXPONER FUNCIONES GLOBALES
// ============================================================
window.searchProductForRefill = searchProductForRefill;
window.registerRefillMovement = registerRefillMovement;
window.clearRefillForm = clearRefillForm;

console.log('✅ refill-enhanced.js (Fase 1 - Corregido) cargado correctamente');