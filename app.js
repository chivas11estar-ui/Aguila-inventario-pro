// ============================================================
// Águila Inventario Pro - Módulo: style.css
// Copyright © 2025 José A. G. Betancourt
// Todos los derechos reservados
//
// Este archivo forma parte del sistema Águila Inventario Pro,
// desarrollado para promotores de PepsiCo con funcionalidades
// de gestión, auditoría y sincronización de inventario.
//
// Queda prohibida la reproducción, distribución o modificación
// sin autorización expresa del autor.
// ============================================================

// ==========================
// Inicialización de la UI
// ==========================
setupTabNavigation();

// ==========================
// Formularios de autenticación
// ==========================

// Mostrar formularios
document.getElementById('show-register')?.addEventListener('click', () => switchForm('register-form'));
document.getElementById('show-login')?.addEventListener('click', () => switchForm('login-form'));
document.getElementById('show-forgot-password')?.addEventListener('click', () => switchForm('forgot-password-form'));
document.getElementById('show-login-from-forgot')?.addEventListener('click', () => switchForm('login-form'));

// Login
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  await login(email, password);
});

// Registro
document.getElementById('register-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {
    email: document.getElementById('register-email').value.trim(),
    password: document.getElementById('register-password').value,
    determinante: document.getElementById('register-determinante').value.trim(),
    storeName: document.getElementById('register-store-name').value.trim(),
    promoterName: document.getElementById('register-promoter-name').value.trim()
  };
  await register(data);
});

// Recuperar contraseña
document.getElementById('forgot-password-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('forgot-email').value.trim();
  await recoverPassword(email);
});

// ==========================
// Inventario
// ==========================
document.getElementById('add-product-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {
    barcode: document.getElementById('add-barcode').value.trim(),
    name: document.getElementById('add-product-name').value.trim(),
    brand: document.getElementById('add-brand').value,
    piecesPerBox: parseInt(document.getElementById('add-pieces-per-box').value),
    warehouse: document.getElementById('add-warehouse').value.trim(),
    expiryDate: document.getElementById('add-expiry-date').value,
    boxes: parseInt(document.getElementById('add-boxes').value)
  };
  await addProduct(data);
});

// ==========================
// Auditoría
// ==========================
document.getElementById('audit-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const barcode = document.getElementById('audit-barcode').value.trim();
  const countedBoxes = parseInt(document.getElementById('audit-boxes').value);
  const warehouse = document.getElementById('audit-warehouse').value.trim();
  await registerAudit(barcode, countedBoxes, warehouse);
});

// ==========================
// Sistema
// ==========================
document.getElementById('force-sync-btn')?.addEventListener('click', forceSyncNow);
document.getElementById('show-stats-btn')?.addEventListener('click', showSystemStats);
document.getElementById('logout-btn')?.addEventListener('click', logout);

// ==========================
// Escáner de códigos
// ==========================
document.getElementById('add-scan-btn')?.addEventListener('click', () => startScanner('add-barcode'));
document.getElementById('refill-scan-btn')?.addEventListener('click', () => startScanner('refill-barcode'));
document.getElementById('audit-scan-btn')?.addEventListener('click', () => startScanner('audit-barcode'));
document.getElementById('close-scanner')?.addEventListener('click', stopScanner);

// ==========================
// Confirmación de carga
// ==========================
console.log('✅ Águila Inventario Pro v7.0 cargado correctamente');

// ==========================
// Registro del Service Worker
// ==========================
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then((reg) => console.log("✅ Service Worker registrado:", reg.scope))
      .catch((err) => console.error("❌ Error al registrar SW:", err));
  });
}