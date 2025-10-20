// ============================================================
// Águila Inventario Pro - Módulo: system.js
// Copyright © 2025 José A. G. Betancourt
// Todos los derechos reservados
//
// Lógica de diagnóstico mejorada para proporcionar información
// más detallada y amigable para el usuario sobre el entorno
// de la aplicación.
// ============================================================

// ============================================================
// DIAGNÓSTICO DE FIREBASE (Lógica Mejorada)
// ============================================================

// ============================================================
// DIAGNÓSTICO DE FIREBASE
// ============================================================
function diagnosticoFirebase() {
  console.log('🔍 Iniciando diagnóstico de Firebase...');
  
  // Detectar tipo de dispositivo/navegador
  const getDeviceType = () => {
    const ua = navigator.userAgent.toLowerCase();
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                        window.navigator.standalone === true;
    
    // Detectar si es PWA instalada
    if (isStandalone) {
      if (ua.includes('android')) return 'App Instalada (Android)';
      if (ua.includes('iphone') || ua.includes('ipad')) return 'App Instalada (iOS)';
      return 'App Instalada (Escritorio)';
    }
    
    // Detectar navegador móvil
    if (ua.includes('android')) return 'Navegador Móvil (Android)';
    if (ua.includes('iphone') || ua.includes('ipad')) return 'Navegador Móvil (iOS)';
    
    // Escritorio
    if (ua.includes('chrome')) return 'Chrome (Escritorio)';
    if (ua.includes('firefox')) return 'Firefox (Escritorio)';
    if (ua.includes('safari')) return 'Safari (Escritorio)';
    if (ua.includes('edge')) return 'Edge (Escritorio)';
    
    return 'Navegador Web';
  };
  
  // Detectar tipo de conexión de forma segura
  const getConnectionType = () => {
    if (!navigator.onLine) return 'Sin Conexión';
    
    const connection = navigator.connection || 
                      navigator.mozConnection || 
                      navigator.webkitConnection;
    
    if (!connection) return 'Wi-Fi o Datos';
    
    // Obtener tipo de conexión sin exponer detalles sensibles
    const type = connection.type || connection.effectiveType;
    
    if (type === 'wifi') return 'Wi-Fi';
    if (type === 'cellular' || type === '4g' || type === '3g' || type === '2g') return 'Datos Móviles';
    if (type === 'ethernet') return 'Ethernet';
    if (type === 'bluetooth') return 'Bluetooth';
    
    // Velocidad estimada (sin exponer red específica)
    const effectiveType = connection.effectiveType;
    if (effectiveType === '4g') return 'Datos Móviles (4G)';
    if (effectiveType === '3g') return 'Datos Móviles (3G)';
    if (effectiveType === '2g') return 'Datos Móviles (2G)';
    if (effectiveType === 'slow-2g') return 'Datos Móviles (Lento)';
    
    return 'Conectado';
  };
  
  const diagnostico = {
    timestamp: new Date().toISOString(),
    firebase: {
      cargado: typeof firebase !== 'undefined',
      apps: firebase?.apps?.length || 0,
      auth: typeof firebase?.auth === 'function',
      database: typeof firebase?.database === 'function'
    },
    usuario: {
      autenticado: !!firebase?.auth()?.currentUser,
      uid: firebase?.auth()?.currentUser?.uid || null,
      email: firebase?.auth()?.currentUser?.email || null
    },
    conexion: {
      online: navigator.onLine,
      tipo: getConnectionType()
    },
    dispositivo: {
      tipo: getDeviceType(),
      idioma: navigator.language
    }
  };
  
  console.log('📋 Diagnóstico completo:', diagnostico);
  
  // Mostrar en un alert formateado
  const mensaje = `
🔥 Firebase: ${diagnostico.firebase.cargado ? '✅' : '❌'}
📱 Apps: ${diagnostico.firebase.apps}
🔐 Auth: ${diagnostico.firebase.auth ? '✅' : '❌'}
💾 Database: ${diagnostico.firebase.database ? '✅' : '❌'}

👤 Usuario: ${diagnostico.usuario.autenticado ? '✅ Autenticado' : '❌ No autenticado'}
📧 Email: ${diagnostico.usuario.email || 'N/A'}

🌐 Conexión: ${diagnostico.conexion.online ? '✅ Online' : '❌ Offline'}
📶 Tipo: ${diagnostico.conexion.tipo}

💻 Navegador: ${diagnostico.dispositivo.tipo}
  `;
  
  alert(mensaje);
  
  showToast('Diagnóstico completado. Revisa la consola para más detalles.', 'info');
}

// ============================================================
// ESTADÍSTICAS DEL SISTEMA
// ============================================================
function showSystemStats() {
  console.log('📊 Mostrando estadísticas del sistema...');
  
  const userId = firebase.auth().currentUser?.uid;
  if (!userId) {
    showToast('No hay usuario autenticado', 'error');
    return;
  }
  
  // Obtener estadísticas de Firebase
  firebase.database().ref('inventario/' + userId).once('value')
    .then((snapshot) => {
      const data = snapshot.val();
      
      if (!data) {
        showToast('No hay datos en el inventario', 'warning');
        return;
      }
      
      const productos = Object.values(data);
      
      // Calcular estadísticas
      const stats = {
        totalProductos: productos.length,
        totalCajas: productos.reduce((sum, p) => sum + (p.cajas || 0), 0),
        totalPiezas: productos.reduce((sum, p) => {
          return sum + ((p.cajas || 0) * (p.piezasPorCaja || 0));
        }, 0),
        marcas: [...new Set(productos.map(p => p.marca))].length,
        ubicaciones: [...new Set(productos.map(p => p.ubicacion))].length,
        sinStock: productos.filter(p => (p.cajas || 0) === 0).length,
        stockBajo: productos.filter(p => (p.cajas || 0) > 0 && (p.cajas || 0) < 5).length
      };
      
      const mensaje = `
📦 ESTADÍSTICAS DEL INVENTARIO

Productos únicos: ${stats.totalProductos}
Total de cajas: ${stats.totalCajas}
Total de piezas: ${stats.totalPiezas}

🏷️ Marcas diferentes: ${stats.marcas}
📍 Ubicaciones: ${stats.ubicaciones}

⚠️ Sin stock: ${stats.sinStock}
🟡 Stock bajo (<5): ${stats.stockBajo}
      `;
      
      alert(mensaje);
      console.log('📊 Estadísticas completas:', stats);
      
    })
    .catch((error) => {
      console.error('❌ Error al obtener estadísticas:', error);
      showToast('Error al cargar estadísticas: ' + error.message, 'error');
    });
}

// ============================================================
// LIMPIAR DATOS LOCALES
// ============================================================
function clearAllData() {
  const confirmacion = confirm(
    '⚠️ ADVERTENCIA\n\n' +
    'Esta acción eliminará:\n' +
    '• Caché del navegador\n' +
    '• Datos locales guardados\n\n' +
    'NO eliminará tus datos en Firebase.\n\n' +
    '¿Continuar?'
  );
  
  if (!confirmacion) return;
  
  console.log('🗑️ Limpiando datos locales...');
  
  try {
    // Limpiar localStorage
    localStorage.clear();
    console.log('✅ localStorage limpiado');
    
    // Limpiar sessionStorage
    sessionStorage.clear();
    console.log('✅ sessionStorage limpiado');
    
    // Limpiar cookies (solo las del dominio actual)
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
    console.log('✅ Cookies limpiadas');
    
    showToast('Datos locales eliminados correctamente', 'success');
    
    // Preguntar si quiere recargar
    setTimeout(() => {
      if (confirm('¿Recargar la página para aplicar cambios?')) {
        location.reload();
      }
    }, 1000);
    
  } catch (error) {
    console.error('❌ Error al limpiar datos:', error);
    showToast('Error al limpiar datos: ' + error.message, 'error');
  }
}

// ============================================================
// ACTUALIZAR ESTADO DE CONEXIÓN
// ============================================================
function updateSystemConnectionStatus() {
  const statusElement = document.getElementById('system-connection-status');
  const headerStatusElement = document.querySelector('.status-indicator');
  const headerStatusText = document.getElementById('connection-status-text');
  
  const isOnline = navigator.onLine;
  
  if (statusElement) {
    statusElement.textContent = isOnline ? 'Conectado ✅' : 'Sin conexión ❌';
    statusElement.style.color = isOnline ? 'var(--success)' : 'var(--error)';
    statusElement.style.fontWeight = '700';
  }
  
  if (headerStatusElement) {
    headerStatusElement.className = isOnline 
      ? 'status-indicator status-online' 
      : 'status-indicator status-error';
  }
  
  if (headerStatusText) {
    headerStatusText.textContent = isOnline ? 'Conectado' : 'Sin conexión';
  }
  
  console.log('🌐 Estado de conexión:', isOnline ? 'Online' : 'Offline');
}

// ============================================================
// ACTUALIZAR ESTADO DE SERVICE WORKER
// ============================================================
function updateServiceWorkerStatus() {
  const statusElement = document.getElementById('system-sw-status');
  
  if (!statusElement) return;
  
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistration()
      .then((registration) => {
        if (registration) {
          statusElement.textContent = 'Activo ✅';
          statusElement.style.color = 'var(--success)';
          statusElement.style.fontWeight = '700';
        } else {
          statusElement.textContent = 'No instalado';
          statusElement.style.color = 'var(--muted)';
        }
      })
      .catch(() => {
        statusElement.textContent = 'No soportado';
        statusElement.style.color = 'var(--error)';
      });
  } else {
    statusElement.textContent = 'No soportado';
    statusElement.style.color = 'var(--error)';
  }
}

// ============================================================
// ACTUALIZAR OPERACIONES PENDIENTES
// ============================================================
function updatePendingOperations() {
  const statusElement = document.getElementById('system-pending-ops');
  
  if (!statusElement) return;
  
  // Por ahora siempre es 0, en el futuro se implementará sincronización offline
  statusElement.textContent = '0';
  statusElement.style.color = 'var(--success)';
}

// ============================================================
// MONITOREAR CONEXIÓN EN TIEMPO REAL
// ============================================================
function setupConnectionMonitoring() {
  console.log('🌐 Configurando monitoreo de conexión...');
  
  // Actualizar inmediatamente
  updateSystemConnectionStatus();
  
  // Escuchar cambios de conexión
  window.addEventListener('online', () => {
    console.log('✅ Conexión restaurada');
    updateSystemConnectionStatus();
    showToast('Conexión restaurada', 'success');
  });
  
  window.addEventListener('offline', () => {
    console.log('❌ Conexión perdida');
    updateSystemConnectionStatus();
    showToast('Sin conexión a internet', 'warning');
  });
  
  // Actualizar estado periódicamente (cada 30 segundos)
  setInterval(() => {
    updateSystemConnectionStatus();
  }, 30000);
}

// ============================================================
// INICIALIZACIÓN
// ============================================================
function initSystemModule() {
  console.log('⚙️ Inicializando módulo de sistema...');
  
  // Configurar monitoreo de conexión
  setupConnectionMonitoring();
  
  // Actualizar estados
  updateServiceWorkerStatus();
  updatePendingOperations();
  
  console.log('✅ Módulo de sistema inicializado');
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSystemModule);
} else {
  initSystemModule();
}

// Exponer funciones globalmente
window.diagnosticoFirebase = diagnosticoFirebase;
window.showSystemStats = showSystemStats;
window.clearAllData = clearAllData;

console.log('✅ system.js cargado correctamente');