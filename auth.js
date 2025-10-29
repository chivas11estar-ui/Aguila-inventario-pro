// ============================================================\
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
//
// VERSIÓN CORREGIDA: Incluye guardado de perfil en RTDB durante el registro.
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
let userDeterminanteGlobal = null; // Guardamos el determinante globalmente

// ============================================================\
// FUNCIÓN PRINCIPAL DE REGISTRO (CORREGIDA)
// ============================================================
async function handleRegister(event) {
  event.preventDefault();
  console.log('Iniciando registro...');
  
  // 1. Obtener datos del formulario
  const nombrePromotor = document.getElementById('register-name').value;
  const email = document.getElementById('register-email').value;
  const password = document.getElementById('register-password').value;
  const determinante = document.getElementById('register-determinante').value;
  const nombreTienda = document.getElementById('register-store-name').value;

  // 2. Validar campos
  if (!nombrePromotor || !email || !password || !determinante || !nombreTienda) {
    showToast('❌ Todos los campos son obligatorios', 'error');
    return;
  }
  
  if (password.length < 6) {
    showToast('❌ La contraseña debe tener al menos 6 dígitos', 'error');
    return;
  }

  showToast('Procesando registro...', 'info');

  try {
    // 3. Crear el usuario en Firebase Authentication
    const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;
    
    console.log('✅ Usuario creado en Auth:', user.uid);

    // 4. Preparar los datos adicionales para la Realtime Database
    const userData = {
      nombre: nombrePromotor,
      email: email,
      determinante: determinante,
      nombreTienda: nombreTienda,
      fechaRegistro: new Date().toISOString()
    };

    // 5. Guardar los datos adicionales en la ruta /usuarios/[uid]
    // ESTA ES LA PARTE CRÍTICA QUE FALTABA
    await firebase.database().ref('usuarios/' + user.uid).set(userData);
    
    console.log('✅ Datos del promotor guardados en la base de datos');
    
    showToast('¡Registro exitoso! Iniciando sesión...', 'success');
    
    // El onAuthStateChanged se encargará de redirigir
    
  } catch (error) {
    console.error('❌ Error en el registro:', error);
    if (error.code === 'auth/email-already-in-use') {
      showToast('❌ El correo electrónico ya está en uso', 'error');
    } else {
      showToast('❌ Error en el registro: ' + error.message, 'error');
    }
  }
}

// ============================================================\
// FUNCIÓN PRINCIPAL DE LOGIN
// ============================================================
async function handleLogin(event) {
  event.preventDefault();
  
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  if (!email || !password) {
    showToast('Ingresa email y contraseña', 'warning');
    return;
  }

  showToast('Iniciando sesión...', 'info');

  try {
    await firebase.auth().signInWithEmailAndPassword(email, password);
    // onAuthStateChanged se encargará de la redirección
    console.log('Login exitoso (esperando onAuthStateChanged)');
    
  } catch (error) {
    console.error('❌ Error de login:', error);
    showToast('Error: Usuario o contraseña incorrectos', 'error');
  }
}

// ============================================================\
// MANEJADOR DE ESTADO DE AUTENTICACIÓN (EL CEREBRO)
// ============================================================
function initAuthListener() {
  firebase.auth().onAuthStateChanged(async (user) => {
    const mainApp = document.getElementById('main-app');
    const authScreen = document.getElementById('auth-screen');
    
    if (user) {
      // --- USUARIO ESTÁ LOGUEADO ---
      currentUser = user;
      
      // Obtener el determinante del usuario (PARTE CRÍTICA)
      try {
        const snapshot = await firebase.database().ref('usuarios/' + user.uid).once('value');
        const userData = snapshot.val();
        
        if (userData && userData.determinante) {
          // ¡ÉXITO! Tenemos el determinante
          userDeterminanteGlobal = userData.determinante;
          console.log(`✅ Usuario ${user.email} logueado. Determinante: ${userDeterminanteGlobal}`);
          
          // Ocultar login, mostrar app
          if (authScreen) authScreen.classList.add('hidden');
          if (mainApp) mainApp.classList.remove('hidden');
          
          // Actualizar UI (si existe la función en ui.js)
          if (typeof updateHeaderUserInfo === 'function') {
            updateHeaderUserInfo(userData.nombre || user.email, userDeterminanteGlobal, userData.nombreTienda || '');
          }
          
          // Iniciar los demás módulos que dependen del determinante
          if (typeof initInventoryModule === 'function') initInventoryModule(userDeterminanteGlobal);
          if (typeof initRefillModule === 'function') initRefillModule(userDeterminanteGlobal);
          if (typeof initAuditModule === 'function') initAuditModule(userDeterminanteGlobal);
          
        } else {
          // Caso raro: usuario en Auth pero sin perfil en RTDB
          console.error('❌ Usuario logueado pero sin perfil o determinante en la base de datos.');
          showToast('Error: Perfil de usuario incompleto. Contacta a soporte.', 'error');
          handleLogout();
        }
        
      } catch (error) {
        console.error('❌ Error fatal al leer el perfil del usuario:', error);
        showToast('Error crítico al leer perfil', 'error');
        handleLogout();
      }

    } else {
      // --- USUARIO NO ESTÁ LOGUEADO ---
      currentUser = null;
      userDeterminanteGlobal = null;
      
      console.log('🔒 Usuario deslogueado. Mostrando pantalla de autenticación.');
      
      // Ocultar app, mostrar login
      if (authScreen) authScreen.classList.remove('hidden');
      if (mainApp) mainApp.classList.add('hidden');
    }
  });
}

// ============================================================\
// LOGOUT
// ============================================================
async function handleLogout() {
  console.log('Cerrando sesión...');
  await firebase.auth().signOut();
  // onAuthStateChanged se encargará de limpiar la UI
  showToast('Sesión cerrada', 'info');
  location.reload(); // Forzar recarga para limpiar estado
}

// ============================================================\
// RECUPERACIÓN DE CONTRASEÑA
// ============================================================
async function handleForgotPassword(event) {
  event.preventDefault();
  const email = document.getElementById('forgot-email').value;
  if (!email) {
    showToast('Escribe tu correo electrónico', 'warning');
    return;
  }
  showToast('Procesando...', 'info');
  try {
    await firebase.auth().sendPasswordResetEmail(email);
    showToast('✅ Revisa tu correo para cambiar la contraseña', 'success');
    // Vuelve a mostrar el login
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('forgot-password-form').classList.add('hidden');
  } catch (error) {
    console.error('❌ Error al enviar correo de recuperación:', error);
    showToast('❌ Error: No se pudo enviar el correo', 'error');
  }
}

// ============================================================\
// MANEJADORES DE EVENTOS
// ============================================================
function initAuthForms() {
  console.log('🎨 Configurando formularios de autenticación...');
  
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const forgotForm = document.getElementById('forgot-password-form');
  const logoutButton = document.getElementById('logout-btn');

  if (loginForm) loginForm.addEventListener('submit', handleLogin);
  if (registerForm) registerForm.addEventListener('submit', handleRegister);
  if (forgotForm) forgotForm.addEventListener('submit', handleForgotPassword);
  if (logoutButton) logoutButton.addEventListener('click', handleLogout);

  // --- Lógica para cambiar entre vistas de Auth ---
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
  
  console.log('✅ Formularios de autenticación listos.');
}

// ============================================================\
// INICIALIZACIÓN DEL MÓDULO
// ============================================================
// Esperar a que Firebase esté listo
document.addEventListener('firebaseReady', () => {
  console.log('🔥 Firebase listo. Iniciando autenticación...');
  initAuthListener();
  initAuthForms();
});

// Fallback por si acaso
setTimeout(() => {
  if (typeof firebase !== 'undefined' && !currentUser) {
    console.warn('Iniciando autenticación (fallback)');
    initAuthListener();
    initAuthForms();
  }
}, 1000);