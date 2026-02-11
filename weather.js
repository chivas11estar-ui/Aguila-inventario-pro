// ============================================================
// Águila Inventario Pro - Módulo: weather.js
// Lógica para obtener datos de clima y geolocalización
// Copyright © 2025 José A. G. Betancourt
// ============================================================

window.fetchWeatherData = async function () {
    let lat = 19.4326, lon = -99.1332; // CDMX Default
    let cityName = "Detectando...";
    let geolocationError = false;

    // Obtener la ubicación actual si el navegador lo permite
    try {
        if (navigator.geolocation) {
            const pos = await new Promise((res, rej) =>
                navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 }));
            lat = pos.coords.latitude;
            lon = pos.coords.longitude;

            try {
                // Usamos bigdatacloud.net para reverse geocoding
                const geoRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=es`);
                const geoData = await geoRes.json();
                cityName = geoData.city || geoData.locality || geoData.principalSubdivision || "Ubicación Actual";
            } catch (e) {
                console.warn('⚠️ Error al obtener nombre de la ciudad (BigDataCloud):', e);
                cityName = "Tu Tienda"; // Fallback name
            }
        } else {
            console.warn('⚠️ Geolocalización no soportada por el navegador.');
            geolocationError = true;
        }
    } catch (e) {
        console.error('❌ Error al obtener la ubicación (Geolocation API):', e);
        // Specifically check for permission denied errors
        if (e.code === e.PERMISSION_DENIED) {
            console.warn('❌ Permiso de geolocalización denegado por el usuario.');
            cityName = "Permiso Denegado";
        } else {
            cityName = "Ubicación Desconocida";
        }
        geolocationError = true;
    }

    // Si la geolocalización falló y no se desea usar la ubicación por defecto para el clima,
    // o si el usuario denegó explícitamente el permiso, se puede mostrar un error directamente.
    // Sin embargo, por ahora seguimos con la ubicación por defecto si no se obtuvo una precisa,
    // a menos que el error sea de denegación de permiso.
    if (geolocationError && cityName === "Permiso Denegado") {
        window.PROFILE_STATE.weather = { error: true, city: cityName, message: "Permiso de ubicación denegado." };
        if (typeof window.renderProfileUI === 'function') { // Changed from updateWeatherUI
            window.renderProfileUI(); // Changed from updateWeatherUI
        }
        return; // Exit early if permission denied
    }


    // Obtener datos del clima
    try {
        // Usamos Open-Meteo
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,relative_humidity_2m,windspeed_10m`);
        const data = await res.json();

        // Validar si la API de Open-Meteo devolvió un error (ej. coordenadas inválidas)
        if (data.error) {
            console.error('❌ Error de la API Open-Meteo:', data.reason);
            window.PROFILE_STATE.weather = { error: true, city: cityName, message: data.reason || "Error al obtener datos del clima." };
            if (typeof window.renderProfileUI === 'function') { // Changed from updateWeatherUI
                window.renderProfileUI(); // Changed from updateWeatherUI
            }
            return;
        }

        const w = data.current_weather;
        const h = data.hourly;

        // Ensure w and h are defined and contain expected properties
        if (!w || !h || !h.time || !h.relative_humidity_2m || !h.windspeed_10m) {
            console.error('❌ Datos incompletos de la API Open-Meteo.');
            window.PROFILE_STATE.weather = { error: true, city: cityName, message: "Datos del clima incompletos." };
            if (typeof window.renderProfileUI === 'function') { // Changed from updateWeatherUI
                window.renderProfileUI(); // Changed from updateWeatherUI
            }
            return;
        }

        const currentTimeIndex = h.time.findIndex(time => new Date(time).getHours() === new Date(w.time).getHours());

        const weatherStates = {
            0: { icon: "☀️", condition: "Despejado" },
            1: { icon: "🌤️", condition: "Mayormente despejado" },
            2: { icon: "⛅", condition: "Parcialmente nublado" },
            3: { icon: "☁️", condition: "Nublado" },
            45: { icon: "🌫️", condition: "Niebla" },
            48: { icon: "🌫️", condition: "Niebla escarchada" },
            51: { icon: "🌧️", condition: "Llovizna ligera" },
            53: { icon: "🌧️", condition: "Llovizna moderada" },
            55: { icon: "🌧️", condition: "Llovizna intensa" },
            56: { icon: "🌨️", condition: "Llovizna helada ligera" },
            57: { icon: "🌨️", condition: "Llovizna helada intensa" },
            61: { icon: "🌧️", condition: "Lluvia ligera" },
            63: { icon: "🌧️", condition: "Lluvia moderada" },
            65: { icon: "🌧️", condition: "Lluvia intensa" },
            66: { icon: "🌨️", condition: "Lluvia helada ligera" },
            67: { icon: "🌨️", condition: "Lluvia helada intensa" },
            71: { icon: "❄️", condition: "Nevada ligera" },
            73: { icon: "❄️", condition: "Nevada moderada" },
            75: { icon: "❄️", condition: "Nevada intensa" },
            77: { icon: "🌨️", condition: "Granizo" },
            80: { icon: "🌧️", condition: "Chubascos ligeros" },
            81: { icon: "🌧️", condition: "Chubascos moderados" },
            82: { icon: "🌧️", condition: "Chubascos violentos" },
            85: { icon: "🌨️", condition: "Chubascos de nieve ligeros" },
            86: { icon: "🌨️", condition: "Chubascos de nieve intensos" },
            95: { icon: "⛈️", condition: "Tormenta eléctrica" },
            96: { icon: "⛈️", condition: "Tormenta eléctrica con granizo ligero" },
            99: { icon: "⛈️", condition: "Tormenta eléctrica con granizo intenso" }
        };

        const info = weatherStates[w.weathercode] || { icon: "❓", condition: "Desconocido" };

        window.PROFILE_STATE.weather = {
            temperature: Math.round(w.temperature),
            windSpeed: Math.round(w.windspeed),
            humidity: h.relative_humidity_2m[currentTimeIndex] || 'N/A', // Usar humedad horaria
            condition: info.condition,
            icon: info.icon,
            city: cityName,
            error: false
        };

        if (typeof window.renderProfileUI === 'function') { // Changed from updateWeatherUI
            window.renderProfileUI(); // Changed from updateWeatherUI
        }

    } catch (e) {
        console.error('❌ Error al obtener datos del clima de Open-Meteo:', e);
        window.PROFILE_STATE.weather = { error: true, city: cityName, message: "Error de red o API." };
        if (typeof window.renderProfileUI === 'function') { // Changed from updateWeatherUI
            window.renderProfileUI(); // Changed from updateWeatherUI
        }
    }
};

console.log('✅ weather.js (Módulo Clima) cargado correctamente');