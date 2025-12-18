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
    toast.style.animation = 'slideIn 0.3s ease-out';
  }, 10);
  
  // Auto-eliminar después de 3.5 segundos
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => {
      toast.remove();
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
// ESTILOS DINÁMICOS PARA LOADER
// ============================================================
const loaderStyles = `
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
    background: rgba(0, 0, 0, 0.5);
  }
  
  .loader-content {
    position: relative;
    background: white;
    padding: 30px;
    border-radius: 12px;
    text-align: center;
    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
  }
  
  .spinner {
    width: 50px;
    height: 50px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #004aad;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 15px;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  .loader-message {
    color: #333;
    font-weight: 600;
    margin: 0;
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;

// Inyectar estilos del loader
const styleSheet = document.createElement('style');
styleSheet.textContent = loaderStyles;
document.head.appendChild(styleSheet);

// ============================================================
// DEBOUNCE (útil para búsquedas)
// ============================================================
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

// ============================================================
// FORMATEAR FECHA
// ============================================================
window.formatDate = function(date) {
  if (!date) return 'N/A';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Fecha inválida';
  
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  
  return `${day}/${month}/${year}`;
};

// ============================================================
// FORMATEAR NÚMERO
// ============================================================
window.formatNumber = function(num) {
  if (!num && num !== 0) return '0';
  return new Intl.NumberFormat('es-MX').format(num);
};

// ============================================================
// COPIAR AL PORTAPAPELES
// ============================================================
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

// ============================================================
// VIBRACIÓN (útil para feedback en móvil)
// ============================================================
window.vibrate = function(pattern = [100]) {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
};

// ============================================================
// VERIFICAR SI ES MÓVIL
// ============================================================
window.isMobile = function() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// ============================================================
// SCROLL SUAVE A ELEMENTO
// ============================================================
window.scrollToElement = function(elementId) {
  const element = document.getElementById(elementId);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

console.log('✅ ui.js cargado correctamente');