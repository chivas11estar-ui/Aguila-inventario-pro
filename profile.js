// ============================================================
// Águila Inventario Pro - Módulo: profile.js
// Lógica de Negocio y Gestión de Estado
// Modificado para integrar con profile-ui.js
// ============================================================

// Inicializar Estado Global
window.PROFILE_STATE = {
    userData: null,
    preferences: {
        fraseMotivacional: '¡Hoy será un gran día! 🦅',
        avatar: '👤',
        mostrarClima: true,
        mostrarEstadisticas: true
    },
    todayActivity: {
        auditorias: 0,
        productosAuditados: 0,
        rellenos: 0,
        cajasMovidas: 0
    },
    weather: null,
    isLoading: false
};

// ============================================================
// INICIALIZACIÓN
// ============================================================
async function initProfileModule() {
    console.log('👤 Inicializando módulo de perfil (Logic)...');

    // Escuchar cambios de autenticación
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            console.log('✅ Usuario detectado, iniciando carga de perfil...');
            await loadUserProfile();
        } else {
            window.PROFILE_STATE.userData = null;
        }
    });
}

// ============================================================
// CARGAR PERFIL DE USUARIO
// ============================================================
async function loadUserProfile() {
    const userId = firebase.auth().currentUser?.uid;
    if (!userId) return;

    window.PROFILE_STATE.isLoading = true;
    if (typeof window.renderProfileUI === 'function') window.renderProfileUI();

    try {
        const snapshot = await firebase.database().ref(`usuarios/${userId}`).once('value');
        const data = snapshot.val();

        if (!data) {
            console.warn('⚠️ No se encontró perfil de usuario');
            if (typeof showToast === 'function') showToast('Perfil no encontrado', 'warning');
            window.PROFILE_STATE.isLoading = false;
            if (typeof window.renderProfileUI === 'function') window.renderProfileUI();
            return;
        }

        // Actualizar estado
        window.PROFILE_STATE.userData = data;

        // Cargar preferencias si existen (o usar defaults)
        if (data.preferences) {
            window.PROFILE_STATE.preferences = { ...window.PROFILE_STATE.preferences, ...data.preferences };
        }

        window.PROFILE_STATE.isLoading = false;
        console.log('✅ Perfil cargado en estado global');

        // Renderizar UI principal
        if (typeof window.renderProfileUI === 'function') {
            window.renderProfileUI();
        }

        // Cargar datos secundarios
        loadDailyActivity();
        loadWeatherData();

    } catch (error) {
        console.error('❌ Error cargando perfil:', error);
        window.PROFILE_STATE.isLoading = false;
        if (typeof window.renderProfileUI === 'function') window.renderProfileUI();
    }
}

// ============================================================
// CARGAR ACTIVIDAD DIARIA
// ============================================================
async function loadDailyActivity() {
    const determinante = window.PROFILE_STATE.userData?.determinante;
    if (!determinante) return;

    const today = new Date().toISOString().split('T')[0];

    try {
        const [auditsSnap, movsSnap] = await Promise.all([
            firebase.database().ref(`auditorias/${determinante}`).orderByChild('fecha').startAt(today).once('value'),
            firebase.database().ref(`movimientos/${determinante}`).orderByChild('fecha').startAt(today).once('value')
        ]);

        const audits = auditsSnap.val() || {};
        const movs = movsSnap.val() || {};

        // Calcular totales
        let totalProductosAuditados = 0;
        Object.values(audits).forEach(a => totalProductosAuditados += (a.productos ? Object.keys(a.productos).length : 0));

        let totalCajasMovidas = 0;
        Object.values(movs).forEach(m => totalCajasMovidas += (m.cajas || 0));

        window.PROFILE_STATE.todayActivity = {
            auditorias: Object.keys(audits).length,
            productosAuditados: totalProductosAuditados,
            rellenos: Object.keys(movs).length,
            cajasMovidas: totalCajasMovidas
        };

        if (typeof window.updateActivityUI === 'function') {
            window.updateActivityUI();
        }

    } catch (e) {
        console.error("Error cargando actividad:", e);
    }
}

// ============================================================
// CARGAR CLIMA (Lógica Mejorada)
// ============================================================
async function loadWeatherData() {
    let lat = 19.4326, lon = -99.1332; // CDMX Default
    let cityName = "Detectando...";

    try {
        if (navigator.geolocation) {
            const pos = await new Promise((res, rej) =>
                navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 }));
            lat = pos.coords.latitude;
            lon = pos.coords.longitude;

            try {
                const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`);
                const geoData = await geoRes.json();
                cityName = geoData.address.city || geoData.address.town || "Ubicación Actual";
            } catch (e) { cityName = "Tu Tienda"; }
        }
    } catch (e) { cityName = "Ubicación Aprox"; }

    try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
        const data = await res.json();
        const w = data.current_weather;

        const weatherStates = {
            0: { icon: "☀️", condition: "Despejado" },
            1: { icon: "🌤️", condition: "Mayormente despejado" },
            2: { icon: "⛅", condition: "Parcialmente nublado" },
            3: { icon: "☁️", condition: "Nublado" },
            45: { icon: "🌫️", condition: "Niebla" },
            51: { icon: "🌧️", condition: "Llovizna" },
            61: { icon: "🌧️", condition: "Lluvia" },
            71: { icon: "❄️", condition: "Nieve" },
            95: { icon: "⛈️", condition: "Tormenta" }
        };

        const info = weatherStates[w.weathercode] || { icon: "qm", condition: "Desconocido" };

        window.PROFILE_STATE.weather = {
            temperature: Math.round(w.temperature),
            windSpeed: Math.round(w.windspeed),
            humidity: 60, // API simple no da humedad, ponemos default
            condition: info.condition,
            icon: info.icon,
            city: cityName,
            error: false
        };

        if (typeof window.updateWeatherUI === 'function') {
            window.updateWeatherUI();
        }

    } catch (e) {
        console.error('Error clima:', e);
        window.PROFILE_STATE.weather = { error: true };
        if (typeof window.updateWeatherUI === 'function') {
            window.updateWeatherUI();
        }
    }
}

// ============================================================
// FUNCIONES PÚBLICAS PARA ACTUALIZAR DATOS
// ============================================================
async function updateUserData(newData) {
    const userId = firebase.auth().currentUser?.uid;
    if (!userId) return false;

    try {
        await firebase.database().ref(`usuarios/${userId}`).update(newData);

        // Actualizar estado local
        window.PROFILE_STATE.userData = { ...window.PROFILE_STATE.userData, ...newData };

        if (typeof showToast === 'function') showToast('✅ Datos actualizados', 'success');
        return true;
    } catch (error) {
        console.error('Error actualizando usuario:', error);
        if (typeof showToast === 'function') showToast('Error al actualizar', 'error');
        return false;
    }
}

async function saveUserPreferences(newPrefs) {
    const userId = firebase.auth().currentUser?.uid;
    if (!userId) return false;

    try {
        await firebase.database().ref(`usuarios/${userId}/preferences`).update(newPrefs);

        // Actualizar estado local
        window.PROFILE_STATE.preferences = { ...window.PROFILE_STATE.preferences, ...newPrefs };

        if (typeof showToast === 'function') showToast('✅ Preferencias guardadas', 'success');
        return true;
    } catch (error) {
        console.error('Error guardando preferencias:', error);
        return false;
    }
}

// ============================================================
// EXPORTAR FUNCIONES
// ============================================================
window.loadUserProfile = loadUserProfile;
window.refreshWeather = loadWeatherData;
window.refreshActivity = loadDailyActivity;
window.updateUserData = updateUserData;
window.saveUserPreferences = saveUserPreferences;

// Inicializar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProfileModule);
} else {
    initProfileModule();
}

console.log('✅ profile.js (Logic) cargado - Integrado con profile-ui.js');