// ============================================================
// Aguila Inventario Pro - Modulo: login.js
// Responsabilidad: autenticacion con determinante y sesion local
// ============================================================

'use strict';

const AGUILA_SESSION_KEY = 'aguila_auth_session';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DETERMINANTE_REGEX = /^[A-Z0-9]{3,20}$/i;

function getFirebaseAuth() {
  if (typeof firebase === 'undefined' || !firebase.auth) {
    throw new Error('FIREBASE_AUTH_UNAVAILABLE');
  }

  return firebase.auth();
}

function getFirebaseDatabase() {
  if (typeof firebase === 'undefined' || !firebase.database) {
    throw new Error('FIREBASE_DATABASE_UNAVAILABLE');
  }

  return firebase.database();
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeDeterminante(determinante) {
  return String(determinante || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '');
}

function getProfileDeterminantes(profile) {
  return [
    profile?.determinante,
    profile?.determinanteTienda,
    profile?.tienda,
    profile?.storeId,
    profile?.store_id
  ]
    .map(normalizeDeterminante)
    .filter(Boolean);
}

function buildSafeUser(authUser, profile, determinante) {
  return {
    uid: authUser.uid,
    email: authUser.email,
    determinante,
    nombrePromotor: profile?.nombrePromotor || '',
    nombreTienda: profile?.nombreTienda || '',
    fechaRegistro: profile?.fechaRegistro || null
  };
}

function saveSession(user) {
  const now = Date.now();
  const session = {
    user,
    createdAt: now,
    expiresAt: now + SESSION_DURATION_MS
  };

  localStorage.setItem(AGUILA_SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(AGUILA_SESSION_KEY);
}

function getFriendlyAuthError(error) {
  const code = error?.code || error?.message || 'unknown';

  const messages = {
    'auth/invalid-email': 'El correo no tiene un formato valido.',
    'auth/user-disabled': 'Esta cuenta esta deshabilitada.',
    'auth/user-not-found': 'No encontramos una cuenta con ese correo.',
    'auth/wrong-password': 'Correo, contrasena o determinante incorrectos.',
    'auth/invalid-credential': 'Correo, contrasena o determinante incorrectos.',
    'auth/network-request-failed': 'No se pudo conectar. Revisa tu internet e intenta de nuevo.',
    FIREBASE_AUTH_UNAVAILABLE: 'El servicio de autenticacion no esta disponible.',
    FIREBASE_DATABASE_UNAVAILABLE: 'La base de datos no esta disponible.'
  };

  return messages[code] || 'No se pudo iniciar sesion. Intenta de nuevo.';
}

function logAuthError(context, error) {
  console.error('[AUTH_LOGIN]', {
    context,
    code: error?.code || error?.message || 'unknown',
    timestamp: new Date().toISOString()
  });
}

function offIfFirebaseRef(refName) {
  const ref = window[refName];

  if (ref && typeof ref.off === 'function') {
    ref.off();
    window[refName] = null;
  }
}

function removeFirebaseListeners() {
  const knownRefs = [
    'inventoryRef',
    'auditRef',
    'movimientosRef',
    'movRef',
    'productosRef',
    'userPhrasesRef'
  ];

  knownRefs.forEach(offIfFirebaseRef);

  if (window.LISTENERS_MANAGER && typeof window.LISTENERS_MANAGER.destroy === 'function') {
    window.LISTENERS_MANAGER.destroy();
  }

  if (typeof firebase !== 'undefined' && firebase.database) {
    firebase.database().ref().off();
  }
}

/**
 * Inicia sesion con correo, contrasena y determinante, validando pertenencia en Firebase RTDB.
 *
 * @param {string} email - Correo electronico del usuario.
 * @param {string} password - Contrasena del usuario, minimo 6 caracteres.
 * @param {string} determinante - Clave de tienda de 4 a 8 caracteres alfanumericos.
 * @returns {Promise<{success: boolean, user?: object, error?: string}>} Resultado seguro para UI.
 */
async function loginWithDeterminante(email, password, determinante) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedDeterminante = normalizeDeterminante(determinante);

  if (!EMAIL_REGEX.test(normalizedEmail)) {
    return { success: false, error: 'Ingresa un correo valido.' };
  }

  if (typeof password !== 'string' || password.length < 6) {
    return { success: false, error: 'La contrasena debe tener al menos 6 caracteres.' };
  }

  if (!DETERMINANTE_REGEX.test(normalizedDeterminante)) {
    return { success: false, error: 'Revisa el determinante. Usa solo letras o numeros.' };
  }

  try {
    const auth = getFirebaseAuth();
    const database = getFirebaseDatabase();
    const credential = await auth.signInWithEmailAndPassword(normalizedEmail, password);
    const authUser = credential.user;

    if (!authUser?.uid) {
      await auth.signOut();
      clearSession();
      return { success: false, error: 'No se pudo validar la cuenta. Intenta de nuevo.' };
    }

    const profileRef = database.ref(`usuarios/${authUser.uid}`);
    const snapshot = await profileRef.once('value');
    const profile = snapshot.val();
    const profileDeterminantes = getProfileDeterminantes(profile);
    const profileDeterminante = profileDeterminantes[0] || '';

    if (!profile || !profileDeterminantes.includes(normalizedDeterminante)) {
      await auth.signOut();
      clearSession();
      return { success: false, error: 'El determinante no coincide con esta cuenta.' };
    }

    const user = buildSafeUser(authUser, profile, normalizedDeterminante);
    saveSession(user);

    window.PROFILE_STATE = window.PROFILE_STATE || {};
    window.PROFILE_STATE.determinante = normalizedDeterminante;
    window.PROFILE_STATE.nombrePromotor = user.nombrePromotor;
    window.PROFILE_STATE.userData = user;

    return { success: true, user };
  } catch (error) {
    clearSession();
    logAuthError('loginWithDeterminante', error);

    return {
      success: false,
      error: getFriendlyAuthError(error)
    };
  }
}

/**
 * Cierra la sesion actual, limpia storage local y remueve listeners activos de Firebase.
 *
 * @returns {Promise<{success: boolean, error?: string}>} Resultado del cierre de sesion.
 */
async function logout() {
  try {
    clearSession();
    removeFirebaseListeners();

    window.INVENTORY_STATE = {};
    window.INVENTORY_CORE = window.INVENTORY_CORE || {};
    window.INVENTORY_CORE.determinante = null;
    window.PROFILE_STATE = {};
    window.ANALYTICS_STATE = window.ANALYTICS_STATE || {};
    window.ANALYTICS_STATE.determinante = null;

    await getFirebaseAuth().signOut();
    window.dispatchEvent(new CustomEvent('aguila:logout'));

    return { success: true };
  } catch (error) {
    logAuthError('logout', error);

    return {
      success: false,
      error: 'No se pudo cerrar sesion por completo. Intenta de nuevo.'
    };
  }
}

/**
 * Verifica si existe una sesion local vigente y limpia sesiones expiradas o corruptas.
 *
 * @returns {boolean} True cuando la sesion existe y no ha expirado.
 */
function isSessionValid() {
  try {
    const rawSession = localStorage.getItem(AGUILA_SESSION_KEY);

    if (!rawSession) {
      return false;
    }

    const session = JSON.parse(rawSession);
    const expiresAt = Number(session?.expiresAt);

    if (!expiresAt || Date.now() >= expiresAt) {
      clearSession();
      return false;
    }

    return Boolean(session?.user?.uid && session?.user?.determinante);
  } catch (error) {
    clearSession();
    logAuthError('isSessionValid', error);
    return false;
  }
}

window.loginWithDeterminante = loginWithDeterminante;
window.logout = logout;
window.isSessionValid = isSessionValid;
window.AuthLoginModule = {
  loginWithDeterminante,
  logout,
  isSessionValid
};
