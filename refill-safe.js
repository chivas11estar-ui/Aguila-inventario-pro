// ============================================================
// Águila Inventario Pro - refill-safe.js (V5 - VERSIÓN FINAL PRO)
// Soporta múltiples bodegas con Auto-Relleno Inteligente
// Copyright © 2026 José A. G. Betancourt
// ============================================================

'use strict';

let refillCurrentProduct = null;
let refillCurrentLoteId = null;
let refillMode = 'exit';

// 1. CONFIGURACIÓN DE MODOS
window.setRefillModeSafe = function(mode) {
  refillMode = mode;
  const btnEntry = document.getElementById('btn-refill-mode-entry');
  const btnExit  = document.getElementById('btn-refill-mode-exit');
  const btnPieces = document.getElementById('btn-refill-mode-pieces');
  const boxesLabel = document.getElementById('refill-boxes-label');
  const submitBtn = document.querySelector('#refill-form button[type="submit"]');

  [btnEntry, btnExit, btnPieces].forEach(btn => {
    if (btn) {
        btn.style.opacity = '0.5';
        btn.style.transform = 'scale(0.95)';
    }
  });

  const activeBtn = mode === 'entry' ? btnEntry : (mode === 'pieces' ? btnPieces : btnExit);
  if (activeBtn) {
      activeBtn.style.opacity = '1';
      activeBtn.style.transform = 'scale(1.05)';
  }

  if (boxesLabel) boxesLabel.textContent = mode === 'entry' ? 'Cajas a AÑADIR' : 'Cajas a MOVER';
  if (submitBtn) {
      submitBtn.textContent = mode === 'entry' ? '➕ Registrar Entrada' : '✅ Registrar Movimiento';
      submitBtn.className = mode === 'entry' ? 'success' : 'primary';
  }
};

// 2. BÚSQUEDA DE PRODUCTO
window.searchProductForRefillSafe = async function(barcode) {
  if (!barcode || barcode.trim().length < 8) return;

  const barcodeInput = document.getElementById('refill-barcode');
  if (barcodeInput) barcodeInput.disabled = true;

  try {
    const producto = await buscarProductoPorCodigo(barcode);
    if (!producto || !producto._exists) {
      showToast('❌ Producto no registrado en el sistema', 'error');
      limpiarFormularioRefillSafe();
      return;
    }

    refillCurrentProduct = producto;
    document.getElementById('refill-nombre').value = producto.nombre || '';
    document.getElementById('refill-marca').value = producto.marca || '';
    document.getElementById('refill-piezas').value = producto.piezasPorCaja || 0;

    // Mostrar selector de bodegas
    const lotesValidos = (producto.lotes || []).filter(l => l.stock > 0);
    renderLoteSelector(lotesValidos);

  } catch (error) {
    showToast('❌ Error: ' + error.message, 'error');
  } finally {
    if (barcodeInput) barcodeInput.disabled = false;
  }
};

function renderLoteSelector(lotes) {
  const infoDiv = document.getElementById('refill-product-info');
  if (!infoDiv) return;
  infoDiv.style.display = 'block';

  const totalStock = refillCurrentProduct.stockTotal || 0;
  let html = `<div class="card" style="background:var(--bg); border:none; margin:0 0 15px 0;">
                <h4 style="margin:0; color:var(--primary);">📦 Stock en Tienda: ${totalStock} cajas</h4>
              </div>`;

  if (lotes.length > 0) {
    html += `<p style="font-size:11px; margin-bottom:8px; opacity:0.7;">${refillMode === 'exit' ? 'Toca una bodega o deja vacío para "Auto-Relleno":' : 'Selecciona bodega destino:'}</p>
             <div id="lote-selector" style="display:grid; grid-template-columns:1fr; gap:10px;">`;
    lotes.forEach(l => {
      html += `<div onclick="seleccionarLote('${l.loteId}', '${l.bodega}', ${l.stock})" id="lote-btn-${l.loteId}"
                style="padding:15px; border-radius:12px; cursor:pointer; border:2px solid var(--border); background:var(--surface); display:flex; justify-content:space-between;">
                <span><strong>📍 ${l.bodega}</strong></span>
                <span style="color:var(--primary); font-weight:800;">${l.stock} cajas</span>
               </div>`;
    });
    html += `</div>`;
  } else {
    html += `<div style="padding:15px; background:rgba(245,158,11,0.1); color:var(--warning); border-radius:12px;">⚠️ No hay stock disponible en ninguna bodega.</div>`;
  }

  infoDiv.innerHTML = html;
  refillCurrentLoteId = null;
}

window.seleccionarLote = function(loteId, bodega, stock) {
  refillCurrentLoteId = loteId;
  document.querySelectorAll('[id^="lote-btn-"]').forEach(el => {
    el.style.borderColor = el.id === 'lote-btn-' + loteId ? 'var(--primary)' : 'var(--border)';
    el.style.background = el.id === 'lote-btn-' + loteId ? 'rgba(59, 130, 246, 0.05)' : 'var(--surface)';
  });
  const whInput = document.getElementById('refill-warehouse');
  if (whInput) whInput.value = bodega;
};

// 3. PROCESAR MOVIMIENTO
window.handleRefillSubmitSafe = async function(event) {
  if (event) event.preventDefault();

  if (!refillCurrentProduct) {
    showToast('⚠️ Escanea un producto primero', 'warning');
    return;
  }

  const boxes = parseFloat(document.getElementById('refill-boxes').value) || 0;
  const pieces = parseInt(document.getElementById('refill-pieces').value) || 0;
  const piezasPorCaja = parseInt(refillCurrentProduct.piezasPorCaja) || 1;
  const totalCajasAMover = boxes + (pieces / piezasPorCaja);

  if (totalCajasAMover <= 0) {
    showToast('⚠️ Ingresa una cantidad mayor a cero', 'warning');
    return;
  }

  try {
    const det = await getCachedDeterminante();
    let result;
    const ahora = Date.now();

    if (refillMode === 'entry') {
      const bodega = document.getElementById('refill-warehouse').value || 'General';
      const loteId = generarLoteId(bodega, '');
      await modificarStock(refillCurrentProduct.codigoBarras, totalCajasAMover, 'sumar', loteId);
      result = { detalle: [{ bodega, tomado: totalCajasAMover }] };
    } else {
      if (refillCurrentLoteId) {
        await modificarStock(refillCurrentProduct.codigoBarras, totalCajasAMover, 'restar', refillCurrentLoteId);
        result = { detalle: [{ bodega: document.getElementById('refill-warehouse').value, tomado: totalCajasAMover }] };
      } else {
        result = await modificarStockMultiLote(refillCurrentProduct.codigoBarras, totalCajasAMover);
      }
    }

    // Registro de Auditoría
    await firebase.database().ref(`movimientos/${det}`).push({
      tipo: refillMode === 'entry' ? 'entrada' : 'salida',
      producto: refillCurrentProduct.nombre,
      codigo: refillCurrentProduct.codigoBarras,
      cantidadCajas: totalCajasAMover,
      bodegasafectadas: result.detalle,
      fecha: ahora,
      usuario: firebase.auth().currentUser?.email || 'desconocido'
    });

    showToast('✅ Movimiento guardado correctamente', 'success');
    limpiarFormularioRefillSafe();
    if (navigator.vibrate) navigator.vibrate([50, 30, 50]);

  } catch (error) {
    showToast('❌ Error: ' + (error.message === 'STOCK_INSUFICIENTE' ? 'Stock insuficiente en bodega' : error.message), 'error');
  }
};

window.limpiarFormularioRefillSafe = function() {
  document.getElementById('refill-form')?.reset();
  const info = document.getElementById('refill-product-info');
  if (info) info.style.display = 'none';
  refillCurrentProduct = null;
  refillCurrentLoteId = null;
  document.getElementById('refill-barcode')?.focus();
};

// 4. INICIALIZACIÓN DE EVENTOS (Blindado)
document.addEventListener('DOMContentLoaded', () => {
  // Manejo de formulario
  document.getElementById('refill-form')?.addEventListener('submit', window.handleRefillSubmitSafe);

  // Manejo de teclado (Enter)
  document.getElementById('refill-barcode')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      window.searchProductForRefillSafe(e.target.value);
    }
  });

  // Manejo de botones de modo
  document.getElementById('btn-refill-mode-exit')?.addEventListener('click', () => window.setRefillModeSafe('exit'));
  document.getElementById('btn-refill-mode-pieces')?.addEventListener('click', () => window.setRefillModeSafe('pieces'));
  document.getElementById('btn-refill-mode-entry')?.addEventListener('click', () => window.setRefillModeSafe('entry'));

  // Manejo del botón de cámara
  document.getElementById('btn-scan-refill')?.addEventListener('click', () => {
    if (typeof openScanner === 'function') {
      openScanner((code) => {
        const input = document.getElementById('refill-barcode');
        if (input) input.value = code;
        window.searchProductForRefillSafe(code);
      });
    }
  });
});
