// ============================================================
// Águila Inventario Pro - Módulo: restocking-tracker.js
// Sistema de Seguimiento de Rellenos Diarios
// Calcula promedios DÍA, SEM, MES automáticamente
// Copyright © 2025 José A. G. Betancourt
// ============================================================

window.RESTOCKING_DATA = {
    rellenos: {}, // { productId: { date: boxes, ... } }
    promedios: {} // { productId: { dia: 0, sem: 0, mes: 0 } }
  };

// ============================================================
// REGISTRAR UN RELLENO DIARIO
// ============================================================
window.registrarRelleno = async (productId, cajas, fecha = new Date()) => {
    try {
          const storeId = '5232';
          const dateKey = fecha.toISOString().split('T')[0];
          const db = firebase.database();

          // Guardar en Firebase
          const path = `restockings/${storeId}/${productId}/${dateKey}`;
          await db.ref(path).set({
                  cajas: parseFloat(cajas),
                  timestamp: firebase.database.ServerValue.TIMESTAMP,
                  fecha: dateKey
                });

          console.log(`✅ Relleno registrado: ${productId} - ${cajas} cajas en ${dateKey}`);

          // Recalcular promedios
          await window.calcularPromediosexactos(productId);

          return true;
        } catch (error) {
          console.error(`❌ Error registrando relleno: ${error.message}`);
          return false;
        }
  };

// ============================================================
// CALCULAR PROMEDIOS EXACTOS (DÍA, SEM, MES)
// ============================================================
window.calcularPromediosexactos = async (productId) => {
    try {
          const storeId = '5232';
          const db = firebase.database();

          // Obtener todos los rellenos del producto
          const snapshot = await db.ref(`restockings/${storeId}/${productId}`).once('value');
          const rellenos = snapshot.val() || {};

          if (Object.keys(rellenos).length === 0) {
                  console.log(`⚠️ No hay datos de relleno para ${productId}`);
                  return { dia: 0, sem: 0, mes: 0 };
                }

          // Convertir a array y ordenar por fecha
          const registros = Object.entries(rellenos)
            .map(([fecha, data]) => ({ fecha, cajas: data.cajas || 0 }))
            .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

          const hoy = new Date();
          const hace7dias = new Date(hoy.getTime() - 7 * 24 * 60 * 60 * 1000);
          const hace30dias = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000);

          // Filtrar por rangos
          const ultimosDias = registros.filter(r => new Date(r.fecha) >= hace7dias);
          const ultimos30dias = registros.filter(r => new Date(r.fecha) >= hace30dias);

          // Calcular promedios EXACTOS
          const sumaDias = ultimosDias.reduce((acc, r) => acc + r.cajas, 0);
          const diasConRelleno = ultimosDias.length || 1;
          const diarioPromedio = sumaDias / diasConRelleno;

          const sumaSemanal = ultimosDias.reduce((acc, r) => acc + r.cajas, 0);
          const semanal = sumaSemanal; // Total de la semana

          const suma30dias = ultimos30dias.reduce((acc, r) => acc + r.cajas, 0);
          const mensualPromedio = (suma30dias / 30) * 30; // Proyección a 30 días

          const promedios = {
                  dia: Math.round(diarioPromedio * 100) / 100, // 2 decimales
                  sem: Math.round(semanal * 100) / 100,
                  mes: Math.round(mensualPromedio * 100) / 100
                };

          // Guardar promedios calculados
          await db.ref(`promedios/${storeId}/${productId}`).set(promedios);

          window.RESTOCKING_DATA.promedios[productId] = promedios;

          console.log(`📊 Promedios actualizados (${productId}):`, promedios);

          return promedios;
        } catch (error) {
          console.error(`❌ Error calculando promedios: ${error.message}`);
          return { dia: 0, sem: 0, mes: 0 };
        }
  };

// ============================================================
// CARGAR TODOS LOS PROMEDIOS
// ============================================================
window.cargarTodosLosPromedios = async () => {
    try {
          const storeId = '5232';
          const db = firebase.database();

          const snapshot = await db.ref(`promedios/${storeId}`).once('value');
          const promedios = snapshot.val() || {};

          window.RESTOCKING_DATA.promedios = promedios;

          console.log(`✅ [RESTOCKING] Promedios cargados: ${Object.keys(promedios).length} productos`);

          // Disparar evento de actualización
          document.dispatchEvent(new CustomEvent('promedioscargados', { detail: promedios }));

          return promedios;
        } catch (error) {
          console.error(`❌ Error cargando promedios: ${error.message}`);
          return {};
        }
  };

// ============================================================
// OBTENER PROMEDIO DE UN PRODUCTO
// ============================================================
window.obtenerPromedio = (productId) => {
    return window.RESTOCKING_DATA.promedios[productId] || { dia: 0, sem: 0, mes: 0 };
  };

// ============================================================
// INICIALIZACIÓN
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    if (window.firebaseInitialized) {
          await window.cargarTodosLosPromedios();
        }
  });

console.log('✅ restocking-tracker.js V1.0 cargado correctamente');
