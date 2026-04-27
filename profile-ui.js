// ============================================================
// Águila Inventario Pro - Módulo: profile-ui.js
// RENDER UI - Versión Eagle Pro (Identity Card & Bento Stats)
// ============================================================

function renderProfileUI() {
  const container = document.getElementById('profile-container');
  if (!container) return;

  const { userData, preferences, isLoading } = window.PROFILE_STATE;

  if (isLoading) {
    container.innerHTML = `<div class="text-center p-20 text-slate-400 animate-pulse"><span class="material-symbols-outlined text-6xl">hourglass_empty</span><p>Cargando Perfil...</p></div>`;
    return;
  }

  // Si no hay datos, usamos placeholders de prueba para mostrar el diseño
  const displayData = userData || {
    nombrePromotor: 'Carlos Rodriguez',
    email: 'carlos.rod@eagle.com',
    nombreTienda: 'North Alpha HQ',
    determinante: '1240'
  };

  const html = `
    <div class="max-w-[1200px] mx-auto px-4 pt-4">
      <!-- Identity Card & Stats Section -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <!-- User Identity Card -->
        <div class="lg:col-span-2 bg-white p-8 rounded-xl shadow-sm border border-border-subtle flex flex-col md:flex-row items-center md:items-start gap-8 relative overflow-hidden">
          <div class="absolute top-0 left-0 w-1.5 h-full bg-primary"></div>
          <div class="w-32 h-32 rounded-2xl overflow-hidden shadow-md flex-shrink-0 border-4 border-primary-light">
            <img src="${preferences?.avatarUrl || 'https://lh3.googleusercontent.com/aida-public/AB6AXuDB-EF7NkM7870Pl82iRwCcDEl4Nbv4vrW3q3obiZmzkT0uU0c1e25xf6R84WfpoFGUeMgykPKe_GQCUJKTicap4Cb7vJra88z-3EsLM2ZlKF9KJhkCIdO8_LYgfe-iXKYJAKPXLRDsm3v_WDuUXk0ekAGklObO-2Nklcbk0RRuIyJPPwQaoOdQyog9gq-op_0WGOTElopg-tfBY3LZP_vyCsAaLCS97X3gQyAwdx5jP2A0RYgPRdaYVFwLte-WKl_yCynjbVSVqiI'}" alt="Profile" class="w-full h-full object-cover" />
          </div>
          <div class="text-center md:text-left flex-grow">
            <div class="flex flex-col md:flex-row md:items-center gap-2 mb-2">
              <h2 class="text-2xl font-black text-primary-dark">${displayData.nombrePromotor}</h2>
              <span class="bg-primary-light text-primary-dark text-[10px] font-black px-3 py-1 rounded-full w-fit mx-auto md:mx-0 uppercase tracking-wider">VERIFIED PRO</span>
            </div>
            <p class="text-sm font-medium text-slate-500 mb-6">Promotor de Inventario • ${displayData.nombreTienda}</p>
            <div class="flex flex-wrap gap-3 justify-center md:justify-start">
              <button onclick="window.showEditProfileModal()" class="bg-primary text-white text-xs font-bold px-6 py-2.5 rounded-lg hover:shadow-lg transition-all active:scale-95 flex items-center gap-2">
                <span class="material-symbols-outlined text-[18px]">edit</span> Editar Perfil
              </button>
              <button class="border border-slate-200 text-slate-600 text-xs font-bold px-6 py-2.5 rounded-lg hover:bg-slate-50 transition-all active:scale-95">
                Compartir ID
              </button>
            </div>
          </div>
        </div>

        <!-- Stats Bento Card -->
        <div class="grid grid-cols-1 gap-4">
          <div class="bg-primary-dark text-white p-6 rounded-xl shadow-md flex flex-col justify-between relative overflow-hidden group">
            <div class="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-8 -mt-8"></div>
            <div class="flex justify-between items-start relative z-10">
              <span class="material-symbols-outlined bg-white/10 p-2 rounded-lg">barcode_scanner</span>
              <span class="text-[9px] font-black opacity-70 uppercase tracking-widest">Actividad Total</span>
            </div>
            <div class="relative z-10">
              <h3 class="text-4xl font-black leading-tight">${displayData.determinante}</h3>
              <p class="text-[10px] font-medium opacity-80 uppercase">Scans este mes</p>
            </div>
          </div>
          <div class="bg-success-dark text-white p-6 rounded-xl shadow-md flex flex-col justify-between relative overflow-hidden">
            <div class="flex justify-between items-start">
              <span class="material-symbols-outlined bg-white/10 p-2 rounded-lg">verified</span>
              <span class="text-[9px] font-black opacity-70 uppercase tracking-widest">Precisión</span>
            </div>
            <div>
              <h3 class="text-4xl font-black leading-tight">98.2%</h3>
              <p class="text-[10px] font-medium opacity-80 uppercase">Exactitud en Inventario</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Eagle Support Section -->
      <section class="mt-8">
        <div class="bg-gradient-to-br from-blue-900 to-indigo-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden group">
          <div class="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform"></div>
          <div class="relative z-10">
            <div class="flex items-center gap-3 mb-4">
              <span class="material-symbols-outlined text-amber-400">workspace_premium</span>
              <h3 class="font-black uppercase tracking-widest text-xs">Apoya el Proyecto Eagle</h3>
            </div>
            <p class="text-sm font-medium mb-6 opacity-90">Si esta herramienta te ahorra tiempo en tienda, considera apoyar al desarrollador para mantener el sistema y añadir nuevas funciones.</p>
            
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <!-- Botón Mercado Pago (Ejemplo) -->
              <a href="https://link.mercadopago.com.mx/TU_LINK_AQUI" target="_blank" class="bg-white text-blue-900 font-black py-3 rounded-xl text-xs flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg">
                <span class="material-symbols-outlined text-lg">payments</span> Aportar $50 MXN
              </a>
              <!-- Botón PayPal -->
              <a href="https://paypal.me/TU_USUARIO_AQUI" target="_blank" class="bg-blue-600 text-white font-black py-3 rounded-xl text-xs flex items-center justify-center gap-2 active:scale-95 transition-all border border-blue-500/50 shadow-lg">
                <span class="material-symbols-outlined text-lg">volunteer_activism</span> Invítame un café
              </a>
            </div>
            <p class="text-[9px] text-center mt-4 opacity-50 font-bold uppercase tracking-tighter italic">Tu apoyo mantiene vivo este sistema independiente</p>
          </div>
        </div>
      </section>

      <!-- Settings Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
        <!-- Account & Security -->
        <section>
          <div class="flex items-center gap-2 mb-4">
            <span class="material-symbols-outlined text-primary">security</span>
            <h3 class="font-bold text-slate-800">Cuenta y Seguridad</h3>
          </div>
          <div class="space-y-3">
            <div class="bg-white border border-slate-100 p-4 rounded-xl flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer group shadow-sm">
              <div class="flex items-center gap-4">
                <div class="w-10 h-10 bg-primary-light rounded-lg flex items-center justify-center text-primary">
                  <span class="material-symbols-outlined">password</span>
                </div>
                <div>
                  <p class="text-sm font-bold text-slate-800">Cambiar Contraseña</p>
                  <p class="text-[10px] text-slate-400">Actualizada hace 3 meses</p>
                </div>
              </div>
              <span class="material-symbols-outlined text-slate-300 group-hover:translate-x-1 transition-transform">chevron_right</span>
            </div>
          </div>
        </section>

        <!-- App Preferences -->
        <section>
          <div class="flex items-center gap-2 mb-4">
            <span class="material-symbols-outlined text-primary">settings_suggest</span>
            <h3 class="font-bold text-slate-800">Preferencias de App</h3>
          </div>
          <div class="bg-white border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-50 shadow-sm">
            <div class="p-4 flex items-center justify-between">
              <div class="flex items-center gap-4">
                <div class="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-600">
                  <span class="material-symbols-outlined">dark_mode</span>
                </div>
                <div>
                  <p class="text-sm font-bold text-slate-800">Modo Oscuro</p>
                  <p class="text-[10px] text-slate-400">Reducir fatiga visual</p>
                </div>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" class="sr-only peer" ${preferences?.darkMode ? 'checked' : ''} onchange="window.toggleDarkMode()">
                <div class="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
              </label>
            </div>
            <div class="p-4 flex items-center justify-between">
              <div class="flex items-center gap-4">
                <div class="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-600">
                  <span class="material-symbols-outlined">notifications</span>
                </div>
                <div>
                  <p class="text-sm font-bold text-slate-800">Notificaciones</p>
                  <p class="text-[10px] text-slate-400">Alertas de stock y auditorías</p>
                </div>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked class="sr-only peer">
                <div class="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
              </label>
            </div>
          </div>
        </section>
      </div>

      <!-- Footer Action -->
      <div class="mt-12 flex flex-col items-center">
        <p class="text-[10px] font-bold text-slate-400 mb-4 uppercase tracking-widest">Eagle System v4.2.1-stable</p>
        <button onclick="window.handleLogout()" class="group flex items-center gap-3 px-10 py-3.5 bg-error/5 hover:bg-error text-error hover:text-white transition-all duration-300 rounded-xl font-bold border border-error/10 active:scale-95">
          <span class="material-symbols-outlined text-[20px]">logout</span>
          Cerrar Sesión del Dispositivo
        </button>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

window.renderProfileUI = renderProfileUI;