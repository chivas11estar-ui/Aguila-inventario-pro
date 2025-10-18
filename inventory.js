// ============================================================
// Águila Inventario Pro - Módulo: inventory
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
export async function addProduct(data) {
  const { barcode, name, brand, piecesPerBox, warehouse, expiryDate, boxes } = data;
  if (!barcode || !name || !brand || !piecesPerBox || !warehouse || !expiryDate || !boxes) {
    return showToast('Completa todos los campos', 'error');
  }

  try {
    const productRef = db.ref('inventory/' + barcode);
    await productRef.set({
      name, brand, piecesPerBox, warehouse, expiryDate, boxes,
      addedAt: firebase.database.ServerValue.TIMESTAMP
    });
    showToast('Producto agregado correctamente', 'success');
  } catch (error) {
    showToast('Error al guardar producto: ' + error.message, 'error');
  }
}