// ============================================================
// Águila Inventario Pro - Módulo: profile-ui.js
// Fase 2.2 - Perfil del Promotor
// RENDER UI - Solo HTML
// Copyright © 2025 José A. G. Betancourt
// ============================================================

// ============================================================
// RENDERIZAR PERFIL COMPLETO
// ============================================================
function renderProfileUI() {
  const container = document.getElementById('profile-container');
  if (!container) {
    console.warn('⚠️ Elemento profile-container no encontrado');
    return;
  }

  const { userData, preferences, todayActivity, weather, isLoading } = window.PROFILE_STATE;

  if (isLoading) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--muted);">
        <div style="font-size: 48px; margin-bottom: 16px;">⏳</div>
        <p>Cargando perfil...</p>
      </div>
    `;
    return;
  }

  if (!userData) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--error);">
        <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
        <p>No se pudo cargar el perfil</p>
        <button onclick="window.loadUserProfile()" class="primary" style="margin-top: 16px;">
          Reintentar
        </button>
      </div>
    `;
    return;
  }

  console.log('🎨 Renderizando perfil de:', userData.nombrePromotor);

  const html = `
    <!-- Header del Perfil -->
    ${renderProfileHeader(userData)}

    <!-- Clima -->
    ${renderWeatherCard(weather)}

    <!-- Actividad del Día -->
    ${renderActivityCard(todayActivity)}

    <!-- Información de la Cuenta -->
    ${renderAccountInfo(userData)}

    <!-- Preferencias -->
    ${renderPreferences(preferences)}

    <!-- Botones de Acción -->
    ${renderActionButtons()}
  `;

  container.innerHTML = html;

  // Configurar eventos
  setupProfileEvents();

  console.log('✅ Perfil renderizado');
}

// ============================================================
// RENDERIZAR HEADER DEL PERFIL
// ============================================================
function renderProfileHeader(userData) {
  return `
    <div class="card" style="text-align: center; background: linear-gradient(135deg, var(--primary), #003a8a); color: white; padding: 24px;">
      <div style="font-size: 64px; margin-bottom: 12px;">
        ${userData.preferences?.avatar || '👤'}
      </div>
      <h2 style="margin: 0 0 8px 0; color: white;">
        ${userData.nombrePromotor || 'Promotor'}
      </h2>
      <p style="margin: 0; opacity: 0.9; font-size: 14px;">
        📧 ${userData.email}
      </p>
      <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">
        🏪 ${userData.nombreTienda || 'Sin tienda asignada'}
      </p>
      <div style="margin-top: 16px; padding: 8px; background: rgba(255,255,255,0.1); border-radius: 8px; font-size: 12px;">
        🔑 Determinante: <strong>${userData.determinante}</strong>
      </div>
    </div>
  `;
}

// ============================================================
// RENDERIZAR TARJETA DE CLIMA
// ============================================================
function renderWeatherCard(weather) {
  if (!weather || weather.error) {
    return `
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; color: var(--primary);">☁️ Clima</h3>
          <button 
            onclick="window.refreshWeather()"
            style="padding: 6px 12px; background: var(--primary); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;"
          >
            🔄 Actualizar
          </button>
        </div>
        <p style="color: var(--muted); margin-top: 12px;">
          Clima no disponible
        </p>
      </div>
    `;
  }

  return `
    <div class="card" id="weather-card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h3 style="margin: 0; color: var(--primary);">☁️ Clima Actual</h3>
        <button 
          onclick="window.refreshWeather()"
          style="padding: 6px 12px; background: var(--primary); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;"
        >
          🔄
        </button>
      </div>

      <div class="responsive-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <!-- Temperatura -->
        <div style="text-align: center; padding: 16px; background: #f0f9ff; border-radius: 8px;">
          <div style="font-size: 48px; margin-bottom: 8px;">
            ${weather.icon}
          </div>
          <div style="font-size: 32px; font-weight: 700; color: var(--primary);">
            ${weather.temperature}°C
          </div>
          <div style="font-size: 12px; color: var(--muted); margin-top: 4px;">
            ${weather.condition}
          </div>
        </div>

        <!-- Otros datos -->
        <div style="display: flex; flex-direction: column; justify-content: center; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 20px;">💧</span>
            <div>
              <div style="font-weight: 600; font-size: 14px;">Humedad</div>
              <div style="font-size: 12px; color: var(--muted);">${weather.humidity}%</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 20px;">💨</span>
            <div>
              <div style="font-weight: 600; font-size: 14px;">Viento</div>
              <div style="font-size: 12px; color: var(--muted);">${weather.windSpeed} km/h</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ============================================================
// RENDERIZAR TARJETA DE ACTIVIDAD
// ============================================================
function renderActivityCard(activity) {
  return `
    <div class="card" id="activity-card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h3 style="margin: 0; color: var(--primary);">📊 Actividad de Hoy</h3>
        <button 
          onclick="window.refreshActivity()"
          style="padding: 6px 12px; background: var(--primary); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;"
        >
          🔄
        </button>
      </div>

      <div class="responsive-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <!-- Auditorías -->
        <div style="padding: 16px; background: #ecfdf5; border-radius: 8px; border-left: 4px solid #10b981;">
          <div style="font-size: 32px; font-weight: 700; color: #10b981;">
            ${activity.auditorias}
          </div>
          <div style="font-size: 12px; color: #065f46; font-weight: 600;">
            Auditorías
          </div>
          <div style="font-size: 11px; color: #6b7280; margin-top: 4px;">
            ${activity.productosAuditados} productos
          </div>
        </div>

        <!-- Rellenos -->
        <div style="padding: 16px; background: #eff6ff; border-radius: 8px; border-left: 4px solid #2563eb;">
          <div style="font-size: 32px; font-weight: 700; color: #2563eb;">
            ${activity.rellenos}
          </div>
          <div style="font-size: 12px; color: #1e40af; font-weight: 600;">
            Rellenos
          </div>
          <div style="font-size: 11px; color: #6b7280; margin-top: 4px;">
            ${activity.cajasMovidas} cajas
          </div>
        </div>
      </div>

      ${renderActivityMessage(activity)}
    </div>
  `;
}

// ============================================================
// RENDERIZAR MENSAJE DE ACTIVIDAD
// ============================================================
function renderActivityMessage(activity) {
  const totalActividad = activity.auditorias + activity.rellenos;

  let mensaje = '';
  let color = '';
  let icon = '';

  if (totalActividad === 0) {
    mensaje = 'Aún no hay actividad hoy. ¡Es hora de comenzar!';
    color = '#f59e0b';
    icon = '⏰';
  } else if (totalActividad < 5) {
    mensaje = '¡Buen comienzo! Sigue así.';
    color = '#10b981';
    icon = '💪';
  } else if (totalActividad < 10) {
    mensaje = '¡Excelente trabajo! Vas muy bien.';
    color = '#10b981';
    icon = '🔥';
  } else {
    mensaje = '¡Increíble! Eres un promotor estrella.';
    color = '#10b981';
    icon = '⭐';
  }

  return `
    <div style="margin-top: 16px; padding: 12px; background: ${color}15; border-left: 4px solid ${color}; border-radius: 8px;">
      <div style="display: flex; align-items: center; gap: 8px; color: ${color}; font-weight: 600; font-size: 13px;">
        <span style="font-size: 20px;">${icon}</span>
        ${mensaje}
      </div>
    </div>
  `;
}

// ============================================================
// RENDERIZAR INFORMACIÓN DE LA CUENTA
// ============================================================
function renderAccountInfo(userData) {
  const fechaRegistro = userData.fechaRegistro 
    ? new Date(userData.fechaRegistro).toLocaleDateString('es-MX', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
    : 'No disponible';

  return `
    <div class="card">
      <h3 style="margin: 0 0 16px 0; color: var(--primary);">📋 Información de la Cuenta</h3>

      <form id="profile-info-form">
        <div class="form-group">
          <label for="profile-nombre">Nombre del Promotor</label>
          <input 
            id="profile-nombre" 
            type="text" 
            value="${userData.nombrePromotor || ''}"
            placeholder="Ej: Juan Pérez"
          />
        </div>

        <div class="form-group">
          <label for="profile-tienda">Nombre de la Tienda</label>
          <input 
            id="profile-tienda" 
            type="text" 
            value="${userData.nombreTienda || ''}"
            placeholder="Ej: Oxxo Centro"
          />
        </div>

        <div class="form-group">
          <label>Email</label>
          <input 
            type="email" 
            value="${userData.email}"
            disabled
            style="background: #f8fafc; cursor: not-allowed;"
          />
          <small style="color: var(--muted); font-size: 11px;">El email no se puede cambiar</small>
        </div>

        <div class="form-group">
          <label>Determinante (ID de Tienda)</label>
          <input 
            type="text" 
            value="${userData.determinante}"
            disabled
            style="background: #f8fafc; cursor: not-allowed;"
          />
          <small style="color: var(--muted); font-size: 11px;">Asignado automáticamente</small>
        </div>

        <div style="padding: 12px; background: var(--bg); border-radius: 8px; margin-top: 16px;">
          <small style="color: var(--muted); font-size: 12px;">
            📅 Miembro desde: <strong>${fechaRegistro}</strong>
          </small>
        </div>

        <button type="submit" class="primary" style="width: 100%; margin-top: 16px;">
          💾 Guardar Cambios
        </button>
      </form>
    </div>
  `;
}

// ============================================================
// RENDERIZAR PREFERENCIAS
// ============================================================
function renderPreferences(preferences) {
  return `
    <div class="card">
      <h3 style="margin: 0 0 16px 0; color: var(--primary);">⚙️ Preferencias</h3>

      <form id="profile-preferences-form">
        <div class="form-group">
          <label for="profile-frase">Frase Motivacional</label>
          <input 
            id="profile-frase" 
            type="text" 
            value="${preferences.fraseMotivacional || '¡Hoy será un gran día! 🦅'}"
            placeholder="Escribe tu frase motivacional"
            maxlength="100"
          />
          <small style="color: var(--muted); font-size: 11px;">
            Aparecerá en tu perfil y dashboard
          </small>
        </div>

        <div style="margin-bottom: 16px;">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <input 
              type="checkbox" 
              id="profile-mostrar-clima"
              ${preferences.mostrarClima !== false ? 'checked' : ''}
              style="width: 18px; height: 18px; cursor: pointer;"
            />
            <span style="font-weight: 600; font-size: 14px;">Mostrar información del clima</span>
          </label>
        </div>

        <div style="margin-bottom: 16px;">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <input 
              type="checkbox" 
              id="profile-mostrar-stats"
              ${preferences.mostrarEstadisticas !== false ? 'checked' : ''}
              style="width: 18px; height: 18px; cursor: pointer;"
            />
            <span style="font-weight: 600; font-size: 14px;">Mostrar estadísticas de actividad</span>
          </label>
        </div>

        <button type="submit" class="success" style="width: 100%; margin-top: 16px;">
          ✅ Guardar Preferencias
        </button>
      </form>
    </div>
  `;
}

// ============================================================
// RENDERIZAR BOTONES DE ACCIÓN
// ============================================================
function renderActionButtons() {
  return `
    <div class="card">
      <h3 style="margin: 0 0 16px 0; color: var(--primary);">🛠️ Acciones</h3>

      <div style="display: grid; gap: 12px;">
        <button 
          onclick="window.loadUserProfile()"
          class="primary"
          style="width: 100%;"
        >
          🔄 Refrescar Perfil
        </button>

        <button 
          onclick="if(typeof window.diagnosticoFirebase === 'function') window.diagnosticoFirebase()"
          class="primary"
          style="width: 100%;"
        >
          🔍 Diagnóstico del Sistema
        </button>

        <button 
          onclick="if(typeof window.showSystemStats === 'function') window.showSystemStats()"
          class="primary"
          style="width: 100%;"
        >
          📊 Ver Estadísticas Completas
        </button>

        <button 
          onclick="if(typeof window.clearAllData === 'function') window.clearAllData()"
          class="warning"
          style="width: 100%;"
        >
          🗑️ Limpiar Datos Locales
        </button>

        <button 
          onclick="if(typeof window.logout === 'function') window.logout()"
          class="error"
          style="width: 100%;"
        >
          🚪 Cerrar Sesión
        </button>
      </div>
    </div>
  `;
}

// ============================================================
// CONFIGURAR EVENTOS DEL PERFIL
// ============================================================
function setupProfileEvents() {
  console.log('🎯 Configurando eventos del perfil...');

  // Formulario de información
  const infoForm = document.getElementById('profile-info-form');
  if (infoForm) {
    infoForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const nombre = document.getElementById('profile-nombre')?.value.trim();
      const tienda = document.getElementById('profile-tienda')?.value.trim();

      if (!nombre || !tienda) {
        if (typeof showToast === 'function') {
          showToast('⚠️ Completa todos los campos', 'warning');
        }
        return;
      }

      const success = await window.updateUserData({
        nombrePromotor: nombre,
        nombreTienda: tienda
      });

      if (success) {
        // Re-renderizar para mostrar cambios
        renderProfileUI();
      }
    });
  }

  // Formulario de preferencias
  const prefsForm = document.getElementById('profile-preferences-form');
  if (prefsForm) {
    prefsForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const frase = document.getElementById('profile-frase')?.value.trim();
      const mostrarClima = document.getElementById('profile-mostrar-clima')?.checked;
      const mostrarStats = document.getElementById('profile-mostrar-stats')?.checked;

      const success = await window.saveUserPreferences({
        fraseMotivacional: frase,
        mostrarClima: mostrarClima,
        mostrarEstadisticas: mostrarStats
      });

      if (success) {
        // Re-renderizar para reflejar cambios
        renderProfileUI();
      }
    });
  }

  console.log('✅ Eventos del perfil configurados');
}

// ============================================================
// ACTUALIZAR SOLO EL CLIMA (SIN RE-RENDERIZAR TODO)
// ============================================================
function updateWeatherUI() {
  const weatherCard = document.getElementById('weather-card');
  if (!weatherCard) return;

  const weather = window.PROFILE_STATE.weather;
  if (!weather || weather.error) return;

  weatherCard.outerHTML = renderWeatherCard(weather).trim();
  
  console.log('✅ UI del clima actualizada');
}

// ============================================================
// ACTUALIZAR SOLO LA ACTIVIDAD (SIN RE-RENDERIZAR TODO)
// ============================================================
function updateActivityUI() {
  const activityCard = document.getElementById('activity-card');
  if (!activityCard) return;

  const activity = window.PROFILE_STATE.todayActivity;
  if (!activity) return;

  activityCard.outerHTML = renderActivityCard(activity).trim();
  
  console.log('✅ UI de actividad actualizada');
}

// ============================================================
// INICIALIZACIÓN
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('🎨 Inicializando módulo de perfil (UI)...');

  // Renderizar cuando se cambie a la pestaña de sistema
  document.querySelectorAll('[data-tab="system"]').forEach(btn => {
    btn.addEventListener('click', () => {
      setTimeout(() => {
        if (window.PROFILE_STATE.userData) {
          renderProfileUI();
        } else {
          window.loadUserProfile();
        }
      }, 100);
    });
  });
});

// ============================================================
// EXPONER FUNCIONES PÚBLICAS
// ============================================================
window.renderProfileUI = renderProfileUI;
window.updateWeatherUI = updateWeatherUI;
window.updateActivityUI = updateActivityUI;

console.log('✅ profile-ui.js (Fase 2.2 - Render UI) cargado correctamente');