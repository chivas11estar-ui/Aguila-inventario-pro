// ============================================================
// Águila Inventario Pro - Módulo: inventory-core.js
// REFACTORIZACIÓN COMPLETA - Arquitectura por código de barras
// Copyright © 2025 José A. G. Betancourt
//
// CAMBIO ARQUITECTÓNICO:
// ANTES:  inventario/{determinante}/{pushId} → duplicados inevitables
// AHORA:  productos/{determinante}/{codigoBarras} → clave única, cero duplicados
//
// Este módulo reemplaza la lógica de escritura de inventory.js
// ============================================================

'use strict';

// ============================================================
// NAMESPACE CENTRAL
// ============================================================
window.INVENTORY_CORE = {
  determinante: null,
  _initialized: false
};

// ============================================================
// DEPENDENCIAS EXTERNAS REQUERIDAS (de otros módulos):
// - getLocalISOString()   → date-utils.js
// - getLocalDayStart()    → date-utils.js
// - showToast()           → ui.js
// - applyFiltersAndRender() → inventory.js
// - loadBrandStates()     → inventory.js
// - window.renderInventoryUI() → inventory-ui.js
// - window.INVENTORY_STATE → inventory.js
//
// Este módulo debe cargarse DESPUÉS de date-utils.js e inventory.js
// ============================================================

// ============================================================
// 1. OBTENER DETERMINANTE (centralizado, con caché)
// ============================================================
async function getCachedDeterminante() {
  if (window.INVENTORY_CORE.determinante) {
    return window.INVENTORY_CORE.determinante;
  }

  const user = firebase.auth().currentUser;
  if (!user) {
    console.error('❌ [CORE] Usuario no autenticado');
    return null;
  }

  try {
    const snapshot = await firebase.database()
      .ref('usuarios/' + user.uid)
      .once('value');

    const det = snapshot.val()?.determinante || null;
    if (det) {
      window.INVENTORY_CORE.determinante = det;
      console.log('🔑 [CORE] Determinante cargado:', det);
    } else {
      console.error('❌ [CORE] Sin determinante para usuario:', user.uid);
    }
    return det;
  } catch (error) {
    console.error('❌ [CORE] Error obteniendo determinante:', error);
    return null;
  }
}

// ============================================================
// 2. VALIDACIÓN CHECKSUM EAN-13 (SEGURIDAD FASE 1.4)
// ============================================================
// Previene escaneos de códigos falsos o corruptos.
// Aplica el algoritmo estándar EAN-13 de checksum.
// Si el código tiene 13 dígitos, valida el dígito de control.
function validateEAN13(ean) {
  if (!ean || typeof ean !== 'string') return false;

  const clean = ean.trim();

  // Si no es 13 dígitos, no es EAN-13 — pero permitir otras longitudes (EAN-8, UPC, etc)
  if (clean.length !== 13) return true; // Pass-through para códigos de otros formatos

  // Validar que todos son dígitos
  if (!/^\d{13}$/.test(clean)) return false;

  // Calcular checksum EAN-13
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(clean[i]);
    const weight = (i % 2 === 0) ? 1 : 3;
    sum += digit * weight;
  }

  const checkdigit = (10 - (sum % 10)) % 10;
  const providedCheckdigit = parseInt(clean[12]);

  if (checkdigit !== providedCheckdigit) {
    console.warn(`⚠️ [CORE] Checksum EAN-13 inválido: ${clean}`);
    return false;
  }

  return true;
}

// ============================================================
// 3. SANITIZAR CÓDIGO DE BARRAS PARA USAR COMO KEY
// ============================================================
// Firebase no permite: . # $ [ ] /
// Los códigos de barras normales (EAN-13, UPC-A) son numéricos puros,
// pero sanitizamos por seguridad.
function sanitizeBarcode(barcode) {
  if (!barcode || typeof barcode !== 'string') return null;
  const clean = barcode.trim();
  if (clean.length < 8) return null; // EAN-8 mínimo
  // Reemplazar caracteres prohibidos en Firebase keys
  return clean.replace(/[.#$\[\]/]/g, '_');
}

// ============================================================
// 3. REFERENCIA AL PRODUCTO POR CÓDIGO DE BARRAS
// ============================================================
// La nueva ruta es: productos/{determinante}/{codigoBarras}
// Esto ELIMINA la posibilidad de duplicados por diseño.
function getProductRef(determinante, codigoBarras) {
  const safeCode = sanitizeBarcode(codigoBarras);
  if (!safeCode || !determinante) return null;
  return firebase.database().ref(`productos/${determinante}/${safeCode}`);
}

// NUEVO: Referencia a Firestore (Arquitectura Pro)
function getFirestoreProductRef(determinante, codigoBarras) {
  if (!window.firestore || !determinante || !codigoBarras) return null;
  return window.firestore.doc(`stores/${determinante}/products/${codigoBarras.trim()}`);
}

// ============================================================
// 4. BUSCAR PRODUCTO POR CÓDIGO DE BARRAS (HÍBRIDO PRO)
// ============================================================
async function buscarProductoPorCodigo(codigoBarras) {
  const det = await getCachedDeterminante();
  if (!det) return null;

  const ref = getProductRef(det, codigoBarras);
  const fsRef = getFirestoreProductRef(det, codigoBarras);

  try {
    // Lectura paralela (RTDB para stock, Firestore para analytics)
    const [rtdbSnap, fsSnap] = await Promise.all([
      ref.once('value'),
      fsRef ? fsRef.get() : Promise.resolve(null)
    ]);

    let data = {
      codigoBarras: codigoBarras.trim(),
      _exists: false,
      _ref: ref,
      analytics: { daily_sales_avg: 0, last_restock_date: null }
    };

    if (rtdbSnap.exists()) {
      data = { ...data, ...rtdbSnap.val(), _exists: true };
    }

    if (fsSnap && fsSnap.exists) {
      const fsData = fsSnap.data();
      data.analytics = fsData.analytics || data.analytics;
      // Mezclar metadata de Firestore si es más completa
      if (fsData.metadata) {
        data.nombre = fsData.metadata.name || data.nombre;
        data.marca = fsData.metadata.brand || data.marca;
      }
    }

    return data;
  } catch (error) {
    console.error('❌ [CORE] Error buscando producto híbrido:', error);
    return null;
  }
}

// ============================================================
// 5. CREAR O ACTUALIZAR PRODUCTO (UPSERT HÍBRIDO)
// ============================================================
async function guardarProducto(formData) {
  const det = await getCachedDeterminante();
  if (!det) throw new Error('No se pudo obtener el determinante');

  const safeCode = sanitizeBarcode(formData.codigoBarras);
  const ref = getProductRef(det, formData.codigoBarras);
  const fsRef = getFirestoreProductRef(det, formData.codigoBarras);
  
  const timestamp = getLocalISOString();
  const usuario = firebase.auth().currentUser?.email || 'sistema';

  try {
    // 1. Preparar datos para RTDB (Stock y Operatividad)
    const rtdbData = {
      nombre: formData.nombre.trim(),
      marca: formData.marca,
      piezasPorCaja: parseInt(formData.piezasPorCaja),
      ubicacion: formData.ubicacion?.trim() || '',
      fechaCaducidad: formData.fechaCaducidad || '',
      fechaActualizacion: timestamp,
      actualizadoPor: usuario
    };

    if (formData.cajas !== undefined) {
      rtdbData.stockTotal = Math.max(0, parseInt(formData.cajas) || 0);
    }

    // 2. Preparar datos para Firestore (Metadata Pro y Búsqueda)
    const fsData = {
      metadata: {
        name: formData.nombre.trim(),
        brand: formData.marca,
        search_keywords: formData.nombre.toLowerCase().split(' '),
        pieces_per_box: parseInt(formData.piezasPorCaja)
      },
      inventory: {
        location: formData.ubicacion?.trim() || '',
        last_updated: firebase.firestore.FieldValue.serverTimestamp()
      }
    };

    // 3. Ejecutar actualizaciones en paralelo
    const updates = [ref.update(rtdbData)];
    if (fsRef) {
      updates.push(fsRef.set(fsData, { merge: true }));
    }

    await Promise.all(updates);

    console.log(`✅ [CORE] Producto guardado (Híbrido): ${formData.nombre}`);
    return { action: 'saved', codigoBarras: safeCode };

  } catch (error) {
    console.error('❌ [CORE] Error en guardarProducto Híbrido:', error);
    throw error;
  }
}

// ============================================================
// 6. VALIDACIÓN DE STOCK (FUNCIÓN CENTRAL ANTI-NEGATIVOS)
// ============================================================
// Esta función es el GUARDIÁN. Toda operación que reste stock
// DEBE pasar por aquí antes de escribir en Firebase.
//
// Retorna: { valido: true/false, stockActual, stockResultante, mensaje }
async function validarOperacionStock(codigoBarras, cajasARestar) {
  const producto = await buscarProductoPorCodigo(codigoBarras);

  if (!producto || !producto._exists) {
    return {
      valido: false,
      stockActual: 0,
      stockResultante: 0,
      mensaje: 'Producto no encontrado en el sistema'
    };
  }

  const stockActual = parseInt(producto.stockTotal) || 0;
  const cajas = parseInt(cajasARestar) || 0;

  if (cajas <= 0) {
    return {
      valido: false,
      stockActual: stockActual,
      stockResultante: stockActual,
      mensaje: 'La cantidad debe ser mayor a 0'
    };
  }

  const stockResultante = stockActual - cajas;

  if (stockResultante < 0) {
    return {
      valido: false,
      stockActual: stockActual,
      stockResultante: stockResultante,
      mensaje: `Stock insuficiente. Tienes ${stockActual} cajas, intentas mover ${cajas}.`
    };
  }

  return {
    valido: true,
    stockActual: stockActual,
    stockResultante: stockResultante,
    mensaje: `OK: ${stockActual} → ${stockResultante} cajas`
  };
}

// ============================================================
// 7. MODIFICAR STOCK DE FORMA SEGURA (TRANSACCIÓN)
// ============================================================
// Usa transaction() de Firebase para evitar race conditions
// cuando dos promotores operan el mismo producto.
async function modificarStock(codigoBarras, cantidad, operacion) {
  const det = await getCachedDeterminante();
  if (!det) throw new Error('Sin determinante');

  const ref = getProductRef(det, codigoBarras);
  if (!ref) throw new Error('Código de barras inválido');

  const stockRef = ref.child('stockTotal');

  return new Promise((resolve, reject) => {
    stockRef.transaction((currentStock) => {
      // currentStock puede ser null si el nodo no existe
      if (currentStock === null) return currentStock;

      const stock = parseInt(currentStock) || 0;
      const qty = parseInt(cantidad) || 0;

      if (operacion === 'restar') {
        const resultado = stock - qty;
        if (resultado < 0) {
          // Abortar transacción: retornar undefined cancela
          return; // Firebase transaction abort
        }
        return resultado;
      }

      if (operacion === 'sumar') {
        return stock + qty;
      }

      if (operacion === 'establecer') {
        return Math.max(0, qty);
      }

      return currentStock; // operación no reconocida, no cambiar
    }, (error, committed, snapshot) => {
      if (error) {
        console.error('❌ [CORE] Error en transacción de stock:', error);
        reject(error);
        return;
      }

      if (!committed) {
        // La transacción fue abortada (stock insuficiente)
        reject(new Error('STOCK_INSUFICIENTE'));
        return;
      }

      const nuevoStock = snapshot.val();
      console.log(`✅ [CORE] Stock actualizado: ${nuevoStock} cajas`);
      resolve(nuevoStock);
    });
  });
}

// ============================================================
// 8. CARGAR INVENTARIO COMPLETO (LISTENER EN TIEMPO REAL)
// ============================================================
// FASE 2.1: Usa listener-manager para prevenir memory leaks
// Reemplaza loadInventory() pero lee de la nueva ruta.
async function cargarInventario() {
  console.log('📦 [CORE] Cargando inventario desde nueva estructura...');

  const det = await getCachedDeterminante();
  if (!det) {
    console.error('❌ [CORE] Sin determinante para cargar inventario');
    if (typeof showToast === 'function') {
      showToast('Error: No se encontró ID de la tienda', 'error');
    }
    return;
  }

  // FASE 2.1: Desuscribir listener anterior si existe (prevenir duplicados)
  if (window.LISTENERS_MANAGER) {
    window.LISTENERS_MANAGER.unsubscribe('inventario_listener');
  }

  const inventoryRef = firebase.database().ref('productos/' + det);

  const listener = inventoryRef.on('value', (snapshot) => {
    try {
      const productsObject = snapshot.val();

      if (productsObject) {
        // Convertir objeto a array manteniendo el código como ID
        window.INVENTORY_STATE.productos = Object.keys(productsObject).map(code => ({
          id: code, // El código de barras ES el id
          codigoBarras: code,
          ...productsObject[code]
        }));

        console.log(`✅ [CORE] Inventario cargado: ${window.INVENTORY_STATE.productos.length} productos`);
        applyFiltersAndRender();
        loadBrandStates();
      } else {
        window.INVENTORY_STATE.productos = [];
        console.log('⚠️ [CORE] Inventario vacío');
        if (typeof window.renderInventoryUI === 'function') {
          window.renderInventoryUI([]);
        }
      }
    } catch (error) {
      console.error('❌ [CORE] Error procesando inventario:', error);
    }
  });

  // FASE 2.1: Registrar unsubscribe en gestor centralizado para autolimpieza
  if (window.LISTENERS_MANAGER) {
    window.LISTENERS_MANAGER.register('inventario_listener', () => {
      inventoryRef.off('value');
    });
  }
}

// ============================================================
// 9. HANDLER DEL FORMULARIO (REEMPLAZA handleAddProduct)
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
      cajas: parseInt(document.getElementById('add-boxes')?.value || 0)
    };

    const result = await guardarProducto(formData);

    if (result.action === 'created') {
      showToast(`✅ Producto creado: ${formData.nombre}`, 'success');
    } else {
      showToast(`📝 Producto actualizado: ${formData.nombre}`, 'success');
    }

    // Limpiar formulario
    document.getElementById('add-product-form')?.reset();
    window.EDITING_PRODUCT_ID = null;

    const formTitle = document.querySelector('#tab-add h2');
    if (formTitle) formTitle.textContent = '➕ Agregar Producto';

    const submitBtn = document.querySelector('#add-product-form button[type="submit"]');
    if (submitBtn) {
      submitBtn.textContent = '✅ Guardar Producto';
      submitBtn.style.background = '';
    }

    if (typeof window.switchTab === 'function') {
      window.switchTab('inventory');
    }

  } catch (error) {
    console.error('❌ [CORE] Error en handleAddProductV2:', error);
    showToast('❌ ' + error.message, 'error');
  }
}

// ============================================================
// 10. CONSULTA DE PRODUCTO EN 0 (CON ANALYTICS)
// ============================================================
// Cuando un producto tiene stockTotal === 0, esta función
// devuelve los datos enriquecidos que la UI necesita mostrar.
async function consultarProductoEnCero(codigoBarras) {
  const det = await getCachedDeterminante();
  if (!det) return null;

  const producto = await buscarProductoPorCodigo(codigoBarras);
  if (!producto || !producto._exists) return null;

  const stockTotal = parseInt(producto.stockTotal) || 0;
  if (stockTotal > 0) {
    // No está en 0, retornar datos normales
    return { enCero: false, producto: producto };
  }

  // ── PRODUCTO EN 0: calcular métricas ──

  // 1. Promedio diario de venta (últimos 7 días)
  let promedioDiario = 0;
  try {
    const hace7Dias = new Date();
    hace7Dias.setDate(hace7Dias.getDate() - 7);

    const movSnap = await firebase.database()
      .ref(`movimientos/${det}`)
      .orderByChild('fecha')
      .startAt(typeof getLocalDayStart === 'function' ? getLocalDayStart(hace7Dias) : '')
      .once('value');

    if (movSnap.exists()) {
      let totalPiezas = 0;
      movSnap.forEach(child => {
        const mov = child.val();
        if (mov.tipo === 'salida' && mov.productoCodigo === codigoBarras.trim()) {
          totalPiezas += parseInt(mov.piezasMovidas) || 0;
        }
      });
      promedioDiario = Math.round(totalPiezas / 7);
    }
  } catch (e) {
    console.warn('⚠️ [CORE] Error calculando promedio:', e);
  }

  // 2. Fecha del último relleno
  const ultimoRelleno = producto.ultimoRelleno || 'Sin registro';

  return {
    enCero: true,
    producto: producto,
    promedioDiarioVenta: promedioDiario,
    ultimoRelleno: ultimoRelleno,
    mensaje: `⚠️ PRODUCTO EN 0 | Venta promedio: ${promedioDiario} pzas/día | Último relleno: ${ultimoRelleno}`
  };
}

// ============================================================
// INICIALIZACIÓN
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('🏗️ [CORE] Inicializando inventory-core.js...');

  // Reemplazar handler del formulario de agregar
  const addProductForm = document.getElementById('add-product-form');
  if (addProductForm) {
    // Remover listener anterior de inventory.js si existe
    if (typeof window.handleAddProduct === 'function') {
      addProductForm.removeEventListener('submit', window.handleAddProduct);
    }
    addProductForm.addEventListener('submit', handleAddProductV2);
    console.log('✅ [CORE] Formulario conectado a handleAddProductV2');
  }

  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      console.log('✅ [CORE] Usuario autenticado, cargando inventario...');
      setTimeout(() => cargarInventario(), 500);
    }
  });
});

// ============================================================
// EXPONER API PÚBLICA
// ============================================================
window.getCachedDeterminante = getCachedDeterminante;
window.sanitizeBarcode = sanitizeBarcode;
window.buscarProductoPorCodigo = buscarProductoPorCodigo;
window.guardarProducto = guardarProducto;
window.validarOperacionStock = validarOperacionStock;
window.modificarStock = modificarStock;
window.cargarInventario = cargarInventario;
window.handleAddProductV2 = handleAddProductV2;
window.consultarProductoEnCero = consultarProductoEnCero;

console.log('✅ inventory-core.js (Arquitectura por código de barras) cargado');
