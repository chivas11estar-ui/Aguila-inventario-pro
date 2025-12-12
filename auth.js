// ============================================================
// Águila Inventario Pro - auth.js (REFactor v3.1 - Offline-First + Crypto)
// Entregado a: José A. G. Betancourt
// Mejoras: cifrado de cache local (Web Crypto AES-GCM), modo offline,
//          normalización de determinante, prevención doble-clic, limpieza.
// NOTA: No se guarda ninguna contraseña. La clave de cifrado es por instalación.
// ============================================================

/* global firebase, APP */
(() => {
  'use strict';

  console.log('🔐 auth.js v3.1 iniciando...');

  // ---------- CONFIG ----------
  const AUTH_CACHE_KEY = 'aguila_auth_cache_v1_enc'; // ahora cifrado
  const KEY_STORAGE_KEY = 'aguila_crypto_key_v1';
  const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 días
  const MIN_PASSWORD_LEN = 6;

  // ---------- ESTADO ----------
  let currentUser = null;
  let offlineModeActive = false;
  let loginInProgress = false;
  let registerInProgress = false;

  // ---------- HELPERS UI ----------
  function safeEl(id) { return document.getElementById(id) || null; }

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
  function safeToast(msg, type = 'info') { try { showToast(msg, type); } catch (e) { console.log('[toast fail]', msg, e); } }

  // ---------- UTIL: Web Crypto (AES-GCM) ----------
  // Export/import helper base64
  function abToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }
  function base64ToAb(base64) {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  // Generate or load symmetric key (raw stored in localStorage as base64)
  async function getOrCreateCryptoKey() {
    try {
      const existing = localStorage.getItem(KEY_STORAGE_KEY);
      if (existing) {
        const raw = base64ToAb(existing);
        const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', true, ['encrypt', 'decrypt']);
        return key;
      }
      // Create new key
      const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
      const exported = await crypto.subtle.exportKey('raw', key);
      localStorage.setItem(KEY_STORAGE_KEY, abToBase64(exported));
      return key;
    } catch (err) {
      console.error('Crypto key error', err);
      return null;
    }
  }

  // Encrypt object -> JSON -> AES-GCM -> base64 payload {iv, data}
  async function encryptObject(obj) {
    const key = await getOrCreateCryptoKey();
    if (!key) return null;
    try {
      const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit iv
      const json = JSON.stringify(obj);
      const enc = new TextEncoder().encode(json);
      const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, enc);
      return JSON.stringify({
        iv: abToBase64(iv.buffer),
        data: abToBase64(cipher)
      });
    } catch (err) {
      console.error('Encryption failed', err);
      return null;
    }
  }

  // Decrypt base64 payload -> JSON object
  async function decryptObject(serialized) {
    const key = await getOrCreateCryptoKey();
    if (!key) return null;
    try {
      const parsed = JSON.parse(serialized);
      if (!parsed || !parsed.iv || !parsed.data) return null;
      const iv = new Uint8Array(base64ToAb(parsed.iv));
      const cipher = base64ToAb(parsed.data);
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, cipher);
      const text = new TextDecoder().decode(plain);
      return JSON.parse(text);
    } catch (err) {
      console.warn('Decryption failed (possibly corrupted or key mismatch)', err);
      return null;
    }
  }

  // ---------- AUTH CACHE (ahora asincrónico y cifrado) ----------
  async function readAuthCache() {
    try {
      const raw = localStorage.getItem(AUTH_CACHE_KEY);
      if (!raw) return null;
      const obj = await decryptObject(raw);
      if (!obj || !obj.storedAt) {
        // si no podemos descifrar, limpiar
        localStorage.removeItem(AUTH_CACHE_KEY);
        return null;
      }
      if ((Date.now() - obj.storedAt) > CACHE_TTL_MS) {
        localStorage.removeItem(AUTH_CACHE_KEY);
        return null;
      }
      return obj;
    } catch (e) {
      console.warn('readAuthCache error', e);
      try { localStorage.removeItem(AUTH_CACHE_KEY); } catch(_) {}
      return null;
    }
  }

  async function writeAuthCache(obj) {
    try {
      const payload = Object.assign({}, obj, { storedAt: Date.now() });
      if (payload.determinante !== undefined && payload.determinante !== null) payload.determinante = String(payload.determinante);
      const encrypted = await encryptObject(payload);
      if (encrypted) localStorage.setItem(AUTH_CACHE_KEY, encrypted);
    } catch (e) {
      console.warn('writeAuthCache error', e);
    }
  }

  async function clearAuthCache() {
    try {
      localStorage.removeItem(AUTH_CACHE_KEY);
    } catch (e) { /* ignore */ }
    try { localStorage.removeItem(KEY_STORAGE_KEY); } catch (e) { /* ignore */ }
  }

  // ---------- NORMALIZACIÓN ----------
  function normalizeDeterminante(v) {
    if (v === undefined || v === null) return null;
    return String(v).trim();
  }

  // ---------- UI HELPERS (pantallas) ----------
  function showLoginScreen() {
    safeEl('auth-setup') && (safeEl('auth-setup').style.display = 'block');
    safeEl('app-container') && (safeEl('app-container').style.display = 'none');
  }
  function showAppScreen() {
    safeEl('auth-setup') && (safeEl('auth-setup').style.display = 'none');
    safeEl('app-container') && (safeEl('app-container').style.display = 'block');
  }

  // ---------- CARGAR DATOS DE USUARIO (ONLINE) ----------
  async function loadUserDataOnline(userId) {
    try {
      const snap = await firebase.database().ref('usuarios/' + userId).once('value');
      const userData = snap.val();
      if (!userData) return null;
      const determinante = normalizeDeterminante(userData.determinante);
      await writeAuthCache({
        uid: userId,
        email: userData.email || '',
        nombrePromotor: userData.nombrePromotor || '',
        nombreTienda: userData.nombreTienda || '',
        determinante: determinante,
        storedAt: Date.now()
      });
      const userInfo = safeEl('user-info');
      if (userInfo) userInfo.textContent = `👤 ${userData.email || ''}`;
      showAppScreen();
      if (typeof loadInventory === 'function') { try { loadInventory(); } catch (e) { console.warn('loadInventory fallo', e); } }
      return userData;
    } catch (err) {
      console.error('Error loadUserDataOnline', err);
      safeToast('Error al cargar datos de usuario', 'error');
      return null;
    }
  }

  // ---------- LOGIN (ONLINE) ----------
  async function handleLogin() {
    if (loginInProgress) return;
    loginInProgress = true;
    const email = safeEl('login-email')?.value?.trim() || '';
    const password = safeEl('login-password')?.value || '';
    if (!email || !password) {
      safeToast('❌ Completa todos los campos', 'error');
      loginInProgress = false; return;
    }
    try {
      const btn = safeEl('btn-login'); if (btn) btn.disabled = true;
      safeToast('🔐 Iniciando sesión...', 'info');
      const cred = await firebase.auth().signInWithEmailAndPassword(email, password);
      currentUser = cred.user;
      safeToast('✅ Acceso concedido', 'success');
      await loadUserDataOnline(currentUser.uid);
    } catch (error) {
      console.error('Login error', error);
      safeToast(getErrorMessage(error.code), 'error');
    } finally {
      loginInProgress = false;
      const btn = safeEl('btn-login'); if (btn) btn.disabled = false;
    }
  }

  // ---------- REGISTER (ONLINE) ----------
  async function handleRegister() {
    if (registerInProgress) return;
    registerInProgress = true;
    const email = safeEl('register-email')?.value?.trim() || '';
    const password = safeEl('register-password')?.value || '';
    const determinanteRaw = safeEl('register-determinante')?.value || '';
    const determinante = normalizeDeterminante(determinanteRaw);
    const storeName = safeEl('register-store-name')?.value?.trim() || '';
    const promoterName = safeEl('register-promoter-name')?.value?.trim() || '';
    if (!email || !password || !determinante || !storeName || !promoterName) {
      safeToast('❌ Completa todos los campos', 'error'); registerInProgress = false; return;
    }
    if (password.length < MIN_PASSWORD_LEN) {
      safeToast(`❌ La contraseña debe tener al menos ${MIN_PASSWORD_LEN} caracteres`, 'error'); registerInProgress = false; return;
    }
    try {
      const btn = safeEl('register-submit-btn'); if (btn) btn.disabled = true;
      safeToast('📝 Registrando usuario...', 'info');
      const cred = await firebase.auth().createUserWithEmailAndPassword(email, password);
      await firebase.database().ref('usuarios/' + cred.user.uid).set({
        email: email,
        nombrePromotor: promoterName,
        nombreTienda: storeName,
        determinante: determinante,
        fechaRegistro: new Date().toISOString()
      });
      safeToast('✅ Registro exitoso, bienvenido', 'success');
      await writeAuthCache({ uid: cred.user.uid, email, nombrePromotor: promoterName, nombreTienda: storeName, determinante });
      safeEl('register-form')?.reset();
      showLoginForm();
    } catch (error) {
      console.error('Register error', error);
      safeToast(getErrorMessage(error.code), 'error');
    } finally {
      registerInProgress = false;
      const btn = safeEl('register-submit-btn'); if (btn) btn.disabled = false;
    }
  }

  // ---------- FORGOT PASSWORD ----------
  async function handleForgotPassword() {
    const email = safeEl('forgot-email')?.value?.trim() || '';
    if (!email) { safeToast('❌ Ingresa tu email', 'error'); return; }
    try {
      await firebase.auth().sendPasswordResetEmail(email);
      safeToast('✅ Enlace enviado a tu email', 'success');
      safeEl('forgot-form')?.reset();
      showLoginForm();
    } catch (err) {
      console.error('forgot error', err);
      safeToast(getErrorMessage(err.code), 'error');
    }
  }

  // ---------- LOGOUT ----------
  async function logout() {
    try {
      safeToast('🚪 Cerrando sesión...', 'info');
      if (typeof window.stopAllListeners === 'function') {
        try { window.stopAllListeners(); } catch (e) { console.warn('stopAllListeners fallo', e); }
      }
      await new Promise(r => setTimeout(r, 150));
      if (firebase.auth().currentUser) await firebase.auth().signOut();
      currentUser = null; offlineModeActive = false;
      await clearAuthCache();
      showLoginScreen();
      setTimeout(() => window.location.reload(), 600);
    } catch (err) {
      console.error('logout error', err);
      safeToast('Error al cerrar sesión', 'error');
      setTimeout(() => window.location.reload(), 500);
    }
  }

  // ---------- NAV FORMS ----------
  function showLoginForm() { safeEl('login-form')?.classList.remove('hidden'); safeEl('register-form')?.classList.add('hidden'); safeEl('forgot-password-form')?.classList.add('hidden'); }
  function showRegisterForm() { safeEl('login-form')?.classList.add('hidden'); safeEl('register-form')?.classList.remove('hidden'); safeEl('forgot-password-form')?.classList.add('hidden'); }
  function showForgotForm() { safeEl('login-form')?.classList.add('hidden'); safeEl('register-form')?.classList.add('hidden'); safeEl('forgot-password-form')?.classList.remove('hidden'); }

  // ---------- ERRORS ----------
  function getErrorMessage(errorCode) {
    const errors = {
      'auth/invalid-email': '❌ Email inválido',
      'auth/user-disabled': '❌ Usuario deshabilitado',
      'auth/user-not-found': '❌ Usuario no encontrado',
      'auth/wrong-password': '❌ Contraseña incorrecta',
      'auth/invalid-credential': '❌ Credenciales inválidas',
      'auth/email-already-in-use': '❌ Email ya registrado',
      'auth/weak-password': `❌ Contraseña muy débil (mínimo ${MIN_PASSWORD_LEN} caracteres)`,
      'auth/network-request-failed': '❌ Error de red',
      'auth/operation-not-allowed': '❌ Operación no permitida',
      'auth/too-many-requests': '❌ Demasiados intentos, espera un momento'
    };
    return errors[errorCode] || ('❌ Error de autenticación: ' + errorCode);
  }

  // ---------- onAuthStateChanged (unificado) ----------
  let _authListenerBound = false;
  function bindAuthStateListener() {
    if (_authListenerBound) return;
    _authListenerBound = true;

    firebase.auth().onAuthStateChanged(async (user) => {
      if (user) {
        currentUser = user;
        offlineModeActive = false;
        console.log('✅ Usuario autenticado (online):', user.email);
        await loadUserDataOnline(user.uid);
      } else {
        currentUser = null;
        console.log('📝 No hay usuario firebase actualmente');

        if (!navigator.onLine) {
          const cached = await readAuthCache();
          if (cached && cached.uid) {
            offlineModeActive = true;
            currentUser = { uid: cached.uid, email: cached.email || '(offline)' };
            const userInfo = safeEl('user-info'); if (userInfo) userInfo.textContent = `👤 ${cached.email || '(offline)'}`;
            showAppScreen();
            safeToast('📡 Entrando en modo offline (perfil cacheado)', 'warning');
            console.log('✅ Entrando en modo offline con cache:', cached);
            if (typeof loadInventory === 'function') { try { loadInventory(); } catch (e) { console.warn('loadInventory offline fail', e); } }
            return;
          }
        }
        showLoginScreen();
      }
    });
  }

  // ---------- BIND UI EVENTS ----------
  function bindUIEvents() {
    safeEl('btn-login')?.addEventListener('click', handleLogin);
    const le = safeEl('login-email'), lp = safeEl('login-password');
    if (le && lp) [le, lp].forEach(i => i.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleLogin(); }));
    safeEl('register-form')?.addEventListener('submit', async (e) => { e.preventDefault(); await handleRegister(); });
    safeEl('show-register')?.addEventListener('click', (e) => { e?.preventDefault(); showRegisterForm(); });
    safeEl('show-login')?.addEventListener('click', (e) => { e?.preventDefault(); showLoginForm(); });
    safeEl('show-forgot-password')?.addEventListener('click', (e) => { e?.preventDefault(); showForgotForm(); });
    safeEl('show-login-from-forgot')?.addEventListener('click', (e) => { e?.preventDefault(); showLoginForm(); });
    safeEl('forgot-password-form')?.addEventListener('submit', async (e) => { e.preventDefault(); await handleForgotPassword(); });
    safeEl('btn-logout')?.addEventListener('click', logout);
    safeEl('btn-logout-settings')?.addEventListener('click', logout);
    console.log('✅ Eventos de auth registrados');
  }

  // ---------- INIT ----------
  async function initAuthModule() {
    try {
      bindAuthStateListener();
      bindUIEvents();

      // Si arranca sin conexión, intentar cargar cache cifrada
      if (!navigator.onLine) {
        const cached = await readAuthCache();
        if (cached && cached.uid) {
          offlineModeActive = true;
          currentUser = { uid: cached.uid, email: cached.email || '(offline)' };
          const userInfo = safeEl('user-info'); if (userInfo) userInfo.textContent = `👤 ${cached.email || '(offline)'}`;
          showAppScreen();
          safeToast('📡 Modo offline (perfil cacheado). Algunas funciones podrían estar limitadas)', 'warning');
        } else {
          showLoginScreen();
        }
      }
    } catch (e) {
      console.error('initAuthModule error', e);
    }
  }

  // ---------- Expose API ----------
  window.AUTH = {
    init: initAuthModule,
    handleLogin,
    handleRegister,
    handleForgotPassword,
    logout,
    isOfflineMode: () => offlineModeActive,
    getCachedProfile: async () => await readAuthCache()
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { initAuthModule(); });
  } else {
    initAuthModule();
  }

  console.log('✅ auth.js v3.1 cargado — cache cifrada activa');

})();