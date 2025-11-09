// ============================================================
// Águila Inventario Pro - Módulo: audit.js
// Copyright © 2025 José A. G. Betancourt
// VERSIÓN WALMART STYLE - Escanea y actualiza automáticamente
// ============================================================

let currentAuditWarehouse = null;
let currentAuditProduct = null;
let todayAuditCount = 0;
let todayAuditProducts = 0;
let currentAuditSession = [];
let userDeterminanteAudit = null;
let auditStartTime = null;

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
// GUARDAR BODEGA (INICIA AUDITORÍA)
// ============================================================
function saveBodega() {
  const input = document.getElementById('audit-warehouse');
  const display = document.getElementById('current-warehouse-display');
  
  if (!input || !input.value.trim()) {
    showToast('Ingresa el nombre de la bodega', 'warning');
    return;
  }
  
  currentAuditWarehouse = input.value.trim();
  auditStartTime = new Date();
  
  if (display) {
    display.innerHTML = `✅ <strong>Auditando:</strong> ${currentAuditWarehouse}`;
    display.style.color = '#10b981';
    display.style.fontWeight = '700';
  }
  
  // Mostrar botón terminar
  const btnTerminar = document.getElementById('finish-audit-btn');
  if (btnTerminar) {
    btnTerminar.style.display = 'block';
  }
  
  // Limpiar sesión anterior
  currentAuditSession = [];
  todayAuditCount = 0;
  todayAuditProducts = 0;
  actualizarResumenAuditoria();
  
  showToast('📍 Bodega seleccionada: ' + currentAuditWarehouse, 'success');
  document.getElementById('audit-barcode').focus();
}

// ============================================================
// BUSCAR PRODUCTO Y AUTOFILL (WALMART STYLE)
// ============================================================
async function buscarProductoAudit() {
  const input = document.getElementById('audit-barcode');
  const barcode = input.value.trim();
  
  if (!barcode || barcode.length < 8) {
    showToast('Ingresa un código válido (mínimo 8 dígitos)', 'warning');
    return;
  }
  
  if (!currentAuditWarehouse) {
    showToast('Primero selecciona una bodega', 'warning');
    return;
  }
  
  if (!userDeterminanteAudit) {
    userDeterminanteAudit = await getUserDeterminanteAudit();
  }
  
  if (!userDeterminanteAudit) {
    showToast('Error: No se encontró información de la tienda', 'error');
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
      
      // Buscar EN LA BODEGA ESPECÍFICA
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
        // ✅ PRODUCTO ENCONTRADO EN ESTA BODEGA
        currentAuditProduct = { id: foundId, ...foundProduct };
        
        // AUTOFILL CAMPOS
        document.getElementById('audit-nombre').value = foundProduct.nombre;
        document.getElementById('audit-marca').value = foundProduct.marca;
        document.getElementById('audit-piezas').value = foundProduct.piezasPorCaja;
        
        // MOSTRAR STOCK DEL SISTEMA
        document.getElementById('audit-stock-info').style.display = 'block';
        document.getElementById('audit-stock-info').innerHTML = `
          📊 <strong>Stock del Sistema:</strong> ${foundProduct.cajas} cajas 
          (${foundProduct.cajas * foundProduct.piezasPorCaja} piezas)
        `;
        
        // Guardar info para usar al guardar
        document.getElementById('audit-boxes').dataset.productoId = foundId;
        document.getElementById('audit-boxes').dataset.stockSistema = foundProduct.cajas;
        
        // CAMBIAR ESTILOS A VERDE (ENCONTRADO)
        document.getElementById('audit-nombre').style.borderColor = '#10b981';
        document.getElementById('audit-marca').style.borderColor = '#10b981';
        document.getElementById('audit-piezas').style.borderColor = '#10b981';
        
        showToast('✅ Producto encontrado en ' + currentAuditWarehouse, 'success');
        document.getElementById('audit-boxes').focus();
        
      } else {
        // ⚠️ EXISTE EN OTRA BODEGA
        const otherProduct = Object.values(products)[0];
        const otherLocation = otherProduct.ubicacion || 'otra bodega';
        
        showToast(`⚠️ Producto en: "${otherLocation}"`, 'warning');
        currentAuditProduct = null;
        limpiarCamposAudit();
      }
      
    } else {
      // ❌ NO EXISTE
      showToast('❌ Producto no encontrado', 'error');
      currentAuditProduct = null;
      limpiarCamposAudit();
    }
    
  } catch (error) {
    console.error('Error buscar producto:', error);
    showToast('Error al buscar: ' + error.message, 'error');
  }
}

// ============================================================
// REGISTRAR CONTEO Y ACTUALIZAR AUTOMÁTICAMENTE
// ============================================================
async function registrarConteo() {
  const boxesInput = document.getElementById('audit-boxes');
  const boxes = parseInt(boxesInput.value);
  
  if (!currentAuditWarehouse) {
    showToast('Primero selecciona una bodega', 'warning');
    return false;
  }
  
  if (!currentAuditProduct) {
    showToast('Primero escanea un producto', 'warning');
    return false;
  }
  
  if (isNaN(boxes) || boxes < 0) {
    showToast('Ingresa una cantidad válida', 'error');
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
    // 1. REGISTRAR EN AUDITORÍAS
    await firebase.database()
      .ref('auditorias/' + userDeterminanteAudit)
      .push(auditData);
    
    // 2. ACTUALIZAR STOCK AUTOMÁTICAMENTE (SIN CONFIRMACIÓN)
    await firebase.database()
      .ref('inventario/' + userDeterminanteAudit + '/' + currentAuditProduct.id)
      .update({
        cajas: boxes,
        fechaActualizacion: new Date().toISOString(),
        actualizadoPor: firebase.auth().currentUser.email,
        ultimaAuditoria: new Date().toISOString()
      });
    
    // 3. GENERAR MOVIMIENTO SI HAY DIFERENCIA
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
    }
    
    // 4. AGREGAR A SESIÓN
    currentAuditSession.push(auditData);
    todayAuditCount += boxes;
    todayAuditProducts++;
    
    // 5. MOSTRAR CHECKMARK VISUAL
    mostrarCheckmarkAudit(difference);
    
    // 6. REPRODUCIR SONIDO (si está disponible)
    reproducirBeep();
    
    // 7. VIBRACIÓN HÁPTICA
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }
    
    // 8. ACTUALIZAR UI
    actualizarResumenAuditoria();
    agregarHistorial(auditData);
    actualizarListaEscaneados();
    
    // 9. LIMPIAR Y PREPARAR SIGUIENTE
    limpiarFormularioAudit();
    document.getElementById('audit-barcode').focus();
    
    // MOSTRAR FEEDBACK
    if (difference === 0) {
      showToast('✅ ' + currentAuditProduct.nombre + ' - OK', 'success');
    } else if (difference > 0) {
      showToast(`🟡 ${currentAuditProduct.nombre} - Sobrante: +${difference}`, 'warning');
    } else {
      showToast(`🔴 ${currentAuditProduct.nombre} - Faltante: ${difference}`, 'warning');
    }
    
    return true;
    
  } catch (error) {
    console.error('Error registrar:', error);
    showToast('Error: ' + error.message, 'error');
    return false;
  }
}

// ============================================================
// MOSTRAR CHECKMARK VISUAL (ANIMACIÓN)
// ============================================================
function mostrarCheckmarkAudit(difference) {
  const checkmark = document.createElement('div');
  checkmark.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 100px;
    z-index: 2000;
    pointer-events: none;
    animation: checkmarkPop 0.6s ease-out forwards;
  `;
  
  if (difference === 0) {
    checkmark.innerHTML = '✅'; // Verde
  } else if (difference > 0) {
    checkmark.innerHTML = '🟡'; // Amarillo (sobrante)
  } else {
    checkmark.innerHTML = '🔴'; // Rojo (faltante)
  }
  
  document.body.appendChild(checkmark);
  
  setTimeout(() => checkmark.remove(), 600);
}

// ============================================================
// REPRODUCIR SONIDO BEEP
// ============================================================
function reproducirBeep() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  } catch (e) {
    // Si no funciona, silenciosamente falla
  }
}

// ============================================================
// ACTUALIZAR LISTA DE ÚLTIMOS ESCANEADOS
// ============================================================
function actualizarListaEscaneados() {
  const container = document.getElementById('audit-history');
  if (!container) return;
  
  let html = '<h4 style="margin-bottom: 12px;">✅ Últimos Escaneados:</h4>';
  
  currentAuditSession.slice(-8).reverse().forEach((prod, idx) => {
    const icono = prod.diferencia === 0 ? '✓' : 
                  prod.diferencia > 0 ? '🟡' : '🔴';
    
    const color = prod.diferencia === 0 ? '#10b981' : 
                  prod.diferencia > 0 ? '#f59e0b' : '#ef4444';
    
    html += `
      <div style="padding:10px;margin-bottom:8px;background:#f8fafc;border-left:4px solid ${color};border-radius:6px;">
        <div style="font-weight:700;font-size:13px;margin-bottom:4px;">
          ${icono} ${prod.productoNombre}
        </div>
        <div style="font-size:12px;color:#6b7280;">
          Contado: <strong>${prod.stockContado}</strong> | 
          Sistema: <strong>${prod.stockRegistrado}</strong> | 
          Dif: <span style="color:${color};font-weight:700;">${prod.diferencia > 0 ? '+' : ''}${prod.diferencia}</span>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

// ============================================================
// ACTUALIZAR RESUMEN DE AUDITORÍA
// ============================================================
function actualizarResumenAuditoria() {
  document.getElementById('audit-total-count').textContent = todayAuditProducts;
  document.getElementById('audit-products-count').textContent = todayAuditCount;
  
  // Actualizar botón terminar
  const btnTerminar = document.getElementById('finish-audit-btn');
  if (btnTerminar && currentAuditWarehouse) {
    const diferenciasEncontradas = currentAuditSession.filter(a => a.diferencia !== 0).length;
    
    btnTerminar.innerHTML = `
      <div style="text-align: center;">
        <div style="font-size: 12px; opacity: 0.9;">
          📊 ${todayAuditProducts} productos • 📦 ${todayAuditCount} cajas • ⚠️ ${diferenciasEncontradas} ajustes
        </div>
        <div style="font-size: 16px; font-weight: 700; margin-top: 6px;">
          🏁 Finalizar Auditoría
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
    showToast('No hay auditoría activa', 'warning');
    return;
  }
  
  if (currentAuditSession.length === 0) {
    showToast('No se han auditado productos', 'warning');
    return;
  }
  
  const diferenciasEncontradas = currentAuditSession.filter(a => a.diferencia !== 0).length;
  const productosAjustados = currentAuditSession
    .filter(a => a.diferencia !== 0)
    .map(a => `• ${a.productoNombre}: ${a.diferencia > 0 ? '+' : ''}${a.diferencia} cajas`)
    .join('\n');
  
  const tiempoTranscurrido = auditStartTime 
    ? Math.round((new Date() - auditStartTime) / 60000) + ' min'
    : 'N/A';
  
  let mensaje = `📋 RESUMEN AUDITORÍA\n\n`;
  mensaje += `📍 Bodega: ${currentAuditWarehouse}\n`;
  mensaje += `⏱️ Tiempo: ${tiempoTranscurrido}\n`;
  mensaje += `👤 Auditor: ${firebase.auth().currentUser.email}\n\n`;
  mensaje += `✅ Productos: ${todayAuditProducts}\n`;
  mensaje += `📦 Total cajas: ${todayAuditCount}\n`;
  mensaje += `⚠️ Diferencias: ${diferenciasEncontradas}\n`;
  
  if (productosAjustados) {
    mensaje += `\n🔧 AJUSTES:\n${productosAjustados}\n`;
  }
  
  mensaje += `\n¿Confirmar y terminar auditoría?`;
  
  if (!window.confirm(mensaje)) {
    return;
  }
  
  try {
    if (!userDeterminanteAudit) {
      userDeterminanteAudit = await getUserDeterminanteAudit();
    }
    
    // Guardar resumen de auditoría completada
    const auditoriaSummary = {
      bodega: currentAuditWarehouse,
      fechaInicio: auditStartTime.toISOString(),
      fechaFin: new Date().toISOString(),
      auditor: firebase.auth().currentUser.email,
      productosAuditados: todayAuditProducts,
      totalCajas: todayAuditCount,
      diferenciasEncontradas: diferenciasEncontradas,
      tiempoMinutos: auditStartTime ? Math.round((new Date() - auditStartTime) / 60000) : 0,
      estado: 'completada',
      detalle: currentAuditSession
    };
    
    await firebase.database()
      .ref('auditorias_completadas/' + userDeterminanteAudit)
      .push(auditoriaSummary);
    
    // Mostrar estadísticas
    await mostrarEstadisticasProductos();
    
    // LIMPIAR
    currentAuditWarehouse = null;
    currentAuditSession = [];
    todayAuditCount = 0;
    todayAuditProducts = 0;
    auditStartTime = null;
    
    // RESETEAR UI
    document.getElementById('audit-warehouse').value = '';
    document.getElementById('current-warehouse-display').innerHTML = '⏸️ Ninguna bodega seleccionada';
    document.getElementById('current-warehouse-display').style.color = '#6b7280';
    document.getElementById('finish-audit-btn').style.display = 'none';
    limpiarFormularioAudit();
    
    showToast('✅ Auditoría finalizada exitosamente', 'success');
    
    setTimeout(() => {
      if (window.confirm('¿Auditar otra bodega?')) {
        document.getElementById('audit-warehouse').focus();
      }
    }, 500);
    
  } catch (error) {
    console.error('Error:', error);
    showToast('Error: ' + error.message, 'error');
  }
}

// ============================================================
// MOSTRAR ESTADÍSTICAS
// ============================================================
async function mostrarEstadisticasProductos() {
  if (!userDeterminanteAudit) {
    userDeterminanteAudit = await getUserDeterminanteAudit();
  }
  
  try {
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
    
    Object.values(auditorias).forEach(audit => {
      const nombre = audit.productoNombre;
      if (!productosContador[nombre]) {
        productosContador[nombre] = {
          nombre: nombre,
          marca: audit.marca,
          vecesAuditado: 0,
          totalAjustes: 0
        };
      }
      productosContador[nombre].vecesAuditado++;
      if (audit.diferencia !== 0) {
        productosContador[nombre].totalAjustes++;
      }
    });
    
    const topProductos = Object.values(productosContador)
      .sort((a, b) => b.vecesAuditado - a.vecesAuditado)
      .slice(0, 5);
    
    let mensaje = '📊 TOP 5 PRODUCTOS MÁS AUDITADOS (30 días)\n\n';
    topProductos.forEach((prod, index) => {
      mensaje += `${index + 1}. ${prod.nombre}\n`;
      mensaje += `   Auditado: ${prod.vecesAuditado}x | Ajustes: ${prod.totalAjustes}\n\n`;
    });
    
    window.alert(mensaje);
    
  } catch (error) {
    console.error('Error estadísticas:', error);
  }
}

// ============================================================
// AGREGAR AL HISTORIAL
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
// LIMPIAR FORMULARIO
// ============================================================
function limpiarFormularioAudit() {
  document.getElementById('audit-barcode').value = '';
  limpiarCamposAudit();
  document.getElementById('audit-boxes').value = '';
}

// ============================================================
// LIMPIAR CAMPOS AUTOFILL
// ============================================================
function limpiarCamposAudit() {
  document.getElementById('audit-nombre').value = '';
  document.getElementById('audit-marca').value = '';
  document.getElementById('audit-piezas').value = '';
  document.getElementById('audit-stock-info').style.display = 'none';
  document.getElementById('audit-boxes').dataset.productoId = '';
  document.getElementById('audit-boxes').dataset.stockSistema = '';
  
  // Cambiar estilos a gris (no encontrado)
  document.getElementById('audit-nombre').style.borderColor = '#e2e8f0';
  document.getElementById('audit-marca').style.borderColor = '#e2e8f0';
  document.getElementById('audit-piezas').style.borderColor = '#e2e8f0';
  
  currentAuditProduct = null;
}

// ============================================================
// MEJORAR: Entrada Manual de Código de Barras
// ============================================================
function configurarEntradaManualAudit() {
  const inputBarcode = document.getElementById('audit-barcode');
  
  if (!inputBarcode) return;
  
  // LISTENERS MEJORADOS
  inputBarcode.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const codigo = inputBarcode.value.trim();
      
      if (!codigo) {
        showToast('⚠️ Ingresa un código de barras', 'warning');
        return;
      }
      
      // Buscar producto
      await buscarProductoAudit();
    }
  });
  
  // VALIDACIÓN EN TIEMPO REAL
  inputBarcode.addEventListener('input', (e) => {
    // Limpieza automática de espacios
    e.target.value = e.target.value.trim();
    
    // Cambiar estilo mientras escribe
    if (e.target.value.length > 0) {
      e.target.style.borderColor = '#004aad';
    } else {
      e.target.style.borderColor = '#e5e7eb';
    }
  });
  
  // FOCUS AL ABRIR AUDITORÍA
  setTimeout(() => {
    inputBarcode.focus();
  }, 100);
}

// ============================================================
// MEJORAR: Búsqueda Automática al Alcanzar 12+ Dígitos
// ============================================================
function configurarBusquedaAutomatica() {
  const inputBarcode = document.getElementById('audit-barcode');
  
  if (!inputBarcode) return;
  
  inputBarcode.addEventListener('input', async (e) => {
    const codigo = e.target.value.trim();
    
    // Si tiene 12+ dígitos, buscar automáticamente
    if (codigo.length >= 12 && /^\d+$/.test(codigo)) {
      // Esperar un momento para que el usuario termine de escribir
      setTimeout(async () => {
        await buscarProductoAudit();
      }, 300);
    }
  });
}

// ============================================================
// MEJORAR: Cantidad Contada - Auto Focus y Validación
// ============================================================
function configurarCantidadContada() {
  const inputCantidad = document.getElementById('audit-boxes');
  
  if (!inputCantidad) return;
  
  // Al hacer foco, seleccionar el texto
  inputCantidad.addEventListener('focus', (e) => {
    e.target.select();
  });
  
  // Permitir Enter para guardar directamente
  inputCantidad.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      const form = document.getElementById('audit-form');
      if (form) {
        const event = new Event('submit', { bubbles: true });
        form.dispatchEvent(event);
      }
    }
  });
  
  // Validación de números negativos
  inputCantidad.addEventListener('input', (e) => {
    if (e.target.value < 0) {
      e.target.value = 0;
    }
  });
}

// ============================================================
// LLAMAR TODAS LAS CONFIGURACIONES
// ============================================================
function configurarEntradaAuditCompleta() {
  console.log('🔧 Configurando entrada de auditoría mejorada...');
  
  // Esperar a que el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      configurarEntradaManualAudit();
      configurarBusquedaAutomatica();
      configurarCantidadContada();
      console.log('✅ Entrada de auditoría configurada');
    });
  } else {
    configurarEntradaManualAudit();
    configurarBusquedaAutomatica();
    configurarCantidadContada();
    console.log('✅ Entrada de auditoría configurada');
  }
}

// ============================================================
// INICIALIZACIÓN
// ============================================================
function inicializarAudit() {
  console.log('🔧 Inicializando auditoría...');
  
  firebase.auth().onAuthStateChanged((user) => {
    if (!user) return;
    
    console.log('✅ Usuario autenticado - Auditoría configurada');
    
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
    
    // Configurar entrada mejorada
    configurarEntradaAuditCompleta();
  });
}

// Iniciar cuando esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', inicializarAudit);
} else {
  inicializarAudit();
}

console.log('✅ audit.js cargado - Walmart Style + Entrada Manual');

// Exponer funciones globales
window.buscarProductoAudit = buscarProductoAudit;
window.guardarConteoAuditoria = registrarConteo;

// ============================================================
// ANIMACIÓN CSS (INYECTADA)
// ============================================================
const styleAudit = document.createElement('style');
styleAudit.textContent = `
  @keyframes checkmarkPop {
    0% {
      transform: translate(-50%, -50%) scale(0) rotate(-45deg);
      opacity: 1;
    }
    50% {
      transform: translate(-50%, -50%) scale(1.3) rotate(0deg);
    }
    100% {
      transform: translate(-50%, -50%) scale(1) rotate(0deg);
      opacity: 0;
    }
  }
`;
document.head.appendChild(styleAudit);

console.log('✅ Mejoras de entrada manual en auditoría cargadas');