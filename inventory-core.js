// ============================================================
// Águila Inventario Pro - inventory-core.js (V4.1 - RESTAURADO)
// Soporta Multi-Lote con transacciones seguras y carga de datos
// Copyright © 2026 José A. G. Betancourt
// ============================================================

'use strict';

window.INVENTORY_CORE = {
  determinante: null,
  _initialized: false
};

if (!window.INVENTORY_STATE) {
    window.INVENTORY_STATE = {
          productos: [],
          lotes: {},
          isRenderingInventory: false,
          lastUpdate: null,
          determinante: null
    };
}

// 1. DETERMINANTE
async function getCachedDeterminante() {
  if (window.INVENTORY_CORE.determinante) return window.INVENTORY_CORE.determinante;
  const user = firebase.auth().currentUser;
  if (!user) return null;
  try {
    const snapshot = await firebase.database().ref('usuarios/' + user.uid).once('value');
    const det = snapshot.val()?.determinante || null;
    if (det) window.INVENTORY_CORE.determinante = det;
    return det;
  } catch (error) { return null; }
}

// 2. SANITIZAR CÓDIGO
function sanitizeBarcode(barcode) {
  if (!barcode || typeof barcode !== 'string') return null;
  return barcode.trim().replace(/[.#$\[\]/]/g, '_');
}

// 3. GENERAR LOTE ID
function generarLoteId(bodega, fechaCaducidad) {
  const b = (bodega || 'General').trim();
  const f = (fechaCaducidad || 'sin-fecha').trim();
  const raw = `${b}_${f}`;
  return btoa(unescape(encodeURIComponent(raw)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .substring(0, 30);
}

// 4. BUSCAR PRODUCTO
async function buscarProductoPorCodigo(codigoBarras) {
  const det = await getCachedDeterminante();
  if (!det) return null;
  const safeCode = sanitizeBarcode(codigoBarras);
  try {
    const snapshot = await firebase.database().ref(`productos/${det}/${safeCode}`).once('value');
    if (!snapshot.exists()) return { codigoBarras: codigoBarras.trim(), _exists: false };

    const data = snapshot.val();
    let stockTotal = 0;
    const lotesArray = [];

    if (data.lotes) {
      Object.entries(data.lotes).forEach(([loteId, lote]) => {
        const s = parseFloat(lote.stock) || 0;
        stockTotal += s;
        lotesArray.push({
          loteId,
          bodega: lote.bodega || 'General',
          fechaCaducidad: lote.fechaCaducidad || '',
          stock: s,
          actualizado: lote.actualizado
        });
      });
      lotesArray.sort((a, b) => {
        if (!a.fechaCaducidad) return 1;
        if (!b.fechaCaducidad) return -1;
        return new Date(a.fechaCaducidad) - new Date(b.fechaCaducidad);
      });
    }
    return { ...data, codigoBarras: safeCode, stockTotal, lotes: lotesArray, _exists: true };
  } catch (e) { return null; }
}

// 5. MODIFICAR STOCK (UN LOTE)
async function modificarStock(codigoBarras, cantidad, operacion, loteId = null) {
  const det = await getCachedDeterminante();
  const safeCode = sanitizeBarcode(codigoBarras);
  if (!loteId) {
    const p = await buscarProductoPorCodigo(codigoBarras);
    loteId = p?.lotes?.[0]?.loteId;
  }
  if (!loteId) throw new Error('NO_LOTE');

  const stockRef = firebase.database().ref(`productos/${det}/${safeCode}/lotes/${loteId}/stock`);

  return stockRef.transaction((current) => {
    const stock = parseFloat(current || 0);
    const qty = parseFloat(cantidad) || 0;
    if (operacion === 'restar') {
      if (stock < qty) return undefined;
      return parseFloat((stock - qty).toFixed(2));
    }
    return parseFloat((stock + qty).toFixed(2));
  }).then(res => {
    if (!res.committed) throw new Error('STOCK_INSUFICIENTE');
    firebase.database().ref(`productos/${det}/${safeCode}/lotes/${loteId}/actualizado`).set(Date.now());
    return res.snapshot.val();
  });
}

// 6. MODIFICAR MULTI-LOTE (AUTO-RELLENO)
async function modificarStockMultiLote(codigoBarras, cantidadTotal) {
  const det = await getCachedDeterminante();
  const safeCode = sanitizeBarcode(codigoBarras);
  const producto = await buscarProductoPorCodigo(codigoBarras);

  if (!producto || producto.stockTotal < cantidadTotal) throw new Error('STOCK_INSUFICIENTE_TOTAL');

  let pendiente = parseFloat(cantidadTotal);
  const ahora = Date.now();
  const updates = {};
  const detalleConsumo = [];

  for (const lote of producto.lotes) {
    if (pendiente <= 0) break;
    const stockEnLote = parseFloat(lote.stock) || 0;
    if (stockEnLote <= 0) continue;

    const aTomar = Math.min(stockEnLote, pendiente);
    const nuevoStock = parseFloat((stockEnLote - aTomar).toFixed(2));

    updates[`productos/${det}/${safeCode}/lotes/${lote.loteId}/stock`] = nuevoStock;
    updates[`productos/${det}/${safeCode}/lotes/${lote.loteId}/actualizado`] = ahora;

    detalleConsumo.push({
      loteId: lote.loteId,
      bodega: lote.bodega,
      tomado: aTomar
    });
    pendiente = parseFloat((pendiente - aTomar).toFixed(2));
  }

  await firebase.database().ref().update(updates);
  return { detalle: detalleConsumo };
}

// 7. CARGAR INVENTARIO (ESTA ES LA QUE FALTABA)
async function cargarInventario() {
  const det = await getCachedDeterminante();
  if (!det) return;

  const inventoryRef = firebase.database().ref('productos/' + det);

  inventoryRef.on('value', (snapshot) => {
    const productsObject = snapshot.val();
    if (!productsObject) {
      window.INVENTORY_STATE.productos = [];
      if (typeof applyFiltersAndRender === 'function') applyFiltersAndRender();
      return;
    }

    const productosExpandidos = [];
    Object.keys(productsObject).forEach(codigoBarras => {
      const prod = productsObject[codigoBarras];
      if (prod.lotes) {
        Object.entries(prod.lotes).forEach(([loteId, lote]) => {
          productosExpandidos.push({
            id: loteId,
            codigoBarras,
            nombre: prod.nombre || 'Sin nombre',
            marca: prod.marca || 'Otra',
            piezasPorCaja: prod.piezasPorCaja || 0,
            ubicacion: lote.bodega || 'General',
            fechaCaducidad: lote.fechaCaducidad || '',
            stockTotal: parseFloat(lote.stock) || 0,
            loteId
          });
        });
      }
    });

    window.INVENTORY_STATE.productos = productosExpandidos;
    if (typeof applyFiltersAndRender === 'function') applyFiltersAndRender();
  });
}

// EXPORTAR TODO A GLOBAL
window.buscarProductoPorCodigo = buscarProductoPorCodigo;
window.modificarStock = modificarStock;
window.modificarStockMultiLote = modificarStockMultiLote;
window.generarLoteId = generarLoteId;
window.getCachedDeterminante = getCachedDeterminante;
window.cargarInventario = cargarInventario;
window.sanitizeBarcode = sanitizeBarcode;
window.getProductRef = (det, code) => firebase.database().ref(`productos/${det}/${sanitizeBarcode(code)}`);

console.log('✅ inventory-core.js V4.1 (RESTAURADO Y COMPLETO)');
