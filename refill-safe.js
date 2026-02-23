// ============================================================
// Águila Inventario Pro - Módulo: refill-safe.js
// REFACTORIZACIÓN COMPLETA del módulo de relleno
// Copyright © 2025 José A. G. Betancourt
//
// CAMBIOS CRÍTICOS vs refill-enhanced.js:
// 1. NUNCA permite stock negativo (validación por transacción)
// 2. Relleno inteligente cuando stock === 0 (entrada_directa_anaquel)
// 3. Usa la nueva ruta productos/{det}/{codigo} de inventory-core.js
// 4. Muestra analytics cuando el producto está en 0
// ============================================================

'use strict';

let refillCurrentProduct = null;
let refillMode = 'exit'; // 'exit' (salida) o 'entry' (entrada)
let refillTodayCajas = 0;
let refillTodayPiezas = 0;

console.log('🔄 [REFILL-SAFE] Módulo de relleno seguro iniciando...');

// ============================================================
// GESTIÓN DE MODO (ENTRADA/SALIDA)
// ============================================================
function setRefillModeSafe(mode) {
  refillMode = mode;
  console.log(`📂 [REFILL-SAFE] Modo: ${mode}`);

  const btnEntry = document.getElementById('btn-refill-mode-entry');
  const btnExit = document.getElementById('btn-refill-mode-exit');
  const expiryGroup = document.getElementById('refill-expiry-date-group');
  const warehouseInput = document.getElementById('refill-warehouse');
  const boxesLabel = document.getElementById('refill-boxes-label');
  const submitBtn = document.querySelector('#refill-form button[type="submit"]');

  if (mode === 'entry') {
    btnEntry?.classList.replace('secondary', 'primary');
    if (btnEntry) btnEntry.style.opacity = 1;
    btnExit?.classList.replace('primary', 'secondary');
    if (btnExit) btnExit.style.opacity = 0.6;

    if (expiryGroup) expiryGroup.style.display = 'block';
    if (warehouseInput) {
      warehouseInput.readOnly = false;
      warehouseInput.style.background = '#fff';
    }
    if (boxesLabel) boxesLabel.textContent = 'Cantidad de Cajas a AÑADIR';
    if (submitBtn) {
      submitBtn.textContent = '➕ Registrar Entrada de Stock';
      submitBtn.classList.replace('primary', 'success');
    }
  } else {
    btnExit?.classList.replace('secondary', 'primary');
    if (btnExit) btnExit.style.opacity = 1;
    btnEntry?.classList.replace('primary', 'secondary');
    if (btnEntry) btnEntry.style.opacity = 0.6;

    if (expiryGroup) expiryGroup.style.display = 'none';
    if (warehouseInput) {
      warehouseInput.readOnly = true;
      warehouseInput.style.background = '#f8fafc';
    }
    if (boxesLabel) boxesLabel.textContent = 'Cantidad de Cajas a MOVER';
    if (submitBtn) {
      submitBtn.textContent = '✅ Registrar Movimiento';
      submitBtn.classList.replace('success', 'primary');
    }
  }

  // Re-evaluar producto si hay uno cargado
  if (refillCurrentProduct && refillCurrentProduct._exists) {
    renderRefillProductInfo();
  }
}

// ============================================================
// BUSCAR PRODUCTO PARA RELLENO
// ============================================================
async function searchProductForRefillSafe(barcode) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🔍 [REFILL-SAFE][${refillMode.toUpperCase()}] Buscando: ${barcode}`);

  if (!barcode || barcode.trim().length < 8) {
    showToast('⚠️ Código inválido (mínimo 8 dígitos)', 'warning');
    return;
  }

  try {
    // Usa la función de inventory-core.js — lectura O(1) por key
    const producto = await buscarProductoPorCodigo(barcode);

    if (!producto) {
      showToast('❌ Error al buscar el producto', 'error');
      return;
    }

    if (producto._exists) {
      console.log('✅ [REFILL-SAFE] Producto encontrado');
      refillCurrentProduct = producto;

      // Rellenar campos del formulario
      document.getElementById('refill-nombre').value = producto.nombre || '';
      document.getElementById('refill-marca').value = producto.marca || '';
      document.getElementById('refill-piezas').value = producto.piezasPorCaja || '';

      if (refillMode === 'exit') {
        document.getElementById('refill-warehouse').value = producto.ubicacion || '';
      }

      renderRefillProductInfo();
      document.getElementById('refill-boxes').focus();

    } else {
      // Producto no existe en el sistema
      refillCurrentProduct = producto; // tiene _exists: false y _ref

      if (refillMode === 'exit') {
        showToast('❌ Producto no existe. Cambia a modo "Entrada" para agregarlo.', 'error');
        limpiarFormularioRefillSafe();
        return;
      }

      // Modo entrada: permitir creación
      habilitarCamposCreacion();
      showToast('🆕 Producto nuevo. Completa los datos para la ENTRADA.', 'info');
      document.getElementById('refill-nombre').focus();
    }

  } catch (error) {
    console.error('❌ [REFILL-SAFE] Error buscando producto:', error);
    showToast('❌ Error al buscar: ' + error.message, 'error');
    limpiarFormularioRefillSafe();
  }
}

// ============================================================
// RENDERIZAR INFO DEL PRODUCTO (CON ANALYTICS SI ESTÁ EN 0)
// ============================================================
async function renderRefillProductInfo() {
  const infoDiv = document.getElementById('refill-product-info');
  if (!infoDiv || !refillCurrentProduct) return;

  infoDiv.style.display = 'block';
  const stock = parseInt(refillCurrentProduct.stockTotal) || 0;

  if (stock === 0) {
    // ── PRODUCTO EN 0: mostrar analytics enriquecidos ──
    const analytics = await consultarProductoEnCero(refillCurrentProduct.codigoBarras);

    const promedio = analytics ? analytics.promedioDiarioVenta : 0;
    const ultimoRelleno = analytics ? analytics.ultimoRelleno : 'Sin registro';
    const fechaFormateada = ultimoRelleno !== 'Sin registro'
      ? new Date(ultimoRelleno).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
      : 'Sin registro';

    if (refillMode === 'exit') {
      // En modo salida y stock 0 → mostrar alerta pero NO bloquear
      // porque el relleno inteligente convertirá esto en entrada_directa_anaquel
      infoDiv.innerHTML = `
        <div style="padding:16px;background:#fef3c7;border-left:4px solid #f59e0b;border-radius:8px;margin:16px 0;">
          <div style="font-size:16px;font-weight:700;color:#92400e;margin-bottom:8px;">
            ⚠️ ${refillCurrentProduct.nombre} — STOCK EN 0
          </div>
          <div style="color:#b45309;font-size:13px;margin-bottom:4px;">
            📊 Venta promedio: <strong>${promedio} piezas/día</strong>
          </div>
          <div style="color:#b45309;font-size:13px;margin-bottom:8px;">
            📅 Último relleno: <strong>${fechaFormateada}</strong>
          </div>
          <div style="background:#fff7ed;padding:10px;border-radius:6px;font-size:12px;color:#9a3412;border:1px dashed #fb923c;">
            💡 Si ingresas cajas, se registrarán como <strong>entrada directa a anaquel</strong>
            (mercancía que llegó y fue directo al estante).
          </div>
        </div>
      `;
    } else {
      // Modo entrada y stock 0
      infoDiv.innerHTML = `
        <div style="padding:16px;background:#dbeafe;border-left:4px solid #3b82f6;border-radius:8px;margin:16px 0;">
          <div style="font-size:16px;font-weight:700;color:#1e40af;margin-bottom:8px;">
            📥 ${refillCurrentProduct.nombre} — STOCK EN 0
          </div>
          <div style="color:#1d4ed8;font-size:13px;margin-bottom:4px;">
            📊 Venta promedio: <strong>${promedio} piezas/día</strong>
          </div>
          <div style="color:#1d4ed8;font-size:13px;">
            📅 Último relleno: <strong>${fechaFormateada}</strong>
          </div>
        </div>
      `;
    }
  } else {
    // ── PRODUCTO CON STOCK NORMAL ──
    const stockColor = '#10b981';
    const stockBg = '#d1fae5';
    const icon = refillMode === 'entry' ? '📥' : '✅';
    const msg = refillMode === 'entry'
      ? `Añadirás stock a las ${stock} cajas existentes.`
      : `${stock} cajas disponibles para mover`;

    infoDiv.innerHTML = `
      <div style="padding:16px;background:${stockBg};border-left:4px solid ${stockColor};border-radius:8px;margin:16px 0;">
        <div style="font-size:16px;font-weight:700;color:#065f46;margin-bottom:8px;">
          ${icon} ${refillCurrentProduct.nombre}
        </div>
        <div style="color:#047857;font-size:14px;">
          📦 <strong>${msg}</strong>
        </div>
      </div>
    `;
  }

  showToast(`${refillCurrentProduct.nombre} — ${stock} cajas en sistema`, stock > 0 ? 'success' : 'warning');
}

// ============================================================
// MANEJADOR PRINCIPAL DE SUBMIT
// ============================================================
async function handleRefillSubmitSafe(event) {
  event.preventDefault();

  if (refillMode === 'entry') {
    await handleRefillEntrySafe();
  } else {
    await handleRefillExitSafe();
  }
}

// ============================================================
// LÓGICA DE SALIDA — CON RELLENO INTELIGENTE CUANDO STOCK = 0
// ============================================================
async function handleRefillExitSafe() {
  console.log('📤 [REFILL-SAFE] Procesando salida...');

  if (!refillCurrentProduct || !refillCurrentProduct._exists) {
    showToast('⚠️ Primero escanea un producto existente', 'warning');
    return;
  }

  const cajasAMover = parseInt(document.getElementById('refill-boxes').value);
  if (isNaN(cajasAMover) || cajasAMover <= 0) {
    showToast('❌ Ingresa una cantidad de cajas válida', 'error');
    return;
  }

  const det = await getCachedDeterminante();
  if (!det) {
    showToast('❌ Error: Sin información de tienda', 'error');
    return;
  }

  const stockActual = parseInt(refillCurrentProduct.stockTotal) || 0;
  const timestamp = getLocalISOString();
  const usuario = firebase.auth().currentUser?.email || 'sistema';
  const codigo = refillCurrentProduct.codigoBarras;

  // ────────────────────────────────────────────────────────
  // CASO ESPECIAL: RELLENO INTELIGENTE (stock === 0)
  // ────────────────────────────────────────────────────────
  // Escenario real: el producto está en 0, el promotor escanea
  // y dice "rellenar 2 cajas". Eso significa que llegó mercancía
  // y fue directo al anaquel, sin pasar por bodega.
  //
  // Reglas:
  // - Se registra como entrada_directa_anaquel
  // - El stock SUBE (no baja)
  // - No genera negativos
  // - No pide confirmación
  // ────────────────────────────────────────────────────────
  if (stockActual === 0) {
    console.log('💡 [REFILL-SAFE] Stock en 0 → Activando RELLENO INTELIGENTE');

    try {
      // Sumar stock (no restar)
      const nuevoStock = await modificarStock(codigo, cajasAMover, 'sumar');

      // Actualizar fecha de último relleno en el producto
      const ref = getProductRef(det, codigo);
      await ref.update({
        ultimoRelleno: timestamp,
        fechaActualizacion: timestamp,
        actualizadoPor: usuario
      });

      // Registrar movimiento especial
      const movimiento = {
        tipo: 'entrada_directa_anaquel',
        productoNombre: refillCurrentProduct.nombre,
        productoCodigo: codigo,
        marca: refillCurrentProduct.marca || 'Otra',
        cajasMovidas: cajasAMover,
        piezasMovidas: cajasAMover * (parseInt(refillCurrentProduct.piezasPorCaja) || 0),
        stockAnterior: 0,
        stockNuevo: nuevoStock,
        fecha: timestamp,
        realizadoPor: usuario,
        motivo: 'Mercancía recibida directo a anaquel (stock estaba en 0)'
      };

      await firebase.database()
        .ref(`movimientos/${det}`)
        .push(movimiento);

      // Actualizar contadores del día
      refillTodayCajas += cajasAMover;
      refillTodayPiezas += cajasAMover * (parseInt(refillCurrentProduct.piezasPorCaja) || 0);
      updateRefillTodayUI();

      showToast(
        `💡 ${cajasAMover} cajas de ${refillCurrentProduct.nombre} → directo a anaquel (stock: 0 → ${nuevoStock})`,
        'success'
      );

      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      limpiarFormularioRefillSafe();
      document.getElementById('refill-barcode').focus();

    } catch (error) {
      console.error('❌ [REFILL-SAFE] Error en relleno inteligente:', error);
      showToast('❌ Error: ' + error.message, 'error');
    }

    return; // Salir, no continuar con la lógica normal de salida
  }

  // ────────────────────────────────────────────────────────
  // CASO NORMAL: SALIDA DE STOCK (con validación anti-negativos)
  // ────────────────────────────────────────────────────────
  // Primero validar ANTES de intentar la transacción
  if (cajasAMover > stockActual) {
    showToast(
      `❌ Stock insuficiente. Tienes ${stockActual} cajas, intentas mover ${cajasAMover}.`,
      'error'
    );
    return;
  }

  try {
    // Transacción atómica: si alguien más modificó el stock entre
    // la lectura y ahora, la transacción lo detecta y reintenta.
    const nuevoStock = await modificarStock(codigo, cajasAMover, 'restar');

    // Actualizar metadatos del producto
    const ref = getProductRef(det, codigo);
    await ref.update({
      ultimoRelleno: timestamp,
      fechaActualizacion: timestamp,
      actualizadoPor: usuario
    });

    // Registrar movimiento
    const piezasMovidas = cajasAMover * (parseInt(refillCurrentProduct.piezasPorCaja) || 0);
    const movimiento = {
      tipo: 'salida',
      productoNombre: refillCurrentProduct.nombre,
      productoCodigo: codigo,
      marca: refillCurrentProduct.marca || 'Otra',
      cajasMovidas: cajasAMover,
      piezasMovidas: piezasMovidas,
      stockAnterior: stockActual,
      stockNuevo: nuevoStock,
      fecha: timestamp,
      realizadoPor: usuario,
      motivo: 'Relleno de exhibidor'
    };

    await firebase.database()
      .ref(`movimientos/${det}`)
      .push(movimiento);

    // Actualizar contadores del día
    refillTodayCajas += cajasAMover;
    refillTodayPiezas += piezasMovidas;
    updateRefillTodayUI();

    showToast(`📤 ${cajasAMover} cajas de ${refillCurrentProduct.nombre} movidas (quedan ${nuevoStock})`, 'success');
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    limpiarFormularioRefillSafe();
    document.getElementById('refill-barcode').focus();

  } catch (error) {
    if (error.message === 'STOCK_INSUFICIENTE') {
      showToast('❌ Otro usuario modificó el stock. Reescanea el producto.', 'error');
    } else {
      console.error('❌ [REFILL-SAFE] Error en salida:', error);
      showToast('❌ Error: ' + error.message, 'error');
    }
  }
}

// ============================================================
// LÓGICA DE ENTRADA DE STOCK
// ============================================================
async function handleRefillEntrySafe() {
  console.log('📥 [REFILL-SAFE] Procesando entrada...');

  if (!refillCurrentProduct) {
    showToast('⚠️ Primero escanea un producto', 'warning');
    return;
  }

  const cajasAAgregar = parseInt(document.getElementById('refill-boxes').value);
  if (isNaN(cajasAAgregar) || cajasAAgregar <= 0) {
    showToast('❌ Ingresa una cantidad de cajas válida', 'error');
    return;
  }

  const det = await getCachedDeterminante();
  if (!det) {
    showToast('❌ Error: Sin información de tienda', 'error');
    return;
  }

  const timestamp = getLocalISOString();
  const usuario = firebase.auth().currentUser?.email || 'sistema';

  try {
    if (!refillCurrentProduct._exists) {
      // ── PRODUCTO NUEVO: crear con guardarProducto ──
      const formData = {
        codigoBarras: refillCurrentProduct.codigoBarras,
        nombre: document.getElementById('refill-nombre').value.trim(),
        marca: document.getElementById('refill-marca').value,
        piezasPorCaja: parseInt(document.getElementById('refill-piezas').value),
        ubicacion: document.getElementById('refill-warehouse').value.trim(),
        fechaCaducidad: document.getElementById('refill-expiry-date').value,
        cajas: cajasAAgregar
      };

      if (!formData.nombre || !formData.marca || !formData.piezasPorCaja || !formData.ubicacion) {
        showToast('❌ Completa todos los campos para crear el producto', 'error');
        return;
      }

      await guardarProducto(formData);

      // Registrar movimiento
      const movimiento = {
        tipo: 'entrada',
        productoNombre: formData.nombre,
        productoCodigo: formData.codigoBarras,
        marca: formData.marca,
        cajasMovidas: cajasAAgregar,
        piezasMovidas: cajasAAgregar * formData.piezasPorCaja,
        fecha: timestamp,
        realizadoPor: usuario,
        motivo: 'Recepción de mercancía (producto nuevo)'
      };
      await firebase.database().ref(`movimientos/${det}`).push(movimiento);

      showToast(`🆕 ${formData.nombre} creado con ${cajasAAgregar} cajas`, 'success');

    } else {
      // ── PRODUCTO EXISTENTE: sumar stock ──
      const codigo = refillCurrentProduct.codigoBarras;
      const stockAnterior = parseInt(refillCurrentProduct.stockTotal) || 0;

      const nuevoStock = await modificarStock(codigo, cajasAAgregar, 'sumar');

      // Actualizar metadatos
      const ref = getProductRef(det, codigo);
      await ref.update({
        ultimoRelleno: timestamp,
        fechaActualizacion: timestamp,
        actualizadoPor: usuario,
        // Actualizar fecha de caducidad si se proporcionó una nueva
        ...(document.getElementById('refill-expiry-date').value
          ? { fechaCaducidad: document.getElementById('refill-expiry-date').value }
          : {})
      });

      // Registrar movimiento
      const movimiento = {
        tipo: 'entrada',
        productoNombre: refillCurrentProduct.nombre,
        productoCodigo: codigo,
        marca: refillCurrentProduct.marca || 'Otra',
        cajasMovidas: cajasAAgregar,
        piezasMovidas: cajasAAgregar * (parseInt(refillCurrentProduct.piezasPorCaja) || 0),
        stockAnterior: stockAnterior,
        stockNuevo: nuevoStock,
        fecha: timestamp,
        realizadoPor: usuario,
        motivo: 'Recepción de mercancía'
      };
      await firebase.database().ref(`movimientos/${det}`).push(movimiento);

      showToast(`📥 ${cajasAAgregar} cajas de ${refillCurrentProduct.nombre} añadidas (total: ${nuevoStock})`, 'success');
    }

    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    limpiarFormularioRefillSafe();
    document.getElementById('refill-barcode').focus();

  } catch (error) {
    console.error('❌ [REFILL-SAFE] Error en entrada:', error);
    showToast('❌ Error: ' + error.message, 'error');
  }
}

// ============================================================
// HABILITAR CAMPOS PARA CREACIÓN DE PRODUCTO NUEVO
// ============================================================
function habilitarCamposCreacion() {
  ['refill-nombre', 'refill-piezas'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.readOnly = false;
      el.style.background = '#fff';
    }
  });
  const marca = document.getElementById('refill-marca');
  if (marca) marca.disabled = false;
  const warehouse = document.getElementById('refill-warehouse');
  if (warehouse) {
    warehouse.readOnly = false;
    warehouse.style.background = '#fff';
  }
  const expiryGroup = document.getElementById('refill-expiry-date-group');
  if (expiryGroup) expiryGroup.style.display = 'block';
}

// ============================================================
// LIMPIAR FORMULARIO
// ============================================================
function limpiarFormularioRefillSafe() {
  console.log('🧹 [REFILL-SAFE] Limpiando formulario');
  document.getElementById('refill-form')?.reset();

  ['refill-nombre', 'refill-piezas'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.readOnly = true;
      el.style.background = '#f8fafc';
    }
  });

  const marca = document.getElementById('refill-marca');
  if (marca) marca.disabled = true;

  const warehouse = document.getElementById('refill-warehouse');
  if (warehouse) {
    warehouse.readOnly = true;
    warehouse.style.background = '#f8fafc';
  }

  const expiryGroup = document.getElementById('refill-expiry-date-group');
  if (expiryGroup) expiryGroup.style.display = 'none';

  const infoDiv = document.getElementById('refill-product-info');
  if (infoDiv) infoDiv.style.display = 'none';

  refillCurrentProduct = null;
  setRefillModeSafe('exit');
}

// ============================================================
// ACTUALIZAR CONTADORES UI
// ============================================================
function updateRefillTodayUI() {
  const counterElement = document.getElementById('total-movements');
  if (counterElement) {
    counterElement.innerHTML = `
      <div style="font-size:24px;font-weight:700;color:#10b981;">${refillTodayCajas}</div>
      <div style="font-size:12px;color:#6b7280;margin-top:4px;">cajas movidas hoy</div>
      <div style="font-size:14px;font-weight:600;color:#059669;margin-top:8px;">${refillTodayPiezas} piezas</div>
    `;
  }
}

// ============================================================
// CARGAR MOVIMIENTOS DEL DÍA
// ============================================================
async function loadTodayMovementsSafe() {
  const det = await getCachedDeterminante();
  if (!det) return;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const movRef = firebase.database()
    .ref('movimientos/' + det)
    .orderByChild('fecha')
    .startAt(getLocalDayStart(hoy));

  movRef.on('value', (snapshot) => {
    if (snapshot.exists()) {
      const movimientos = [];
      snapshot.forEach(child => { movimientos.push(child.val()); });

      // Contar salidas + entradas directas a anaquel
      const relevantes = movimientos.filter(m =>
        m.tipo === 'salida' || m.tipo === 'entrada_directa_anaquel'
      );
      refillTodayCajas = relevantes.reduce((sum, m) => sum + (m.cajasMovidas || 0), 0);
      refillTodayPiezas = relevantes.reduce((sum, m) => sum + (m.piezasMovidas || 0), 0);
    } else {
      refillTodayCajas = 0;
      refillTodayPiezas = 0;
    }
    updateRefillTodayUI();
  });
}

// ============================================================
// INICIALIZACIÓN
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 [REFILL-SAFE] Inicializando módulo de relleno seguro...');

  // Listeners de modo
  document.getElementById('btn-refill-mode-exit')
    ?.addEventListener('click', () => setRefillModeSafe('exit'));
  document.getElementById('btn-refill-mode-entry')
    ?.addEventListener('click', () => setRefillModeSafe('entry'));

  // Submit del formulario
  document.getElementById('refill-form')
    ?.addEventListener('submit', handleRefillSubmitSafe);

  // Enter en barcode
  document.getElementById('refill-barcode')
    ?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        searchProductForRefillSafe(e.target.value);
      }
    });

  // Cargar datos al autenticarse
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      loadTodayMovementsSafe();
    }
  });

  // Estado inicial
  setRefillModeSafe('exit');
  console.log('✅ [REFILL-SAFE] Módulo listo.');
});

// ============================================================
// EXPONER FUNCIONES
// ============================================================
window.searchProductForRefillSafe = searchProductForRefillSafe;
window.handleRefillSubmitSafe = handleRefillSubmitSafe;
window.setRefillModeSafe = setRefillModeSafe;
window.limpiarFormularioRefillSafe = limpiarFormularioRefillSafe;

console.log('✅ refill-safe.js (Relleno seguro + inteligente) cargado');
