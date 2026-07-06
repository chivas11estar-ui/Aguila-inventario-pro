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
let refillSubmitInProgress = false;

console.log('🔄 [REFILL V3] Módulo multi-lote iniciando...');

function setRefillMarcaValue(marca) {
  const select = document.getElementById('refill-marca');
  if (!select) return;
  const value = String(marca || 'Otra').trim() || 'Otra';
  const disponible = Array.from(select.options).some(option => option.value === value);
  select.value = disponible ? value : 'Otra';
}

// ============================================================
// MODO ENTRADA / SALIDA
// ============================================================
function setRefillModeSafe(mode) {
  refillMode = mode;

  const btnEntry = document.getElementById('btn-refill-mode-entry');
  const btnExit  = document.getElementById('btn-refill-mode-exit');
  const btnPieces = document.getElementById('btn-refill-mode-pieces');
  const expiryGroup   = document.getElementById('refill-expiry-date-group');
  const warehouseInput = document.getElementById('refill-warehouse');
  const boxesLabel    = document.getElementById('refill-boxes-label');
  const submitBtn     = document.querySelector('#refill-form button[type="submit"]');
  
  const boxesGroup = document.getElementById('refill-boxes')?.closest('.form-group');
  const piecesGroup = document.getElementById('refill-pieces-group');
  const piecesHint = document.getElementById('refill-pieces-hint');

  // Reset visual de botones
  [btnEntry, btnExit, btnPieces].forEach(btn => {
    if (btn) {
      btn.style.opacity = '0.6';
      btn.classList.remove('primary', 'warning');
      btn.classList.add('secondary');
    }
  });

  if (mode === 'entry') {
    btnEntry?.classList.replace('secondary', 'primary');
    if (btnEntry) btnEntry.style.opacity = 1;
    if (expiryGroup) expiryGroup.style.display = 'block';
    if (warehouseInput) { warehouseInput.readOnly = false; warehouseInput.style.background = '#fff'; }
    if (boxesLabel) boxesLabel.textContent = 'Cajas a AÑADIR';
    if (submitBtn) { submitBtn.textContent = '➕ Registrar Entrada'; submitBtn.classList.replace('primary','success'); }
    
    // Mostrar ambos campos en entrada para máxima flexibilidad
    if (boxesGroup) boxesGroup.style.display = 'block';
    if (piecesGroup) piecesGroup.style.display = 'block';
    if (piecesHint) piecesHint.style.display = 'none';

  } else if (mode === 'pieces') {
    btnPieces?.classList.replace('secondary', 'warning');
    if (btnPieces) btnPieces.style.opacity = 1;
    if (expiryGroup) expiryGroup.style.display = 'none';
    if (warehouseInput) { warehouseInput.readOnly = true; warehouseInput.style.background = '#f8fafc'; }
    if (submitBtn) { submitBtn.textContent = '🧩 Registrar Piezas'; submitBtn.classList.replace('success','primary'); }
    
    // En modo piezas, ocultar cajas para evitar confusión
    if (boxesGroup) boxesGroup.style.display = 'none';
    if (piecesGroup) piecesGroup.style.display = 'block';
    if (piecesHint) piecesHint.style.display = 'block';
    
    // Resetear cajas a 0 para que no afecten el cálculo
    const boxesInput = document.getElementById('refill-boxes');
    if (boxesInput) boxesInput.value = 0;

  } else {
    // MODO EXIT (Cajas)
    btnExit?.classList.replace('secondary', 'primary');
    if (btnExit) btnExit.style.opacity = 1;
    if (expiryGroup) expiryGroup.style.display = 'none';
    if (warehouseInput) { warehouseInput.readOnly = true; warehouseInput.style.background = '#f8fafc'; }
    if (boxesLabel) boxesLabel.textContent = 'Cajas a MOVER';
    if (submitBtn) { submitBtn.textContent = '✅ Registrar Movimiento'; submitBtn.classList.replace('success','primary'); }
    
    // Mostrar cajas, ocultar piezas (o dejarlas visibles pero secundarias)
    if (boxesGroup) boxesGroup.style.display = 'block';
    if (piecesGroup) piecesGroup.style.display = 'none';
    if (piecesHint) piecesHint.style.display = 'none';
    
    // Resetear piezas a 0
    const piecesInput = document.getElementById('refill-pieces');
    if (piecesInput) piecesInput.value = 0;
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
      const existeEnCatalogo = Boolean(producto?._catalogExists);

      // Conserva los datos descriptivos devueltos por catalogoProductos para
      // que una tienda nueva no tenga que volver a capturarlos manualmente.
      refillCurrentProduct = producto || {
        codigoBarras: barcode.trim(),
        _exists: false,
        _catalogExists: false
      };

      if (refillMode === 'exit') {
        showToast(
          existeEnCatalogo
            ? '📥 Producto conocido. Cambiando a Entrada para darlo de alta.'
            : '🆕 Producto nuevo. Cambiando a Entrada para capturarlo.',
          'info'
        );
        setRefillModeSafe('entry');
      }

      habilitarCamposCreacion();

      if (existeEnCatalogo) {
        document.getElementById('refill-nombre').value = producto.nombre || '';
        setRefillMarcaValue(producto.marca);
        document.getElementById('refill-piezas').value = producto.piezasPorCaja || '';

        showToast('✅ Producto encontrado en el catálogo. Completa bodega, caducidad y cantidad.', 'success');
        document.getElementById('refill-warehouse')?.focus();
      } else {
        showToast('🆕 Producto nuevo. Completa los datos.', 'info');
        document.getElementById('refill-nombre')?.focus();
      }
      return;
    }

    refillCurrentProduct = producto;

    // Llenar campos base
    document.getElementById('refill-nombre').value  = producto.nombre || '';
    setRefillMarcaValue(producto.marca);
    document.getElementById('refill-piezas').value  = producto.piezasPorCaja || '';

    // ✅ FIX: Limpiar warehouse (especialmente si viene de Agotados)
    document.getElementById('refill-warehouse').value = '';

    // Mostrar solo lotes activos (stock > 0) para evitar ruido de bodegas agotadas
    const lotesValidos = (producto.lotes || []).filter(l => (parseFloat(l.stock) || 0) > 0);

    // Renderizar selector de lotes si hay más de uno
    renderLoteSelector(lotesValidos);

  } catch (error) {
    console.error('❌ [REFILL V3]', error);
    showToast('❌ Error al buscar: ' + error.message, 'error');
    limpiarFormularioRefillSafe(true);
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
        <strong style="color:#92400e;">⚠️ Sin stock activo en bodegas</strong>
        ${refillMode === 'entry' ? '<div style="font-size:12px;color:#b45309;margin-top:6px;">Puedes escribir una bodega destino para registrar entrada.</div>' : ''}
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

  // No asumir una bodega cuando existen varios lotes: el usuario debe elegir.
  refillCurrentLoteId = null;
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

function roundCajas(value) {
  return parseFloat((parseFloat(value) || 0).toFixed(2));
}

function stockToPieces(stockCajas, piezasPorCaja) {
  return Math.max(0, Math.round((parseFloat(stockCajas) || 0) * (parseInt(piezasPorCaja) || 1)));
}

function piecesToRoundedCajas(piezas, piezasPorCaja) {
  return roundCajas((parseInt(piezas) || 0) / (parseInt(piezasPorCaja) || 1));
}

// ============================================================
// SUBMIT
// ============================================================
async function handleRefillSubmitSafe(event) {
  event.preventDefault();
  if (refillSubmitInProgress) return;

  const submitBtn = document.querySelector('#refill-form button[type="submit"]');
  refillSubmitInProgress = true;
  if (submitBtn) submitBtn.disabled = true;

  try {
    if (refillMode === 'entry') {
      await handleRefillEntrySafe();
    } else if (refillMode === 'pieces') {
      await handleRefillPiecesSafe();
    } else {
      await handleRefillExitSafe();
    }
  } finally {
    refillSubmitInProgress = false;
    if (submitBtn) submitBtn.disabled = false;
  }
}

// ============================================================
// MODO PIEZAS (SALIDA FRACCIONARIA)
// ============================================================
async function handleRefillPiecesSafe() {
  if (!refillCurrentProduct?._exists) {
    showToast('⚠️ Escanea un producto existente', 'warning');
    return;
  }

  const piezasSueltas = parseInt(document.getElementById('refill-pieces').value) || 0;
  if (piezasSueltas <= 0) {
    showToast('⚠️ Ingresa la cantidad de piezas a mover', 'warning');
    return;
  }

  const piezasPorCaja = parseInt(refillCurrentProduct.piezasPorCaja) || 1;
  const cajasEquivalentes = piecesToRoundedCajas(piezasSueltas, piezasPorCaja);

  if (!refillCurrentLoteId) {
    showToast('⚠️ Selecciona una bodega primero', 'warning');
    return;
  }

  const det = await getCachedDeterminante();
  const lotesProducto = Array.isArray(refillCurrentProduct.lotes) ? refillCurrentProduct.lotes : [];
  const loteActual = lotesProducto.find(l => l.loteId === refillCurrentLoteId);
  const stockActual = parseFloat(loteActual?.stock) || 0;
  const piezasDisponibles = stockToPieces(stockActual, piezasPorCaja);
  const cajasARestar = Math.min(stockActual, cajasEquivalentes);

  if (piezasSueltas > piezasDisponibles) {
    showToast(`❌ Stock insuficiente (${piezasDisponibles} piezas disponibles)`, 'error');
    return;
  }

  try {
    const nuevoStock = await modificarStock(refillCurrentProduct.codigoBarras, cajasARestar, 'restar', refillCurrentLoteId);
    
    const timestamp = Date.now();
    const usuario = firebase.auth().currentUser?.email || 'sistema';

    await firebase.database().ref(`movimientos/${det}`).push({
      tipo: 'salida',
      motivo: 'Relleno por piezas sueltas',
      productoNombre: refillCurrentProduct.nombre,
      productoCodigo: refillCurrentProduct.codigoBarras,
      marca: refillCurrentProduct.marca || 'Otra',
      cajasMovidas: cajasARestar,
      piezasMovidas: piezasSueltas,
      bodega: loteActual?.bodega || 'General',
      loteId: refillCurrentLoteId,
      stockAnterior: stockActual,
      stockNuevo: nuevoStock,
      fecha: timestamp,
      realizadoPor: usuario
    });

    refillTodayCajas += cajasARestar;
    refillTodayPiezas += piezasSueltas;
    updateRefillTodayUI();

    showToast(`🧩 ${piezasSueltas} piezas movidas (${cajasARestar.toFixed(2)} cajas)`, 'success');
    refreshAnalyticsNow();
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    limpiarFormularioRefillSafe();
    document.getElementById('refill-barcode')?.focus();

  } catch (error) {
    showToast('❌ Error: ' + error.message, 'error');
  }
}

// ============================================================
// SALIDA DE STOCK (BODEGA → PISO)
// ============================================================
async function handleRefillExitSafe() {
  if (!refillCurrentProduct?._exists) {
    showToast('⚠️ Escanea un producto existente', 'warning');
    return;
  }

  const cajasEnteras = parseInt(document.getElementById('refill-boxes').value, 10) || 0;
  // En modo cajas nunca se debe leer el campo oculto de piezas.
  const piezasSueltas = 0;

  if (cajasEnteras === 0) {
    showToast('⚠️ Ingresa la cantidad de cajas', 'warning');
    return;
  }

  const piezasPorCaja = parseInt(refillCurrentProduct.piezasPorCaja) || 1;
  const cajasAMover = cajasEnteras + (piezasSueltas / piezasPorCaja);
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

  const lotesProducto = Array.isArray(refillCurrentProduct.lotes) ? refillCurrentProduct.lotes : [];
  const loteActual = lotesProducto.find(l => l.loteId === refillCurrentLoteId);
  const stockActual = parseFloat(loteActual?.stock) || 0;
  const productName = refillCurrentProduct.nombre;
  const timestamp   = Date.now();
  const usuario     = firebase.auth().currentUser?.email || 'sistema';
  const codigo      = refillCurrentProduct.codigoBarras;

  console.log('🚀 [REFILL v9.2] Iniciando salida BODEGA→PISO:', {
    codigo,
    det,
    loteId: refillCurrentLoteId,
    stockActualEnBodega: stockActual,
    cajasAExtraer: cajasAMover,
    piezasEquivalentes: piezasMovidas,
    regla: 'BODEGA=CAJAS_ENTERAS_SOLO'
  });

  if (!loteActual) {
    showToast('❌ El lote seleccionado ya no está disponible. Vuelve a buscar el producto.', 'error');
    return;
  }

  if (cajasAMover > stockActual) {
    showToast(`❌ Stock insuficiente en ${loteActual.bodega || 'esta bodega'}. Disponible: ${displayValue(stockActual)} cajas`, 'error');
    return;
  }

  try {
    // Actualización atómica del lote elegido. Si el stock cambia mientras se
    // guarda o el lote desaparece, Firebase cancela toda la operación.
    const safeCode = sanitizeBarcode(codigo);
    const productRef = firebase.database().ref(`productos/${det}/${safeCode}`);
    let consumo = null;
    const transactionResult = await productRef.transaction((productoActual) => {
      if (!productoActual) return;

      const loteSeleccionado = productoActual.lotes?.[refillCurrentLoteId];
      const esLegacy = !productoActual.lotes && refillCurrentLoteId === 'legacy';
      if (!loteSeleccionado && !esLegacy) return;

      const anterior = parseFloat(
        esLegacy ? productoActual.stockTotal : loteSeleccionado.stock
      ) || 0;
      if (anterior + 0.000001 < cajasAMover) return;

      const nuevo = roundCajas(anterior - cajasAMover);
      if (esLegacy) productoActual.stockTotal = nuevo;
      else productoActual.lotes[refillCurrentLoteId].stock = nuevo;

      productoActual.fechaActualizacion = timestamp;
      productoActual.actualizadoPor = usuario;
      consumo = {
        loteId: refillCurrentLoteId,
        bodega: esLegacy
          ? (productoActual.ubicacion || 'General')
          : (loteSeleccionado.bodega || 'General'),
        tomado: roundCajas(cajasAMover),
        stockAnterior: anterior,
        stockNuevo: nuevo
      };
      return productoActual;
    }, undefined, false);

    if (!transactionResult.committed || !consumo) {
      throw new Error('STOCK_INSUFICIENTE_LOTE');
    }

    await firebase.database()
      .ref(`movimientos/${det}`).push({
        tipo: 'salida',
        productoNombre: refillCurrentProduct.nombre,
        productoCodigo: codigo,
        marca: refillCurrentProduct.marca || 'Otra',
        cajasMovidas: cajasAMover,
        piezasMovidas: piezasMovidas,
        bodega: consumo.bodega,
        loteId: consumo.loteId,
        stockAnterior: consumo.stockAnterior,
        stockNuevo: consumo.stockNuevo,
        detalleLotes: [consumo],
        fecha: timestamp,
        realizadoPor: usuario
      });

    refillTodayCajas  += cajasAMover;
    refillTodayPiezas += piezasMovidas;
    updateRefillTodayUI();

    showToast(`📤 ${displayValue(cajasAMover)} cajas de ${productName} movidas desde ${consumo.bodega}`, 'success');
    refreshAnalyticsNow();
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    limpiarFormularioRefillSafe(true);
    document.getElementById('refill-barcode')?.focus();

  } catch (error) {
    if (error.message === 'STOCK_INSUFICIENTE' || error.message === 'STOCK_INSUFICIENTE_LOTE') {
      showToast('❌ Stock insuficiente en esta bodega. Reintenta.', 'error');
    } else {
      showToast('❌ Error: ' + error.message, 'error');
    }
  }
}

// ============================================================
// ENTRADA DE STOCK (PROVEEDOR → BODEGA O PISO DIRECTO)
// ============================================================
async function handleRefillEntrySafe() {
  if (!refillCurrentProduct) {
    showToast('⚠️ Primero escanea un producto', 'warning');
    return;
  }

  // ✅ FIX LÓGICO v9.2: Separación clara BODEGA vs PISO
  const cajasEnteras = parseInt(document.getElementById('refill-boxes').value) || 0;
  const piezasSueltas = parseInt(document.getElementById('refill-pieces').value) || 0;

  if (cajasEnteras === 0 && piezasSueltas === 0) {
    showToast('⚠️ Ingresa una cantidad (cajas o piezas)', 'warning');
    return;
  }

  // En productos nuevos o recuperados del catálogo, respeta cualquier
  // corrección que el promotor haga antes de registrar la entrada.
  const piezasPorCaja = parseInt(document.getElementById('refill-piezas').value)
                      || parseInt(refillCurrentProduct.piezasPorCaja)
                      || 1;

  // ✅ FIX: En ENTRADA, permitir AMBAS opciones:
  // - Cajas enteras van a BODEGA
  // - Piezas sueltas van DIRECTAMENTE al PISO (sin sumarlas a las cajas)
  const cajasAAgregar = cajasEnteras; // CAJAS ENTERAS a bodega
  const piezasAAgregar = (cajasEnteras * piezasPorCaja) + piezasSueltas; // Total para auditoría

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
      refreshAnalyticsNow();

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

      try {
        await firebase.database().ref().update(updates);
      } catch (dbError) {
        console.error('❌ [REFILL] Error Firebase al actualizar productos:', dbError.code, dbError.message);
        if (dbError.code === 'PERMISSION_DENIED') {
          throw new Error('Permiso denegado al actualizar inventario. Contacta al administrador.');
        }
        throw dbError;
      }

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
      refreshAnalyticsNow();
    }

    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    limpiarFormularioRefillSafe(true);
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
  if (marca) {
    marca.disabled = false;
    marca.style.background = '#fff';
  }
  const warehouse = document.getElementById('refill-warehouse');
  if (warehouse) { warehouse.readOnly = false; warehouse.style.background = '#fff'; }
  const expiryGroup = document.getElementById('refill-expiry-date-group');
  if (expiryGroup) expiryGroup.style.display = 'block';
}

// ============================================================
// LIMPIAR FORMULARIO
// ============================================================
function limpiarFormularioRefillSafe(preserveMode = false) {
  const previousMode = refillMode;
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
  if (marca) {
    marca.disabled = true;
    marca.style.background = '#f8fafc';
  }

  const warehouse = document.getElementById('refill-warehouse');
  if (warehouse) { warehouse.readOnly = true; warehouse.style.background = '#f8fafc'; }

  const expiryGroup = document.getElementById('refill-expiry-date-group');
  if (expiryGroup) expiryGroup.style.display = 'none';

  const infoDiv = document.getElementById('refill-product-info');
  if (infoDiv) infoDiv.style.display = 'none';

  refillCurrentProduct = null;
  refillCurrentLoteId  = null;
  setRefillModeSafe(preserveMode ? previousMode : 'exit');
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

function refreshAnalyticsNow() {
  try {
    if (typeof window.loadStats === 'function') {
      window.loadStats();
    } else if (typeof window.reloadAnalytics === 'function') {
      window.reloadAnalytics();
    }
  } catch (_) {}
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
  document.getElementById('btn-refill-mode-pieces')
    ?.addEventListener('click', () => setRefillModeSafe('pieces'));

  document.getElementById('refill-form')
    ?.addEventListener('submit', handleRefillSubmitSafe);

  document.getElementById('refill-barcode')
    ?.addEventListener('keydown', (e) => {
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
