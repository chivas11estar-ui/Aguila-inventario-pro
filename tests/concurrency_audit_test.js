/**
 * PRUEBA DE CONCURRENCIA REAL - FASE 4C
 * Implementa un mock de Firebase transaction() con reintentos por versión.
 */

const RECEPTION = "📥 Recepción";
const btoa = (str) => Buffer.from(str).toString('base64');
function generarLoteId(bodega, fechaCaducidad) {
  const b = (bodega || 'General').trim();
  const f = (fechaCaducidad || 'sin-fecha').trim();
  const raw = b + '_' + f;
  return btoa(raw).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_').substring(0, 30);
}

// --- MOCK DATABASE ENGINE ---
class MockDB {
    constructor(initialData) {
        this.data = JSON.parse(JSON.stringify(initialData));
        this.version = 0;
        this.stats = { transactions: 0, retries: 0, failures: 0 };
    }

    async transaction(path, updateFn) {
        const maxAttempts = 10;
        let attempts = 0;

        while (attempts < maxAttempts) {
            attempts++;
            this.stats.transactions++;

            const currentVersion = this.version;
            const currentData = JSON.parse(JSON.stringify(this.data)); // "Snapshot"

            // Simular delay de red/procesamiento para forzar colisiones
            await new Promise(r => setTimeout(r, Math.random() * 50));

            const newData = updateFn(currentData);

            if (newData === undefined) return { committed: false, snapshot: currentData };

            // Verificación de versión (Optimistic Concurrency Control)
            if (this.version === currentVersion) {
                this.data = JSON.parse(JSON.stringify(newData));
                this.version++;
                return { committed: true, snapshot: this.data };
            } else {
                this.stats.retries++;
                // console.log(`🔄 Reintentando transacción en ${path} (intento ${attempts})`);
            }
        }
        this.stats.failures++;
        throw new Error('MAX_RETRIES_EXCEEDED');
    }
}

// --- LOGICA DE NEGOCIO (Mocks de Core) ---
async function asignarStockDesdeRecepcion(db, codigo, bodegaDest, loteDestId, cantidad) {
    let moved = 0;
    const res = await db.transaction(`productos/${codigo}`, (currentProduct) => {
        const prod = currentProduct[codigo];
        if (!prod || !prod.lotes) return undefined;

        const lotes = prod.lotes;
        const loteDest = lotes[loteDestId];
        if (!loteDest) return undefined;

        const loteOrigId = generarLoteId(RECEPTION, loteDest.fechaCaducidad);
        const loteOrig = lotes[loteOrigId];

        if (!loteOrig) {
            moved = 0;
            return undefined;
        }

        const stockDisponible = parseFloat(loteOrig.stock) || 0;
        const solicitado = parseFloat(cantidad) || 0;
        const aMoverReal = Math.min(stockDisponible, solicitado);

        if (aMoverReal <= 0.001) {
            moved = 0;
            return undefined;
        }

        moved = aMoverReal;

        loteOrig.stock = parseFloat((stockDisponible - aMoverReal).toFixed(2));
        if (loteOrig.stock <= 0.001) delete lotes[loteOrigId];

        loteDest.stock = parseFloat((loteDest.stock + aMoverReal).toFixed(2));

        return currentProduct;
    });
    return { ...res, moved };
}

async function modificarStock(db, codigo, qty, operacion, loteId) {
    return db.transaction(`productos/${codigo}`, (currentProduct) => {
        const prod = currentProduct[codigo];
        if (!prod || !prod.lotes || !prod.lotes[loteId]) return undefined;

        if (operacion === 'establecer') {
            prod.lotes[loteId].stock = qty;
        } else if (operacion === 'sumar') {
            prod.lotes[loteId].stock = parseFloat((prod.lotes[loteId].stock + qty).toFixed(2));
        }

        return currentProduct;
    });
}

/**
 * Versión simplificada de saveQuickAudit para el test
 */
async function saveQuickAuditItem(db, item, warehouse) {
    const safeCode = item.codigoBarras;

    // 1. Lectura de snapshot (Simula buscarProductoPorCodigo)
    const snapshot = JSON.parse(JSON.stringify(db.data[safeCode]));
    const lotes = snapshot.lotes || {};
    const stockActualBodega = item.loteId ? (lotes[item.loteId]?.stock || 0) : 0;
    const loteRecId = generarLoteId(RECEPTION, item.fechaCaducidad);
    const stockRecepcion = lotes[loteRecId]?.stock || 0;

    const diferencia = item.quantity - stockActualBodega;

    if (diferencia > 0 && stockRecepcion > 0) {
        const aMover = Math.min(diferencia, stockRecepcion);

        const res = await asignarStockDesdeRecepcion(db, safeCode, warehouse, item.loteId, aMover);

        if (res.committed) {
            const finalExpected = stockActualBodega + res.moved;
            if (Math.abs(item.quantity - finalExpected) > 0.001) {
                await modificarStock(db, safeCode, item.quantity, 'establecer', item.loteId);
            }
        } else {
            // Si la asignación falló (ej. otro ya se llevó la recepción), hacemos ajuste directo
            await modificarStock(db, safeCode, item.quantity, 'establecer', item.loteId);
        }
    } else {
        await modificarStock(db, safeCode, item.quantity, 'establecer', item.loteId);
    }
}

// --- RUN TESTS ---
async function runTests() {
    console.log('🧪 Iniciando Pruebas de Concurrencia Real...');

    const FECHA = '2027-01-10';
    const LOTE_B1_ID = generarLoteId('Bodega 1', FECHA);
    const LOTE_B2_ID = generarLoteId('Bodega 2', FECHA);
    const LOTE_REC_ID = generarLoteId(RECEPTION, FECHA);

    const setup = () => new MockDB({
        "PEPSI": {
            lotes: {
                [LOTE_B1_ID]: { bodega: "Bodega 1", fechaCaducidad: FECHA, stock: 0 },
                [LOTE_B2_ID]: { bodega: "Bodega 2", fechaCaducidad: FECHA, stock: 0 },
                [LOTE_REC_ID]: { bodega: RECEPTION, fechaCaducidad: FECHA, stock: 100 }
            }
        }
    });

    // ESCENARIO 1: Suma excede recepción (120 vs 100)
    console.log('\nEscenario 1: Suma excede recepción (60+60 vs 100)');
    const db1 = setup();
    const auditA = { codigoBarras: "PEPSI", loteId: LOTE_B1_ID, quantity: 60, fechaCaducidad: FECHA };
    const auditB = { codigoBarras: "PEPSI", loteId: LOTE_B2_ID, quantity: 60, fechaCaducidad: FECHA };

    await Promise.all([
        saveQuickAuditItem(db1, auditA, "Bodega 1"),
        saveQuickAuditItem(db1, auditB, "Bodega 2")
    ]);

    const finalPepsi1 = db1.data["PEPSI"];
    const total1 = Object.values(finalPepsi1.lotes).reduce((s, l) => s + l.stock, 0);
    console.log(`Final: B1=${finalPepsi1.lotes[LOTE_B1_ID].stock}, B2=${finalPepsi1.lotes[LOTE_B2_ID].stock}, Total=${total1}`);

    if (total1 === 120 && !finalPepsi1.lotes[LOTE_REC_ID]) {
        console.log('✅ PASS: Uno consumió el resto de recepción y ambos llegaron a 60 sin perder stock.');
    } else {
        console.error('❌ FAIL: Stock inconsistente');
    }

    // ESCENARIO 2: Cabe exactamente (40+60 vs 100)
    console.log('\nEscenario 2: Cabe exactamente (40+60 vs 100)');
    const db2 = setup();
    const auditC = { codigoBarras: "PEPSI", loteId: LOTE_B1_ID, quantity: 40, fechaCaducidad: FECHA };
    const auditD = { codigoBarras: "PEPSI", loteId: LOTE_B2_ID, quantity: 60, fechaCaducidad: FECHA };

    await Promise.all([
        saveQuickAuditItem(db2, auditC, "Bodega 1"),
        saveQuickAuditItem(db2, auditD, "Bodega 2")
    ]);

    const finalPepsi2 = db2.data["PEPSI"];
    const total2 = Object.values(finalPepsi2.lotes).reduce((s, l) => s + l.stock, 0);
    console.log(`Final: B1=${finalPepsi2.lotes[LOTE_B1_ID].stock}, B2=${finalPepsi2.lotes[LOTE_B2_ID].stock}, Total=${total2}`);

    if (total2 === 100 && !finalPepsi2.lotes[LOTE_REC_ID]) {
        console.log('✅ PASS: Ambos consumieron la recepción exactos.');
    } else {
        console.error('❌ FAIL: Stock inconsistente');
    }

    console.log('\n📊 Estadísticas del Mock DB:', db2.stats);
    console.log('\n🏁 PRUEBAS FINALIZADAS');
}

runTests();
