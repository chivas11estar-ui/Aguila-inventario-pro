// ============================================================
// Águila Inventario Pro - refill-safe.js (V6 - FULL INTEGRATION)
// Sincronizado con Excel, Promedios y Auditoría
// Copyright © 2026 José A. G. Betancourt
// ============================================================

'use strict';

let refillCurrentProduct = null;
let refillCurrentLoteId = null;
let refillMode = 'exit';
let refillSubmitPromise = null;
let refillActiveOperationId = null;

function createRefillOperationId() {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return 'refill-' + Date.now().toString(36) + '-' + randomPart;
}

function getRefillMovementRef(det, operationId) {
  return firebase.database().ref('movimientos/' + det + '/' + operationId);
}

async function reserveRefillOperation(det, operationId, data) {
  const operationRef = getRefillMovementRef(det, operationId);
  return new Promise((resolve, reject) => {
    operationRef.transaction((current) => {
      if (current !== null) return undefined;
      return {
        operationId,
        tipo: 'operacion_pendiente',
        estadoOperacion: 'pending',
        productoNombre: data.productoNombre,
        productoCodigo: data.productoCodigo,
        marca: data.marca,
        piezasPorCaja: data.piezasPorCaja,
        cajasSolicitadas: data.cajasSolicitadas,
        piezasSolicitadas: data.piezasSolicitadas,
        fecha: data.fecha,
        usuario: data.usuario
      };
    }, (error, committed) => {
      if (error) return reject(error);
      resolve(committed);
    });
  });
}

async function cancelPendingRefillOperation(det, operationId) {
  await getRefillMovementRef(det, operationId).remove();
}

async function confirmRefillOperation(det, operationId, movement) {
  await getRefillMovementRef(det, operationId).update({
    ...movement,
    operationId,
    estadoOperacion: 'confirmed',
    confirmadaEn: Date.now()
  });
}

async function markRefillReconciliationRequired(det, operationId, error) {
  try {
    await getRefillMovementRef(det, operationId).update({
      estadoOperacion: 'stock_confirmado_movimiento_pendiente',
      errorMovimiento: String(error?.message || error || 'unknown'),
      requiereReconciliacion: true
    });
  } catch (markError) {
    console.error('❌ No se pudo marcar reconciliación para ' + operationId, markError);
  }
}


// 1. CONFIGURACIÓN DE INTERFAZ
window.setRefillModeSafe = function(mode) {
  refillMode = mode;
  const btnEntry = document.getElementById('btn-refill-mode-entry');
  const btnExit  = document.getElementById('btn-refill-mode-exit');
  const btnPieces = document.getElementById('btn-refill-mode-pieces');
  const boxesLabel = document.getElementById('refill-boxes-label');
  const submitBtn = document.querySelector('#refill-form button[type="submit"]');

  [btnEntry, btnExit, btnPieces].forEach(btn => {
    if (btn) btn.style.cssText = "opacity: 0.5; transform: scale(0.95);";
  });

  const activeBtn = mode === 'entry' ? btnEntry : (mode === 'pieces' ? btnPieces : btnExit);
  if (activeBtn) activeBtn.style.cssText = "opacity: 1; transform: scale(1.05);";

  if (boxesLabel) boxesLabel.textContent = mode === 'entry' ? 'Cajas a AÑADIR' : 'Cajas a MOVER';
  if (submitBtn) {
      submitBtn.textContent = mode === 'entry' ? '➕ Registrar Entrada' : (mode === 'pieces' ? '🧩 Mover Piezas' : '✅ Registrar Movimiento');
      submitBtn.className = mode === 'entry' ? 'success' : 'primary';
  }
  if (refillCurrentProduct) renderLoteSelector(refillCurrentProduct.lotes || []);
};

// 2. BÚSQUEDA Y SELECCIÓN
window.searchProductForRefillSafe = async function(barcode) {
  if (!barcode || barcode.trim().length < 8) return;

  try {
    const producto = await buscarProductoPorCodigo(barcode);
    if (!producto || !producto._exists) {
      showToast('❌ Producto no registrado', 'error');
      limpiarFormularioRefillSafe();
      return;
    }

    refillCurrentProduct = producto;
    document.getElementById('refill-nombre').value = producto.nombre;
    document.getElementById('refill-marca').value = producto.marca || 'Otra';
    document.getElementById('refill-piezas').value = producto.piezasPorCaja || 0;

    renderLoteSelector(producto.lotes || []);
  } catch (e) { showToast('❌ Error de red', 'error'); }
};

function escaparHtmlSeguro(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderLoteSelector(lotes) {
  const infoDiv = document.getElementById('refill-product-info');
  if (!infoDiv) return;
  infoDiv.style.display = 'block';

  const validLotes = refillMode === 'entry' ? lotes : lotes.filter(l => l.stock > 0);
  let html = `<div style="padding:10px; background:rgba(59,130,246,0.1); border-radius:12px; margin-bottom:15px;">
                <h4 style="margin:0;">📦 Stock Total: ${escaparHtmlSeguro(refillCurrentProduct.stockTotal)} cajas</h4>
              </div>`;

  if (validLotes.length > 0) {
    html += `<p style="font-size:11px; opacity:0.7;">${refillMode === 'entry' ? 'Selecciona destino:' : 'Selecciona bodega o deja vacío para "Auto-Relleno":'}</p>
             <div style="display:grid; gap:8px;">`;
    validLotes.forEach(l => {
      const loteIdSafe = escaparHtmlSeguro(l.loteId);
      const bodegaSafe = escaparHtmlSeguro(l.bodega);
      const bodegaAttrSafe = escaparHtmlSeguro(l.bodega);
      html += `<div data-lote-id="${loteIdSafe}" data-bodega="${bodegaAttrSafe}" class="aguila-lote-btn"
                style="padding:12px; border-radius:10px; border:2px solid var(--border); cursor:pointer; display:flex; justify-content:space-between;">
                <strong>📍 ${bodegaSafe}</strong> <span>${escaparHtmlSeguro(l.stock)} cajas</span>
               </div>`;
    });
    html += `</div>`;
  }
  infoDiv.innerHTML = html;

  // Delegación de eventos (evita inline onclick con datos sin escapar).
  infoDiv.querySelectorAll('.aguila-lote-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      window.seleccionarLote(btn.dataset.loteId, btn.dataset.bodega);
    });
  });

  refillCurrentLoteId = null;
  if (refillMode === 'entry' && validLotes.length === 1) {
    refillCurrentLoteId = validLotes[0].loteId;
    document.getElementById('refill-warehouse').value = validLotes[0].bodega || 'General';
  }
}

window.seleccionarLote = function(id, bodega) {
  refillCurrentLoteId = id;
  document.querySelectorAll('.aguila-lote-btn').forEach(el => {
    el.style.borderColor = el.dataset.loteId === id ? 'var(--primary)' : 'var(--border)';
  });
  document.getElementById('refill-warehouse').value = bodega;
};

// 3. PROCESAMIENTO Y ACTUALIZACIÓN DE ANALÍTICA
async function executeRefillOperation(operation) {
  const submitBtn = document.querySelector('#refill-form button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;

  const {
    operationId,
    product,
    mode,
    selectedLoteId,
    warehouse,
    expiryDate,
    totalCajas,
    ppc
  } = operation;

  const det = await getCachedDeterminante();
  if (!det) throw new Error('Sin determinante');

  const usuario = firebase.auth().currentUser?.email || 'sistema';
  const fecha = Date.now();
  const reserved = await reserveRefillOperation(det, operationId, {
    productoNombre: product.nombre,
    productoCodigo: product.codigoBarras,
    marca: product.marca || 'Otra',
    piezasPorCaja: ppc,
    cajasSolicitadas: totalCajas,
    piezasSolicitadas: Math.round(totalCajas * ppc),
    fecha,
    usuario
  });

  if (!reserved) {
    showToast('⚠️ Esta operación ya fue procesada', 'warning');
    return { duplicate: true, operationId };
  }

  let stockMutationConfirmed = false;

  try {
    let result;
    let movementType;
    let origenStock = 'bodega';
    let stockBodegaDescontado = true;

    if (mode === 'entry') {
      if (selectedLoteId) {
        await modificarStock(product.codigoBarras, totalCajas, 'sumar', selectedLoteId);
        const selected = (product.lotes || []).find((lote) => lote.loteId === selectedLoteId);
        result = { detalle: [{ loteId: selectedLoteId, bodega: selected?.bodega || warehouse, tomado: totalCajas }] };
      } else {
        const arrival = await guardarProducto({
          codigoBarras: product.codigoBarras,
          nombre: product.nombre,
          marca: product.marca || 'Otra',
          piezasPorCaja: ppc,
          ubicacion: warehouse || 'General',
          fechaCaducidad: expiryDate || '',
          cajas: totalCajas
        });
        result = { detalle: [{ loteId: arrival.loteId, bodega: warehouse || 'General', tomado: totalCajas }] };
      }
      movementType = 'entrada';
      origenStock = 'entrada_bodega';
      stockBodegaDescontado = false;
      stockMutationConfirmed = true;
    } else if ((parseFloat(product.stockTotal) || 0) <= 0) {
      result = { detalle: [{ bodega: 'Entrada directa a anaquel', tomado: totalCajas }] };
      movementType = 'entrada_directa_anaquel';
      origenStock = 'entrada_directa_anaquel';
      stockBodegaDescontado = false;
      stockMutationConfirmed = true;
    } else if (selectedLoteId) {
      await modificarStock(product.codigoBarras, totalCajas, 'restar', selectedLoteId);
      result = { detalle: [{ loteId: selectedLoteId, bodega: warehouse, tomado: totalCajas }] };
      movementType = 'salida';
      stockMutationConfirmed = true;
    } else {
      result = await modificarStockMultiLote(product.codigoBarras, totalCajas);
      movementType = 'salida';
      stockMutationConfirmed = true;
    }

    const cajasConfirmadas = parseFloat(result.totalMovido ?? totalCajas) || 0;
    await confirmRefillOperation(det, operationId, {
      tipo: movementType,
      productoNombre: product.nombre,
      productoCodigo: product.codigoBarras,
      marca: product.marca || 'Otra',
      piezasPorCaja: ppc,
      cajasMovidas: cajasConfirmadas,
      piezasMovidas: Math.round(cajasConfirmadas * ppc),
      bodegasafectadas: result.detalle,
      origenStock,
      stockBodegaDescontado,
      fecha,
      usuario
    });

    if (typeof window.loadStats === 'function') await window.loadStats();
    if (typeof window.loadInventory === 'function') await window.loadInventory();

    showToast('✅ Éxito: Inventario y Estadísticas actualizadas', 'success');
    limpiarFormularioRefillSafe();
    if (navigator.vibrate) navigator.vibrate([50, 30, 50]);

    return { success: true, operationId, cajasConfirmadas, movementType };
  } catch (error) {
    if (stockMutationConfirmed) {
      await markRefillReconciliationRequired(det, operationId, error);
    } else {
      try {
        await cancelPendingRefillOperation(det, operationId);
      } catch (cancelError) {
        await markRefillReconciliationRequired(det, operationId, cancelError);
      }
    }
    throw error;
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

window.handleRefillSubmitSafe = function(event) {
  if (event) event.preventDefault();
  if (refillSubmitPromise) return refillSubmitPromise;
  if (!refillCurrentProduct) {
    showToast('⚠️ Escanea primero', 'warning');
    return Promise.resolve({ success: false, reason: 'NO_PRODUCT' });
  }

  let boxes;
  let ppc;
  try {
    boxes = window.parseRequiredInteger(document.getElementById('refill-boxes').value, 'Cajas', 0);
    ppc = window.parseRequiredInteger(refillCurrentProduct.piezasPorCaja, 'Piezas por caja', 1);
  } catch (error) {
    showToast('⚠️ ' + error.message, 'warning');
    return Promise.resolve({ success: false, reason: 'INVALID_QUANTITY', error });
  }
  const pieces = parseInt(document.getElementById('refill-pieces').value) || 0;
  const totalCajas = boxes + (pieces / ppc);

  if (totalCajas <= 0) {
    showToast('⚠️ Cantidad inválida', 'warning');
    return Promise.resolve({ success: false, reason: 'INVALID_QUANTITY' });
  }

  const operationId = refillActiveOperationId || createRefillOperationId();
  refillActiveOperationId = operationId;
  const product = refillCurrentProduct;
  const operation = {
    operationId,
    product,
    mode: refillMode,
    selectedLoteId: refillCurrentLoteId,
    warehouse: document.getElementById('refill-warehouse').value || 'General',
    expiryDate: document.getElementById('refill-expiry-date')?.value || '',
    totalCajas,
    ppc
  };

  const activePromise = executeRefillOperation(operation)
    .catch((error) => {
      showToast('❌ ' + error.message, 'error');
      return { success: false, operationId, error };
    })
    .finally(() => {
      if (refillSubmitPromise === activePromise) {
        refillSubmitPromise = null;
        refillActiveOperationId = null;
      }
    });

  refillSubmitPromise = activePromise;
  return activePromise;
};

window.limpiarFormularioRefillSafe = function() {
  document.getElementById('refill-form')?.reset();
  const info = document.getElementById('refill-product-info');
  if (info) info.style.display = 'none';
  refillCurrentProduct = null;
  refillCurrentLoteId = null;
};

// 4. EVENTOS
function initRefillSafeBindings() {
  if (window.__aguilaRefillSafeBindingsReady) return;
  window.__aguilaRefillSafeBindingsReady = true;

  document.getElementById('refill-form')?.addEventListener('submit', window.handleRefillSubmitSafe);
  document.getElementById('refill-barcode')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); window.searchProductForRefillSafe(e.target.value); }
  });
  document.getElementById('btn-refill-mode-exit')?.addEventListener('click', () => window.setRefillModeSafe('exit'));
  document.getElementById('btn-refill-mode-pieces')?.addEventListener('click', () => window.setRefillModeSafe('pieces'));
  document.getElementById('btn-refill-mode-entry')?.addEventListener('click', () => window.setRefillModeSafe('entry'));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initRefillSafeBindings);
} else {
  initRefillSafeBindings();
}
