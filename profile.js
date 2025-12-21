// ============================================================
// Águila Inventario Pro - Módulo: profile.js
// Fase 2.2 - Perfil del Promotor
// LÓGICA PURA - Sin HTML
// Copyright © 2025 José A. G. Betancourt
// ============================================================

// ============================================================
// ESTADO GLOBAL DEL PERFIL (Fuente única de verdad)
// ============================================================
window.PROFILE_STATE = {
  userData: null,           // Datos del usuario desde Firebase
  preferences: {},          // Preferencias editables
  todayActivity: {          // Actividad del día
    auditorias: 0,
    rellenos: 0,
    productosAuditados: 0,
    cajasMovidas: 0
  },
  weather: null,            // Datos del clima
  isLoading: false,
  userLocation: null        // Coordenadas para clima
};

// ============================================================
// OBTENER DATOS DEL USUARIO
// ============================================================
async function loadUserProfile() {
  console.log('👤 Cargando perfil del usuario...');
  
  const user = firebase.auth().currentUser;
  if (!user) {
    console.error('❌ No hay usuario autenticado');
    return null;
  }

  window.PROFILE_STATE.isLoading = true;

  try {
    const snapshot = await firebase.database()
      .ref('usuarios/' + user.uid)
      .once('value');
    
    const userData = snapshot.val();
    
    if (userData) {
      window.PROFILE_STATE.userData = {
        uid: user.uid,
        email: userData.email,
        nombrePromotor: userData.nombrePromotor,
        nombreTienda: userData.nombreTienda,
        determinante: userData.determinante,
        fechaRegistro: userData.fechaRegistro,
        ...userData
      };

      // Cargar preferencias si existen
      if (userData.preferencias) {
        window.PROFILE_STATE.preferences = userData.preferencias;
      } else {
        // Preferencias por defecto
        window.PROFILE_STATE.preferences = {
          fraseMotivacional: '¡Hoy será un gran día! 🦅',
          mostrarClima: true,
          mostrarEstadisticas: true,
          avatar: null
        };
      }

      console.log('✅ Perfil cargado:', userData.nombrePromotor);
      
      // Cargar actividad del día
      await loadTodayActivity();
      
      // Cargar clima
      await loadWeatherData();

      // Renderizar
      if (typeof window.renderProfileUI === 'function') {
        window.renderProfileUI();
      }

      return window.PROFILE_STATE.userData;
    } else {
      console.error('❌ No se encontraron datos del usuario');
      return null;
    }
  } catch (error) {
    console.error('❌ Error al cargar perfil:', error);
    if (typeof showToast === 'function') {
      showToast('Error al cargar perfil: ' + error.message, 'error');
    }
    return null;
  } finally {
    window.PROFILE_STATE.isLoading = false;
  }
}

// ============================================================
// GUARDAR PREFERENCIAS DEL USUARIO
// ============================================================
async function saveUserPreferences(newPreferences) {
  console.log('💾 Guardando preferencias...');

  const user = firebase.auth().currentUser;
  if (!user) {
    console.error('❌ No hay usuario autenticado');
    return false;
  }

  try {
    // Actualizar estado local
    window.PROFILE_STATE.preferences = {
      ...window.PROFILE_STATE.preferences,
      ...newPreferences
    };

    // Guardar en Firebase
    await firebase.database()
      .ref('usuarios/' + user.uid + '/preferencias')
      .set(window.PROFILE_STATE.preferences);

    console.log('✅ Preferencias guardadas:', window.PROFILE_STATE.preferences);

    if (typeof showToast === 'function') {
      showToast('✅ Preferencias guardadas correctamente', 'success');
    }

    return true;
  } catch (error) {
    console.error('❌ Error al guardar preferencias:', error);
    if (typeof showToast === 'function') {
      showToast('Error al guardar: ' + error.message, 'error');
    }
    return false;
  }
}

// ============================================================
// ACTUALIZAR DATOS DEL USUARIO
// ============================================================
async function updateUserData(updates) {
  console.log('💾 Actualizando datos del usuario...');

  const user = firebase.auth().currentUser;
  if (!user) {
    console.error('❌ No hay usuario autenticado');
    return false;
  }

  try {
    // Campos permitidos para actualizar
    const allowedFields = ['nombrePromotor', 'nombreTienda'];
    const validUpdates = {};

    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        validUpdates[key] = updates[key];
      }
    });

    if (Object.keys(validUpdates).length === 0) {
      console.warn('⚠️ No hay campos válidos para actualizar');
      return false;
    }

    // Actualizar en Firebase
    await firebase.database()
      .ref('usuarios/' + user.uid)
      .update(validUpdates);

    // Actualizar estado local
    window.PROFILE_STATE.userData = {
      ...window.PROFILE_STATE.userData,
      ...validUpdates
    };

    console.log('✅ Datos actualizados:', validUpdates);

    if (typeof showToast === 'function') {
      showToast('✅ Datos actualizados correctamente', 'success');
    }

    return true;
  } catch (error) {
    console.error('❌ Error al actualizar datos:', error);
    if (typeof showToast === 'function') {
      showToast('Error al actualizar: ' + error.message, 'error');
    }
    return false;
  }
}

// ============================================================
// CARGAR ACTIVIDAD DEL DÍA
// ============================================================
async function loadTodayActivity() {
  console.log('📊 Cargando actividad del día...');

  const determinante = window.PROFILE_STATE.userData?.determinante;
  if (!determinante) {
    console.warn('⚠️ No hay determinante disponible');
    return;
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    // Cargar auditorías del día
    const auditSnapshot = await firebase.database()
      .ref('auditorias/' + determinante)
      .orderByChild('fecha')
      .startAt(todayISO)
      .once('value');

    let auditCount = 0;
    let productosAuditados = 0;

    if (auditSnapshot.exists()) {
      const audits = auditSnapshot.val();
      auditCount = Object.keys(audits).length;
      
      // Contar productos únicos
      const productosUnicos = new Set();
      Object.values(audits).forEach(audit => {
        if (audit.productoId) {
          productosUnicos.add(audit.productoId);
        }
      });
      productosAuditados = productosUnicos.size;
    }

    // Cargar movimientos (rellenos) del día
    const movSnapshot = await firebase.database()
      .ref('movimientos/' + determinante)
      .orderByChild('fecha')
      .startAt(todayISO)
      .once('value');

    let rellenosCount = 0;
    let cajasMovidas = 0;

    if (movSnapshot.exists()) {
      const movements = movSnapshot.val();
      Object.values(movements).forEach(mov => {
        if (mov.tipo === 'relleno') {
          rellenosCount++;
          cajasMovidas += mov.cajasMovidas || 0;
        }
      });
    }

    // Actualizar estado
    window.PROFILE_STATE.todayActivity = {
      auditorias: auditCount,
      rellenos: rellenosCount,
      productosAuditados: productosAuditados,
      cajasMovidas: cajasMovidas
    };

    console.log('✅ Actividad del día:', window.PROFILE_STATE.todayActivity);

  } catch (error) {
    console.error('❌ Error al cargar actividad:', error);
  }
}

// ============================================================
// OBTENER UBICACIÓN DEL USUARIO
// ============================================================
async function getUserLocation() {
  console.log('📍 Obteniendo ubicación del usuario...');

  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn('⚠️ Geolocalización no disponible');
      // Ubicación por defecto (Zamora de Hidalgo, Michoacán)
      resolve({ latitude: 20.0, longitude: -102.3 });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        console.log('✅ Ubicación obtenida:', location);
        resolve(location);
      },
      (error) => {
        console.warn('⚠️ Error obteniendo ubicación:', error.message);
        // Ubicación por defecto (Zamora de Hidalgo, Michoacán)
        resolve({ latitude: 20.0, longitude: -102.3 });
      },
      {
        timeout: 5000,
        maximumAge: 300000 // 5 minutos
      }
    );
  });
}

// ============================================================
// CARGAR DATOS DEL CLIMA (OPEN-METEO API)
// ============================================================
async function loadWeatherData() {
  console.log('☁️ Cargando datos del clima...');

  // Verificar si el usuario quiere ver el clima
  if (window.PROFILE_STATE.preferences?.mostrarClima === false) {
    console.log('⚠️ Usuario desactivó mostrar clima');
    return;
  }

  try {
    // Obtener ubicación
    const location = await getUserLocation();
    window.PROFILE_STATE.userLocation = location;

    // Construir URL de Open-Meteo API
    const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`;

    console.log('🌐 Llamando a Open-Meteo API...');

    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error('Error en respuesta de API: ' + response.status);
    }

    const data = await response.json();
    
    // Procesar datos del clima
    const weatherData = {
      temperature: Math.round(data.current.temperature_2m),
      humidity: data.current.relative_humidity_2m,
      windSpeed: data.current.wind_speed_10m,
      weatherCode: data.current.weather_code,
      condition: getWeatherCondition(data.current.weather_code),
      icon: getWeatherIcon(data.current.weather_code),
      timestamp: new Date().toISOString()
    };

    window.PROFILE_STATE.weather = weatherData;

    console.log('✅ Clima cargado:', weatherData);

    // Re-renderizar UI si está visible
    if (typeof window.updateWeatherUI === 'function') {
      window.updateWeatherUI();
    }

  } catch (error) {
    console.error('❌ Error al cargar clima:', error);
    window.PROFILE_STATE.weather = {
      error: true,
      message: 'No disponible'
    };
  }
}

// ============================================================
// INTERPRETAR CÓDIGO DE CLIMA (WMO)
// ============================================================
function getWeatherCondition(code) {
  const conditions = {
    0: 'Despejado',
    1: 'Mayormente despejado',
    2: 'Parcialmente nublado',
    3: 'Nublado',
    45: 'Neblina',
    48: 'Niebla',
    51: 'Llovizna ligera',
    53: 'Llovizna moderada',
    55: 'Llovizna intensa',
    61: 'Lluvia ligera',
    63: 'Lluvia moderada',
    65: 'Lluvia intensa',
    71: 'Nevada ligera',
    73: 'Nevada moderada',
    75: 'Nevada intensa',
    80: 'Chubascos ligeros',
    81: 'Chubascos moderados',
    82: 'Chubascos intensos',
    95: 'Tormenta',
    96: 'Tormenta con granizo',
    99: 'Tormenta severa'
  };

  return conditions[code] || 'Desconocido';
}

// ============================================================
// OBTENER ÍCONO DEL CLIMA
// ============================================================
function getWeatherIcon(code) {
  if (code === 0 || code === 1) return '☀️';
  if (code === 2 || code === 3) return '⛅';
  if (code === 45 || code === 48) return '🌫️';
  if (code >= 51 && code <= 55) return '🌦️';
  if (code >= 61 && code <= 65) return '🌧️';
  if (code >= 71 && code <= 75) return '❄️';
  if (code >= 80 && code <= 82) return '🌧️';
  if (code >= 95) return '⛈️';
  return '🌤️';
}

// ============================================================
// REFRESCAR CLIMA (MANUAL)
// ============================================================
async function refreshWeather() {
  console.log('🔄 Refrescando clima...');

  if (typeof showToast === 'function') {
    showToast('Actualizando clima...', 'info');
  }

  await loadWeatherData();

  if (typeof window.renderProfileUI === 'function') {
    window.renderProfileUI();
  }
}

// ============================================================
// REFRESCAR ACTIVIDAD (MANUAL)
// ============================================================
async function refreshActivity() {
  console.log('🔄 Refrescando actividad...');

  if (typeof showToast === 'function') {
    showToast('Actualizando estadísticas...', 'info');
  }

  await loadTodayActivity();

  if (typeof window.updateActivityUI === 'function') {
    window.updateActivityUI();
  }
}

// ============================================================
// INICIALIZACIÓN
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('👤 Inicializando módulo de perfil (lógica)...');

  // Cargar perfil cuando el usuario esté autenticado
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      console.log('✅ Usuario autenticado, cargando perfil...');
      
      // Solo cargar si estamos en la pestaña de perfil o sistema
      const activeTab = document.querySelector('.tab-content.active');
      if (activeTab && (activeTab.id === 'tab-system' || activeTab.id === 'tab-profile')) {
        loadUserProfile();
      }
    } else {
      console.log('⏳ Esperando autenticación...');
    }
  });
});

// ============================================================
// EXPONER FUNCIONES PÚBLICAS
// ============================================================
window.loadUserProfile = loadUserProfile;
window.saveUserPreferences = saveUserPreferences;
window.updateUserData = updateUserData;
window.loadTodayActivity = loadTodayActivity;
window.loadWeatherData = loadWeatherData;
window.refreshWeather = refreshWeather;
window.refreshActivity = refreshActivity;
window.getUserLocation = getUserLocation;

console.log('✅ profile.js (Fase 2.2 - Lógica Pura) cargado correctamente');