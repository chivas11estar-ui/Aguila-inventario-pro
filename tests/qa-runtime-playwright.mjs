import { chromium } from 'playwright';
import { createHash, randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  QA_DATABASE_URL,
  QA_DETERMINANTE,
  QA_EMAIL,
  QA_PROJECT_ID,
  captureCurrentState,
  loadFixture,
  restoreQa,
  verifyRestoredState
} from './qa-restore.mjs';

const APP_URL = process.env.QA_APP_URL || 'http://127.0.0.1:4173/?qa=1';
const RUNTIME_ROOT = resolve(process.env.QA_RUNTIME_ROOT || join(import.meta.dirname, '..'));
const SOURCE_ROOT = resolve(process.env.QA_SOURCE_ROOT || RUNTIME_ROOT);
const PROFILE_ROOT = resolve(process.env.QA_BROWSER_PROFILE || 'C:\\Aguila-QA-BrowserProfile-Phase3C3');
const FAKE_PROFILE_ROOT = resolve(process.env.QA_FAKE_BROWSER_PROFILE || 'C:\\Aguila-QA-BrowserProfile-Phase3C3-FakeCamera');
const RESULT_PATH = resolve(process.env.QA_PLAYWRIGHT_RESULT || join(RUNTIME_ROOT, 'qa-runtime-playwright-results.json'));
const ORIGIN = new URL(APP_URL).origin;
const NORMAL_CODE = 'QA-000000000002';
const ADD_CODE = 'QA-PW-ADD-000001';
const ASSETS = ['qa-runtime.js', 'firebase-config.js', 'inventory-core.js', 'refill-safe.js', 'audit.js', 'ui.js', 'scanner-mlkit.js', 'app.js', 'app-loader.js', 'service-worker.js', 'index.html'];
const PRODUCTIVE_DATA_HOSTS = new Set([
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'firestore.googleapis.com',
  'firebaseinstallations.googleapis.com'
]);

if (process.env.QA_MODE !== 'true') throw new Error('QA_MODE_REQUIRED');
const parsedAppUrl = new URL(APP_URL);
if (parsedAppUrl.protocol !== 'http:' || parsedAppUrl.hostname !== '127.0.0.1' || parsedAppUrl.searchParams.get('qa') !== '1') {
  throw new Error('PLAYWRIGHT_QA_URL_BLOCKED');
}

const fixture = await loadFixture();
const password = `Qa!${randomBytes(18).toString('base64url')}`;
const startedAt = new Date().toISOString();
const diagnostics = {
  console: [], pageErrors: [], requestFailures: [], httpErrors: [], serviceWorkers: [],
  networkTargets: new Set(), requests: [], blockedTargets: []
};
const tests = [];
const findings = [];
let context;
let page;
let fakeContext;

function sha256Buffer(value) {
  return createHash('sha256').update(value).digest('hex');
}

function compactError(error) {
  return String(error?.stack || error?.message || error).replaceAll(password, '[REDACTED]');
}

async function runTest(id, module, method, fn, options = {}) {
  const started = performance.now();
  console.log(`PLAYWRIGHT_TEST_START ${id} ${module}`);
  try {
    const evidence = await fn();
    const status = evidence?.status || 'PASS';
    const item = { id, module, method, status, durationMs: Math.round(performance.now() - started), evidence: evidence?.evidence ?? evidence ?? null };
    tests.push(item);
    if (status === 'FAIL' || status === 'CONFIRMED_BUG') findings.push({ id, summary: evidence?.finding || 'Runtime assertion failed', evidence: item.evidence });
    console.log(`PLAYWRIGHT_TEST_END ${id} ${status} ${item.durationMs}ms`);
    return item;
  } catch (error) {
    const item = { id, module, method, status: options.manual ? 'MANUAL_REQUIRED' : 'FAIL', durationMs: Math.round(performance.now() - started), error: compactError(error) };
    tests.push(item);
    if (!options.manual) findings.push({ id, summary: error?.message || String(error) });
    console.log(`PLAYWRIGHT_TEST_END ${id} ${item.status} ${item.durationMs}ms ${error?.message || error}`);
    return item;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function emulatorUrl(path) {
  const url = new URL(`${QA_DATABASE_URL}/${path}.json`);
  url.searchParams.set('ns', QA_PROJECT_ID);
  url.searchParams.set('auth_variable_override', JSON.stringify({ uid: 'qa-playwright-99922', token: { email: QA_EMAIL } }));
  return url;
}

async function emulatorRequest(method, path, body) {
  const url = emulatorUrl(path);
  assert(url.hostname === '127.0.0.1' && url.port === '9000', 'QA_DATABASE_TARGET_BLOCKED');
  const response = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`EMULATOR_HTTP_${response.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function initializeQaUser() {
  const endpoint = new URL('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key');
  const response = await fetch(endpoint, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: QA_EMAIL, password, returnSecureToken: true })
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`AUTH_EMULATOR_SETUP_${response.status}: ${JSON.stringify(body)}`);
  await emulatorRequest('PUT', `usuarios/${body.localId}`, {
    email: QA_EMAIL,
    determinante: QA_DETERMINANTE,
    nombrePromotor: 'QA Playwright',
    nombreTienda: 'Águila QA 99922'
  });
  return body.localId;
}

function isProductiveFirebaseDataTarget(urlText) {
  let url;
  try { url = new URL(urlText); } catch { return false; }
  const host = url.hostname.toLowerCase();
  if (host.endsWith('.firebaseio.com') || host.endsWith('.firebasedatabase.app')) return true;
  return PRODUCTIVE_DATA_HOSTS.has(host);
}

async function attachNetworkGuard(browserContext, label) {
  browserContext.on('serviceworker', (worker) => diagnostics.serviceWorkers.push({ label, url: worker.url(), at: new Date().toISOString() }));
  browserContext.on('request', (request) => {
    diagnostics.networkTargets.add(new URL(request.url()).origin);
    diagnostics.requests.push({ label, method: request.method(), url: request.url() });
  });
  browserContext.on('requestfailed', (request) => diagnostics.requestFailures.push({ label, url: request.url(), method: request.method(), error: request.failure()?.errorText || 'unknown' }));
  browserContext.on('response', (response) => {
    if (response.status() >= 400) diagnostics.httpErrors.push({ label, status: response.status(), url: response.url() });
  });
  await browserContext.route('**/*', async (route) => {
    const url = route.request().url();
    if (isProductiveFirebaseDataTarget(url)) {
      diagnostics.blockedTargets.push(url);
      await route.abort('blockedbyclient');
      return;
    }
    await route.continue();
  });
}

function attachPageDiagnostics(targetPage, label) {
  targetPage.on('console', (message) => diagnostics.console.push({ label, type: message.type(), text: message.text().replaceAll(password, '[REDACTED]') }));
  targetPage.on('pageerror', (error) => diagnostics.pageErrors.push({ label, error: compactError(error) }));
}

async function login(targetPage) {
  await targetPage.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await targetPage.waitForFunction(() => window.QA_RUNTIME?.status === 'ready', null, { timeout: 20000 });
  const runtime = await targetPage.evaluate(() => ({
    enabled: window.QA_RUNTIME?.enabled,
    status: window.QA_RUNTIME?.status,
    databaseTarget: window.QA_RUNTIME?.databaseTarget,
    authTarget: window.QA_RUNTIME?.authTarget,
    determinanteAllowed: window.QA_RUNTIME?.determinanteAllowed,
    productionFirebaseAllowed: window.QA_RUNTIME?.productionFirebaseAllowed
  }));
  assert(runtime.enabled === true && runtime.status === 'ready', 'QA_RUNTIME_NOT_READY');
  assert(runtime.databaseTarget === 'http://127.0.0.1:9000' && runtime.authTarget === 'http://127.0.0.1:9099', 'QA_RUNTIME_WRONG_TARGET');
  assert(runtime.determinanteAllowed === QA_DETERMINANTE && runtime.productionFirebaseAllowed === false, 'QA_IDENTITY_GUARD_MISSING');
  await targetPage.locator('#login-email').fill(QA_EMAIL);
  await targetPage.locator('#login-password').fill(password);
  await targetPage.locator('#login-determinante').fill(QA_DETERMINANTE);
  await targetPage.locator('#btn-login').click();
  await targetPage.locator('#app-container').waitFor({ state: 'visible', timeout: 20000 });
  await targetPage.waitForFunction((det) => window.PROFILE_STATE?.determinante === det, QA_DETERMINANTE, { timeout: 10000 });
  return runtime;
}

async function ensureLoggedIn(targetPage) {
  await targetPage.waitForLoadState('domcontentloaded');
  const visible = await targetPage.locator('#app-container').isVisible().catch(() => false);
  if (!visible) return login(targetPage);
  await targetPage.waitForFunction((det) => window.PROFILE_STATE?.determinante === det, QA_DETERMINANTE, { timeout: 15000 });
  return true;
}

function stateSummary(state) {
  const products = state.productos[QA_DETERMINANTE] || {};
  const movements = state.movimientos[QA_DETERMINANTE] || {};
  const audits = state.auditorias[QA_DETERMINANTE] || {};
  const normal = products[NORMAL_CODE];
  return {
    normalStock: Number(normal?.lotes?.['qa-normal-a']?.stock),
    normalMovements: Object.entries(movements).filter(([key, value]) => key !== 'qa-movimiento-baseline' && value?.productoCodigo === NORMAL_CODE),
    normalAudits: Object.entries(audits).filter(([key, value]) => key !== 'qa-auditoria-baseline' && value?.codigo === NORMAL_CODE),
    addProduct: products[ADD_CODE] || null
  };
}

async function waitForState(predicate, timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs;
  let state;
  while (Date.now() < deadline) {
    state = await captureCurrentState();
    if (predicate(stateSummary(state), state)) return state;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 150));
  }
  throw new Error(`STATE_TIMEOUT: ${JSON.stringify(stateSummary(state || await captureCurrentState()))}`);
}

async function switchTab(targetPage, tab) {
  await targetPage.evaluate((name) => window.switchTab(name), tab);
  await targetPage.locator(`#tab-${tab}`).waitFor({ state: 'visible' });
}

async function prepareRefill(targetPage) {
  await switchTab(targetPage, 'refill');
  await targetPage.locator('#refill-barcode').fill(NORMAL_CODE);
  await targetPage.locator('#refill-barcode').press('Enter');
  await targetPage.waitForFunction(() => document.querySelector('#refill-nombre')?.value === 'PRODUCTO QA NORMAL');
  await targetPage.locator('#refill-boxes').fill('1');
  await targetPage.locator('#refill-pieces').fill('0');
}

async function submitRefillVariant(targetPage, variant) {
  const button = targetPage.locator('#refill-form button[type="submit"]');
  if (variant === 'double-click') await button.dblclick({ delay: 5 });
  if (variant === 'five-clicks') await targetPage.evaluate(() => {
    const target = document.querySelector('#refill-form button[type="submit"]');
    for (let index = 0; index < 5; index += 1) target.click();
  });
  if (variant === 'enter') await targetPage.locator('#refill-boxes').press('Enter');
  if (variant === 'enter-click') await targetPage.evaluate(() => {
    const form = document.querySelector('#refill-form');
    const buttonTarget = form.querySelector('button[type="submit"]');
    form.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    form.requestSubmit();
    buttonTarget.click();
  });
  const state = await waitForState((summary) => summary.normalStock === 39 && summary.normalMovements.filter(([, value]) => value.estadoOperacion === 'confirmed').length === 1);
  const summary = stateSummary(state);
  assert(summary.normalMovements.length === 1, `${variant}_DUPLICATE_MOVEMENT`);
  return { variant, stock: summary.normalStock, movements: summary.normalMovements.length, operationId: summary.normalMovements[0][0] };
}

async function prepareAudit(targetPage) {
  await switchTab(targetPage, 'audit');
  await targetPage.locator('#audit-warehouse-manual').fill('QA_BODEGA_A');
  await targetPage.locator('#save-warehouse-btn').click();
  await targetPage.locator('#audit-barcode').fill(NORMAL_CODE);
  await targetPage.locator('#audit-barcode').press('Enter');
  await targetPage.waitForFunction(() => document.querySelector('#audit-nombre')?.value === 'PRODUCTO QA NORMAL');
  await targetPage.locator('#audit-boxes').fill('39');
}

async function hardReload(targetPage) {
  const session = await targetPage.context().newCDPSession(targetPage);
  await session.send('Network.enable');
  await session.send('Network.setCacheDisabled', { cacheDisabled: true });
  await targetPage.reload({ waitUntil: 'domcontentloaded' });
  await session.send('Network.setCacheDisabled', { cacheDisabled: false });
  await session.detach();
}

async function inspectServiceWorker(targetPage) {
  return targetPage.evaluate(async () => {
    let registration = null;
    let readyError = null;
    try {
      registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) => setTimeout(() => reject(new Error('SERVICE_WORKER_READY_TIMEOUT')), 5000))
      ]);
    } catch (error) {
      readyError = error.message;
    }
    const registrations = await navigator.serviceWorker.getRegistrations();
    const cacheNames = await caches.keys();
    const candidate = registration || registrations[0] || null;
    return {
      supported: 'serviceWorker' in navigator,
      ready: Boolean(registration),
      readyError,
      registrationCount: registrations.length,
      installing: candidate?.installing?.state || null,
      waiting: candidate?.waiting?.state || null,
      active: candidate?.active?.state || null,
      scope: candidate?.scope || null,
      controlled: Boolean(navigator.serviceWorker.controller),
      cacheNames
    };
  });
}

async function cleanRestore() {
  await restoreQa();
  await verifyRestoredState(fixture);
}

let recoveryIndex = 0;
async function ensureUsablePrimary() {
  const usable = await page?.evaluate(() => Boolean(window.switchTab) && getComputedStyle(document.querySelector('#app-container')).display !== 'none').catch(() => false);
  if (usable) return;
  try { await context?.close(); } catch {}
  recoveryIndex += 1;
  context = await chromium.launchPersistentContext(`${PROFILE_ROOT}-recovery-${recoveryIndex}`, {
    headless: true,
    viewport: { width: 1280, height: 800 },
    serviceWorkers: 'allow'
  });
  await attachNetworkGuard(context, `primary-recovery-${recoveryIndex}`);
  page = context.pages()[0] || await context.newPage();
  attachPageDiagnostics(page, `primary-recovery-${recoveryIndex}`);
  await login(page);
}

try {
  await cleanRestore();
  const uid = await initializeQaUser();

  context = await chromium.launchPersistentContext(PROFILE_ROOT, {
    headless: true,
    viewport: { width: 1280, height: 800 },
    serviceWorkers: 'allow'
  });
  await attachNetworkGuard(context, 'primary');
  page = context.pages()[0] || await context.newPage();
  attachPageDiagnostics(page, 'primary');

  await runTest('D1', 'Login QA', 'Auth Emulator + DOM login', async () => {
    const runtime = await login(page);
    return { evidence: { uid, email: QA_EMAIL, determinante: QA_DETERMINANTE, runtime } };
  });

  await runTest('E1', 'Service Worker', 'install, reload, hard reload, offline/reconnect', async () => {
    const first = await inspectServiceWorker(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await ensureLoggedIn(page);
    const reload = await inspectServiceWorker(page);
    await hardReload(page);
    await ensureLoggedIn(page);
    const hard = await inspectServiceWorker(page);
    await context.setOffline(true);
    let offlineLoaded = false;
    try {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 });
      offlineLoaded = await page.locator('#main-app').isVisible().catch(() => false);
    } finally {
      await context.setOffline(false);
    }
    await page.reload({ waitUntil: 'domcontentloaded' });
    await ensureLoggedIn(page);
    const reconnect = await inspectServiceWorker(page);
    assert(first.active === 'activated' && reload.controlled && hard.controlled && reconnect.controlled, 'SERVICE_WORKER_NOT_CONTROLLED');
    assert(reconnect.cacheNames.some((name) => name.includes('v8.8')), 'SERVICE_WORKER_CACHE_VERSION_MISMATCH');
    assert(offlineLoaded, 'SERVICE_WORKER_OFFLINE_SHELL_FAILED');
    return { evidence: { first, reload, hard, offlineLoaded, reconnect } };
  });

  await runTest('F1', 'Runtime', 'SHA256 source/runtime/served assets', async () => {
    await ensureUsablePrimary();
    const hashes = {};
    for (const asset of ASSETS) {
      const [source, runtime, served] = await Promise.all([
        readFile(join(SOURCE_ROOT, asset)),
        readFile(join(RUNTIME_ROOT, asset)),
        page.evaluate(async (name) => new Uint8Array(await (await fetch(`/${name}`, { cache: 'no-store' })).arrayBuffer()), asset)
      ]);
      hashes[asset] = { source: sha256Buffer(source), runtime: sha256Buffer(runtime), served: sha256Buffer(served) };
      assert(new Set(Object.values(hashes[asset])).size === 1, `RUNTIME_HASH_MISMATCH:${asset}`);
    }
    return { evidence: hashes };
  });

  await runTest('G1', 'Scanner', 'Chromium without camera, repeated recovery', async () => {
    await ensureUsablePrimary();
    const navigationStart = await page.evaluate(() => performance.getEntriesByType('navigation')[0]?.startTime ?? 0);
    const cycles = [];
    for (let index = 0; index < 3; index += 1) {
      await switchTab(page, 'refill');
      await page.locator('#btn-scan-refill').click();
      await page.waitForTimeout(300);
      const state = await page.evaluate(() => ({
        hidden: document.querySelector('#scanner-modal')?.classList.contains('hidden'),
        tracks: window.ScannerService?.persistentStream?.getTracks?.().length || 0
      }));
      if (!state.hidden) await page.locator('#close-scanner').click();
      const after = await page.evaluate(() => ({ hidden: document.querySelector('#scanner-modal')?.classList.contains('hidden'), tracks: window.ScannerService?.persistentStream?.getTracks?.().length || 0 }));
      cycles.push({ state, after });
      assert(after.hidden && after.tracks === 0, 'SCANNER_NO_CAMERA_NOT_RESET');
    }
    assert((await page.evaluate(() => performance.getEntriesByType('navigation')[0]?.startTime ?? 0)) === navigationStart, 'SCANNER_TRIGGERED_RELOAD');
    return { evidence: cycles };
  });

  await runTest('H1', 'Camera stream', 'fake media stream, 20 open/close cycles', async () => {
    fakeContext = await chromium.launchPersistentContext(FAKE_PROFILE_ROOT, {
      headless: true,
      viewport: { width: 1280, height: 800 },
      serviceWorkers: 'allow',
      permissions: ['camera'],
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']
    });
    await attachNetworkGuard(fakeContext, 'fake-camera');
    await fakeContext.grantPermissions(['camera'], { origin: ORIGIN });
    const cameraPage = fakeContext.pages()[0] || await fakeContext.newPage();
    attachPageDiagnostics(cameraPage, 'fake-camera');
    await login(cameraPage);
    const cycles = [];
    for (let index = 1; index <= 20; index += 1) {
      await switchTab(cameraPage, 'refill');
      await cameraPage.locator('#btn-scan-refill').click();
      await cameraPage.waitForFunction(() => (window.ScannerService?.persistentStream?.getVideoTracks?.().filter((track) => track.readyState === 'live').length || 0) === 1, null, { timeout: 5000 });
      const openTracks = await cameraPage.evaluate(() => window.ScannerService.persistentStream.getVideoTracks().filter((track) => track.readyState === 'live').length);
      await cameraPage.locator('#close-scanner').click();
      await cameraPage.waitForFunction(() => !window.ScannerService?.persistentStream);
      const closedTracks = await cameraPage.evaluate(() => window.ScannerService?.persistentStream?.getTracks?.().length || 0);
      cycles.push({ cycle: index, openTracks, closedTracks });
      assert(openTracks === 1 && closedTracks === 0, `CAMERA_STREAM_ACCUMULATION:${index}`);
    }
    const barcodeDetectorAvailable = await cameraPage.evaluate(() => typeof BarcodeDetector === 'function');
    return { evidence: { cycles, barcodeDetectorAvailable, barcodeDetection: 'NOT_FABRICATED_NO_VISUAL_BARCODE' } };
  });

  await runTest('I-EVENTS', 'Barcode events', 'CustomEvent barcodeScanned bursts in active/inactive modules', async () => {
    await ensureUsablePrimary();
    const modules = { add: '#add-barcode', refill: '#refill-barcode', audit: '#audit-barcode' };
    const bursts = [1, 2, 5, 50];
    const observations = [];
    for (const [moduleName, selector] of Object.entries(modules)) {
      await switchTab(page, moduleName);
      for (const count of bursts) {
        await page.evaluate((selectors) => selectors.forEach((inputSelector) => { const input = document.querySelector(inputSelector); if (input) input.value = ''; }), Object.values(modules));
        const before = await captureCurrentState();
        const values = await page.evaluate(({ count: eventCount, activeSelector, code }) => {
          for (let index = 0; index < eventCount; index += 1) {
            window.dispatchEvent(new CustomEvent('barcodeScanned', { detail: { barcode: code, code, value: code } }));
          }
          return {
            active: document.querySelector(activeSelector)?.value || '',
            add: document.querySelector('#add-barcode')?.value || '',
            refill: document.querySelector('#refill-barcode')?.value || '',
            audit: document.querySelector('#audit-barcode')?.value || ''
          };
        }, { count, activeSelector: selector, code: NORMAL_CODE });
        const after = await captureCurrentState();
        observations.push({ moduleName, count, values, writes: JSON.stringify(before) !== JSON.stringify(after) });
      }
    }
    const activeProcessed = observations.every((item) => item.values[item.moduleName] === NORMAL_CODE);
    const inactiveIgnored = observations.every((item) => Object.entries(item.values).filter(([key]) => ['add', 'refill', 'audit'].includes(key) && key !== item.moduleName).every(([, value]) => value === ''));
    const noWrites = observations.every((item) => !item.writes);
    if (!activeProcessed || !inactiveIgnored || !noWrites) {
      return { status: 'FAIL', finding: 'barcodeScanned CustomEvent contract is not implemented consistently', evidence: { activeProcessed, inactiveIgnored, noWrites, observations } };
    }
    return { evidence: { activeProcessed, inactiveIgnored, noWrites, observations } };
  });

  await runTest('J1', 'Tab stress', '100 real DOM tab changes with milestones', async () => {
    await ensureUsablePrimary();
    const sequence = ['inventory', 'out-of-stock', 'refill', 'audit', 'analytics', 'system'];
    const milestones = [];
    const startRequests = diagnostics.networkTargets.size;
    const startConsoleErrors = diagnostics.console.filter((item) => item.type === 'error').length;
    const start = performance.now();
    for (let index = 1; index <= 100; index += 1) {
      await page.locator(`.nav-btn[data-tab="${sequence[(index - 1) % sequence.length]}"]`).click();
      if ([1, 25, 50, 75, 100].includes(index)) {
        const runtime = await page.evaluate(() => ({
          activeTabs: document.querySelectorAll('.tab-content.active:not(.hidden)').length,
          activeNav: document.querySelectorAll('.nav-btn.active').length,
          heap: performance.memory?.usedJSHeapSize ?? null,
          globalScannerMode: Object.hasOwn(window, 'scannerMode')
        }));
        milestones.push({ count: index, elapsedMs: Math.round(performance.now() - start), ...runtime });
      }
    }
    assert(milestones.every((item) => item.activeTabs === 1 && item.activeNav === 1 && item.globalScannerMode === false), 'TAB_STATE_OR_SCANNER_GLOBAL_LEAK');
    return { evidence: { milestones, uniqueNetworkTargetsDelta: diagnostics.networkTargets.size - startRequests, consoleErrorsDelta: diagnostics.console.filter((item) => item.type === 'error').length - startConsoleErrors, classification: 'NORMAL_RUNTIME_COST' } };
  });

  await runTest('E4', 'Relleno', 'double click / 5 clicks / Enter / Enter+click in DOM', async () => {
    await ensureUsablePrimary();
    const variants = [];
    for (const variant of ['double-click', 'five-clicks', 'enter', 'enter-click']) {
      await cleanRestore();
      await prepareRefill(page);
      variants.push(await submitRefillVariant(page, variant));
      await cleanRestore();
    }
    return { evidence: variants };
  });

  await runTest('L-ADD', 'Agregar', 'real submit then reload', async () => {
    await ensureUsablePrimary();
    await cleanRestore();
    await emulatorRequest('PUT', `catalogoProductos/${ADD_CODE}`, { nombre: 'PRODUCTO QA PLAYWRIGHT', marca: 'Otra', piezasPorCaja: 10, creadoPor: 'qa-playwright' });
    await switchTab(page, 'add');
    await page.locator('#add-barcode').fill(ADD_CODE);
    await page.locator('#add-product-name').fill('PRODUCTO QA PLAYWRIGHT');
    await page.locator('#add-brand').selectOption('Otra');
    await page.locator('#add-pieces-per-box').fill('10');
    await page.locator('#add-warehouse').fill('QA_BODEGA_A');
    await page.locator('#add-expiry-date').fill('2026-12-31');
    await page.locator('#add-boxes').fill('3');
    await page.locator('#add-product-form button[type="submit"]').click();
    await waitForState((summary) => Boolean(summary.addProduct));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await ensureLoggedIn(page);
    const summary = stateSummary(await captureCurrentState());
    const lotes = Object.values(summary.addProduct?.lotes || {});
    assert(lotes.length === 1 && Number(lotes[0].stock) === 3, 'ADD_RELOAD_DUPLICATE_OR_LOST');
    await cleanRestore();
    return { evidence: { product: ADD_CODE, lots: lotes.length, stock: lotes[0].stock } };
  });

  await runTest('L-REFILL', 'Relleno', 'single submit then reload', async () => {
    await ensureUsablePrimary();
    await cleanRestore();
    await prepareRefill(page);
    await page.locator('#refill-form button[type="submit"]').click();
    await waitForState((summary) => summary.normalStock === 39 && summary.normalMovements.length === 1);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await ensureLoggedIn(page);
    const summary = stateSummary(await captureCurrentState());
    assert(summary.normalStock === 39 && summary.normalMovements.length === 1, 'REFILL_RELOAD_DUPLICATE_OR_LOST');
    await cleanRestore();
    return { evidence: { stock: summary.normalStock, movements: summary.normalMovements.length } };
  });

  await runTest('I3', 'Persistencia / Auditoría', 'audit submit then reload', async () => {
    await ensureUsablePrimary();
    await cleanRestore();
    await prepareAudit(page);
    await page.locator('#audit-form button[type="submit"]').click();
    await waitForState((summary) => summary.normalStock === 39 && summary.normalAudits.length === 1);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await ensureLoggedIn(page);
    const summary = stateSummary(await captureCurrentState());
    assert(summary.normalStock === 39 && summary.normalAudits.length === 1, 'AUDIT_RELOAD_DUPLICATE_OR_LOST');
    await cleanRestore();
    return { evidence: { stock: summary.normalStock, audits: summary.normalAudits.length } };
  });

  await runTest('I4', 'Persistencia / Reload inmediato', '20 submit/reload cycles with atomic outcome classification', async () => {
    const outcomes = [];
    for (let cycle = 1; cycle <= 20; cycle += 1) {
      await ensureUsablePrimary();
      await cleanRestore();
      await prepareRefill(page);
      await page.evaluate(() => document.querySelector('#refill-form').requestSubmit());
      const operationStarted = await page.evaluate(() => ({
        submitDisabled: document.querySelector('#refill-form button[type="submit"]')?.disabled === true,
        activeTab: window.APP_STATE?.activeTab
      }));
      assert(operationStarted.submitDisabled && operationStarted.activeTab === 'refill', `I4_OPERATION_DID_NOT_START_CYCLE_${cycle}`);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await ensureLoggedIn(page);
      await page.waitForTimeout(1000);
      const summary = stateSummary(await captureCurrentState());
      const confirmed = summary.normalMovements.filter(([, value]) => value.estadoOperacion === 'confirmed');
      const pending = summary.normalMovements.filter(([, value]) => value.estadoOperacion === 'pending');
      const reconciliation = summary.normalMovements.filter(([, value]) => value.requiereReconciliacion === true || value.estadoOperacion === 'stock_confirmado_movimiento_pendiente');
      const noOperation = summary.normalStock === 40 && summary.normalMovements.length === 0;
      const committedAtomically = summary.normalStock === 39 && summary.normalMovements.length === 1 && confirmed.length === 1;
      const outcome = noOperation ? 'NO_OPERATION_STARTED_BEFORE_NAVIGATION' : (committedAtomically ? 'COMMITTED_ATOMICALLY' : 'PARTIAL_OR_INCONSISTENT');
      const details = summary.normalMovements.map(([key, value]) => ({ key, estadoOperacion: value.estadoOperacion || null, requiereReconciliacion: value.requiereReconciliacion === true }));
      outcomes.push({ cycle, operationStarted, outcome, stock: summary.normalStock, movements: summary.normalMovements.length, confirmed: confirmed.length, pending: pending.length, reconciliation: reconciliation.length, details });
      await cleanRestore();
    }
    const outcomeCounts = outcomes.reduce((counts, item) => ({ ...counts, [item.outcome]: (counts[item.outcome] || 0) + 1 }), {});
    const partialOutcomes = outcomes.filter((item) => item.outcome === 'PARTIAL_OR_INCONSISTENT');
    if (partialOutcomes.length > 0) {
      return {
        status: 'CONFIRMED_BUG',
        finding: 'I4_RELOAD_LEAVES_PARTIAL_OPERATION',
        evidence: { cycles: outcomes.length, outcomeCounts, partialOutcomes }
      };
    }
    return { evidence: { cycles: outcomes.length, outcomeCounts, outcomes } };
  });

  await runTest('I5', 'Persistencia / Hard reload / SW', 'submit then cache-disabled reload under active SW', async () => {
    await ensureUsablePrimary();
    await cleanRestore();
    await prepareRefill(page);
    await page.locator('#refill-form button[type="submit"]').click();
    await waitForState((summary) => summary.normalStock === 39 && summary.normalMovements.length === 1);
    await hardReload(page);
    await ensureLoggedIn(page);
    const [summary, sw] = await Promise.all([captureCurrentState().then(stateSummary), inspectServiceWorker(page)]);
    assert(summary.normalStock === 39 && summary.normalMovements.length === 1 && sw.controlled, 'HARD_RELOAD_REPLAY_OR_SW_FAILURE');
    await cleanRestore();
    return { evidence: { stock: summary.normalStock, movements: summary.normalMovements.length, serviceWorker: sw } };
  });

  await runTest('M1', 'Mobile', '390x844 all tabs, overflow/navigation/control checks', async () => {
    await ensureUsablePrimary();
    await page.setViewportSize({ width: 390, height: 844 });
    const observations = [];
    for (const tab of ['inventory', 'out-of-stock', 'add', 'refill', 'audit', 'analytics', 'system']) {
      await switchTab(page, tab);
      const state = await page.evaluate((name) => {
        const tabElement = document.querySelector(`#tab-${name}`);
        const requiredSelectors = {
          inventory: '#tab-inventory .card',
          'out-of-stock': '#tab-out-of-stock .card',
          add: '#add-product-form button[type="submit"]',
          refill: '#refill-form button[type="submit"]',
          audit: '#audit-form button[type="submit"]',
          analytics: '#stats-container',
          system: '#profile-container'
        };
        const requiredControl = document.querySelector(requiredSelectors[name]);
        const rect = requiredControl?.getBoundingClientRect();
        return {
          bodyScrollWidth: document.documentElement.scrollWidth,
          innerWidth,
          tabVisible: Boolean(tabElement && !tabElement.classList.contains('hidden')),
          navVisible: getComputedStyle(document.querySelector('.bottom-nav')).display !== 'none',
          requiredControlVisible: Boolean(rect && rect.width > 0 && rect.height > 0)
        };
      }, tab);
      observations.push({ tab, ...state });
    }
    assert(observations.every((item) => item.tabVisible && item.navVisible && item.bodyScrollWidth <= item.innerWidth + 2 && item.requiredControlVisible), `MOBILE_FUNCTIONAL_BLOCKER:${JSON.stringify(observations)}`);
    await page.setViewportSize({ width: 1280, height: 800 });
    return { evidence: observations };
  });

  await runTest('N1', 'PWA', 'manifest + icons + service worker programmatic validation', async () => {
    await ensureUsablePrimary();
    const data = await page.evaluate(async () => {
      const link = document.querySelector('link[rel="manifest"]');
      const manifestUrl = new URL(link.href, location.href).href;
      const response = await fetch(manifestUrl, { cache: 'no-store' });
      const manifest = await response.json();
      const iconStatuses = await Promise.all((manifest.icons || []).map(async (icon) => ({ src: icon.src, status: (await fetch(new URL(icon.src, manifestUrl))).status })));
      const registrations = await navigator.serviceWorker.getRegistrations();
      const sw = registrations[0] || null;
      return { manifestUrl, status: response.status, manifest, iconStatuses, registrationCount: registrations.length, swState: sw?.active?.state || null, controlled: Boolean(navigator.serviceWorker.controller) };
    });
    assert(data.status === 200 && data.manifest.start_url && data.manifest.scope && data.manifest.display && data.iconStatuses.length > 0 && data.iconStatuses.every((icon) => icon.status === 200) && data.swState === 'activated', 'PWA_TECHNICAL_REQUIREMENTS_FAILED');
    return { evidence: { ...data, install: 'PWA_INSTALL_MANUAL_REQUIRED' } };
  });

  await runTest('N2', 'PWA installation', 'Chromium UI installation cannot be asserted headlessly', async () => ({ status: 'MANUAL_REQUIRED', evidence: 'PWA_INSTALL_MANUAL_REQUIRED' }), { manual: true });

  assert(diagnostics.blockedTargets.length === 0, `PRODUCTION_FIREBASE_TARGET_ABORTED:${diagnostics.blockedTargets.join(',')}`);
  await cleanRestore();
  await emulatorRequest('DELETE', `catalogoProductos/${ADD_CODE}`);
} catch (error) {
  findings.push({ id: 'HARNESS_BLOCKER', summary: compactError(error) });
} finally {
  try { await cleanRestore(); } catch (error) { findings.push({ id: 'FINAL_RESTORE', summary: compactError(error) }); }
  try { await emulatorRequest('DELETE', `catalogoProductos/${ADD_CODE}`); } catch {}
  try { await fakeContext?.close(); } catch {}
  try { await context?.close(); } catch {}
}

const statusCounts = tests.reduce((counts, item) => ({ ...counts, [item.status]: (counts[item.status] || 0) + 1 }), {});
const unprovenIds = new Set(['E4', 'I3', 'I4', 'I5', 'J3']);
const provenMap = {
  E4: tests.find((item) => item.id === 'E4')?.status === 'PASS',
  I3: tests.find((item) => item.id === 'I3')?.status === 'PASS',
  I4: ['PASS', 'CONFIRMED_BUG'].includes(tests.find((item) => item.id === 'I4')?.status),
  I5: tests.find((item) => item.id === 'I5')?.status === 'PASS',
  J3: tests.find((item) => item.id === 'J1')?.status === 'PASS' && tests.find((item) => item.id === 'G1')?.status === 'PASS'
};
const result = {
  startedAt,
  finishedAt: new Date().toISOString(),
  playwrightVersion: process.env.npm_package_dependencies_playwright || '1.62.1',
  chromiumVersion: await chromium.launch({ headless: true }).then(async (browser) => { const version = browser.version(); await browser.close(); return version; }).catch(() => 'UNKNOWN'),
  appUrl: APP_URL,
  qaIdentity: { email: QA_EMAIL, determinante: QA_DETERMINANTE, password: '[REDACTED]' },
  networkGuard: diagnostics.blockedTargets.length === 0 ? 'PLAYWRIGHT_QA_NETWORK_GUARD_PASS' : 'PLAYWRIGHT_QA_NETWORK_GUARD_FAIL',
  networkTargets: [...diagnostics.networkTargets].sort(),
  blockedTargets: diagnostics.blockedTargets,
  unprovenBefore: unprovenIds.size,
  unprovenResults: provenMap,
  unprovenAfter: Object.values(provenMap).filter((value) => !value).length,
  tests,
  counts: { total: tests.length, pass: statusCounts.PASS || 0, fail: statusCounts.FAIL || 0, confirmedBug: statusCounts.CONFIRMED_BUG || 0, manualRequired: statusCounts.MANUAL_REQUIRED || 0 },
  diagnostics: {
    consoleErrors: diagnostics.console.filter((item) => item.type === 'error'),
    pageErrors: diagnostics.pageErrors,
    requestFailures: diagnostics.requestFailures,
    httpErrors: diagnostics.httpErrors,
    serviceWorkers: diagnostics.serviceWorkers,
    requests: diagnostics.requests
  },
  findings,
  finalRestore: findings.some((item) => item.id === 'FINAL_RESTORE') ? 'FAIL' : 'QA_FINAL_HASH_MATCH_PASS'
};
await writeFile(RESULT_PATH, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ resultPath: RESULT_PATH, counts: result.counts, unprovenAfter: result.unprovenAfter, networkGuard: result.networkGuard, finalRestore: result.finalRestore }));
if (result.networkGuard !== 'PLAYWRIGHT_QA_NETWORK_GUARD_PASS' || result.finalRestore !== 'QA_FINAL_HASH_MATCH_PASS' || findings.some((item) => item.id === 'HARNESS_BLOCKER')) process.exitCode = 1;
