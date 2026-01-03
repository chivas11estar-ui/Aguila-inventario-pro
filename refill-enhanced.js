// ============================================================  
// Águila Inventario Pro - Módulo: refill.js  
// VERSIÓN ÁGIL CON ANALYTICS POR PIEZAS  
// Copyright © 2025 José A. G. Betancourt  
//   
// PRINCIPIOS OPERATIVOS:  
// - RELLENO = rapidez + cero fricción + movimiento  
// - AUDITORÍA = orden + control + validación  
// - Stock = SUMA TOTAL (sin separar por lotes/bodegas)  
// - Analytics = cálculo real por PIEZAS vendidas  
//   
// REGLAS:  
// ✔ Permitido con stock = 0  
// ✔ Permitido sin producto registrado  
// ✔ NO requiere bodega ni caducidad  
// ✔ Cálculo automático: piezasMovidas = cajas × piezas/caja  
// ============================================================  
  
let userDeterminanteRefill = null;  
let currentRefillProduct = null;  
let todayRefillCount = 0;  
let todayPiecesCount = 0;  
  
console.log('🔄 Módulo de relleno ágil iniciando...');  
  
// ============================================================  
// OBTENER DETERMINANTE DEL USUARIO  
// ============================================================  
  
async function getUserDeterminanteRefill() {  
  const userId = firebase.auth().currentUser?.uid;  
  if (!userId) {  
    console.error('❌ Usuario no autenticado');  
    return null;  
  }  
  
  try {  
    const snapshot = await firebase.database()  
      .ref('usuarios/' + userId)  
      .once('value');  
      
    const userData = snapshot.val();  
    const determinante = userData?.determinante || null;  
      
    if (determinante) {  
      console.log('🔑 Determinante obtenido:', determinante);  
    } else {  
      console.error('❌ Determinante no encontrado para usuario:', userId);  
    }  
      
    return determinante;  
      
  } catch (error) {  
    console.error('❌ Error obteniendo determinante:', error);  
    return null;  
  }  
}  
  
// ============================================================  
// BUSCAR PRODUCTO (SUMA TOTAL DE STOCK)  
// ============================================================  
  
async function searchProductForRefill(barcode) {  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');  
  console.log('🔍 [RELLENO] Buscando producto:', barcode);  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');  
  
  // VALIDACIÓN: Código válido  
  if (!barcode || barcode.trim().length < 8) {  
    showToast('⚠️ Código inválido (mínimo 8 dígitos)', 'warning');  
    return;  
  }  
  
  // OBTENER DETERMINANTE  
  if (!userDeterminanteRefill) {  
    userDeterminanteRefill = await getUserDeterminanteRefill();  
  }  
  
  if (!userDeterminanteRefill) {  
    showToast('❌ Error: No se encontró información de la tienda', 'error');  
    return;  
  }  
  
  try {  
    // ============================================================  
    // PASO 1: BUSCAR TODOS LOS REGISTROS CON ESE CÓDIGO  
    // ============================================================  
      
    const snapshot = await firebase.database()  
      .ref('inventario/' + userDeterminanteRefill)  
      .orderByChild('codigoBarras')  
      .equalTo(barcode.trim())  
      .once('value');  
  
    // ============================================================  
    // CASO A: PRODUCTO EXISTE EN INVENTARIO  
    // ============================================================  
      
    if (snapshot.exists()) {  
      console.log('✅ Producto encontrado en inventario');  
        
      const productos = snapshot.val();  
      const registros = Object.keys(productos).map(id => ({  
        id: id,  
        ...productos[id]  
      }));  
  
      console.log(`📦 Registros encontrados: ${registros.length}`);  
  
      // ============================================================  
      // REGLA CRÍTICA: SUMAR TODAS LAS CAJAS  
      // IGNORAR bodega y fechaCaducidad  
      // ============================================================  
  
      let totalCajas = 0;  
      const primeraReferencia = registros[0];  
  
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');  
      console.log('📊 CÁLCULO DE STOCK TOTAL (IGNORANDO LOTES):');  
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');  
  
      registros.forEach((reg, index) => {  
        const cajas = parseInt(reg.cajas) || 0;  
        totalCajas += cajas;  
          
        console.log(`   Lote ${index + 1}:`);  
        console.log(`   - Bodega: ${reg.ubicacion || 'Sin bodega'} (IGNORADA)`);  
        console.log(`   - Caducidad: ${reg.fechaCaducidad || 'Sin fecha'} (IGNORADA)`);  
        console.log(`   - Cajas: ${cajas}`);  
        console.log(`   - Subtotal acumulado: ${totalCajas}`);  
      });  
  
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');  
      console.log(`✅ STOCK TOTAL OPERATIVO: ${totalCajas} cajas`);  
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');  
  
      // Guardar producto con stock total  
      currentRefillProduct = {  
        codigoBarras: primeraReferencia.codigoBarras,  
        nombre: primeraReferencia.nombre,  
        marca: primeraReferencia.marca || 'Otra',  
        piezasPorCaja: parseInt(primeraReferencia.piezasPorCaja) || 0,  
        totalCajas: totalCajas,  
        totalPiezas: totalCajas * (parseInt(primeraReferencia.piezasPorCaja) || 0),  
        registros: registros, // Guardar todos los lotes para descuento FIFO  
        existe: true  
      };  
  
      // RELLENAR FORMULARIO  
      document.getElementById('refill-nombre').value = currentRefillProduct.nombre;  
      document.getElementById('refill-nombre').readOnly = true;  
      document.getElementById('refill-nombre').style.background = '#f8fafc';  
        
      document.getElementById('refill-marca').value = currentRefillProduct.marca;  
      document.getElementById('refill-marca').disabled = true;  
        
      document.getElementById('refill-piezas').value = currentRefillProduct.piezasPorCaja;  
      document.getElementById('refill-piezas').readOnly = true;  
      document.getElementById('refill-piezas').style.background = '#f8fafc';  
  
      // ============================================================  
      // MOSTRAR INFO COMPLETA (INCLUYE STOCK 0)  
      // ============================================================  
  
      const infoDiv = document.getElementById('refill-product-info');  
      if (infoDiv) {  
        const stockColor = totalCajas === 0 ? '#f59e0b' : '#10b981';  
        const stockBg = totalCajas === 0 ? '#fef3c7' : '#d1fae5';  
        const stockIcon = totalCajas === 0 ? '⚠️' : '✅';  
        const stockMsg = totalCajas === 0   
          ? 'Stock agotado - Puedes rellenar desde 0'   
          : `${totalCajas} cajas disponibles`;  
  
        infoDiv.style.display = 'block';  
        infoDiv.innerHTML = `  
          <div style="padding:16px;background:${stockBg};border-left:4px solid ${stockColor};border-radius:8px;margin:16px 0;">  
            <div style="font-size:16px;font-weight:700;color:${stockColor === '#10b981' ? '#065f46' : '#92400e'};margin-bottom:8px;">  
              ${stockIcon} ${currentRefillProduct.nombre}  
            </div>  
            <div style="color:${stockColor === '#10b981' ? '#047857' : '#b45309'};font-size:14px;margin-bottom:4px;">  
              📦 <strong>${stockMsg}</strong>  
            </div>  
            <div style="font-size:12px;color:${stockColor === '#10b981' ? '#059669' : '#d97706'};">  
              ${registros.length} lote(s) registrado(s) ${totalCajas > 0 ? '- se descontará por FIFO' : ''}  
            </div>  
            <div style="font-size:12px;color:#6b7280;margin-top:6px;">  
              💡 Piezas por caja: ${currentRefillProduct.piezasPorCaja} | Total piezas: ${currentRefillProduct.totalPiezas}  
            </div>  
          </div>  
        `;  
      }  
  
      const mensaje = totalCajas === 0   
        ? `⚠️ ${currentRefillProduct.nombre} - Stock en 0 (Rellenar permitido)`  
        : `✅ ${currentRefillProduct.nombre} - ${totalCajas} cajas disponibles`;  
        
      showToast(mensaje, totalCajas === 0 ? 'warning' : 'success');  
      document.getElementById('refill-boxes').focus();  
        
      return;  
    }  
  
    // ============================================================  
    // CASO B: PRODUCTO NUEVO (NO EXISTE)  
    // ============================================================  
      
    console.log('🆕 Producto NO encontrado - Permitiendo creación rápida');  
  
    currentRefillProduct = {  
      codigoBarras: barcode.trim(),  
      nombre: '',  
      marca: 'Otra',  
      piezasPorCaja: 0,  
      totalCajas: 0,  
      totalPiezas: 0,  
      existe: false  
    };  
  
    // LIMPIAR Y HABILITAR CAMPOS PARA ENTRADA MANUAL  
    document.getElementById('refill-nombre').value = '';  
    document.getElementById('refill-nombre').readOnly = false;  
    document.getElementById('refill-nombre').style.background = '#fff';  
    document.getElementById('refill-nombre').focus();  
  
    document.getElementById('refill-marca').value = 'Otra';  
    document.getElementById('refill-marca').disabled = false;  
  
    document.getElementById('refill-piezas').value = '';  
    document.getElementById('refill-piezas').readOnly = false;  
    document.getElementById('refill-piezas').style.background = '#fff';  
  
    const infoDiv = document.getElementById('refill-product-info');  
    if (infoDiv) {  
      infoDiv.style.display = 'block';  
      infoDiv.innerHTML = `  
        <div style="padding:16px;background:#fef3c7;border-left:4px solid #f59e0b;border-radius:8px;margin:16px 0;">  
          <div style="font-size:16px;font-weight:700;color:#92400e;margin-bottom:8px;">  
            🆕 Producto Nuevo  
          </div>  
          <div style="color:#b45309;font-size:14px;margin-bottom:4px;">  
            📋 Código: <strong>${barcode}</strong>  
          </div>  
          <div style="font-size:12px;color:#d97706;">  
            Completa la información básica para continuar con el relleno  
          </div>  
          <div style="font-size:11px;color:#92400e;margin-top:8px;font-style:italic;">  
            💡 Solo necesitas: nombre, marca y piezas por caja  
          </div>  
        </div>  
      `;  
    }  
  
    showToast('🆕 Producto nuevo - Completa los datos básicos', 'info');  
  
  } catch (error) {  
    console.error('❌ Error buscando producto:', error);  
    showToast('❌ Error al buscar: ' + error.message, 'error');  
    limpiarFormularioRefill();  
  }  
}  
  
// ============================================================  
// REGISTRAR MOVIMIENTO DE RELLENO CON CÁLCULO DE PIEZAS  
// ============================================================  
  
async function handleRefillSubmit(event) {  
  event.preventDefault();  
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');  
  console.log('💾 [RELLENO] Procesando movimiento...');  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');  
  
  // VALIDACIÓN 1: Producto buscado  
  if (!currentRefillProduct) {  
    showToast('⚠️ Primero busca un producto válido', 'warning');  
    document.getElementById('refill-barcode').focus();  
    return;  
  }  
  
  // VALIDACIÓN 2: Si es producto nuevo, validar campos básicos  
  if (!currentRefillProduct.existe) {  
    const nombre = document.getElementById('refill-nombre').value.trim();  
    const marca = document.getElementById('refill-marca').value;  
    const piezas = parseInt(document.getElementById('refill-piezas').value);  
  
    if (!nombre || !marca || isNaN(piezas) || piezas <= 0) {  
      showToast('❌ Completa nombre, marca y piezas por caja', 'error');  
      document.getElementById('refill-nombre').focus();  
      return;  
    }  
  
    // Actualizar producto con datos ingresados  
    currentRefillProduct.nombre = nombre;  
    currentRefillProduct.marca = marca;  
    currentRefillProduct.piezasPorCaja = piezas;  
      
    console.log('📝 Producto nuevo validado:', {  
      nombre: nombre,  
      marca: marca,  
      piezasPorCaja: piezas  
    });  
  }  
  
  // VALIDACIÓN 3: Cantidad a mover  
  const cajasAMover = parseInt(document.getElementById('refill-boxes').value);  
  
  if (isNaN(cajasAMover) || cajasAMover <= 0) {  
    showToast('❌ Ingresa una cantidad válida mayor a 0', 'error');  
    document.getElementById('refill-boxes').focus();  
    return;  
  }  
  
  // ============================================================  
  // CÁLCULO CRÍTICO: PIEZAS MOVIDAS (PARA ANALYTICS)  
  // ============================================================  
    
  const piezasMovidas = cajasAMover * currentRefillProduct.piezasPorCaja;  
    
  console.log('📊 CÁLCULO DE ANALYTICS:');  
  console.log(`   Cajas a mover: ${cajasAMover}`);  
  console.log(`   Piezas por caja: ${currentRefillProduct.piezasPorCaja}`);  
  console.log(`   ✅ PIEZAS MOVIDAS: ${piezasMovidas}`);  
  
  // VALIDACIÓN 4: Stock suficiente (solo si el producto existe y tiene stock)  
  if (currentRefillProduct.existe && currentRefillProduct.totalCajas > 0) {  
    if (cajasAMover > currentRefillProduct.totalCajas) {  
      showToast(`❌ Stock insuficiente. Disponible: ${currentRefillProduct.totalCajas} cajas`, 'error');  
      return;  
    }  
    console.log(`✅ Stock suficiente: ${currentRefillProduct.totalCajas} cajas disponibles`);  
  } else if (currentRefillProduct.existe) {  
    console.log('⚠️ Producto en stock 0 - Permitiendo relleno desde cero');  
  }  
  
  // OBTENER DETERMINANTE  
  if (!userDeterminanteRefill) {  
    userDeterminanteRefill = await getUserDeterminanteRefill();  
  }  
  
  if (!userDeterminanteRefill) {  
    showToast('❌ Error: No se encontró información de la tienda', 'error');  
    return;  
  }  
  
  try {  
    const updates = {};  
    const timestamp = new Date().toISOString();  
    const usuario = firebase.auth().currentUser.email;  
  
    // ============================================================  
    // CASO A: PRODUCTO EXISTENTE CON STOCK - DESCONTAR (FIFO)  
    // ============================================================  
      
    if (currentRefillProduct.existe && currentRefillProduct.totalCajas > 0) {  
      console.log('📦 Producto existente con stock - Aplicando descuento FIFO');  
      console.log(`   Stock antes: ${currentRefillProduct.totalCajas} cajas`);  
  
      let cajasRestantes = cajasAMover;  
  
      // Ordenar por fecha de caducidad (primero los más viejos - FIFO)  
      const lotesOrdenados = currentRefillProduct.registros.sort((a, b) => {  
        const fechaA = new Date(a.fechaCaducidad || '2099-12-31');  
        const fechaB = new Date(b.fechaCaducidad || '2099-12-31');  
        return fechaA - fechaB;  
      });  
  
      console.log('📅 Orden FIFO (primero los que vencen antes):');  
      lotesOrdenados.forEach((lote, i) => {  
        console.log(`   ${i + 1}. ID: ${lote.id}, Cad: ${lote.fechaCaducidad || 'Sin fecha'}, Stock: ${lote.cajas}`);  
      });  
  
      for (const lote of lotesOrdenados) {  
        if (cajasRestantes <= 0) break;  
  
        const cajasEnLote = parseInt(lote.cajas) || 0;  
        const cajasADescontar = Math.min(cajasRestantes, cajasEnLote);  
        const nuevasCajas = cajasEnLote - cajasADescontar;  
  
        console.log(`   Lote ${lote.id}: ${cajasEnLote} → ${nuevasCajas} (-${cajasADescontar})`);  
  
        updates[`inventario/${userDeterminanteRefill}/${lote.id}/cajas`] = nuevasCajas;  
        updates[`inventario/${userDeterminanteRefill}/${lote.id}/fechaActualizacion`] = timestamp;  
        updates[`inventario/${userDeterminanteRefill}/${lote.id}/actualizadoPor`] = usuario;  
  
        cajasRestantes -= cajasADescontar;  
      }  
  
      const stockFinal = currentRefillProduct.totalCajas - cajasAMover;  
      console.log(`✅ Stock después: ${stockFinal} cajas`);  
    }  
  
    // ============================================================  
    // CASO B: PRODUCTO EN STOCK 0 O NUEVO  
    // ============================================================  
      
    else {  
      if (currentRefillProduct.existe) {  
        console.log('⚠️ Producto en stock 0 - Solo registrando movimiento');  
      } else {  
        console.log('🆕 Producto nuevo - Solo registrando movimiento');  
      }  
      console.log('   La auditoría organizará después con bodega y caducidad');  
    }  
  
    // ============================================================  
    // REGISTRAR MOVIMIENTO (SIEMPRE) CON PIEZAS CALCULADAS  
    // ============================================================  
  
    const movimientoData = {  
      tipo: 'salida',  
      productoNombre: currentRefillProduct.nombre,  
      productoCodigo: currentRefillProduct.codigoBarras,  
      marca: currentRefillProduct.marca,  
      piezasPorCaja: currentRefillProduct.piezasPorCaja,  
      cajasMovidas: cajasAMover,  
      piezasMovidas: piezasMovidas, // ← CLAVE PARA ANALYTICS  
      stockAnterior: currentRefillProduct.totalCajas,  
      stockNuevo: currentRefillProduct.existe && currentRefillProduct.totalCajas > 0   
        ? currentRefillProduct.totalCajas - cajasAMover   
        : 0,  
      fecha: timestamp,  
      realizadoPor: usuario,  
      motivo: 'Relleno de exhibidor',  
      productoNuevo: !currentRefillProduct.existe,  
      productoEnCero: currentRefillProduct.existe && currentRefillProduct.totalCajas === 0  
    };  
  
    const movimientoKey = `movimientos/${userDeterminanteRefill}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;  
    updates[movimientoKey] = movimientoData;  
  
    console.log('📋 Movimiento a registrar:', movimientoData);  
  
    // APLICAR TODAS LAS ACTUALIZACIONES  
    await firebase.database().ref().update(updates);  
  
    console.log('✅ Movimiento registrado correctamente');  
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');  
  
    // ACTUALIZAR CONTADORES DEL DÍA  
    todayRefillCount += cajasAMover;  
    todayPiecesCount += piezasMovidas;  
  
    const counterElement = document.getElementById('total-movements');  
    if (counterElement) {  
      counterElement.innerHTML = `  
        <div style="font-size:24px;font-weight:700;color:#10b981;">${todayRefillCount}</div>  
        <div style="font-size:12px;color:#6b7280;margin-top:4px;">cajas movidas hoy</div>  
        <div style="font-size:14px;font-weight:600;color:#059669;margin-top:8px;">${todayPiecesCount} piezas</div>  
      `;  
    }  
  
    // FEEDBACK VISUAL  
    showToast(`✅ ${cajasAMover} cajas (${piezasMovidas} piezas) de ${currentRefillProduct.nombre}`, 'success');  
  
    // VIBRACIÓN HÁPTICA  
    if (navigator.vibrate) {  
      navigator.vibrate([100, 50, 100]);  
    }  
  
    // LIMPIAR Y PREPARAR SIGUIENTE  
    limpiarFormularioRefill();  
    document.getElementById('refill-barcode').focus();  
  
  } catch (error) {  
    console.error('❌ Error registrando movimiento:', error);  
    showToast('❌ Error: ' + error.message, 'error');  
  }  
}  
  
// ============================================================  
// LIMPIAR FORMULARIO  
// ============================================================  
  
function limpiarFormularioRefill() {  
  console.log('🧹 Limpiando formulario de relleno');  
  
  // Limpiar campos  
  document.getElementById('refill-barcode').value = '';  
  document.getElementById('refill-nombre').value = '';  
  document.getElementById('refill-marca').value = 'Otra';  
  document.getElementById('refill-piezas').value = '';  
  document.getElementById('refill-boxes').value = '';  
  
  // Restaurar campos a readonly  
  document.getElementById('refill-nombre').readOnly = true;  
  document.getElementById('refill-nombre').style.background = '#f8fafc';  
  
  document.getElementById('refill-marca').disabled = true;  
  
  document.getElementById('refill-piezas').readOnly = true;  
  document.getElementById('refill-piezas').style.background = '#f8fafc';  
  
  // Ocultar info  
  const infoDiv = document.getElementById('refill-product-info');  
  if (infoDiv) {  
    infoDiv.style.display = 'none';  
  }  
  
  // Limpiar producto actual  
  currentRefillProduct = null;  
}  
  
// ============================================================  
// CARGAR MOVIMIENTOS DEL DÍA (CON PIEZAS)  
// ============================================================  
  
async function loadTodayMovements() {  
  console.log('📊 Cargando movimientos del día...');  
  
  if (!userDeterminanteRefill) {  
    userDeterminanteRefill = await getUserDeterminanteRefill();  
  }  
  
  if (!userDeterminanteRefill) {  
    console.warn('⚠️ No se pudo obtener determinante');  
    return;  
  }  
  
  try {  
    const hoy = new Date();  
    hoy.setHours(0, 0, 0, 0);  
  
    const snapshot = await firebase.database()  
      .ref('movimientos/' + userDeterminanteRefill)  
      .orderByChild('fecha')  
      .startAt(hoy.toISOString())  
      .once('value');  
  
    if (snapshot.exists()) {  
      const movimientos = Object.values(snapshot.val()).filter(m => m.tipo === 'salida');  
        
      todayRefillCount = movimientos.reduce((sum, m) => sum + (m.cajasMovidas || 0), 0);  
      todayPiecesCount = movimientos.reduce((sum, m) => sum + (m.piezasMovidas || 0), 0);  
  
      const counterElement = document.getElementById('total-movements');  
      if (counterElement) {  
        counterElement.innerHTML = `  
          <div style="font-size:24px;font-weight:700;color:#10b981;">${todayRefillCount}</div>  
          <div style="font-size:12px;color:#6b7280;margin-top:4px;">cajas movidas hoy</div>  
          <div style="font-size:14px;font-weight:600;color:#059669;margin-top:8px;">${todayPiecesCount} piezas</div>  
        `;  
      }  
  
      console.log(`✅ Movimientos hoy: ${todayRefillCount} cajas (${todayPiecesCount} piezas)`);  
    } else {  
      console.log('📭 Sin movimientos hoy');  
      todayRefillCount = 0;  
      todayPiecesCount = 0;  
    }  
  
  } catch (error) {  
    console.error('❌ Error cargando movimientos del día:', error);  
  }  
}  
  
// ============================================================  
// INICIALIZACIÓN  
// ============================================================  
  
document.addEventListener('DOMContentLoaded', () => {  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');  
  console.log('🔄 Inicializando módulo de relleno ágil...');  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');  
  
  // Configurar campos como readonly por defecto  
  const nombreInput = document.getElementById('refill-nombre');  
  const marcaSelect = document.getElementById('refill-marca');  
  const piezasInput = document.getElementById('refill-piezas');  
  
  if (nombreInput) {  
    nombreInput.readOnly = true;  
    nombreInput.style.background = '#f8fafc';  
  }  
  
  if (marcaSelect) {  
    marcaSelect.disabled = true;  
  }  
  
  if (piezasInput) {  
    piezasInput.readOnly = true;  
    piezasInput.style.background = '#f8fafc';  
  }  
  
  // Evento: Enter en código de barras  
  const barcodeInput = document.getElementById('refill-barcode');  
  if (barcodeInput) {  
    barcodeInput.addEventListener('keypress', (e) => {  
      if (e.key === 'Enter') {  
        e.preventDefault();  
        const codigo = barcodeInput.value.trim();  
        if (codigo) {  
          searchProductForRefill(codigo);  
        }  
      }  
    });  
    console.log('✅ Enter en código de barras configurado');  
  }  
  
  // Evento: Formulario submit  
  const refillForm = document.getElementById('refill-form');  
  if (refillForm) {  
    refillForm.addEventListener('submit', handleRefillSubmit);  
    console.log('✅ Formulario de relleno configurado');  
  }  
  
  // Cargar movimientos del día  
  firebase.auth().onAuthStateChanged((user) => {  
    if (user) {  
      console.log('👤 Usuario autenticado, cargando contador del día...');  
      loadTodayMovements();  
    }  
  });  
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');  
  console.log('✅ Módulo de relleno ágil listo');  
  console.log('   - Stock 0: ✔ Permitido');  
  console.log('   - Productos nuevos: ✔ Permitido');  
  console.log('   - Cálculo de piezas: ✔ Activo');  
  console.log('   - FIFO automático: ✔ Activo');  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');  
});  
  
// ============================================================  
// EXPONER FUNCIONES GLOBALMENTE  
// ============================================================  
  
window.searchProductForRefill = searchProductForRefill;  
window.handleRefillSubmit = handleRefillSubmit;  
window.limpiarFormularioRefill = limpiarFormularioRefill;  
window.loadTodayMovements = loadTodayMovements;  
  
console.log('✅ refill.js (ágil + analytics por piezas) cargado correctamente');  
🎯 CARACTERÍSTICAS IMPLEMENTADAS  
✅ 1. RELLENO SIN FRICCIÓN  
✔ Permitido con stock = 0  
✔ Permitido sin producto registrado  
✔ NO requiere bodega ni caducidad  
✔ Creación rápida de productos nuevos  
✅ 2. STOCK TOTAL REAL  
✔ Suma TODAS las cajas del producto  
✔ Ignora bodegas  
✔ Ignora fechas de caducidad  
✔ No separa por lotes  
✅ 3. ANALYTICS POR PIEZAS  
const piezasMovidas = cajasAMover × piezasPorCaja;  
  
movimientoData = {  
  cajasMovidas: 10,  
  piezasPorCaja: 24,  
  piezasMovidas: 240  // ← CLAVE PARA ANALYTICS  
};  
    
## ✅ 4. DESCUENTO FIFO AUTOMÁTICO    
    
```javascript    
// Ordenar lotes por fecha de caducidad (primero vence, primero sale)    
const lotesOrdenados = registros.sort((a, b) => {    
  const fechaA = new Date(a.fechaCaducidad || '2099-12-31');    
  const fechaB = new Date(b.fechaCaducidad || '2099-12-31');    
  return fechaA - fechaB;    
});    
    
// Descontar de los lotes más viejos primero    
for (const lote of lotesOrdenados) {    
  const cajasADescontar = Math.min(cajasRestantes, lote.cajas);    
  updates[`inventario/.../cajas`] = lote.cajas - cajasADescontar;    
  cajasRestantes -= cajasADescontar;    
}