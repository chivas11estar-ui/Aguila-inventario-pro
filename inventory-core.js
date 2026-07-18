// ============================================================
// Águila Inventario Pro - inventory-core.js (V5.0 - FULL ENGINE)
// Motor de Inventario, Edición y Multi-Lote Blindado
// Copyright © 2026 José A. G. Betancourt
// ============================================================

'use strict';

window.INVENTORY_CORE = { determinante: null, _initialized: false };

if (!window.INVENTORY_STATE) {
    window.INVENTORY_STATE = {
          productos: [],
          lotes: {},
          isRenderingInventory: false,
          lastUpdate: null,
          determinante: null
    };
}

// 1. UTILIDADES
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

function sanitizeBarcode(barcode) {
  if (!barcode || typeof barcode !== 'string') return null;
  return barcode.trim().replace(/[.#$\[\]/]/g, '_');
}

function generarLoteId(bodega, fechaCaducidad) {
  const b = (bodega || 'General').trim();
  const f = (fechaCaducidad || 'sin-fecha').trim();
  return btoa(unescape(encodeURIComponent(`${b}_${f}`))).replace(/=/g, '').substring(0, 30);
}

// 2. MOTOR DE BÚSQUEDA Y CARGA
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
          loteId, bodega: lote.bodega || 'General',
          fechaCaducidad: lote.fechaCaducidad || '', stock: s, actualizado: lote.actualizado
        });
      });
      lotesArray.sort((a, b) => (new Date(a.fechaCaducidad) - new Date(b.fechaCaducidad)));
    }
    return { ...data, codigoBarras: safeCode, stockTotal, lotes: lotesArray, _exists: true };
  } catch (e) { return null; }
}

async function cargarInventario() {
  const det = await getCachedDeterminante();
  if (!det) return;
  const inventoryRef = firebase.database().ref('productos/' + det);

  // Limpiar estado inicial
  window.INVENTORY_STATE.productos = [];

  inventoryRef.on('value', (snapshot) => {
    try {
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
              id: loteId, codigoBarras, nombre: prod.nombre || 'Sin nombre',
              marca: prod.marca || 'Otra', piezasPorCaja: prod.piezasPorCaja || 0,
              ubicacion: lote.bodega || 'General', fechaCaducidad: lote.fechaCaducidad || '',
              stockTotal: parseFloat(lote.stock) || 0, loteId
            });
          });
        }
      });
      window.INVENTORY_STATE.productos = productosExpandidos;
      console.log('🏎️ Ferrari en pista: Inventario cargado.');
      if (typeof applyFiltersAndRender === 'function') applyFiltersAndRender();
    } catch (e) {
      console.error('❌ Error en el motor:', e);
    }
  }, (error) => {
    if (error.code === 'PERMISSION_DENIED') showToast('⛔ Error de permisos en Firebase', 'error');
  });
}

// 3. MOTOR DE ESCRITURA (ALTA Y EDICIÓN)
async function guardarProducto(formData) {
  const det = await getCachedDeterminante();
  const safeCode = sanitizeBarcode(formData.codigoBarras);
  const loteId = window.EDITING_PRODUCT_ID || generarLoteId(formData.ubicacion, formData.fechaCaducidad);
  const ahora = Date.now();
  const updates = {};

  // Actualizar Info General
  updates[`productos/${det}/${safeCode}/nombre`] = formData.nombre;
  updates[`productos/${det}/${safeCode}/marca`] = formData.marca;
  updates[`productos/${det}/${safeCode}/piezasPorCaja`] = formData.piezasPorCaja;
  updates[`productos/${det}/${safeCode}/fechaActualizacion`] = ahora;

  // Actualizar Lote Específico
  updates[`productos/${det}/${safeCode}/lotes/${loteId}/bodega`] = formData.ubicacion;
  updates[`productos/${det}/${safeCode}/lotes/${loteId}/fechaCaducidad`] = formData.fechaCaducidad;
  updates[`productos/${det}/${safeCode}/lotes/${loteId}/stock`] = formData.cajas;
  updates[`productos/${det}/${safeCode}/lotes/${loteId}/actualizado`] = ahora;

  return firebase.database().ref().update(updates);
}

// 4. MANEJADOR DE FORMULARIO (FIX DEL REINICIO)
async function handleAddProductV2(event) {
  if (event) event.preventDefault(); // 🛡️ EVITA EL REINICIO

  const submitBtn = event.target.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;

  try {
    const formData = {
      codigoBarras: document.getElementById('add-barcode').value,
      nombre: document.getElementById('add-product-name').value,
      marca: document.getElementById('add-brand').value,
      piezasPorCaja: parseInt(document.getElementById('add-pieces-per-box').value) || 1,
      ubicacion: document.getElementById('add-warehouse').value,
      fechaCaducidad: document.getElementById('add-expiry-date').value,
      cajas: parseFloat(document.getElementById('add-boxes').value) || 0
    };

    await guardarProducto(formData);
    showToast(window.EDITING_PRODUCT_ID ? '✅ Producto actualizado' : '✅ Producto guardado', 'success');

    // Reset UI
    window.EDITING_PRODUCT_ID = null;
    document.getElementById('add-product-form').reset();
    if (typeof switchTab === 'function') switchTab('inventory');

  } catch (error) {
    showToast('❌ Error al guardar', 'error');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

// 5. STOCK OPERACIONES
async function modificarStock(codigoBarras, cantidad, operacion, loteId = null) {
  const det = await getCachedDeterminante();
  const safeCode = sanitizeBarcode(codigoBarras);
  if (!loteId) {
    const p = await buscarProductoPorCodigo(codigoBarras);
    loteId = p?.lotes?.[0]?.loteId;
  }
  const stockRef = firebase.database().ref(`productos/${det}/${safeCode}/lotes/${loteId}/stock`);
  return stockRef.transaction((current) => {
    const stock = parseFloat(current || 0);
    const qty = parseFloat(cantidad) || 0;
    if (operacion === 'restar') return (stock < qty) ? undefined : parseFloat((stock - qty).toFixed(2));
    return parseFloat((stock + qty).toFixed(2));
  });
}

async function modificarStockMultiLote(codigoBarras, cantidadTotal) {
  const det = await getCachedDeterminante();
  const safeCode = sanitizeBarcode(codigoBarras);
  const producto = await buscarProductoPorCodigo(codigoBarras);
  let pendiente = parseFloat(cantidadTotal);
  const updates = {};
  const detalle = [];
  for (const lote of producto.lotes) {
    if (pendiente <= 0) break;
    const aTomar = Math.min(lote.stock, pendiente);
    updates[`productos/${det}/${safeCode}/lotes/${lote.loteId}/stock`] = parseFloat((lote.stock - aTomar).toFixed(2));
    detalle.push({ bodega: lote.bodega, tomado: aTomar });
    pendiente = parseFloat((pendiente - aTomar).toFixed(2));
  }
  await firebase.database().ref().update(updates);
  return { detalle };
}

// EXPORTAR Y ARRANCAR
window.buscarProductoPorCodigo = buscarProductoPorCodigo;
window.modificarStock = modificarStock;
window.modificarStockMultiLote = modificarStockMultiLote;
window.cargarInventario = cargarInventario;
window.sanitizeBarcode = sanitizeBarcode;
window.handleAddProductV2 = handleAddProductV2;

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('add-product-form');
  if (form) form.addEventListener('submit', handleAddProductV2);
});

console.log('✅ inventory-core.js V5.0 (MOTOR COMPLETO)');
