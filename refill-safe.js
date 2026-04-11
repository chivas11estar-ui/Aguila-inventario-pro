// ============================================================
// Águila Inventario Pro - refill-safe.js (V3 - Multi-Lote)
// Soporta múltiples bodegas y piezas sueltas
// Copyright © 2026 José A. G. Betancourt
// ============================================================

'use strict';

let refillCurrentProduct = null;
let refillCurrentLoteId = null;
let refillMode = 'exit';
let refillTodayCajas = 0;
let refillTodayPiezas = 0;

console.log('🔄 [REFILL V3] Módulo multi-lote iniciando...');

// ============================================================
// MODO ENTRADA / SALIDA
// ============================================================
function setRefillModeSafe(mode) {
  refillMode = mode;

  const btnEntry = document.getElementById('btn-refill-mode-entry');
  const btnExit  = document.getElementById('btn-refill-mode-exit');
  const expiryGroup   = document.getElementById('refill-expiry-date-group');
  const warehouseInput = document.getElementById('refill-warehouse');
  const boxesLabel    = document.getElementById('refill-boxes-label');
  const submitBtn     = document.querySelector('#refill-form button[type="submit"]');

  if (mode === 'entry') {
    btnEntry?.classList.replace('secondary', 'primary');
    if (btnEntry) btnEntry.style.opacity = 1;
    btnExit?.classList.replace('primary', 'secondary');
    if (btnExit) btnExit.style.opacity = 0.6;
    if (expiryGroup) expiryGroup.style.display = 'block';
    if (warehouseInput) { warehouseInput.readOnly = false; warehouseInput.style.background = '#fff'; }
    if (boxesLabel) boxesLabel.textContent = 'Cajas a AÑADIR';
    if (submitBtn) { submitBtn.textContent = '➕ Registrar Entrada'; submitBtn.classList.replace('primary','success'); }
  } else {
    btnExit?.classList.replace('secondary', 'primary');
    if (btnExit) btnExit.style.opacity = 1;
    btnEntry?.classList.replace('primary', 'secondary');
    if (btnEntry) btnEntry.style.opacity = 0.6;
    if (expiryGroup) expiryGroup.style.display = 'none';
    if (warehouseInput) { warehouseInput.readOnly = true; warehouseInput.style.background = '#f8fafc'; }
    if (boxesLabel) boxesLabel.textContent = 'Cajas a MOVER';
    if (submitBtn) { submitBtn.textContent = '✅ Registrar Movimiento'; submitBtn.classList.replace('success','primary'); }
  }
}

// ============================================================
// BUSCAR PRODUCTO
// ============================================================
async function searchProductForRefillSafe(barcode) {
  if (!barcode || barcode.trim().length < 8) {
    showToast('⚠️ Código inválido (mínimo 8 dígitos)', 'warning');
    return;
  }

  try {
    const producto = await buscarProductoPorCodigo(barcode);

    if (!producto || !producto._exists) {
      refillCurrentProduct = { codigoBarras: barcode.trim(), _exists: false };

      if (refillMode === 'exit') {
        showToast('❌ Producto no existe. Usa modo Entrada para agregarlo.', 'error');
        limpiarFormularioRefillSafe();
        return;
      }

      habilitarCamposCreacion();
      showToast('🆕 Producto nuevo. Completa los datos.', 'info');
      document.getElementById('refill-nombre')?.focus();
      return;
    }

    refillCurrentProduct = producto;

    // Llenar campos base
    document.getElementById('refill-nombre').value  = producto.nombre || '';
    document.getElementById('refill-marca').value   = producto.marca  || '';
    document.getElementById('refill-piezas').value  = producto.piezasPorCaja || '';

    // Renderizar selector de lotes si hay más de uno
    renderLoteSelector(producto.lotes || []);

  } catch (error) {
    console.error('❌ [REFILL V3]', error);
    showToast('❌ Error al buscar: ' + error.message, 'error');
    limpiarFormularioRefillSafe();
  }
}

// ============================================================
// SELECTOR DE LOTES — muestra bodegas disponibles
// ============================================================
function renderLoteSelector(lotes) {
  const infoDiv = document.getElementById('refill-product-info');
  if (!infoDiv) return;

  infoDiv.style.display = 'block';

  if (lotes.length === 0) {
    infoDiv.innerHTML = `
      <div style="padding:12px;background:#fef3c7;border-left:4px solid #f59e0b;border-radius:8px;">
        <strong style="color:#92400e;">⚠️ Sin stock en ninguna bodega</strong>
      </div>`;
    refillCurrentLoteId = null;
    return;
  }

  // Si solo hay un lote, seleccionarlo automáticamente
  if (lotes.length === 1) {
    refillCurrentLoteId = lotes[0].loteId;
    const l = lotes[0];
    const stockColor = l.stock === 0 ? '#f59e0b' : '#10b981';
    const stockBg    = l.stock === 0 ? '#fef3c7' : '#d1fae5';

    infoDiv.innerHTML = `
      <div style="padding:14px;background:${stockBg};border-left:4px solid ${stockColor};border-radius:8px;">
        <div style="font-weight:700;color:${l.stock===0?'#92400e':'#065f46'};margin-bottom:6px;">
          📍 ${l.bodega}
        </div>
        <div style="font-size:13px;color:${l.stock===0?'#b45309':'#047857'};">
          📦 Stock: <strong>${l.stock} cajas</strong>
          ${l.fechaCaducidad ? ` · 📅 Vence: ${l.fechaCaducidad}` : ''}
        </div>
      </div>`;

    if (refillMode === 'exit') {
      document.getElementById('refill-warehouse').value = l.bodega;
    }
    return;
  }

  // Múltiples lotes — mostrar selector
  const totalStock = lotes.reduce((s, l) => s + l.stock, 0);

  infoDiv.innerHTML = `
    <div style="padding:14px;background:#e0f2fe;border-left:4px solid #0284c7;border-radius:8px;margin-bottom:8px;">
      <div style="font-weight:700;color:#0c4a6e;margin-bottom:8px;">
        📦 Stock total: ${totalStock} cajas en ${lotes.length} ubicaciones
      </div>
      <div style="font-size:13px;color:#075985;margin-bottom:10px;">
        ${refillMode === 'exit' ? 'Selecciona de cuál bodega mover:' : 'Selecciona bodega destino:'}
      </div>
      <div id="lote-selector" style="display:flex;flex-direction:column;gap:8px;">
        ${lotes.map(l => `
          <div 
            onclick="seleccionarLote('${l.loteId}', '${l.bodega}', '${l.fechaCaducidad}', ${l.stock})"
            style="
              padding:10px 12px;
              border-radius:8px;
              border:2px solid ${l.stock === 0 ? '#fca5a5' : '#86efac'};
              background:${l.stock === 0 ? '#fef2f2' : '#f0fdf4'};
              cursor:pointer;
              transition:all 0.2s;
            "
            id="lote-btn-${l.loteId}"
          >
            <div style="font-weight:600;color:#1f2937;font-size:14px;">
              📍 ${l.bodega}
            </div>
            <div style="font-size:12px;color:#6b7280;margin-top:2px;">
              ${l.stock} cajas
              ${l.fechaCaducidad ? ` · Vence: ${l.fechaCaducidad}` : ''}
              ${l.stock === 0 ? ' · <span style="color:#ef4444;font-weight:600;">AGOTADO</span>' : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>`;

  // Seleccionar automáticamente el primer lote con stock
  const primerConStock = lotes.find(l => l.stock > 0);
  if (primerConStock) {
    seleccionarLote(
      primerConStock.loteId,
      primerConStock.bodega,
      primerConStock.fechaCaducidad,
      primerConStock.stock
    );
  }
}

// ============================================================
// SELECCIONAR LOTE ACTIVO
// ============================================================
window.seleccionarLote = function(loteId, bodega, fecha, stock) {
  refillCurrentLoteId = loteId;

  // Highlight visual
  document.querySelectorAll('[id^="lote-btn-"]').forEach(el => {
    el.style.border = `2px solid ${el.id === 'lote-btn-' + loteId ? '#2563eb' : '#e5e7eb'}`;
    el.style.background = el.id === 'lote-btn-' + loteId ? '#eff6ff' : '';
  });

  if (refillMode === 'exit') {
    const warehouseInput = document.getElementById('refill-warehouse');
    if (warehouseInput) warehouseInput.value = bodega;
  }

  showToast(`📍 Lote seleccionado: ${bodega} (${stock} cajas)`, 'info');
};

// ============================================================
// SUBMIT
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
// SALIDA DE STOCK
// ============================================================
async function handleRefillExitSafe() {
  if (!refillCurrentProduct?._exists) {
    showToast('⚠️ Escanea un producto existente', 'warning');
    return;
  }

  const cajasEnteras = parseInt(document.getElementById('refill-boxes').value) || 0;
  const piezasSueltas = parseInt(document.getElementById('refill-pieces').value) || 0;
  
  if (cajasEnteras === 0 && piezasSueltas === 0) {
    showToast('⚠️ Ingresa una cantidad (cajas o piezas)', 'warning');
    return;
  }

  const piezasPorCaja = parseInt(refillCurrentProduct.piezasPorCaja) || 1;
  const cajasAMover = parseFloat((cajasEnteras + (piezasSueltas / piezasPorCaja)).toFixed(2));
  const piezasMovidas = (cajasEnteras * piezasPorCaja) + piezasSueltas;

  if (isNaN(cajasAMover) || cajasAMover <= 0 || cajasAMover > 9999) {
    showToast('❌ Cantidad inválida', 'error');
    return;
  }

  if (!refillCurrentLoteId) {
    showToast('⚠️ Selecciona una bodega primero', 'warning');
    return;
  }

  const det = await getCachedDeterminante();
  if (!det) { showToast('❌ Error: Sin información de tienda', 'error'); return; }

  const loteActual = refillCurrentProduct.lotes?.find(l => l.loteId === refillCurrentLoteId);
  const stockActual = loteActual?.stock || 0;
  const productName = refillCurrentProduct.nombre;
  const timestamp   = Date.now();
  const usuario     = firebase.auth().currentUser?.email || 'sistema';
  const codigo      = refillCurrentProduct.codigoBarras;

  console.log('🚀 [REFILL] Iniciando salida:', {
    codigo,
    det,
    loteId: refillCurrentLoteId,
    stockActual,
    cajasAMover,
    piezasMovidas
  });

  // Relleno inteligente si stock === 0
  if (stockActual === 0) {
    try {
      const nuevoStock = await modificarStock(codigo, cajasAMover, 'sumar', refillCurrentLoteId);

      await firebase.database()
        .ref(`movimientos/${det}`).push({
          tipo: 'entrada_directa_anaquel',
          productoNombre: refillCurrentProduct.nombre,
          productoCodigo: codigo,
          marca: refillCurrentProduct.marca || 'Otra',
          cajasMovidas: cajasAMover,
          piezasMovidas: piezasMovidas,
          bodega: loteActual?.bodega || 'General',
          loteId: refillCurrentLoteId,
          stockAnterior: 0,
          stockNuevo: nuevoStock,
          fecha: timestamp,
          realizadoPor: usuario
        });

      refillTodayCajas += cajasAMover;
      refillTodayPiezas += piezasMovidas;
      updateRefillTodayUI();

      showToast(`💡 ${displayValue(cajasAMover)} cajas de ${productName} → anaquel directo`, 'success');
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      limpiarFormularioRefillSafe();
      document.getElementById('refill-barcode')?.focus();
    } catch (error) {
      showToast('❌ Error: ' + error.message, 'error');
    }
    return;
  }

  if (cajasAMover > stockActual) {
    showToast(`❌ Solo hay ${stockActual} cajas en ${loteActual?.bodega}`, 'error');
    return;
  }

  try {
    const nuevoStock = await modificarStock(codigo, cajasAMover, 'restar', refillCurrentLoteId);

    await firebase.database()
      .ref(`movimientos/${det}`).push({
        tipo: 'salida',
        productoNombre: refillCurrentProduct.nombre,
        productoCodigo: codigo,
        marca: refillCurrentProduct.marca || 'Otra',
        cajasMovidas: cajasAMover,
        piezasMovidas: piezasMovidas,
        bodega: loteActual?.bodega || 'General',
        loteId: refillCurrentLoteId,
        stockAnterior: stockActual,
        stockNuevo: nuevoStock,
        fecha: timestamp,
        realizadoPor: usuario
      });

    refillTodayCajas  += cajasAMover;
    refillTodayPiezas += piezasMovidas;
    updateRefillTodayUI();

    showToast(`📤 ${displayValue(cajasAMover)} cajas de ${productName} movidas (quedan ${nuevoStock})`, 'success');
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    limpiarFormularioRefillSafe();
    document.getElementById('refill-barcode')?.focus();

  } catch (error) {
    if (error.message === 'STOCK_INSUFICIENTE') {
      showToast('❌ Stock insuficiente en esta bodega. Reintenta.', 'error');
    } else {
      showToast('❌ Error: ' + error.message, 'error');
    }
  }
}

// ============================================================
// ENTRADA DE STOCK
// ============================================================
async function handleRefillEntrySafe() {
  if (!refillCurrentProduct) {
    showToast('⚠️ Primero escanea un producto', 'warning');
    return;
  }

  const cajasEnteras = parseInt(document.getElementById('refill-boxes').value) || 0;
  const piezasSueltas = parseInt(document.getElementById('refill-pieces').value) || 0;
  
  if (cajasEnteras === 0 && piezasSueltas === 0) {
    showToast('⚠️ Ingresa una cantidad (cajas o piezas)', 'warning');
    return;
  }

  const piezasPorCaja = parseInt(refillCurrentProduct.piezasPorCaja) || 1;
  const cajasAAgregar = parseFloat((cajasEnteras + (piezasSueltas / piezasPorCaja)).toFixed(2));
  const piezasAAgregar = (cajasEnteras * piezasPorCaja) + piezasSueltas;

  const det = await getCachedDeterminante();
  if (!det) { showToast('❌ Sin información de tienda', 'error'); return; }

  const timestamp = Date.now();
  const usuario   = firebase.auth().currentUser?.email || 'sistema';

  try {
    if (!refillCurrentProduct._exists) {
      // Producto nuevo
      const formData = {
        codigoBarras: refillCurrentProduct.codigoBarras,
        nombre:       document.getElementById('refill-nombre').value.trim(),
        marca:        document.getElementById('refill-marca').value,
        piezasPorCaja: piezasPorCaja,
        ubicacion:    document.getElementById('refill-warehouse').value.trim(),
        fechaCaducidad: document.getElementById('refill-expiry-date').value,
        cajas:        cajasAAgregar
      };

      if (!formData.nombre || !formData.ubicacion) {
        showToast('❌ Completa nombre y bodega', 'error');
        return;
      }

      await guardarProducto(formData);

      await firebase.database().ref(`movimientos/${det}`).push({
        tipo: 'entrada',
        productoNombre: formData.nombre,
        productoCodigo: formData.codigoBarras,
        marca: formData.marca,
        cajasMovidas: cajasAAgregar,
        piezasMovidas: piezasAAgregar,
        bodega: formData.ubicacion,
        fecha: timestamp,
        realizadoPor: usuario
      });

      showToast(`🆕 ${formData.nombre} creado con ${displayValue(cajasAAgregar)} cajas en ${formData.ubicacion}`, 'success');

    } else {
      // Producto existente — nueva entrada en bodega específica
      const bodega       = document.getElementById('refill-warehouse').value.trim()
                        || refillCurrentProduct.lotes?.[0]?.bodega || 'General';
      const fechaCad     = document.getElementById('refill-expiry-date').value
                        || refillCurrentProduct.lotes?.[0]?.fechaCaducidad || '';
      const loteId       = generarLoteId(bodega, fechaCad);
      const safeCode     = sanitizeBarcode(refillCurrentProduct.codigoBarras);

      // Buscar stock actual de ese lote
      const loteExistente = refillCurrentProduct.lotes?.find(l => l.loteId === loteId);
      const stockAnterior = loteExistente?.stock || 0;

      const updates = {};
      updates[`productos/${det}/${safeCode}/lotes/${loteId}/bodega`]        = bodega;
      updates[`productos/${det}/${safeCode}/lotes/${loteId}/fechaCaducidad`] = fechaCad;
      updates[`productos/${det}/${safeCode}/lotes/${loteId}/stock`]          = stockAnterior + cajasAAgregar;
      updates[`productos/${det}/${safeCode}/lotes/${loteId}/actualizado`]    = timestamp;
      updates[`productos/${det}/${safeCode}/fechaActualizacion`]             = timestamp;
      updates[`productos/${det}/${safeCode}/actualizadoPor`]                 = usuario;

      await firebase.database().ref().update(updates);

      await firebase.database().ref(`movimientos/${det}`).push({
        tipo: 'entrada',
        productoNombre: refillCurrentProduct.nombre,
        productoCodigo: refillCurrentProduct.codigoBarras,
        marca: refillCurrentProduct.marca || 'Otra',
        cajasMovidas: cajasAAgregar,
        piezasMovidas: piezasAAgregar,
        bodega,
        loteId,
        stockAnterior,
        stockNuevo: stockAnterior + cajasAAgregar,
        fecha: timestamp,
        realizadoPor: usuario
      });

      showToast(`📥 ${displayValue(cajasAAgregar)} cajas añadidas en ${bodega}`, 'success');
    }

    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    limpiarFormularioRefillSafe();
    document.getElementById('refill-barcode')?.focus();

  } catch (error) {
    console.error('❌ [REFILL V3]', error);
    showToast('❌ Error: ' + error.message, 'error');
  }
}

// ============================================================
// HABILITAR CAMPOS PARA PRODUCTO NUEVO
// ============================================================
function habilitarCamposCreacion() {
  ['refill-nombre', 'refill-piezas'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.readOnly = false; el.style.background = '#fff'; }
  });
  const marca = document.getElementById('refill-marca');
  if (marca) marca.disabled = false;
  const warehouse = document.getElementById('refill-warehouse');
  if (warehouse) { warehouse.readOnly = false; warehouse.style.background = '#fff'; }
  const expiryGroup = document.getElementById('refill-expiry-date-group');
  if (expiryGroup) expiryGroup.style.display = 'block';
}

// ============================================================
// LIMPIAR FORMULARIO
// ============================================================
function limpiarFormularioRefillSafe() {
  document.getElementById('refill-form')?.reset();
  
  // Reset manual de inputs de cantidad
  const boxesInput = document.getElementById('refill-boxes');
  const piecesInput = document.getElementById('refill-pieces');
  if (boxesInput) boxesInput.value = 0;
  if (piecesInput) piecesInput.value = 0;

  ['refill-nombre', 'refill-piezas'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.readOnly = true; el.style.background = '#f8fafc'; }
  });

  const marca = document.getElementById('refill-marca');
  if (marca) marca.disabled = true;

  const warehouse = document.getElementById('refill-warehouse');
  if (warehouse) { warehouse.readOnly = true; warehouse.style.background = '#f8fafc'; }

  const expiryGroup = document.getElementById('refill-expiry-date-group');
  if (expiryGroup) expiryGroup.style.display = 'none';

  const infoDiv = document.getElementById('refill-product-info');
  if (infoDiv) infoDiv.style.display = 'none';

  refillCurrentProduct = null;
  refillCurrentLoteId  = null;
  setRefillModeSafe('exit');
}

// ============================================================
// UI CONTADOR DIARIO
// ============================================================
function updateRefillTodayUI() {
  const el = document.getElementById('total-movements');
  if (el) {
    const cajasText = Number.isInteger(refillTodayCajas) ? refillTodayCajas : refillTodayCajas.toFixed(2);
    el.innerHTML = `
      <div style="font-size:24px;font-weight:700;color:#10b981;">${cajasText}</div>
      <div style="font-size:12px;color:#6b7280;margin-top:4px;">cajas movidas hoy</div>
      <div style="font-size:14px;font-weight:600;color:#059669;margin-top:8px;">${refillTodayPiezas} piezas</div>`;
  }
}

// ============================================================
// CARGAR MOVIMIENTOS DEL DÍA (CON CLEANUP)
// ============================================================
async function loadTodayMovementsSafe() {
  const det = await getCachedDeterminante();
  if (!det) return;

  // Limpiar listener anterior si existe
  if (window.LISTENERS_MANAGER) {
    window.LISTENERS_MANAGER.unsubscribe('refill_movements_listener');
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const movRef = firebase.database()
    .ref('movimientos/' + det)
    .orderByChild('fecha')
    .startAt(hoy.getTime());

  // Registrar listener con LISTENERS_MANAGER para evitar memory leaks
  const callback = (snapshot) => {
    if (snapshot.exists()) {
      const movs = [];
      snapshot.forEach(c => movs.push(c.val()));
      const relevantes = movs.filter(m =>
        m.tipo === 'salida' || m.tipo === 'entrada_directa_anaquel'
      );
      refillTodayCajas  = relevantes.reduce((s, m) => s + (parseFloat(m.cajasMovidas) || 0), 0);
      refillTodayPiezas = relevantes.reduce((s, m) => s + (parseInt(m.piezasMovidas) || 0), 0);
    } else {
      refillTodayCajas  = 0;
      refillTodayPiezas = 0;
    }
    updateRefillTodayUI();
  };

  if (window.LISTENERS_MANAGER && window.LISTENERS_MANAGER.register) {
    window.LISTENERS_MANAGER.register(movRef, 'refill_movements_listener', callback);
  } else {
    movRef.on('value', callback);
  }
}

// ============================================================
// HELPERS
// ============================================================
function displayValue(val) {
  return Number.isInteger(val) ? val : val.toFixed(2);
}

// ============================================================
// INICIALIZACIÓN
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-refill-mode-exit')
    ?.addEventListener('click', () => setRefillModeSafe('exit'));
  document.getElementById('btn-refill-mode-entry')
    ?.addEventListener('click', () => setRefillModeSafe('entry'));

  document.getElementById('refill-form')
    ?.addEventListener('submit', handleRefillSubmitSafe);

  document.getElementById('refill-barcode')
    ?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        searchProductForRefillSafe(e.target.value);
      }
    });

  firebase.auth().onAuthStateChanged((user) => {
    if (user) loadTodayMovementsSafe();
  });

  setRefillModeSafe('exit');
  console.log('✅ [REFILL V3] Módulo listo.');
});

// ============================================================
// EXPONER
// ============================================================
window.searchProductForRefillSafe = searchProductForRefillSafe;
window.handleRefillSubmitSafe     = handleRefillSubmitSafe;
window.setRefillModeSafe          = setRefillModeSafe;
window.limpiarFormularioRefillSafe = limpiarFormularioRefillSafe;

console.log('✅ refill-safe.js V3 cargado correctamente');
