// ============================================================
// Águila Inventario Pro - Módulo: audit.js
// Copyright © 2025 José A. G. Betancourt
// Todos los derechos reservados
// ============================================================

let currentAuditWarehouse = null;
let currentAuditProduct = null;
let todayAuditCount = 0;
let todayAuditProducts = 0;
let currentAuditSession = [];
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
  
  // Mostrar botón terminar
  const btnTerminar = document.getElementById('finish-audit-btn');
  if (btnTerminar) {
    btnTerminar.style.display = 'block';
  }
  
  showToast('Bodega seleccionada: ' + currentAuditWarehouse, 'success');
  document.getElementById('audit-barcode').focus();
}

// ============================================================
// BUSCAR PRODUCTO (CORREGIDO - MÚLTIPLES BODEGAS)
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
      
      // NUEVO: Buscar en la bodega específica
      let foundProduct = null;
      let foundId = null;
      
      Object.keys(products).forEach(productId => {
        const productData = products[productId];
        if (productData.ubicacion === currentAuditWarehouse) {
          foundProduct = productData;
          foundId = productId;
        }
      });
      
      if (foundProduct) {
        // Producto encontrado en esta bodega
        currentAuditProduct = { id: foundId, ...foundProduct };
        
        document.getElementById('audit-product-name').innerHTML = 
          '<strong>Producto:</strong> <span style="color: #004aad;">' + foundProduct.nombre + '</span>';
        document.getElementById('audit-product-brand').textContent = 
          'Marca: ' + foundProduct.marca + ' | Stock: ' + foundProduct.cajas + ' cajas';
        document.getElementById('audit-product-info').style.display = 'block';
        
        showToast('Producto encontrado', 'success');
        document.getElementById('audit-boxes').focus();
        
      } else {
        // Producto existe pero en otra bodega
        const otherProduct = Object.values(products)[0];
        const otherLocation = otherProduct.ubicacion || 'otra bodega';
        
        const confirmar = confirm(
          '⚠️ Este producto existe en: "' + otherLocation + '"\n\n' +
          '¿Quieres agregarlo a "' + currentAuditWarehouse + '"?\n\n' +
          'Producto: ' + otherProduct.nombre + '\n' +
          'Marca: ' + otherProduct.marca
        );
        
        if (confirmar) {
          // Crear entrada nueva para esta bodega
          const newProduct = {
            codigoBarras: otherProduct.codigoBarras,
            nombre: otherProduct.nombre,
            marca: otherProduct.marca,
            piezasPorCaja: otherProduct.piezasPorCaja,
            ubicacion: currentAuditWarehouse,
            cajas: 0,
            fechaCaducidad: otherProduct.fechaCaducidad || '',
            fechaCreacion: new Date().toISOString(),
            creadoPor: firebase.auth().currentUser.email
          };
          
          const newRef = await firebase.database()
            .ref('inventario/' + userDeterminanteAudit)
            .push(newProduct);
          
          currentAuditProduct = {
            id: newRef.key,
            ...newProduct
          };
          
          document.getElementById('audit-product-name').innerHTML = 
            '<strong>Producto:</strong> <span style="color: #004aad;">' + newProduct.nombre + '</span>';
          document.getElementById('audit-product-brand').textContent = 
            'Marca: ' + newProduct.marca + ' | Stock: 0 cajas (NUEVO)';
          document.getElementById('audit-product-info').style.display = 'block';
          
          showToast('✅ Producto agregado a ' + currentAuditWarehouse, 'success');
          document.getElementById('audit-boxes').focus();
          
        } else {
          currentAuditProduct = null;
          document.getElementById('audit-product-info').style.display = 'none';
        }
      }
      
    } else {
      alert('Producto no encontrado en el inventario');
      currentAuditProduct = null;
      document.getElementById('audit-product-info').style.display = 'none';
    }
  } catch (error) {
    console.error('Error buscar producto:', error);
    alert('Error al buscar producto: ' + error.message);
  }
}

// ============================================================
// REGISTRAR CONTEO (CORREGIDO - ACTUALIZA INVENTARIO)
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
    // 1. Registrar auditoría en historial
    await firebase.database()
      .ref('auditorias/' + userDeterminanteAudit)
      .push(auditData);
    
    console.log('✅ Auditoría registrada');
    
    // 2. Actualizar stock en inventario
    await firebase.database()
      .ref('inventario/' + userDeterminanteAudit + '/' + currentAuditProduct.id)
      .update({
        cajas: boxes,
        fechaActualizacion: new Date().toISOString(),
        actualizadoPor: firebase.auth().currentUser.email,
        ultimaAuditoria: new Date().toISOString()
      });
    
    console.log('✅ Stock actualizado en inventario');
    
    // 3. Generar movimiento si hay diferencia
    if (difference !== 0) {
      const movimientoData = {
        tipo: difference > 0 ? 'entrada' : 'salida',
        productoId: currentAuditProduct.id,
        productoNombre: currentAuditProduct.nombre,
        productoCodigo: currentAuditProduct.codigoBarras,
        marca: currentAuditProduct.marca,
        cajasAntes: registeredStock,
        cajasDespues: boxes,
        cajasCambiadas: Math.abs(difference),
        ubicacion: currentAuditWarehouse,
        motivo: 'Ajuste por auditoría',
        fecha: new Date().toISOString(),
        usuario: firebase.auth().currentUser.email,
        origenAuditoria: true
      };
      
      await firebase.database()
        .ref('movimientos/' + userDeterminanteAudit)
        .push(movimientoData);
      
      console.log('✅ Movimiento generado automáticamente');
    }
    
    // 4. Agregar a sesión actual
    currentAuditSession.push(auditData);
    
    // 5. Actualizar contadores
    todayAuditCount += boxes;
    todayAuditProducts++;
    
    actualizarResumenAuditoria();
    
    // 6. Agregar a historial visual
    agregarHistorial(auditData);
    
    // 7. Mensaje mejorado
    let mensaje = '✅ Conteo registrado: ' + boxes + ' cajas';
    if (difference !== 0) {
      mensaje += '\n📦 Diferencia: ' + (difference > 0 ? '+' : '') + difference;
      mensaje += '\n✅ Stock actualizado de ' + registeredStock + ' a ' + boxes + ' cajas';
    }
    
    showToast(mensaje.split('\n')[0], difference === 0 ? 'success' : 'warning');
    
    // 8. Limpiar formulario
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
// ACTUALIZAR RESUMEN DE AUDITORÍA
// ============================================================
function actualizarResumenAuditoria() {
  document.getElementById('audit-total-count').textContent = todayAuditCount;
  document.getElementById('audit-products-count').textContent = todayAuditProducts;
  
  // Actualizar botón terminar con estadísticas
  const btnTerminar = document.getElementById('finish-audit-btn');
  if (btnTerminar && currentAuditWarehouse) {
    btnTerminar.innerHTML = `
      <div style="text-align: center;">
        <div style="font-size: 13px; opacity: 0.9;">
          📊 ${todayAuditProducts} productos · 📦 ${todayAuditCount} cajas
        </div>
        <div style="font-size: 15px; font-weight: 700; margin-top: 4px;">
          🏁 Terminar Auditoría
        </div>
      </div>
    `;
  }
}

// ============================================================
// TERMINAR AUDITORÍA
// ============================================================
async function terminarAuditoria() {
  if (!currentAuditWarehouse) {
    alert('No hay auditoría activa');
    return;
  }
  
  if (currentAuditSession.length === 0) {
    alert('No se han auditado productos en esta bodega');
    return;
  }
  
  // Calcular estadísticas
  const diferenciasEncontradas = currentAuditSession.filter(a => a.diferencia !== 0).length;
  const productosAjustados = currentAuditSession
    .filter(a => a.diferencia !== 0)
    .map(a => `• ${a.productoNombre}: ${a.diferencia > 0 ? '+' : ''}${a.diferencia} (${a.stockRegistrado} → ${a.stockContado})`)
    .join('\n');
  
  // Mostrar resumen
  let mensaje = `📋 RESUMEN DE AUDITORÍA\n\n`;
  mensaje += `Bodega: ${currentAuditWarehouse}\n`;
  mensaje += `Fecha: ${new Date().toLocaleString('es-MX')}\n`;
  mensaje += `Auditor: ${firebase.auth().currentUser.email}\n\n`;
  mensaje += `✅ Productos auditados: ${todayAuditProducts}\n`;
  mensaje += `📦 Total cajas contadas: ${todayAuditCount}\n`;
  mensaje += `⚠️ Diferencias encontradas: ${diferenciasEncontradas}\n`;
  
  if (productosAjustados) {
    mensaje += `\n📊 AJUSTES REALIZADOS:\n${productosAjustados}\n`;
  }
  
  mensaje += `\n¿Confirmar y terminar auditoría?`;
  
  if (!confirm(mensaje)) {
    return;
  }
  
  try {
    if (!userDeterminanteAudit) {
      userDeterminanteAudit = await getUserDeterminanteAudit();
    }
    
    // Guardar auditoría completada
    const auditoriaSummary = {
      bodega: currentAuditWarehouse,
      fechaInicio: currentAuditSession[0].fecha,
      fechaFin: new Date().toISOString(),
      auditor: firebase.auth().currentUser.email,
      productosAuditados: todayAuditProducts,
      totalCajas: todayAuditCount,
      diferenciasEncontradas: diferenciasEncontradas,
      estado: 'completada',
      detalle: currentAuditSession
    };
    
    await firebase.database()
      .ref('auditorias_completadas/' + userDeterminanteAudit)
      .push(auditoriaSummary);
    
    console.log('✅ Auditoría completada guardada');
    
    // Mostrar estadísticas de productos más auditados
    await mostrarEstadisticasProductos();
    
    // Limpiar sesión
    currentAuditWarehouse = null;
    currentAuditSession = [];
    todayAuditCount = 0;
    todayAuditProducts = 0;
    
    // Resetear interfaz
    document.getElementById('audit-warehouse').value = '';
    document.getElementById('current-warehouse-display').textContent = 'Ninguna bodega seleccionada';
    document.getElementById('current-warehouse-display').style.color = '#6b7280';
    document.getElementById('finish-audit-btn').style.display = 'none';
    document.getElementById('audit-total-count').textContent = '0';
    document.getElementById('audit-products-count').textContent = '0';
    
    showToast('✅ Auditoría completada exitosamente', 'success');
    
    // Preguntar si iniciar nueva auditoría
    setTimeout(() => {
      if (confirm('¿Deseas auditar otra bodega?')) {
        document.getElementById('audit-warehouse').focus();
      }
    }, 500);
    
  } catch (error) {
    console.error('Error terminar auditoría:', error);
    alert('Error al terminar auditoría: ' + error.message);
  }
}

// ============================================================
// MOSTRAR ESTADÍSTICAS DE PRODUCTOS MÁS AUDITADOS
// ============================================================
async function mostrarEstadisticasProductos() {
  if (!userDeterminanteAudit) {
    userDeterminanteAudit = await getUserDeterminanteAudit();
  }
  
  try {
    // Obtener auditorías de los últimos 30 días
    const hace30Dias = new Date();
    hace30Dias.setDate(hace30Dias.getDate() - 30);
    
    const snapshot = await firebase.database()
      .ref('auditorias/' + userDeterminanteAudit)
      .orderByChild('fecha')
      .startAt(hace30Dias.toISOString())
      .once('value');
    
    if (!snapshot.exists()) {
      return;
    }
    
    const auditorias = snapshot.val();
    const productosContador = {};
    
    // Contar auditorías por producto
    Object.values(auditorias).forEach(audit => {
      const nombre = audit.productoNombre;
      if (!productosContador[nombre]) {
        productosContador[nombre] = {
          nombre: nombre,
          marca: audit.marca,
          vecesAuditado: 0,
          totalAjustes: 0,
          ultimaAuditoria: audit.fecha
        };
      }
      productosContador[nombre].vecesAuditado++;
      if (audit.diferencia !== 0) {
        productosContador[nombre].totalAjustes++;
      }
    });
    
    // Ordenar por más auditados
    const topProductos = Object.values(productosContador)
      .sort((a, b) => b.vecesAuditado - a.vecesAuditado)
      .slice(0, 5);
    
    // Crear mensaje
    let mensaje = '📊 TOP 5 PRODUCTOS MÁS AUDITADOS (30 días)\n\n';
    topProductos.forEach((prod, index) => {
      mensaje += `${index + 1}. ${prod.nombre}\n`;
      mensaje += `   • Auditado: ${prod.vecesAuditado} veces\n`;
      mensaje += `   • Ajustes: ${prod.totalAjustes}\n`;
      mensaje += `   • Marca: ${prod.marca}\n\n`;
    });
    
    alert(mensaje);
    
  } catch (error) {
    console.error('Error obtener estadísticas:', error);
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
// CARGAR HISTORIAL DE AUDITORÍAS
// ============================================================
async function cargarHistorialAuditorias() {
  if (!userDeterminanteAudit) {
    userDeterminanteAudit = await getUserDeterminanteAudit();
  }
  
  if (!userDeterminanteAudit) return;
  
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const inicioDia = hoy.toISOString();
  
  try {
    const snapshot = await firebase.database()
      .ref('auditorias/' + userDeterminanteAudit)
      .orderByChild('fecha')
      .startAt(inicioDia)
      .once('value');
    
    if (snapshot.exists()) {
      const auditorias = snapshot.val();
      const container = document.getElementById('audit-history');
      
      if (container) {
        container.innerHTML = '';
        
        // Ordenar por fecha descendente
        const auditoriasArray = Object.values(auditorias)
          .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        
        auditoriasArray.forEach(audit => {
          agregarHistorial(audit);
        });
      }
    }
  } catch (error) {
    console.error('Error cargar historial:', error);
  }
}

// ============================================================
// INICIALIZACIÓN
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
    
    // Botón terminar auditoría
    const btnTerminar = document.getElementById('finish-audit-btn');
    if (btnTerminar) {
      btnTerminar.onclick = terminarAuditoria;
    }
    
    // Cargar historial del día
    cargarHistorialAuditorias();
    
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