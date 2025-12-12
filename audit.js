// ============================================================
// Águila Inventario Pro - Módulo: audit.js (REFactor v2.1)
// Entregado a: José A. G. Betancourt
// Mejoras adicionales: integración completa con APP.addToOfflineQueue
//                      (offline-first / optimistic UI / marcado de pendientes)
// ============================================================

/* eslint-disable no-unused-vars */
(() => {
  'use strict';

  // ---------- CONFIG ----------
  const DEBOUNCE_MS = 350; // evita doble lectura del escáner
  const MAX_HISTORY_SHOW = 8;

  // ---------- STATE CACHE ----------
  let determinanteCache = null;
  let determinantePromise = null;

  let currentWarehouse = null;
  let currentProduct = null; // { id, ...productData }
  let auditStartTime = null;
  let currentSession = []; // lista de auditorias individuales (objetos)
  let totalBoxes = 0;
  let totalProducts = 0;

  // Debounce helpers
  let buscarDebounceTimer = null;

  // UI cache (reduce querySelector calls)
  const UI = {
    warehouseInput: document.getElementById('audit-warehouse'),
    saveWarehouseBtn: document.getElementById('save-warehouse-btn'),
    currentWarehouseDisplay: document.getElementById('current-warehouse-display'),

    barcodeInput: document.getElementById('audit-barcode'),
    scanAuditBtn: document.getElementById('btn-scan-audit'),

    stockInfo: document.getElementById('audit-stock-info'),
    productNameInput: document.getElementById('audit-nombre'),
    productBrandInput: document.getElementById('audit-marca'),
    productPiecesInput: document.getElementById('audit-piezas'),
    boxesInput: document.getElementById('audit-boxes'),

    finishAuditBtn: document.getElementById('finish-audit-btn'),
    auditTotalCountEl: document.getElementById('audit-total-count'),
    auditProductsCountEl: document.getElementById('audit-products-count'),
    auditHistoryContainer: document.getElementById('audit-history'),
  };

  // ---------- UTILIDADES ----------
  function log(...args) { if (window.console) console.log('[audit]', ...args); }

  function safeToast(msg, type = 'info') {
    if (typeof showToast === 'function') {
      try { showToast(msg, type); } catch (e) { log('showToast fallo', e); }
    } else {
      // Fallback no intrusivo
      log('[toast]', type, msg);
    }
  }

  function toIntSafe(v, fallback = 0) {
    if (v === undefined || v === null || v === '') return fallback;
    const n = parseInt(String(v).replace(/\s+/g, ''), 10);
    return Number.isNaN(n) ? fallback : n;
  }

  function toDateSafe(val) {
    if (!val) return null;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }

  function vibrateSafe(pattern) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* ignore */ }
  }

  function beepSafe() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine'; osc.frequency.value = 900;
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) { /* ignore */ }
  }

  // ---------- DETERMINANTE (CACHEADO) ----------
  async function getDeterminante() {
    if (determinanteCache) return determinanteCache;
    if (determinantePromise) return determinantePromise;

    determinantePromise = (async () => {
      try {
        const uid = firebase.auth().currentUser?.uid;
        if (!uid) return null;
        const snap = await firebase.database().ref('usuarios/' + uid).once('value');
        const data = snap.val() || {};
        determinanteCache = data.determinante || null;
        return determinanteCache;
      } catch (err) {
        log('Error getDeterminante', err);
        determinanteCache = null;
        return null;
      } finally {
        determinantePromise = null;
      }
    })();

    return determinantePromise;
  }

  // ---------- UI HELPERS (parciales, eficientes) ----------
  function updateWarehouseDisplay() {
    if (!UI.currentWarehouseDisplay) return;
    if (!currentWarehouse) {
      UI.currentWarehouseDisplay.innerHTML = '⏸️ Ninguna bodega seleccionada';
      UI.currentWarehouseDisplay.style.color = '#6b7280';
      return;
    }
    UI.currentWarehouseDisplay.innerHTML = `✅ <strong>Auditando:</strong> ${currentWarehouse}`;
    UI.currentWarehouseDisplay.style.color = '#10b981';
    UI.currentWarehouseDisplay.style.fontWeight = '700';
  }

  function updateSummary() {
    if (UI.auditTotalCountEl) UI.auditTotalCountEl.textContent = totalBoxes;
    if (UI.auditProductsCountEl) UI.auditProductsCountEl.textContent = totalProducts;

    if (UI.finishAuditBtn && currentWarehouse) {
      const diffs = currentSession.filter(s => s.diferencia !== 0).length;
      UI.finishAuditBtn.style.display = 'block';
      UI.finishAuditBtn.innerHTML = `
        <div style="text-align: center;">
          <div style="font-size: 12px; opacity: 0.9;">
            📊 ${totalProducts} productos • 📦 ${totalBoxes} cajas • ⚠️ ${diffs} ajustes
          </div>
          <div style="font-size: 16px; font-weight: 700; margin-top: 6px;">
            🏁 Finalizar Auditoría
          </div>
        </div>
      `;
    }
  }

  function showStockInfo(systemBoxes, piezasPorCaja) {
    if (!UI.stockInfo) return;
    UI.stockInfo.style.display = 'block';
    const piezas = toIntSafe(piezasPorCaja, 0);
    UI.stockInfo.innerHTML = `
      📊 <strong>Stock del Sistema:</strong> ${systemBoxes} cajas 
      (${systemBoxes * piezas} piezas)
    `;
  }

  // Añade un elemento al historial sin reconstruir toda la lista
  function pushHistoryItem(auditData, markPending = false) {
    if (!UI.auditHistoryContainer) return;

    // Crear nodo
    const time = new Date(auditData.fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    const color = auditData.diferencia === 0 ? '#10b981' : (auditData.diferencia > 0 ? '#f59e0b' : '#ef4444');
    const icon = auditData.diferencia === 0 ? '✓' : (auditData.diferencia > 0 ? '🟡' : '🔴');

    const item = document.createElement('div');
    item.style.cssText = `
      padding: 12px; margin-bottom: 8px; background: white;
      border-left: 4px solid ${color}; border-radius: 8px; font-size: 13px;
      position: relative;
    `;
    item.innerHTML = `
      <div style="font-weight: 700; margin-bottom: 4px;">${icon} ${auditData.productoNombre}</div>
      <div style="color: #6b7280;">
        ${time} | Contado: <strong>${auditData.stockContado}</strong> | 
        Diferencia: <span style="color: ${color}; font-weight:700;">
          ${auditData.diferencia > 0 ? '+' : ''}${auditData.diferencia}
        </span>
      </div>
    `;

    if (markPending) {
      const badge = document.createElement('div');
      badge.textContent = '⏳ Pendiente';
      badge.style.cssText = 'position:absolute; right:10px; top:10px; font-size:12px; color:#92400e;';
      item.appendChild(badge);
    }

    // Insertar al inicio
    if (UI.auditHistoryContainer.firstChild) {
      UI.auditHistoryContainer.insertBefore(item, UI.auditHistoryContainer.firstChild);
    } else {
      UI.auditHistoryContainer.appendChild(item);
    }

    // Mantener solo últimos N visible (si tienes muchos, no limpiar el array)
    const children = UI.auditHistoryContainer.querySelectorAll('div');
    if (children.length > 50) { // evitar DOM gigantesco
      UI.auditHistoryContainer.removeChild(children[children.length - 1]);
    }
  }

  // Limpia inputs relevantes para siguiente conteo
  function clearFormForNext() {
    if (UI.barcodeInput) UI.barcodeInput.value = '';
    if (UI.boxesInput) UI.boxesInput.value = '';
    currentProduct = null;
    if (UI.productNameInput) UI.productNameInput.value = '';
    if (UI.productBrandInput) UI.productBrandInput.value = '';
    if (UI.productPiecesInput) UI.productPiecesInput.value = '';
    if (UI.stockInfo) UI.stockInfo.style.display = 'none';
  }

  // ---------- BUSCAR PRODUCTO (debounced) ----------
  function buscarProductoAuditDebounced() {
    if (buscarDebounceTimer) clearTimeout(buscarDebounceTimer);
    buscarDebounceTimer = setTimeout(() => buscarProductoAudit(), DEBOUNCE_MS);
  }

  // ---------- BUSCAR PRODUCTO (principal) ----------
  async function buscarProductoAudit() {
    try {
      const barcode = (UI.barcodeInput?.value || '').trim();
      if (!barcode || barcode.length < 8) {
        safeToast('Ingresa un código válido (mínimo 8 dígitos)', 'warning');
        return;
      }
      if (!currentWarehouse) {
        safeToast('Primero selecciona una bodega', 'warning');
        UI.warehouseInput?.focus();
        return;
      }

      const det = await getDeterminante();
      if (!det) {
        safeToast('Error: No se encontró información de la tienda', 'error');
        return;
      }

      // Consulta optimizada: filtrar por codigoBarras y procesar resultados en cliente
      const snap = await firebase.database()
        .ref('inventario/' + det)
        .orderByChild('codigoBarras')
        .equalTo(barcode)
        .once('value');

      if (!snap.exists()) {
        safeToast('❌ Producto no encontrado', 'error');
        currentProduct = null;
        clearFormForNext();
        return;
      }

      const products = snap.val();
      // Buscar primer producto cuya ubicacion coincida con la bodega actual
      let foundId = null;
      let found = null;
      for (const [pid, p] of Object.entries(products)) {
        if (p.ubicacion === currentWarehouse) {
          foundId = pid; found = p; break;
        }
      }

      if (!found) {
        // si no está en la bodega actual, avisar la ubicación probable
        const any = Object.values(products)[0];
        const otherLoc = any?.ubicacion || 'otra bodega';
        safeToast(`⚠️ Producto en: "${otherLoc}"`, 'warning');
        currentProduct = null;
        clearFormForNext();
        return;
      }

      // Asignar product y autofill UI (solo asignaciones mínimas)
      currentProduct = { id: foundId, ...found };

      if (UI.productNameInput) UI.productNameInput.value = found.nombre || '';
      if (UI.productBrandInput) UI.productBrandInput.value = found.marca || '';
      if (UI.productPiecesInput) UI.productPiecesInput.value = found.piezasPorCaja || '';
      showStockInfo(toIntSafe(found.cajas, 0), found.piezasPorCaja || 0);

      // Guardar metadata en el input para integraciones simples (no imprescindible)
      if (UI.boxesInput) {
        UI.boxesInput.dataset.productoId = foundId;
        UI.boxesInput.dataset.stockSistema = String(found.cajas || 0);
        UI.boxesInput.focus();
      }

      // marcar estilos
      UI.productNameInput && (UI.productNameInput.style.borderColor = '#10b981');
      UI.productBrandInput && (UI.productBrandInput.style.borderColor = '#10b981');
      UI.productPiecesInput && (UI.productPiecesInput.style.borderColor = '#10b981');

      safeToast('✅ Producto encontrado en ' + currentWarehouse, 'success');

    } catch (err) {
      log('buscarProductoAudit error', err);
      safeToast('Error al buscar: ' + (err.message || err), 'error');
    }
  }

  // ---------- OFFLINE FALLBACK: guardar auditoría en cola APP ----------
  function pushAuditToOfflineQueue(auditRecord) {
    try {
      if (typeof APP?.addToOfflineQueue === 'function') {
        APP.addToOfflineQueue({ type: 'audit', payload: auditRecord });
        log('Audit guardada en cola offline via APP');
        return true;
      } else {
        // Fallback: emitir evento global para que otro módulo la maneje
        const evt = new CustomEvent('aguila:offlineAudit', { detail: auditRecord });
        window.dispatchEvent(evt);
        log('Audit emitida en evento aguila:offlineAudit');
        return true;
      }
    } catch (e) {
      log('pushAuditToOfflineQueue error', e);
      return false;
    }
  }

  // ---------- REGISTRAR CONTEO (principal, transaccional protegido) ----------
  async function registrarConteo() {
    try {
      const boxesStr = UI.boxesInput?.value;
      const boxes = toIntSafe(boxesStr, NaN);

      if (!currentWarehouse) {
        safeToast('Primero selecciona una bodega', 'warning');
        UI.warehouseInput?.focus();
        return false;
      }

      if (!currentProduct || !currentProduct.id) {
        safeToast('⚠️ Primero escanea un producto válido', 'warning');
        UI.barcodeInput?.focus();
        return false;
      }

      if (Number.isNaN(boxes) || boxes < 0) {
        safeToast('Ingresa una cantidad válida', 'error');
        UI.boxesInput?.focus();
        return false;
      }

      const det = await getDeterminante();
      if (!det) {
        safeToast('Error: No se encontró información de la tienda', 'error');
        return false;
      }

      const userEmail = firebase.auth().currentUser?.email || 'unknown';
      const registeredStock = toIntSafe(currentProduct.cajas, 0);
      const difference = boxes - registeredStock;

      // Construir audit record
      const auditRecord = {
        productoId: currentProduct.id,
        productoNombre: currentProduct.nombre || 'Sin nombre',
        productoCodigo: currentProduct.codigoBarras || 'N/A',
        marca: currentProduct.marca || 'N/A',
        bodega: currentWarehouse,
        stockRegistrado: registeredStock,
        stockContado: boxes,
        diferencia: difference,
        fecha: new Date().toISOString(),
        auditor: userEmail
      };

      // OFFLINE: si no hay red, guardamos en cola y actualizamos UI optimísticamente
      if (!navigator.onLine) {
        auditRecord._offline = true;
        // Guardar en cola APP
        pushAuditToOfflineQueue(auditRecord);
        // Reflejar en UI (optimistic)
        currentSession.push(auditRecord);
        totalBoxes += boxes;
        totalProducts += 1;
        pushHistoryItem(auditRecord, true); // marcar pendiente
        updateSummary();
        clearFormForNext();
        UI.barcodeInput && UI.barcodeInput.focus();
        safeToast('📥 Auditoría guardada localmente. Se sincronizará cuando haya conexión.', 'info');
        return true;
      }

      // Si hay red, intentar operación completa (push auditoria + transacción + push movimiento)
      const auditoriasRef = firebase.database().ref('auditorias/' + det);
      const inventarioRef = firebase.database().ref('inventario/' + det + '/' + currentProduct.id);
      const movimientosRef = firebase.database().ref('movimientos/' + det);

      // Push auditoría (no bloqueante)
      const pushPromise = auditoriasRef.push(auditRecord);

      // Transaction para setear cajas = boxes
      const txResult = await new Promise((resolve, reject) => {
        inventarioRef.transaction((current) => {
          if (current === null) {
            // Producto eliminado o inconsistente -> abortar
            return;
          }
          return {
            ...current,
            cajas: boxes,
            fechaActualizacion: new Date().toISOString(),
            actualizadoPor: userEmail,
            ultimaAuditoria: new Date().toISOString()
          };
        }, (error, committed, snapshot) => {
          if (error) return reject(error);
          resolve({ committed, snapshot });
        }, false);
      });

      if (!txResult.committed) {
        // Si transaction aborta, guardar offline como fallback
        auditRecord._offline = true;
        pushAuditToOfflineQueue(auditRecord);
        // reflect UI optimistic but mark pending
        currentSession.push(auditRecord);
        totalBoxes += boxes;
        totalProducts += 1;
        pushHistoryItem(auditRecord, true);
        updateSummary();
        clearFormForNext();
        safeToast('⚠️ No se pudo actualizar inventario. Auditoría guardada para reintento.', 'warning');
        try { await pushPromise; } catch(e){ log('push auditoria fallo tras tx abort', e); }
        return false;
      }

      // Si committed, push movimiento si hay diferencia
      if (difference !== 0) {
        const movimientoData = {
          tipo: difference > 0 ? 'entrada' : 'salida',
          productoId: currentProduct.id,
          productoNombre: currentProduct.nombre,
          productoCodigo: currentProduct.codigoBarras,
          marca: currentProduct.marca,
          cajasAntes: registeredStock,
          cajasDespues: boxes,
          cajasCambiadas: Math.abs(difference),
          ubicacion: currentWarehouse,
          motivo: 'Ajuste por auditoría',
          fecha: new Date().toISOString(),
          usuario: userEmail,
          origenAuditoria: true
        };
        try { await movimientosRef.push(movimientoData); } catch (movErr) {
          // Si falla push movimiento, guardamos la auditoría en cola para reintento (no dejamos al promotor esperando)
          auditRecord._offline = true;
          pushAuditToOfflineQueue(auditRecord);
          currentSession.push(auditRecord);
          totalBoxes += boxes;
          totalProducts += 1;
          pushHistoryItem(auditRecord, true);
          updateSummary();
          clearFormForNext();
          safeToast('⚠️ Movimiento no guardado, acción en cola para reintento.', 'warning');
          try { await pushPromise; } catch(e){ log('push auditoria fallo tras movimiento err', e); }
          return false;
        }
      }

      // Esperar auditoría push promise
      try { await pushPromise; } catch (e) { log('push auditoria fallo', e); }

      // Éxito: actualizar UI
      currentSession.push(auditRecord);
      totalBoxes += boxes;
      totalProducts += 1;
      pushHistoryItem(auditRecord, false);
      updateSummary();
      clearFormForNext();
      UI.barcodeInput && UI.barcodeInput.focus();
      mostrarCheckmarkAudit(difference);
      beepSafe();
      vibrateSafe([100,50,100]);

      if (difference === 0) safeToast('✅ ' + currentProduct.nombre + ' - OK', 'success');
      else if (difference > 0) safeToast(`🟡 ${currentProduct.nombre} - Sobrante: +${difference}`, 'warning');
      else safeToast(`🔴 ${currentProduct.nombre} - Faltante: ${difference}`, 'warning');

      return true;

    } catch (error) {
      log('registrarConteo error', error);
      safeToast('Error: ' + (error.message || error), 'error');

      // Intentar fallback offline
      try {
        const auditRecordOffline = {
          productoId: currentProduct?.id || null,
          productoNombre: currentProduct?.nombre || 'Sin nombre',
          productoCodigo: currentProduct?.codigoBarras || 'N/A',
          marca: currentProduct?.marca || 'N/A',
          bodega: currentWarehouse,
          stockRegistrado: currentProduct ? toIntSafe(currentProduct.cajas, 0) : 0,
          stockContado: toIntSafe(UI.boxesInput?.value, 0),
          diferencia: (toIntSafe(UI.boxesInput?.value, 0) - toIntSafe(currentProduct?.cajas, 0)),
          fecha: new Date().toISOString(),
          auditor: firebase.auth().currentUser?.email || 'unknown',
          _offline: true
        };
        if (pushAuditToOfflineQueue(auditRecordOffline)) {
          // Optimistic UI
          currentSession.push(auditRecordOffline);
          totalBoxes += auditRecordOffline.stockContado;
          totalProducts += 1;
          pushHistoryItem(auditRecordOffline, true);
          updateSummary();
          clearFormForNext();
          safeToast('📥 Acción guardada localmente para reintento', 'info');
        }
      } catch (e) {
        log('error guardando offline', e);
      }

      return false;
    }
  }

  // ---------- CHECKMARK VISUAL ----------
  function mostrarCheckmarkAudit(difference) {
    const el = document.createElement('div');
    el.style.cssText = `
      position: fixed; top: 50%; left: 50%;
      transform: translate(-50%,-50%); font-size: 96px;
      z-index: 2500; pointer-events: none; animation: checkmarkPop 0.6s ease-out forwards;
    `;
    el.innerHTML = difference === 0 ? '✅' : (difference > 0 ? '🟡' : '🔴');
    document.body.appendChild(el);
    setTimeout(() => { try { el.remove(); } catch (e) { } }, 600);
  }

  // ---------- TERMINAR AUDITORIA ----------
  async function terminarAuditoria() {
    try {
      if (!currentWarehouse) {
        safeToast('No hay auditoría activa', 'warning');
        return;
      }
      if (currentSession.length === 0) {
        safeToast('No se han auditado productos', 'warning');
        return;
      }

      const diffs = currentSession.filter(a => a.diferencia !== 0).length;
      const ajustesTexto = currentSession.filter(a => a.diferencia !== 0)
        .map(a => `• ${a.productoNombre}: ${a.diferencia > 0 ? '+' : ''}${a.diferencia} cajas`).join('\n');

      const tiempoMin = auditStartTime ? Math.round((Date.now() - auditStartTime) / 60000) : 'N/A';
      let resumen = `📋 RESUMEN AUDITORÍA\n\n📍 Bodega: ${currentWarehouse}\n⏱️ Tiempo: ${tiempoMin} min\n👤 Auditor: ${firebase.auth().currentUser?.email || 'unknown'}\n\n`;
      resumen += `✅ Productos: ${totalProducts}\n📦 Total cajas: ${totalBoxes}\n⚠️ Diferencias: ${diffs}\n\n`;
      if (ajustesTexto) resumen += `🔧 AJUSTES:\n${ajustesTexto}\n\n`;
      resumen += `¿Confirmar y terminar auditoría?`;

      if (!window.confirm(resumen)) return;

      const det = await getDeterminante();
      if (!det) {
        safeToast('No se puede terminar: tienda no identificada', 'error');
        return;
      }

      const summary = {
        bodega: currentWarehouse,
        fechaInicio: auditStartTime ? auditStartTime.toISOString() : new Date().toISOString(),
        fechaFin: new Date().toISOString(),
        auditor: firebase.auth().currentUser?.email || 'unknown',
        productosAuditados: totalProducts,
        totalCajas: totalBoxes,
        diferenciasEncontradas: diffs,
        tiempoMinutos: auditStartTime ? Math.round((Date.now() - auditStartTime) / 60000) : 0,
        estado: 'completada',
        detalle: currentSession
      };

      // Intentar guardar summary; si offline, empujar a cola
      if (!navigator.onLine) {
        if (typeof APP?.addToOfflineQueue === 'function') {
          APP.addToOfflineQueue({ type: 'audit_summary', payload: summary });
          safeToast('📥 Resumen guardado localmente. Se sincronizará luego.', 'info');
        } else {
          window.dispatchEvent(new CustomEvent('aguila:offlineAuditSummary', { detail: summary }));
        }
      } else {
        await firebase.database().ref('auditorias_completadas/' + det).push(summary);
      }

      // Opcional: mostrar estadísticas ligeras
      try { await mostrarEstadisticasProductos(); } catch(e){ log('stats show fail', e); }

      // Reset interno y UI
      currentWarehouse = null;
      currentProduct = null;
      auditStartTime = null;
      currentSession = [];
      totalBoxes = 0;
      totalProducts = 0;

      if (UI.warehouseInput) UI.warehouseInput.value = '';
      updateWarehouseDisplay();
      updateSummary();
      clearFormForNext();
      if (UI.finishAuditBtn) UI.finishAuditBtn.style.display = 'none';

      safeToast('✅ Auditoría finalizada exitosamente', 'success');

      setTimeout(() => {
        if (window.confirm('¿Auditar otra bodega?')) {
          UI.warehouseInput && UI.warehouseInput.focus();
        }
      }, 500);

    } catch (err) {
      log('terminarAuditoria error', err);
      safeToast('Error: ' + (err.message || err), 'error');
    }
  }

  // ---------- MOSTRAR ESTADÍSTICAS (ligero) ----------
  async function mostrarEstadisticasProductos() {
    try {
      const det = await getDeterminante();
      if (!det) return;
      const hace30 = new Date(); hace30.setDate(hace30.getDate() - 30); hace30.setHours(0,0,0,0);
      const snap = await firebase.database().ref('auditorias/' + det).orderByChild('fecha').startAt(hace30.toISOString()).once('value');
      if (!snap.exists()) return;
      const raw = snap.val();
      const contador = {};
      Object.values(raw).forEach(a => {
        const n = a.productoNombre || 'Desconocido';
        if (!contador[n]) contador[n] = { nombre: n, veces: 0, ajustes: 0 };
        contador[n].veces++;
        if (a.diferencia !== 0) contador[n].ajustes++;
      });
      const top = Object.values(contador).sort((a,b)=> b.veces - a.veces).slice(0,5);
      let msg = '📊 TOP 5 PRODUCTOS MÁS AUDITADOS (30 días)\n\n';
      top.forEach((p,i)=> { msg += `${i+1}. ${p.nombre}\n   Auditado: ${p.veces}x | Ajustes: ${p.ajustes}\n\n`; });
      window.alert(msg);
    } catch (err) { log('mostrarEstadisticasProductos', err); }
  }

  // ---------- EVENT BINDINGS ----------
  function bindUI() {
    // seleccionar bodega
    UI.saveWarehouseBtn?.addEventListener('click', () => {
      const val = (UI.warehouseInput?.value || '').trim();
      if (!val) { safeToast('Ingresa el nombre de la bodega', 'warning'); return; }
      currentWarehouse = val;
      auditStartTime = new Date();
      currentSession = [];
      totalBoxes = 0; totalProducts = 0;
      updateWarehouseDisplay();
      updateSummary();
      clearFormForNext();
      safeToast('📍 Bodega seleccionada: ' + currentWarehouse, 'success');
      UI.barcodeInput?.focus();
    });

    // scan button -> start scanner flow (APP.startScannerFlow emits aguila:barcodeScanned event)
    UI.scanAuditBtn?.addEventListener('click', async () => {
      if (typeof APP?.startScannerFlow === 'function') {
        APP.startScannerFlow();
      } else if (typeof openScanner === 'function') {
        openScanner((code) => { UI.barcodeInput.value = code; buscarProductoAuditDebounced(); });
      } else {
        safeToast('El escáner no está disponible', 'error');
      }
    });

    // barcode input enter -> buscar
    UI.barcodeInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); buscarProductoAuditDebounced(); }
    });

    // bind global scanned barcode event (desde APP)
    window.addEventListener('aguila:barcodeScanned', (ev) => {
      const code = ev?.detail?.barcode;
      if (code) {
        UI.barcodeInput && (UI.barcodeInput.value = code);
        buscarProductoAuditDebounced();
      }
    });

    // registrar conteo (form submit)
    const auditForm = document.getElementById('audit-form');
    auditForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await registrarConteo();
    });

    // terminar auditoría
    UI.finishAuditBtn?.addEventListener('click', terminarAuditoria);
  }

  // ---------- INICIALIZACIÓN ----------
  function init() {
    try {
      // Inject CSS animation keyframes if not present (defensivo)
      if (!document.querySelector('style[data-audit-keyframes]')) {
        const s = document.createElement('style');
        s.setAttribute('data-audit-keyframes', '1');
        s.textContent = `
          @keyframes checkmarkPop {
            0% { transform: translate(-50%,-50%) scale(0); opacity:0;}
            50% { transform: translate(-50%,-50%) scale(1.2); opacity:1;}
            100% { transform: translate(-50%,-50%) scale(1); opacity:0;}
          }
        `;
        document.head.appendChild(s);
      }

      bindUI();
      updateWarehouseDisplay();
      updateSummary();
      log('audit module initialized');
    } catch (e) {
      log('init error', e);
    }
  }

  // Exponer API globalmente para llamadas externas y tests
  window.auditModule = {
    init,
    buscarProductoAudit,
    buscarProductoAuditDebounced,
    registrarConteo,
    terminarAuditoria,
    mostrarEstadisticasProductos,
    // exposiciones de estado (lectura)
    _state: () => ({ currentWarehouse, currentProduct, totalBoxes, totalProducts, currentSession })
  };

  // Auto init al cargar DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();