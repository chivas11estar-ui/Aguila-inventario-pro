// ============================================================
// Águila Inventario Pro - Módulo: profile-ui.js
// Fase 2.2 - Perfil del Promotor
// RENDER UI - Con nuevo diseño Tailwind
// Copyright © 2025 José A. G. Betancourt
// ============================================================

// ============================================================
// RENDERIZAR PERFIL COMPLETO
// ============================================================
function renderProfileUI() {
  const container = document.getElementById('profile-container');
  if (!container) {
    console.warn('⚠️ Elemento profile-container no encontrado en el DOM para renderizar el perfil.');
    return;
  }

  const { userData, preferences, weather, isLoading } = window.PROFILE_STATE;

  if (isLoading) {
    container.innerHTML = `
      <div class="text-center p-10 text-slate-500 dark:text-slate-400">
        <div class="material-icons-round text-6xl mb-4 animate-pulse">hourglass_empty</div>
        <p class="text-lg">Cargando perfil...</p>
      </div>
    `;
    return;
  }

  if (!userData) {
    container.innerHTML = `
      <div class="text-center p-10 text-red-500">
        <div class="material-icons-round text-6xl mb-4">error_outline</div>
        <p class="text-lg">No se pudo cargar el perfil del usuario.</p>
        <button onclick="window.loadUserProfile()" class="bg-primary hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-full mt-6 transition-all active:scale-95 shadow-lg shadow-primary/20">
          <span class="material-icons-round mr-2">refresh</span>Reintentar
        </button>
      </div>
    `;
    return;
  }

  console.log('🎨 Renderizando perfil de:', userData.nombrePromotor);

  // El diseño del header/nav de la app global ya existe en index.html y app.js
  // Solo se renderiza el contenido <main> del diseño
  const html = `
    <main class="p-5 space-y-6 max-w-md mx-auto">
      ${renderProfileHeader(userData, preferences)}
      ${preferences.mostrarClima ? renderWeatherCard(weather) : ''}
      ${renderPreferencesCard(preferences)}
      ${renderMotivationalPhrasesCard()}
      ${renderProfileFooter()}
    </main>
  `;

  container.innerHTML = html;

  // Configurar eventos para los nuevos elementos del DOM
  setupProfileEvents();

  console.log('✅ Perfil renderizado con nuevo diseño.');
}

// ============================================================
// RENDERIZAR SECCIÓN SUPERIOR DEL PERFIL
// ============================================================
function renderProfileHeader(userData, preferences) {
  const defaultAvatar = `<span class="material-icons-round text-6xl">person</span>`;
  const userAvatar = preferences.avatar ? `<span class="text-6xl">${preferences.avatar}</span>` : defaultAvatar;

  return `
    <section class="profile-gradient rounded-3xl p-8 text-center text-white ios-shadow relative overflow-hidden">
      <div class="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16"></div>
      <div class="relative z-10">
        <div class="w-24 h-24 bg-white/20 backdrop-blur-sm rounded-full mx-auto mb-4 flex items-center justify-center border-2 border-white/30">
          ${userAvatar}
        </div>
        <h2 class="text-2xl font-bold mb-1">${userData.nombrePromotor || 'Promotor'}</h2>
        <div class="space-y-2 opacity-90 text-sm font-light">
          <div class="flex items-center justify-center gap-2">
            <span class="material-icons-round text-sm">alternate_email</span>
            <span>${userData.email || 'N/A'}</span>
          </div>
          <div class="flex items-center justify-center gap-2">
            <span class="material-icons-round text-sm">store</span>
            <span>${userData.nombreTienda || 'Sin tienda asignada'}</span>
          </div>
        </div>
        <div class="mt-6 inline-flex items-center gap-2 bg-black/20 px-4 py-2 rounded-full text-xs font-medium border border-white/10">
          <span class="material-icons-round text-sm text-yellow-400">vpn_key</span>
          <span>Determinante: <span class="font-bold">${userData.determinante || 'N/A'}</span></span>
        </div>
      </div>
    </section>
  `;
}

// ============================================================
// RENDERIZAR TARJETA DE CLIMA
// ============================================================
function renderWeatherCard(weather) {
  if (!weather || weather.error) {
    return `
      <section class="bg-white dark:bg-slate-800 rounded-3xl p-6 ios-shadow border border-slate-100 dark:border-slate-700/50">
        <div class="flex justify-between items-center mb-6">
          <div class="flex items-center gap-2">
            <span class="material-icons-round text-primary">cloud_off</span>
            <h3 class="font-bold text-slate-800 dark:text-white">Clima Actual</h3>
          </div>
          <button id="refresh-weather-btn" class="bg-primary/10 dark:bg-primary/20 p-2 rounded-xl text-primary transition-transform active:scale-95">
            <span class="material-icons-round text-sm">refresh</span>
          </button>
        </div>
        <div class="text-center py-6 text-slate-500 dark:text-slate-400">
          <span class="material-icons-round text-5xl mb-2">cloud_off</span>
          <p>No se pudo cargar el clima.</p>
        </div>
      </section>
    `;
  }

  return `
    <section class="bg-white dark:bg-slate-800 rounded-3xl p-6 ios-shadow border border-slate-100 dark:border-slate-700/50">
      <div class="flex justify-between items-center mb-6">
        <div class="flex items-center gap-2">
          <span class="material-icons-round text-primary">cloud</span>
          <h3 class="font-bold text-slate-800 dark:text-white">Clima Actual</h3>
        </div>
        <button id="refresh-weather-btn" class="bg-primary/10 dark:bg-primary/20 p-2 rounded-xl text-primary transition-transform active:scale-95">
          <span class="material-icons-round text-sm">refresh</span>
        </button>
      </div>
      <div class="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-6 flex flex-col items-center text-center">
        <span class="material-icons-round text-6xl text-yellow-500 mb-2">${weather.icon || 'wb_sunny'}</span>
        <div class="text-5xl font-extrabold text-primary dark:text-blue-400 mb-1">${weather.temperature}°C</div>
        <p class="text-sm text-slate-500 dark:text-slate-400 font-medium capitalize">${weather.condition || 'Desconocido'}</p>
      </div>
      <div class="grid grid-cols-2 gap-4 mt-6">
        <div class="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/30">
          <div class="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-500">
            <span class="material-icons-round text-xl">opacity</span>
          </div>
          <div>
            <p class="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Humedad</p>
            <p class="text-sm font-bold text-slate-700 dark:text-slate-200">${weather.humidity || 'N/A'}%</p>
          </div>
        </div>
        <div class="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/30">
          <div class="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center text-cyan-500">
            <span class="material-icons-round text-xl">air</span>
          </div>
          <div>
            <p class="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Viento</p>
            <p class="text-sm font-bold text-slate-700 dark:text-slate-200">${weather.windSpeed || 'N/A'} km/h</p>
          </div>
        </div>
      </div>
    </section>
  `;
}

// ============================================================
// RENDERIZAR TARJETA DE PREFERENCIAS
// ============================================================
function renderPreferencesCard(preferences) {
  return `
    <section class="bg-white dark:bg-slate-800 rounded-3xl p-6 ios-shadow border border-slate-100 dark:border-slate-700/50">
      <div class="flex items-center gap-2 mb-6">
        <span class="material-icons-round text-primary">settings</span>
        <h3 class="font-bold text-slate-800 dark:text-white">Preferencias</h3>
      </div>
      <div class="space-y-4">
        <div>
          <label for="profile-frase" class="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2 ml-1">Frase Motivacional</label>
          <div class="relative">
            <input id="profile-frase" class="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-4 px-4 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary/20 transition-all" placeholder="Escribe tu frase aquí..." type="text" value="${preferences.fraseMotivacional || ''}"/>
          </div>
          <p class="text-[11px] text-slate-400 mt-2 ml-1 italic flex items-center gap-1">
            <span class="material-icons-round text-[14px]">info</span>
            Aparecerá en tu perfil y dashboard principal
          </p>
        </div>
        <div class="flex items-center justify-between">
          <label for="dark-mode-toggle" class="text-sm font-semibold text-slate-600 dark:text-slate-400">Modo Oscuro</label>
          <input type="checkbox" id="dark-mode-toggle" class="toggle toggle-primary" ${preferences.darkMode ? 'checked' : ''}>
        </div>
        <button id="save-phrase-btn" class="w-full bg-secondary hover:bg-emerald-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-secondary/20">
          <span class="material-icons-round">check_circle</span>
          Guardar Frase
        </button>
      </div>
    </section>
  `;
}

// ============================================================
// RENDERIZAR TARJETA DE FRASES MOTIVACIONALES (NUEVA SECCIÓN)
// ============================================================
function renderMotivationalPhrasesCard() {
  // Esta sección se conectará a phrases.js para mostrar y añadir frases dinámicamente.
  // Por ahora, se renderiza el esqueleto de la UI.
  return `
    <section class="bg-white dark:bg-slate-800 rounded-3xl p-6 ios-shadow border border-slate-100 dark:border-slate-700/50">
      <div class="flex items-center gap-2 mb-6">
        <span class="material-icons-round text-primary">chat</span>
        <h3 class="font-bold text-slate-800 dark:text-white">Mis Frases Motivacionales</h3>
      </div>
      <div class="flex gap-2 mb-6">
        <input id="new-custom-phrase-input" class="flex-1 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl py-3 px-4 text-sm text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary/20" placeholder="Escribe una nueva frase..." type="text"/>
        <button id="add-custom-phrase-btn" class="bg-secondary text-white px-5 rounded-2xl font-bold text-sm hover:bg-emerald-600 transition-all active:scale-95 shadow-md shadow-secondary/10">
          Añadir
        </button>
      </div>
      <div id="custom-phrases-list" class="py-12 flex flex-col items-center text-center px-4 border-2 border-dashed border-slate-100 dark:border-slate-700 rounded-2xl">
        <div class="w-16 h-16 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center mb-4 text-slate-300">
          <span class="material-icons-round text-3xl">format_quote</span>
        </div>
        <p class="text-slate-400 dark:text-slate-500 text-sm leading-relaxed max-w-[200px]">Aún no has añadido frases personalizadas.</p>
      </div>
    </section>
  `;
}

// ============================================================
// RENDERIZAR FOOTER DEL PERFIL (si es parte del diseño de main)
// ============================================================
function renderProfileFooter() {
  return `
    <footer class="text-center py-4">
      <p class="text-slate-400 dark:text-slate-600 text-[10px] font-bold uppercase tracking-widest">Águila Inventario Pro v7.6</p>
    </footer>
  `;
}


// ============================================================
// CONFIGURAR EVENTOS DEL PERFIL
// ============================================================
function setupProfileEvents() {
  console.log('🎯 Configurando eventos del perfil para el nuevo diseño...');

  // Evento para refrescar el clima
  const refreshWeatherBtn = document.getElementById('refresh-weather-btn');
  if (refreshWeatherBtn) {
    refreshWeatherBtn.addEventListener('click', () => {
      console.log('🔄 Refrescando clima...');
      if (typeof window.refreshWeather === 'function') {
        window.refreshWeather();
      } else {
        console.warn('⚠️ window.refreshWeather no está definido.');
      }
    });
  }

  // Evento para guardar frase motivacional
  const savePhraseBtn = document.getElementById('save-phrase-btn');
  if (savePhraseBtn) {
    savePhraseBtn.addEventListener('click', async () => {
      const phraseInput = document.getElementById('profile-frase');
      if (phraseInput && typeof window.saveUserPreferences === 'function') {
        const newPhrase = phraseInput.value.trim();
        console.log('💾 Guardando frase:', newPhrase);
        await window.saveUserPreferences({ fraseMotivacional: newPhrase });
      } else {
        console.warn('⚠️ No se encontró el input de frase o window.saveUserPreferences no está definido.');
      }
    });
  }

  // Eventos para frases motivacionales personalizadas (Añadir)
  const addCustomPhraseBtn = document.getElementById('add-custom-phrase-btn');
  if (addCustomPhraseBtn) {
    addCustomPhraseBtn.addEventListener('click', async () => {
      const newCustomPhraseInput = document.getElementById('new-custom-phrase-input');
      if (newCustomPhraseInput && typeof window.addMotivationalPhrase === 'function') {
        const phraseText = newCustomPhraseInput.value.trim();
        if (phraseText) {
          console.log('➕ Añadiendo frase personalizada:', phraseText);
          await window.addMotivationalPhrase(phraseText);
          newCustomPhraseInput.value = ''; // Limpiar input
          // Aquí idealmente se debería re-renderizar la lista de frases
          if (typeof window.renderMotivationalPhrasesList === 'function') {
            window.renderMotivationalPhrasesList(); // Necesitará ser implementada en phrases.js/profile-ui.js
          }
        } else {
          showToast('Escribe una frase para añadir.', 'warning');
        }
      } else {
        console.warn('⚠️ No se encontró el input de frase o window.addMotivationalPhrase no está definido.');
      }
    });
  }

  // Evento para el toggle de Modo Oscuro
  const darkModeToggle = document.getElementById('dark-mode-toggle');
  if (darkModeToggle && typeof window.saveUserPreferences === 'function') {
    darkModeToggle.addEventListener('change', async (e) => {
      const isDarkMode = e.target.checked;
      console.log('🌓 Cambiando modo oscuro a:', isDarkMode);
      await window.saveUserPreferences({ darkMode: isDarkMode });
    });
  }


  console.log('✅ Eventos del perfil configurados para el nuevo diseño.');
}

// ============================================================
// ACTUALIZAR SOLO EL CLIMA (SIN RE-RENDERIZAR TODO EL PERFIL)
// ============================================================
function updateWeatherUI() {
  const weatherContainer = document.querySelector('section.bg-white > div.bg-slate-50.dark\\:bg-slate-900\\/50'); // Selector más específico
  if (!weatherContainer) {
    console.warn('⚠️ Contenedor de clima no encontrado para actualizar la UI.');
    return;
  }
  
  const { weather } = window.PROFILE_STATE;

  if (!weather || weather.error) {
    weatherContainer.innerHTML = `
      <span class="material-icons-round text-6xl text-slate-400 mb-2">cloud_off</span>
      <p class="text-lg text-slate-500 dark:text-slate-400">Clima no disponible</p>
    `;
    return;
  }

  weatherContainer.innerHTML = `
    <span class="material-icons-round text-6xl text-yellow-500 mb-2">${weather.icon || 'wb_sunny'}</span>
    <div class="text-5xl font-extrabold text-primary dark:text-blue-400 mb-1">${weather.temperature}°C</div>
    <p class="text-sm text-slate-500 dark:text-slate-400 font-medium capitalize">${weather.condition || 'Desconocido'}</p>
  `;

  // Actualizar Humedad y Viento
  const humidityElement = weatherContainer.closest('section').querySelector('p.text-sm.font-bold.text-slate-700.dark\\:text-slate-200');
  if (humidityElement) humidityElement.textContent = `${weather.humidity || 'N/A'}%`;
  
  const windElement = humidityElement.closest('.grid').querySelectorAll('p.text-sm.font-bold.text-slate-700.dark\\:text-slate-200')[1];
  if (windElement) windElement.textContent = `${weather.windSpeed || 'N/A'} km/h`;


  console.log('✅ UI del clima actualizada');
}

// ============================================================
// ACTUALIZAR SOLO LA ACTIVIDAD (NO NECESARIA CON ESTE DISEÑO, PERO SE MANTIENE EL STUB)
// ============================================================
function updateActivityUI() {
  console.log('ℹ️ updateActivityUI llamado, pero el diseño actual no tiene una sección de actividad dinámica.');
  // El diseño proporcionado no tiene una sección de "Actividad de Hoy" como la anterior.
  // Si se necesita en el futuro, se deberá añadir la sección y su lógica de actualización aquí.
}

// ============================================================
// INICIALIZACIÓN
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('🎨 Inicializando módulo de perfil (UI)...');

  // El renderizado inicial ahora se gestiona a través de app.js switchTab y window.loadProfile
  // Este listener se mantiene solo por si hay alguna otra inicialización de UI necesaria
  // antes de que se llame window.loadProfile.
});

// ============================================================
// EXPONER FUNCIONES PÚBLICAS
// ============================================================
window.renderProfileUI = renderProfileUI;
window.updateWeatherUI = updateWeatherUI;
window.updateActivityUI = updateActivityUI; // Mantenido por compatibilidad, pero su funcionalidad es limitada con el nuevo diseño

console.log('✅ profile-ui.js (Fase 2.2 - Render UI) cargado correctamente con nuevo diseño');