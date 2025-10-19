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
    console.log('[TOAST FALLBACK]', type.toUpperCase(), message);
    const el = document.createElement('div');
    el.textContent = message;
    el.style.cssText = 'position:fixed;bottom:18px;left:18px;padding:12px 16px;background:#333;color:#fff;border-radius:8px;z-index:99999;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  };
}

// Variables globales
let currentUser = null;

// ============================================================
// REGISTRO ROBUSTO DE EVENTOS
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('🎯 DOM Loaded - Registrando eventos de autenticación');
  
  // Prevenir submit por defecto en todos los formularios de auth
  document.addEventListener('submit', (e) => {
    const formId = e.target?.id;
    console.log('📝 Submit detectado en:', formId);
    
    if (formId === 'login-form' || formId === 'register-form' || formId === 'forgot-password-form') {
      e.preventDefault();
      console.log('✋ Submit prevenido en:', formId);
    }
  });
  
  // Manejar click en botón de login
  const btnLogin = document.getElementById('btn-login');
  if (btnLogin) {
    console.log('✅ Botón login encontrado, registrando evento');
    btnLogin.addEventListener('click', async (e) => {
      e.preventDefault();
      console.log('🔐 DEBUG: Click en btn-login detectado');
      await handleLogin();
    });
  } else {
    console.warn('⚠️ Botón login NO encontrado');
  }
  
  // Manejar formulario de login como backup
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      console.log('🔐 DEBUG: Submit en login-form detectado');
      await handleLogin();
    });
  }
});

// ============================================================
// MANEJO DE AUTENTICACIÓN
// ============================================================

// Función principal de login
async function handleLogin() {
  console.log('🚀 DEBUG handleLogin: inicio');
  
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  
  if (!emailInput || !passwordInput) {
    console.error('❌ Inputs de login no encontrados');
    showToast('Error: formulario no encontrado', 'error');
    return;
  }
  
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  
  console.log('📧 DEBUG: Email:', email);
  console.log('🔑 DEBUG: Password length:', password.length);
  
  if (!email || !password) {
    showToast('Por favor completa todos los campos', 'warning');
    return;
  }
  
  try {
    await login(email, password);
  } catch (error) {
    console.error('❌ DEBUG: Error en handleLogin:', error);
    // Error ya manejado en función login
  }
}

// Manejo de autenticación con Firebase
firebase.auth().onAuthStateChanged((user) => {
  console.log('🔄 onAuthStateChanged disparado');
  
  if (user) {
    currentUser = user;
    console.log('✅ Usuario autenticado:', user.email);
    console.log('🆔 UID:', user.uid);
    loadUserData();
  } else {
    currentUser = null;
    console.log('❌ Usuario no autenticado');
    showAuthSection();
  }
});

// Mostrar sección de autenticación
function showAuthSection() {
  console.log('📱 Mostrando sección de auth');
  document.getElementById('auth-setup').style.display = 'block';
  document.getElementById('app-container').style.display = 'none';
}

// Mostrar aplicación principal
function showAppSection() {
  console.log('📱 Mostrando aplicación principal');
  document.getElementById('auth-setup').style.display = 'none';
  document.getElementById('app-container').style.display = 'block';
}

// Cargar datos del usuario
function loadUserData() {
  console.log('📦 Cargando datos del usuario...');
  const userId = currentUser.uid;
  const userRef = firebase.database().ref('usuarios/' + userId);
  
  userRef.once('value')
    .then((snapshot) => {
      const userData = snapshot.val();
      if (userData) {
        console.log('✅ Datos de usuario cargados:', userData);
        displayUserInfo(userData);
        showAppSection();
        
        // Cargar inventario si la función existe
        if (typeof loadInventory === 'function') {
          loadInventory();
        }
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
  console.log('🔐 DEBUG login: Intentando autenticación...');
  console.log('📧 Email:', email);
  
  try {
    const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
    console.log('✅ DEBUG login: Autenticación exitosa');
    console.log('👤 Usuario:', userCredential.user.email);
    
    showToast('Inicio de sesión exitoso', 'success');
    
    // NO llamar location.reload() aquí
    // El onAuthStateChanged se encargará de mostrar la app
    console.log('✅ DEBUG login: Esperando onAuthStateChanged...');
    
    return userCredential.user;
  } catch (error) {
    console.error('❌ DEBUG login: Error de autenticación');
    console.error('📋 Código de error:', error.code);
    console.error('📋 Mensaje:', error.message);
    
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
      case 'auth/network-request-failed':
        mensaje = 'Error de red. Verifica tu conexión';
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
  console.log('📝 DEBUG register: Iniciando registro...');
  console.log('📧 Email:', email);
  
  try {
    const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
    const userId = userCredential.user.uid;
    
    console.log('✅ Usuario creado con UID:', userId);
    
    // Guardar datos adicionales en Firebase Realtime Database
    await firebase.database().ref('usuarios/' + userId).set({
      email: email,
      nombrePromotor: userData.nombrePromotor,
      nombreTienda: userData.nombreTienda,
      determinante: userData.determinante,
      fechaRegistro: new Date().toISOString()
    });
    
    console.log('✅ Datos guardados en Firebase');
    showToast('Registro exitoso. Bienvenido!', 'success');
    
    return userCredential.user;
  } catch (error) {
    console.error('❌ DEBUG register: Error en registro');
    console.error('📋 Código de error:', error.code);
    
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
  console.log('📧 DEBUG resetPassword: Enviando email...');
  
  try {
    await firebase.auth().sendPasswordResetEmail(email);
    console.log('✅ Email de recuperación enviado');
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
  console.log('🚪 DEBUG logout: Cerrando sesión...');
  
  try {
    await firebase.auth().signOut();
    console.log('✅ Sesión cerrada exitosamente');
    showToast('Sesión cerrada exitosamente', 'success');
    showAuthSection();
  } catch (error) {
    console.error('❌ Error al cerrar sesión:', error);
    showToast('Error al cerrar sesión: ' + error.message, 'error');
  }
}

// ============================================================
// EVENT LISTENERS PARA FORMULARIOS
// ============================================================

// Register form
const registerForm = document.getElementById('register-form');
if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('📝 Submit en register-form');
    
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
      // Error ya manejado
    }
  });
}

// Forgot password form
const forgotForm = document.getElementById('forgot-password-form');
if (forgotForm) {
  forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('📧 Submit en forgot-password-form');
    
    const email = document.getElementById('forgot-email').value.trim();
    
    try {
      await resetPassword(email);
    } catch (error) {
      // Error ya manejado
    }
  });
}

// Toggle forms
document.getElementById('show-register')?.addEventListener('click', (e) => {
  e.preventDefault();
  console.log('🔄 Mostrando formulario de registro');
  document.getElementById('login-form').classList.add('hidden');
  document.getElementById('register-form').classList.remove('hidden');
  document.getElementById('forgot-password-form').classList.add('hidden');
});

document.getElementById('show-login')?.addEventListener('click', (e) => {
  e.preventDefault();
  console.log('🔄 Mostrando formulario de login');
  document.getElementById('login-form').classList.remove('hidden');
  document.getElementById('register-form').classList.add('hidden');
  document.getElementById('forgot-password-form').classList.add('hidden');
});

document.getElementById('show-forgot-password')?.addEventListener('click', (e) => {
  e.preventDefault();
  console.log('🔄 Mostrando formulario de recuperación');
  document.getElementById('login-form').classList.add('hidden');
  document.getElementById('register-form').classList.add('hidden');
  document.getElementById('forgot-password-form').classList.remove('hidden');
});

document.getElementById('show-login-from-forgot')?.addEventListener('click', (e) => {
  e.preventDefault();
  console.log('🔄 Volviendo a login desde recuperación');
  document.getElementById('login-form').classList.remove('hidden');
  document.getElementById('register-form').classList.add('hidden');
  document.getElementById('forgot-password-form').classList.add('hidden');
});

console.log('✅ auth.js cargado completamente');