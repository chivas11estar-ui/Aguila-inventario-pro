// ============================================================
// Águila Inventario Pro - inventory-core.js (V3 - Multi-Lote)
// Soporta el mismo producto en múltiples bodegas y fechas
// Copyright © 2026 José A. G. Betancourt
// ============================================================

'use strict';

window.INVENTORY_CORE = {
  determinante: null,
  _initialized: false,
  ...(window.INVENTORY_CORE || {})
};

// Inicializar estado global del inventario
if (!window.INVENTORY_STATE) {
    window.INVENTORY_STATE = {
          productos: [],
          lotes: {},
          isRenderingInventory: false,
          lastUpdate: null,
          determinante: null
    };
}

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

function parseRequiredInteger(value, fieldName, minimum) {
  const raw = typeof value === 'string' ? value.trim() : value;
  if (raw === '' || raw === null || raw === undefined) throw new Error(fieldName + ' es obligatorio');
  if (typeof raw === 'string' && !/^\d+$/.test(raw)) throw new Error(fieldName + ' debe ser un entero');
  const numeric = Number(raw);
  if (!Number.isFinite(numeric) || !Number.isInteger(numeric) || numeric < minimum || Object.is(numeric, -0)) {
    throw new Error(fieldName + (minimum > 0 ? ' debe ser un entero mayor que 0' : ' debe ser un entero mayor o igual a 0'));
  }
  return numeric;
}

function validateRequiredIsoLocalDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Fecha de caducidad debe ser una fecha válida YYYY-MM-DD');
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) throw new Error('Fecha de caducidad debe ser una fecha válida YYYY-MM-DD');
  return value;
}

function validateProductInput(formData) {
  return {
    cajas: parseRequiredInteger(formData?.cajas, 'Cajas', 0),
    piezasPorCaja: parseRequiredInteger(formData?.piezasPorCaja, 'Piezas por caja', 1),
    fechaCaducidad: validateRequiredIsoLocalDate(formData?.fechaCaducidad)
  };
}

// ============================================================
// 3. GENERAR ID DE LOTE (bodega + fecha → llave única)
// ============================================================
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

// ============================================================
// 4. REFERENCIA AL PRODUCTO
// ============================================================
function getProductRef(determinante, codigoBarras) {
  const safeCode = sanitizeBarcode(codigoBarras);
  if (!safeCode || !determinante) return null;
  return firebase.database().ref(`productos/${determinante}/${safeCode}`);
}

function getCatalogProductRef(codigoBarras) {
  const safeCode = sanitizeBarcode(codigoBarras);
  if (!safeCode) return null;
  return firebase.database().ref(`catalogoProductos/${safeCode}`);
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
      const catalogRef = getCatalogProductRef(codigoBarras);
      const catalogSnapshot = catalogRef ? await catalogRef.once('value') : null;

      if (catalogSnapshot?.exists()) {
        return {
          ...catalogSnapshot.val(),
          codigoBarras: codigoBarras.trim(),
          stockTotal: 0,
          lotes: [],
          _exists: false,
          _catalogExists: true,
          _ref: ref
        };
      }

      return {
        codigoBarras: codigoBarras.trim(),
        _exists: false,
        _catalogExists: false,
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
  const validated = validateProductInput(formData);
  const det = await getCachedDeterminante();
  if (!det) throw new Error('No se pudo obtener el determinante');

  const safeCode = sanitizeBarcode(formData.codigoBarras);
  if (!safeCode) throw new Error('Código de barras inválido');

  const usuario = firebase.auth().currentUser?.email || 'sistema';
  const loteId = generarLoteId(formData.ubicacion, validated.fechaCaducidad);
  const ahora = Date.now();
  const cajasLlegadas = validated.cajas;
  const piezasPorCaja = validated.piezasPorCaja;
  const bodega = formData.ubicacion?.trim() || 'General';
  const fechaCaducidad = validated.fechaCaducidad;

  // El catálogo compartido solo contiene datos descriptivos.
  const catalogRef = getCatalogProductRef(safeCode);
  const catalogSnapshot = await catalogRef.once('value');
  if (!catalogSnapshot.exists()) {
    await catalogRef.set({
      nombre: formData.nombre.trim(),
      marca: formData.marca.trim(),
      piezasPorCaja,
      ...(formData.categoria?.trim() ? { categoria: formData.categoria.trim() } : {}),
      creadoEn: ahora,
      creadoPor: firebase.auth().currentUser?.uid || 'sistema'
    });
  }

  // La llegada se acumula dentro de una transacción sobre el producto.
  // Esto preserva los demás lotes y evita lost updates entre llegadas concurrentes.
  const productRef = firebase.database().ref('productos/' + det + '/' + safeCode);
  await new Promise((resolve, reject) => {
    productRef.transaction((currentProduct) => {
      const current = currentProduct && typeof currentProduct === 'object' ? currentProduct : {};
      const currentLotes = current.lotes && typeof current.lotes === 'object' ? current.lotes : {};
      const currentLote = currentLotes[loteId] && typeof currentLotes[loteId] === 'object'
        ? currentLotes[loteId]
        : {};
      const stockActual = parseFloat(currentLote.stock) || 0;
      const stockFinal = parseFloat((stockActual + cajasLlegadas).toFixed(2));

      return {
        ...current,
        nombre: formData.nombre.trim(),
        marca: formData.marca,
        codigoBarras: safeCode,
        piezasPorCaja,
        actualizadoPor: usuario,
        fechaActualizacion: ahora,
        lotes: {
          ...currentLotes,
          [loteId]: {
            ...currentLote,
            bodega,
            fechaCaducidad,
            stock: stockFinal,
            actualizado: ahora
          }
        }
      };
    }, (error, committed) => {
      if (error) return reject(error);
      if (!committed) return reject(new Error('LLEGADA_NO_CONFIRMADA'));
      resolve();
    });
  });

  console.log('✅ [CORE V3] Llegada acumulada: ' + formData.nombre + ' | ' + bodega + ' | ' + fechaCaducidad + ' | +' + cajasLlegadas);
  return { action: 'saved', codigoBarras: safeCode, loteId, cajasAgregadas: cajasLlegadas };
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
// 7.1 MODIFICAR STOCK MULTI-LOTE (Auto-Relleno)
// ============================================================
async function modificarStockMultiLote(codigoBarras, cantidadTotal, motivo = 'Relleno Automático') {
  const det = await getCachedDeterminante();
  if (!det) throw new Error('Sin determinante');

  const safeCode = sanitizeBarcode(codigoBarras);
  if (!safeCode) throw new Error('Código inválido');

  const cantidadSolicitada = parseFloat(cantidadTotal) || 0;
  if (cantidadSolicitada <= 0) throw new Error('Cantidad inválida');

  const productRef = firebase.database().ref('productos/' + det + '/' + safeCode);
  const ahora = Date.now();
  const usuario = firebase.auth().currentUser?.email || 'sistema';
  let detalleConfirmado = [];
  let stockDisponible = 0;

  const committedSnapshot = await new Promise((resolve, reject) => {
    productRef.transaction((currentProduct) => {
      if (!currentProduct || !currentProduct.lotes || typeof currentProduct.lotes !== 'object') {
        stockDisponible = 0;
        return undefined;
      }

      const lotesOrdenados = Object.entries(currentProduct.lotes)
        .map(([loteId, lote]) => ({ loteId, ...(lote || {}) }))
        .sort((a, b) => {
          if (!a.fechaCaducidad) return 1;
          if (!b.fechaCaducidad) return -1;
          return new Date(a.fechaCaducidad) - new Date(b.fechaCaducidad);
        });

      stockDisponible = lotesOrdenados.reduce((sum, lote) => sum + (parseFloat(lote.stock) || 0), 0);
      if (stockDisponible + 0.01 < cantidadSolicitada) return undefined;

      let pendiente = cantidadSolicitada;
      const lotesActualizados = { ...currentProduct.lotes };
      const detalle = [];

      for (const lote of lotesOrdenados) {
        if (pendiente <= 0) break;
        const stockEnLote = parseFloat(lote.stock) || 0;
        if (stockEnLote <= 0) continue;

        const aTomar = Math.min(stockEnLote, pendiente);
        const nuevoStock = parseFloat((stockEnLote - aTomar).toFixed(2));
        lotesActualizados[lote.loteId] = {
          ...currentProduct.lotes[lote.loteId],
          stock: nuevoStock,
          actualizado: ahora
        };
        detalle.push({
          loteId: lote.loteId,
          bodega: lote.bodega,
          tomado: aTomar,
          stockAnterior: stockEnLote,
          stockNuevo: nuevoStock
        });
        pendiente = parseFloat((pendiente - aTomar).toFixed(2));
      }

      if (pendiente > 0.01) return undefined;
      detalleConfirmado = detalle;

      return {
        ...currentProduct,
        lotes: lotesActualizados,
        fechaActualizacion: ahora,
        actualizadoPor: usuario
      };
    }, (error, committed, snapshot) => {
      if (error) return reject(error);
      if (!committed) {
        return reject(new Error('Stock total insuficiente. Disponible: ' + stockDisponible + ', Requerido: ' + cantidadSolicitada));
      }
      resolve(snapshot);
    });
  });

  const totalMovido = detalleConfirmado.reduce((sum, lote) => sum + lote.tomado, 0);
  return {
    success: true,
    detalle: detalleConfirmado,
    totalMovido,
    cantidadSolicitada,
    stockFinal: Object.values(committedSnapshot.val()?.lotes || {}).reduce((sum, lote) => sum + (parseFloat(lote.stock) || 0), 0),
    motivo
  };
}

// ============================================================
// 8. CARGAR INVENTARIO — expande lotes como filas individuales
// ============================================================
async function cargarInventario() {
  const det = await getCachedDeterminante();
  if (!det) {
    window.INVENTORY_STATE.isRenderingInventory = false;
    return;
  }

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

    // Limpieza opcional de lotes (puedes activar esto para auditoría)
    if (typeof limpiarLotesAgotados === 'function') limpiarLotesAgotados();

    if (typeof applyFiltersAndRender === 'function') applyFiltersAndRender();
    window.INVENTORY_STATE.isRenderingInventory = false;
  }, (error) => {
    clearTimeout(timeoutId);
    console.error('❌ [CORE] Error Firebase:', error);
    if (error.code === 'PERMISSION_DENIED') {
      showToast('⛔ Error de permisos. Reintenta login.', 'error');
    }
    if (typeof applyFiltersAndRender === 'function') applyFiltersAndRender();
    window.INVENTORY_STATE.isRenderingInventory = false;
  });

  if (window.LISTENERS_MANAGER) {
    window.LISTENERS_MANAGER.register('inventario_listener', () => {
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
      piezasPorCaja: document.getElementById('add-pieces-per-box')?.value ?? '',
      ubicacion: document.getElementById('add-warehouse')?.value.trim() || '',
      fechaCaducidad: document.getElementById('add-expiry-date')?.value ?? '',
      cajas: document.getElementById('add-boxes')?.value ?? ''
    };

    if (!formData.codigoBarras || !formData.nombre || !formData.ubicacion) {
      showToast('⚠️ Completa código, nombre y bodega', 'warning');
      return;
    }

    Object.assign(formData, validateProductInput(formData));

    const editingLoteId = window.EDITING_PRODUCT_ID || null;
    if (editingLoteId) {
      const det = await getCachedDeterminante();
      if (!det) throw new Error('No se pudo obtener el determinante');

      const safeCode = sanitizeBarcode(formData.codigoBarras);
      if (!safeCode) throw new Error('Código de barras inválido');

      const usuario = firebase.auth().currentUser?.email || 'sistema';
      const ahora = Date.now();
      const updates = {};

      // Actualiza datos generales del producto.
      updates[`productos/${det}/${safeCode}/nombre`] = formData.nombre.trim();
      updates[`productos/${det}/${safeCode}/marca`] = formData.marca;
      updates[`productos/${det}/${safeCode}/codigoBarras`] = safeCode;
      updates[`productos/${det}/${safeCode}/piezasPorCaja`] = formData.piezasPorCaja;
      updates[`productos/${det}/${safeCode}/actualizadoPor`] = usuario;
      updates[`productos/${det}/${safeCode}/fechaActualizacion`] = ahora;

      // Actualiza el MISMO lote (no crea uno nuevo).
      updates[`productos/${det}/${safeCode}/lotes/${editingLoteId}/bodega`] = formData.ubicacion?.trim() || 'General';
      updates[`productos/${det}/${safeCode}/lotes/${editingLoteId}/fechaCaducidad`] = formData.fechaCaducidad;
      updates[`productos/${det}/${safeCode}/lotes/${editingLoteId}/stock`] = formData.cajas;
      updates[`productos/${det}/${safeCode}/lotes/${editingLoteId}/actualizado`] = ahora;

      await firebase.database().ref().update(updates);
      showToast(`✅ ${formData.nombre} actualizado`, 'success');
    } else {
      await guardarProducto(formData);
      showToast(`✅ ${formData.nombre} guardado en ${formData.ubicacion}`, 'success');
    }

    window.EDITING_PRODUCT_ID = null;
    document.getElementById('add-product-form')?.reset();
    const submitBtn = document.querySelector('#add-product-form button[type="submit"]');
    if (submitBtn) {
      submitBtn.textContent = '✅ Guardar Producto';
      submitBtn.style.background = '';
    }
    const formTitle = document.querySelector('#tab-add h2');
    if (formTitle) {
      formTitle.textContent = '➕ Agregar Producto';
    }
    if (typeof window.switchTab === 'function') window.switchTab('inventory');
  } catch (error) {
    showToast('❌ ' + error.message, 'error');
  }
}

// ============================================================
// INICIALIZACIÓN
// ============================================================
function initInventoryCoreBindings() {
  if (window.__aguilaInventoryCoreBindingsReady) return;
  window.__aguilaInventoryCoreBindingsReady = true;

  const form = document.getElementById('add-product-form');
  if (form) form.addEventListener('submit', handleAddProductV2);

  firebase.auth().onAuthStateChanged((user) => {
    if (user) cargarInventario();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initInventoryCoreBindings);
} else {
  initInventoryCoreBindings();
}

// ============================================================
// EXPONER API PÚBLICA
// ============================================================
window.getCachedDeterminante = getCachedDeterminante;
window.sanitizeBarcode = sanitizeBarcode;
window.parseRequiredInteger = parseRequiredInteger;
window.validateProductInput = validateProductInput;
window.generarLoteId = generarLoteId;
window.buscarProductoPorCodigo = buscarProductoPorCodigo;
window.guardarProducto = guardarProducto;
window.modificarStock = modificarStock;
window.modificarStockMultiLote = modificarStockMultiLote;
window.cargarInventario = cargarInventario;
window.getProductRef = getProductRef;
window.getCatalogProductRef = getCatalogProductRef;
window.handleAddProductV2 = handleAddProductV2;

window.consultarProductoEnCero = async (codigo) => {
  const p = await buscarProductoPorCodigo(codigo);
  return {
    enCero: (p?.stockTotal || 0) === 0,
    producto: p
  };
};

console.log('✅ inventory-core.js V3 (Multi-Lote) cargado correctamente');

// ========================================================
// FUNCIÓN: Limpiar lotes agotados automáticamente (Optimización)
// ========================================================
async function limpiarLotesAgotados() {
  try {
    const productos = window.INVENTORY_STATE.productos || [];
    if (productos.length === 0) return;

    // Solo marcar si es necesario. En V3 los lotes ya vienen con su stock.
    // Esta función puede servir para auditoría de datos huérfanos.
    const lotesAgotados = productos.filter(p => p.stockTotal <= 0);

    if (lotesAgotados.length > 0) {
      console.log(`🧹 [CORE] Detectados ${lotesAgotados.length} lotes con stock 0`);
    }
  } catch (error) {
    console.error('❌ Error al limpiar lotes agotados:', error);
  }
}

// ========================================================
// FUNCIÓN: Agrupar y consolidar lotes
// ========================================================
function consolidarLotes() {
    try {
          const productos = window.INVENTORY_STATE.productos || [];
          const productosConsolidados = {};

          productos.forEach(prod => {
                  // Saltar lotes marcados como eliminados
                  if (prod.marcarEliminado) return;

                  const key = `${prod.codigoBarras}|${prod.ubicacion || prod.bodega}`;
                  if (!productosConsolidados[key]) {
                            productosConsolidados[key] = { ...prod, lotes: [] };
                  }
                  if (prod.loteId) {
                            productosConsolidados[key].lotes.push({
                                        loteId: prod.loteId,
                                        stock: prod.stockTotal,
                                        fechaCaducidad: prod.fechaCaducidad || 'N/A'
                            });
                  }
          });

          console.log('✅ Lotes consolidados:', productosConsolidados);
          return productosConsolidados;
    } catch (error) {
          console.error('❌ Error al consolidar lotes:', error);
          return {};
    }
}

window.limpiarLotesAgotados = limpiarLotesAgotados;
window.consolidarLotes = consolidarLotes;
