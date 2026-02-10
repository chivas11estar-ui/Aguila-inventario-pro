// ============================================================
// Águila Inventario Pro - Módulo: weather.js
// Lógica para obtener datos de clima y geolocalización
// ============================================================

window.fetchWeatherData = async function() {
    let lat = 19.4326, lon = -99.1332; // CDMX Default
    let cityName = "Detectando...";

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
                console.warn('⚠️ Error al obtener nombre de la ciudad:', e);
                cityName = "Tu Tienda";
            }
        } else {
            console.warn('⚠️ Geolocalización no soportada por el navegador.');
        }
    } catch (e) {
        console.error('❌ Error al obtener la ubicación:', e);
        cityName = "Ubicación Aprox";
    }

    // Obtener datos del clima
    try {
        // Usamos Open-Meteo
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,relative_humidity_2m,windspeed_10m`);
        const data = await res.json();
        const w = data.current_weather;
        const h = data.hourly;
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

        if (typeof window.updateWeatherUI === 'function') {
            window.updateWeatherUI();
        }

    } catch (e) {
        console.error('❌ Error al obtener datos del clima de Open-Meteo:', e);
        window.PROFILE_STATE.weather = { error: true };
        if (typeof window.updateWeatherUI === 'function') {
            window.updateWeatherUI();
        }
    }
};

console.log('✅ weather.js (Módulo Clima) cargado correctamente');