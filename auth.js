/* ============================================================
   Águila Inventario Pro - auth.js
   VERSIÓN CORREGIDA - IDs sincronizados con index.html
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

// ============================================================
// FUNCIONES DE CAMBIO DE PANTALLA - CORREGIDAS
// ============================================================
function showLoginScreen() {
  const loginScreen = document.getElementById('login-screen');
  const appScreen = document.getElementById('app-screen');
  
  if (loginScreen) loginScreen.style.display = 'block';
  if (appScreen) appScreen.style.display = 'none';
  
  console.log('🔐 Mostrando pantalla de login');
}

function showApp() {
  const loginScreen = document.getElementById('login-screen');
  const appScreen = document.getElementById('app-screen');
  
  if (loginScreen) loginScreen.style.display = 'none';
  if (appScreen) appScreen.style.display = 'block';
  
  console.log('✅ Mostrando pantalla principal');
}

// ============================================================
// MANEJO DE LOGIN
// ============================================================
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

// ============================================================
// MANEJO DE REGISTRO
// ============================================================
async function handleRegister() {
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
      document.getElementById('register-form').reset();
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

// ============================================================
// CAMBIO ENTRE FORMULARIOS
// ============================================================
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

// ============================================================
// CARGAR DATOS DEL USUARIO
// ============================================================
function loadUserData(userId) {
  firebase.database().ref('usuarios/' + userId).once('value')
    .then((snapshot) => {
      const userData = snapshot.val();
      if (userData) {
        console.log('📦 Datos cargados:', userData.nombrePromotor);
        
        // Guardar determinante en localStorage para acceso rápido
        if (userData.determinante) {
          localStorage.setItem('aguila_det', userData.determinante);
        }
        
        // Actualizar UI con email
        const userEmailDisplay = document.getElementById('user-email-display');
        if (userEmailDisplay) {
          userEmailDisplay.textContent = userData.email;
        }
        
        // Mostrar app
        showApp();
        
        // Cargar inventario si la función existe
        if (typeof loadInventory === 'function') {
          loadInventory();
        }
      }
    })
    .catch((error) => {
      console.error('❌ Error cargando datos:', error);
      showToast('Error al cargar datos', 'error');
    });
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
    showLoginScreen();
    showLoginForm();
    document.getElementById('login-form').reset();
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
firebase.auth().onAuthStateChanged((user) => {
  if (user) {
    currentUser = user;
    console.log('✅ Usuario autenticado:', user.email);
    loadUserData(user.uid);
  } else {
    currentUser = null;
    console.log('🔐 Sin usuario autenticado');
    showLoginScreen();
  }
});

// ============================================================
// EVENTOS DEL DOM
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('📋 Registrando eventos de autenticación');
  
  // Login form submit
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleLogin();
    });
  }
  
  // Botón de login alternativo
  document.getElementById('btn-login')?.addEventListener('click', handleLogin);
  
  // Register form submit
  document.getElementById('register-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleRegister();
  });
  
  // Forgot password form submit
  document.getElementById('forgot-password-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleForgotPassword();
  });
  
  // Enlaces de cambio de formulario
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
  
  // Botones de logout
  document.getElementById('btn-logout')?.addEventListener('click', logout);
  document.getElementById('btn-logout-settings')?.addEventListener('click', logout);
});

// Exponer funciones globalmente
window.logout = logout;
window.showLoginScreen = showLoginScreen;
window.showApp = showApp;

console.log('✅ auth.js cargado correctamente');