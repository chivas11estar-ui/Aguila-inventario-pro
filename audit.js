// ============================================================
// Águila Inventario Pro - Módulo: audit.js
// Copyright © 2025 José A. G. Betancourt
// Todos los derechos reservados
// ============================================================


let currentAuditWarehouse = null;
let currentAuditProduct = null;
let todayAuditCount = 0;
let userDeterminanteAudit = null;

// ============================================================
// OBTENER DETERMINANTE
// ============================================================
async function getUserDeterminanteAudit() {
  const userId = firebase.auth().currentUser?.uid;
  if (!userId) return null;
  
  try {
    const snapshot = await firebase.database().ref('usuarios/' + userId).once('value');
    const userData = snapshot.val();
    return userData?.determinante || null;
  } catch (error) {
    console.error('Error obtener determinante:', error);
    return null;
  }
}

// ============================================================
// GUARDAR BODEGA
// ============================================================
function saveBodega() {
  const input = document.getElementById('audit-warehouse');
  const display = document.getElementById('current-warehouse-display');
  
  if (!input || !input.value.trim()) {
    alert('Ingresa el nombre de la bodega');
    return;
  }
  
  currentAuditWarehouse = input.value.trim();
  
  if (display) {
    display.textContent = '✅ Auditando: ' + currentAuditWarehouse;
    display.style.color = '#10b981';
    display.style.fontWeight = '700';
  }
  
  showToast('Bodega seleccionada: ' + currentAuditWarehouse, 'success');
  document.getElementById('audit-barcode').focus();
}

// ============================================================
// BUSCAR PRODUCTO
// ============================================================
async function buscarProductoAudit() {
  const input = document.getElementById('audit-barcode');
  const barcode = input.value.trim();
  
  if (!barcode || barcode.length < 8) {
    alert('Ingresa un código válido');
    return;
  }
  
  if (!currentAuditWarehouse) {
    alert('Primero selecciona una bodega');
    return;
  }
  
  if (!userDeterminanteAudit) {
    userDeterminanteAudit = await getUserDeterminanteAudit();
  }
  
  if (!userDeterminanteAudit) {
    alert('Error: No se encontró información de la tienda');
    return;
  }
  
  try {
    const snapshot = await firebase.database()
      .ref('inventario/' + userDeterminanteAudit)
      .orderByChild('codigoBarras')
      .equalTo(barcode)
      .once('value');
    
    if (snapshot.exists()) {
      const products = snapshot.val();
      const productId = Object.keys(products)[0];
      const productData = products[productId];
      
      if (productData.ubicacion === currentAuditWarehouse) {
        currentAuditProduct = { id: productId, ...productData };
        
        document.getElementById('audit-product-name').innerHTML = 
          '<strong>Producto:</strong> <span style="color: #004aad;">' + productData.nombre + '</span>';
        document.getElementById('audit-product-brand').textContent = 
          'Marca: ' + productData.marca + ' | Stock: ' + productData.cajas + ' cajas';
        document.getElementById('audit-product-info').style.display = 'block';
        
        showToast('Producto encontrado', 'success');
        document.getElementById('audit-boxes').focus();
      } else {
        alert('Producto no está en ' + currentAuditWarehouse + '. Está en: ' + productData.ubicacion);
        currentAuditProduct = null;
        document.getElementById('audit-product-info').style.display = 'none';
      }
    } else {
      alert('Producto no encontrado');
      currentAuditProduct = null;
      document.getElementById('audit-product-info').style.display = 'none';
    }
  } catch (error) {
    console.error('Error buscar producto:', error);
    alert('Error al buscar producto: ' + error.message);
  }
}

// ============================================================
// REGISTRAR CONTEO
// ============================================================
async function registrarConteo() {
  const boxesInput = document.getElementById('audit-boxes');
  const boxes = parseInt(boxesInput.value);
  
  if (!currentAuditWarehouse) {
    alert('Primero selecciona una bodega');
    return false;
  }
  
  if (!currentAuditProduct) {
    alert('Primero escanea un producto');
    return false;
  }
  
  if (isNaN(boxes) || boxes < 0) {
    alert('Ingresa una cantidad válida');
    return false;
  }
  
  if (!userDeterminanteAudit) {
    userDeterminanteAudit = await getUserDeterminanteAudit();
  }
  
  const registeredStock = currentAuditProduct.cajas || 0;
  const difference = boxes - registeredStock;
  
  const auditData = {
    productoId: currentAuditProduct.id,
    productoNombre: currentAuditProduct.nombre,
    productoCodigo: currentAuditProduct.codigoBarras,
    marca: currentAuditProduct.marca,
    bodega: currentAuditWarehouse,
    stockRegistrado: registeredStock,
    stockContado: boxes,
    diferencia: difference,
    fecha: new Date().toISOString(),
    auditor: firebase.auth().currentUser.email
  };
  
  try {
    await firebase.database().ref('auditorias/' + userDeterminanteAudit).push(auditData);
    
    todayAuditCount += boxes;
    document.getElementById('audit-total-count').textContent = todayAuditCount;
    
    agregarHistorial(auditData);
    
    showToast('Conteo registrado: ' + boxes + ' cajas', 'success');
    
    document.getElementById('audit-form').reset();
    document.getElementById('audit-barcode').focus();
    currentAuditProduct = null;
    document.getElementById('audit-product-info').style.display = 'none';
    
    return true;
  } catch (error) {
    console.error('Error registrar:', error);
    alert('Error al registrar: ' + error.message);
    return false;
  }
}

// ============================================================
// AGREGAR A HISTORIAL
// ============================================================
function agregarHistorial(auditData) {
  const container = document.getElementById('audit-history');
  if (!container) return;
  
  if (container.querySelector('.text-muted')) {
    container.innerHTML = '';
  }
  
  const time = new Date(auditData.fecha).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  const color = auditData.diferencia === 0 ? '#10b981' : 
                auditData.diferencia > 0 ? '#f59e0b' : '#ef4444';
  
  const item = document.createElement('div');
  item.style.cssText = `
    padding: 12px;
    margin-bottom: 8px;
    background: white;
    border-left: 4px solid ${color};
    border-radius: 8px;
    font-size: 13px;
  `;
  
  item.innerHTML = `
    <div style="font-weight: 700; margin-bottom: 4px;">${auditData.productoNombre}</div>
    <div style="color: #6b7280;">
      ${time} | Contado: ${auditData.stockContado} | 
      Diferencia: <span style="color: ${color}; font-weight: 700;">
        ${auditData.diferencia > 0 ? '+' : ''}${auditData.diferencia}
      </span>
    </div>
  `;
  
  container.insertBefore(item, container.firstChild);
}

// ============================================================
// INICIALIZACIÓN SIMPLE
// ============================================================
function inicializarAudit() {
  console.log('Inicializando auditoría...');
  
  if (typeof firebase === 'undefined') {
    setTimeout(inicializarAudit, 1000);
    return;
  }
  
  firebase.auth().onAuthStateChanged((user) => {
    if (!user) return;
    
    console.log('Usuario autenticado');
    
    // Botón confirmar bodega
    const btnBodega = document.getElementById('save-warehouse-btn');
    if (btnBodega) {
      btnBodega.onclick = saveBodega;
    }
    
    // Input bodega con Enter
    const inputBodega = document.getElementById('audit-warehouse');
    if (inputBodega) {
      inputBodega.onkeypress = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          saveBodega();
        }
      };
    }
    
    // Buscar producto con Enter
    const inputBarcode = document.getElementById('audit-barcode');
    if (inputBarcode) {
      inputBarcode.onkeypress = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          buscarProductoAudit();
        }
      };
    }
    
    // Botón escanear
    const btnScan = document.getElementById('audit-scan-btn');
    if (btnScan) {
      btnScan.onclick = () => {
        if (typeof openScanner === 'function') {
          openScanner((code) => {
            document.getElementById('audit-barcode').value = code;
            buscarProductoAudit();
          });
        }
      };
    }
    
    // Submit formulario
    const form = document.getElementById('audit-form');
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        await registrarConteo();
      };
    }
    
    console.log('Auditoría configurada');
  });
}

// Iniciar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', inicializarAudit);
} else {
  inicializarAudit();
}

console.log('audit.js cargado');