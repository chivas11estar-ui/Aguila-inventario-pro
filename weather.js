// ============================================================
// Aguila Inventario Pro - Modulo: weather.js
// Clima por coordenadas con Open-Meteo (sin API key)
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

function getOpenMeteoPresentation(weatherCode, isDay) {
    const code = Number(weatherCode);
    const dayIcon = isDay ? 'wb_sunny' : 'dark_mode';

    if (code === 0) return { label: 'Despejado', icon: dayIcon };
    if ([1, 2].includes(code)) return { label: 'Parcialmente nublado', icon: isDay ? 'partly_cloudy_day' : 'partly_cloudy_night' };
    if (code === 3) return { label: 'Nublado', icon: 'cloud' };
    if ([45, 48].includes(code)) return { label: 'Neblina', icon: 'foggy' };
    if ([51, 53, 55, 56, 57].includes(code)) return { label: 'Llovizna', icon: 'rainy' };
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { label: 'Lluvia', icon: 'rainy' };
    if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: 'Nieve', icon: 'ac_unit' };
    if ([95, 96, 99].includes(code)) return { label: 'Tormenta', icon: 'thunderstorm' };

    return { label: 'Clima estable', icon: dayIcon };
}

function formatWeatherUpdateTime(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

window.fetchWeatherData = async function () {
    let lat = 19.4326;
    let lon = -99.1332;
    let cityName = 'Detectando...';
    let usedFallbackLocation = false;

    try {
        if (!navigator.geolocation) {
            usedFallbackLocation = true;
            cityName = 'CDMX aproximado';
        } else {
            const pos = await new Promise((res, rej) =>
                navigator.geolocation.getCurrentPosition(res, rej, {
                    timeout: 15000,
                    maximumAge: 300000,
                    enableHighAccuracy: true
                })
            );
            lat = pos.coords.latitude;
            lon = pos.coords.longitude;

            try {
                const geoUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=es`;
                const geoRes = await fetch(geoUrl);
                const geoData = await geoRes.json();
                cityName = geoData.city || geoData.locality || geoData.principalSubdivision || 'Ubicacion actual';
            } catch (e) {
                console.warn('Error al obtener nombre de la ciudad:', e);
                cityName = 'Ubicacion actual';
            }
        }
    } catch (e) {
        console.warn('No se pudo obtener ubicacion precisa para clima:', e);
        usedFallbackLocation = true;
        cityName = e.code === e.PERMISSION_DENIED ? 'Permiso de ubicacion denegado' : 'CDMX aproximado';
    }

    try {
        const params = new URLSearchParams({
            latitude: String(lat),
            longitude: String(lon),
            current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,weather_code,cloud_cover,wind_speed_10m',
            timezone: 'auto',
            forecast_days: '1'
        });
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
        if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
        const data = await res.json();
        const current = data.current;
        if (!current) throw new Error('Open-Meteo sin datos actuales');

        const isDay = current.is_day === 1;
        const weatherInfo = getOpenMeteoPresentation(current.weather_code, isDay);
        const updatedLabel = formatWeatherUpdateTime(current.time);

        window.PROFILE_STATE.weather = {
            temperature: Math.round(Number(current.temperature_2m)),
            apparentTemperature: Math.round(Number(current.apparent_temperature)),
            windSpeed: Math.round(Number(current.wind_speed_10m)),
            humidity: Math.round(Number(current.relative_humidity_2m)),
            precipitation: Number(current.precipitation || current.rain || current.showers || 0),
            cloudCover: Math.round(Number(current.cloud_cover || 0)),
            weatherCode: current.weather_code,
            isDay,
            condition: weatherInfo.label,
            icon: weatherInfo.icon,
            city: cityName,
            source: 'Open-Meteo',
            updatedAt: updatedLabel,
            usedFallbackLocation,
            error: false
        };
    } catch (error) {
        console.error('Error al obtener clima Open-Meteo:', error);
        window.PROFILE_STATE.weather = {
            error: true,
            city: cityName,
            source: 'Open-Meteo',
            usedFallbackLocation,
            message: 'No se pudo cargar el clima actual.'
        };
    }

    if (typeof window.renderProfileUI === 'function') window.renderProfileUI();
};

console.log('weather.js (Open-Meteo) cargado correctamente');