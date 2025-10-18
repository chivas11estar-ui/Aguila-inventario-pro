// ============================================================
// Águila Inventario Pro - Módulo: ui.js
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

// Cambiar entre formularios (login, registro, recuperar)
function switchForm(formId) {
  document.querySelectorAll("#auth-setup form").forEach((form) => {
    form.classList.add("hidden");
  });
  document.getElementById(formId).classList.remove("hidden");
}

// Navegación entre pestañas
function setupTabNavigation() {
  const tabs = document.querySelectorAll(".tabs button");
  const tabContents = document.querySelectorAll(".tab");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));

      tab.classList.add("active");
      const target = document.getElementById(`tab-${tab.dataset.tab}`);
      if (target) target.classList.add("active");
    });
  });
}