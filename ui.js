/* ============================================================
   Águila Inventario Pro - ui.js
   Utilidades de UI: Toasts, Modales, Notificaciones
   ============================================================ */

console.log('🎨 ui.js iniciando...');

// ============================================================
// SISTEMA DE TOASTS
// ============================================================
window.showToast = function(message, type = 'info') {
  console.log('[TOAST]', type.toUpperCase(), message);
  
  // Buscar o crear contenedor de toasts
  let container = document.getElementById('app-toast-container');
  
  if (!container) {
    container = document.createElement('div');
    container.id = 'app-toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  
  // Crear elemento de toast
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  // Agregar icono según el tipo
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };
  
  const icon = icons[type] || icons.info;
  toast.textContent = `${icon} ${message}`;
  
  // Agregar al contenedor
  container.appendChild(toast);
  
  // Animación de entrada
  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(0)';
  }, 10);
  
  // Auto-eliminar después de 3.5 segundos
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(400px)';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 300);
  }, 3500);
};

// ============================================================
// CONFIRMACIÓN CON ESTILO
// ============================================================
window.showConfirm = function(message, onConfirm, onCancel) {
  const result = confirm(message);
  if (result && onConfirm) {
    onConfirm();
  } else if (!result && onCancel) {
    onCancel();
  }
  return result;
};

// ============================================================
// LOADER/SPINNER
// ============================================================
window.showLoader = function(message = 'Cargando...') {
  let loader = document.getElementById('app-loader');
  
  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'app-loader';
    loader.className = 'app-loader';
    loader.innerHTML = `
      <div class="loader-backdrop"></div>
      <div class="loader-content">
        <div class="spinner"></div>
        <p class="loader-message">${message}</p>
      </div>
    `;
    document.body.appendChild(loader);
  } else {
    const messageEl = loader.querySelector('.loader-message');
    if (messageEl) messageEl.textContent = message;
  }
  
  loader.style.display = 'flex';
};

window.hideLoader = function() {
  const loader = document.getElementById('app-loader');
  if (loader) {
    loader.style.display = 'none';
  }
};

// ============================================================
// INICIALIZAR UI
// ============================================================
function initUI() {
  console.log('🎨 Inicializando UI...');
  
  // Crear contenedor de toasts si no existe
  if (!document.getElementById('app-toast-container')) {
    const container = document.createElement('div');
    container.id = 'app-toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  
  // Configurar estilos dinámicos
  injectDynamicStyles();
  
  console.log('✅ UI inicializado correctamente');
}

// ============================================================
// INYECTAR ESTILOS DINÁMICOS
// ============================================================
function injectDynamicStyles() {
  const styles = `
    /* Toast Container */
    .toast-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: 350px;
      pointer-events: none;
    }
    
    /* Toast Base */
    .toast {
      background: white;
      padding: 16px 20px;
      border-radius: 12px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.15);
      border-left: 4px solid #3b82f6;
      font-size: 14px;
      font-weight: 500;
      opacity: 0;
      transform: translateX(400px);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      pointer-events: auto;
    }
    
    .toast.success {
      border-left-color: #10b981;
      background: #ecfdf5;
      color: #065f46;
    }
    
    .toast.warning {
      border-left-color: #f59e0b;
      background: #fffbeb;
      color: #92400e;
    }
    
    .toast.error {
      border-left-color: #ef4444;
      background: #fef2f2;
      color: #991b1b;
    }
    
    .toast.info {
      border-left-color: #3b82f6;
      background: #eff6ff;
      color: #1e40af;
    }
    
    /* Loader */
    .app-loader {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 10000;
      display: none;
      align-items: center;
      justify-content: center;
    }
    
    .loader-backdrop {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
    }
    
    .loader-content {
      position: relative;
      background: white;
      padding: 40px;
      border-radius: 16px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      min-width: 200px;
    }
    
    .spinner {
      width: 50px;
      height: 50px;
      border: 4px solid #f3f3f3;
      border-top: 4px solid #004aad;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    .loader-message {
      color: #333;
      font-weight: 600;
      margin: 0;
      font-size: 16px;
    }
    
    /* Responsive */
    @media (max-width: 768px) {
      .toast-container {
        right: 10px;
        left: 10px;
        max-width: none;
      }
      
      .toast {
        margin: 0 auto;
        max-width: 100%;
      }
    }
  `;
  
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}

// ============================================================
// UTILIDADES ADICIONALES
// ============================================================

// Debounce (útil para búsquedas)
window.debounce = function(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Formatear fecha
window.formatDate = function(date) {
  if (!date) return 'N/A';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Fecha inválida';
  
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  
  return `${day}/${month}/${year}`;
};

// Formatear número
window.formatNumber = function(num) {
  if (!num && num !== 0) return '0';
  return new Intl.NumberFormat('es-MX').format(num);
};

// Copiar al portapapeles
window.copyToClipboard = async function(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('✅ Copiado al portapapeles', 'success');
    return true;
  } catch (error) {
    console.error('Error al copiar:', error);
    showToast('❌ Error al copiar', 'error');
    return false;
  }
};

// Vibración (útil para feedback en móvil)
window.vibrate = function(pattern = [100]) {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
};

// Verificar si es móvil
window.isMobile = function() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// Scroll suave a elemento
window.scrollToElement = function(elementId) {
  const element = document.getElementById(elementId);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

// ============================================================
// INICIALIZACIÓN
// ============================================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUI);
} else {
  initUI();
}

console.log('✅ ui.js cargado correctamente');