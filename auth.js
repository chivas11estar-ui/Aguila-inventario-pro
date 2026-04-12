/* ============================================================
   Águila Inventario Pro - auth.js
   CORREGIDO: Recarga al salir + Limpieza de espacios
   Copyright © 2025 José A. G. Betancourt
   ============================================================ */

console.log('🔐 auth.js iniciando...');

if (typeof window.showToast !== 'function') {
  window.showToast = function (message, type = 'info') {
    console.log('[TOAST]', type.toUpperCase(), message);
    const container = document.querySelector('.toast-container');
    if (container) {
      const el = document.createElement('div');
      el.className = `toast ${type}`;
      el.textContent = message;
      container.appendChild(el);
      setTimeout(() => el.remove(), 3500);
    }
  };
}

let currentUser = null;

function showLoginScreen() {
  document.getElementById('auth-setup').style.display = 'block';
  document.getElementById('app-container').style.display = 'none';
}

function showApp() {
  console.log('📱 Cambiando a vista de Aplicación...');
  const authSetup = document.getElementById('auth-setup');
  const appContainer = document.getElementById('app-container');

  if (authSetup) authSetup.style.display = 'none';
  if (appContainer) appContainer.style.display = 'block';

  // Forzar redibujado de mapas/gráficos si es necesario
  window.dispatchEvent(new Event('resize'));
}

async function handleLogin() {
  const email = document.getElementById('login-email')?.value.trim();
  const password = document.getElementById('login-password')?.value;

  if (!email || !password) {
    showToast('❌ Completa todos los campos', 'error');
    return;
  }

  try {
    console.log('🔐 Intentando login...');
    const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
    console.log('✅ Login exitoso:', userCredential.user.email);
    showToast('✅ Acceso concedido', 'success');
  } catch (error) {
    console.error('❌ Error login:', error.code);
    showToast(getErrorMessage(error.code), 'error');
  }
}

async function handleRegister() {
  const email = document.getElementById('register-email')?.value.trim();
  const password = document.getElementById('register-password')?.value;

  // SEGURIDAD FASE 1.2: Validación de determinante con regex
  const determinanteInput = document.getElementById('register-determinante')?.value;
  const determinante = determinanteInput ? String(determinanteInput).trim().toUpperCase() : '';

  const storeName = document.getElementById('register-store-name')?.value;
  const promoterName = document.getElementById('register-promoter-name')?.value;

  if (!email || !password || !determinante || !storeName || !promoterName) {
    showToast('❌ Completa todos los campos', 'error');
    return;
  }

  // Validar determinante: 4-8 caracteres, mayúsculas y números solo
  if (!/^[A-Z0-9]{4,8}$/.test(determinante)) {
    showToast('❌ Determinante: debe ser 4-8 caracteres (letras mayúsculas y números)', 'error');
    return;
  }

  if (password.length < 6) {
    showToast('❌ La contraseña debe tener al menos 6 caracteres', 'error');
    return;
  }

  try {
    console.log('📝 Registrando usuario:', email);
    const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);

    // Guardamos el determinante LIMPIO (sin espacios)
    await firebase.database().ref('usuarios/' + userCredential.user.uid).set({
      email: email,
      nombrePromotor: promoterName,
      nombreTienda: storeName,
      determinante: determinante, // Ya va sin espacios
      fechaRegistro: getLocalISOString()
    });

    console.log('✅ Registro exitoso');
    showToast('✅ Registro exitoso, bienvenido a Águila Pro', 'success');

    setTimeout(() => {
      document.getElementById('register-form').reset();
      showLoginForm();
    }, 1500);

  } catch (error) {
    console.error('❌ Error registro:', error.code);
    showToast(getErrorMessage(error.code), 'error');
  }
}

async function handleForgotPassword() {
  const email = document.getElementById('forgot-email')?.value.trim();

  if (!email) {
    showToast('❌ Ingresa tu email', 'error');
    return;
  }

  try {
    console.log('📧 Enviando enlace de recuperación a:', email);
    await firebase.auth().sendPasswordResetEmail(email);
    showToast('✅ Enlace enviado a tu email', 'success');

    setTimeout(() => {
      document.getElementById('forgot-email').value = '';
      showLoginForm();
    }, 1500);

  } catch (error) {
    console.error('❌ Error recovery:', error.code);
    showToast(getErrorMessage(error.code), 'error');
  }
}

function showLoginForm() {
  document.getElementById('login-form').classList.remove('hidden');
  document.getElementById('register-form').classList.add('hidden');
  document.getElementById('forgot-password-form').classList.add('hidden');
}

function showRegisterForm() {
  document.getElementById('login-form').classList.add('hidden');
  document.getElementById('register-form').classList.remove('hidden');
  document.getElementById('forgot-password-form').classList.add('hidden');
}

function showForgotForm() {
  document.getElementById('login-form').classList.add('hidden');
  document.getElementById('register-form').classList.add('hidden');
  document.getElementById('forgot-password-form').classList.remove('hidden');
}

async function loadUserData(userId) {
  try {
    console.log('🔐 [ARCHITECT] Iniciando secuencia de arranque sincronizada...');
    
    // 1. ESPERAR AL PERFIL (Fuente de la llave de desencriptación)
    const snapshot = await firebase.database().ref('usuarios/' + userId).once('value');
    const userData = snapshot.val();
    
    if (userData && userData.determinante) {
      // Inyectar en el estado global ANTES de cualquier desencriptación
      window.PROFILE_STATE = window.PROFILE_STATE || {};
      window.PROFILE_STATE.determinante = userData.determinante;
      window.PROFILE_STATE.nombrePromotor = userData.nombrePromotor;
      
      console.log('✅ [ARCHITECT] Determinante listo:', userData.determinante);
      
      // Actualizar UI básica
      const userInfo = document.getElementById('user-info');
      if (userInfo) userInfo.textContent = `👤 ${userData.email}`;
      
      showApp();

      // 🚀 [FAST BOOT] Carga optimizada en paralelo
      console.log('⚡ [ARCHITECT] Iniciando carga paralela optimizada...');
      
      // Lanzar carga de inventario de inmediato (no esperar)
      if (typeof window.loadInventory === 'function') {
        window.loadInventory();
      }

      // Retrasar analíticas 3 segundos para dar prioridad a la interacción
      setTimeout(() => {
        if (typeof window.loadStats === 'function') {
          console.log('📊 [ARCHITECT] Cargando analíticas en segundo plano...');
          window.loadStats();
        }
      }, 3000);
      
    } else {
      console.warn('⚠️ Perfil incompleto o sin determinante. Redirigiendo a registro.');
      showApp();
    }
  } catch (error) {
    console.error('❌ [ARCHITECT] Error crítico en secuencia de arranque:', error);
    showToast('Error de sincronización. Reintenta.', 'error');
  }
}

// CORRECCIÓN CLAVE: Recargar página al salir
async function logout() {
  try {
    // 🔴 APAGAR LISTENERS ANTES
    if (window.inventoryRef) {
      window.inventoryRef.off();
      window.inventoryRef = null;
    }

    if (window.auditRef) {
      window.auditRef.off();
      window.auditRef = null;
    }

    // 🧹 Limpiar estados
    window.INVENTORY_STATE = {};
    window.PROFILE_STATE = {};

    await firebase.auth().signOut();

    showToast('Sesión cerrada', 'success');
  } catch (e) {
    showToast('Error al cerrar sesión', 'error');
  }
}

function getErrorMessage(errorCode) {
  const errors = {
    'auth/invalid-email': '❌ Email inválido',
    'auth/user-disabled': '❌ Usuario deshabilitado',
    'auth/user-not-found': '❌ Usuario no encontrado',
    'auth/wrong-password': '❌ Contraseña incorrecta',
    'auth/invalid-credential': '❌ Credenciales inválidas',
    'auth/email-already-in-use': '❌ Email ya registrado',
    'auth/weak-password': '❌ Contraseña muy débil (mínimo 6 caracteres)',
    'auth/network-request-failed': '❌ Error de red',
    'auth/operation-not-allowed': '❌ Operación no permitida'
  };
  return errors[errorCode] || '❌ Error de autenticación: ' + errorCode;
}

firebase.auth().onAuthStateChanged((user) => {
  if (user) {
    currentUser = user;
    console.log('✅ Usuario autenticado:', user.email);
    loadUserData(user.uid);
  } else {
    currentUser = null;
    console.log('📝 Sin usuario autenticado');
    showLoginScreen();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  console.log('📋 Registrando eventos de autenticación');

  document.getElementById('btn-login')?.addEventListener('click', handleLogin);

  document.getElementById('register-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleRegister();
  });

  document.getElementById('forgot-password-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleForgotPassword();
  });

  document.getElementById('show-register')?.addEventListener('click', (e) => {
    e.preventDefault();
    showRegisterForm();
  });

  document.getElementById('show-login')?.addEventListener('click', (e) => {
    e.preventDefault();
    showLoginForm();
  });

  document.getElementById('show-forgot-password')?.addEventListener('click', (e) => {
    e.preventDefault();
    showForgotForm();
  });

  document.getElementById('show-login-from-forgot')?.addEventListener('click', (e) => {
    e.preventDefault();
    showLoginForm();
  });

  document.getElementById('btn-logout')?.addEventListener('click', logout);
  document.getElementById('btn-logout-settings')?.addEventListener('click', logout);
});

window.logout = logout;
window.showLoginScreen = showLoginScreen;
window.showApp = showApp;

console.log('✅ auth.js cargado correctamente');
