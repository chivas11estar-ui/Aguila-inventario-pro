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

function normalizeLoginDeterminante(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '');
}

function getProfileLoginDeterminantes(profile) {
  return [
    profile?.determinante,
    profile?.determinanteTienda,
    profile?.tienda,
    profile?.storeId,
    profile?.store_id
  ]
    .map(normalizeLoginDeterminante)
    .filter(Boolean);
}

async function fallbackLoginWithDeterminante(email, password, determinante) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedDeterminante = normalizeLoginDeterminante(determinante);

  if (!normalizedEmail || !password || !normalizedDeterminante) {
    return { success: false, error: 'Completa todos los campos' };
  }

  if (!/^[A-Z0-9]{3,20}$/i.test(normalizedDeterminante)) {
    return { success: false, error: 'Revisa el determinante. Usa solo letras o numeros.' };
  }

  const credential = await firebase.auth().signInWithEmailAndPassword(normalizedEmail, password);
  const user = credential.user;
  const snapshot = await firebase.database().ref('usuarios/' + user.uid).once('value');
  const profile = snapshot.val();
  const validDeterminantes = getProfileLoginDeterminantes(profile);

  if (!profile || !validDeterminantes.includes(normalizedDeterminante)) {
    await firebase.auth().signOut();
    return { success: false, error: 'El determinante no coincide con esta cuenta.' };
  }

  window.PROFILE_STATE = window.PROFILE_STATE || {};
  window.PROFILE_STATE.determinante = normalizedDeterminante;
  window.PROFILE_STATE.nombrePromotor = profile.nombrePromotor;
  window.PROFILE_STATE.userData = {
    uid: user.uid,
    email: user.email,
    determinante: normalizedDeterminante,
    nombrePromotor: profile.nombrePromotor || '',
    nombreTienda: profile.nombreTienda || ''
  };

  return { success: true, user };
}

async function fallbackLogout() {
  if (window.LISTENERS_MANAGER && typeof window.LISTENERS_MANAGER.destroy === 'function') {
    window.LISTENERS_MANAGER.destroy();
  }

  if (typeof firebase !== 'undefined' && firebase.database) {
    firebase.database().ref().off();
  }

  window.INVENTORY_STATE = window.INVENTORY_STATE || {};
  window.INVENTORY_STATE.productos = [];
  window.PROFILE_STATE = {};
  window.ANALYTICS_STATE = window.ANALYTICS_STATE || {};
  window.ANALYTICS_STATE.determinante = null;

  await firebase.auth().signOut();
  return { success: true };
}

function showLoginScreen() {
  document.getElementById('auth-setup').style.display = 'block';
  document.getElementById('app-container').style.display = 'none';
}

function showApp() {
  console.log('📱 Cambiando a vista de Aplicación...');
  const authSetup = document.getElementById('auth-setup');
  const appContainer = document.getElementById('app-container');

  if (authSetup) authSetup.style.display = 'none';
  if (appContainer) appContainer.style.display = 'flex';

  // Forzar redibujado de mapas/gráficos si es necesario
  window.dispatchEvent(new Event('resize'));
}

async function ensureAuthenticatedAppModules() {
  if (typeof window.loadAguilaAppModules !== 'function') return;

  try {
    await window.loadAguilaAppModules();
    window.markAguilaBoot?.('T8_APP_MODULES');
  } catch (error) {
    console.error('❌ No se pudieron cargar módulos de la app:', error);
    showToast('No se pudo cargar la app completa. Revisa tu conexión.', 'error');
    throw error;
  }
}

async function handleLogin() {
  const email = document.getElementById('login-email')?.value.trim();
  const password = document.getElementById('login-password')?.value;
  const determinante = document.getElementById('login-determinante')?.value.trim();
  const loginButton = document.getElementById('btn-login');

  if (!email || !password || !determinante) {
    showToast('❌ Completa todos los campos', 'error');
    return;
  }

  try {
    console.log('🔐 Intentando login...');
    await requireQaRuntimeReady();
    window.QA_RUNTIME?.assertQaIdentity?.(email, determinante);
    if (loginButton) {
      loginButton.disabled = true;
      loginButton.dataset.originalText = loginButton.textContent;
      loginButton.textContent = 'Validando...';
    }

    // Activar bandera para que startAuthStateObserver no cargue la app prematuramente
    window.__AGUILA_MANUAL_LOGIN = true;

    const loginFn = window.AuthLoginModule?.loginWithDeterminante || fallbackLoginWithDeterminante;
    const result = await loginFn(email, password, determinante);

    if (!result.success) {
      window.__AGUILA_MANUAL_LOGIN = false; // Resetear bandera en fallo
      showToast('❌ ' + result.error, 'error');
      return;
    }

    console.log('✅ Login exitoso:', result.user.email);

    // Ahora cargamos los datos explícitamente tras pasar la validación del determinante
    await loadUserData(result.user.uid);

    window.__AGUILA_MANUAL_LOGIN = false; // Limpiar bandera tras éxito
    showToast('✅ Acceso concedido', 'success');
  } catch (error) {
    window.__AGUILA_MANUAL_LOGIN = false; // Asegurar reset de bandera en excepción
    console.error('❌ Error login:', {
      code: error.code || error.message || 'unknown',
      timestamp: new Date().toISOString()
    });
    showToast('❌ No se pudo iniciar sesión. Intenta de nuevo.', 'error');
  } finally {
    if (loginButton) {
      loginButton.disabled = false;
      loginButton.textContent = loginButton.dataset.originalText || 'Acceder al Sistema';
    }
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
    await requireQaRuntimeReady();
    if (window.QA_RUNTIME?.enabled) throw new Error('QA_WRITE_BLOCKED');
    console.log('📝 Registrando usuario:', email);
    const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);

    // Guardamos el determinante LIMPIO y como STRING (Fuerza consistencia)
    const safeDeterminante = String(determinante).trim().toUpperCase();

    await firebase.database().ref('usuarios/' + userCredential.user.uid).set({
      email: email,
      nombrePromotor: promoterName,
      nombreTienda: storeName,
      determinante: safeDeterminante,
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
    await requireQaRuntimeReady();
    if (window.QA_RUNTIME?.enabled) throw new Error('QA_WRITE_BLOCKED');
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

    // ✅ FIX: Inicializar window.inventoryStore ANTES de usarlo
    window.inventoryStore = window.inventoryStore || {};

    // 🌙 FIX: Aplicar preferencia de modo oscuro desde localStorage
    const savedTheme = localStorage.getItem('theme');
    const darkMode = savedTheme ? savedTheme === 'dark' : localStorage.getItem('darkMode') === 'true';
    if (typeof window.applyTheme === 'function') {
      window.applyTheme(darkMode);
    } else if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      localStorage.setItem('darkMode', 'true');
      console.log('🌙 Modo oscuro activado');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      localStorage.setItem('darkMode', 'false');
      console.log('☀️ Modo claro activado');
    }

    // 1. ESPERAR AL PERFIL (Fuente de la llave de desencriptación)
    const snapshot = await firebase.database().ref('usuarios/' + userId).once('value');
    const userData = snapshot.val();

    if (userData && userData.determinante) {
      // Forzar que el determinante sea STRING para evitar errores de permisos en Firebase
      const currentDet = String(userData.determinante).trim().toUpperCase();

      if (window.QA_RUNTIME?.enabled && !window.QA_RUNTIME.isQaDeterminanteAllowed(currentDet)) {
        console.error('QA_WRITE_BLOCKED');
        await firebase.auth().signOut();
        showLoginScreen();
        showToast('QA solo permite el determinante 99922.', 'error');
        return;
      }

      window.PROFILE_STATE = window.PROFILE_STATE || {};
      window.PROFILE_STATE.determinante = currentDet;
      window.PROFILE_STATE.nombrePromotor = userData.nombrePromotor;

      // ✅ FIX: Asegurar inicialización de inventoryStore
      window.inventoryStore = window.inventoryStore || {};
      window.inventoryStore.determinante = currentDet;
      window.INVENTORY_STATE = window.INVENTORY_STATE || {};
      window.INVENTORY_STATE.determinante = currentDet;
      window.INVENTORY_CORE = window.INVENTORY_CORE || {};
      window.INVENTORY_CORE.determinante = currentDet;
      window.ANALYTICS_STATE = window.ANALYTICS_STATE || {};
      window.ANALYTICS_STATE.determinante = currentDet;
      
      console.log('✅ [ARCHITECT] Determinante estandarizado:', currentDet);
      
      // Actualizar UI básica
      const userInfo = document.getElementById('user-info');
      if (userInfo) userInfo.textContent = `👤 ${userData.email}`;

      await ensureAuthenticatedAppModules();

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
    const logoutFn = window.AuthLoginModule?.logout || fallbackLogout;
    const result = await logoutFn();

    if (result.success) {
      showToast('Sesión cerrada', 'success');
      return;
    }

    showToast(result.error || 'Error al cerrar sesión', 'error');
  } catch (error) {
    console.error('❌ Error logout:', {
      code: error.code || error.message || 'unknown',
      timestamp: new Date().toISOString()
    });
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

async function requireQaRuntimeReady() {
  try {
    if (window.FIREBASE_READY) await window.FIREBASE_READY;
    if (window.QA_RUNTIME?.requireReady) await window.QA_RUNTIME.requireReady();
  } catch (error) {
    console.error('QA_EMULATOR_REQUIRED');
    showLoginScreen();
    showToast('QA requiere Firebase Emulator activo. No se conectó a producción.', 'error');
    throw error;
  }
}

async function startAuthStateObserver() {
  try {
    await requireQaRuntimeReady();
  } catch (_) {
    return;
  }

  window.markAguilaBoot?.('T7_AUTH_LISTENER');
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      currentUser = user;
      console.log('✅ Usuario autenticado:', user.email);

      // Si el login es manual, NO cargamos datos automáticamente aquí.
      // El flujo de handleLogin se encargará de llamar a loadUserData tras validar el determinante.
      if (window.__AGUILA_MANUAL_LOGIN) {
        console.log('ℹ️ Login manual detectado, postergando carga de datos hasta validar determinante.');
        return;
      }

      loadUserData(user.uid);
    } else {
      currentUser = null;
      console.log('📝 Sin usuario autenticado');
      showLoginScreen();
    }
  });
}

startAuthStateObserver();

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
