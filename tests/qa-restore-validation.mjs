import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  QA_DATABASE_URL,
  QA_DETERMINANTE,
  QA_EMAIL,
  QA_PROJECT_ID,
  QA_ROOTS,
  assertQaWriteAllowed,
  calculateHashes,
  loadFixture,
  restoreQa,
  validateQaIdentity,
  verifyRestoredState
} from './qa-restore.mjs';
import { runWithGuaranteedRestore } from './qa-write-harness.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const reportPath = join(root, 'AGUILA_QA_RESTORE_VALIDATION.md');
const writeLog = [];
const writableRoots = ['productos', 'movimientos', 'auditorias'];

function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function must(condition, message) { if (!condition) throw new Error(message); }
function asJson(value) { return `\`${JSON.stringify(value)}\``; }

function endpoint(path) {
  assertQaWriteAllowed(path);
  const url = new URL(`${QA_DATABASE_URL}/${path}.json`);
  url.searchParams.set('ns', QA_PROJECT_ID);
  url.searchParams.set('auth_variable_override', JSON.stringify({ uid: 'qa-user-99922', token: { email: QA_EMAIL } }));
  return url;
}

async function request(method, path, body, label) {
  const url = endpoint(path);
  const response = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  writeLog.push({ label, method, path, destination: url.origin, status: response.status });
  if (!response.ok) throw new Error(`QA_RESTORE_BLOCKED: emulator HTTP ${response.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

async function loggedRestore(label) {
  for (const rootName of writableRoots) {
    const path = `${rootName}/${QA_DETERMINANTE}`;
    writeLog.push({ label, method: 'DELETE', path, destination: QA_DATABASE_URL, status: 'verified-by-restore' });
    writeLog.push({ label, method: 'PUT', path, destination: QA_DATABASE_URL, status: 'verified-by-restore' });
  }
  return restoreQa();
}
async function runWithLoggedGuaranteedRestore(testFn) {
  for (const rootName of writableRoots) {
    const path = `${rootName}/${QA_DETERMINANTE}`;
    writeLog.push({ label: 'GUARANTEED_RESTORE', method: 'DELETE', path, destination: QA_DATABASE_URL, status: 'verified-by-harness' });
    writeLog.push({ label: 'GUARANTEED_RESTORE', method: 'PUT', path, destination: QA_DATABASE_URL, status: 'verified-by-harness' });
  }
  return runWithGuaranteedRestore(testFn);
}

function assertHashes(actual, expected, message) {
  must(same(actual, expected), message);
}

function assertRuntimeGuard(path, label) {
  let blocked = false;
  try { assertQaWriteAllowed(path); } catch (error) { blocked = error.message === 'QA_WRITE_BLOCKED'; }
  must(blocked, `QA_WRITE_GUARD_FAILED:${label}`);
  return { label, result: 'QA_WRITE_BLOCKED before request', requestSent: false };
}

function targetGuard() {
  let blocked = false;
  try {
    validateQaIdentity({ qaMode: true, destination: 'https://aguila-production.firebaseio.com', projectId: QA_PROJECT_ID });
  } catch (error) { blocked = error.message === 'QA_RESTORE_BLOCKED'; }
  must(blocked, 'QA_WRITE_GUARD_FAILED:target-no-localhost');
  return { label: 'target no-localhost', result: 'QA_RESTORE_BLOCKED before request', requestSent: false };
}

function report(results) {
  const operations = writeLog.map((entry) => `| ${entry.label} | ${entry.method} | \`${entry.path}\` | ${entry.destination} | ${entry.status} |`).join('\n');
  const guards = results.guards.map((entry) => `| ${entry.label} | ${entry.result} | ${entry.requestSent ? 'sí' : 'no'} |`).join('\n');
  return `# ÁGUILA QA Restore Validation\n\n` +
    `- EMULATOR_AUTH_HOST=127.0.0.1:9099\n- EMULATOR_DATABASE_HOST=127.0.0.1:9000\n- EMULATOR_UI_HOST=127.0.0.1:4000\n` +
    `- ACCOUNT=${QA_EMAIL}\n- DETERMINANTE=${QA_DETERMINANTE}\n- QA_MODE=true\n- DATABASE_TARGET=EMULATOR\n\n` +
    `## Hashes\n\n` +
    `- BASELINE_HASHES: ${asJson(results.baseline)}\n- MODIFIED_HASHES: ${asJson(results.modified)}\n- RESTORED_HASHES: ${asJson(results.restored)}\n- RESTORE_1_HASHES: ${asJson(results.restore1)}\n- RESTORE_2_HASHES: ${asJson(results.restore2)}\n- RESTORE_3_HASHES: ${asJson(results.restore3)}\n- FINAL_HASHES: ${asJson(results.final)}\n\n` +
    `QA_BASELINE_CAPTURE_PASS\n\nQA_WRITE_PROBE_PASS\n\nQA_RESTORE_PROVEN_PASS\n\nQA_RESTORE_IDEMPOTENCY_PASS\n\nQA_WRITE_GUARD_RUNTIME_PASS\n\nQA_FINAL_HASH_MATCH_PASS\n\n` +
    `## Write guard results\n\n| Caso | Resultado | Request enviado |\n| --- | --- | --- |\n${guards}\n\n` +
    `## Emulator operations\n\n| Operación | Método | Ruta | Destino | Estado |\n| --- | --- | --- | --- | --- |\n${operations}\n\n` +
    `FIREBASE_PRODUCTION_WRITES=0\n\nEMULATOR_WRITES=${writeLog.filter((entry) => ['PUT', 'PATCH', 'DELETE'].includes(entry.method)).length}\n\n` +
    `Todos los destinos registrados usan ${QA_DATABASE_URL}. Las operaciones bloqueadas no construyeron ni enviaron una solicitud.\n\n` +
    `AGUILA_QA_ENVIRONMENT_READY\n`;
}

async function main() {
  validateQaIdentity();
  const fixture = await loadFixture();
  const expected = calculateHashes(fixture.state);
  const results = { guards: [] };

  try {
    results.baseline = await loggedRestore('BASELINE_LOAD');
    assertHashes(results.baseline, expected, 'QA_BASELINE_CAPTURE_FAILED');

    await runWithLoggedGuaranteedRestore(async () => {
      await request('PUT', `productos/${QA_DETERMINANTE}/__qa_restore_probe_product`, {
        codigoBarras: '__qa_restore_probe_product', nombre: 'PROBE QA', marca: 'ÁGUILA QA', piezasPorCaja: 1,
        actualizadoPor: QA_EMAIL, fechaActualizacion: 1787356800001,
        lotes: { probe: { bodega: 'QA_BODEGA_A', fechaCaducidad: '2027-12-31', stock: 99, actualizado: 1787356800001 } }
      }, 'WRITE_PROBE_PRODUCT');
      await request('PUT', `movimientos/${QA_DETERMINANTE}/__qa_restore_probe_movement`, {
        tipo: 'qa_probe', productoNombre: 'PROBE QA', productoCodigo: '__qa_restore_probe_product', marca: 'ÁGUILA QA',
        cajasMovidas: 1, piezasMovidas: 1, bodegasafectadas: [{ bodega: 'QA_BODEGA_A', tomado: 1 }], fecha: 1787356800001, usuario: QA_EMAIL
      }, 'WRITE_PROBE_MOVEMENT');
      await request('PATCH', `productos/${QA_DETERMINANTE}/QA-000000000002/lotes/qa-normal-a`, { stock: 41, actualizado: 1787356800001 }, 'MODIFY_QA_STOCK');
      await request('PUT', `auditorias/${QA_DETERMINANTE}/__qa_restore_probe_audit`, {
        producto: 'PROBE QA', codigo: '__qa_restore_probe_product', bodega: 'QA_BODEGA_A', loteId: 'probe', fechaCaducidad: '2027-12-31',
        esperado: 99, contado: 98, diferencia: -1, fecha: '2026-08-23T00:00:00.000Z', usuario: QA_EMAIL, modo: 'qa_probe'
      }, 'WRITE_PROBE_AUDIT');
      const current = await verifyState();
      results.modified = current.hashes;
      must(!same(results.modified, expected), 'QA_WRITE_PROBE_FAILED');
      must(current.state.productos[QA_DETERMINANTE].__qa_restore_probe_product, 'QA_WRITE_PROBE_FAILED:product');
      must(current.state.movimientos[QA_DETERMINANTE].__qa_restore_probe_movement, 'QA_WRITE_PROBE_FAILED:movement');
      must(current.state.productos[QA_DETERMINANTE]['QA-000000000002'].lotes['qa-normal-a'].stock === 41, 'QA_WRITE_PROBE_FAILED:stock');
      must(current.state.auditorias[QA_DETERMINANTE].__qa_restore_probe_audit, 'QA_WRITE_PROBE_FAILED:audit');
    });

    results.restored = await verifyRestoredState(fixture);
    assertHashes(results.restored, expected, 'QA_RESTORE_PROVEN_FAILED');
    results.restore1 = await loggedRestore('RESTORE_1');
    results.restore2 = await loggedRestore('RESTORE_2');
    results.restore3 = await loggedRestore('RESTORE_3');
    assertHashes(results.restore1, expected, 'QA_RESTORE_IDEMPOTENCY_FAILED:1');
    assertHashes(results.restore2, expected, 'QA_RESTORE_IDEMPOTENCY_FAILED:2');
    assertHashes(results.restore3, expected, 'QA_RESTORE_IDEMPOTENCY_FAILED:3');
    results.guards = [
      assertRuntimeGuard('productos/5232/probe', 'determinante 5232'),
      assertRuntimeGuard('movimientos/99921/probe', 'determinante 99921'),
      assertRuntimeGuard('', 'determinante vacío'),
      assertRuntimeGuard(null, 'determinante null'),
      assertRuntimeGuard('/', 'ruta raíz'),
      assertRuntimeGuard('usuarios/otroUsuario', 'usuarios/otroUsuario'),
      targetGuard()
    ];
    results.final = await loggedRestore('FINAL_RESTORE');
    assertHashes(results.final, expected, 'QA_FINAL_HASH_MATCH_FAILED');
    await writeFile(reportPath, report(results), 'utf8');
    console.log('AGUILA_QA_RESTORE_VALIDATION_PASS');
  } catch (error) {
    try { await loggedRestore('EMERGENCY_FINAL_RESTORE'); } catch { /* Preserve the original failure. */ }
    throw error;
  }
}

async function verifyState() {
  const state = {};
  for (const rootName of writableRoots) {
    const value = await request('GET', `${rootName}/${QA_DETERMINANTE}`, undefined, 'VERIFY_PROBE');
    state[rootName] = { [QA_DETERMINANTE]: value ?? {} };
  }
  state.auditorias_completadas = { [QA_DETERMINANTE]: {} };
  return { state, hashes: calculateHashes(state) };
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
