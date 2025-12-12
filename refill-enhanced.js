// ============================================================
// Águila Inventario Pro - refill-enhanced.js (VERSIÓN FINAL)
// Entrega: José A. G. Betancourt — 2025
// - Flujo: Si producto NO existe => pedir nombre, marca, piezas, ubicación, caducidad y cajas movidas
// - Fecha: usar selector nativo (guardar ISO)
// - Transacciones, listeners protegidos, validaciones y UX optimizado
// ============================================================

/* global firebase, showToast */

(() => {
  'use strict';

  // -------------------------
  // Estado y control
  // -------------------------
  let currentRefillProduct = null;
  let userDeterminanteRefill = null;
  let isCreatingNewProduct = false;

  let refillListener = null;
  let refillPath = null;

  // Helpers
  function log(...args) { if (console && console.log) console.log('[refill]', ...args); }
  function safeToast(msg, type = 'info') { try { if (typeof showToast === 'function') showToast(msg, type); else console.log('[toast]', type, msg); } catch(e) { console.log('[toast fail]', msg, e); } }

  function safeGetEl(id) { return document.getElementById(id); }

  function toIntSafe(value, fallback = 0) {
    if (value === undefined || value === null || value === '') return fallback;
    const n = parseInt(String(value).toString().replace(/\s+/g, ''), 10);
    return Number.isNaN(n) ? fallback : n;
  }

  function isoDateFromInput(value) {
    // value comes from input[type="date"] or native picker; keep YYYY-MM-DD if valid, else empty
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    // keep YYYY-MM-DD (no time)
    return d.toISOString().slice(0,10);
  }

  // -------------------------
  // Stop listeners
  // -------------------------
  function stopRefillListeners() {
    log('Stopping refill listeners...');
    try {
      if (refillPath && refillListener && firebase && firebase.database) {
        firebase.database().ref(refillPath).off('value', refillListener);
        log('Listener detached for', refillPath);
      }
    } catch (err) {
      console.warn('Error stopping refill listener', err);
    } finally {
      refillListener = null;
      refillPath = null;
      currentRefillProduct = null;
      isCreatingNewProduct = false;
    }
  }

  // integrate with global stopAllListeners
  if (typeof window.stopAllListeners === 'function') {
    const orig = window.stopAllListeners;
    window.stopAllListeners = function() {
      orig();
      stopRefillListeners();
    };
  } else {
    window.stopAllListeners = stopRefillListeners;
  }

  // -------------------------
  // Obtener determinante
  // -------------------------
  async function getUserDeterminanteRefill() {
    try {
      const uid = firebase.auth().currentUser?.uid;
      if (!uid) return null;
      const snap = await firebase.database().ref('usuarios/' + uid).once('value');
      const data = snap.val();
      return data?.determinante ? String(data.determinante) : null;
    } catch (err) {
      console.error('Error getting determinante', err);
      return null;
    }
  }

  // -------------------------
  // Start product listener (real-time)
  // -------------------------
  function startProductListener(productId) {
    if (!userDeterminanteRefill || !productId) return;
    stopRefillListeners();
    refillPath = `inventario/${userDeterminanteRefill}/${productId}`;

    refillListener = (snapshot) => {
      try {
        const data = snapshot.val() || {};
        const cajas = toIntSafe(data.cajas, 0);
        currentRefillProduct = { id: productId, ...data, cajas };
        const stockEl = safeGetEl('refill-current-stock');
        if (stockEl) stockEl.textContent = `Stock actual: ${cajas} cajas en ${data.ubicacion || 'almacén'}`;
        log('Realtime update - cajas:', cajas);
      } catch (err) {
        console.error('Listener snapshot error', err);
      }
    };

    const errorCb = (err) => {
      if (!firebase.auth().currentUser) { log('Ignore listener error (no user)'); return; }
      if (err && err.code === 'PERMISSION_DENIED') { log('Ignore permission error during logout'); return; }
      console.error('Listener error', err);
      safeToast('Error de conexión', 'error');
    };

    try {
      firebase.database().ref(refillPath).on('value', refillListener, errorCb);
      log('Listener attached to', refillPath);
    } catch (err) {
      console.error('Attach listener failed', err);
    }
  }

  // -------------------------
  // Mostrar/ocultar info UI
  // -------------------------
  function displayRefillProductInfo(product) {
    const infoDiv = safeGetEl('refill-product-info');
    const nameEl = safeGetEl('refill-product-name');
    const stockEl = safeGetEl('refill-current-stock');
    if (!infoDiv || !nameEl || !stockEl) return;
    if (product && product.id) {
      const cajas = toIntSafe(product.cajas, 0);
      nameEl.innerHTML = `<strong>Producto:</strong> ${product.nombre || 'Sin nombre'}`;
      stockEl.textContent = `Stock actual: ${cajas} cajas en ${product.ubicacion || 'almacén'}`;
    } else if (product) {
      nameEl.innerHTML = `<strong style="color:#f59e0b;">📝 NUEVO:</strong> ${product.nombre || ''}`;
      stockEl.textContent = `Bodega: ${product.ubicacion || '—'}`;
    }
    infoDiv.style.display = 'block';
  }

  function hideRefillProductInfo() {
    const infoDiv = safeGetEl('refill-product-info');
    if (infoDiv) infoDiv.style.display = 'none';
  }

  // -------------------------
  // Buscar producto por barcode
  // -------------------------
  async function searchProductForRefill(barcode) {
    log('searchProductForRefill', barcode);
    if (!barcode || barcode.length < 4) { // permitir códigos cortos si necesario; validamos con >=4
      safeToast('Código inválido', 'warning');
      return false;
    }

    stopRefillListeners();

    if (!userDeterminanteRefill) userDeterminanteRefill = await getUserDeterminanteRefill();
    if (!userDeterminanteRefill) { safeToast('Error: no info de tienda', 'error'); return false; }

    try {
      const invRef = firebase.database().ref('inventario/' + userDeterminanteRefill);
      const snap = await invRef.orderByChild('codigoBarras').equalTo(barcode).once('value');
      if (snap.exists()) {
        const products = snap.val();
        const id = Object.keys(products)[0];
        const data = products[id] || {};
        const cajas = toIntSafe(data.cajas, 0);
        currentRefillProduct = { id, ...data, cajas };
        isCreatingNewProduct = false;

        // autofill UI
        const n = safeGetEl('refill-nombre'); if (n) { n.value = data.nombre || ''; n.readOnly = true; n.style.background='#ecfdf5'; n.style.borderColor='#10b981'; }
        const m = safeGetEl('refill-marca'); if (m) { m.value = data.marca || ''; m.readOnly = true; m.style.background='#ecfdf5'; m.style.borderColor='#10b981'; }
        const p = safeGetEl('refill-piezas'); if (p) { p.value = data.piezasPorCaja || ''; p.readOnly = true; p.style.background='#ecfdf5'; p.style.borderColor='#10b981'; }
        const w = safeGetEl('refill-warehouse'); if (w) { w.value = data.ubicacion || ''; w.readOnly = true; w.style.background='#ecfdf5'; w.style.borderColor='#10b981'; }

        displayRefillProductInfo(currentRefillProduct);
        startProductListener(id);

        safeToast(`Producto encontrado: ${data.nombre || 'Sin nombre'}`, 'success');
        const boxesInp = safeGetEl('refill-boxes'); if (boxesInp) { setTimeout(()=> { boxesInp.focus(); boxesInp.select(); }, 250); }
        return true;
      } else {
        // No existe -> preparar creación guiada
        currentRefillProduct = { id: null, codigoBarras: barcode, cajas: 0 };
        isCreatingNewProduct = true;
        openCreateAndRefillModal(barcode);
        return false;
      }
    } catch (err) {
      console.error('Error searching product', err);
      safeToast('Error al buscar producto', 'error');
      return false;
    }
  }

  // -------------------------
  // Modal: crear y rellenar (cuando producto NO existe)
  // Modal debe existir en HTML con id 'create-refill-modal'
  // Campos esperados dentro del modal:
  //   create-refill-barcode (readonly)
  //   create-refill-name
  //   create-refill-brand
  //   create-refill-pieces
  //   create-refill-warehouse
  //   create-refill-expiry (type="date")
  //   create-refill-boxes
  //   create-refill-submit
  //   create-refill-cancel
  // -------------------------
  function openCreateAndRefillModal(barcode) {
    const modal = safeGetEl('create-refill-modal');
    if (!modal) {
      // fallback: prompt sequence (less ideal)
      const nombre = prompt('Producto no encontrado. Nombre del producto:');
      if (!nombre) return;
      const marca = prompt('Marca (ej. Otra):', 'Otra') || 'Otra';
      const piezas = prompt('Piezas por caja (24):', '24') || '24';
      const ubicacion = prompt('Ubicación (almacén):', 'almacén') || 'almacén';
      const cad = prompt('Fecha de caducidad (usa selector nativo si es posible) - formato AAAA-MM-DD:', '');
      const cajas = prompt('Cajas movidas (cantidad):', '0') || '0';
      // proceed to create & refill
      createProductAndRegister({
        codigoBarras: barcode,
        nombre,
        marca,
        piezasPorCaja: toIntSafe(piezas,24),
        ubicacion,
        fechaCaducidad: isoDateFromInput(cad),
        cajasMovidas: toIntSafe(cajas,0)
      });
      return;
    }

    // fill modal fields
    safeGetEl('create-refill-barcode') && (safeGetEl('create-refill-barcode').value = barcode);
    safeGetEl('create-refill-name') && (safeGetEl('create-refill-name').value = '');
    safeGetEl('create-refill-brand') && (safeGetEl('create-refill-brand').value = 'Otra');
    safeGetEl('create-refill-pieces') && (safeGetEl('create-refill-pieces').value = '24');
    safeGetEl('create-refill-warehouse') && (safeGetEl('create-refill-warehouse').value = '');
    safeGetEl('create-refill-expiry') && (safeGetEl('create-refill-expiry').value = '');
    safeGetEl('create-refill-boxes') && (safeGetEl('create-refill-boxes').value = '');

    modal.style.display = 'flex';
    modal.classList.remove('hidden');

    // focus first input
    setTimeout(()=> safeGetEl('create-refill-name')?.focus(), 200);
  }

  function closeCreateAndRefillModal() {
    const modal = safeGetEl('create-refill-modal');
    if (modal) modal.style.display = 'none';
  }

  // -------------------------
  // Crear producto + registrar movimiento (used by modal)
  // payload: { codigoBarras, nombre, marca, piezasPorCaja, ubicacion, fechaCaducidad, cajasMovidas }
  // -------------------------
  async function createProductAndRegister(payload) {
    if (!payload || !payload.codigoBarras) { safeToast('Datos incompletos', 'error'); return; }

    // validations
    const nombre = (payload.nombre || '').trim();
    const marca = (payload.marca || 'Otra').trim();
    const piezas = toIntSafe(payload.piezasPorCaja, 24);
    const ubicacion = (payload.ubicacion || '').trim();
    const fechaCad = isoDateFromInput(payload.fechaCaducidad || '') || '';
    const cajasMovidas = toIntSafe(payload.cajasMovidas, 0);

    if (!nombre) { safeToast('Ingrese nombre del producto', 'error'); return; }
    if (!marca) { safeToast('Ingrese marca', 'error'); return; }
    if (piezas <= 0) { safeToast('Piezas por caja inválidas', 'error'); return; }
    if (!ubicacion) { safeToast('Ingrese ubicación', 'error'); return; }
    if (fechaCad) {
      // ensure caducidad no anterior a hoy
      const today = new Date(); today.setHours(0,0,0,0);
      const cadDate = new Date(fechaCad);
      cadDate.setHours(0,0,0,0);
      if (cadDate < today) { safeToast('Fecha de caducidad inválida (fecha pasada)', 'error'); return; }
    }
    if (cajasMovidas <= 0) { safeToast('Ingresa cantidad de cajas movidas', 'error'); return; }

    try {
      if (!userDeterminanteRefill) userDeterminanteRefill = await getUserDeterminanteRefill();
      if (!userDeterminanteRefill) { safeToast('Error: no info de tienda', 'error'); return; }

      const inventoryRef = firebase.database().ref('inventario/' + userDeterminanteRefill);

      // Ensure product with same barcode doesn't exist (race protection)
      const existingSnap = await inventoryRef.orderByChild('codigoBarras').equalTo(payload.codigoBarras).once('value');

      if (existingSnap.exists()) {
        // If somehow exists now, fallback to transaction update on that node
        const existingId = Object.keys(existingSnap.val())[0];
        await registerMovementAndUpdateExisting({
          productId: existingId,
          cajasToAdd: cajasMovidas,
          productoNombre: nombre,
          productoCodigo: payload.codigoBarras,
          marca,
          ubicacion,
          fechaCad
        }, /*isCreationFallback=*/true);
        closeCreateAndRefillModal();
        return;
      }

      // Create product node with initial cajas = cajasMovidas
      const newRef = inventoryRef.push();
      const productData = {
        codigoBarras: payload.codigoBarras,
        nombre,
        marca,
        piezasPorCaja: piezas,
        ubicacion,
        cajas: cajasMovidas,
        fechaCaducidad: fechaCad,
        fechaCreacion: new Date().toISOString(),
        fechaActualizacion: new Date().toISOString(),
        creadoPor: firebase.auth().currentUser?.email || 'unknown'
      };

      await newRef.set(productData);

      // register movement with stockAnterior = 0, stockNuevo = cajasMovidas
      const movementsRef = firebase.database().ref('movimientos/' + userDeterminanteRefill);
      const movement = {
        tipo: 'relleno',
        productoId: newRef.key,
        productoNombre: nombre,
        productoCodigo: payload.codigoBarras,
        marca,
        ubicacion,
        cajasMovidas,
        stockAnterior: 0,
        stockNuevo: cajasMovidas,
        fecha: new Date().toISOString(),
        diaSemana: new Date().toLocaleDateString('es-MX', { weekday: 'long' }),
        realizadoPor: firebase.auth().currentUser?.email || 'unknown',
        esProductoNuevo: true,
        fechaCaducidad: fechaCad || ''
      };
      await movementsRef.push(movement);

      // Update UI & listeners
      currentRefillProduct = { id: newRef.key, ...productData };
      isCreatingNewProduct = false;
      startProductListener(newRef.key);
      displayRefillProductInfo(currentRefillProduct);
      safeToast(`✅ Producto creado y movimiento registrado: ${cajasMovidas} cajas`, 'success');

      // cleanup modal
      closeCreateAndRefillModal();

      // reset refill form if present
      const refillForm = safeGetEl('refill-form');
      if (refillForm) refillForm.reset();
      const barcodeField = safeGetEl('refill-barcode');
      if (barcodeField) barcodeField.focus();

      updateTodayMovements();

    } catch (err) {
      console.error('Error creating product and registering', err);
      safeToast('Error creando producto', 'error');
    }
  }

  // -------------------------
  // If product exists by the time we create, update with transaction (add cajas)
  // payload: { productId, cajasToAdd, productoNombre, productoCodigo, marca, ubicacion, fechaCad }
  // -------------------------
  async function registerMovementAndUpdateExisting(payload, isCreationFallback = false) {
    if (!payload || !payload.productId) return;
    try {
      if (!userDeterminanteRefill) userDeterminanteRefill = await getUserDeterminanteRefill();
      const prodPath = `inventario/${userDeterminanteRefill}/${payload.productId}`;
      const movementsRef = firebase.database().ref('movimientos/' + userDeterminanteRefill);

      await firebase.database().ref(prodPath).transaction((current) => {
        const currCajas = toIntSafe(current?.cajas, 0);
        const newCajas = currCajas + (payload.cajasToAdd || 0);
        return {
          ...current,
          cajas: newCajas,
          fechaActualizacion: new Date().toISOString(),
          actualizadoPor: firebase.auth().currentUser?.email || 'unknown',
          fechaCaducidad: payload.fechaCad || current?.fechaCaducidad || ''
        };
      }, async (error, committed, snapshotAfter) => {
        if (error) {
          console.error('Transaction failed', error);
          safeToast('Error actualizando inventario', 'error');
        } else if (!committed) {
          safeToast('No se pudo actualizar inventario', 'error');
        } else {
          const stockNuevo = toIntSafe(snapshotAfter?.val()?.cajas, 0);
          const stockAnterior = stockNuevo - (payload.cajasToAdd || 0);
          const movement = {
            tipo: 'relleno',
            productoId: payload.productId,
            productoNombre: payload.productoNombre || (snapshotAfter?.val()?.nombre || 'N/A'),
            productoCodigo: payload.productoCodigo || (snapshotAfter?.val()?.codigoBarras || 'N/A'),
            marca: payload.marca || (snapshotAfter?.val()?.marca || 'N/A'),
            ubicacion: payload.ubicacion || (snapshotAfter?.val()?.ubicacion || 'N/A'),
            cajasMovidas: payload.cajasToAdd || 0,
            stockAnterior,
            stockNuevo,
            fecha: new Date().toISOString(),
            diaSemana: new Date().toLocaleDateString('es-MX', { weekday: 'long' }),
            realizadoPor: firebase.auth().currentUser?.email || 'unknown',
            esProductoNuevo: !!isCreationFallback,
            fechaCaducidad: payload.fechaCad || snapshotAfter?.val()?.fechaCaducidad || ''
          };
          await movementsRef.push(movement);
          safeToast(`✅ Movimiento registrado: ${movement.cajasMovidas} cajas`, 'success');
        }
      });
    } catch (err) {
      console.error('registerMovementAndUpdateExisting error', err);
      safeToast('Error al registrar movimiento', 'error');
    }
  }

  // -------------------------
  // Procesar movimiento para producto existente (resta cajas)
  // -------------------------
  async function processRefillMovement(boxes) {
    const boxesToMove = toIntSafe(boxes, 0);
    if (!currentRefillProduct) { safeToast('Busca primero un producto', 'warning'); return; }
    if (boxesToMove <= 0) { safeToast('La cantidad debe ser mayor a 0', 'error'); return; }

    if (!userDeterminanteRefill) userDeterminanteRefill = await getUserDeterminanteRefill();
    if (!userDeterminanteRefill) { safeToast('Error: no info de tienda', 'error'); return; }

    // If product is new without id (shouldn't happen due to modal flow), create via createProductAndRegister
    if (!currentRefillProduct.id && isCreatingNewProduct) {
      // gather minimal data from form if exists
      const barcode = currentRefillProduct.codigoBarras || safeGetEl('refill-barcode')?.value || '';
      const nombre = safeGetEl('refill-nombre')?.value || '';
      const marca = safeGetEl('refill-marca')?.value || 'Otra';
      const piezas = toIntSafe(safeGetEl('refill-piezas')?.value, 24);
      const ubicacion = safeGetEl('refill-warehouse')?.value || 'almacén';
      const fechaCad = isoDateFromInput(safeGetEl('refill-expiry')?.value || '');
      await createProductAndRegister({
        codigoBarras: barcode,
        nombre,
        marca,
        piezasPorCaja: piezas,
        ubicacion,
        fechaCaducidad: fechaCad,
        cajasMovidas: boxesToMove
      });
      return;
    }

    // For existing product, use transaction to subtract boxes (as per original behavior)
    try {
      const prodPath = `inventario/${userDeterminanteRefill}/${currentRefillProduct.id}`;
      const movementsRef = firebase.database().ref('movimientos/' + userDeterminanteRefill);

      await firebase.database().ref(prodPath).transaction((current) => {
        const currCajas = toIntSafe(current?.cajas, 0);
        if (boxesToMove > currCajas) {
          // abort transaction
          return;
        }
        const newCajas = currCajas - boxesToMove;
        return {
          ...current,
          cajas: newCajas,
          fechaActualizacion: new Date().toISOString(),
          actualizadoPor: firebase.auth().currentUser?.email || 'unknown'
        };
      }, async (error, committed, snapshotAfter) => {
        if (error) {
          console.error('Transaction fail', error);
          safeToast('Error al actualizar stock', 'error');
        } else if (!committed) {
          safeToast('Stock insuficiente', 'error');
        } else {
          const stockNuevo = toIntSafe(snapshotAfter?.val()?.cajas, 0);
          const stockAnterior = stockNuevo + boxesToMove;
          const movement = {
            tipo: 'relleno',
            productoId: currentRefillProduct.id,
            productoNombre: currentRefillProduct.nombre || '',
            productoCodigo: currentRefillProduct.codigoBarras || '',
            marca: currentRefillProduct.marca || '',
            ubicacion: currentRefillProduct.ubicacion || '',
            cajasMovidas: boxesToMove,
            stockAnterior,
            stockNuevo,
            fecha: new Date().toISOString(),
            diaSemana: new Date().toLocaleDateString('es-MX', { weekday: 'long' }),
            realizadoPor: firebase.auth().currentUser?.email || 'unknown',
            esProductoNuevo: false,
            fechaCaducidad: snapshotAfter?.val()?.fechaCaducidad || ''
          };
          await movementsRef.push(movement);
          safeToast(`✅ Movimiento registrado: ${boxesToMove} cajas`, 'success');
        }
      });

      // cleanup UI and listeners
      stopRefillListeners();
      const refillForm = safeGetEl('refill-form'); if (refillForm) refillForm.reset();
      ['refill-nombre','refill-marca','refill-piezas','refill-warehouse','refill-expiry'].forEach(id => {
        const el = safeGetEl(id); if (el) { el.readOnly = false; el.style.background=''; el.style.borderColor=''; }
      });
      currentRefillProduct = null; isCreatingNewProduct = false;
      hideRefillProductInfo();
      safeGetEl('refill-barcode')?.focus();
      updateTodayMovements();

    } catch (err) {
      console.error('processRefillMovement error', err);
      safeToast('Error registrando movimiento', 'error');
    }
  }

  // -------------------------
  // Update today's movements count
  // -------------------------
  async function updateTodayMovements() {
    if (!userDeterminanteRefill) userDeterminanteRefill = await getUserDeterminanteRefill();
    if (!userDeterminanteRefill) return;
    try {
      const today = new Date(); today.setHours(0,0,0,0);
      const snap = await firebase.database().ref('movimientos/' + userDeterminanteRefill)
        .orderByChild('fecha').startAt(today.toISOString()).once('value');
      const count = snap.exists() ? snap.numChildren() : 0;
      const el = safeGetEl('total-movements');
      if (el) el.textContent = `${count} movimientos`;
    } catch (err) {
      if (!firebase.auth().currentUser || err.code === 'PERMISSION_DENIED') { log('Ignore updateTodayMovements error'); return; }
      console.error('updateTodayMovements error', err);
    }
  }

  // -------------------------
  // Setup form event handlers
  // -------------------------
  function setupRefillForm() {
    log('setupRefillForm');

    const barcode = safeGetEl('refill-barcode');
    if (barcode) {
      barcode.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); buscarProductoManual(); }
      });
      barcode.addEventListener('input', () => {
        if (currentRefillProduct) {
          stopRefillListeners();
          hideRefillProductInfo();
          ['refill-nombre','refill-marca','refill-piezas','refill-warehouse','refill-expiry'].forEach(id => {
            const el = safeGetEl(id); if (el) { el.readOnly = false; el.style.background=''; el.style.borderColor=''; }
          });
        }
      });
    }

    const form = safeGetEl('refill-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const barcodeVal = safeGetEl('refill-barcode')?.value?.trim();
        const boxesVal = safeGetEl('refill-boxes')?.value;
        if (!currentRefillProduct) {
          if (!barcodeVal) { safeToast('Ingresa un código de barras', 'warning'); safeGetEl('refill-barcode')?.focus(); return; }
          const found = await searchProductForRefill(barcodeVal);
          if (!found) return; // modal will handle creation
        }
        if (!boxesVal || boxesVal === '') { safeToast('Ingresa una cantidad válida', 'error'); safeGetEl('refill-boxes')?.focus(); return; }
        await processRefillMovement(boxesVal);
      });
    }

    // Modal buttons (create)
    const createSubmit = safeGetEl('create-refill-submit');
    if (createSubmit) {
      createSubmit.addEventListener('click', (e) => {
        e.preventDefault();
        // collect modal values
        const payload = {
          codigoBarras: safeGetEl('create-refill-barcode')?.value,
          nombre: safeGetEl('create-refill-name')?.value,
          marca: safeGetEl('create-refill-brand')?.value,
          piezasPorCaja: safeGetEl('create-refill-pieces')?.value,
          ubicacion: safeGetEl('create-refill-warehouse')?.value,
          fechaCaducidad: safeGetEl('create-refill-expiry')?.value,
          cajasMovidas: safeGetEl('create-refill-boxes')?.value
        };
        createProductAndRegister(payload);
      });
    }
    const createCancel = safeGetEl('create-refill-cancel');
    if (createCancel) createCancel.addEventListener('click', (e) => { e.preventDefault(); closeCreateAndRefillModal(); });

    log('Refill form configured');
  }

  async function buscarProductoManual() {
    const barcode = safeGetEl('refill-barcode')?.value?.trim();
    if (!barcode) { safeToast('Ingresa un código de barras', 'warning'); safeGetEl('refill-barcode')?.focus(); return; }
    if (barcode.length < 4) { safeToast('Código demasiado corto', 'warning'); safeGetEl('refill-barcode')?.focus(); return; }
    await searchProductForRefill(barcode);
  }

  // -------------------------
  // Init module
  // -------------------------
  function initRefillModule() {
    log('initRefillModule');
    firebase.auth().onAuthStateChanged((user) => {
      if (user) {
        userDeterminanteRefill = null; // will be fetched on demand
        setTimeout(() => {
          setupRefillForm();
          updateTodayMovements();
        }, 400);
      } else {
        stopRefillListeners();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRefillModule);
  } else {
    initRefillModule();
  }

  // Expose for debugging
  window.searchProductForRefill = searchProductForRefill;
  window.processRefillMovement = processRefillMovement;
  window.createProductAndRegister = createProductAndRegister;
  window.stopRefillListeners = stopRefillListeners;

  log('refill-enhanced.js (FINAL) loaded');

})();