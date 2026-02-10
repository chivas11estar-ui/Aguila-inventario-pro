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
        mostrarEstadisticas: true,
        darkMode: false // Default to light mode
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
// GESTIÓN DE TEMA (CLARO/OSCURO)
// ============================================================
function applyTheme() {
    const htmlElement = document.documentElement;
    if (window.PROFILE_STATE.preferences.darkMode) {
        htmlElement.classList.add('dark');
    } else {
        htmlElement.classList.remove('dark');
    }
}

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
        applyTheme(); // Apply theme based on loaded preferences

        window.PROFILE_STATE.isLoading = false;
        console.log('✅ Perfil cargado en estado global');

        // Renderizar UI principal
        if (typeof window.renderProfileUI === 'function') {
            window.renderProfileUI();
        }

        // Cargar datos secundarios
        loadDailyActivity();
        window.fetchWeatherData();

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
        applyTheme(); // Apply theme immediately after saving preference

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
window.refreshWeather = window.fetchWeatherData;
window.refreshActivity = loadDailyActivity;
window.updateUserData = updateUserData;
window.saveUserPreferences = saveUserPreferences;

// Inicializar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProfileModule);
} else {
    initProfileModule();
    applyTheme(); // Apply theme immediately if DOM is already loaded
}

console.log('✅ profile.js (Logic) cargado - Integrado con profile-ui.js');