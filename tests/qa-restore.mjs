import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const QA_DETERMINANTE = '99922';
export const QA_EMAIL = 'qa.aguila.20260822@example.com';
export const QA_PROJECT_ID = 'demo-aguila-qa';
export const QA_DATABASE_URL = 'http://127.0.0.1:9000';
export const QA_ROOTS = Object.freeze(['productos', 'movimientos', 'auditorias', 'auditorias_completadas']);
const WRITABLE_ROOTS = new Set(['productos', 'movimientos', 'auditorias']);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixturePath = join(root, 'tests', 'fixtures', 'qa-99922-baseline.json');

export function stableSerialize(value) {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

export function sha256(value) { return createHash('sha256').update(stableSerialize(value)).digest('hex'); }
export function calculateHashes(state) { return Object.fromEntries(QA_ROOTS.map((name) => [name.toUpperCase() + '_HASH', sha256(state?.[name] ?? {})])); }

export function validateQaIdentity({ determinante = QA_DETERMINANTE, qaMode = process.env.QA_MODE === 'true', destination = QA_DATABASE_URL, projectId = QA_PROJECT_ID } = {}) {
  let url;
  try { url = new URL(destination); } catch { throw new Error('QA_RESTORE_BLOCKED'); }
  if (String(determinante) !== QA_DETERMINANTE || qaMode !== true || projectId !== QA_PROJECT_ID || url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.port !== '9000') throw new Error('QA_RESTORE_BLOCKED');
  return true;
}

export function assertQaWriteAllowed(path) {
  const parts = String(path ?? '').replace(/^\/+|\/+$/g, '').split('/');
  if (parts.length < 2 || !WRITABLE_ROOTS.has(parts[0]) || parts[1] !== QA_DETERMINANTE) throw new Error('QA_WRITE_BLOCKED');
  return true;
}

export async function loadFixture() {
  const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
  validateFixture(fixture);
  return fixture;
}

export function validateFixture(fixture) {
  if (fixture?.fixtureVersion !== '2A.4' || fixture?.qaOnly !== true || fixture?.determinante !== QA_DETERMINANTE || fixture?.generatedFor !== QA_EMAIL) throw new Error('QA_RESTORE_BLOCKED');
  for (const rootName of QA_ROOTS) {
    const scoped = fixture?.state?.[rootName];
    if (!scoped || Object.keys(scoped).some((det) => det !== QA_DETERMINANTE)) throw new Error('QA_RESTORE_BLOCKED');
  }
  for (const product of Object.values(fixture.state.productos[QA_DETERMINANTE])) {
    if (!String(product.codigoBarras).startsWith('QA-') || !product.lotes || Object.hasOwn(product, 'stockTotal')) throw new Error('QA_RESTORE_BLOCKED');
  }
  return true;
}

function emulatorUrl(path) {
  assertQaWriteAllowed(path);
  const url = new URL(`${QA_DATABASE_URL}/${path}.json`);
  url.searchParams.set('ns', QA_PROJECT_ID);
  url.searchParams.set('auth_variable_override', JSON.stringify({ uid: 'qa-user-99922', token: { email: QA_EMAIL } }));
  return url;
}

async function emulatorRequest(method, path, body) {
  const response = await fetch(emulatorUrl(path), { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  if (!response.ok) throw new Error(`QA_RESTORE_BLOCKED: emulator HTTP ${response.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

export async function captureCurrentState() {
  validateQaIdentity();
  const state = {};
  for (const rootName of WRITABLE_ROOTS) {
    const current = await emulatorRequest('GET', `${rootName}/${QA_DETERMINANTE}`);
    state[rootName] = { [QA_DETERMINANTE]: current ?? {} };
  }
  state.auditorias_completadas = { [QA_DETERMINANTE]: {} };
  return state;
}

export async function restoreQa() {
  validateQaIdentity();
  const fixture = await loadFixture();
  for (const rootName of WRITABLE_ROOTS) {
    const path = `${rootName}/${QA_DETERMINANTE}`;
    assertQaWriteAllowed(path);
    await emulatorRequest('DELETE', path);
    await emulatorRequest('PUT', path, fixture.state[rootName][QA_DETERMINANTE]);
  }
  return verifyRestoredState(fixture);
}

export async function verifyRestoredState(fixture) {
  validateQaIdentity();
  const baseline = fixture ?? await loadFixture();
  const actual = await captureCurrentState();
  const expectedHashes = calculateHashes(baseline.state);
  const actualHashes = calculateHashes(actual);
  for (const key of Object.keys(expectedHashes)) if (expectedHashes[key] !== actualHashes[key]) throw new Error('QA_RESTORE_BLOCKED');
  return actualHashes;
}

async function main() {
  if (process.argv[2] !== '--static') throw new Error('Uso: QA_MODE=true node tests/qa-restore.mjs --restore | node tests/qa-restore.mjs --static');
  const fixture = await loadFixture();
  console.log(JSON.stringify(calculateHashes(fixture.state)));
  console.log('QA_RESTORE_STATIC_PASS');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
