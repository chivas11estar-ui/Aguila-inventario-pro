// ============================================================
// Águila Inventario Pro - Módulo: audit.js
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
export async function registerAudit(barcode, countedBoxes, warehouse) {
  if (!barcode || countedBoxes < 0 || !warehouse) {
    return showToast('Completa todos los campos', 'error');
  }

  try {
    const auditRef = db.ref('audits/' + Date.now());
    await auditRef.set({
      barcode, countedBoxes, warehouse,
      auditedAt: firebase.database.ServerValue.TIMESTAMP
    });
    showToast('Conteo registrado', 'success');
  } catch (error) {
    showToast('Error en auditoría: ' + error.message, 'error');
  }
}