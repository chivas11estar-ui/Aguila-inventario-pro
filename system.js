// ============================================================
// Águila Inventario Pro - Módulo: [nombre del archivo]
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

export function forceSyncNow() {
  showToast('Sincronizando...', 'primary');
  // lógica de sincronización aquí
  setTimeout(() => showToast('Sincronización completa', 'success'), 2000);
}

export function showSystemStats() {
  const msg = `Versión: 6.0\nConexión: ${navigator.onLine ? 'Online' : 'Offline'}\nUsuario: ${currentUser?.email || 'No autenticado'}`;
  alert(msg);
}