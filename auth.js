// ============================================================
// Águila Inventario Pro - auth.js (Versión Blindada Senior)
// Manejo de sesión, seguridad offline y sincronización de estado.
// ============================================================

/* global firebase, showToast, APP */

(() => {
  'use strict';

  const CONFIG = {
    CACHE_KEY: 'aguila_auth_v2',
    DETERMINANTE_KEY: 'aguila_user_determinante'
  };

  let currentUser = null;

  // ------------------------------------------------------------
  // 1. GESTIÓN DE UI (Login vs App)
  // ------------------------------------------------------------
  const toggleScreens = (isLoggedIn) => {
    const loginScreen = document.getElementById('login-screen');
    const appScreen = document.getElementById('app-screen');
    
    if (loginScreen && appScreen) {
      if (isLoggedIn) {
        loginScreen.classList.add('hidden');
        appScreen.classList.remove('hidden');
        // Forzar renderizado inicial
        if(window.APP && window.APP.switchTab) window.APP.switchTab('inventory');
      } else {
        loginScreen.classList.remove('hidden');
        appScreen.classList.add('hidden');
      }
    }
  };

  // ------------------------------------------------------------
  // 2. LÓGICA DE LOGIN
  // ------------------------------------------------------------
  async function handleLogin(e) {
    if (e) e.preventDefault();
    
    const emailEl = document.getElementById('login-email');
    const passEl = document.getElementById('login-password');
    const btn = document.getElementById('btn-login');
    
    if (!emailEl || !passEl) return;

    const email = emailEl.value.trim();
    const password = passEl.value;

    if (!email || !password) {
      return window.showToast('Por favor completa todos los campos', 'warning');
    }

    try {
      if (btn) { btn.disabled = true; btn.textContent = 'Verificando...'; }
      
      const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
      currentUser = userCredential.user;
      
      // Guardar sesión básica para offline
      localStorage.setItem(CONFIG.CACHE_KEY, JSON.stringify({
        uid: currentUser.uid,
        email: currentUser.email,
        lastLogin: Date.now()
      }));

      // Obtener determinante (ID de tienda) crítico para el inventario
      await fetchUserDeterminante(currentUser.uid);

      window.showToast(`Bienvenido, ${email.split('@')[0]}`, 'success');
      
    } catch (error) {
      console.error(error);
      let msg = 'Error al iniciar sesión';
      if (error.code === 'auth/user-not-found') msg = 'Usuario no encontrado';
      if (error.code === 'auth/wrong-password') msg = 'Contraseña incorrecta';
      if (error.code === 'auth/network-request-failed') msg = 'Sin conexión. Intenta modo offline.';
      window.showToast(msg, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Iniciar Sesión'; }
    }
  }

  // ------------------------------------------------------------
  // 3. DETERMINANTE (La clave de todo)
  // ------------------------------------------------------------
  async function fetchUserDeterminante(uid) {
    try {
      // Intentar red primero
      const snapshot = await firebase.database().ref(`usuarios/${uid}/determinante`).once('value');
      const det = snapshot.val();
      
      if (det) {
        localStorage.setItem(CONFIG.CACHE_KEY + '_det', det);
        // Disparar evento para que Inventory.js se entere
        window.dispatchEvent(new CustomEvent('aguila:determinanteLoaded', { detail: { determinante: det } }));
      }
    } catch (e) {
      console.warn('Offline: Usando determinante en caché');
      const cached = localStorage.getItem(CONFIG.CACHE_KEY + '_det');
      if (cached) {
         window.dispatchEvent(new CustomEvent('aguila:determinanteLoaded', { detail: { determinante: cached } }));
      }
    }
  }

  // ------------------------------------------------------------
  // 4. LOGOUT
  // ------------------------------------------------------------
  function logout() {
    if(confirm('¿Cerrar sesión?')) {
      firebase.auth().signOut().then(() => {
        localStorage.removeItem(CONFIG.CACHE_KEY);
        localStorage.removeItem(CONFIG.CACHE_KEY + '_det');
        window.location.reload();
      });
    }
  }

  // ------------------------------------------------------------
  // 5. INICIALIZACIÓN
  // ------------------------------------------------------------
  function initAuth() {
    console.log('🔐 Auth Module Initialized');
    
    // Escuchar estado de Firebase
    firebase.auth().onAuthStateChanged((user) => {
      if (user) {
        currentUser = user;
        const emailDisplay = document.getElementById('user-email-display');
        if (emailDisplay) emailDisplay.textContent = user.email;
        toggleScreens(true);
        fetchUserDeterminante(user.uid);
      } else {
        toggleScreens(false);
      }
    });

    // Bind Eventos
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    
    const logoutBtns = document.querySelectorAll('.btn-logout');
    logoutBtns.forEach(b => b.addEventListener('click', logout));
  }

  // Exponer globalmente
  window.initAuth = initAuth;
  
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAuth);
  else initAuth();

})();
