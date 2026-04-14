// ============================================================
// Águila Inventario Pro - inventory-core.js (V3 - Multi-Lote)
// Soporta el mismo producto en múltiples bodegas y fechas
// Copyright © 2026 José A. G. Betancourt
// ============================================================

'use strict';

window.INVENTORY_CORE = {
  determinante: null,
  _initialized: false
};

// ============================================================
// 1. DETERMINANTE (con caché)
// ============================================================
async function getCachedDeterminante() {
  if (window.INVENTORY_CORE.determinante) {
    return window.INVENTORY_CORE.determinante;
  }
  const user = firebase.auth().currentUser;
  if (!user) return null;
  try {
    const snapshot = await firebase.database()
      .ref('usuarios/' + user.uid).once('value');
    const det = snapshot.val()?.determinante || null;
    if (det) window.INVENTORY_CORE.determinante = det;
    return det;
  } catch (error) {
    console.error('❌ [CORE] Error determinante:', error);
    return null;
  }
}

// ============================================================
// 2. SANITIZAR CÓDIGO DE BARRAS
// ============================================================
function sanitizeBarcode(barcode) {
  if (!barcode || typeof barcode !== 'string') return null;
  const clean = barcode.trim();
  if (clean.length < 8) return null;
  return clean.replace(/[.#$\[\]/]/g, '_');
}

// ============================================================
// 3. GENERAR ID DE LOTE (bodega + fecha → llave única)
// ============================================================
function generarLoteId(bodega, fechaCaducidad) {
  const raw = `${(bodega || 'general').trim()}_${fechaCaducidad || 'sin-fecha'}`;
  return btoa(unescape(encodeURIComponent(raw)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .substring(0, 30);
}

// ============================================================
// 4. REFERENCIA AL PRODUCTO
// ============================================================
function getProductRef(determinante, codigoBarras) {
  const safeCode = sanitizeBarcode(codigoBarras);
  if (!safeCode || !determinante) return null;
  return firebase.database().ref(`productos/${determinante}/${safeCode}`);
}

// ============================================================
// 5. BUSCAR PRODUCTO — retorna info + lotes expandidos
// ============================================================
async function buscarProductoPorCodigo(codigoBarras) {
  const det = await getCachedDeterminante();
  if (!det) return null;

  const ref = getProductRef(det, codigoBarras);
  if (!ref) return null;

  try {
    const snapshot = await ref.once('value');

    if (!snapshot.exists()) {
      return {
        codigoBarras: codigoBarras.trim(),
        _exists: false,
        _ref: ref
      };
    }

    const data = snapshot.val();

    // Calcular stockTotal sumando todos los lotes
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
      // Ordenar por caducidad más próxima primero
      lotesArray.sort((a, b) => {
        if (!a.fechaCaducidad) return 1;
        if (!b.fechaCaducidad) return -1;
        return new Date(a.fechaCaducidad) - new Date(b.fechaCaducidad);
      });
    } else if (data.stockTotal !== undefined) {
      // Compatibilidad con productos V2 (estructura plana)
      stockTotal = parseFloat(data.stockTotal) || 0;
      lotesArray.push({
        loteId: 'legacy',
        bodega: data.ubicacion || 'General',
        fechaCaducidad: data.fechaCaducidad || '',
        stock: stockTotal,
        actualizado: data.fechaActualizacion
      });
    }

    return {
      ...data,
      codigoBarras: codigoBarras.trim(),
      stockTotal,
      lotes: lotesArray,
      _exists: true,
      _ref: ref
    };
  } catch (error) {
    console.error('❌ [CORE] Error buscando producto:', error);
    return null;
  }
}

// ============================================================
// 6. GUARDAR PRODUCTO — quirúrgico por lote
// ============================================================
async function guardarProducto(formData) {
  const det = await getCachedDeterminante();
  if (!det) throw new Error('No se pudo obtener el determinante');

  const safeCode = sanitizeBarcode(formData.codigoBarras);
  if (!safeCode) throw new Error('Código de barras inválido');

  const usuario = firebase.auth().currentUser?.email || 'sistema';
  const loteId = generarLoteId(formData.ubicacion, formData.fechaCaducidad);
  const ahora = Date.now();

  const updates = {};

  // Info general del producto (no sobreescribe otros lotes)
  updates[`productos/${det}/${safeCode}/nombre`] = formData.nombre.trim();
  updates[`productos/${det}/${safeCode}/marca`] = formData.marca;
  updates[`productos/${det}/${safeCode}/codigoBarras`] = safeCode;
  updates[`productos/${det}/${safeCode}/piezasPorCaja`] = parseInt(formData.piezasPorCaja) || 1;
  updates[`productos/${det}/${safeCode}/actualizadoPor`] = usuario;
  updates[`productos/${det}/${safeCode}/fechaActualizacion`] = ahora;

  // Lote específico — bodega + fecha de caducidad
  updates[`productos/${det}/${safeCode}/lotes/${loteId}/bodega`] = formData.ubicacion?.trim() || 'General';
  updates[`productos/${det}/${safeCode}/lotes/${loteId}/fechaCaducidad`] = formData.fechaCaducidad || '';
  updates[`productos/${det}/${safeCode}/lotes/${loteId}/stock`] = Math.max(0, parseFloat(formData.cajas) || 0);
  updates[`productos/${det}/${safeCode}/lotes/${loteId}/actualizado`] = ahora;

  await firebase.database().ref().update(updates);
  console.log(`✅ [CORE V3] Lote guardado: ${formData.nombre} | ${formData.ubicacion} | ${formData.fechaCaducidad}`);

  return { action: 'saved', codigoBarras: safeCode, loteId };
}

// ============================================================
// 7. MODIFICAR STOCK — opera sobre lote específico
// ============================================================
async function modificarStock(codigoBarras, cantidad, operacion, loteId = null) {
  const det = await getCachedDeterminante();
  if (!det) throw new Error('Sin determinante');

  const safeCode = sanitizeBarcode(codigoBarras);
  if (!safeCode) throw new Error('Código inválido');

  // Si no se especifica loteId, usar el de caducidad más próxima
  if (!loteId) {
    const producto = await buscarProductoPorCodigo(codigoBarras);
    if (!producto || !producto.lotes || producto.lotes.length === 0) {
      throw new Error('Producto sin lotes disponibles');
    }
    // Usar el primer lote (ya ordenado por caducidad)
    loteId = producto.lotes[0].loteId;
  }

  // Determinar la ruta correcta del stock (Legacy vs V3)
  let stockPath = `productos/${det}/${safeCode}/lotes/${loteId}/stock`;
  let timestampPath = `productos/${det}/${safeCode}/lotes/${loteId}/actualizado`;

  if (loteId === 'legacy') {
    stockPath = `productos/${det}/${safeCode}/stockTotal`;
    timestampPath = `productos/${det}/${safeCode}/fechaActualizacion`;
    console.log('📜 [CORE] Detectado producto Legacy. Usando stockTotal.');
  }

  const stockRef = firebase.database().ref(stockPath);

  console.log(`🧪 [CORE] Intentando modificar stock en: ${stockPath}`);

  return new Promise((resolve, reject) => {
    stockRef.transaction((currentStock) => {
      console.log(`🔍 [TRANSACTION] Stock actual en DB (${stockPath}):`, currentStock);
      
      const stock = (currentStock === null) ? 0 : (parseFloat(currentStock) || 0);
      const qty = parseFloat(cantidad) || 0;

      if (operacion === 'restar') {
        const resultado = stock - qty;
        if (resultado < -0.01) { // Pequeño margen por flotantes
          console.error(`❌ [TRANSACTION] Abortado: Stock insuficiente (${stock} < ${qty})`);
          return undefined; // Aborta la transacción
        }
        return parseFloat(resultado.toFixed(2));
      }
      if (operacion === 'sumar') return parseFloat((stock + qty).toFixed(2));
      if (operacion === 'establecer') return Math.max(0, parseFloat(qty.toFixed(2)));
      return currentStock;
    }, (error, committed, snapshot) => {
      if (error) {
        console.error('❌ [TRANSACTION ERROR]', error);
        reject(error);
      } else if (!committed) {
        console.warn('⚠️ [TRANSACTION] No completada (Stock insuficiente o conflicto)');
        reject(new Error('STOCK_INSUFICIENTE'));
      } else {
        const nuevoValor = snapshot.val();
        console.log('✅ [TRANSACTION] Éxito. Nuevo stock:', nuevoValor);
        
        firebase.database()
          .ref(timestampPath)
          .set(Date.now());
        resolve(nuevoValor);
      }
    });
  });
}

// ============================================================
// 8. CARGAR INVENTARIO — expande lotes como filas individuales
// ============================================================
async function cargarInventario() {
  const det = await getCachedDeterminante();
  if (!det) return;

  if (window.LISTENERS_MANAGER) {
    window.LISTENERS_MANAGER.unsubscribe('inventario_listener');
  }

  const inventoryRef = firebase.database().ref('productos/' + det);

  // 🚀 [V9.0] Timeout para evitar Skeletons infinitos
  let timeoutId = setTimeout(() => {
    if (window.INVENTORY_STATE.productos.length === 0) {
      console.warn('⚠️ [CORE] Timeout: Firebase no responde.');
      showToast('⚠️ Tiempo de espera agotado. Verifica tu conexión.', 'warning');
      if (typeof applyFiltersAndRender === 'function') applyFiltersAndRender();
    }
  }, 10000);

  inventoryRef.on('value', (snapshot) => {
    clearTimeout(timeoutId);
    
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
            loteId,
            _version: 'v3'
          });
        });
      } else {
        productosExpandidos.push({
          id: codigoBarras,
          codigoBarras,
          nombre: prod.nombre || 'Sin nombre',
          marca: prod.marca || 'Otra',
          piezasPorCaja: prod.piezasPorCaja || 0,
          ubicacion: prod.ubicacion || 'General',
          fechaCaducidad: prod.fechaCaducidad || '',
          stockTotal: parseFloat(prod.stockTotal) || 0,
          _version: 'v2'
        });
      }
    });

    window.INVENTORY_STATE.productos = productosExpandidos;
    console.log(`✅ [CORE V3] Inventario cargado: ${productosExpandidos.length} entradas`);

    if (typeof applyFiltersAndRender === 'function') applyFiltersAndRender();
  }, (error) => {
    clearTimeout(timeoutId);
    console.error('❌ [CORE] Error Firebase:', error);
    if (error.code === 'PERMISSION_DENIED') {
      showToast('⛔ Error de permisos. Reintenta login.', 'error');
    }
    if (typeof applyFiltersAndRender === 'function') applyFiltersAndRender();
  });

  if (window.LISTENERS_MANAGER) {
    window.LISTENERS_MANAGER.register(inventoryRef, 'inventario_listener', () => {
      inventoryRef.off('value');
    });
  }
}

// ============================================================
// 9. HANDLE FORM — agregar/editar desde el formulario
// ============================================================
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
      cajas: parseFloat(document.getElementById('add-boxes')?.value || 0)
    };

    if (!formData.codigoBarras || !formData.nombre || !formData.ubicacion) {
      showToast('⚠️ Completa código, nombre y bodega', 'warning');
      return;
    }

    await guardarProducto(formData);
    showToast(`✅ ${formData.nombre} guardado en ${formData.ubicacion}`, 'success');
    document.getElementById('add-product-form')?.reset();
    if (typeof window.switchTab === 'function') window.switchTab('inventory');
  } catch (error) {
    showToast('❌ ' + error.message, 'error');
  }
}

// ============================================================
// INICIALIZACIÓN
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('add-product-form');
  if (form) form.addEventListener('submit', handleAddProductV2);

  firebase.auth().onAuthStateChanged((user) => {
    if (user) cargarInventario();
  });
});

// ============================================================
// EXPONER API PÚBLICA
// ============================================================
window.getCachedDeterminante = getCachedDeterminante;
window.sanitizeBarcode = sanitizeBarcode;
window.generarLoteId = generarLoteId;
window.buscarProductoPorCodigo = buscarProductoPorCodigo;
window.guardarProducto = guardarProducto;
window.modificarStock = modificarStock;
window.cargarInventario = cargarInventario;
window.getProductRef = getProductRef;
window.handleAddProductV2 = handleAddProductV2;

window.consultarProductoEnCero = async (codigo) => {
  const p = await buscarProductoPorCodigo(codigo);
  return {
    enCero: (p?.stockTotal || 0) === 0,
    producto: p
  };
};

console.log('✅ inventory-core.js V3 (Multi-Lote) cargado correctamente');
