/* ============================================================
   Águila Inventario Pro - auth.js
   VERSIÓN CORREGIDA: Desconecta listeners + Mejor manejo de sesión
   ============================================================ */

console.log('🔐 auth.js iniciando...');

// Toast notification helper
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
// FUNCIONES DE PANTALLA
// ============================================================
function showLoginScreen() {
  document.getElementById('auth-setup').style.display = 'block';
  document.getElementById('app-container').style.display = 'none';
}

function showApp() {
  document.getElementById('auth-setup').style.display = 'none';
  document.getElementById('app-container').style.display = 'block';
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
  
  // CORRECCIÓN: Quitamos espacios vacíos al determinante
  const determinanteInput = document.getElementById('register-determinante')?.value;
  const determinante = determinanteInput ? String(determinanteInput).trim() : '';

  const storeName = document.getElementById('register-store-name')?.value.trim();
  const promoterName = document.getElementById('register-promoter-name')?.value.trim();
  
  if (!email || !password || !determinante || !storeName || !promoterName) {
    showToast('❌ Completa todos los campos', 'error');
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
// RECUPERACIÓN DE CONTRASEÑA
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
// NAVEGACIÓN ENTRE FORMULARIOS
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
        const userInfo = document.getElementById('user-info');
        if (userInfo) {
          userInfo.textContent = `👤 ${userData.email}`;
        }
        showApp();
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
// LOGOUT CORREGIDO - DESCONECTA LISTENERS ANTES
// ============================================================
async function logout() {
  try {
    console.log('🚪 Cerrando sesión...');
    
    // 1️⃣ PRIMERO: Detener TODOS los listeners
    if (typeof window.stopAllListeners === 'function') {
      console.log('🛑 Deteniendo listeners...');
      window.stopAllListeners();
    } else {
      console.warn('⚠️ stopAllListeners no está disponible');
    }
    
    // 2️⃣ Pequeña pausa para asegurar desconexión
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // 3️⃣ AHORA SÍ: Cerrar sesión en Firebase
    await firebase.auth().signOut();
    currentUser = null;
    
    console.log('✅ Sesión cerrada correctamente');
    showToast('✅ Sesión cerrada', 'success');
    
    // 4️⃣ Limpiar interfaz
    document.getElementById('app-container').style.display = 'none';
    document.getElementById('auth-setup').style.display = 'block';
    
    // 5️⃣ Recargar para limpiar completamente el estado
    setTimeout(() => {
      window.location.reload();
    }, 600);

  } catch (error) {
    console.error('❌ Error en logout:', error);
    showToast('Error al cerrar sesión', 'error');
    // Forzar recarga si hay error
    setTimeout(() => window.location.reload(), 500);
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
    'auth/operation-not-allowed': '❌ Operación no permitida',
    'auth/too-many-requests': '❌ Demasiados intentos, espera un momento'
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
    console.log('📝 Sin usuario autenticado');
    showLoginScreen();
  }
});

// ============================================================
// INICIALIZACIÓN DE EVENTOS
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('📋 Registrando eventos de autenticación');
  
  // Login
  const btnLogin = document.getElementById('btn-login');
  if (btnLogin) {
    btnLogin.addEventListener('click', handleLogin);
  }
  
  // Enter en el formulario de login
  const loginEmail = document.getElementById('login-email');
  const loginPassword = document.getElementById('login-password');
  if (loginEmail && loginPassword) {
    [loginEmail, loginPassword].forEach(input => {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
      });
    });
  }
  
  // Register
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleRegister();
    });
  }
  
  // Forgot password
  const forgotForm = document.getElementById('forgot-password-form');
  if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleForgotPassword();
    });
  }
  
  // Navegación entre formularios
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
  
  // Logout buttons
  document.getElementById('btn-logout')?.addEventListener('click', logout);
  document.getElementById('btn-logout-settings')?.addEventListener('click', logout);
  
  console.log('✅ Eventos de autenticación registrados');
});

// Exponer funciones globalmente
window.logout = logout;
window.showLoginScreen = showLoginScreen;
window.showApp = showApp;
window.currentUser = currentUser;

console.log('✅ auth.js cargado correctamente');