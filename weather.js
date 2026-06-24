// ============================================================
// Águila Inventario Pro - Módulo: weather.js
// Lógica para obtener datos de clima y geolocalización
// Copyright © 2025 José A. G. Betancourt
// ============================================================

function normalizeWeatherText(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function getWeatherPresentation(conditionText) {
    const condition = normalizeWeatherText(conditionText);

    if (condition.includes('thunder') || condition.includes('storm') || condition.includes('torment')) {
        return { label: 'Tormenta', icon: 'thunderstorm' };
    }
    if (condition.includes('rain') || condition.includes('drizzle') || condition.includes('shower') || condition.includes('lluv') || condition.includes('lloviz')) {
        return { label: 'Lluvia', icon: 'rainy' };
    }
    if (condition.includes('snow') || condition.includes('sleet') || condition.includes('nieve')) {
        return { label: 'Nieve', icon: 'ac_unit' };
    }
    if (condition.includes('fog') || condition.includes('mist') || condition.includes('haze') || condition.includes('niebla') || condition.includes('bruma')) {
        return { label: 'Neblina', icon: 'foggy' };
    }
    if (condition.includes('overcast')) {
        return { label: 'Nublado', icon: 'cloud' };
    }
    if (condition.includes('partly') || condition.includes('partial') || condition.includes('parcial')) {
        return { label: 'Parcialmente nublado', icon: 'partly_cloudy_day' };
    }
    if (condition.includes('cloud') || condition.includes('nubl')) {
        return { label: 'Nublado', icon: 'cloud' };
    }
    if (condition.includes('clear') || condition.includes('sunny') || condition.includes('despej') || condition.includes('solead')) {
        return { label: 'Soleado', icon: 'wb_sunny' };
    }

    return { label: 'Clima estable', icon: 'wb_sunny' };
}

window.fetchWeatherData = async function (requestPreciseLocation = false) {
    let lat = 19.4326, lon = -99.1332; // CDMX Default
    let cityName = "Detectando...";
    let geolocationError = false;

    // Obtener la ubicación actual si el navegador lo permite
    try {
        if (requestPreciseLocation && navigator.geolocation) {
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
        } else if (requestPreciseLocation) {
            geolocationError = true;
        } else {
            cityName = 'Ciudad de México';
        }
    } catch (e) {
        console.warn('Ubicación no disponible; se usará la ciudad predeterminada.');
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
        const res = await fetch(`https://wttr.in/${lat},${lon}?format=j1&lang=es`);
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

    const conditionText = current.lang_es?.[0]?.value || current.weatherDesc?.[0]?.value || 'Despejado';
    const weatherInfo = getWeatherPresentation(conditionText);

    window.PROFILE_STATE.weather = {
        temperature: parseInt(current.temp_C),
        windSpeed: parseInt(current.windspeedKmph),
        humidity: parseInt(current.humidity),
        condition: weatherInfo.label,
        icon: weatherInfo.icon,
        city: cityName,
        error: false
    };

    if (typeof window.renderProfileUI === 'function') window.renderProfileUI();
    return;
};

console.log('✅ weather.js (Módulo Clima) cargado correctamente');

