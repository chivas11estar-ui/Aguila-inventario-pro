// ============================================================
// Águila Inventario Pro - refill-safe.js (V3 - Multi-Lote)
// Soporta múltiples bodegas con Auto-Relleno Inteligente
// Copyright © 2026 José A. G. Betancourt
// ============================================================

'use strict';

let refillCurrentProduct = null;
let refillCurrentLoteId = null;
let refillMode = 'exit';
let refillTodayCajas = 0;
let refillTodayPiezas = 0;

function setRefillModeSafe(mode) {
  refillMode = mode;
  const btnEntry = document.getElementById('btn-refill-mode-entry');
  const btnExit  = document.getElementById('btn-refill-mode-exit');
  const btnPieces = document.getElementById('btn-refill-mode-pieces');
  const expiryGroup   = document.getElementById('refill-expiry-date-group');
  const warehouseInput = document.getElementById('refill-warehouse');
  const boxesLabel    = document.getElementById('refill-boxes-label');
  const submitBtn     = document.querySelector('#refill-form button[type="submit"]');
  
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
  } else if (mode === 'pieces') {
    btnPieces?.classList.replace('secondary', 'warning');
    if (btnPieces) btnPieces.style.opacity = 1;
    if (expiryGroup) expiryGroup.style.display = 'none';
    if (warehouseInput) { warehouseInput.readOnly = true; warehouseInput.style.background = '#f8fafc'; }
    if (submitBtn) { submitBtn.textContent = '🧩 Registrar Piezas'; submitBtn.classList.replace('success','primary'); }
  } else {
    btnExit?.classList.replace('secondary', 'primary');
    if (btnExit) btnExit.style.opacity = 1;
    if (expiryGroup) expiryGroup.style.display = 'none';
    if (warehouseInput) { warehouseInput.readOnly = true; warehouseInput.style.background = '#f8fafc'; }
    if (boxesLabel) boxesLabel.textContent = 'Cajas a MOVER';
    if (submitBtn) { submitBtn.textContent = '✅ Registrar Movimiento'; submitBtn.classList.replace('success','primary'); }
  }
}

async function searchProductForRefillSafe(barcode) {
  if (!barcode || barcode.trim().length < 8) return;
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
      return;
    }
    refillCurrentProduct = producto;
    document.getElementById('refill-nombre').value  = producto.nombre || '';
    document.getElementById('refill-marca').value   = producto.marca  || '';
    document.getElementById('refill-piezas').value  = producto.piezasPorCaja || '';
    document.getElementById('refill-warehouse').value = '';
    const lotesValidos = (producto.lotes || []).filter(l => (parseFloat(l.stock) || 0) > 0);
    renderLoteSelector(lotesValidos);
  } catch (error) {
    showToast('❌ Error al buscar: ' + error.message, 'error');
  }
}

function renderLoteSelector(lotes) {
  const infoDiv = document.getElementById('refill-product-info');
  if (!infoDiv) return;
  infoDiv.style.display = 'block';
  if (lotes.length === 0) {
    infoDiv.innerHTML = `<div style="padding:12px;background:#fef3c7;border-left:4px solid #f59e0b;border-radius:8px;"><strong style="color:#92400e;">⚠️ Sin stock en bodegas</strong></div>`;
    refillCurrentLoteId = null;
    return;
  }
  const totalStock = lotes.reduce((s, l) => s + l.stock, 0);
  infoDiv.innerHTML = `
    <div style="padding:14px;background:#e0f2fe;border-left:4px solid #0284c7;border-radius:8px;">
      <div style="font-weight:700;color:#0c4a6e;margin-bottom:8px;">📦 Stock total: ${totalStock} cajas</div>
      <div style="font-size:13px;color:#075985;margin-bottom:10px;">
        ${refillMode === 'exit' ? '<strong>Tip:</strong> Pon la cantidad y pulsa registrar para auto-descontar, o selecciona una bodega específica:' : 'Selecciona bodega destino:'}
      </div>
      <div id="lote-selector" style="display:flex;flex-direction:column;gap:8px;">
        ${lotes.map(l => `
          <div onclick="seleccionarLote('${l.loteId}', '${l.bodega}', '${l.fechaCaducidad}', ${l.stock})" class="lote-card" id="lote-btn-${l.loteId}" style="padding:10px;border:2px solid #e5e7eb;border-radius:8px;cursor:pointer;">
            <strong>📍 ${l.bodega}</strong> | ${l.stock} cajas ${l.fechaCaducidad ? `(Vence: ${l.fechaCaducidad})` : ''}
          </div>
        `).join('')}
      </div>
    </div>`;
  refillCurrentLoteId = null;
}

window.seleccionarLote = function(loteId, bodega, fecha, stock) {
  refillCurrentLoteId = loteId;
  document.querySelectorAll('[id^="lote-btn-"]').forEach(el => {
    el.style.border = el.id === 'lote-btn-' + loteId ? '2px solid #2563eb' : '2px solid #e5e7eb';
    el.style.background = el.id === 'lote-btn-' + loteId ? '#eff6ff' : '';
  });
  document.getElementById('refill-warehouse').value = bodega;
};

async function handleRefillSubmitSafe(event) {
  event.preventDefault();
  const cajasEnteras = parseInt(document.getElementById('refill-boxes').value) || 0;
  const piezasSueltas = parseInt(document.getElementById('refill-pieces').value) || 0;
  if (cajasEnteras === 0 && piezasSueltas === 0) return showToast('⚠️ Ingresa una cantidad', 'warning');

  const piezasPorCaja = parseInt(refillCurrentProduct.piezasPorCaja) || 1;
  const cajasAMover = cajasEnteras + (piezasSueltas / piezasPorCaja);
  const det = await getCachedDeterminante();

  try {
    let result;
    if (refillCurrentLoteId) {
      const nuevoStock = await modificarStock(refillCurrentProduct.codigoBarras, cajasAMover, 'restar', refillCurrentLoteId);
      result = { detalle: [{ loteId: refillCurrentLoteId, tomado: cajasAMover }] };
    } else if (refillMode !== 'entry') {
      result = await modificarStockMultiLote(refillCurrentProduct.codigoBarras, cajasAMover);
    }

    if (refillMode === 'entry') { /* Lógica de entrada normal */ }

    showToast(`✅ Movimiento registrado con éxito`, 'success');
    limpiarFormularioRefillSafe();
  } catch (e) { showToast('❌ Error: ' + e.message, 'error'); }
}
