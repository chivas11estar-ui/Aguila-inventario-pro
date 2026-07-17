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

function getOpenMeteoPresentation(weatherCode) {
    const code = Number(weatherCode);

    if ([95, 96, 99].includes(code)) return { label: 'Tormenta', icon: 'thunderstorm' };
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { label: 'Lluvia', icon: 'rainy' };
    if ([51, 53, 55, 56, 57].includes(code)) return { label: 'Llovizna', icon: 'rainy' };
    if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: 'Nieve', icon: 'ac_unit' };
    if ([45, 48].includes(code)) return { label: 'Neblina', icon: 'foggy' };
    if (code === 3) return { label: 'Nublado', icon: 'cloud' };
    if ([1, 2].includes(code)) return { label: 'Parcialmente nublado', icon: 'partly_cloudy_day' };
    if (code === 0) return { label: 'Soleado', icon: 'wb_sunny' };

    return { label: 'Clima estable', icon: 'wb_sunny' };
}

async function getCityName(lat, lon, fallbackName) {
    try {
        const url = 'https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=' + encodeURIComponent(lat) + '&longitude=' + encodeURIComponent(lon) + '&localityLanguage=es';
        const geoRes = await fetch(url);
        if (!geoRes.ok) throw new Error('Reverse geocode HTTP ' + geoRes.status);
        const geoData = await geoRes.json();
        return geoData.city || geoData.locality || geoData.principalSubdivision || fallbackName;
    } catch (e) {
        console.warn('⚠️ Error al obtener nombre de la ciudad (BigDataCloud):', e);
        return fallbackName;
    }
}

async function getPrecisePosition() {
    if (!navigator.geolocation) {
        throw new Error('Geolocalización no soportada por este navegador.');
    }

    return new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 15000,
            maximumAge: 600000,
            enableHighAccuracy: false
        })
    );
}

window.fetchWeatherData = async function (requestPreciseLocation = false) {
    let lat = 19.4326;
    let lon = -99.1332;
    let cityName = 'Ciudad de México';
    let locationMessage = '';

    try {
        if (requestPreciseLocation) {
            const pos = await getPrecisePosition();
            lat = pos.coords.latitude;
            lon = pos.coords.longitude;
            cityName = await getCityName(lat, lon, 'Ubicación Actual');
        }
    } catch (e) {
        const denied = e && (e.code === e.PERMISSION_DENIED || e.code === 1);
        cityName = denied ? 'Permiso de ubicación denegado' : 'Ubicación no disponible';
        locationMessage = denied
            ? 'Permiso de ubicación denegado. Se muestra clima de referencia.'
            : 'No se pudo obtener la ubicación. Se muestra clima de referencia.';
        console.warn('⚠️ Ubicación no disponible; se usará clima de referencia:', e);
    }

    try {
        const weatherUrl = new URL('https://api.open-meteo.com/v1/forecast');
        weatherUrl.searchParams.set('latitude', lat);
        weatherUrl.searchParams.set('longitude', lon);
        weatherUrl.searchParams.set('current', 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m');
        weatherUrl.searchParams.set('timezone', 'auto');

        const res = await fetch(weatherUrl.toString(), { cache: 'no-store' });
        if (!res.ok) throw new Error('Open-Meteo HTTP ' + res.status);

        const data = await res.json();
        const current = data.current;
        if (!current) throw new Error('Open-Meteo no devolvió datos actuales.');

        const weatherInfo = getOpenMeteoPresentation(current.weather_code);

        window.PROFILE_STATE.weather = {
            temperature: Math.round(Number(current.temperature_2m)),
            windSpeed: Math.round(Number(current.wind_speed_10m)),
            humidity: Math.round(Number(current.relative_humidity_2m)),
            condition: weatherInfo.label,
            icon: weatherInfo.icon,
            city: cityName,
            message: locationMessage,
            error: false
        };
    } catch (e) {
        console.error('❌ Error al cargar clima (Open-Meteo):', e);
        window.PROFILE_STATE.weather = {
            error: true,
            city: cityName,
            message: 'No se pudo cargar el clima. Revisa tu conexión e intenta refrescar.'
        };
    }

    if (typeof window.renderProfileUI === 'function') window.renderProfileUI();
};

console.log('✅ weather.js (Módulo Clima) cargado correctamente');
