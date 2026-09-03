import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const runtimeSource = readFileSync(join(root, 'qa-runtime.js'), 'utf8');
const results = [];

function pass(id, detail = '') {
  results.push({ id, status: 'PASS', detail });
}

function makeLogger() {
  const entries = [];
  return {
    entries,
    info: (...args) => entries.push(['info', ...args]),
    warn: (...args) => entries.push(['warn', ...args]),
    error: (...args) => entries.push(['error', ...args])
  };
}

function makeRuntime({ hostname, search, fetchImpl }) {
  const logger = makeLogger();
  const fakeWindow = {
    location: { hostname, search },
    console: logger,
    fetch: fetchImpl,
    setTimeout,
    clearTimeout
  };
  fakeWindow.window = fakeWindow;
  vm.runInNewContext(runtimeSource, { window: fakeWindow, URLSearchParams, Set, Object, Proxy, Reflect, Promise, String, Number, Error, console });
  return { runtime: fakeWindow.createAguilaQaRuntime(fakeWindow.location, { logger, fetchImpl }), logger };
}

function successfulFetch(requests) {
  return async (url) => {
    requests.push(url);
    return { status: url.includes(':9099/') ? 200 : 401 };
  };
}

function createFirebaseDouble() {
  const calls = { auth: [], database: [], writes: [] };
  const refFor = (path = '') => ({
    key: 'generated-key',
    child(childPath) { return refFor([path, childPath].filter(Boolean).join('/')); },
    set(value) { calls.writes.push({ method: 'set', path, value }); return Promise.resolve(); },
    setWithPriority(value) { calls.writes.push({ method: 'setWithPriority', path, value }); return Promise.resolve(); },
    update(value) { calls.writes.push({ method: 'update', path, value }); return Promise.resolve(); },
    remove() { calls.writes.push({ method: 'remove', path }); return Promise.resolve(); },
    transaction(value) { calls.writes.push({ method: 'transaction', path, value }); return Promise.resolve(); },
    push(value) { if (arguments.length) calls.writes.push({ method: 'push', path, value }); return refFor([path, 'generated-key'].filter(Boolean).join('/')); },
    onDisconnect() { return { set(value) { calls.writes.push({ method: 'onDisconnect.set', path, value }); return Promise.resolve(); } }; },
    once() { return Promise.resolve({ val: () => null }); },
    off() {}
  });
  const auth = { useEmulator: (target, options) => calls.auth.push({ target, options }) };
  const database = {
    useEmulator: (host, port) => calls.database.push({ host, port }),
    ref: (path = '') => refFor(path)
  };
  return { auth, database, calls };
}

async function mustReject(action, code) {
  await assert.rejects(action, (error) => error?.code === code || error?.message === code);
}

const productionConfig = Object.freeze({ projectId: 'promosentry', databaseURL: 'https://promosentry-default-rtdb.firebaseio.com' });

{
  const { runtime } = makeRuntime({ hostname: 'localhost', search: '', fetchImpl: successfulFetch([]) });
  assert.equal(runtime.enabled, false);
  assert.strictEqual(runtime.getFirebaseConfig(productionConfig), productionConfig);
  pass('T3C101', 'localhost sin qa conserva la configuración de producción.');
}

{
  const { runtime } = makeRuntime({ hostname: 'localhost', search: '?qa=1', fetchImpl: successfulFetch([]) });
  assert.equal(runtime.enabled, true);
  assert.equal(runtime.databaseTarget, 'http://127.0.0.1:9000');
  assert.equal(runtime.getFirebaseConfig(productionConfig).projectId, 'demo-aguila-qa');
  assert.equal(runtime.getFirebaseConfig(productionConfig).apiKey, 'demo-aguila-qa-api-key');
  pass('T3C102', 'localhost + qa=1 activa QA.');
}

{
  const { runtime } = makeRuntime({ hostname: '127.0.0.1', search: '?qa=1', fetchImpl: successfulFetch([]) });
  assert.equal(runtime.enabled, true);
  pass('T3C103', '127.0.0.1 + qa=1 activa QA.');
}

{
  const { runtime, logger } = makeRuntime({ hostname: 'aguilainventario.netlify.app', search: '?qa=1', fetchImpl: successfulFetch([]) });
  assert.equal(runtime.enabled, false);
  assert.strictEqual(runtime.getFirebaseConfig(productionConfig), productionConfig);
  assert(logger.entries.some((entry) => entry[0] === 'warn' && entry[1] === 'QA_MODE_BLOCKED_NONLOCAL'));
  pass('T3C104', 'qa=1 en host no local queda bloqueado y no altera producción.');
}

let liveNetworkTargets = [];
{
  const requests = [];
  const { runtime } = makeRuntime({ hostname: 'localhost', search: '?qa=1', fetchImpl: successfulFetch(requests) });
  const { auth, database, calls } = createFirebaseDouble();
  runtime.configureFirebase({ auth, database });
  await runtime.ensureEmulators();
  assert.equal(calls.auth.length, 1);
  assert.equal(calls.auth[0].target, 'http://127.0.0.1:9099');
  assert.equal(calls.auth[0].options.disableWarnings, true);
  pass('T3C105', 'Auth compat se enruta a 127.0.0.1:9099.');
  assert.equal(calls.database.length, 1);
  assert.equal(calls.database[0].host, '127.0.0.1');
  assert.equal(calls.database[0].port, 9000);
  pass('T3C106', 'Realtime Database compat se enruta a 127.0.0.1:9000.');
  assert(requests.every((url) => url.startsWith('http://127.0.0.1:')));
  assert.equal(runtime.getFirebaseConfig(productionConfig).databaseURL, 'http://127.0.0.1:9000?ns=demo-aguila-qa');
  pass('T3C108', 'QA no construye destinos de producción.');

  runtime.assertQaIdentity('qa.aguila.20260822@example.com', '99922');
  await database.ref('productos/99922/producto-qa').set({ stock: 1 });
  assert.equal(calls.writes.length, 1);
  pass('T3C109', 'determinante 99922 permitido y escritura QA guardada.');

  assert.throws(() => runtime.assertQaIdentity('qa.aguila.20260822@example.com', '5232'), /QA_WRITE_BLOCKED/);
  assert.throws(() => database.ref('productos/5232/producto-ajeno').set({ stock: 1 }), /QA_WRITE_BLOCKED/);
  assert.equal(calls.writes.length, 1);
  pass('T3C110', 'determinante 5232 bloqueado antes de construir escritura.');
}

{
  const requests = [];
  const fetchImpl = async (url) => {
    requests.push(url);
    if (url.includes(':9000/')) throw new Error('database offline');
    return { status: 200 };
  };
  const { runtime } = makeRuntime({ hostname: 'localhost', search: '?qa=1', fetchImpl });
  const { auth, database } = createFirebaseDouble();
  runtime.configureFirebase({ auth, database });
  await mustReject(() => runtime.ensureEmulators(), 'QA_EMULATOR_REQUIRED');
  assert.equal(runtime.state.status, 'blocked');
  assert(requests.some((url) => url.includes(':9000/')));
  pass('T3C107', 'Database Emulator ausente aborta QA sin fallback.');
}

{
  const index = readFileSync(join(root, 'index.html'), 'utf8');
  const config = readFileSync(join(root, 'firebase-config.js'), 'utf8');
  const sw = readFileSync(join(root, 'service-worker.js'), 'utf8');
  assert(index.indexOf('qa-runtime.js') < index.indexOf('firebase-config.js'));
  assert(config.indexOf('configureFirebase') < config.indexOf('QA_RUNTIME_READY'));
  const auth = readFileSync(join(root, 'auth.js'), 'utf8');
  assert(sw.includes('aguila-pro-v8.8') && sw.includes('/qa-runtime.js'));
  assert(!sw.includes('/sitemap.xml'));
  assert(config.includes('window.FIREBASE_READY = initFirebase()'));
  assert(config.indexOf('configureFirebase') < config.indexOf('setPersistence'));
  assert(auth.includes('if (window.FIREBASE_READY) await window.FIREBASE_READY'));
  pass('T3C111', 'boot único, readiness y Service Worker v8.8 quedan ordenados antes de listeners.');
}

if (process.env.QA_RUNTIME_LIVE === 'true') {
  const requests = [];
  const { runtime } = makeRuntime({ hostname: '127.0.0.1', search: '?qa=1', fetchImpl: async (url, options) => {
    const response = await fetch(url, options);
    requests.push({ url, status: response.status });
    return response;
  } });
  const { auth, database } = createFirebaseDouble();
  runtime.configureFirebase({ auth, database });
  await runtime.ensureEmulators();
  assert.equal(requests.length, 2);
  assert(requests.every((request) => request.url.startsWith('http://127.0.0.1:')));
  liveNetworkTargets = requests;
  pass('QA_NETWORK_TARGET_PASS', JSON.stringify(requests));
}

for (const result of results) console.log(`${result.id}: ${result.status}${result.detail ? ` — ${result.detail}` : ''}`);
console.log('QA_RUNTIME_ROUTING_TESTS_PASS');