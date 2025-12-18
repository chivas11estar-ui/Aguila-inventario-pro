/* ============================================================
   Águila Inventario Pro - auth.js
   VERSIÓN CORREGIDA - Con verificación DOM Ready
   ============================================================ */

console.log('🔐 auth.js iniciando...');

if (typeof window.showToast !== 'function') {
  window.showToast = function(message, type = 'info') {
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
let isDOMReady = false;

// ============================================================
// VERIFICAR SI EL DOM ESTÁ LISTO
// ============================================================
function checkDOMReady() {
  return document.readyState === 'complete' || document.readyState === 'interactive';
}

function waitForDOM() {
  return new Promise((resolve) => {
    if (checkDOMReady()) {
      resolve();
    } else {
      document.addEventListener('DOMContentLoaded', resolve, { once: true });
    }
  });
}

// ============================================================
// FUNCIONES DE CAMBIO DE PANTALLA - PROTEGIDAS
// ============================================================
async function showLoginScreen() {
  await waitForDOM();
  
  const loginScreen = document.getElementById('login-screen');
  const appScreen = document.getElementById('app-screen');
  
  if (!loginScreen || !appScreen) {
    console.error('❌ Elementos de UI no encontrados');
    setTimeout(showLoginScreen, 100); // Reintentar
    return;
  }
  
  loginScreen.style.display = 'block';
  appScreen.style.display = 'none';
  
  console.log('🔐 Mostrando pantalla de login');
}

async function showApp() {
  await waitForDOM();
  
  const loginScreen = document.getElementById('login-screen');
  const appScreen = document.getElementById('app-screen');
  
  if (!loginScreen || !appScreen) {
    console.error('❌ Elementos de UI no encontrados');
    setTimeout(showApp, 100); // Reintentar
    return;
  }
  
  loginScreen.style.display = 'none';
  appScreen.style.display = 'block';
  
  console.log('✅ Mostrando pantalla principal');
}

// ============================================================
// MANEJO DE LOGIN
// ============================================================
async function handleLogin(e) {
  if (e) e.preventDefault();
  
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

// ============================================================
// MANEJO DE REGISTRO
// ============================================================
async function handleRegister(e) {
  if (e) e.preventDefault();
  
  const email = document.getElementById('register-email')?.value.trim();
  const password = document.getElementById('register-password')?.value;
  const determinante = document.getElementById('register-determinante')?.value;
  const storeName = document.getElementById('register-store-name')?.value;
  const promoterName = document.getElementById('register-promoter-name')?.value;
  
  if (!email || !password || !determinante || !storeName || !promoterName) {
    showToast('❌ Completa todos los campos', 'error');
    return;
  }
  
  if (password.length < 6) {
    showToast('❌ La contraseña debe tener al menos 6 caracteres', 'error');
    return;
  }
  
  try {
    console.log('🔐 Registrando usuario:', email);
    const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
    
    // Guardar en usuarios/ (NO en promotores/)
    await firebase.database().ref('usuarios/' + userCredential.user.uid).set({
      email: email,
      nombrePromotor: promoterName,
      nombreTienda: storeName,
      determinante: determinante,
      fechaRegistro: new Date().toISOString()
    });
    
    console.log('✅ Registro exitoso');
    showToast('✅ Registro exitoso, bienvenido a Águila Pro', 'success');
    
    setTimeout(() => {
      const form = document.getElementById('register-form');
      if (form) form.reset();
      showLoginForm();
    }, 1500);
    
  } catch (error) {
    console.error('❌ Error registro:', error.code);
    showToast(getErrorMessage(error.code), 'error');
  }
}

// ============================================================
// RECUPERAR CONTRASEÑA
// ============================================================
async function handleForgotPassword(e) {
  if (e) e.preventDefault();
  
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
      const input = document.getElementById('forgot-email');
      if (input) input.value = '';
      showLoginForm();
    }, 1500);
    
  } catch (error) {
    console.error('❌ Error recovery:', error.code);
    showToast(getErrorMessage(error.code), 'error');
  }
}

// ============================================================
// CAMBIO ENTRE FORMULARIOS
// ============================================================
function showLoginForm() {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const forgotForm = document.getElementById('forgot-password-form');
  
  if (loginForm) loginForm.classList.remove('hidden');
  if (registerForm) registerForm.classList.add('hidden');
  if (forgotForm) forgotForm.classList.add('hidden');
}

function showRegisterForm() {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const forgotForm = document.getElementById('forgot-password-form');
  
  if (loginForm) loginForm.classList.add('hidden');
  if (registerForm) registerForm.classList.remove('hidden');
  if (forgotForm) forgotForm.classList.add('hidden');
}

function showForgotForm() {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const forgotForm = document.getElementById('forgot-password-form');
  
  if (loginForm) loginForm.classList.add('hidden');
  if (registerForm) registerForm.classList.add('hidden');
  if (forgotForm) forgotForm.classList.remove('hidden');
}

// ============================================================
// CARGAR DATOS DEL USUARIO
// ============================================================
async function loadUserData(userId) {
  try {
    const snapshot = await firebase.database().ref('usuarios/' + userId).once('value');
    const userData = snapshot.val();
    
    if (userData) {
      console.log('📦 Datos cargados:', userData.nombrePromotor);
      
      // Guardar determinante en localStorage para acceso rápido
      if (userData.determinante) {
        localStorage.setItem('aguila_det', userData.determinante);
      }
      
      // Actualizar UI con email
      await waitForDOM();
      const userEmailDisplay = document.getElementById('user-email-display');
      if (userEmailDisplay) {
        userEmailDisplay.textContent = userData.email;
      }
      
      // Mostrar app
      await showApp();
      
      // Cargar inventario si la función existe
      if (typeof loadInventory === 'function') {
        setTimeout(() => loadInventory(), 500);
      }
    }
  } catch (error) {
    console.error('❌ Error cargando datos:', error);
    showToast('Error al cargar datos', 'error');
  }
}

// ============================================================
// CERRAR SESIÓN
// ============================================================
async function logout() {
  try {
    await firebase.auth().signOut();
    currentUser = null;
    localStorage.removeItem('aguila_det');
    showToast('✅ Sesión cerrada', 'success');
    await showLoginScreen();
    showLoginForm();
    const form = document.getElementById('login-form');
    if (form) form.reset();
  } catch (error) {
    console.error('❌ Error logout:', error);
    showToast('Error al cerrar sesión', 'error');
  }
}

// ============================================================
// MENSAJES DE ERROR
// ============================================================
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

// ============================================================
// LISTENER DE ESTADO DE AUTENTICACIÓN
// ============================================================
firebase.auth().onAuthStateChanged(async (user) => {
  if (user) {
    currentUser = user;
    console.log('✅ Usuario autenticado:', user.email);
    await loadUserData(user.uid);
  } else {
    currentUser = null;
    console.log('📝 Sin usuario autenticado');
    await showLoginScreen();
  }
});

// ============================================================
// EVENTOS DEL DOM
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  isDOMReady = true;
  console.log('📋 Registrando eventos de autenticación');
  
  // Login form submit
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }
  
  // Botón de login alternativo
  const btnLogin = document.getElementById('btn-login');
  if (btnLogin && btnLogin.type !== 'submit') {
    btnLogin.addEventListener('click', handleLogin);
  }
  
  // Register form submit
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', handleRegister);
  }
  
  // Forgot password form submit
  const forgotForm = document.getElementById('forgot-password-form');
  if (forgotForm) {
    forgotForm.addEventListener('submit', handleForgotPassword);
  }
  
  // Enlaces de cambio de formulario
  const showRegisterLink = document.getElementById('show-register');
  if (showRegisterLink) {
    showRegisterLink.addEventListener('click', (e) => {
      e.preventDefault();
      showRegisterForm();
    });
  }
  
  const showLoginLink = document.getElementById('show-login');
  if (showLoginLink) {
    showLoginLink.addEventListener('click', (e) => {
      e.preventDefault();
      showLoginForm();
    });
  }
  
  const showForgotLink = document.getElementById('show-forgot-password');
  if (showForgotLink) {
    showForgotLink.addEventListener('click', (e) => {
      e.preventDefault();
      showForgotForm();
    });
  }
  
  const showLoginFromForgotLink = document.getElementById('show-login-from-forgot');
  if (showLoginFromForgotLink) {
    showLoginFromForgotLink.addEventListener('click', (e) => {
      e.preventDefault();
      showLoginForm();
    });
  }
  
  // Botones de logout
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', logout);
  }
  
  const btnLogoutSettings = document.getElementById('btn-logout-settings');
  if (btnLogoutSettings) {
    btnLogoutSettings.addEventListener('click', logout);
  }
  
  // Botones en el sidebar
  const logoutButtons = document.querySelectorAll('.btn-logout');
  logoutButtons.forEach(btn => {
    btn.addEventListener('click', logout);
  });
});

// Exponer funciones globalmente
window.logout = logout;
window.showLoginScreen = showLoginScreen;
window.showApp = showApp;

console.log('✅ auth.js cargado correctamente');