// ============================================================
// Águila Inventario Pro - refill-safe.js (V6 - FULL INTEGRATION)
// Sincronizado con Excel, Promedios y Auditoría
// Copyright © 2026 José A. G. Betancourt
// ============================================================

'use strict';

let refillCurrentProduct = null;
let refillCurrentLoteId = null;
let refillMode = 'exit';
let refillIsNewProduct = false;
let refillSubmitInProgress = false;

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
function setRefillProductFieldsForEntry(isNewProduct) {
  const nameInput = document.getElementById('refill-nombre');
  const brandInput = document.getElementById('refill-marca');
  const piecesInput = document.getElementById('refill-piezas');
  const warehouseInput = document.getElementById('refill-warehouse');
  const expiryGroup = document.getElementById('refill-expiry-date-group');

  if (nameInput) nameInput.readOnly = !isNewProduct;
  if (brandInput) brandInput.disabled = !isNewProduct;
  if (piecesInput) piecesInput.readOnly = !isNewProduct;
  if (warehouseInput) warehouseInput.readOnly = !(isNewProduct || refillMode === 'entry');
  if (expiryGroup) expiryGroup.style.display = isNewProduct ? 'block' : 'none';
}

function prepareNewRefillProduct(barcode) {
  const safeCode = typeof sanitizeBarcode === 'function' ? sanitizeBarcode(barcode) : barcode.trim();
  refillCurrentProduct = {
    codigoBarras: safeCode,
    nombre: '',
    marca: 'Otra',
    piezasPorCaja: 1,
    stockTotal: 0,
    lotes: [],
    _exists: false
  };
  refillCurrentLoteId = null;
  refillIsNewProduct = true;

  document.getElementById('refill-nombre').value = '';
  document.getElementById('refill-marca').value = '';
  document.getElementById('refill-piezas').value = '';
  document.getElementById('refill-warehouse').value = 'General';
  document.getElementById('refill-expiry-date').value = '';

  setRefillProductFieldsForEntry(true);

  const infoDiv = document.getElementById('refill-product-info');
  if (infoDiv) {
    infoDiv.style.display = 'block';
    infoDiv.innerHTML = '<strong>🆕 Producto nuevo</strong><br><small>Completa los datos para darlo de alta en esta tienda.</small>';
  }
  showToast('🆕 Producto nuevo: completa sus datos', 'info');
}

async function registrarEntradaEnLote(codigoBarras, bodega, fechaCaducidad, cantidad) {
  const det = await getCachedDeterminante();
  const safeCode = typeof sanitizeBarcode === 'function' ? sanitizeBarcode(codigoBarras) : codigoBarras;
  if (!det || !safeCode) throw new Error('No se encontró la tienda o el código');

  const loteId = generarLoteId(bodega, fechaCaducidad);
  const loteRef = firebase.database().ref(`productos/${det}/${safeCode}/lotes/${loteId}`);
  const tx = await loteRef.transaction((current) => {
    const actual = current || {};
    const stock = parseFloat(actual.stock) || 0;
    return {
      ...actual,
      bodega,
      fechaCaducidad: fechaCaducidad || '',
      stock: parseFloat((stock + cantidad).toFixed(2)),
      actualizado: Date.now()
    };
  });
  if (!tx || !tx.committed) throw new Error('No se pudo confirmar la entrada');
  return { loteId, bodega, tomado: cantidad };
}

window.searchProductForRefillSafe = async function(barcode) {
  if (!barcode || barcode.trim().length < 8) return;

  try {
    const producto = await buscarProductoPorCodigo(barcode);
    if (!producto || !producto._exists) {
      if (refillMode === 'entry') {
        prepareNewRefillProduct(barcode.trim());
      } else {
        showToast('❌ Producto no registrado', 'error');
        limpiarFormularioRefillSafe();
      }
      return;
    }

    refillCurrentProduct = producto;
    refillIsNewProduct = false;
    document.getElementById('refill-nombre').value = producto.nombre;
    document.getElementById('refill-marca').value = producto.marca || 'Otra';
    document.getElementById('refill-piezas').value = producto.piezasPorCaja || 0;
    setRefillProductFieldsForEntry(false);

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
  if (refillSubmitInProgress) return;
  if (!refillCurrentProduct) return showToast('⚠️ Escanea primero', 'warning');

  const submitBtn = document.querySelector('#refill-form button[type="submit"]');
  const boxes = parseFloat(document.getElementById('refill-boxes').value) || 0;
  const pieces = parseInt(document.getElementById('refill-pieces').value) || 0;
  const ppc = refillIsNewProduct
    ? (parseInt(document.getElementById('refill-piezas').value) || 0)
    : (parseInt(refillCurrentProduct.piezasPorCaja) || 1);
  const totalCajas = boxes + (pieces / (ppc || 1));

  if (refillIsNewProduct) {
    const name = document.getElementById('refill-nombre').value.trim();
    const brand = document.getElementById('refill-marca').value;
    const warehouse = document.getElementById('refill-warehouse').value.trim() || 'General';
    const expiry = document.getElementById('refill-expiry-date').value || '';
    if (!name || !brand || ppc < 1) return showToast('⚠️ Completa nombre, marca y piezas por caja', 'warning');
    if (totalCajas <= 0) return showToast('⚠️ Captura una cantidad mayor que cero', 'warning');
    refillCurrentProduct.nombre = name;
    refillCurrentProduct.marca = brand;
    refillCurrentProduct.piezasPorCaja = ppc;
    refillCurrentProduct._newWarehouse = warehouse;
    refillCurrentProduct._newExpiry = expiry;
  } else if (totalCajas <= 0) {
    return showToast('⚠️ Cantidad inválida', 'warning');
  }

  refillSubmitInProgress = true;
  if (submitBtn) submitBtn.disabled = true;

  try {
    const det = await getCachedDeterminante();
    if (!det) throw new Error('No se encontró la tienda');
    let result;

    if (refillIsNewProduct) {
      if (typeof window.guardarProducto !== 'function') throw new Error('Alta de producto no disponible');
      window.EDITING_PRODUCT_ID = null;
      await window.guardarProducto({
        codigoBarras: refillCurrentProduct.codigoBarras,
        nombre: refillCurrentProduct.nombre,
        marca: refillCurrentProduct.marca,
        piezasPorCaja: refillCurrentProduct.piezasPorCaja,
        ubicacion: refillCurrentProduct._newWarehouse,
        fechaCaducidad: refillCurrentProduct._newExpiry,
        cajas: totalCajas
      });
      result = { detalle: [{ bodega: refillCurrentProduct._newWarehouse, tomado: totalCajas }] };
    } else if (refillMode === 'entry') {
      const bodega = document.getElementById('refill-warehouse').value.trim() || 'General';
      const expiry = document.getElementById('refill-expiry-date').value || '';
      const lote = await registrarEntradaEnLote(refillCurrentProduct.codigoBarras, bodega, expiry, totalCajas);
      result = { detalle: [lote] };
    } else if (refillCurrentLoteId) {
      const tx = await modificarStock(refillCurrentProduct.codigoBarras, totalCajas, 'restar', refillCurrentLoteId);
      if (!tx || !tx.committed) throw new Error('Stock insuficiente o movimiento no confirmado');
      result = { detalle: [{ bodega: document.getElementById('refill-warehouse').value, tomado: totalCajas }] };
    } else {
      result = await modificarStockMultiLote(refillCurrentProduct.codigoBarras, totalCajas);
    }

    await firebase.database().ref(`movimientos/${det}`).push({
      tipo: refillMode === 'entry' ? 'entrada' : 'salida',
      productoNombre: refillCurrentProduct.nombre,
      productoCodigo: refillCurrentProduct.codigoBarras,
      marca: refillCurrentProduct.marca || 'Otra',
      cajasMovidas: totalCajas,
      piezasMovidas: Math.round(totalCajas * (refillCurrentProduct.piezasPorCaja || ppc)),
      bodegasafectadas: result.detalle,
      fecha: Date.now(),
      usuario: firebase.auth().currentUser?.email || 'sistema'
    });

    if (typeof window.loadStats === 'function') await window.loadStats();
    if (typeof window.loadInventory === 'function') await window.loadInventory();

    showToast('✅ Éxito: Inventario y Estadísticas actualizadas', 'success');
    limpiarFormularioRefillSafe();
    if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
  } catch (e) {
    showToast('❌ ' + e.message, 'error');
  } finally {
    refillSubmitInProgress = false;
    if (submitBtn) submitBtn.disabled = false;
  }
};

window.limpiarFormularioRefillSafe = function() {
  document.getElementById('refill-form')?.reset();
  const info = document.getElementById('refill-product-info');
  if (info) info.style.display = 'none';
  refillCurrentProduct = null;
  refillCurrentLoteId = null;
  refillIsNewProduct = false;
  setRefillProductFieldsForEntry(false);
};

// 4. EVENTOS
// Este módulo se carga después de autenticarse. Por eso no puede depender
// únicamente de DOMContentLoaded: cuando llega aquí, ese evento ya pudo ocurrir.
function initRefillEvents() {
  if (window.__aguilaRefillEventsBound) return;

  const form = document.getElementById('refill-form');
  if (!form) return;

  form.addEventListener('submit', window.handleRefillSubmitSafe);
  document.getElementById('refill-barcode')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      window.searchProductForRefillSafe(e.target.value);
    }
  });
  document.getElementById('btn-refill-mode-exit')?.addEventListener('click', () => window.setRefillModeSafe('exit'));
  document.getElementById('btn-refill-mode-pieces')?.addEventListener('click', () => window.setRefillModeSafe('pieces'));
  document.getElementById('btn-refill-mode-entry')?.addEventListener('click', () => window.setRefillModeSafe('entry'));

  window.__aguilaRefillEventsBound = true;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initRefillEvents, { once: true });
} else {
  initRefillEvents();
}
