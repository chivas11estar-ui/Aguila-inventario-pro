/* ============================================================
   Águila Inventario Pro - app.js
   Navegación Fluida con Soporte de Botón Atrás
   ============================================================ */

let isOnline = navigator.onLine;

function switchTab(tabName, updateHash = true) {
  if (!tabName) return;
  const selectedTab = document.getElementById(`tab-${tabName}`);
  if (!selectedTab) return;

  if (updateHash) window.location.hash = tabName;

  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
    tab.classList.add('hidden');
  });

  selectedTab.classList.remove('hidden');
  selectedTab.classList.add('active');

  document.querySelectorAll('[data-tab]').forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-tab') === tabName);
  });

  if (tabName === 'analytics' && typeof window.loadStats === 'function') {
    Promise.resolve(window.loadStats())
      .then(() => window.renderAnalyticsUI?.())
      .catch(error => console.error('Error cargando analíticas:', error));
  }

  if (typeof runTabLoader === 'function') runTabLoader(tabName);
}

window.addEventListener('hashchange', () => {
  const hash = window.location.hash.replace('#', '');
  if (hash) switchTab(hash, false);
});

function initAppNavigation() {
  const initialHash = window.location.hash.replace('#', '');
  if (initialHash) switchTab(initialHash, false);

  document.querySelectorAll('[data-tab]').forEach(el => {
    if (el.dataset.aguilaNavigationBound === 'true') return;
    el.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab(el.getAttribute('data-tab'));
    });
    el.dataset.aguilaNavigationBound = 'true';
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAppNavigation, { once: true });
} else {
  initAppNavigation();
}

window.switchTab = switchTab;
