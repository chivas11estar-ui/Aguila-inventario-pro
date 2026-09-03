import { QA_DETERMINANTE, calculateHashes, loadFixture, restoreQa, verifyRestoredState } from './qa-restore.mjs';
import { runWithGuaranteedRestore } from './qa-write-harness.mjs';
import { addProduct, createRuntime, productAt, state, submitRefill, totalStock } from './qa-functional-stress.mjs';

const results = [];
const TARGET_ZERO = 'QA-000000000001';
const TARGET_NORMAL = 'QA-000000000002';
const TARGET_MULTILOT = 'QA-000000000003';

function must(condition, message) {
  if (!condition) throw new Error(message);
}

function stable(value) {
  return JSON.stringify(value, Object.keys(value || {}).sort());
}

function movementMap(current) {
  return current.movimientos[QA_DETERMINANTE] || {};
}

function newMovements(before, after, code) {
  const previous = new Set(Object.keys(movementMap(before)));
  return Object.entries(movementMap(after))
    .filter(([key, movement]) => !previous.has(key) && (!code || movement.productoCodigo === code))
    .map(([key, movement]) => ({ key, ...movement }));
}

function confirmed(movements) {
  return movements.filter((movement) => movement.estadoOperacion === 'confirmed');
}

function movedBoxes(movements) {
  return movements.reduce((sum, movement) => sum + (Number(movement.cajasMovidas) || 0), 0);
}

function assertMovementMath(movements) {
  for (const movement of movements) {
    const boxes = Number(movement.cajasMovidas);
    const piecesPerBox = Number(movement.piezasPorCaja);
    must(Number(movement.piezasMovidas) === Math.round(boxes * piecesPerBox), 'PIECES_MOVED_MISMATCH');
  }
}

async function runTest(id, scenario, testFn, baselineHashes) {
  await restoreQa();
  let evidence = {};
  let failure = null;
  try {
    await runWithGuaranteedRestore(async () => {
      evidence = await testFn();
    });
  } catch (error) {
    failure = error;
  }
  const restoredHashes = await verifyRestoredState();
  const hashPass = stable(restoredHashes) === stable(baselineHashes);
  if (!hashPass && !failure) failure = new Error('RESTORE_HASH_MISMATCH');
  results.push({ id, scenario, status: failure ? 'FAIL' : 'PASS', evidence, restoredHashes, error: failure?.message || null });
}

async function repeatedIntent(id, count, label, baselineHashes) {
  await runTest(id, label, async () => {
    const before = await state();
    const runtime = await createRuntime();
    await submitRefill(runtime, TARGET_NORMAL, 1, 'exit', count);
    const after = await state();
    const movements = confirmed(newMovements(before, after, TARGET_NORMAL));
    const stock = totalStock(productAt(after, TARGET_NORMAL));
    assertMovementMath(movements);
    must(movements.length === 1, 'EXPECTED_ONE_MOVEMENT');
    must(movedBoxes(movements) === 1, 'EXPECTED_ONE_BOX_MOVED');
    must(stock === 39, 'EXPECTED_STOCK_39');
    must(new Set(movements.map((movement) => movement.operationId)).size === 1, 'EXPECTED_ONE_OPERATION_ID');
    return { events: count, stock, movementCount: movements.length, moved: movedBoxes(movements), operationId: movements[0].operationId };
  }, baselineHashes);
}

async function concurrentExit(id, scenario, code, initialStock, quantities, expected, baselineHashes) {
  await runTest(id, scenario, async () => {
    const before = await state();
    const runtimes = await Promise.all(quantities.map(() => createRuntime()));
    await Promise.all(runtimes.map((runtime, index) => submitRefill(runtime, code, quantities[index], 'exit')));
    const after = await state();
    const product = productAt(after, code);
    const stock = totalStock(product);
    const movements = confirmed(newMovements(before, after, code));
    const moved = movedBoxes(movements);
    const allNew = newMovements(before, after, code);
    assertMovementMath(movements);
    must(stock >= 0, 'NEGATIVE_STOCK');
    must(moved === initialStock - stock, 'MOVEMENT_STOCK_EFFECT_MISMATCH');
    must(allNew.length === movements.length, 'PENDING_OR_RECONCILIATION_MOVEMENT_LEFT');
    must(new Set(movements.map((movement) => movement.operationId)).size === movements.length, 'DUPLICATE_OPERATION_ID');
    expected({ stock, moved, movements });
    return { requested: quantities, stock, moved, movementCount: movements.length, operationIds: movements.map((movement) => movement.operationId) };
  }, baselineHashes);
}

async function main() {
  must(process.env.QA_MODE === 'true', 'QA_WRITE_BLOCKED: QA_MODE');
  const fixture = await loadFixture();
  const baselineHashes = calculateHashes(fixture.state);

  await runTest('T3A01', 'same lot accumulation: 10 + 5 = 15', async () => {
    const runtime = await createRuntime();
    const code = 'QA-3A-SAME-LOT-0001';
    await addProduct(runtime, { code, boxes: 10, ppc: 6, warehouse: 'QA_BODEGA_A', expiry: '2027-06-01' });
    await addProduct(runtime, { code, boxes: 5, ppc: 6, warehouse: 'QA_BODEGA_A', expiry: '2027-06-01' });
    const product = productAt(await state(), code);
    must(totalStock(product) === 15, 'EXPECTED_STOCK_15');
    must(Object.keys(product.lotes || {}).length === 1, 'DUPLICATE_LOGICAL_LOT');
    return { stock: totalStock(product), lots: Object.keys(product.lotes || {}).length };
  }, baselineHashes);

  await runTest('T3A02', 'concurrent arrival: 10 + 5 + 7 = 22', async () => {
    const setup = await createRuntime();
    const code = 'QA-3A-CONCURRENT-ARRIVAL-0001';
    const data = { code, ppc: 4, warehouse: 'QA_BODEGA_A', expiry: '2027-07-01' };
    await addProduct(setup, { ...data, boxes: 10 });
    const a = await createRuntime();
    const b = await createRuntime();
    await Promise.all([addProduct(a, { ...data, boxes: 5 }), addProduct(b, { ...data, boxes: 7 })]);
    const product = productAt(await state(), code);
    must(totalStock(product) === 22, 'EXPECTED_STOCK_22');
    must(Object.keys(product.lotes || {}).length === 1, 'DUPLICATE_LOGICAL_LOT');
    return { stock: totalStock(product), lots: Object.keys(product.lotes || {}).length };
  }, baselineHashes);

  await runTest('T3A03', 'stock zero direct refill: 0 -> direct 2', async () => {
    const before = await state();
    const runtime = await createRuntime();
    await submitRefill(runtime, TARGET_ZERO, 2, 'exit');
    const after = await state();
    const movements = confirmed(newMovements(before, after, TARGET_ZERO));
    must(totalStock(productAt(after, TARGET_ZERO)) === 0, 'WAREHOUSE_STOCK_CHANGED');
    must(movements.length === 1, 'EXPECTED_ONE_DIRECT_MOVEMENT');
    must(movements[0].tipo === 'entrada_directa_anaquel', 'DIRECT_TYPE_MISMATCH');
    must(movements[0].origenStock === 'entrada_directa_anaquel', 'DIRECT_ORIGIN_MISMATCH');
    must(movements[0].stockBodegaDescontado === false, 'WAREHOUSE_MARKER_MISMATCH');
    must(Number(movements[0].cajasMovidas) === 2, 'EXPECTED_TWO_BOXES');
    assertMovementMath(movements);
    return { stock: 0, movement: movements[0] };
  }, baselineHashes);

  await runTest('T3A04', 'zero direct 2 then warehouse arrival 4', async () => {
    const before = await state();
    const runtime = await createRuntime();
    await submitRefill(runtime, TARGET_ZERO, 2, 'exit');
    await submitRefill(runtime, TARGET_ZERO, 4, 'entry');
    const after = await state();
    const product = productAt(after, TARGET_ZERO);
    const movements = confirmed(newMovements(before, after, TARGET_ZERO));
    const malformed = Object.values(product.lotes || {}).filter((lot) => lot.bodega === undefined || lot.fechaCaducidad === undefined);
    must(totalStock(product) === 4, 'EXPECTED_WAREHOUSE_STOCK_4');
    must(Object.keys(product.lotes || {}).length === 1, 'UNEXPECTED_NEW_LOT');
    must(malformed.length === 0, 'MALFORMED_LOT');
    must(movements.length === 2, 'EXPECTED_TWO_SEMANTIC_MOVEMENTS');
    must(movements.filter((movement) => movement.tipo === 'entrada_directa_anaquel').length === 1, 'EXPECTED_ONE_DIRECT_MOVEMENT');
    must(movements.filter((movement) => movement.tipo === 'entrada').length === 1, 'EXPECTED_ONE_WAREHOUSE_ENTRY');
    assertMovementMath(movements);
    return { stock: totalStock(product), lots: Object.keys(product.lotes || {}).length, movementTypes: movements.map((movement) => movement.tipo) };
  }, baselineHashes);

  await repeatedIntent('T3A05', 2, 'double click: one human intent', baselineHashes);
  await repeatedIntent('T3A06', 5, 'five rapid submits: one human intent', baselineHashes);
  await repeatedIntent('T3A07', 2, 'Enter + click equivalent callbacks: one human intent', baselineHashes);
  await repeatedIntent('T3A08', 2, 'scanner + click equivalent callbacks: one human intent', baselineHashes);

  await runTest('T3A09', 'concurrent stock: 10 -> 6 + 6', async () => {
    const setup = await createRuntime();
    const code = 'QA-3A-CONCURRENT-STOCK-0001';
    await addProduct(setup, { code, boxes: 10, ppc: 1 });
    const before = await state();
    const a = await createRuntime();
    const b = await createRuntime();
    await Promise.all([submitRefill(a, code, 6, 'exit'), submitRefill(b, code, 6, 'exit')]);
    const after = await state();
    const stock = totalStock(productAt(after, code));
    const allNew = newMovements(before, after, code);
    const movements = confirmed(allNew);
    const moved = movedBoxes(movements);
    assertMovementMath(movements);
    must(stock === 4, 'EXPECTED_STOCK_4');
    must(movements.length === 1 && moved === 6, 'EXPECTED_ONLY_SIX_CONFIRMED');
    must(moved === 10 - stock, 'MOVEMENT_STOCK_EFFECT_MISMATCH');
    must(allNew.length === 1, 'PENDING_OR_RECONCILIATION_MOVEMENT_LEFT');
    return { stock, moved, movementCount: movements.length, operationId: movements[0].operationId };
  }, baselineHashes);

  await concurrentExit('T3A10', 'multilot concurrent: 25 -> 15 + 15', TARGET_MULTILOT, 25, [15, 15], ({ stock, moved, movements }) => {
    must(stock === 10 && moved === 15 && movements.length === 1, 'EXPECTED_ONLY_FIFTEEN_CONFIRMED');
  }, baselineHashes);

  await concurrentExit('T3A11', 'multilot concurrent: 25 -> 10 + 10', TARGET_MULTILOT, 25, [10, 10], ({ stock, moved, movements }) => {
    must(stock === 5 && moved === 20 && movements.length === 2, 'EXPECTED_TWENTY_CONFIRMED');
  }, baselineHashes);

  await concurrentExit('T3A12', 'multilot concurrent: 25 -> 25 + 1', TARGET_MULTILOT, 25, [25, 1], ({ stock, moved, movements }) => {
    must(movements.length === 1, 'EXPECTED_ONE_WINNER');
    must((stock === 0 && moved === 25) || (stock === 24 && moved === 1), 'UNEXPECTED_WINNER_EFFECT');
  }, baselineHashes);

  await restoreQa();
  const finalHashes = await verifyRestoredState(fixture);
  must(stable(finalHashes) === stable(baselineHashes), 'FINAL_HASH_MISMATCH');
  const pass = results.filter((result) => result.status === 'PASS').length;
  const fail = results.length - pass;
  console.log(JSON.stringify({ total: results.length, pass, fail, results, baselineHashes, finalHashes }));
  if (fail > 0) throw new Error('PHASE3A_INTEGRITY_TESTS_FAILED');
  console.log('PHASE3A_INTEGRITY_TESTS_PASS');
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});