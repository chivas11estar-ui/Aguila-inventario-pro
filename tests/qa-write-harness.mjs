import { fileURLToPath } from 'node:url';
import {
  QA_DATABASE_URL,
  QA_DETERMINANTE,
  QA_PROJECT_ID,
  assertQaWriteAllowed,
  calculateHashes,
  captureCurrentState,
  loadFixture,
  restoreQa,
  validateFixture,
  validateQaIdentity,
  verifyRestoredState
} from './qa-restore.mjs';

export { calculateHashes, captureCurrentState, loadFixture, restoreQa, validateQaIdentity, verifyRestoredState, assertQaWriteAllowed };

export async function runWithGuaranteedRestore(testFn) {
  validateQaIdentity();
  try { await testFn(); } finally { await restoreQa(); await verifyRestoredState(); }
}

function assertBlocked(fn, expected = 'QA_WRITE_BLOCKED') {
  try { fn(); } catch (error) { if (error.message === expected) return; }
  throw new Error('QA_STATIC_ASSERTION_FAILED');
}

async function staticValidation() {
  const fixture = await loadFixture();
  validateFixture(fixture);
  if (fixture.determinante !== QA_DETERMINANTE || fixture.qaOnly !== true) throw new Error('QA_STATIC_ASSERTION_FAILED');
  if (JSON.stringify(fixture.state).includes('5232') || JSON.stringify(fixture.state).includes('99921')) throw new Error('QA_STATIC_ASSERTION_FAILED');
  if (JSON.stringify(fixture).match(/firebaseio\.com|apiKey|secret/i)) throw new Error('QA_STATIC_ASSERTION_FAILED');
  const first = calculateHashes(fixture.state);
  const second = calculateHashes(JSON.parse(JSON.stringify(fixture.state)));
  if (JSON.stringify(first) !== JSON.stringify(second)) throw new Error('QA_STATIC_ASSERTION_FAILED');
  validateQaIdentity({ qaMode: true, destination: QA_DATABASE_URL, projectId: QA_PROJECT_ID });
  assertBlocked(() => assertQaWriteAllowed('productos/5232'));
  assertBlocked(() => assertQaWriteAllowed('movimientos/99921'));
  assertBlocked(() => assertQaWriteAllowed(null));
  assertBlocked(() => assertQaWriteAllowed('/'));
  assertBlocked(() => validateQaIdentity({ qaMode: false }), 'QA_RESTORE_BLOCKED');
  assertBlocked(() => validateQaIdentity({ qaMode: true, destination: 'https://promosentry.firebaseio.com' }), 'QA_RESTORE_BLOCKED');
  assertQaWriteAllowed('productos/99922');
  assertQaWriteAllowed('movimientos/99922/qa-test');
  assertQaWriteAllowed('auditorias/99922');
  console.log('QA_ARTIFACT_STATIC_VALIDATION_PASS');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  staticValidation().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
