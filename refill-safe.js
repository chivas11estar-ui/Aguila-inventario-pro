// ============================================================
// Águila Inventario Pro - refill-safe.js (V6 - FULL INTEGRATION)
// Sincronizado con Excel, Promedios y Auditoría
// Copyright © 2026 José A. G. Betancourt
// ============================================================

'use strict';

let refillCurrentProduct = null;
let refillCurrentLoteId = null;
let refillMode = 'exit';

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

function renderLoteSelector(lotes) {
  const infoDiv = document.getElementById('refill-product-info');
  if (!infoDiv) return;
  infoDiv.style.display = 'block';

  const validLotes = lotes.filter(l => l.stock > 0);
  let html = `<div style="padding:10px; background:rgba(59,130,246,0.1); border-radius:12px; margin-bottom:15px;">
                <h4 style="margin:0;">📦 Stock Total: ${refillCurrentProduct.stockTotal} cajas</h4>
              </div>`;

  if (validLotes.length > 0) {
    html += `<p style="font-size:11px; opacity:0.7;">${refillMode === 'entry' ? 'Selecciona destino:' : 'Selecciona bodega o deja vacío para "Auto-Relleno":'}</p>
             <div style="display:grid; gap:8px;">`;
    validLotes.forEach(l => {
      html += `<div onclick="seleccionarLote('${l.loteId}', '${l.bodega}')" id="lote-btn-${l.loteId}"
                style="padding:12px; border-radius:10px; border:2px solid var(--border); cursor:pointer; display:flex; justify-content:space-between;">
                <strong>📍 ${l.bodega}</strong> <span>${l.stock} pzs</span>
               </div>`;
    });
    html += `</div>`;
  }
  infoDiv.innerHTML = html;
  refillCurrentLoteId = null;
}

window.seleccionarLote = function(id, bodega) {
  refillCurrentLoteId = id;
  document.querySelectorAll('[id^="lote-btn-"]').forEach(el => {
    el.style.borderColor = el.id === 'lote-btn-' + id ? 'var(--primary)' : 'var(--border)';
  });
  document.getElementById('refill-warehouse').value = bodega;
};

// 3. PROCESAMIENTO Y ACTUALIZACIÓN DE ANALÍTICA
window.handleRefillSubmitSafe = async function(event) {
  if (event) event.preventDefault();
  if (!refillCurrentProduct) return showToast('⚠️ Escanea primero', 'warning');

  const boxes = parseFloat(document.getElementById('refill-boxes').value) || 0;
  const pieces = parseInt(document.getElementById('refill-pieces').value) || 0;
  const ppc = parseInt(refillCurrentProduct.piezasPorCaja) || 1;
  const totalCajas = boxes + (pieces / ppc);

  if (totalCajas <= 0) return showToast('⚠️ Cantidad inválida', 'warning');

  try {
    const det = await getCachedDeterminante();
    let result;

    if (refillMode === 'entry') {
      const bodega = document.getElementById('refill-warehouse').value || 'General';
      const loteId = generarLoteId(bodega, '');
      await modificarStock(refillCurrentProduct.codigoBarras, totalCajas, 'sumar', loteId);
      result = { detalle: [{ bodega, tomado: totalCajas }] };
    } else {
      if (refillCurrentLoteId) {
        await modificarStock(refillCurrentProduct.codigoBarras, totalCajas, 'restar', refillCurrentLoteId);
        result = { detalle: [{ bodega: document.getElementById('refill-warehouse').value, tomado: totalCajas }] };
      } else {
        result = await modificarStockMultiLote(refillCurrentProduct.codigoBarras, totalCajas);
      }
    }

    // REGISTRO EXACTO PARA EXCEL (Schema Sincronizado)
    await firebase.database().ref(`movimientos/${det}`).push({
      tipo: refillMode === 'entry' ? 'entrada' : 'salida',
      productoNombre: refillCurrentProduct.nombre,
      productoCodigo: refillCurrentProduct.codigoBarras,
      marca: refillCurrentProduct.marca || 'Otra',
      cajasMovidas: totalCajas,
      piezasMovidas: Math.round(totalCajas * ppc),
      bodegasafectadas: result.detalle,
      fecha: Date.now(),
      usuario: firebase.auth().currentUser?.email || 'sistema'
    });

    // REFRESCAR TODO EL SISTEMA AL INSTANTE
    if (typeof window.loadStats === 'function') await window.loadStats();
    if (typeof window.loadInventory === 'function') await window.loadInventory();

    showToast('✅ Éxito: Inventario y Estadísticas actualizadas', 'success');
    limpiarFormularioRefillSafe();
    if (navigator.vibrate) navigator.vibrate([50, 30, 50]);

  } catch (e) { showToast('❌ ' + e.message, 'error'); }
};

window.limpiarFormularioRefillSafe = function() {
  document.getElementById('refill-form')?.reset();
  const info = document.getElementById('refill-product-info');
  if (info) info.style.display = 'none';
  refillCurrentProduct = null;
  refillCurrentLoteId = null;
};

// 4. EVENTOS
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('refill-form')?.addEventListener('submit', window.handleRefillSubmitSafe);
  document.getElementById('refill-barcode')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); window.searchProductForRefillSafe(e.target.value); }
  });
  document.getElementById('btn-refill-mode-exit')?.addEventListener('click', () => window.setRefillModeSafe('exit'));
  document.getElementById('btn-refill-mode-pieces')?.addEventListener('click', () => window.setRefillModeSafe('pieces'));
  document.getElementById('btn-refill-mode-entry')?.addEventListener('click', () => window.setRefillModeSafe('entry'));
});
