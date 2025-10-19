// ============================================================
// Águila Inventario Pro - Módulo: audit.js
// Copyright © 2025 José A. G. Betancourt
// Todos los derechos reservados
//
// Este archivo forma parte del sistema Águila Inventario Pro,
// desarrollado para promotores de PepsiCo con funcionalidades
// de gestión, auditoría y sincronización de inventario.
//
// Queda prohibida la reproducción, distribución o modificación
// sin autorización expresa del autor.
// ============================================================

let currentAuditWarehouse = null;
let currentAuditProduct = null;
let todayAuditCount = 0;

// ============================================================
// CONFIGURAR BODEGA A AUDITAR
// ============================================================
function setupAuditWarehouse() {
  const warehouseInput = document.getElementById('audit-warehouse');
  const saveBtn = document.getElementById('save-warehouse-btn');
  const displayElement = document.getElementById('current-warehouse-display');
  
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const warehouseName = warehouseInput?.value.trim();
      
      if (!warehouseName) {
        showToast('Ingresa el nombre de la bodega', 'warning');
        return;
      }
      
      currentAuditWarehouse = warehouseName;
      
      if (displayElement) {
        displayElement.textContent = `Auditando: ${warehouseName}`;
        displayElement.style.color = 'var(--success)';
        displayElement.style.fontWeight = '700';
      }
      
      showToast(`Bodega seleccionada: ${warehouseName}`, 'success');
      
      // Enfocar campo de código de barras
      const barcodeInput = document.getElementById('audit-barcode');
      if (barcodeInput) {
        barcodeInput.focus();
      }
    });
  }
}

// ============================================================
// BUSCAR PRODUCTO PARA AUDITAR
// ============================================================
function searchProductForAudit(barcode) {
  console.log('🔍 Buscando producto para auditar:', barcode);
  
  if (!currentAuditWarehouse) {
    showToast('Primero selecciona una bodega', 'warning');
    return;
  }
  
  const userId = firebase.auth().currentUser?.uid;
  if (!userId) {
    showToast('No hay usuario autenticado', 'error');
    return;
  }
  
  const inventoryRef = firebase.database().ref('inventario/' + userId);
  
  inventoryRef.orderByChild('codigoBarras').equalTo(barcode).once('value')
    .then((snapshot) => {
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
          showToast('Producto encontrado: ' + productData.nombre, 'success');
          
          // Enfocar campo de cantidad
          const boxesInput = document.getElementById('audit-boxes');
          if (boxesInput) {
            boxesInput.focus();
            boxesInput.select();
          }
          
        } else {
          console.log('⚠️ Producto no está en esta bodega');
          showToast(`Producto no está en ${currentAuditWarehouse}`, 'warning');
          currentAuditProduct = null;
          hideAuditProductInfo();
        }
        
      } else {
        console.log('⚠️ Producto no encontrado');
        currentAuditProduct = null;
        hideAuditProductInfo();
        showToast('Producto no encontrado en el inventario', 'warning');
      }
    })
    .catch((error) => {
      console.error('❌ Error al buscar producto:', error);
      showToast('Error al buscar producto: ' + error.message, 'error');
    });
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
function processAuditCount(countedBoxes) {
  if (!currentAuditWarehouse) {
    showToast('Primero selecciona una bodega', 'warning');
    return;
  }
  
  if (!currentAuditProduct) {
    showToast('Primero escanea un producto', 'warning');
    return;
  }
  
  console.log('📊 Procesando conteo:', countedBoxes, 'cajas');
  
  const userId = firebase.auth().currentUser?.uid;
  if (!userId) {
    showToast('No hay usuario autenticado', 'error');
    return;
  }
  
  const counted = parseInt(countedBoxes);
  
  if (counted < 0) {
    showToast('La cantidad debe ser mayor o igual a 0', 'error');
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
  
  firebase.database().ref('auditorias/' + userId).push(auditData)
    .then(() => {
      console.log('✅ Auditoría registrada');
      
      // Actualizar contador
      todayAuditCount += counted;
      updateAuditTotalDisplay();
      
      // Agregar a historial
      addAuditToHistory(auditData);
      
      // Mostrar resultado
      let mensaje = `Conteo registrado: ${counted} cajas`;
      if (difference !== 0) {
        mensaje += ` (Diferencia: ${difference > 0 ? '+' : ''}${difference})`;
      }
      showToast(mensaje, difference === 0 ? 'success' : 'warning');
      
      // Limpiar formulario
      document.getElementById('audit-form').reset();
      document.getElementById('audit-barcode').focus();
      currentAuditProduct = null;
      hideAuditProductInfo();
      
    })
    .catch((error) => {
      console.error('❌ Error al registrar auditoría:', error);
      showToast('Error al registrar auditoría: ' + error.message, 'error');
    });
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
  
  // Si está vacío, limpiar mensaje de "sin datos"
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
  
  // Insertar al inicio
  historyContainer.insertBefore(historyItem, historyContainer.firstChild);
}

// ============================================================
// CARGAR AUDITORÍAS DE HOY
// ============================================================
function loadTodayAudits() {
  const userId = firebase.auth().currentUser?.uid;
  if (!userId) return;
  
  const today = new Date().toISOString().split('T')[0];
  const auditsRef = firebase.database().ref('auditorias/' + userId);
  
  auditsRef.orderByChild('fecha').startAt(today).once('value')
    .then((snapshot) => {
      if (snapshot.exists()) {
        const audits = [];
        snapshot.forEach((child) => {
          audits.push(child.val());
        });
        
        // Ordenar por fecha descendente
        audits.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        
        // Calcular total
        todayAuditCount = audits.reduce((sum, audit) => sum + (audit.stockContado || 0), 0);
        updateAuditTotalDisplay();
        
        // Mostrar historial
        audits.forEach(audit => addAuditToHistory(audit));
        
        console.log('📊 Auditorías de hoy cargadas:', audits.length);
      }
    })
    .catch((error) => {
      console.error('❌ Error al cargar auditorías:', error);
    });
}

// ============================================================
// CONFIGURAR EVENTOS DEL FORMULARIO
// ============================================================
function setupAuditForm() {
  console.log('🔧 Configurando formulario de auditoría...');
  
  // Configurar bodega
  setupAuditWarehouse();
  
  // Botón de escaneo
  const scanBtn = document.getElementById('audit-scan-btn');
  if (scanBtn) {
    scanBtn.addEventListener('click', () => {
      if (typeof openScanner === 'function') {
        openScanner((code) => {
          const barcodeInput = document.getElementById('audit-barcode');
          if (barcodeInput) {
            barcodeInput.value = code;
            searchProductForAudit(code);
          }
        });
      } else {
        showToast('El escáner no está disponible', 'error');
      }
    });
  }
  
  // Buscar al escribir código
  const barcodeInput = document.getElementById('audit-barcode');
  if (barcodeInput) {
    barcodeInput.addEventListener('blur', (e) => {
      const code = e.target.value.trim();
      if (code.length >= 8) {
        searchProductForAudit(code);
      }
    });
    
    barcodeInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const code = e.target.value.trim();
        if (code.length >= 8) {
          searchProductForAudit(code);
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
      
      const boxes = document.getElementById('audit-boxes').value;
      
      if (!currentAuditWarehouse) {
        showToast('Primero selecciona una bodega', 'warning');
        return;
      }
      
      if (!currentAuditProduct) {
        showToast('Primero escanea un producto', 'warning');
        return;
      }
      
      if (boxes === '' || boxes < 0) {
        showToast('Ingresa una cantidad válida', 'error');
        return;
      }
      
      processAuditCount(boxes);
    });
  }
  
  console.log('✅ Formulario de auditoría configurado');
}

// ============================================================
// INICIALIZACIÓN
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('🎯 Inicializando módulo de auditoría...');
  
  // Esperar a que Firebase esté listo
  const initInterval = setInterval(() => {
    if (typeof firebase !== 'undefined' && firebase.auth().currentUser) {
      setupAuditForm();
      loadTodayAudits();
      clearInterval(initInterval);
    }
  }, 500);
  
  // Timeout de seguridad
  setTimeout(() => {
    clearInterval(initInterval);
    setupAuditForm();
  }, 10000);
});

console.log('✅ audit.js cargado correctamente');