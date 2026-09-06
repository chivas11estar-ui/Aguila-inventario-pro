/**
 * PRUEBA DE VALIDACIÓN - FASE 4C saveQuickAudit Refactor
 */

const RECEPTION = "📥 Recepción";

// Mocks
const btoa = (str) => Buffer.from(str).toString('base64');
function generarLoteId(bodega, fechaCaducidad) {
  const b = (bodega || 'General').trim();
  const f = (fechaCaducidad || 'sin-fecha').trim();
  const raw = b + '_' + f;
  return btoa(raw).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_').substring(0, 30);
}

/**
 * Simulación de asignarStockDesdeRecepcion
 */
function simulateAsignarStock(product, loteDestId, cantidad) {
    const lotes = JSON.parse(JSON.stringify(product.lotes));
    const loteDest = lotes[loteDestId];
    const loteOrigId = generarLoteId(RECEPTION, loteDest.fechaCaducidad);
    const loteOrig = lotes[loteOrigId];

    if (!loteOrig || loteOrig.stock < cantidad) throw new Error('INSUFFICIENT_RECEPTION');

    loteOrig.stock = parseFloat((loteOrig.stock - cantidad).toFixed(2));
    if (loteOrig.stock <= 0.001) delete lotes[loteOrigId];

    loteDest.stock = parseFloat((loteDest.stock + cantidad).toFixed(2));

    return { ...product, lotes };
}

/**
 * Simulación de modificarStock con 'establecer'
 */
function simulateModificarStock(product, loteId, qty) {
    const lotes = JSON.parse(JSON.stringify(product.lotes));
    if (!lotes[loteId]) throw new Error('LOTE_NOT_FOUND');
    lotes[loteId].stock = qty;
    return { ...product, lotes };
}

async function simulateSaveQuickAudit(items, db, warehouse) {
    let success = 0;
    let fail = 0;
    let currentDb = JSON.parse(JSON.stringify(db));

    for (const item of items) {
        try {
            const product = currentDb[item.codigoBarras];
            const stockActualBodega = item.loteId ? (product.lotes[item.loteId]?.stock || 0) : 0;
            const loteRecepcionId = generarLoteId(RECEPTION, item.fechaCaducidad);
            const stockRecepcion = product.lotes[loteRecepcionId]?.stock || 0;
            const diferencia = item.quantity - stockActualBodega;

            if (diferencia > 0 && stockRecepcion > 0) {
                const aMover = Math.min(diferencia, stockRecepcion);
                currentDb[item.codigoBarras] = simulateAsignarStock(product, item.loteId, aMover);

                const finalExpected = stockActualBodega + aMover;
                if (Math.abs(item.quantity - finalExpected) > 0.001) {
                    currentDb[item.codigoBarras] = simulateModificarStock(currentDb[item.codigoBarras], item.loteId, item.quantity);
                }
            } else {
                currentDb[item.codigoBarras] = simulateModificarStock(product, item.loteId, item.quantity);
            }
            success++;
        } catch (e) {
            fail++;
        }
    }
    return { success, fail, updatedDb: currentDb };
}

// --- RUN TESTS ---
console.log('🧪 Iniciando Pruebas de saveQuickAudit Refactor...');

const FECHA = '2027-01-10';
const LOTE_B1_ID = generarLoteId('Bodega 1', FECHA);
const LOTE_B2_ID = generarLoteId('Bodega 2', FECHA);
const LOTE_REC_ID = generarLoteId(RECEPTION, FECHA);

const initialDb = {
    "12345678": {
        nombre: "Pepsi",
        codigoBarras: "12345678",
        lotes: {
            [LOTE_B1_ID]: { bodega: "Bodega 1", fechaCaducidad: FECHA, stock: 0 },
            [LOTE_REC_ID]: { bodega: RECEPTION, fechaCaducidad: FECHA, stock: 100 }
        }
    },
    "87654321": {
        nombre: "Sabritas",
        codigoBarras: "87654321",
        lotes: {
            [LOTE_B1_ID]: { bodega: "Bodega 1", fechaCaducidad: FECHA, stock: 10 }
        }
    }
};

// PRUEBA (a): Lote con uno que falla y otros que pasan
console.log('\nPrueba (a): Batch con éxito y fallo individual');
const itemsA = [
    { codigoBarras: "12345678", loteId: LOTE_B1_ID, quantity: 50, fechaCaducidad: FECHA }, // Pasa: jala 50 de rec
    { codigoBarras: "87654321", loteId: "NON_EXISTENT", quantity: 20, fechaCaducidad: FECHA } // Falla: lote no existe
];

simulateSaveQuickAudit(itemsA, initialDb, "Bodega 1").then(res => {
    if (res.success === 1 && res.fail === 1 && res.updatedDb["12345678"].lotes[LOTE_B1_ID].stock === 50) {
        console.log('✅ PASS: Uno exitoso, uno fallido. Pepsi actualizada.');
    } else {
        console.error('❌ FAIL:', res);
    }
});

// PRUEBA (b): Concurrencia simulada (Dos auditorías a la misma Recepción)
console.log('Prueba (b): Concurrencia sobre la misma Recepción');
const itemsB1 = [{ codigoBarras: "12345678", loteId: LOTE_B1_ID, quantity: 60, fechaCaducidad: FECHA }];
const itemsB2 = [{ codigoBarras: "12345678", loteId: LOTE_B2_ID, quantity: 60, fechaCaducidad: FECHA }];

// Simular secuencial para ver si detecta falta de stock (la transacción real de Firebase lo haría)
async function testConcurrency() {
    const state1 = await simulateSaveQuickAudit(itemsB1, initialDb, "Bodega 1");
    // En state1: B1=60, REC=40

    // Preparar DB para state2 incluyendo el lote B2 (vacío)
    const db2 = JSON.parse(JSON.stringify(state1.updatedDb));
    db2["12345678"].lotes[LOTE_B2_ID] = { bodega: "Bodega 2", fechaCaducidad: FECHA, stock: 0 };

    const state2 = await simulateSaveQuickAudit(itemsB2, db2, "Bodega 2");
    // En state2: Debería fallar la parte de asignarStock o jalar solo 40

    const finalPepsi = state2.updatedDb["12345678"];
    const total = Object.values(finalPepsi.lotes).reduce((s, l) => s + l.stock, 0);

    if (total === 120 && !finalPepsi.lotes[LOTE_REC_ID]) {
        console.log('✅ PASS: Invariante mantenido. 100 de recepción consumidos + 20 excedente.');
    } else {
        console.error('❌ FAIL: Stock inconsistente', finalPepsi.lotes);
    }
}
testConcurrency();
