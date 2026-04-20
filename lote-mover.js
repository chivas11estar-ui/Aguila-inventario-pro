/**
 * Águila Inventario Pro - Módulo: lote-mover.js
 * Permite al promotor mover/consolidar lotes entre bodegas desde la app
 * sin necesidad de tocar Firebase manualmente.
 *
 * Funciones expuestas:
 *   - window.moverLote(codigoBarras, loteOrigenId)
 *       Abre un modal para elegir bodega destino y mueve el stock.
 *       Si la bodega destino tiene un lote con la MISMA caducidad,
 *       fusiona automáticamente los stocks.
 *
 * Copyright © 2026 José A. G. Betancourt
 */
'use strict';

(function () {
  // ---------- Helpers ----------
  function safeBarcode(code) {
    const c = String(code || '').trim();
    return c.replace(/[.#$\[\]/]/g, '_');
  }

  function generarLoteId(bodega, fechaCaducidad) {
    const raw = (bodega || 'General') + '_' + (fechaCaducidad || 'sinFecha');
    return btoa(unescape(encodeURIComponent(raw)))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .substring(0, 30);
  }

  async function getDeterminante() {
    if (typeof window.getUserDeterminante === 'function') {
      return await window.getUserDeterminante();
    }
    return window.INVENTORY_STATE && window.INVENTORY_STATE.determinante;
  }

  function showMsg(text, type) {
    if (typeof window.showToast === 'function') {
      window.showToast(text, type || 'info');
    } else {
      console.log('[lote-mover]', text);
    }
  }

  // ---------- UI: modal de mover ----------
  function buildModal(producto, loteOrigen, bodegasUsadas) {
    // Eliminar modal previo si existe
    const prev = document.getElementById('lote-mover-modal');
    if (prev) prev.remove();

    const modal = document.createElement('div');
    modal.id = 'lote-mover-modal';
    modal.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:10000;' +
      'display:flex;align-items:center;justify-content:center;padding:20px;';

    const sugeridas = ['General', 'Botana 1', 'Botana 2', 'Galleta 1', 'Galleta 2',
                       'Cereal 1', 'Cereal 2', 'Cereal 3', 'Aceites 1', 'Aceites 2'];
    const todas = Array.from(new Set([...sugeridas, ...bodegasUsadas])).sort();
    const optionsHtml = todas
      .filter(b => b !== loteOrigen.bodega)
      .map(b => '<option value="' + b + '">' + b + '</option>')
      .join('');

    modal.innerHTML =
      '<div style="background:#fff;border-radius:12px;max-width:420px;width:100%;' +
      'padding:24px;box-shadow:0 10px 40px rgba(0,0,0,0.3);color:#111;">' +
      '<h3 style="margin:0 0 8px 0;color:#004aad;font-size:18px;">🔀 Mover lote</h3>' +
      '<div style="font-size:13px;color:#374151;margin-bottom:16px;">' +
      '<b>' + (producto.nombre || producto.codigoBarras) + '</b><br>' +
      'Origen: <b>' + loteOrigen.bodega + '</b> · Stock: ' + loteOrigen.stock + ' caja(s)' +
      (loteOrigen.fechaCaducidad ? ' · Cad: ' + loteOrigen.fechaCaducidad : '') +
      '</div>' +
      '<label style="font-size:13px;font-weight:600;color:#111;display:block;margin-bottom:6px;">' +
      'Bodega destino</label>' +
      '<select id="lote-mover-destino" style="width:100%;padding:10px;border:1px solid #d1d5db;' +
      'border-radius:8px;font-size:14px;color:#111;background:#fff;margin-bottom:12px;">' +
      optionsHtml +
      '<option value="__custom__">✏️ Otra bodega (escribir)…</option>' +
      '</select>' +
      '<input id="lote-mover-destino-custom" placeholder="Nombre de bodega" ' +
      'style="display:none;width:100%;padding:10px;border:1px solid #d1d5db;border-radius:8px;' +
      'font-size:14px;color:#111;background:#fff;margin-bottom:12px;">' +
      '<label style="font-size:13px;font-weight:600;color:#111;display:block;margin-bottom:6px;">' +
      'Cantidad a mover (cajas)</label>' +
      '<input id="lote-mover-cantidad" type="number" min="0.01" step="0.01" ' +
      'value="' + loteOrigen.stock + '" max="' + loteOrigen.stock + '" ' +
      'style="width:100%;padding:10px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;' +
      'color:#111;background:#fff;margin-bottom:16px;">' +
      '<div style="font-size:11px;color:#6b7280;margin-bottom:16px;">' +
      '💡 Si la bodega destino ya tiene este producto con la misma caducidad, ' +
      'los stocks se fusionarán.</div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;">' +
      '<button id="lote-mover-cancel" style="padding:10px 16px;background:#f3f4f6;color:#374151;' +
      'border:1px solid #d1d5db;border-radius:8px;cursor:pointer;font-weight:600;">Cancelar</button>' +
      '<button id="lote-mover-ok" style="padding:10px 16px;background:#004aad;color:#fff;' +
      'border:none;border-radius:8px;cursor:pointer;font-weight:700;">Mover</button>' +
      '</div></div>';

    document.body.appendChild(modal);

    const selectEl = modal.querySelector('#lote-mover-destino');
    const customEl = modal.querySelector('#lote-mover-destino-custom');
    selectEl.addEventListener('change', () => {
      customEl.style.display = selectEl.value === '__custom__' ? 'block' : 'none';
      if (selectEl.value === '__custom__') customEl.focus();
    });

    modal.querySelector('#lote-mover-cancel').onclick = () => modal.remove();
    modal.querySelector('#lote-mover-ok').onclick = async () => {
      let destino = selectEl.value;
      if (destino === '__custom__') destino = customEl.value.trim();
      if (!destino) {
        showMsg('⚠️ Elige o escribe una bodega destino', 'warning');
        return;
      }
      const cantidad = parseFloat(modal.querySelector('#lote-mover-cantidad').value);
      if (!isFinite(cantidad) || cantidad <= 0) {
        showMsg('⚠️ Cantidad inválida', 'warning');
        return;
      }
      if (cantidad > loteOrigen.stock + 0.0001) {
        showMsg('⚠️ Cantidad supera el stock origen (' + loteOrigen.stock + ')', 'warning');
        return;
      }
      modal.querySelector('#lote-mover-ok').disabled = true;
      try {
        await ejecutarMovimiento(producto, loteOrigen, destino, cantidad);
        modal.remove();
      } catch (e) {
        console.error('[lote-mover] Error al mover:', e);
        showMsg('❌ Error al mover: ' + e.message, 'error');
        modal.querySelector('#lote-mover-ok').disabled = false;
      }
    };
  }

  // ---------- Lógica: mover/fusionar lote ----------
  async function ejecutarMovimiento(producto, loteOrigen, bodegaDestino, cantidad) {
    const det = await getDeterminante();
    if (!det) throw new Error('Sin determinante');

    const safeCode = safeBarcode(producto.codigoBarras);
    if (!safeCode) throw new Error('Código de barras inválido');

    const loteDestinoId = generarLoteId(bodegaDestino, loteOrigen.fechaCaducidad || '');
    const refLotes = firebase.database().ref('productos/' + det + '/' + safeCode + '/lotes');

    // Leer estado actual de los dos lotes para fusionar bien
    const snap = await refLotes.once('value');
    const lotesActuales = snap.val() || {};
    const loteDestActual = lotesActuales[loteDestinoId];

    const nuevoStockOrigen = Math.max(0, (loteOrigen.stock || 0) - cantidad);
    const nuevoStockDestino = (loteDestActual ? (loteDestActual.stock || 0) : 0) + cantidad;

    const updates = {};
    const basePath = 'productos/' + det + '/' + safeCode + '/lotes/';

    // Si el origen queda en 0 → eliminamos el lote completo
    if (nuevoStockOrigen <= 0) {
      updates[basePath + loteOrigen.loteId] = null;
    } else {
      updates[basePath + loteOrigen.loteId + '/stock'] = nuevoStockOrigen;
      updates[basePath + loteOrigen.loteId + '/actualizado'] = Date.now();
    }

    // Lote destino: si existía, sumamos. Si no, lo creamos completo.
    if (loteDestActual) {
      updates[basePath + loteDestinoId + '/stock'] = nuevoStockDestino;
      updates[basePath + loteDestinoId + '/actualizado'] = Date.now();
    } else {
      updates[basePath + loteDestinoId] = {
        bodega: bodegaDestino,
        fechaCaducidad: loteOrigen.fechaCaducidad || '',
        stock: nuevoStockDestino,
        actualizado: Date.now()
      };
    }

    await firebase.database().ref().update(updates);

    // Registrar movimiento para auditoría
    try {
      const movRef = firebase.database().ref('movimientos/' + det).push();
      await movRef.set({
        timestamp: Date.now(),
        tipo: 'movimiento_bodega',
        codigoBarras: safeCode,
        nombre: producto.nombre || '',
        bodegaOrigen: loteOrigen.bodega,
        bodegaDestino: bodegaDestino,
        cajasMovidas: cantidad,
        usuario: (firebase.auth().currentUser && firebase.auth().currentUser.email) || 'desconocido'
      });
    } catch (e) {
      console.warn('[lote-mover] No se pudo registrar movimiento:', e);
    }

    const msgFusion = loteDestActual ? ' (fusionado)' : '';
    showMsg('✅ Movido ' + cantidad + ' caja(s) a ' + bodegaDestino + msgFusion, 'success');

    // Refrescar inventario
    if (typeof window.cargarInventario === 'function') {
      await window.cargarInventario();
    } else if (typeof window.loadInventory === 'function') {
      await window.loadInventory();
    }
  }

  // ---------- API pública ----------
  window.moverLote = async function (codigoBarras, loteOrigenId) {
    try {
      const det = await getDeterminante();
      if (!det) {
        showMsg('❌ Sin determinante. Vuelve a iniciar sesión.', 'error');
        return;
      }

      let producto = null;
      if (typeof window.buscarProductoPorCodigo === 'function') {
        producto = await window.buscarProductoPorCodigo(codigoBarras);
      }
      if (!producto || !producto.lotes || producto.lotes.length === 0) {
        showMsg('❌ Producto no encontrado o sin lotes', 'error');
        return;
      }

      const loteOrigen = producto.lotes.find(l => l.loteId === loteOrigenId) || producto.lotes[0];
      if (!loteOrigen) {
        showMsg('❌ Lote origen no encontrado', 'error');
        return;
      }

      const bodegasUsadas = producto.lotes.map(l => l.bodega).filter(Boolean);
      buildModal(producto, loteOrigen, bodegasUsadas);
    } catch (e) {
      console.error('[lote-mover] Error abriendo modal:', e);
      showMsg('❌ ' + e.message, 'error');
    }
  };

  // Alias para compatibilidad con botón "Mover" antiguo (primer lote)
  window.moverProducto = async function (productId) {
    // productId tiene formato loteId. Buscamos el producto que lo contenga.
    try {
      const productos = (window.INVENTORY_STATE && window.INVENTORY_STATE.productos) || [];
      const item = productos.find(p => p.id === productId || p.loteId === productId);
      if (!item) {
        showMsg('❌ Lote no encontrado en estado local', 'error');
        return;
      }
      return window.moverLote(item.codigoBarras, item.loteId || item.id);
    } catch (e) {
      console.error('[lote-mover] moverProducto error:', e);
      showMsg('❌ ' + e.message, 'error');
    }
  };

  console.log('✅ lote-mover.js cargado correctamente (window.moverLote / window.moverProducto)');
})();
