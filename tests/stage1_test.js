/**
 * PRUEBA DE VALIDACIÓN - FASE 4C ETAPA 1
 * Simulación de la lógica transaccional de balanceo de stock.
 */

const RECEPTION = "🚚 POR ACOMODAR";

// Mock de btoa para Node.js
const btoa = (str) => Buffer.from(str).toString('base64');
const unescape = (str) => str;
const encodeURIComponent = (str) => str;

function generarLoteId(bodega, fechaCaducidad) {
  const b = (bodega || 'General').trim();
  const f = (fechaCaducidad || 'sin-fecha').trim();
  const raw = b + '_' + f;
  return btoa(unescape(encodeURIComponent(raw)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .substring(0, 30);
}

/**
 * Lógica pura de la transacción (Extraída de inventory-core.js)
 */
function simulateTransaction(currentProduct, bodegaDestino, loteDestinoId, cantidadACubrir) {
    if (!currentProduct || !currentProduct.lotes || typeof currentProduct.lotes !== 'object') {
        return { error: 'NO_STRUCTURE' };
    }

    const lotes = JSON.parse(JSON.stringify(currentProduct.lotes)); // Deep clone
    const loteDest = lotes[loteDestinoId];
    if (!loteDest) return { error: 'DEST_NOT_FOUND' };

    const loteOrigId = generarLoteId(RECEPTION, loteDest.fechaCaducidad || '');
    const loteOrig = lotes[loteOrigId];

    if (!loteOrig) return { error: 'ORIG_NOT_FOUND' };

    const stockDisponible = parseFloat(loteOrig.stock) || 0;
    const solicitado = parseFloat(cantidadACubrir) || 0;

    if (stockDisponible < solicitado - 0.001) return { error: 'INSUFFICIENT_STOCK' };

    // 1. Restar de recepción
    const nuevoStockOrig = parseFloat((stockDisponible - solicitado).toFixed(2));
    if (nuevoStockOrig <= 0.001) {
        delete lotes[loteOrigId];
    } else {
        lotes[loteOrigId].stock = nuevoStockOrig;
    }

    // 2. Sumar a bodega destino
    const stockDestinoActual = parseFloat(loteDest.stock) || 0;
    lotes[loteDestinoId].stock = parseFloat((stockDestinoActual + solicitado).toFixed(2));

    const updatedProduct = { ...currentProduct, lotes };
    return { success: true, updatedProduct };
}

function calculateTotal(product) {
    return Object.values(product.lotes).reduce((sum, l) => sum + (l.stock || 0), 0);
}

// --- RUN TESTS ---
console.log('🧪 Iniciando Pruebas de Núcleo Transaccional...');

const FECHA = '2027-01-10';
const LOTE_DEST_ID = generarLoteId('Bodega 12', FECHA);
const LOTE_ORIG_ID = generarLoteId(RECEPTION, FECHA);

const initialState = {
    nombre: "Pepsi 600ml",
    lotes: {
        [LOTE_DEST_ID]: { bodega: "Bodega 12", fechaCaducidad: FECHA, stock: 0 },
        [LOTE_ORIG_ID]: { bodega: RECEPTION, fechaCaducidad: FECHA, stock: 100 }
    }
};

const totalInicial = calculateTotal(initialState);

// PRUEBA A: Mover 20
console.log('\nPrueba A: Mover 20 de 100');
const resA = simulateTransaction(initialState, "Bodega 12", LOTE_DEST_ID, 20);
if (resA.updatedProduct.lotes[LOTE_ORIG_ID].stock === 80 && resA.updatedProduct.lotes[LOTE_DEST_ID].stock === 20) {
    console.log('✅ PASS: Quedan 80 en recepción.');
} else {
    console.error('❌ FAIL:', resA.updatedProduct.lotes);
}

// PRUEBA B: Mover 60 mas
console.log('Prueba B: Mover 60 adicionales');
const resB = simulateTransaction(resA.updatedProduct, "Bodega 12", LOTE_DEST_ID, 60);
if (resB.updatedProduct.lotes[LOTE_ORIG_ID].stock === 20 && resB.updatedProduct.lotes[LOTE_DEST_ID].stock === 80) {
    console.log('✅ PASS: Quedan 20 en recepción.');
} else {
    console.error('❌ FAIL:', resB.updatedProduct.lotes);
}

// PRUEBA C: Mover los ultimos 20 (Cierre total)
console.log('Prueba C: Mover últimos 20 (Eliminación de lote)');
const resC = simulateTransaction(resB.updatedProduct, "Bodega 12", LOTE_DEST_ID, 20);
if (!resC.updatedProduct.lotes[LOTE_ORIG_ID] && resC.updatedProduct.lotes[LOTE_DEST_ID].stock === 100) {
    console.log('✅ PASS: Lote temporal eliminado y stock destino es 100.');
} else {
    console.error('❌ FAIL:', resC.updatedProduct.lotes);
}

// PRUEBA D: Intentar mover mas de lo disponible
console.log('Prueba D: Intentar mover 101');
const resD = simulateTransaction(initialState, "Bodega 12", LOTE_DEST_ID, 101);
if (resD.error === 'INSUFFICIENT_STOCK') {
    console.log('✅ PASS: Operación rechazada correctamente.');
} else {
    console.error('❌ FAIL: Se permitió sobregiro.');
}

// PRUEBA F: Verificación de Invariante
console.log('Prueba F: Verificación de stockTotal');
if (calculateTotal(resA.updatedProduct) === totalInicial &&
    calculateTotal(resB.updatedProduct) === totalInicial &&
    calculateTotal(resC.updatedProduct) === totalInicial) {
    console.log('✅ PASS: El stockTotal se mantuvo en 100 en todas las operaciones.');
} else {
    console.error('❌ FAIL: Hubo fuga o creación de stock.');
}

console.log('\n🏁 PRUEBAS FINALIZADAS');
