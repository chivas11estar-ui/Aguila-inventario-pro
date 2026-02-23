// ============================================================
// Águila Inventario Pro - Script de Migración a V2
// Migra datos de inventario/{det}/{pushId} → productos/{det}/{codigoBarras}
// Copyright © 2025 José A. G. Betancourt
//
// INSTRUCCIONES:
// 1. Este script se ejecuta UNA SOLA VEZ desde la consola del navegador
//    o como un botón temporal en la app.
// 2. NO borra los datos antiguos (por seguridad).
// 3. Consolida duplicados sumando cajas.
// 4. Después de verificar, puedes eliminar inventario/{det}/ manualmente.
// ============================================================

'use strict';

async function migrarInventarioAV2() {
  console.log('═══════════════════════════════════════════');
  console.log('🚀 MIGRACIÓN A V2 - Inicio');
  console.log('═══════════════════════════════════════════');

  const user = firebase.auth().currentUser;
  if (!user) {
    console.error('❌ No hay usuario autenticado');
    alert('Error: Inicia sesión primero');
    return;
  }

  // Obtener determinante
  const userSnap = await firebase.database().ref(`usuarios/${user.uid}`).once('value');
  const det = userSnap.val()?.determinante;
  if (!det) {
    console.error('❌ Sin determinante');
    alert('Error: No se encontró información de la tienda');
    return;
  }

  console.log(`🏪 Migrando tienda: ${det}`);

  // 1. Leer todos los productos antiguos
  const oldSnap = await firebase.database().ref(`inventario/${det}`).once('value');
  if (!oldSnap.exists()) {
    console.log('⚠️ No hay datos que migrar en inventario/' + det);
    alert('No hay datos que migrar');
    return;
  }

  const oldData = oldSnap.val();
  const oldEntries = Object.entries(oldData);
  console.log(`📦 Encontrados ${oldEntries.length} registros en estructura antigua`);

  // 2. Consolidar por código de barras
  const consolidated = {};
  let duplicatesFound = 0;
  let skippedNoBarcode = 0;

  for (const [pushId, product] of oldEntries) {
    const barcode = product.codigoBarras?.trim();
    if (!barcode || barcode.length < 8) {
      console.warn(`⚠️ Producto sin código válido: ${product.nombre} (ID: ${pushId})`);
      skippedNoBarcode++;
      continue;
    }

    const safeCode = barcode.replace(/[.#$\[\]/]/g, '_');

    if (consolidated[safeCode]) {
      // ── DUPLICADO: sumar cajas, mantener datos más recientes ──
      duplicatesFound++;
      const existing = consolidated[safeCode];
      existing.stockTotal += parseInt(product.cajas) || 0;

      // Mantener la fecha de caducidad más próxima
      if (product.fechaCaducidad && (!existing.fechaCaducidad ||
          product.fechaCaducidad < existing.fechaCaducidad)) {
        existing.fechaCaducidad = product.fechaCaducidad;
      }

      // Mantener la actualización más reciente
      if (product.fechaActualizacion && (!existing.fechaActualizacion ||
          product.fechaActualizacion > existing.fechaActualizacion)) {
        existing.fechaActualizacion = product.fechaActualizacion;
        existing.actualizadoPor = product.actualizadoPor;
      }

      console.log(`  🔄 Duplicado consolidado: ${product.nombre} (+${product.cajas || 0} cajas)`);
    } else {
      // ── PRIMERA APARICIÓN ──
      consolidated[safeCode] = {
        nombre: product.nombre || 'Sin nombre',
        marca: product.marca || 'Otra',
        codigoBarras: barcode,
        piezasPorCaja: parseInt(product.piezasPorCaja) || 0,
        ubicacion: product.ubicacion || '',
        fechaCaducidad: product.fechaCaducidad || '',
        stockTotal: Math.max(0, parseInt(product.cajas) || 0),
        fechaCreacion: product.fechaCreacion || product.fechaActualizacion || getLocalISOString(),
        fechaActualizacion: product.fechaActualizacion || getLocalISOString(),
        creadoPor: product.creadoPor || product.actualizadoPor || 'migracion',
        actualizadoPor: product.actualizadoPor || 'migracion',
        ultimoRelleno: product.ultimoRelleno || null,
        ultimaVenta: product.ultimaVenta || null
      };
    }
  }

  const uniqueProducts = Object.keys(consolidated).length;
  console.log('');
  console.log('📊 Resumen de consolidación:');
  console.log(`  Total registros antiguos: ${oldEntries.length}`);
  console.log(`  Productos únicos: ${uniqueProducts}`);
  console.log(`  Duplicados consolidados: ${duplicatesFound}`);
  console.log(`  Saltados (sin código): ${skippedNoBarcode}`);
  console.log('');

  // 3. Confirmar antes de escribir
  const confirmMsg = `MIGRACIÓN A V2\n\n` +
    `Se migrarán ${uniqueProducts} productos únicos.\n` +
    `Se consolidarán ${duplicatesFound} duplicados.\n` +
    `${skippedNoBarcode} registros sin código serán omitidos.\n\n` +
    `Los datos antiguos NO se borrarán.\n\n` +
    `¿Continuar?`;

  if (!confirm(confirmMsg)) {
    console.log('❌ Migración cancelada por el usuario');
    return;
  }

  // 4. Escribir en la nueva estructura
  console.log('💾 Escribiendo en productos/' + det + '/ ...');

  const updates = {};
  for (const [safeCode, productData] of Object.entries(consolidated)) {
    updates[`productos/${det}/${safeCode}`] = productData;
  }

  try {
    await firebase.database().ref().update(updates);
    console.log('');
    console.log('═══════════════════════════════════════════');
    console.log('✅ MIGRACIÓN COMPLETADA CON ÉXITO');
    console.log(`   ${uniqueProducts} productos migrados a nueva estructura`);
    console.log(`   ${duplicatesFound} duplicados eliminados`);
    console.log('═══════════════════════════════════════════');

    alert(
      `✅ Migración completada\n\n` +
      `${uniqueProducts} productos migrados\n` +
      `${duplicatesFound} duplicados consolidados\n\n` +
      `Los datos antiguos siguen en inventario/${det}/\n` +
      `Puedes eliminarlos cuando verifiques que todo funciona.`
    );

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    alert('❌ Error en la migración: ' + error.message);
  }
}

// Exponer globalmente para ejecutar desde consola o botón
window.migrarInventarioAV2 = migrarInventarioAV2;

console.log('✅ migrate-to-v2.js cargado. Ejecuta migrarInventarioAV2() para iniciar.');
