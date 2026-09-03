import { calculateHashes, loadFixture, restoreQa, verifyRestoredState } from './qa-restore.mjs';
import { runWithGuaranteedRestore } from './qa-write-harness.mjs';
import { createRuntime, productAt, state, totalStock } from './qa-functional-stress.mjs';

const results = [];
const baselineProduct = 'QA-000000000002';

function must(condition, message) {
  if (!condition) throw new Error(message);
}

function stable(value) {
  return JSON.stringify(value, Object.keys(value || {}).sort());
}

function validForm(code, overrides = {}) {
  return {
    codigoBarras: code,
    nombre: 'PRODUCTO QA VALIDACION',
    marca: 'ÁGUILA QA',
    piezasPorCaja: 12,
    ubicacion: 'QA_BODEGA_VALIDACION',
    fechaCaducidad: '2027-08-15',
    cajas: 1,
    ...overrides
  };
}

async function expectReject(runtime, formData) {
  runtime.adapter.resetCounts();
  let error = null;
  try {
    await runtime.context.guardarProducto(formData);
  } catch (caught) {
    error = caught;
  }
  must(error, 'EXPECTED_VALIDATION_ERROR');
  return { error: error.message, writes: runtime.adapter.writes.length };
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
  if (stable(restoredHashes) !== stable(baselineHashes) && !failure) failure = new Error('RESTORE_HASH_MISMATCH');
  results.push({ id, scenario, status: failure ? 'FAIL' : 'PASS', evidence, error: failure?.message || null, restoredHashes });
}

async function main() {
  must(process.env.QA_MODE === 'true', 'QA_WRITE_BLOCKED: QA_MODE');
  const fixture = await loadFixture();
  const baselineHashes = calculateHashes(fixture.state);

  await runTest('T3B01', 'stock de lote se etiqueta como cajas', async () => {
    const runtime = await createRuntime();
    await runtime.context.searchProductForRefillSafe(baselineProduct);
    const html = runtime.elements.get('refill-product-info').innerHTML;
    must(/40 cajas/.test(html), 'LOT_STOCK_NOT_LABELED_AS_BOXES');
    must(!/40 pzs/.test(html), 'LOT_STOCK_WRONGLY_LABELED_AS_PIECES');
    return { rendered: html.replace(/\s+/g, ' ').slice(0, 180) };
  }, baselineHashes);

  await runTest('T3B02', 'Agregar cajas 1.5 rechazado', async () => {
    const before = await state();
    const runtime = await createRuntime();
    const evidence = await expectReject(runtime, validForm('QA-3B-DECIMAL-0001', { cajas: '1.5' }));
    const after = await state();
    must(stable(calculateHashes(after)) === stable(calculateHashes(before)), 'INVALID_DECIMAL_CHANGED_STATE');
    must(evidence.writes === 0, 'INVALID_DECIMAL_WROTE');
    return evidence;
  }, baselineHashes);

  await runTest('T3B03', 'Agregar cajas -1 rechazado', async () => {
    const before = await state();
    const runtime = await createRuntime();
    const evidence = await expectReject(runtime, validForm('QA-3B-NEGATIVE-0001', { cajas: -1 }));
    must(stable(calculateHashes(await state())) === stable(calculateHashes(before)), 'NEGATIVE_CHANGED_STATE');
    must(evidence.writes === 0, 'NEGATIVE_WROTE');
    return evidence;
  }, baselineHashes);

  await runTest('T3B04', 'Agregar cajas 0 conserva la regla actual', async () => {
    const runtime = await createRuntime();
    const code = 'QA-3B-ZERO-0001';
    await runtime.context.guardarProducto(validForm(code, { cajas: 0 }));
    const product = productAt(await state(), code);
    must(product && totalStock(product) === 0, 'ZERO_ADD_BEHAVIOR_CHANGED');
    return { productExists: !!product, stock: totalStock(product) };
  }, baselineHashes);

  await runTest('T3B05', 'Relleno 0 rechazado', async () => {
    const before = await state();
    const runtime = await createRuntime();
    await runtime.context.searchProductForRefillSafe(baselineProduct);
    runtime.elements.get('refill-boxes').value = '0';
    runtime.elements.get('refill-pieces').value = '0';
    runtime.adapter.resetCounts();
    const result = await runtime.context.handleRefillSubmitSafe({ preventDefault() {} });
    must(result.success === false && result.reason === 'INVALID_QUANTITY', 'ZERO_REFILL_NOT_REJECTED');
    must(runtime.adapter.writes.length === 0, 'ZERO_REFILL_WROTE');
    must(stable(calculateHashes(await state())) === stable(calculateHashes(before)), 'ZERO_REFILL_CHANGED_STATE');
    return { reason: result.reason, writes: runtime.adapter.writes.length };
  }, baselineHashes);

  for (const [id, value] of [['T3B06', 0], ['T3B07', -1], ['T3B08', '1.5']]) {
    await runTest(id, 'piezasPorCaja ' + value + ' rechazado', async () => {
      const before = await state();
      const runtime = await createRuntime();
      const evidence = await expectReject(runtime, validForm('QA-3B-PPC-' + id + '-0001', { piezasPorCaja: value }));
      must(evidence.writes === 0, 'INVALID_PPC_WROTE');
      must(stable(calculateHashes(await state())) === stable(calculateHashes(before)), 'INVALID_PPC_CHANGED_STATE');
      return evidence;
    }, baselineHashes);
  }

  await runTest('T3B09', 'fecha 2026-02-30 rechazada', async () => {
    const runtime = await createRuntime();
    const evidence = await expectReject(runtime, validForm('QA-3B-BAD-DATE-0001', { fechaCaducidad: '2026-02-30' }));
    must(evidence.writes === 0, 'INVALID_DATE_WROTE');
    return evidence;
  }, baselineHashes);

  await runTest('T3B10', 'fecha ISO válida aceptada', async () => {
    const runtime = await createRuntime();
    const code = 'QA-3B-VALID-DATE-0001';
    await runtime.context.guardarProducto(validForm(code, { fechaCaducidad: '2028-02-29', cajas: 2 }));
    const lot = Object.values(productAt(await state(), code).lotes)[0];
    must(lot.fechaCaducidad === '2028-02-29' && Number(lot.stock) === 2, 'VALID_DATE_NOT_PERSISTED');
    return { fechaCaducidad: lot.fechaCaducidad, stock: lot.stock };
  }, baselineHashes);

  await runTest('T3B11', 'inputs críticos vacíos, texto e Infinity rechazados', async () => {
    const before = await state();
    const cases = [
      { cajas: '' },
      { piezasPorCaja: '' },
      { fechaCaducidad: '' },
      { piezasPorCaja: 'texto' },
      { piezasPorCaja: Infinity }
    ];
    const runtime = await createRuntime();
    const evidence = [];
    for (let index = 0; index < cases.length; index += 1) evidence.push(await expectReject(runtime, validForm('QA-3B-EMPTY-' + index + '-0001', cases[index])));
    must(evidence.every((item) => item.writes === 0), 'CRITICAL_EMPTY_WROTE');
    must(stable(calculateHashes(await state())) === stable(calculateHashes(before)), 'CRITICAL_EMPTY_CHANGED_STATE');
    return { rejections: evidence.map((item) => item.error) };
  }, baselineHashes);

  await runTest('T3B12', 'sin escritura ante validación fallida', async () => {
    const before = await state();
    const runtime = await createRuntime();
    const evidence = await expectReject(runtime, validForm('QA-3B-NO-WRITE-0001', { cajas: '-0.5' }));
    const after = await state();
    must(evidence.writes === 0, 'VALIDATION_FAILURE_WROTE');
    must(stable(calculateHashes(after)) === stable(calculateHashes(before)), 'VALIDATION_FAILURE_CHANGED_STATE');
    return evidence;
  }, baselineHashes);

  await restoreQa();
  const finalHashes = await verifyRestoredState(fixture);
  must(stable(finalHashes) === stable(baselineHashes), 'FINAL_HASH_MISMATCH');
  const pass = results.filter((result) => result.status === 'PASS').length;
  const fail = results.length - pass;
  console.log(JSON.stringify({ total: results.length, pass, fail, results, baselineHashes, finalHashes }));
  if (fail > 0) throw new Error('PHASE3B_VALIDATION_TESTS_FAILED');
  console.log('PHASE3B_VALIDATION_TESTS_PASS');
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});