// ============================================================
// Águila Inventario Pro - Módulo: inventory-core.js (RTDB ONLY)
// Versión 7.6 - Migración Total a Realtime Database
// Copyright © 2026 José A. G. Betancourt
// ============================================================

'use strict';

window.INVENTORY_CORE = {
  determinante: null,
  _initialized: false
};

/**
 * 1. OBTENER DETERMINANTE (centralizado, con caché)
 */
async function getCachedDeterminante() {
  if (window.INVENTORY_CORE.determinante) {
    return window.INVENTORY_CORE.determinante;
  }

  const user = firebase.auth().currentUser;
  if (!user) return null;

  try {
    const snapshot = await firebase.database().ref('usuarios/' + user.uid).once('value');
    const det = snapshot.val()?.determinante || null;
    if (det) window.INVENTORY_CORE.determinante = det;
    return det;
  } catch (error) {
    console.error('❌ [CORE] Error determinante:', error);
    return null;
  }
}

/**
 * 2. SANITIZAR CÓDIGO DE BARRAS
 */
function sanitizeBarcode(barcode) {
  if (!barcode || typeof barcode !== 'string') return null;
  const clean = barcode.trim();
  if (clean.length < 8) return null;
  return clean.replace(/[.#$\[\]/]/g, '_');
}

/**
 * 3. REFERENCIA AL PRODUCTO (RTDB ONLY)
 */
function getProductRef(determinante, codigoBarras) {
  const safeCode = sanitizeBarcode(codigoBarras);
  if (!safeCode || !determinante) return null;
  return firebase.database().ref(`productos/${determinante}/${safeCode}`);
}

/**
 * 4. BUSCAR PRODUCTO (RTDB ONLY)
 */
async function buscarProductoPorCodigo(codigoBarras) {
  const det = await getCachedDeterminante();
  if (!det) return null;

  const ref = getProductRef(det, codigoBarras);
  try {
    const snapshot = await ref.once('value');
    let data = {
      codigoBarras: codigoBarras.trim(),
      _exists: false,
      _ref: ref
    };

    if (snapshot.exists()) {
      data = { ...data, ...snapshot.val(), _exists: true };
    }
    return data;
  } catch (error) {
    console.error('❌ [CORE] Error buscando producto:', error);
    return null;
  }
}

/**
 * 5. GUARDAR PRODUCTO (RTDB ONLY - Tipos Estrictos)
 */
async function guardarProducto(formData) {
  const det = await getCachedDeterminante();
  if (!det) throw new Error('No se pudo obtener el determinante');

  const safeCode = sanitizeBarcode(formData.codigoBarras);
  const ref = getProductRef(det, formData.codigoBarras);
  const usuario = firebase.auth().currentUser?.email || 'sistema';

  try {
    const rtdbData = {
      nombre: formData.nombre.trim(),
      marca: formData.marca,
      codigoBarras: safeCode,
      piezasPorCaja: parseInt(formData.piezasPorCaja) || 1,
      ubicacion: formData.ubicacion?.trim() || 'General',
      fechaCaducidad: formData.fechaCaducidad || '',
      fechaActualizacion: Date.now(), // Siempre Number
      actualizadoPor: usuario,
      stockTotal: Math.max(0, parseInt(formData.cajas) || 0) // Siempre Number
    };

    await ref.set(rtdbData);
    console.log(`✅ [CORE] Producto guardado en RTDB: ${formData.nombre}`);
    return { action: 'saved', codigoBarras: safeCode };
  } catch (error) {
    console.error('❌ [CORE] Error en guardarProducto:', error);
    throw error;
  }
}

/**
 * 6. MODIFICAR STOCK (RTDB ONLY - Transacción Atómica)
 */
async function modificarStock(codigoBarras, cantidad, operacion) {
  const det = await getCachedDeterminante();
  if (!det) throw new Error('Sin determinante');

  const ref = getProductRef(det, codigoBarras);
  if (!ref) throw new Error('Código de barras inválido');

  const stockRef = ref.child('stockTotal');

  return new Promise((resolve, reject) => {
    stockRef.transaction((currentStock) => {
      const stock = parseInt(currentStock) || 0;
      const qty = parseInt(cantidad) || 0;

      if (operacion === 'restar') {
        const resultado = stock - qty;
        return resultado < 0 ? undefined : resultado;
      }
      if (operacion === 'sumar') return stock + qty;
      if (operacion === 'establecer') return Math.max(0, qty);
      
      return currentStock;
    }, (error, committed, snapshot) => {
      if (error) reject(error);
      else if (!committed) reject(new Error('STOCK_INSUFICIENTE'));
      else resolve(snapshot.val());
    });
  });
}

/**
 * 7. CARGAR INVENTARIO (RTDB ONLY)
 */
async function cargarInventario() {
  const det = await getCachedDeterminante();
  if (!det) return;

  if (window.LISTENERS_MANAGER) window.LISTENERS_MANAGER.unsubscribe('inventario_listener');

  const inventoryRef = firebase.database().ref('productos/' + det);
  inventoryRef.on('value', (snapshot) => {
    const productsObject = snapshot.val();
    window.INVENTORY_STATE.productos = productsObject 
      ? Object.keys(productsObject).map(code => ({ id: code, ...productsObject[code] }))
      : [];
    
    if (typeof applyFiltersAndRender === 'function') applyFiltersAndRender();
  });

  if (window.LISTENERS_MANAGER) {
    window.LISTENERS_MANAGER.register('inventario_listener', () => inventoryRef.off('value'));
  }
}

// Event Listeners y Exposición de API
document.addEventListener('DOMContentLoaded', () => {
  const addProductForm = document.getElementById('add-product-form');
  if (addProductForm) addProductForm.addEventListener('submit', handleAddProductV2);
  firebase.auth().onAuthStateChanged((user) => { if (user) cargarInventario(); });
});

async function handleAddProductV2(event) {
  if (event) event.preventDefault();
  try {
    const formData = {
      codigoBarras: document.getElementById('add-barcode')?.value.trim() || '',
      nombre: document.getElementById('add-product-name')?.value.trim() || '',
      marca: document.getElementById('add-brand')?.value || '',
      piezasPorCaja: parseInt(document.getElementById('add-pieces-per-box')?.value || 0),
      ubicacion: document.getElementById('add-warehouse')?.value.trim() || '',
      fechaCaducidad: document.getElementById('add-expiry-date')?.value || '',
      cajas: parseInt(document.getElementById('add-boxes')?.value || 0)
    };
    await guardarProducto(formData);
    showToast(`✅ Producto guardado: ${formData.nombre}`, 'success');
    document.getElementById('add-product-form')?.reset();
    if (typeof window.switchTab === 'function') window.switchTab('inventory');
  } catch (error) {
    showToast('❌ ' + error.message, 'error');
  }
}

// Exponer API
window.getCachedDeterminante = getCachedDeterminante;
window.sanitizeBarcode = sanitizeBarcode;
window.buscarProductoPorCodigo = buscarProductoPorCodigo;
window.guardarProducto = guardarProducto;
window.modificarStock = modificarStock;
window.cargarInventario = cargarInventario;
window.getProductRef = getProductRef;
window.consultarProductoEnCero = async (codigo) => {
  const p = await buscarProductoPorCodigo(codigo);
  return { enCero: (parseInt(p?.stockTotal) || 0) === 0, producto: p };
};