// ============================================================
// Águila Inventario Pro - Módulo: profile.js (FINAL)
// ============================================================

let userProfileData = null;
let userDeterminanteProfile = null;

// Inicialización segura
async function initProfileModule() {
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            await loadUserProfile();
        }
    });
}

async function loadUserProfile() {
    console.log('👤 Cargando perfil...');
    const userId = firebase.auth().currentUser?.uid;
    if (!userId) return;

    try {
        const snapshot = await firebase.database().ref(`usuarios/${userId}`).once('value');
        userProfileData = snapshot.val();
        
        if (!userProfileData) {
            showToast('⚠️ No se encontró perfil de usuario', 'warning');
            return;
        }

        userDeterminanteProfile = userProfileData.determinante;
        
        // Renderizar la estructura base inmediatamente
        renderProfileSkeleton();
        
        // Cargas en paralelo (no bloqueantes)
        Promise.all([
            loadDailyActivity(),
            loadWeatherData()
        ]).catch(err => console.error("Error en cargas secundarias:", err));

    } catch (error) {
        console.error('❌ Error perfil:', error);
        showToast('Error de conexión con la base de datos', 'error');
    }
}

function renderProfileSkeleton() {
    const container = document.getElementById('profile-container');
    if (!container) return;

    const frases = [
        '¡Hoy es un gran día para vender!',
        '¡Tu esfuerzo se nota en cada pasillo!',
        '¡El éxito es la suma de pequeños esfuerzos!'
    ];
    const frase = frases[Math.floor(Math.random() * frases.length)];

    container.innerHTML = `
        <div class="card" style="text-align:center; padding:25px; border-top: 5px solid var(--primary);">
            <div style="font-size:60px; margin-bottom:10px;">👤</div>
            <h2 style="margin:0; color:var(--primary);">${userProfileData.nombrePromotor || 'Promotor'}</h2>
            <p style="color:var(--muted); font-size:14px; margin-bottom:15px;">${userProfileData.email || ''}</p>
            
            <div style="background:var(--bg); padding:15px; border-radius:12px; margin-top:10px;">
                <div style="font-size:11px; color:var(--muted); text-transform:uppercase;">Tienda Asignada</div>
                <div style="font-size:16px; font-weight:700;">${userProfileData.nombreTienda || 'N/A'}</div>
                <div style="font-size:10px; color:var(--muted); opacity:0.7;">ID: ${userDeterminanteProfile || 'N/A'}</div>
            </div>

            <div style="margin-top:15px; padding:10px; background:#fff9db; border-radius:8px; border:1px dashed #fab005;">
                <span style="font-size:13px; color:#856404; font-weight:600;">💪 ${frase}</span>
            </div>
        </div>

        <div class="card">
            <h3 style="font-size:16px; margin-bottom:15px;">📊 Resumen del Día</h3>
            <div id="daily-activity" style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div style="background:var(--bg); padding:15px; border-radius:10px; text-align:center;">
                    <div id="activity-audits" style="font-size:24px; font-weight:800; color:var(--primary);">...</div>
                    <div style="font-size:11px; color:var(--muted);">Auditorías</div>
                </div>
                <div style="background:var(--bg); padding:15px; border-radius:10px; text-align:center;">
                    <div id="activity-refills" style="font-size:24px; font-weight:800; color:var(--success);">...</div>
                    <div style="font-size:11px; color:var(--muted);">Rellenos</div>
                </div>
            </div>
        </div>

        <div class="card">
            <h3 style="font-size:16px; margin-bottom:10px;">☁️ Clima Local</h3>
            <div id="weather-card" style="min-height:80px; display:flex; align-items:center; justify-content:center;">
                <div class="spinner-small"></div>
            </div>
        </div>
    `;
}

async function loadDailyActivity() {
    if (!userDeterminanteProfile) return;
    const today = new Date().toISOString().split('T')[0];
    
    try {
        const [audits, movs] = await Promise.all([
            firebase.database().ref(`auditorias/${userDeterminanteProfile}`).orderByChild('fecha').startAt(today).once('value'),
            firebase.database().ref(`movimientos/${userDeterminanteProfile}`).orderByChild('fecha').startAt(today).once('value')
        ]);

        document.getElementById('activity-audits').innerText = audits.numChildren() || 0;
        document.getElementById('activity-refills').innerText = movs.numChildren() || 0;
    } catch (e) {
        console.error("Error cargando actividad:", e);
    }
}

async function loadWeatherData() {
    const card = document.getElementById('weather-card');
    let lat = 19.4326, lon = -99.1332; // Default
    let cityName = "Ubicación no detectada";

    try {
        // 1. Obtener coordenadas
        if (navigator.geolocation) {
            const pos = await new Promise((res, rej) => 
                navigator.geolocation.getCurrentPosition(res, rej, {timeout: 5000}));
            lat = pos.coords.latitude;
            lon = pos.coords.longitude;
            
            // 2. Intentar obtener el nombre de la ciudad (Reverse Geocoding gratuito)
            try {
                const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`);
                const geoData = await geoRes.json();
                cityName = geoData.address.city || geoData.address.town || geoData.address.village || "Ciudad desconocida";
            } catch (e) { cityName = "Tu ubicación actual"; }
        }
    } catch (e) { 
        cityName = "Ciudad de México (Default)"; 
        console.warn("Usando ubicación predeterminada"); 
    }

    try {
        // 3. Obtener clima detallado
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
        const data = await res.json();
        const w = data.current_weather;
        
        // Diccionario de estados del clima
        const weatherStates = {
            0: "Despejado ☀️", 1: "Mayormente despejado 🌤️", 2: "Parcialmente nublado ⛅", 3: "Nublado ☁️",
            45: "Niebla 🌫️", 48: "Niebla escarcha 🌫️", 51: "Llovizna ligera 🌧️", 61: "Lluvia 🌧️",
            71: "Nieve ligera ❄️", 80: "Chubascos 🌦️", 95: "Tormenta eléctrica ⛈️"
        };
        const estadoCielo = weatherStates[w.weathercode] || "Desconocido 🌡️";

        if (card) {
            card.innerHTML = `
                <div style="text-align:center; width:100%; border: 1px solid #e5e7eb; padding: 15px; border-radius: 12px; background: #f8fafc;">
                    <div style="font-size:12px; color:var(--muted); font-weight:bold; text-transform:uppercase; margin-bottom:5px;">
                        📍 ${cityName}
                    </div>
                    <div style="display:flex; align-items:center; justify-content:center; gap:15px;">
                        <span style="font-size:45px;">${estadoCielo.split(' ')[1] || '🌡️'}</span>
                        <div style="text-align:left;">
                            <div style="font-size:32px; font-weight:800; color:var(--primary); line-height:1;">
                                ${Math.round(w.temperature)}°C
                            </div>
                            <div style="font-size:14px; color:#4b5563; font-weight:600;">
                                ${estadoCielo.split(' ')[0]}
                            </div>
                        </div>
                    </div>
                    <div style="margin-top:10px; padding-top:10px; border-top:1px solid #e5e7eb; display:grid; grid-template-columns:1fr 1fr; font-size:11px; color:#6b7280;">
                        <div>💨 Viento: <strong>${w.windspeed} km/h</strong></div>
                        <div>🧭 Dir: <strong>${w.winddirection}°</strong></div>
                    </div>
                </div>
            `;
        }
    } catch (e) {
        if (card) card.innerHTML = "<small style='color:var(--muted)'>Error al obtener clima detallado</small>";
    }
}


// Escuchador de pestañas
document.addEventListener('DOMContentLoaded', () => {
    initProfileModule();
    document.querySelectorAll('[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            if(btn.dataset.tab === 'profile') loadUserProfile();
        });
    });
});
