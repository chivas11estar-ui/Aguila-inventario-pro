// ============================================================
// Águila Inventario Pro - audit.js (V3 - Por Bodega)
// Auditoría opera sobre lotes específicos por bodega
// Copyright © 2026 José A. G. Betancourt
// ============================================================

'use strict';

// --- STATE ---
let currentAuditWarehouse = null;
let currentAuditProduct   = null;
let currentAuditLoteId    = null;
let isQuickAuditMode      = false;
let quickAuditItems       = [];
let availableAuditWarehouses = [];

// ============================================================
// FUENTE DE VERDAD DEL ESCAPE HTML (evita XSS en datos del usuario)
// ============================================================
function escapeAuditHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Fuente única de verdad — sin onAuthStateChanged propio
function getStoreId() {
  return window.PROFILE_STATE?.determinante
      || window.INVENTORY_CORE?.determinante;
}

// ============================================================
// INICIALIZACIÓN
// ============================================================
function initAuditBindings() {
  if (window.__aguilaAuditBindingsReady) return;
  window.__aguilaAuditBindingsReady = true;

  console.log('✓ [AUDIT V3] Inicializando módulo de Auditoría...');

  document.getElementById('save-warehouse-btn').onclick = saveBodega;

  document.getElementById('audit-barcode').onkeypress = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); buscarProductoAudit(); }
  };

  document.getElementById('audit-form').onsubmit = (e) => {
    e.preventDefault();
    registrarConteo();
  };

  document.getElementById('finish-audit-btn').onclick    = finishNormalAudit;
  document.getElementById('btn-quick-audit-mode').onclick = toggleQuickAuditMode;
  document.getElementById('btn-save-quick-audit').onclick  = saveQuickAudit;
  document.getElementById('btn-cancel-quick-audit').onclick = endQuickAudit;

  // Cargar catálogo de bodegas al abrir y refrescarlo solo cuando la
  // pestaña de auditoría está activa (evita trabajo en background).
  hydrateAuditWarehouseOptions();
  window.__auditHydrateInterval = setInterval(() => {
    const auditTab = document.getElementById('tab-audit');
    if (auditTab && auditTab.classList.contains('active')) {
      hydrateAuditWarehouseOptions();
    }
  }, 10000);

  document.addEventListener('click', (e) => {
    const tabBtn = e.target.closest('[data-tab="audit"]');
    if (tabBtn) {
      ensureManualWarehouseInput();
      setTimeout(hydrateAuditWarehouseOptions, 120);
    }
  });

  ensureManualWarehouseInput();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAuditBindings);
} else {
  initAuditBindings();
}

function ensureManualWarehouseInput() {
  const select = document.getElementById('audit-warehouse');
  if (!select) return;

  let manual = document.getElementById('audit-warehouse-manual');
  if (manual) return;

  manual = document.createElement('input');
  manual.id = 'audit-warehouse-manual';
  manual.type = 'text';
  manual.placeholder = 'Si no aparece en lista, escribe la bodega aquí';
  manual.style.marginTop = '8px';

  const group = select.closest('.form-group');
  if (group) group.appendChild(manual);
}

// ============================================================
// FIJAR BODEGA
// ============================================================
function saveBodega() {
  const input   = document.getElementById('audit-warehouse');
  const manual  = document.getElementById('audit-warehouse-manual');
  const display = document.getElementById('current-warehouse-display');
  const valSelect = String(input?.value || '').trim();
  const valManual = String(manual?.value || '').trim();
  const val     = valSelect || valManual;

  if (!val) {
    showToast('⚠️ Selecciona una bodega de la lista o escríbela manualmente', 'warning');
    (manual || input).focus();
    return;
  }

  if (availableAuditWarehouses.length > 0 && !availableAuditWarehouses.includes(val) && val !== valManual) {
    showToast('⚠️ Selecciona una bodega válida de la lista', 'warning');
    input.focus();
    return;
  }

  currentAuditWarehouse = val;
  display.innerHTML = `📍 Auditando: <strong>${escapeAuditHtml(currentAuditWarehouse)}</strong>`;
  display.style.cssText = `
    background:#e0f2fe; color:#0369a1;
    padding:15px; border-radius:10px;
    border-left:5px solid #0ea5e9;
    margin-bottom:15px; font-size:14px;`;

  input.disabled = true;
  if (manual) manual.disabled = true;
  document.getElementById('save-warehouse-btn').style.display  = 'none';
  document.getElementById('finish-audit-btn').style.display    = 'block';

  showToast(`📍 Bodega fijada: ${currentAuditWarehouse}`, 'success');
  setTimeout(() => document.getElementById('audit-barcode').focus(), 300);
}

function hydrateAuditWarehouseOptions() {
  const select = document.getElementById('audit-warehouse');
  if (!select) return;

  const seen = new Set();
  const productos = window.INVENTORY_STATE?.productos || [];

  for (const p of productos) {
    const lotes = Array.isArray(p.lotes) ? p.lotes : [];
    for (const l of lotes) {
      const b = String(l?.bodega || '').trim();
      if (b) seen.add(b);
    }

    const bodegas = Array.isArray(p.bodegas) ? p.bodegas : [];
    for (const b of bodegas) {
      const name = String(b?.ubicacion || b?.bodega || '').trim();
      if (name) seen.add(name);
    }

    const legacyUbicacion = String(p?.ubicacion || '').trim();
    if (legacyUbicacion) seen.add(legacyUbicacion);
  }

  availableAuditWarehouses = Array.from(seen).sort((a, b) => a.localeCompare(b, 'es-MX'));

  // Evitar reconstruir el <select> si las opciones no cambiaron:
  // preserva la selección actual del usuario y reduce trabajo de DOM.
  const newOptionsKey = availableAuditWarehouses.join('|');
  if (newOptionsKey === window.__auditLastOptionsKey) return;
  window.__auditLastOptionsKey = newOptionsKey;

  const selectedBefore = select.value;
  const options = ['<option value="">Selecciona una bodega...</option>']
    .concat(availableAuditWarehouses.map(b => `<option value="${escapeAuditHtml(b)}">${escapeAuditHtml(b)}</option>`));
  select.innerHTML = options.join('');

  if (selectedBefore && availableAuditWarehouses.includes(selectedBefore)) {
    select.value = selectedBefore;
  }
}

// ============================================================
// BUSCAR PRODUCTO EN LA BODEGA ACTIVA
// ============================================================
async function buscarProductoAudit() {
  const barcode = document.getElementById('audit-barcode').value.trim();

  if (!currentAuditWarehouse) {
    showToast('⚠️ Selecciona primero la bodega', 'warning');
    return;
  }
  if (barcode.length < 8) return;

  const det = getStoreId();
  if (!det) {
    showToast('❌ Sin información de tienda', 'error');
    return;
  }

  try {
    const producto = await buscarProductoPorCodigo(barcode);

    if (!producto || !producto._exists) {
      showToast('❌ Producto no encontrado en el sistema', 'error');
      limpiarCamposAudit();
      return;
    }

    currentAuditProduct = producto;

    // Buscar el lote que corresponde a esta bodega
    const lotes = producto.lotes || [];
    const lotesEnBodega = lotes.filter(l =>
      l.bodega.toLowerCase().trim() === currentAuditWarehouse.toLowerCase().trim()
    );

    document.getElementById('audit-nombre').value = producto.nombre;

    if (lotesEnBodega.length === 0) {
      // Producto existe pero no tiene stock en esta bodega
      currentAuditLoteId = null;
      const info = document.getElementById('audit-stock-info');
      info.style.display = 'block';
      info.innerHTML = `
        <div style="padding:12px;background:#fef3c7;border-left:4px solid #f59e0b;border-radius:8px;">
          <strong style="color:#92400e;">⚠️ ${producto.nombre}</strong><br>
          <span style="font-size:13px;color:#b45309;">
            No hay stock registrado en "${currentAuditWarehouse}".<br>
            Si hay físicamente, ingresa la cantidad contada para crear el lote.
          </span>
        </div>`;

      document.getElementById('audit-boxes').focus();
      return;
    }

    if (lotesEnBodega.length === 1) {
      // Un solo lote en esta bodega — seleccionar automáticamente
      currentAuditLoteId = lotesEnBodega[0].loteId;
      renderAuditStockInfo(lotesEnBodega[0]);
      document.getElementById('audit-boxes').focus();
      return;
    }

    // Múltiples lotes en la misma bodega (diferentes fechas)
    renderAuditLoteSelector(lotesEnBodega);

  } catch (e) {
    console.error(e);
    showToast('❌ Error de búsqueda', 'error');
  }
}

// ============================================================
// MOSTRAR INFO DEL LOTE SELECCIONADO
// ============================================================
function renderAuditStockInfo(lote) {
  const info = document.getElementById('audit-stock-info');
  info.style.display = 'block';
  const bodega = escapeAuditHtml(lote.bodega);
  const fecha = escapeAuditHtml(lote.fechaCaducidad);
  info.innerHTML = `
    <div style="padding:12px;background:#d1fae5;border-left:4px solid #10b981;border-radius:8px;">
      <strong style="color:#065f46;">📦 Stock en sistema: ${escapeAuditHtml(lote.stock)} cajas</strong><br>
      <span style="font-size:13px;color:#047857;">
        📍 ${bodega}
        ${fecha ? ` · 📅 Vence: ${fecha}` : ''}
      </span>
    </div>`;
}

// ============================================================
// SELECTOR CUANDO HAY MÚLTIPLES LOTES EN LA BODEGA
// ============================================================
function renderAuditLoteSelector(lotes) {
  const info = document.getElementById('audit-stock-info');
  info.style.display = 'block';
  info.innerHTML = `
    <div style="padding:12px;background:#e0f2fe;border-left:4px solid #0284c7;border-radius:8px;">
      <strong style="color:#0c4a6e;">📦 Hay ${escapeAuditHtml(lotes.length)} fechas en "${escapeAuditHtml(currentAuditWarehouse)}":</strong>
      <div style="margin-top:10px;display:flex;flex-direction:column;gap:6px;">
        ${lotes.map(l => `
          <div
            class="audit-lote-btn"
            data-lote-id="${escapeAuditHtml(l.loteId)}"
            data-stock="${escapeAuditHtml(l.stock)}"
            data-bodega="${escapeAuditHtml(l.bodega)}"
            data-fecha="${escapeAuditHtml(l.fechaCaducidad)}"
            style="
              padding:10px;border-radius:8px;cursor:pointer;
              border:2px solid #bae6fd;background:#f0f9ff;
            "
          >
            <div style="font-weight:600;color:#0369a1;">
              📅 Vence: ${escapeAuditHtml(l.fechaCaducidad) || 'Sin fecha'}
            </div>
            <div style="font-size:12px;color:#0284c7;">
              ${escapeAuditHtml(l.stock)} cajas en sistema
            </div>
          </div>
        `).join('')}
      </div>
    </div>`;

  // Delegación de eventos (evita inline onclick con datos sin escapar).
  info.querySelectorAll('.audit-lote-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      window.seleccionarLoteAudit(
        btn.dataset.loteId,
        parseFloat(btn.dataset.stock) || 0,
        btn.dataset.bodega,
        btn.dataset.fecha
      );
    });
  });
}

window.seleccionarLoteAudit = function(loteId, stock, bodega, fecha) {
  currentAuditLoteId = loteId;

  document.querySelectorAll('.audit-lote-btn').forEach(el => {
    el.style.border    = el.dataset.loteId === loteId ? '2px solid #2563eb' : '2px solid #bae6fd';
    el.style.background = el.dataset.loteId === loteId ? '#eff6ff' : '#f0f9ff';
  });

  renderAuditStockInfo({ loteId, stock, bodega, fechaCaducidad: fecha });
  document.getElementById('audit-boxes').focus();
  showToast(`📅 Lote seleccionado: vence ${fecha || 'sin fecha'}`, 'info');
};

// ============================================================
// REGISTRAR CONTEO — Con Asignación Inteligente de Recepción
// ============================================================
async function registrarConteo() {
  const cajasContadas = parseInt(document.getElementById('audit-boxes').value);

  if (isNaN(cajasContadas) || !currentAuditProduct) {
    showToast('⚠️ Datos incompletos', 'warning');
    return;
  }

  const det     = getStoreId();
  const usuario = firebase.auth().currentUser?.email || 'sistema';
  const codigo  = sanitizeBarcode(currentAuditProduct.codigoBarras);

  try {
    // 1. Calcular inventario total (todas las bodegas + recepción)
    const lotes = currentAuditProduct.lotes || [];
    const loteRecepcion = lotes.find(l => l.bodega === '📥 Recepción');
    const stockRecepcion = loteRecepcion ? parseFloat(loteRecepcion.stock) || 0 : 0;

    // Stock en otras bodegas (excluyendo la actual y recepción)
    const stockOtrasBodegas = lotes
      .filter(l => l.bodega !== currentAuditWarehouse && l.bodega !== '📥 Recepción')
      .reduce((sum, l) => sum + (parseFloat(l.stock) || 0), 0);

    const loteActual = lotes.find(l => l.loteId === currentAuditLoteId);
    const stockActualSistema = loteActual ? parseFloat(loteActual.stock) || 0 : 0;

    const stockTotalConocido = stockActualSistema + stockOtrasBodegas + stockRecepcion;
    const stockResultante = cajasContadas + stockOtrasBodegas;

    // 2. ¿Hay un excedente no registrado? (Cajas que no estaban ni en bodega ni en recepción)
    if (stockResultante > stockTotalConocido) {
      const excedente = stockResultante - stockTotalConocido;
      const confirmar = confirm(`⚠️ Hay ${excedente.toFixed(2)} cajas más de las registradas.\n¿Deseas agregarlas como stock nuevo o prefieres recontar?`);
      if (!confirmar) return; // Aborta para que el usuario reconte
    }

    // 3. Lógica de balanceo: Restar de recepción lo que ahora está en esta bodega
    let nuevoStockRecepcion = stockRecepcion;
    if (stockRecepcion > 0) {
      const diferenciaBodega = cajasContadas - stockActualSistema;
      if (diferenciaBodega > 0) {
        // Estamos encontrando producto en esta bodega: lo tomamos de la "Recepción"
        const tomadoDeRecepcion = Math.min(diferenciaBodega, stockRecepcion);
        nuevoStockRecepcion = parseFloat((stockRecepcion - tomadoDeRecepcion).toFixed(2));
        if (tomadoDeRecepcion > 0) {
          showToast(`📦 Se asignaron ${tomadoDeRecepcion} cajas desde Recepción`, 'info');
        }
      }
    }

    // 4. Preparar actualizaciones masivas (Atomic)
    const updates = {};
    const ahora = Date.now();

    // Actualizar bodega actual
    let targetLoteId = currentAuditLoteId;
    if (!targetLoteId) {
      const fechaCad = document.getElementById('audit-expiry-date')?.value || '';
      targetLoteId = generarLoteId(currentAuditWarehouse, fechaCad);
      updates[`productos/${det}/${codigo}/lotes/${targetLoteId}/bodega`] = currentAuditWarehouse;
      updates[`productos/${det}/${codigo}/lotes/${targetLoteId}/fechaCaducidad`] = fechaCad;
    }
    updates[`productos/${det}/${codigo}/lotes/${targetLoteId}/stock`] = cajasContadas;
    updates[`productos/${det}/${codigo}/lotes/${targetLoteId}/actualizado`] = ahora;

    // Actualizar lote de Recepción si cambió
    if (loteRecepcion && nuevoStockRecepcion !== stockRecepcion) {
      if (nuevoStockRecepcion <= 0) {
        updates[`productos/${det}/${codigo}/lotes/${loteRecepcion.loteId}`] = null; // Eliminar si queda en 0
      } else {
        updates[`productos/${det}/${codigo}/lotes/${loteRecepcion.loteId}/stock`] = nuevoStockRecepcion;
        updates[`productos/${det}/${codigo}/lotes/${loteRecepcion.loteId}/actualizado`] = ahora;
      }
    }

    updates[`productos/${det}/${codigo}/fechaActualizacion`] = ahora;
    updates[`productos/${det}/${codigo}/actualizadoPor`] = usuario;

    // Guardar en Firebase
    await firebase.database().ref().update(updates);

    // Registrar en historial de auditoría
    await firebase.database().ref(`auditorias/${det}`).push({
      producto: currentAuditProduct.nombre,
      codigo,
      bodega: currentAuditWarehouse,
      loteId: targetLoteId,
      esperado: stockActualSistema,
      contado: cajasContadas,
      diferencia: cajasContadas - stockActualSistema,
      tomadoDeRecepcion: stockRecepcion - nuevoStockRecepcion,
      fecha: getLocalISOString(),
      usuario,
      modo: 'normal_inteligente'
    });

    showToast('✅ Conteo registrado y stock balanceado', 'success');
    limpiarCamposAudit();

  } catch (e) {
    console.error(e);
    showToast('❌ Error al guardar', 'error');
  }
}

// ============================================================
// AUDITORÍA RÁPIDA
// ============================================================
function toggleQuickAuditMode() {
  isQuickAuditMode = !isQuickAuditMode;
  if (isQuickAuditMode) {
    if (!currentAuditWarehouse) {
      showToast('⚠️ Primero selecciona una bodega', 'warning');
      document.getElementById('audit-warehouse').focus();
      isQuickAuditMode = false;
      return;
    }
    startQuickAudit();
  } else {
    endQuickAudit();
  }
}

function startQuickAudit() {
  console.log('⚡ Iniciando Auditoría Rápida en:', currentAuditWarehouse);
  quickAuditItems = [];

  document.getElementById('audit-normal-form').classList.add('hidden');
  document.getElementById('audit-quick-scan-container').classList.remove('hidden');
  document.getElementById('btn-quick-audit-mode').textContent = '⏹️ Terminar Auditoría Rápida';
  document.getElementById('btn-quick-audit-mode').classList.replace('secondary', 'warning');

  renderQuickAuditList();

  window.openScanner({
    onScan: handleQuickAuditScan,
    continuous: true
  });
}

async function handleQuickAuditScan(barcode) {
  const existingItem = quickAuditItems.find(i => i.codigoBarras === barcode);

  if (existingItem) {
    existingItem.quantity++;
    showToast(`+1 ${existingItem.nombre} (${existingItem.quantity} total)`, 'info');
    renderQuickAuditList();
    return;
  }

  const productData = await fetchProductDataForBodega(barcode);
  if (productData) {
    quickAuditItems.push({ ...productData, quantity: 1 });
    showToast(`+1 ${productData.nombre}`, 'info');
  } else {
    showToast(`❌ Código ${barcode} no encontrado`, 'error');
  }
  renderQuickAuditList();
}

// Busca el lote del producto en la bodega activa
async function fetchProductDataForBodega(barcode) {
  const det = getStoreId();
  if (!det) return null;

  const safeCode = sanitizeBarcode(barcode);
  if (!safeCode) return null;

  try {
    const producto = await buscarProductoPorCodigo(barcode);
    if (!producto || !producto._exists) return null;

    // Buscar lote en la bodega activa
    const lotes = producto.lotes || [];
    const loteEnBodega = lotes.find(l =>
      l.bodega.toLowerCase().trim() === currentAuditWarehouse.toLowerCase().trim()
    );

    return {
      id:           safeCode,
      nombre:       producto.nombre,
      marca:        producto.marca,
      codigoBarras: barcode.trim(),
      stockSistema: loteEnBodega?.stock || 0,
      loteId:       loteEnBodega?.loteId || null,
      fechaCaducidad: loteEnBodega?.fechaCaducidad || ''
    };
  } catch (e) {
    return null;
  }
}

function renderQuickAuditList() {
  const container = document.getElementById('quick-audit-list');
  if (quickAuditItems.length === 0) {
    container.innerHTML = `
      <p style="text-align:center;color:#9ca3af;padding:20px;">
        Escanea productos en <strong>${escapeAuditHtml(currentAuditWarehouse)}</strong> para comenzar...
      </p>`;
    return;
  }

  container.innerHTML = quickAuditItems.map((item, index) => {
    const diferencia = item.quantity - item.stockSistema;
    const diffColor  = diferencia === 0 ? '#10b981' : diferencia > 0 ? '#f59e0b' : '#ef4444';
    const diffText   = diferencia === 0 ? '✅ Exacto'
                     : diferencia > 0  ? `+${diferencia} sobrante`
                     : `${diferencia} faltante`;

    const nombre = escapeAuditHtml(item.nombre);
    const codigo = escapeAuditHtml(item.codigoBarras);
    const stockSistema = escapeAuditHtml(item.stockSistema);

    return `
      <div style="
        display:flex;justify-content:space-between;align-items:center;
        padding:12px;border-bottom:1px solid #f3f4f6;
        background:${diferencia !== 0 ? 'rgba(245,158,11,0.05)' : 'white'};
      ">
        <div style="flex:1;">
          <strong style="color:#1f2937;">${nombre}</strong>
          <small style="color:#6b7280;display:block;">${codigo}</small>
          <small style="color:#9ca3af;">Sistema: ${stockSistema} cajas</small>
        </div>
        <div style="display:flex;align-items:center;gap:12px;">
          <span style="font-size:11px;color:${diffColor};font-weight:600;">${diffText}</span>
          <button data-audit-qty="-1" data-index="${index}"
            style="background:none;border:none;font-size:20px;color:#ef4444;cursor:pointer;padding:4px;">−</button>
          <span style="font-size:1.2em;font-weight:bold;min-width:30px;text-align:center;">
            ${item.quantity}
          </span>
          <button data-audit-qty="1" data-index="${index}"
            style="background:none;border:none;font-size:20px;color:#22c55e;cursor:pointer;padding:4px;">+</button>
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll('button[data-audit-qty]').forEach((btn) => {
    btn.addEventListener('click', () => {
      window.updateQuickAuditItemQuantity(parseInt(btn.dataset.index, 10), parseInt(btn.dataset.auditQty, 10));
    });
  });
}

function updateQuickAuditItemQuantity(index, change) {
  const item = quickAuditItems[index];
  if (!item) return;
  item.quantity += change;
  if (item.quantity <= 0) quickAuditItems.splice(index, 1);
  renderQuickAuditList();
}

async function saveQuickAudit() {
  if (quickAuditItems.length === 0) {
    showToast('⚠️ No hay productos en la lista', 'warning');
    return;
  }

  const det     = getStoreId();
  const usuario = firebase.auth().currentUser?.email || 'sistema';
  showToast('💾 Guardando auditoría rápida...', 'info');

  const updates  = {};
  const auditLog = [];
  const ahora    = Date.now();

  for (const item of quickAuditItems) {
    const safeCode = sanitizeBarcode(item.codigoBarras);
    if (!safeCode) continue;

    // Lógica Inteligente: Buscar si hay stock en Recepción para este producto
    // Nota: item.lotes ya viene del fetchProductDataForBodega
    const productoCompleto = await buscarProductoPorCodigo(item.codigoBarras);
    const lotes = productoCompleto?.lotes || [];
    const loteRecepcion = lotes.find(l => l.bodega === '📥 Recepción');
    const stockRecepcion = loteRecepcion ? parseFloat(loteRecepcion.stock) || 0 : 0;

    const stockActualBodega = item.stockSistema;
    const diferenciaContada = item.quantity - stockActualBodega;
    let tomadoDeRecepcion = 0;

    if (diferenciaContada > 0 && stockRecepcion > 0) {
        tomadoDeRecepcion = Math.min(diferenciaContada, stockRecepcion);
        const nuevoStockRecepcion = parseFloat((stockRecepcion - tomadoDeRecepcion).toFixed(2));

        if (nuevoStockRecepcion <= 0) {
            updates[`productos/${det}/${safeCode}/lotes/${loteRecepcion.loteId}`] = null;
        } else {
            updates[`productos/${det}/${safeCode}/lotes/${loteRecepcion.loteId}/stock`] = nuevoStockRecepcion;
            updates[`productos/${det}/${safeCode}/lotes/${loteRecepcion.loteId}/actualizado`] = ahora;
        }
    }

    if (item.loteId) {
      // Lote existente en esta bodega
      updates[`productos/${det}/${safeCode}/lotes/${item.loteId}/stock`]      = item.quantity;
      updates[`productos/${det}/${safeCode}/lotes/${item.loteId}/actualizado`] = ahora;
    } else {
      // Producto sin lote en esta bodega — crear lote
      const loteId = generarLoteId(currentAuditWarehouse, item.fechaCaducidad || '');
      updates[`productos/${det}/${safeCode}/lotes/${loteId}/bodega`]         = currentAuditWarehouse;
      updates[`productos/${det}/${safeCode}/lotes/${loteId}/fechaCaducidad`]  = item.fechaCaducidad || '';
      updates[`productos/${det}/${safeCode}/lotes/${loteId}/stock`]           = item.quantity;
      updates[`productos/${det}/${safeCode}/lotes/${loteId}/actualizado`]     = ahora;
    }

    updates[`productos/${det}/${safeCode}/fechaActualizacion`] = ahora;

    auditLog.push({
      producto:    item.nombre,
      codigo:      item.codigoBarras,
      bodega:      currentAuditWarehouse,
      loteId:      item.loteId || 'nuevo',
      esperado:    item.stockSistema,
      contado:     item.quantity,
      diferencia:  diferenciaContada,
      tomadoDeRecepcion,
      fecha:       getLocalISOString(),
      usuario,
      modo:        'rapido_inteligente'
    });
  }

  try {
    if (Object.keys(updates).length > 0) {
      await firebase.database().ref().update(updates);
    }
    for (const log of auditLog) {
      await firebase.database().ref(`auditorias/${det}`).push(log);
    }

    showToast(`✅ Auditoría guardada y stock balanceado`, 'success');
    endQuickAudit();
  } catch (error) {
    console.error('❌ Error guardando auditoría:', error);
    showToast('❌ Error guardando los datos', 'error');
  }
}

function endQuickAudit() {
  if (window.scannerActive) window.closeScanner?.();
  isQuickAuditMode = false;
  quickAuditItems  = [];

  document.getElementById('audit-normal-form').classList.remove('hidden');
  document.getElementById('audit-quick-scan-container').classList.add('hidden');
  document.getElementById('btn-quick-audit-mode').textContent = '⚡ Activar Modo de Auditoría Rápida';
  document.getElementById('btn-quick-audit-mode').classList.replace('warning', 'secondary');
  renderQuickAuditList();
}

// ============================================================
// TERMINAR AUDITORÍA NORMAL
// ============================================================
function finishNormalAudit() {
  currentAuditWarehouse = null;
  currentAuditProduct   = null;
  currentAuditLoteId    = null;

  const warehouseInput  = document.getElementById('audit-warehouse');
  const saveBtn         = document.getElementById('save-warehouse-btn');
  const display         = document.getElementById('current-warehouse-display');
  const finishBtn       = document.getElementById('finish-audit-btn');

  warehouseInput.value    = '';
  warehouseInput.disabled = false;
  const manualInput = document.getElementById('audit-warehouse-manual');
  if (manualInput) {
    manualInput.value = '';
    manualInput.disabled = false;
  }
  saveBtn.style.display   = 'block';
  finishBtn.style.display = 'none';
  display.innerHTML       = 'Ninguna bodega seleccionada';
  display.style.cssText   = `
    padding:12px;background:var(--bg);border-radius:8px;
    color:var(--muted);text-align:center;margin-bottom:20px;`;

  limpiarCamposAudit();
  showToast('✅ Auditoría finalizada', 'success');
}

// ============================================================
// LIMPIAR CAMPOS
// ============================================================
function limpiarCamposAudit() {
  document.getElementById('audit-barcode').value  = '';
  document.getElementById('audit-boxes').value    = '';
  document.getElementById('audit-nombre').value   = '';
  document.getElementById('audit-stock-info').style.display = 'none';
  currentAuditProduct = null;
  currentAuditLoteId  = null;
  document.getElementById('audit-barcode').focus();
}

// ============================================================
// EXPONER
// ============================================================
window.updateQuickAuditItemQuantity = updateQuickAuditItemQuantity;
window.seleccionarLoteAudit         = window.seleccionarLoteAudit;

console.log('✅ audit.js V3 (Por Bodega) cargado correctamente');
