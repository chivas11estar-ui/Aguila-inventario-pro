import { chromium } from 'playwright';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  QA_DATABASE_URL,
  QA_DETERMINANTE,
  QA_EMAIL,
  QA_PROJECT_ID,
  loadFixture,
  restoreQa,
  verifyRestoredState
} from './qa-restore.mjs';

const APP_URL = process.env.QA_APP_URL || 'http://127.0.0.1:4173/?qa=1';
const RUNTIME_ROOT = resolve(process.env.QA_RUNTIME_ROOT || join(import.meta.dirname, '..'));
const PROFILE_ROOT = resolve(process.env.QA_PHASE3C4_PROFILE || 'C:\Aguila-QA-BrowserProfile-Phase3C4');
const RESULT_PATH = resolve(process.env.QA_PHASE3C4_RESULT || join(RUNTIME_ROOT, 'qa-phase3c4-runtime-results.json'));
const password = `Qa!${randomBytes(18).toString('base64url')}`;
const fixture = await loadFixture();
const results = [];
const requests = [];
const consoleErrors = [];
const pageErrors = [];
const blocked = [];
let context;
let page;

if (process.env.QA_MODE !== 'true') throw new Error('QA_MODE_REQUIRED');
const appUrl = new URL(APP_URL);
if (appUrl.hostname !== '127.0.0.1' || appUrl.searchParams.get('qa') !== '1') throw new Error('QA_URL_BLOCKED');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function safeTarget(urlText) {
  const url = new URL(urlText);
  return `${url.protocol}//${url.host}${url.pathname}`;
}

function isProductionFirebase(urlText) {
  const host = new URL(urlText).hostname.toLowerCase();
  return host.endsWith('.firebaseio.com')
    || host.endsWith('.firebasedatabase.app')
    || ['identitytoolkit.googleapis.com', 'securetoken.googleapis.com', 'firestore.googleapis.com', 'firebaseinstallations.googleapis.com'].includes(host);
}

async function test(id, action) {
  const started = performance.now();
  try {
    const evidence = await action();
    results.push({ id, status: 'PASS', durationMs: Math.round(performance.now() - started), evidence });
    console.log(`${id}: PASS`);
  } catch (error) {
    results.push({ id, status: 'FAIL', durationMs: Math.round(performance.now() - started), error: String(error?.stack || error).replaceAll(password, '[REDACTED]') });
    console.log(`${id}: FAIL — ${error.message}`);
  }
}

function emulatorUrl(path) {
  const url = new URL(`${QA_DATABASE_URL}/${path}.json`);
  url.searchParams.set('ns', QA_PROJECT_ID);
  url.searchParams.set('auth_variable_override', JSON.stringify({ uid: 'qa-phase3c4-99922', token: { email: QA_EMAIL } }));
  return url;
}

async function emulatorRequest(method, path, body) {
  const url = emulatorUrl(path);
  assert(url.hostname === '127.0.0.1' && url.port === '9000', 'EMULATOR_TARGET_BLOCKED');
  const response = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`EMULATOR_HTTP_${response.status}:${text}`);
  return text ? JSON.parse(text) : null;
}

async function initializeQaUser() {
  const response = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: QA_EMAIL, password, returnSecureToken: true })
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`AUTH_SETUP_${response.status}:${JSON.stringify(body)}`);
  await emulatorRequest('PUT', `usuarios/${body.localId}`, {
    email: QA_EMAIL,
    determinante: QA_DETERMINANTE,
    nombrePromotor: 'QA Phase3C4',
    nombreTienda: 'Águila QA 99922'
  });
}

async function waitFirebaseReady(targetPage) {
  await targetPage.waitForFunction(() => Boolean(window.FIREBASE_READY), null, { timeout: 20000 });
  await targetPage.evaluate(() => window.FIREBASE_READY);
  await targetPage.waitForFunction(() => window.QA_RUNTIME?.status === 'ready', null, { timeout: 10000 });
}

async function ensureLogin(targetPage) {
  await waitFirebaseReady(targetPage);
  if (await targetPage.locator('#app-container').isVisible().catch(() => false)) {
    await targetPage.waitForFunction(() => typeof window.switchTab === 'function', null, { timeout: 20000 });
    return;
  }
  await targetPage.locator('#login-email').fill(QA_EMAIL);
  await targetPage.locator('#login-password').fill(password);
  await targetPage.locator('#login-determinante').fill(QA_DETERMINANTE);
  await targetPage.locator('#btn-login').click();
  await targetPage.locator('#app-container').waitFor({ state: 'visible', timeout: 25000 });
  await targetPage.waitForFunction(() => typeof window.switchTab === 'function' && window.PROFILE_STATE?.determinante === '99922', null, { timeout: 20000 });
}

async function reloadAndLogin(targetPage) {
  await targetPage.reload({ waitUntil: 'domcontentloaded' });
  await ensureLogin(targetPage);
}

function requestCounts(from = 0) {
  const sample = requests.slice(from);
  return {
    total: sample.length,
    qaAuth: sample.filter((item) => item.host === '127.0.0.1:9099').length,
    qaRtdb: sample.filter((item) => item.host === '127.0.0.1:9000').length,
    productionFirebase: sample.filter((item) => item.productionFirebase).length
  };
}

try {
  await restoreQa();
  await initializeQaUser();
  context = await chromium.launchPersistentContext(PROFILE_ROOT, {
    headless: true,
    viewport: { width: 1280, height: 800 },
    serviceWorkers: 'allow'
  });
  context.on('request', (request) => {
    const url = new URL(request.url());
    requests.push({ method: request.method(), host: url.host, target: safeTarget(request.url()), productionFirebase: isProductionFirebase(request.url()) });
  });
  context.on('response', (response) => {
    if (response.status() >= 400) consoleErrors.push(`HTTP_${response.status()}:${safeTarget(response.url())}`);
  });
  await context.route('**/*', async (route) => {
    if (isProductionFirebase(route.request().url())) {
      blocked.push(safeTarget(route.request().url()));
      await route.abort('blockedbyclient');
      return;
    }
    await route.continue();
  });
  page = context.pages()[0] || await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text().replaceAll(password, '[REDACTED]'));
  });
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await ensureLogin(page);

  await test('T3C401', async () => {
    const start = requests.length;
    const reloads = [];
    for (let index = 1; index <= 20; index += 1) {
      await reloadAndLogin(page);
      const state = await page.evaluate(() => ({
        qa: window.QA_RUNTIME?.enabled,
        status: window.QA_RUNTIME?.status,
        appVisible: getComputedStyle(document.querySelector('#app-container')).display !== 'none',
        determinante: window.PROFILE_STATE?.determinante,
        authPersistence: firebase.auth()._delegate?._persistenceManager?.persistence?.type || 'MEMORY'
      }));
      assert(state.qa && state.status === 'ready' && state.appVisible && state.determinante === '99922', `RELOAD_${index}_NOT_READY`);
      reloads.push({ index, ...state });
    }
    const counts = requestCounts(start);
    assert(counts.productionFirebase === 0 && blocked.length === 0, 'PRODUCTION_FIREBASE_REQUEST_DETECTED');
    assert(counts.qaAuth > 0 && counts.qaRtdb > 0, 'QA_EMULATOR_TRAFFIC_NOT_PROVEN');
    return { reloads, ...counts, productionWrites: 0 };
  });

  await test('T3C402', async () => {
    const swSource = await readFile(join(RUNTIME_ROOT, 'service-worker.js'), 'utf8');
    const match = swSource.match(/const APP_SHELL_ASSETS = \[([\s\S]*?)\];/);
    assert(match, 'APP_SHELL_NOT_FOUND');
    const assets = [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]);
    const statuses = await page.evaluate(async (paths) => Promise.all(paths.map(async (path) => ({ path, status: (await fetch(path, { cache: 'no-store' })).status }))), assets);
    assert(statuses.length > 0 && statuses.every((item) => item.status === 200), 'APP_SHELL_HTTP_FAILURE');
    assert(!assets.includes('/sitemap.xml'), 'SITEMAP_STILL_IN_APP_SHELL');
    return { assets: statuses.length, statuses };
  });

  await test('T3C403', async () => {
    await page.evaluate(() => navigator.serviceWorker.ready);
    await reloadAndLogin(page);
    const sw = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return { active: registration.active?.state, controlled: Boolean(navigator.serviceWorker.controller), caches: await caches.keys() };
    });
    assert(sw.active === 'activated' && sw.controlled && sw.caches.includes('aguila-pro-v8.8'), 'SERVICE_WORKER_NOT_ACTIVE');
    return sw;
  });

  await test('T3C404', async () => {
    const cspStart = consoleErrors.length;
    const transport = await page.evaluate(async () => {
      await window.FIREBASE_READY;
      const database = firebase.database();
      const ref = database.ref('.info/connected');
      return new Promise((resolvePromise, reject) => {
        const transitions = [];
        let sawDisconnected = false;
        const timeout = setTimeout(() => { ref.off(); reject(new Error(`RTDB_CONNECTED_TIMEOUT:${JSON.stringify(transitions)}`)); }, 10000);
        ref.on('value', (snapshot) => {
          const value = snapshot.val();
          transitions.push(value);
          if (value === false) sawDisconnected = true;
          if (value === true && sawDisconnected) {
            clearTimeout(timeout);
            ref.off();
            resolvePromise({ connected: true, transitions });
          }
        }, reject);
        database.goOffline();
        Promise.resolve().then(() => database.goOnline());
      });
    });
    const counts = requestCounts(0);
    const cspFailures = consoleErrors.slice(cspStart).filter((message) => message.includes('Content Security Policy') && message.includes('127.0.0.1:9000'));
    assert(transport.connected === true && transport.transitions.includes(false) && counts.qaRtdb > 0 && cspFailures.length === 0, 'RTDB_EMULATOR_TRANSPORT_FAILED');
    return { ...transport, qaRtdbRequests: counts.qaRtdb, cspFailures };
  });

  await test('T3C405', async () => {
    const csp = await page.evaluate(() => window.AGUILA_CSP);
    assert(csp.mode === 'qa', 'QA_CSP_MODE_MISSING');
    assert(csp.qaPolicy.includes('http://127.0.0.1:9000') && csp.qaPolicy.includes('ws://127.0.0.1:9000'), 'QA_CSP_ENDPOINTS_MISSING');
    assert(!csp.productionPolicy.includes('127.0.0.1:9000') && !csp.productionPolicy.includes('127.0.0.1:9099'), 'PRODUCTION_CSP_WIDENED');
    return csp;
  });

  await page.evaluate(() => {
    window.__phase3c4Counters = { add: 0, refill: 0, audit: 0 };
    window.buscarProductoParaAgregar = () => { window.__phase3c4Counters.add += 1; };
    window.searchProductForRefillSafe = () => { window.__phase3c4Counters.refill += 1; };
    window.buscarProductoAudit = () => { window.__phase3c4Counters.audit += 1; };
  });
  const barcodeTest = async (id, tab, expectedKey) => test(id, async () => {
    await page.evaluate((name) => window.switchTab(name), tab);
    const counters = await page.evaluate((code) => {
      window.dispatchEvent(new CustomEvent('barcodeScanned', { detail: { code } }));
      return { ...window.__phase3c4Counters };
    }, `QA-${id}-000001`);
    assert(counters[expectedKey] === 1, `${id}_HANDLER_COUNT`);
    assert(Object.entries(counters).filter(([key]) => key !== expectedKey).every(([, value]) => value === 0), `${id}_CROSS_HANDLER`);
    await page.evaluate(() => { window.__phase3c4Counters = { add: 0, refill: 0, audit: 0 }; });
    return { handlersExecuted: 1, counters };
  });
  await barcodeTest('T3C406', 'add', 'add');
  await barcodeTest('T3C407', 'refill', 'refill');
  await barcodeTest('T3C408', 'audit', 'audit');

  await test('T3C409', async () => {
    for (let index = 0; index < 100; index += 1) await page.evaluate((name) => window.switchTab(name), ['inventory', 'add', 'refill', 'audit'][index % 4]);
    await page.evaluate(() => { window.__phase3c4Counters = { add: 0, refill: 0, audit: 0 }; window.switchTab('refill'); });
    const counters = await page.evaluate(() => {
      for (let index = 0; index < 50; index += 1) window.dispatchEvent(new CustomEvent('barcodeScanned', { detail: { code: `QA-BURST-${index}` } }));
      return { ...window.__phase3c4Counters, installed: window.__aguilaBarcodeRouterInstalled };
    });
    assert(counters.refill === 50 && counters.add === 0 && counters.audit === 0 && counters.installed === true, 'BARCODE_LISTENER_ACCUMULATION');
    return counters;
  });

  await test('T3C410', async () => {
    const counters = await page.evaluate(() => {
      window.__phase3c4Counters = { add: 0, refill: 0, audit: 0 };
      window.switchTab('add');
      window.dispatchEvent(new CustomEvent('barcodeScanned', { detail: { code: 'QA-ADD-ONCE' } }));
      window.switchTab('audit');
      window.dispatchEvent(new CustomEvent('barcodeScanned', { detail: { code: 'QA-AUDIT-ONCE' } }));
      return { ...window.__phase3c4Counters };
    });
    assert(counters.add === 1 && counters.audit === 1 && counters.refill === 0, 'PREVIOUS_TAB_HANDLER_ACTIVE');
    return counters;
  });

  await test('T3C411', async () => {
    await page.evaluate(async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
      await caches.delete('aguila-pro-v8.8');
      const old = await caches.open('aguila-pro-v8.7');
      await old.put('/phase3c4-old-cache-marker', new Response('old'));
    });
    await reloadAndLogin(page);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await reloadAndLogin(page);
    const evidence = await page.evaluate(async () => ({
      caches: await caches.keys(),
      controlled: Boolean(navigator.serviceWorker.controller),
      active: (await navigator.serviceWorker.ready).active?.state
    }));
    assert(evidence.active === 'activated' && evidence.controlled, 'UPDATED_SW_NOT_CONTROLLING');
    assert(evidence.caches.includes('aguila-pro-v8.8') && !evidence.caches.includes('aguila-pro-v8.7'), 'OLD_SW_CACHE_NOT_REMOVED');
    return evidence;
  });
} finally {
  try { await restoreQa(); } catch {}
  try { await context?.close(); } catch {}
}

const finalHashes = await verifyRestoredState(fixture);
const counts = requestCounts(0);
const summary = {
  playwrightVersion: '1.62.1',
  chromiumVersion: await chromium.launch({ headless: true }).then(async (browser) => { const version = browser.version(); await browser.close(); return version; }),
  tests: results,
  pass: results.filter((item) => item.status === 'PASS').length,
  fail: results.filter((item) => item.status === 'FAIL').length,
  productionFirebaseRequests: counts.productionFirebase,
  productionFirebaseWrites: 0,
  qaAuthRequests: counts.qaAuth,
  qaRtdbRequests: counts.qaRtdb,
  blockedTargets: [...new Set(blocked)],
  networkHosts: [...new Set(requests.map((item) => item.host))].sort(),
  consoleErrors,
  pageErrors,
  finalHashes,
  finalHashResult: 'QA_FINAL_HASH_MATCH_PASS'
};
await writeFile(RESULT_PATH, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ resultPath: RESULT_PATH, pass: summary.pass, fail: summary.fail, productionFirebaseRequests: summary.productionFirebaseRequests, qaAuthRequests: summary.qaAuthRequests, qaRtdbRequests: summary.qaRtdbRequests, finalHashResult: summary.finalHashResult }));
if (summary.fail > 0 || summary.productionFirebaseRequests > 0 || blocked.length > 0) process.exitCode = 1;