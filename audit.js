// ============================================================
// Águila Inventario Pro - Módulo: audit.js
// VERSIÓN CORREGIDA: Lógica de "Bodega Seleccionada" blindada
// ============================================================

let currentAuditWarehouse = null;
let currentAuditProduct = null;
let userDeterminanteAudit = null;

// --- Obtener determinante ---
async function getUserDeterminanteAudit() {
  const user = firebase.auth().currentUser;
  if (!user) return null;
  
  // Intentar leer de caché global si existe
  if (window.userDeterminante) return window.userDeterminante;

  try {
    const snap = await firebase.database().ref('usuarios/' + user.uid).once('value');
    return snap.val()?.determinante || null;
  } catch (e) {
    console.error(e);
    return null;
  }
}

// --- 1. Guardar Bodega (Paso crítico) ---
window.saveBodega = function() {
  const input = document.getElementById('audit-warehouse');
  const warehouseName = input.value.trim();
  
  if (!warehouseName) {
    showToast('⚠️ Escribe el nombre de la bodega', 'warning');
    return;
  }

  // FIJAR LA VARIABLE DE VERDAD
  currentAuditWarehouse = warehouseName;

  // Actualizar UI
  document.getElementById('audit-warehouse-section').style.display = 'none';
  document.getElementById('audit-scan-section').style.display = 'block';
  
  const display = document.getElementById('current-warehouse-display');
  if(display) display.textContent = `Auditando: ${currentAuditWarehouse}`;
  
  showToast(`✅ Bodega fijada: ${currentAuditWarehouse}`, 'success');
};

// --- 2. Buscar Producto en Auditoría ---
window.buscarProductoAudit = async function(barcodeOverride) {
  const barcode = barcodeOverride || document.getElementById('audit-barcode').value.trim();

  if (!barcode || barcode.length < 3) {
    showToast('Código inválido', 'warning');
    return;
  }

  // VALIDACIÓN CRÍTICA: ¿Hay bodega?
  if (!currentAuditWarehouse) {
    showToast('⛔ ERROR: No hay bodega seleccionada. Reinicia la auditoría.', 'error');
    return;
  }

  if (!userDeterminanteAudit) userDeterminanteAudit = await getUserDeterminanteAudit();
  if (!userDeterminanteAudit) return showToast('Error de usuario', 'error');

  showToast('🔍 Buscando...', 'info');

  try {
    const snapshot = await firebase.database()
      .ref(`inventario/${userDeterminanteAudit}`)
      .orderByChild('codigoBarras')
      .equalTo(barcode)
      .once('value');

    const products = snapshot.val();
    
    if (!products) {
      showToast('❌ Producto no existe en inventario global', 'error');
      limpiarCamposAudit();
      return;
    }

    // FILTRADO ESTRICTO POR BODEGA
    let foundProduct = null;
    let foundId = null;

    Object.keys(products).forEach(key => {
      const p = products[key];
      // Aquí está la magia: Solo aceptamos si coincide la ubicación
      if (p.ubicacion.toLowerCase() === currentAuditWarehouse.toLowerCase()) {
        foundProduct = p;
        foundId = key;
      }
    });

    if (foundProduct) {
      // ÉXITO: Está en esta bodega
      currentAuditProduct = { id: foundId, ...foundProduct };
      
      document.getElementById('audit-count').value = ''; // Limpiar para que escriban el conteo
      document.getElementById('audit-count').focus();
      
      // Feedback visual (opcional, si tienes los elementos)
      if(document.getElementById('audit-stock-info')) {
         document.getElementById('audit-stock-info').textContent = `Sistema dice: ${foundProduct.cajas} cajas`;
      }
      
      showToast(`✅ Encontrado: ${foundProduct.nombre}`, 'success');
      
    } else {
      // FALLO: Existe el código, pero en OTRA bodega
      const other = Object.values(products)[0];
      showToast(`⚠️ Ese producto está en "${other.ubicacion}", no en "${currentAuditWarehouse}"`, 'warning');
      currentAuditProduct = null;
      limpiarCamposAudit();
    }

  } catch (e) {
    console.error(e);
    showToast('Error de red', 'error');
  }
};

// --- 3. Registrar Conteo (Guardar) ---
window.registrarConteo = async function() {
  const countInput = document.getElementById('audit-count');
  const count = parseInt(countInput.value);

  // Validaciones
  if (!currentAuditWarehouse) return showToast('Error: Sin bodega activa', 'error');
  if (!currentAuditProduct) return showToast('Primero escanea un producto válido', 'warning');
  if (isNaN(count) || count < 0) return showToast('Ingresa una cantidad válida', 'warning');

  try {
    const diferencia = count - (parseInt(currentAuditProduct.cajas) || 0);
    
    // 1. Actualizar Inventario Real
    await firebase.database()
      .ref(`inventario/${userDeterminanteAudit}/${currentAuditProduct.id}`)
      .update({
        cajas: count,
        fechaAuditoria: new Date().toISOString(),
        auditadoPor: firebase.auth().currentUser.email
      });

    // 2. Registrar en Historial de Auditoría
    await firebase.database()
      .ref(`auditorias/${userDeterminanteAudit}`)
      .push({
        fecha: new Date().toISOString(),
        bodega: currentAuditWarehouse,
        producto: currentAuditProduct.nombre,
        codigo: currentAuditProduct.codigoBarras,
        conteoSistema: currentAuditProduct.cajas,
        conteoFisico: count,
        diferencia: diferencia
      });

    showToast(`✅ Auditoría guardada. Diferencia: ${diferencia}`, 'success');
    
    // Limpiar para el siguiente
    document.getElementById('audit-barcode').value = '';
    document.getElementById('audit-count').value = '';
    document.getElementById('audit-barcode').focus();
    currentAuditProduct = null;

  } catch (e) {
    console.error(e);
    showToast('Error al guardar', 'error');
  }
};

// --- 4. Terminar / Salir ---
window.terminarAuditoria = function() {
  if (!confirm('¿Terminar auditoría de esta bodega?')) return;
  
  currentAuditWarehouse = null;
  currentAuditProduct = null;
  
  // Resetear UI
  document.getElementById('audit-warehouse').value = '';
  document.getElementById('audit-warehouse-section').style.display = 'block';
  document.getElementById('audit-scan-section').style.display = 'none';
  
  showToast('Auditoría finalizada', 'info');
};

function limpiarCamposAudit() {
  document.getElementById('audit-count').value = '';
}
