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

console.log('🔐 auth.js iniciando...');
// FALLBACK para showToast
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
let currentUser = null;
// ============================================================
// OCULTAR SPLASH SCREEN
// ============================================================
function hideSplashScreen() {
const splash = document.getElementById('splash-screen');
if (splash) {
setTimeout(() => {
splash.style.opacity = '0';
setTimeout(() => {
splash.style.display = 'none';
}, 300);
}, 1500);
}
}
// ============================================================
// MOSTRAR/OCULTAR PANTALLAS
// ============================================================
function showLoginScreen() {
document.getElementById('splash-screen').style.display = 'none';
document.getElementById('login-screen').style.display = 'flex';
document.getElementById('app').style.display = 'none';
}
function showApp() {
document.getElementById('splash-screen').style.display = 'none';
document.getElementById('login-screen').style.display = 'none';
document.getElementById('app').style.display = 'block';
}
// ============================================================
// EVENTOS DEL DOM
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
console.log('📋 Registrando eventos de autenticación');
// Formulario de login
const loginForm = document.getElementById('login-form');
if (loginForm) {
loginForm.addEventListener('submit', async (e) => {
e.preventDefault();
await handleLogin();
});
}
});
// ============================================================
// MANEJO DE LOGIN
// ============================================================
async function handleLogin() {
const email = document.getElementById('email')?.value.trim();
const password = document.getElementById('password')?.value;
if (!email || !password) {
showToast('Completa todos los campos', 'warning');
return;
}
try {
console.log('🔐 Intentando login...');
const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
console.log('✅ Login exitoso:', userCredential.user.email);
showToast('Acceso concedido', 'success');
} catch (error) {
console.error('❌ Error login:', error.code);
showToast(getErrorMessage(error.code), 'error');
}
}
// ============================================================
// ESTADO DE AUTENTICACIÓN
// ============================================================
firebase.auth().onAuthStateChanged((user) => {
if (user) {
currentUser = user;
console.log('✅ Usuario autenticado:', user.email);
loadUserData(user.uid);
} else {
currentUser = null;
console.log('❌ Sin usuario autenticado');
hideSplashScreen();
showLoginScreen();
}
});
// ============================================================
// CARGAR DATOS DEL USUARIO
// ============================================================
function loadUserData(userId) {
firebase.database().ref('usuarios/' + userId).once('value')
.then((snapshot) => {
const userData = snapshot.val();
if (userData) {
console.log('📦 Datos cargados:', userData.nombrePromotor);
displayUserInfo(userData);
hideSplashScreen();
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
// MOSTRAR INFORMACIÓN DEL USUARIO
// ============================================================
function displayUserInfo(userData) {
const userName = document.getElementById('user-name');
if (userName) {
userName.textContent = userData.nombrePromotor || userData.email;
}
}
// ============================================================
// LOGOUT
// ============================================================
async function logout() {
try {
await firebase.auth().signOut();
showToast('Sesión cerrada', 'success');
showLoginScreen();
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
'auth/invalid-email': 'Email inválido',
'auth/user-disabled': 'Usuario deshabilitado',
'auth/user-not-found': 'Usuario no encontrado',
'auth/wrong-password': 'Contraseña incorrecta',
'auth/invalid-credential': 'Credenciales inválidas',
'auth/email-already-in-use': 'Email ya registrado',
'auth/weak-password': 'Contraseña muy débil (mínimo 6 caracteres)',
'auth/network-request-failed': 'Error de red'
};
return errors[errorCode] || 'Error de autenticación';
}
// Configurar botón logout
document.addEventListener('DOMContentLoaded', () => {
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
logoutBtn.addEventListener('click', logout);
}
});
// Exponer logout globalmente
window.logout = logout;
console.log('✅ auth.js cargado correctamente');