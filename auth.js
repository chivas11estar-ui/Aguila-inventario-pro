// ============================================================
// Águila Inventario Pro - Módulo: auth.js
// Copyright © 2025 José A. G. Betancourt
// Todos los derechos reservados
//
// Este archivo forma parte del sistema Águila Inventario Pro,
// desarrollado para promotores de PepsiCo con funcionalidades
// de gestión, auditoría y sincronización de inventario.
//
// Queda prohibida la reproducción, distribución o modificación
// sin autorización expresa del autor.
// ============================================================

// FALLBACK TEMPORAL para showToast - evita ReferenceError
if (typeof window.showToast !== 'function') {
  window.showToast = function(message, type = 'info') {
    console.log('[TOAST]', type.toUpperCase(), message);
    const el = document.createElement('div');
    el.textContent = message;
    el.style.cssText = 'position:fixed;bottom:18px;left:18px;padding:12px 16px;background:#333;color:#fff;border-radius:8px;z-index:99999;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  };
}

// Variables globales
let currentUser = null;

// Manejo de autenticación
firebase.auth().onAuthStateChanged((user) => {
  if (user) {
    currentUser = user;
    console.log('✅ Usuario autenticado:', user.email);
    loadUserData();
  } else {
    currentUser = null;
    console.log('❌ Usuario no autenticado');
    showAuthSection();
  }
});

// Mostrar sección de autenticación
function showAuthSection() {
  document.getElementById('auth-setup').style.display = 'block';
  document.getElementById('app-container').style.display = 'none';
}

// Mostrar aplicación principal
function showAppSection() {
  document.getElementById('auth-setup').style.display = 'none';
  document.getElementById('app-container').style.display = 'block';
}

// Cargar datos del usuario
function loadUserData() {
  const userId = currentUser.uid;
  const userRef = firebase.database().ref('usuarios/' + userId);
  
  userRef.once('value')
    .then((snapshot) => {
      const userData = snapshot.val();
      if (userData) {
        console.log('📦 Datos de usuario cargados:', userData);
        displayUserInfo(userData);
        showAppSection();
        loadInventory();
      } else {
        console.warn('⚠️ No se encontraron datos del usuario');
        showToast('No se encontraron datos del usuario', 'warning');
      }
    })
    .catch((error) => {
      console.error('❌ Error al cargar datos:', error);
      showToast('Error al cargar datos: ' + error.message, 'error');
    });
}

// Mostrar información del usuario
function displayUserInfo(userData) {
  const infoDisplay = document.getElementById('promoter-info-full');
  if (infoDisplay) {
    infoDisplay.innerHTML = `
      <p><strong>Promotor:</strong> ${userData.nombrePromotor || 'N/A'}</p>
      <p><strong>Tienda:</strong> ${userData.nombreTienda || 'N/A'}</p>
      <p><strong>Determinante:</strong> ${userData.determinante || 'N/A'}</p>
      <p><strong>Email:</strong> ${currentUser.email}</p>
    `;
  }
}

// ============================================================
// FUNCIONES DE AUTENTICACIÓN
// ============================================================

// Login
async function login(email, password) {
  try {
    console.log('🔐 Intentando login:', email);
    const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
    console.log('✅ Login exitoso:', userCredential.user.email);
    showToast('Inicio de sesión exitoso', 'success');
    return userCredential.user;
  } catch (error) {
    console.error('❌ Error en login:', error);
    let mensaje = 'Error al iniciar sesión';
    
    switch (error.code) {
      case 'auth/invalid-email':
        mensaje = 'Email inválido';
        break;
      case 'auth/user-disabled':
        mensaje = 'Usuario deshabilitado';
        break;
      case 'auth/user-not-found':
        mensaje = 'Usuario no encontrado';
        break;
      case 'auth/wrong-password':
        mensaje = 'Contraseña incorrecta';
        break;
      case 'auth/invalid-credential':
        mensaje = 'Credenciales inválidas';
        break;
      default:
        mensaje = error.message;
    }
    
    showToast(mensaje, 'error');
    throw error;
  }
}

// Registro
async function register(email, password, userData) {
  try {
    console.log('📝 Intentando registro:', email);
    const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
    const userId = userCredential.user.uid;
    
    // Guardar datos adicionales en Firebase Realtime Database
    await firebase.database().ref('usuarios/' + userId).set({
      email: email,
      nombrePromotor: userData.nombrePromotor,
      nombreTienda: userData.nombreTienda,
      determinante: userData.determinante,
      fechaRegistro: new Date().toISOString()
    });
    
    console.log('✅ Registro exitoso');
    showToast('Registro exitoso. Bienvenido!', 'success');
    return userCredential.user;
  } catch (error) {
    console.error('❌ Error en registro:', error);
    let mensaje = 'Error al registrar usuario';
    
    switch (error.code) {
      case 'auth/email-already-in-use':
        mensaje = 'Este email ya está registrado';
        break;
      case 'auth/invalid-email':
        mensaje = 'Email inválido';
        break;
      case 'auth/weak-password':
        mensaje = 'La contraseña debe tener al menos 6 caracteres';
        break;
      default:
        mensaje = error.message;
    }
    
    showToast(mensaje, 'error');
    throw error;
  }
}

// Recuperar contraseña
async function resetPassword(email) {
  try {
    console.log('📧 Enviando email de recuperación a:', email);
    await firebase.auth().sendPasswordResetEmail(email);
    console.log('✅ Email enviado');
    showToast('Email de recuperación enviado. Revisa tu bandeja de entrada.', 'success');
  } catch (error) {
    console.error('❌ Error al enviar email:', error);
    let mensaje = 'Error al enviar email de recuperación';
    
    switch (error.code) {
      case 'auth/invalid-email':
        mensaje = 'Email inválido';
        break;
      case 'auth/user-not-found':
        mensaje = 'No existe una cuenta con este email';
        break;
      default:
        mensaje = error.message;
    }
    
    showToast(mensaje, 'error');
    throw error;
  }
}

// Logout
async function logout() {
  try {
    console.log('🚪 Cerrando sesión...');
    await firebase.auth().signOut();
    console.log('✅ Sesión cerrada');
    showToast('Sesión cerrada exitosamente', 'success');
    showAuthSection();
  } catch (error) {
    console.error('❌ Error al cerrar sesión:', error);
    showToast('Error al cerrar sesión: ' + error.message, 'error');
  }
}

// ============================================================
// EVENT LISTENERS
// ============================================================

// Login form
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  
  try {
    await login(email, password);
  } catch (error) {
    // Error ya manejado en la función login
  }
});

// Register form
document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('register-email').value.trim();
  const password = document.getElementById('register-password').value;
  const determinante = document.getElementById('register-determinante').value;
  const nombreTienda = document.getElementById('register-store-name').value.trim();
  const nombrePromotor = document.getElementById('register-promoter-name').value.trim();
  
  try {
    await register(email, password, {
      determinante: determinante,
      nombreTienda: nombreTienda,
      nombrePromotor: nombrePromotor
    });
  } catch (error) {
    // Error ya manejado en la función register
  }
});

// Forgot password form
document.getElementById('forgot-password-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('forgot-email').value.trim();
  
  try {
    await resetPassword(email);
  } catch (error) {
    // Error ya manejado en la función resetPassword
  }
});

// Toggle forms
document.getElementById('show-register').addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('login-form').classList.add('hidden');
  document.getElementById('register-form').classList.remove('hidden');
  document.getElementById('forgot-password-form').classList.add('hidden');
});

document.getElementById('show-login').addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('login-form').classList.remove('hidden');
  document.getElementById('register-form').classList.add('hidden');
  document.getElementById('forgot-password-form').classList.add('hidden');
});

document.getElementById('show-forgot-password').addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('login-form').classList.add('hidden');
  document.getElementById('register-form').classList.add('hidden');
  document.getElementById('forgot-password-form').classList.remove('hidden');
});

document.getElementById('show-login-from-forgot').addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('login-form').classList.remove('hidden');
  document.getElementById('register-form').classList.add('hidden');
  document.getElementById('forgot-password-form').classList.add('hidden');
});

console.log('✅ auth.js cargado correctamente');