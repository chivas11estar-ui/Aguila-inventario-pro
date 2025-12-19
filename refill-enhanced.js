// ============================================================
// Águila Inventario Pro - Módulo: refill-enhanced.js
// VERSIÓN CORREGIDA: Lectura real de stock (Adiós al "0 cajas")
// ============================================================

let currentRefillProduct = null;
let userDeterminanteRefill = null;

// --- Helper Determinante ---
async function getDetRefill() {
  if (window.userDeterminante) return window.userDeterminante;
  const u = firebase.auth().currentUser;
  if (!u) return null;
  const s = await firebase.database().ref('usuarios/' + u.uid).once('value');
  return s.val()?.determinante;
}

// --- 1. Buscar para Relleno ---
window.searchProductForRefill = async function(barcodeOverride) {
  const barcode = barcodeOverride || document.getElementById('refill-barcode').value.trim();
  
  if (!barcode) return;
  
  if (!userDeterminanteRefill) userDeterminanteRefill = await getDetRefill();
  if (!userDeterminanteRefill) return showToast('Error de usuario', 'error');

  showToast('🔍 Buscando...', 'info');

  try {
    const snapshot = await firebase.database()
      .ref(`inventario/${userDeterminanteRefill}`)
      .orderByChild('codigoBarras')
      .equalTo(barcode)
      .once('value');

    const products = snapshot.val();
    
    if (!products) {
      showToast('❌ Producto no encontrado', 'error');
      // Aquí podrías ofrecer crearlo, pero por lógica de relleno, solo rellenamos lo que existe.
      limpiarRefill();
      return;
    }

    // Tomamos el primer producto que coincida (asumiendo que en relleno quieres ver el producto global)
    // OJO: Si tienes el mismo código en varias bodegas, aquí podrías necesitar un selector.
    // Por ahora, tomamos el primero para arreglar el error del "0".
    const id = Object.keys(products)[0];
    const data = products[id];

    // ✅ FIX CRÍTICO: Aseguramos leer 'cajas' o poner 0 si es null, pero NO sobrescribir
    currentRefillProduct = {
      id: id,
      nombre: data.nombre,
      cajas: parseInt(data.cajas) || 0, // <--- Aquí estaba el error antes
      piezasPorCaja: data.piezasPorCaja,
      codigoBarras: data.codigoBarras,
      ubicacion: data.ubicacion
    };

    // Llenar UI
    document.getElementById('refill-product-name').value = data.nombre;
    
    // Mostrar Stock Actual (Input deshabilitado)
    const stockInput = document.getElementById('refill-current-stock');
    if (stockInput) {
        stockInput.value = currentRefillProduct.cajas; // Muestra el valor REAL
    }

    // Foco en cajas a agregar
    document.getElementById('refill-boxes').value = '';
    document.getElementById('refill-boxes').focus();
    
    showToast(`✅ Producto listo. Stock actual: ${currentRefillProduct.cajas}`, 'success');

  } catch (e) {
    console.error(e);
    showToast('Error de red', 'error');
  }
};

// --- 2. Guardar Relleno ---
window.processRefillMovement = async function() {
  const boxesInput = document.getElementById('refill-boxes');
  const cantidadAgregar = parseInt(boxesInput.value);

  if (!currentRefillProduct) return showToast('Escanea un producto primero', 'warning');
  if (isNaN(cantidadAgregar) || cantidadAgregar <= 0) return showToast('Cantidad inválida', 'warning');

  try {
    const stockAnterior = parseInt(currentRefillProduct.cajas) || 0;
    const nuevoStock = stockAnterior + cantidadAgregar; // Sumar cajas

    // Actualizar Firebase
    await firebase.database()
      .ref(`inventario/${userDeterminanteRefill}/${currentRefillProduct.id}`)
      .update({
        cajas: nuevoStock,
        ultimaActualizacion: new Date().toISOString()
      });

    // Registrar Movimiento
    await firebase.database()
      .ref(`movimientos/${userDeterminanteRefill}`)
      .push({
        tipo: 'relleno',
        producto: currentRefillProduct.nombre,
        codigo: currentRefillProduct.codigoBarras,
        cantidad: cantidadAgregar,
        stockAnterior: stockAnterior,
        stockNuevo: nuevoStock,
        fecha: new Date().toISOString(),
        usuario: firebase.auth().currentUser.email
      });

    showToast(`✅ Agregadas ${cantidadAgregar} cajas. Total: ${nuevoStock}`, 'success');
    
    // Limpiar
    limpiarRefill();
    document.getElementById('refill-barcode').focus();

  } catch (e) {
    console.error(e);
    showToast('Error al guardar', 'error');
  }
};

function limpiarRefill() {
  document.getElementById('refill-barcode').value = '';
  document.getElementById('refill-product-name').value = '';
  document.getElementById('refill-current-stock').value = '';
  document.getElementById('refill-boxes').value = '';
  currentRefillProduct = null;
}
