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
                navigator.geolocation.getCurrentPosition(res, rej, {
                    timeout: 15000, // Aumentado a 15s para móviles
                    maximumAge: 600000, // Cache de 10 minutos
                    enableHighAccuracy: false // Mayor velocidad, menos batería
                }));
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


    let data = null;
    try {
        const res = await fetch(`https://wttr.in/${lat},${lon}?format=j1`);
        if (res.ok) data = await res.json();
    } catch(e) { data = null; }

    if (!data) {
        window.PROFILE_STATE.weather = { error: true, city: cityName };
        if (typeof window.renderProfileUI === 'function') window.renderProfileUI();
        return;
    }

    const current = data.current_condition?.[0];
    if (!current) {
        window.PROFILE_STATE.weather = { error: true, city: cityName };
        if (typeof window.renderProfileUI === 'function') window.renderProfileUI();
        return;
    }

    window.PROFILE_STATE.weather = {
        temperature: parseInt(current.temp_C),
        windSpeed: parseInt(current.windspeedKmph),
        humidity: parseInt(current.humidity),
        condition: current.weatherDesc?.[0]?.value || 'Despejado',
        icon: 'wb_sunny',
        city: cityName,
        error: false
    };

    if (typeof window.renderProfileUI === 'function') window.renderProfileUI();
    return;
};

console.log('✅ weather.js (Módulo Clima) cargado correctamente');