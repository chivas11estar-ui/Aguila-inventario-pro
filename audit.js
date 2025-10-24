// ============================================================
// Águila Inventario Pro - Módulo: audit.js
// Copyright © 2025 José A. G. Betancourt
// Todos los derechos reservados
// ============================================================

let currentAuditWarehouse = null;
let currentAuditProduct = null;
let todayAuditCount = 0;
let userDeterminante = null;
let auditFormInitialized = false;

// ============================================================
// OBTENER DETERMINANTE DEL USUARIO
// ============================================================
async function getUserDeterminanteAudit() {
  const userId = firebase.auth().currentUser?.uid;
  if (!userId) return null;
  
  try {
    const snapshot = await firebase.database().ref('usuarios/' + userId).once('value');
    const userData = snapshot.val();
    return userData?.determinante || null;
  } catch (error) {
    console.error('❌ Error al obtener determinante:', error);
    return null;
  }
}

// ============================================================
// CONFIGURAR BODEGA A AUDITAR
// ============================================================
function setupAuditWarehouse() {
  const warehouseInput = document.getElementById('audit-warehouse');
  const saveBtn = document.getElementById('save-warehouse-btn');
  const displayElement = document.getElementById('current-warehouse-display');
  
  if (!saveBtn) {
    console.error('❌ Botón save-warehouse-btn no encontrado');
    return false;
  }
  
  if (!warehouseInput) {
    console.error('❌ Input audit-warehouse no encontrado');
    return false;
  }
  
  console.log('✅ Elementos de bodega encontrados');
  
  // Función para guardar bodega
  const saveBodega = () => {
    const warehouseName = warehouseInput.value.trim();
    
    if (!warehouseName) {
      showToast('Ingresa el nombre de la bodega', 'warning');
      return;
    }
    
    currentAuditWarehouse = warehouseName;
    
    if (displayElement) {
      displayElement.textContent = `✅ Auditando: ${warehouseName}`;
      displayElement.style.color = 'var(--success)';
      displayElement.style.fontWeight = '700';
    }
    
    showToast(`Bodega seleccionada: ${warehouseName}`, 'success');
    console.log('✅ Bodega configurada:', warehouseName);
    
    const barcodeInput = document.getElementById('audit-barcode');
    if (barcodeInput) {
      barcodeInput.focus();
    }
  };
  
  // Agregar evento al botón
  saveBtn.onclick = saveBodega;
  
  // También permitir Enter en el input
  warehouseInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveBodega();
    }
  });
  
  console.log('✅ Eventos de bodega configurados');
  return true;
}

// ============================================================
// BUSCAR PRODUCTO PARA AUDITAR
// ============================================================
async function searchProductForAudit(barcode) {
  console.log('🔍 Buscando producto para auditar:', barcode);
  
  if (!currentAuditWarehouse) {
    showToast('⚠️ Primero selecciona una bodega', 'warning');
    return;
  }
  
  if (!userDeterminante) {
    userDeterminante = await getUserDeterminanteAudit();
  }
  
  if (!userDeterminante) {
    showToast('Error: No se encontró información de la tienda', 'error');
    return;
  }
  
  const inventoryRef = firebase.database().ref('inventario/' + userDeterminante);
  
  try {
    const snapshot = await inventoryRef.orderByChild('codigoBarras').equalTo(barcode).once('value');
    
    if (snapshot.exists()) {
      const products = snapshot.val();
      const productId = Object.keys(products)[0];
      const productData = products[productId];
      
      // Filtrar por bodega
      if (productData.ubicacion === currentAuditWarehouse) {
        currentAuditProduct = {
          id: productId,
          ...productData
        };
        
        console.log('✅ Producto encontrado:', currentAuditProduct);
        displayAuditProductInfo(currentAuditProduct);
        showToast('✅ Producto encontrado: ' + productData.nombre, 'success');
        
        const boxesInput = document.getElementById('audit-boxes');
        if (boxesInput) {
          boxesInput.focus();
          boxesInput.select();
        }
        
      } else {
        console.log('⚠️ Producto no está en esta bodega');
        showToast(`⚠️ Producto no está en "${currentAuditWarehouse}". Está en: "${productData.ubicacion}"`, 'warning');
        currentAuditProduct = null;
        hideAuditProductInfo();
      }
      
    } else {
      console.log('⚠️ Producto no encontrado');
      currentAuditProduct = null;
      hideAuditProductInfo();
      showToast('⚠️ Producto no encontrado en el inventario', 'warning');
    }
  } catch (error) {
    console.error('❌ Error al buscar producto:', error);
    showToast('❌ Error al buscar producto: ' + error.message, 'error');
  }
}

// ============================================================
// MOSTRAR INFORMACIÓN DEL PRODUCTO
// ============================================================
function displayAuditProductInfo(product) {
  const infoDiv = document.getElementById('audit-product-info');
  const nameEl = document.getElementById('audit-product-name');
  const brandEl = document.getElementById('audit-product-brand');
  
  if (infoDiv && nameEl && brandEl) {
    nameEl.innerHTML = '<strong>Producto:</strong> <span style="color: var(--primary);">' + product.nombre + '</span>';
    brandEl.textContent = 'Marca: ' + (product.marca || 'N/A') + ' | Stock registrado: ' + (product.cajas || 0) + ' cajas';
    infoDiv.style.display = 'block';
  }
}

function hideAuditProductInfo() {
  const infoDiv = document.getElementById('audit-product-info');
  if (infoDiv) {
    infoDiv.style.display = 'none';
  }
}

// ============================================================
// REGISTRAR CONTEO DE AUDITORÍA
// ============================================================
async function processAuditCount(countedBoxes) {
  if (!currentAuditWarehouse) {
    showToast('⚠️ Primero selecciona una bodega', 'warning');
    return;
  }
  
  if (!currentAuditProduct) {
    showToast('⚠️ Primero escanea un producto', 'warning');
    return;
  }
  
  console.log('📊 Procesando conteo:', countedBoxes, 'cajas');
  
  if (!userDeterminante) {
    userDeterminante = await getUserDeterminanteAudit();
  }
  
  if (!userDeterminante) {
    showToast('Error: No se encontró información de la tienda', 'error');
    return;
  }
  
  const counted = parseInt(countedBoxes);
  
  if (isNaN(counted) || counted < 0) {
    showToast('❌ La cantidad debe ser mayor o igual a 0', 'error');
    return;
  }
  
  const registeredStock = currentAuditProduct.cajas || 0;
  const difference = counted - registeredStock;
  
  // Registrar auditoría
  const auditData = {
    productoId: currentAuditProduct.id,
    productoNombre: currentAuditProduct.nombre,
    productoCodigo: currentAuditProduct.codigoBarras,
    marca: currentAuditProduct.marca,
    bodega: currentAuditWarehouse,
    stockRegistrado: registeredStock,
    stockContado: counted,
    diferencia: difference,
    fecha: new Date().toISOString(),
    auditor: firebase.auth().currentUser.email
  };
  
  try {
    await firebase.database().ref('auditorias/' + userDeterminante).push(auditData);
    console.log('✅ Auditoría registrada');
    
    // Actualizar contador
    todayAuditCount += counted;
    updateAuditTotalDisplay();
    
    // Agregar a historial
    addAuditToHistory(auditData);
    
    // Mostrar resultado
    let mensaje = `✅ Conteo registrado: ${counted} cajas`;
    if (difference !== 0) {
      mensaje += ` (Diferencia: ${difference > 0 ? '+' : ''}${difference})`;
    }
    showToast(mensaje, difference === 0 ? 'success' : 'warning');
    
    // Limpiar formulario
    const auditForm = document.getElementById('audit-form');
    if (auditForm) {
      auditForm.reset();
    }
    
    const barcodeInput = document.getElementById('audit-barcode');
    if (barcodeInput) {
      barcodeInput.focus();
    }
    
    currentAuditProduct = null;
    hideAuditProductInfo();
    
  } catch (error) {
    console.error('❌ Error al registrar auditoría:', error);
    showToast('❌ Error al registrar auditoría: ' + error.message, 'error');
  }
}

// ============================================================
// ACTUALIZAR DISPLAY DE TOTAL CONTADO
// ============================================================
function updateAuditTotalDisplay() {
  const totalElement = document.getElementById('audit-total-count');
  if (totalElement) {
    totalElement.textContent = todayAuditCount;
  }
}

// ============================================================
// AGREGAR AL HISTORIAL
// ============================================================
function addAuditToHistory(auditData) {
  const historyContainer = document.getElementById('audit-history');
  if (!historyContainer) return;
  
  // Limpiar mensaje de "no hay conteos"
  if (historyContainer.querySelector('.text-muted')) {
    historyContainer.innerHTML = '';
  }
  
  const time = new Date(auditData.fecha).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  const diffColor = auditData.diferencia === 0 
    ? 'var(--success)' 
    : auditData.diferencia > 0 
      ? 'var(--warning)' 
      : 'var(--error)';
  
  const historyItem = document.createElement('div');
  historyItem.style.cssText = `
    padding: 12px;
    margin-bottom: 8px;
    background: white;
    border-left: 4px solid ${diffColor};
    border-radius: 8px;
    font-size: 13px;
  `;
  
  historyItem.innerHTML = `
    <div style="font-weight: 700; margin-bottom: 4px;">${auditData.productoNombre}</div>
    <div style="color: var(--muted);">
      ${time} | Contado: ${auditData.stockContado} | 
      Diferencia: <span style="color: ${diffColor}; font-weight: 700;">
        ${auditData.diferencia > 0 ? '+' : ''}${auditData.diferencia}
      </span>
    </div>
  `;
  
  historyContainer.insertBefore(historyItem, historyContainer.firstChild);
}

// ============================================================
// CARGAR AUDITORÍAS DE HOY
// ============================================================
async function loadTodayAudits() {
  if (!userDeterminante) {
    userDeterminante = await getUserDeterminanteAudit();
  }
  
  if (!userDeterminante) return;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();
  
  const auditsRef = firebase.database().ref('auditorias/' + userDeterminante);
  
  try {
    const snapshot = await auditsRef.orderByChild('fecha').startAt(todayISO).once('value');
    
    if (snapshot.exists()) {
      const audits = [];
      snapshot.forEach((child) => {
        audits.push(child.val());
      });
      
      // Ordenar por fecha más reciente
      audits.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
      
      // Calcular total
      todayAuditCount = audits.reduce((sum, audit) => sum + (audit.stockContado || 0), 0);
      updateAuditTotalDisplay();
      
      // Mostrar en historial
      audits.forEach(audit => addAuditToHistory(audit));
      
      console.log('📊 Auditorías de hoy cargadas:', audits.length);
    } else {
      console.log('📭 No hay auditorías hoy');
    }
  } catch (error) {
    console.error('❌ Error al cargar auditorías:', error);
  }
}

// ============================================================
// CONFIGURAR EVENTOS DEL FORMULARIO
// ============================================================
function setupAuditForm() {
  if (auditFormInitialized) {
    console.log('⚠️ Formulario ya inicializado, saltando...');
    return;
  }
  
  console.log('🔧 Configurando formulario de auditoría...');
  
  // Configurar bodega
  const warehouseSetup = setupAuditWarehouse();
  if (!warehouseSetup) {
    console.error('❌ No se pudo configurar la bodega');
    return;
  }
  
  // Botón de escaneo
  const scanBtn = document.getElementById('audit-scan-btn');
  if (scanBtn) {
    scanBtn.onclick = () => {
      console.log('📷 Abriendo escáner de auditoría...');
      
      if (typeof openScanner === 'function') {
        openScanner((code) => {
          const barcodeInput = document.getElementById('audit-barcode');
          if (barcodeInput) {
            barcodeInput.value = code;
            searchProductForAudit(code);
          }
        });
      } else {
        showToast('❌ El escáner no está disponible', 'error');
      }
    };
  }
  
  // Input de código de barras
  const barcodeInput = document.getElementById('audit-barcode');
  if (barcodeInput) {
    // Buscar al presionar Enter
    barcodeInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const code = e.target.value.trim();
        if (code.length >= 8) {
          searchProductForAudit(code);
        } else {
          showToast('⚠️ Código demasiado corto', 'warning');
        }
      }
    });
  }
  
  // Submit del formulario
  const auditForm = document.getElementById('audit-form');
  if (auditForm) {
    auditForm.addEventListener('submit', (e) => {
      e.preventDefault();
      console.log('📝 Submit de formulario de auditoría');
      
      const boxesInput = document.getElementById('audit-boxes');
      const boxes = boxesInput?.value;
      
      if (!currentAuditWarehouse) {
        showToast('⚠️ Primero selecciona una bodega', 'warning');
        return;
      }
      
      if (!currentAuditProduct) {
        showToast('⚠️ Primero escanea un producto', 'warning');
        return;
      }
      
      if (boxes === '' || boxes === null || boxes === undefined) {
        showToast('❌ Ingresa una cantidad válida', 'error');
        return;
      }
      
      const boxesNum = parseInt(boxes);
      if (isNaN(boxesNum) || boxesNum < 0) {
        showToast('❌ La cantidad debe ser mayor o igual a 0', 'error');
        return;
      }
      
      processAuditCount(boxesNum);
    });
  }
  
  auditFormInitialized = true;
  console.log('✅ Formulario de auditoría configurado');
}

// ============================================================
// INICIALIZACIÓN
// ============================================================
function initAuditModule() {
  console.log('🎯 Inicializando módulo de auditoría...');
  
  // Verificar que Firebase esté cargado
  if (typeof firebase === 'undefined') {
    console.error('❌ Firebase no está cargado. Esperando...');
    setTimeout(initAuditModule, 1000);
    return;
  }
  
  // Verificar autenticación
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      console.log('✅ Usuario autenticado, configurando auditoría...');
      
      // Esperar un momento para asegurar que el DOM esté listo
      setTimeout(() => {
        setupAuditForm();
        loadTodayAudits();
      }, 500);
    } else {
      console.log('⏳ Esperando autenticación...');
    }
  });
}

// Inicialización al cargar el DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAuditModule);
} else {
  initAuditModule();
}

console.log('✅ audit.js cargado correctamente');