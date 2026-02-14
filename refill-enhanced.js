// ============================================================
// Águila Inventario Pro - Módulo: refill.js
// VERSIÓN HÍBRIDA (ENTRADA / SALIDA)
// Copyright © 2025 José A. G. Betancourt
//
// PRINCIPIOS OPERATIVOS:
// - MODO SALIDA: Rapidez para rellenar estantes desde almacén (descontar stock).
// - MODO ENTRADA: Facilidad para añadir nuevo stock al inventario (aumentar stock).
// ============================================================

let userDeterminanteRefill = null;
let currentRefillProduct = null;
let todayRefillCount = 0;
let todayPiecesCount = 0;
let refillMode = 'exit'; // 'exit' (salida) or 'entry' (entrada)

console.log('🔄 Módulo de relleno HÍBRIDO iniciando...');

// ============================================================
// GESTIÓN DE MODO (ENTRADA/SALIDA)
// ============================================================
function setRefillMode(mode) {
  refillMode = mode;
  console.log(`📂 Modo de relleno cambiado a: ${mode}`);

  const btnEntry = document.getElementById('btn-refill-mode-entry');
  const btnExit = document.getElementById('btn-refill-mode-exit');
  const expiryGroup = document.getElementById('refill-expiry-date-group');
  const warehouseInput = document.getElementById('refill-warehouse');
  const boxesLabel = document.getElementById('refill-boxes-label');
  const submitBtn = document.querySelector('#refill-form button[type="submit"]');

  if (mode === 'entry') {
    // --- MODO ENTRADA ---
    btnEntry.classList.replace('secondary', 'primary');
    btnEntry.style.opacity = 1;
    btnExit.classList.replace('primary', 'secondary');
    btnExit.style.opacity = 0.6;

    expiryGroup.style.display = 'block';
    warehouseInput.readOnly = false;
    warehouseInput.style.background = '#fff';
    boxesLabel.textContent = 'Cantidad de Cajas a AÑADIR';
    submitBtn.textContent = '➕ Registrar Entrada de Stock';
    submitBtn.classList.replace('primary', 'success');


  } else {
    // --- MODO SALIDA (DEFAULT) ---
    btnExit.classList.replace('secondary', 'primary');
    btnExit.style.opacity = 1;
    btnEntry.classList.replace('primary', 'secondary');
    btnEntry.style.opacity = 0.6;

    expiryGroup.style.display = 'none';
    warehouseInput.readOnly = true;
    warehouseInput.style.background = '#f8fafc';
    boxesLabel.textContent = 'Cantidad de Cajas a MOVER';
    submitBtn.textContent = '✅ Registrar Movimiento';
    submitBtn.classList.replace('success', 'primary');
  }

  // Re-evaluar el producto actual con el nuevo modo
  if (currentRefillProduct) {
    searchProductForRefill(currentRefillProduct.codigoBarras);
  }
}


// ============================================================
// OBTENER DETERMINANTE DEL USUARIO
// ============================================================
async function getUserDeterminanteRefill() {
  const userId = firebase.auth().currentUser?.uid;
  if (!userId) {
    console.error('❌ Usuario no autenticado');
    return null;
  }
  try {
    const snapshot = await firebase.database().ref('usuarios/' + userId).once('value');
    const userData = snapshot.val();
    const determinante = userData?.determinante || null;
    if (determinante) {
      console.log('🔑 Determinante obtenido:', determinante);
      userDeterminanteRefill = determinante;
    } else {
      console.error('❌ Determinante no encontrado para usuario:', userId);
    }
    return determinante;
  } catch (error) {
    console.error('❌ Error obteniendo determinante:', error);
    return null;
  }
}

// ============================================================
// BUSCAR PRODUCTO (ADAPTADO AL MODO)
// ============================================================
async function searchProductForRefill(barcode) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🔍 [${refillMode.toUpperCase()}] Buscando producto:`, barcode);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (!barcode || barcode.trim().length < 8) {
    showToast('⚠️ Código inválido (mínimo 8 dígitos)', 'warning');
    return;
  }

  if (!userDeterminanteRefill) {
    await getUserDeterminanteRefill();
  }
  if (!userDeterminanteRefill) {
    showToast('❌ Error: No se encontró información de la tienda', 'error');
    return;
  }

  try {
    const snapshot = await firebase.database()
      .ref('inventario/' + userDeterminanteRefill)
      .orderByChild('codigoBarras')
      .equalTo(barcode.trim())
      .once('value');

    if (snapshot.exists()) {
      console.log('✅ Producto encontrado en inventario');
      const productos = snapshot.val();
      const registros = Object.keys(productos).map(id => ({ id: id, ...productos[id] }));

      let totalCajas = 0;
      const primeraReferencia = registros[0];
      registros.forEach(reg => {
        totalCajas += parseInt(reg.cajas) || 0;
      });

      console.log(`✅ STOCK TOTAL OPERATIVO: ${totalCajas} cajas`);

      currentRefillProduct = {
        codigoBarras: primeraReferencia.codigoBarras,
        nombre: primeraReferencia.nombre,
        marca: primeraReferencia.marca || 'Otra',
        piezasPorCaja: parseInt(primeraReferencia.piezasPorCaja) || 0,
        totalCajas: totalCajas,
        registros: registros,
        existe: true
      };

      document.getElementById('refill-nombre').value = currentRefillProduct.nombre;
      document.getElementById('refill-marca').value = currentRefillProduct.marca;
      document.getElementById('refill-piezas').value = currentRefillProduct.piezasPorCaja;
      // Para modo entrada, la bodega no debe autocompletarse para forzar al usuario a poner la nueva ubicación
      if (refillMode === 'exit') {
        document.getElementById('refill-warehouse').value = primeraReferencia.ubicacion || '';
      }

      const infoDiv = document.getElementById('refill-product-info');
      infoDiv.style.display = 'block';
      const stockColor = totalCajas === 0 ? '#f59e0b' : '#10b981';
      const stockBg = totalCajas === 0 ? '#fef3c7' : '#d1fae5';
      const stockIcon = refillMode === 'entry' ? '📥' : (totalCajas === 0 ? '⚠️' : '✅');
      const stockMsg = refillMode === 'entry' ? `Añadirás stock a las ${totalCajas} cajas existentes.` : (totalCajas === 0 ? 'Stock agotado - Relleno no posible' : `${totalCajas} cajas disponibles`);

      infoDiv.innerHTML = `
        <div style="padding:16px;background:${stockBg};border-left:4px solid ${stockColor};border-radius:8px;margin:16px 0;">
          <div style="font-size:16px;font-weight:700;color:${stockColor === '#10b981' ? '#065f46' : '#92400e'};margin-bottom:8px;">
            ${stockIcon} ${currentRefillProduct.nombre}
          </div>
          <div style="color:${stockColor === '#10b981' ? '#047857' : '#b45309'};font-size:14px;margin-bottom:4px;">
            📦 <strong>${stockMsg}</strong>
          </div>
        </div>
      `;

      showToast(`✅ ${currentRefillProduct.nombre} - ${totalCajas} cajas en sistema`, 'success');
      document.getElementById('refill-boxes').focus();

    } else {
      console.log('🆕 Producto NO encontrado - Permitiendo creación rápida');
      currentRefillProduct = {
        codigoBarras: barcode.trim(),
        existe: false
      };

      // En modo salida, un producto no existente no puede ser rellenado.
      if (refillMode === 'exit') {
        showToast('❌ Producto no existe. No se puede hacer una salida. Cambia a modo "Entrada" para agregarlo.', 'error');
        limpiarFormularioRefill();
        return;
      }

      // En modo entrada, se permite la creación
      document.getElementById('refill-nombre').readOnly = false;
      document.getElementById('refill-nombre').style.background = '#fff';
      document.getElementById('refill-marca').disabled = false;
      document.getElementById('refill-piezas').readOnly = false;
      document.getElementById('refill-piezas').style.background = '#fff';
      document.getElementById('refill-warehouse').readOnly = false;
      document.getElementById('refill-warehouse').style.background = '#fff';

      showToast('🆕 Producto nuevo. Completa los datos para la ENTRADA.', 'info');
      document.getElementById('refill-nombre').focus();
    }
  } catch (error) {
    console.error('❌ Error buscando producto:', error);
    showToast('❌ Error al buscar: ' + error.message, 'error');
    limpiarFormularioRefill();
  }
}

// ============================================================
// MANEJADOR PRINCIPAL DE SUBMIT
// ============================================================
async function handleRefillSubmit(event) {
  event.preventDefault();
  if (refillMode === 'entry') {
    await handleRefillEntry();
  } else {
    await handleRefillExit();
  }
}

// ============================================================
// LÓGICA DE ENTRADA DE STOCK
// ============================================================
async function handleRefillEntry() {
  console.log('📥 [ENTRADA] Procesando entrada de stock...');

  if (!currentRefillProduct) {
    showToast('⚠️ Primero escanea un producto', 'warning');
    return;
  }

  const cajasAAgregar = parseInt(document.getElementById('refill-boxes').value);
  if (isNaN(cajasAAgregar) || cajasAAgregar <= 0) {
    showToast('❌ Ingresa una cantidad de cajas válida', 'error');
    return;
  }

  const newProductData = {
    codigoBarras: currentRefillProduct.codigoBarras,
    nombre: document.getElementById('refill-nombre').value.trim(),
    marca: document.getElementById('refill-marca').value,
    piezasPorCaja: parseInt(document.getElementById('refill-piezas').value),
    ubicacion: document.getElementById('refill-warehouse').value.trim(),
    fechaCaducidad: document.getElementById('refill-expiry-date').value,
    cajas: cajasAAgregar,
    fechaActualizacion: getLocalISOString(),
    actualizadoPor: firebase.auth().currentUser.email,
  };

  if (!newProductData.nombre || !newProductData.marca || !newProductData.piezasPorCaja || !newProductData.ubicacion || !newProductData.fechaCaducidad) {
    showToast('❌ Completa todos los campos para la entrada de stock', 'error');
    return;
  }

  try {
    // Registrar el nuevo lote en el inventario
    await firebase.database().ref('inventario/' + userDeterminanteRefill).push(newProductData);

    // Registrar el movimiento de entrada
    const movimientoData = {
      tipo: 'entrada',
      productoNombre: newProductData.nombre,
      productoCodigo: newProductData.codigoBarras,
      marca: newProductData.marca, // Añadido el campo marca
      cajasMovidas: newProductData.cajas,
      piezasMovidas: newProductData.cajas * newProductData.piezasPorCaja,
      fecha: getLocalISOString(),
      realizadoPor: newProductData.actualizadoPor,
      motivo: 'Recepción de mercancía',
    };
    await firebase.database().ref('movimientos/' + userDeterminanteRefill).push(movimientoData);

    showToast(`📥 ${newProductData.cajas} cajas de ${newProductData.nombre} añadidas!`, 'success');
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    limpiarFormularioRefill();
    document.getElementById('refill-barcode').focus();

  } catch (error) {
    console.error('❌ Error registrando entrada:', error);
    showToast('❌ Error: ' + error.message, 'error');
  }
}

// ============================================================
// LÓGICA DE SALIDA DE STOCK (LÓGICA ORIGINAL MEJORADA)
// ============================================================
async function handleRefillExit() {
  console.log('📤 [SALIDA] Procesando movimiento de relleno...');

  if (!currentRefillProduct || !currentRefillProduct.existe) {
    showToast('⚠️ Escanea un producto existente para hacer una salida', 'warning');
    return;
  }

  const cajasAMover = parseInt(document.getElementById('refill-boxes').value);
  if (isNaN(cajasAMover) || cajasAMover <= 0) {
    showToast('❌ Ingresa una cantidad de cajas válida', 'error');
    return;
  }

  // MODIFICACIÓN CRÍTICA: Permitir inventario negativo.
  // Se elimina el bloqueo de 'stock insuficiente' para adaptarse al flujo de trabajo real del promotor.
  // El promotor rellena desde stock físico no registrado y la auditoría corrige después.
  if (cajasAMover > currentRefillProduct.totalCajas) {
    showToast(`⚠️ Atención: El stock quedará en negativo (${currentRefillProduct.totalCajas - cajasAMover} cajas).`, 'warning', 4000);
  }

  try {
    const updates = {};
    const timestamp = getLocalISOString();
    const usuario = firebase.auth().currentUser.email;
    let cajasRestantes = cajasAMover;

    const lotesOrdenados = currentRefillProduct.registros.sort((a, b) => new Date(a.fechaCaducidad || '2099-12-31') - new Date(b.fechaCaducidad || '2099-12-31'));

    for (const lote of lotesOrdenados) {
      if (cajasRestantes <= 0) break;
      const cajasEnLote = parseInt(lote.cajas) || 0;
      if (cajasEnLote === 0) continue;

      const cajasADescontar = Math.min(cajasRestantes, cajasEnLote);
      const nuevasCajas = cajasEnLote - cajasADescontar;

      updates[`inventario/${userDeterminanteRefill}/${lote.id}/cajas`] = nuevasCajas;
      updates[`inventario/${userDeterminanteRefill}/${lote.id}/fechaActualizacion`] = timestamp;
      updates[`inventario/${userDeterminanteRefill}/${lote.id}/actualizadoPor`] = usuario;

      cajasRestantes -= cajasADescontar;
    }

    // Si aún quedan cajas por mover (el stock del sistema era menor al movido),
    // se le resta al primer lote, llevándolo a negativo.
    if (cajasRestantes > 0) {
      const primerLoteId = lotesOrdenados[0].id;
      const cajasActualesPrimerLote = parseInt(lotesOrdenados[0].cajas) || 0;
      // La lógica anterior ya puso los lotes existentes a 0 o menos, pero para asegurar,
      // tomamos el valor del primer lote y le restamos lo que falta.
      // El total ya habrá sido descontado, aquí forzamos el negativo en el primer lote disponible.
      const idDelLoteARestar = lotesOrdenados[0].id;
      const stockFinalNegativo = (await firebase.database().ref(`inventario/${userDeterminanteRefill}/${idDelLoteARestar}/cajas`).once('value')).val() - cajasRestantes;
      updates[`inventario/${userDeterminanteRefill}/${idDelLoteARestar}/cajas`] = stockFinalNegativo;
    }


    const piezasMovidas = cajasAMover * currentRefillProduct.piezasPorCaja;
    const movimientoData = {
      tipo: 'salida',
      productoNombre: currentRefillProduct.nombre,
      productoCodigo: currentRefillProduct.codigoBarras,
      marca: currentRefillProduct.marca, // Añadido el campo marca
      cajasMovidas: cajasAMover,
      piezasMovidas: piezasMovidas,
      stockAnterior: currentRefillProduct.totalCajas,
      stockNuevo: currentRefillProduct.totalCajas - cajasAMover,
      fecha: timestamp,
      realizadoPor: usuario,
      motivo: 'Relleno de exhibidor',
    };
    updates[`movimientos/${userDeterminanteRefill}/${Date.now()}`] = movimientoData;

    await firebase.database().ref().update(updates);

    todayRefillCount += cajasAMover;
    todayPiecesCount += piezasMovidas;
    updateTodayMovementsUI();

    showToast(`📤 ${cajasAMover} cajas de ${currentRefillProduct.nombre} movidas`, 'success');
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    limpiarFormularioRefill();
    document.getElementById('refill-barcode').focus();

  } catch (error) {
    console.error('❌ Error registrando movimiento:', error);
    showToast('❌ Error: ' + error.message, 'error');
  }
}

// ============================================================
// LIMPIAR FORMULARIO
// ============================================================
function limpiarFormularioRefill() {
  console.log('🧹 Limpiando formulario de relleno');
  document.getElementById('refill-form').reset();

  // Restaurar campos a su estado por defecto (readonly, etc.)
  ['refill-nombre', 'refill-piezas'].forEach(id => {
    const el = document.getElementById(id);
    el.readOnly = true;
    el.style.background = '#f8fafc';
  });
  document.getElementById('refill-marca').disabled = true;
  document.getElementById('refill-warehouse').readOnly = true;
  document.getElementById('refill-warehouse').style.background = '#f8fafc';
  document.getElementById('refill-expiry-date-group').style.display = 'none';

  document.getElementById('refill-product-info').style.display = 'none';
  currentRefillProduct = null;

  // Asegurarse de que el modo por defecto (salida) esté visualmente activo
  setRefillMode('exit');
}

// ============================================================
// ACTUALIZAR CONTADORES UI
// ============================================================
function updateTodayMovementsUI() {
  const counterElement = document.getElementById('total-movements');
  if (counterElement) {
    counterElement.innerHTML = `
          <div style="font-size:24px;font-weight:700;color:#10b981;">${todayRefillCount}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:4px;">cajas movidas hoy</div>
          <div style="font-size:14px;font-weight:600;color:#059669;margin-top:8px;">${todayPiecesCount} piezas</div>
        `;
  }
}

// ============================================================
// CARGAR MOVIMIENTOS DEL DÍA
// ============================================================
async function loadTodayMovements() {
  if (!userDeterminanteRefill) await getUserDeterminanteRefill();
  if (!userDeterminanteRefill) return;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const movRef = firebase.database().ref('movimientos/' + userDeterminanteRefill).orderByChild('fecha').startAt(getLocalDayStart(hoy));

  movRef.on('value', (snapshot) => {
    if (snapshot.exists()) {
      const movimientos = Object.values(snapshot.val()).filter(m => m.tipo === 'salida');
      todayRefillCount = movimientos.reduce((sum, m) => sum + (m.cajasMovidas || 0), 0);
      todayPiecesCount = movimientos.reduce((sum, m) => sum + (m.piezasMovidas || 0), 0);
    } else {
      todayRefillCount = 0;
      todayPiecesCount = 0;
    }
    updateTodayMovementsUI();
  });
}

// ============================================================
// INICIALIZACIÓN
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Inicializando módulo de relleno HÍBRIDO...');

  // Configurar listeners de modo
  document.getElementById('btn-refill-mode-exit').addEventListener('click', () => setRefillMode('exit'));
  document.getElementById('btn-refill-mode-entry').addEventListener('click', () => setRefillMode('entry'));

  // Formulario submit
  document.getElementById('refill-form').addEventListener('submit', handleRefillSubmit);

  // Enter en barcode
  document.getElementById('refill-barcode').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      searchProductForRefill(e.target.value);
    }
  });

  // Cargar datos iniciales
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      loadTodayMovements();
    }
  });

  // Estado inicial UI
  setRefillMode('exit');
  console.log('✅ Módulo de relleno HÍBRIDO listo.');
});

console.log('✅ refill-enhanced.js (HÍBRIDO) cargado correctamente');