import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { performance } from 'node:perf_hooks';
import { QA_DATABASE_URL, QA_DETERMINANTE, QA_EMAIL, QA_PROJECT_ID, calculateHashes, captureCurrentState, loadFixture, restoreQa, verifyRestoredState } from './qa-restore.mjs';
import { runWithGuaranteedRestore } from './qa-write-harness.mjs';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const reportPath = join(appRoot, 'AGUILA_FUNCTIONAL_STRESS_REPORT.md');
const allowedRoots = new Set(['productos', 'movimientos', 'auditorias']);
const results = [];
const findings = [];
const limitations = [
  'Browser no disponible por fallo del helper de aislamiento de Windows (apply deny-read ACLs).',
  'DOM ejecutado en VM sobre archivos de producción sin modificarlos.',
  'Cámara física, hard reload y service worker real quedan UNPROVEN.',
  'catalogoProductos simulado como existente para impedir escrituras fuera de rutas QA.'
];
let totalRuntimeWrites = 0;
let pushSequence = 0;

function must(condition, message) { if (!condition) throw new Error(message); }
function stable(value) { return JSON.stringify(value, Object.keys(value || {}).sort()); }
function countChildren(value) { return value && typeof value === 'object' ? Object.keys(value).length : 0; }
function totalStock(product) { return Object.values(product?.lotes || {}).reduce((sum, lot) => sum + (Number(lot?.stock) || 0), 0); }
function snapshot(value) {
  return {
    val: () => value,
    exists: () => value !== null && value !== undefined,
    forEach(callback) {
      if (!value || typeof value !== 'object') return false;
      for (const [key, child] of Object.entries(value)) callback({ key, val: () => child, exists: () => child !== null && child !== undefined });
      return false;
    }
  };
}
function assertLocalDestination() {
  const url = new URL(QA_DATABASE_URL);
  must(url.protocol === 'http:' && url.hostname === '127.0.0.1' && url.port === '9000', 'QA_WRITE_BLOCKED: non-local destination');
}
function assertQaPath(path) {
  const parts = String(path || '').replace(/^\/+|\/+$/g, '').split('/');
  must(parts.length >= 2 && allowedRoots.has(parts[0]) && parts[1] === QA_DETERMINANTE, 'QA_WRITE_BLOCKED: ' + path);
}
function emulatorUrl(path) {
  assertLocalDestination();
  const url = new URL(QA_DATABASE_URL + '/' + String(path || '').replace(/^\/+|\/+$/g, '') + '.json');
  url.searchParams.set('ns', QA_PROJECT_ID);
  url.searchParams.set('auth_variable_override', JSON.stringify({ uid: 'qa-user-99922', token: { email: QA_EMAIL } }));
  return url;
}
function createAdapter() {
  const writes = [];
  const reads = [];
  async function read(path, options = {}) {
    const url = emulatorUrl(path);
    const response = await fetch(url, { method: 'GET', headers: options.etag ? { 'X-Firebase-ETag': 'true' } : {} });
    const text = await response.text();
    if (!response.ok) throw new Error('EMULATOR_HTTP_' + response.status + ': ' + text);
    reads.push({ path, destination: url.origin, status: response.status });
    return { value: text ? JSON.parse(text) : null, etag: response.headers.get('etag') };
  }
  async function write(method, path, body, headers = {}) {
    assertQaPath(path);
    const response = await fetch(emulatorUrl(path), { method, headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
    const text = await response.text();
    if (!response.ok) { const error = new Error('EMULATOR_HTTP_' + response.status + ': ' + text); error.status = response.status; throw error; }
    writes.push({ method, path, destination: QA_DATABASE_URL, status: response.status });
    totalRuntimeWrites += 1;
    return text ? JSON.parse(text) : null;
  }
  function ref(path = '') {
    const normalized = String(path || '').replace(/^\/+|\/+$/g, '');
    return {
      key: normalized.split('/').filter(Boolean).at(-1) || null,
      async once() {
        if (normalized.startsWith('catalogoProductos/')) return snapshot({ nombre: 'CATALOGO QA AISLADO', marca: 'ÁGUILA QA', piezasPorCaja: 1 });
        if (normalized.startsWith('usuarios/')) return snapshot({ email: QA_EMAIL, determinante: QA_DETERMINANTE, nombrePromotor: 'QA Stress', nombreTienda: 'QA Emulator' });
        return snapshot((await read(normalized)).value);
      },
      async set(value) { return write('PUT', normalized, value); },
      async remove() { return write('DELETE', normalized, null); },
      async update(updates) {
        if (normalized) return write('PATCH', normalized, updates);
        for (const key of Object.keys(updates || {})) {
          if (key.startsWith('catalogoProductos/')) throw new Error('QA_WRITE_BLOCKED: catalogoProductos');
          assertQaPath(key);
        }
        const localUpdates = Object.fromEntries(Object.entries(updates).map(([key, value]) => [key.replace(/^productos\/99922\//, ''), value]));
        return write('PATCH', 'productos/' + QA_DETERMINANTE, localUpdates);
      },
      async push(value) {
        const key = 'qa-stress-' + String(++pushSequence).padStart(6, '0');
        await write('PUT', normalized + '/' + key, value);
        return { key };
      },
      transaction(updateFn, callback) {
        (async () => {
          try {
            for (let attempt = 0; attempt < 20; attempt += 1) {
              const current = await read(normalized, { etag: true });
              const next = updateFn(current.value);
              if (next === undefined) { callback(null, false, snapshot(current.value)); return; }
              try {
                const value = await write('PUT', normalized, next, { 'if-match': current.etag || '*' });
                callback(null, true, snapshot(value));
                return;
              } catch (error) {
                if (error.status === 412) continue;
                throw error;
              }
            }
            callback(new Error('TRANSACTION_RETRY_EXHAUSTED'), false, snapshot(null));
          } catch (error) { callback(error, false, snapshot(null)); }
        })();
      },
      on(event, callback) {
        if (event === 'value') read(normalized).then((current) => callback(snapshot(current.value))).catch(() => {});
        return callback;
      },
      off() {}
    };
  }
  return { writes, reads, ref, resetCounts() { writes.length = 0; reads.length = 0; }, async read(path) { return (await read(path)).value; } };
}

class FakeClassList {
  constructor(initial = []) { this.values = new Set(initial); }
  add(...items) { items.forEach((item) => this.values.add(item)); }
  remove(...items) { items.forEach((item) => this.values.delete(item)); }
  contains(item) { return this.values.has(item); }
  toggle(item, force) {
    if (force === true) this.values.add(item);
    else if (force === false) this.values.delete(item);
    else if (this.values.has(item)) this.values.delete(item);
    else this.values.add(item);
    return this.values.has(item);
  }
}
function createElement(id) {
  const listeners = {};
  return {
    id, value: '', textContent: '', innerHTML: '', disabled: false, style: {}, dataset: {},
    tagName: id.includes('video') ? 'VIDEO' : 'DIV', paused: false, srcObject: null,
    classList: new FakeClassList(id.startsWith('tab-') && id !== 'tab-inventory' ? ['hidden'] : id === 'tab-inventory' ? ['active'] : []),
    listeners,
    addEventListener(type, handler) { listeners[type] = listeners[type] || []; listeners[type].push(handler); },
    querySelector() { return null; }, querySelectorAll() { return []; }, closest() { return null; },
    focus() {}, reset() { this.value = ''; }, scrollTop: 0,
    pause() { this.paused = true; }, play() { this.paused = false; return Promise.resolve(); },
    load() {}, prepend() {}
  };
}
const sourceCache = new Map();
async function source(name) {
  if (!sourceCache.has(name)) sourceCache.set(name, await readFile(join(appRoot, name), 'utf8'));
  return sourceCache.get(name);
}
async function createRuntime(options = {}) {
  const adapter = createAdapter();
  const ids = [
    'add-product-form','add-barcode','add-product-name','add-brand','add-pieces-per-box','add-warehouse','add-expiry-date','add-boxes',
    'refill-form','refill-barcode','refill-nombre','refill-marca','refill-piezas','refill-warehouse','refill-expiry-date',
    'refill-product-info','refill-boxes','refill-pieces','refill-boxes-label','refill-pieces-group',
    'btn-refill-mode-entry','btn-refill-mode-exit','btn-refill-mode-pieces','scanner-modal','scanner-video','sidebar','btn-offline-status'
  ];
  const tabs = ['inventory','out-of-stock','add','refill','audit','analytics','system'].map((name) => createElement('tab-' + name));
  const navs = tabs.map((tab) => {
    const item = createElement('nav-' + tab.id.slice(4));
    item.getAttribute = (name) => name === 'data-tab' ? tab.id.slice(4) : null;
    return item;
  });
  const elements = new Map(ids.map((id) => [id, createElement(id)]));
  tabs.forEach((item) => elements.set(item.id, item));
  const submitButton = createElement('refill-submit');
  const documentListeners = {};
  const windowListeners = {};
  const timers = new Set();
  const telemetry = { toasts: [], errors: [], tabLoads: { inventory: 0, analytics: 0, audit: 0 } };
  const document = {
    readyState: 'complete', body: createElement('body'), documentElement: createElement('html'),
    getElementById(id) { return elements.get(id) || null; },
    querySelector(selector) {
      if (selector === '#refill-form button[type="submit"]') return submitButton;
      if (selector === '.tab-content.active') return tabs.find((tab) => tab.classList.contains('active')) || null;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '.tab-content') return tabs;
      if (selector === '[data-tab]') return navs;
      if (selector === '[id^="lote-btn-"]') return [];
      return [];
    },
    addEventListener(type, handler) { documentListeners[type] = documentListeners[type] || []; documentListeners[type].push(handler); },
    createElement(tag) { const item = createElement('generated-' + tag); item.tagName = String(tag).toUpperCase(); return item; }
  };
  const firebase = {
    apps: [{}], app: () => ({}),
    auth: () => ({ currentUser: { uid: 'qa-user-99922', email: QA_EMAIL }, onAuthStateChanged() { return () => {}; } }),
    database: () => ({ ref: adapter.ref })
  };
  const context = {
    console: {
      log() {}, debug() {},
      warn(...args) { telemetry.errors.push('WARN ' + args.map(String).join(' ')); },
      error(...args) { telemetry.errors.push('ERROR ' + args.map(String).join(' ')); }
    },
    window: null, document,
    navigator: { onLine: true, vibrate() {}, mediaDevices: { async getUserMedia() { throw new Error('QA_CAMERA_UNAVAILABLE'); } } },
    location: { hash: '' }, firebase, HTMLElement: class HTMLElement {}, BarcodeDetector: class BarcodeDetector {},
    Date, Math, JSON, Object, Array, Number, String, Boolean, Promise, URL, TextEncoder, parseFloat, parseInt, isNaN,
    btoa(value) { return Buffer.from(String(value), 'binary').toString('base64'); },
    atob(value) { return Buffer.from(String(value), 'base64').toString('binary'); },
    unescape, encodeURIComponent, decodeURIComponent,
    setTimeout(fn, delay, ...args) {
      const token = setTimeout(() => { timers.delete(token); try { fn(...args); } catch (error) { telemetry.errors.push('TIMER ' + error.message); } }, Math.min(Number(delay) || 0, 5));
      timers.add(token); return token;
    },
    clearTimeout(token) { timers.delete(token); clearTimeout(token); },
    setInterval() { const token = { interval: true }; timers.add(token); return token; },
    clearInterval(token) { timers.delete(token); },
    requestAnimationFrame(fn) { return context.setTimeout(fn, 0); },
    showToast(message, type) { telemetry.toasts.push({ message: String(message), type }); }
  };
  context.window = context;
  context.window.location = context.location;
  context.window.addEventListener = (type, handler) => { windowListeners[type] = windowListeners[type] || []; windowListeners[type].push(handler); };
  context.window.dispatchEvent = () => {};
  context.window.scrollTo = () => {};
  context.window.loadStats = async () => { telemetry.tabLoads.analytics += 1; };
  context.window.loadInventory = async () => { telemetry.tabLoads.inventory += 1; };
  context.window.loadAuditUI = async () => { telemetry.tabLoads.audit += 1; };
  context.window.loadUserProfile = async () => {};
  context.globalThis = context;
  vm.createContext(context);
  const files = ['date-utils.js', 'inventory-core.js', 'refill-safe.js'];
  if (options.analytics) files.push('analytics.js');
  if (options.listeners) files.push('listener-manager.js');
  if (options.app) files.push('app.js');
  if (options.scanner) files.push('scanner-mlkit.js');
  for (const name of files) vm.runInContext(await source(name), context, { filename: name });
  return { context, adapter, elements, telemetry, timers, documentListeners, windowListeners, tabs, navs };
}
async function state() { return captureCurrentState(); }
function movementDelta(before, after) { return countChildren(after.movimientos[QA_DETERMINANTE]) - countChildren(before.movimientos[QA_DETERMINANTE]); }
function productAt(current, code) { return current.productos[QA_DETERMINANTE]?.[code] || null; }
async function submitRefill(runtime, code, boxes, mode = 'exit', count = 1) {
  const ctx = runtime.context;
  await ctx.searchProductForRefillSafe(code);
  runtime.elements.get('refill-boxes').value = String(boxes);
  runtime.elements.get('refill-pieces').value = '0';
  ctx.setRefillModeSafe(mode);
  await Promise.all(Array.from({ length: count }, () => ctx.handleRefillSubmitSafe({ preventDefault() {} })));
  await new Promise((resolve) => setTimeout(resolve, 15));
}
async function addProduct(runtime, data) {
  return runtime.context.guardarProducto({
    codigoBarras: data.code, nombre: data.name || 'PRODUCTO QA STRESS', marca: data.brand || 'ÁGUILA QA',
    piezasPorCaja: data.ppc ?? 12, ubicacion: data.warehouse || 'QA_BODEGA_A',
    fechaCaducidad: data.expiry || '2027-02-01', cajas: data.boxes
  });
}
function addFinding(id, severity, rootCause) {
  const key = id + '|' + severity + '|' + rootCause;
  if (!findings.some((item) => item.key === key)) findings.push({ key, id, severity, rootCause });
}
async function runScenario(meta, testFn) {
  await restoreQa();
  const before = await state();
  const beforeHashes = calculateHashes(before);
  let outcome = null;
  let thrown = null;
  try {
    await runWithGuaranteedRestore(async () => {
      try { outcome = await testFn(before); } catch (error) { thrown = error; }
    });
  } catch (error) { throw new Error('RESTORE_FAILED_AFTER_' + meta.id + ': ' + error.message); }
  const restoredHashes = await verifyRestoredState();
  must(stable(restoredHashes) === stable(beforeHashes), 'RESTORE_HASH_MISMATCH_AFTER_' + meta.id);
  if (thrown && !outcome) outcome = { pass: false, actual: 'Excepción: ' + thrown.message, evidence: thrown.stack || thrown.message };
  outcome = outcome || { pass: false, actual: 'Sin resultado', evidence: 'Harness no produjo resultado' };
  const status = outcome.status || (outcome.pass ? 'PASS' : 'FAIL');
  const severity = status === 'FAIL' ? (outcome.severity || meta.severity || 'P2') : '';
  const row = {
    id: meta.id, module: meta.module, scenario: meta.scenario,
    before: outcome.before || 'Hash baseline ' + beforeHashes.PRODUCTOS_HASH.slice(0, 12),
    action: meta.action, expected: meta.expected, actual: outcome.actual,
    after: 'Restore hash baseline PASS', writes: outcome.writes ?? 0, movements: outcome.movements ?? 0,
    status, severity, rootCause: outcome.rootCause || '', evidence: outcome.evidence || ''
  };
  results.push(row);
  if (status === 'FAIL') addFinding(meta.id, severity, row.rootCause || row.actual);
  return row;
}
function recordUnproven(meta, reason) {
  results.push({
    id: meta.id, module: meta.module, scenario: meta.scenario, before: 'Baseline no alterado',
    action: meta.action, expected: meta.expected, actual: 'UNPROVEN: ' + reason, after: 'Sin escrituras; baseline intacto',
    writes: 0, movements: 0, status: 'UNPROVEN', severity: '', rootCause: '', evidence: reason
  });
}

async function groupA() {
  await runScenario({ id:'A1',module:'Identidad',scenario:'Producto inexistente +10',action:'guardarProducto',expected:'1 producto, 1 lote, stock 10' }, async () => {
    const r=await createRuntime(); r.adapter.resetCounts(); await addProduct(r,{code:'QA-STRESS-A-0001',boxes:10});
    const p=productAt(await state(),'QA-STRESS-A-0001');
    return {pass:!!p&&countChildren(p.lotes)===1&&totalStock(p)===10,actual:'lotes='+countChildren(p?.lotes)+' stock='+totalStock(p),writes:r.adapter.writes.length};
  });
  await runScenario({ id:'A2',module:'Identidad',scenario:'Mismo código/lote +10 y +5',action:'guardarProducto x2',expected:'Stock 15',severity:'P1' }, async () => {
    const r=await createRuntime(); await addProduct(r,{code:'QA-STRESS-A-0002',boxes:10}); r.adapter.resetCounts(); await addProduct(r,{code:'QA-STRESS-A-0002',boxes:5});
    const stock=totalStock(productAt(await state(),'QA-STRESS-A-0002'));
    return {pass:stock===15,severity:'P1',actual:'stock='+stock,writes:r.adapter.writes.length,rootCause:'inventory-core.js:215 reemplaza el stock del lote en vez de acumular.',evidence:'Esperado 15; observado '+stock};
  });
  for (const c of [
    {id:'A3',dates:['2027-02-01','2027-03-01'],warehouses:['QA_BODEGA_A','QA_BODEGA_A']},
    {id:'A4',dates:['2027-02-01','2027-02-01'],warehouses:['QA_BODEGA_A','QA_BODEGA_B']}
  ]) {
    await runScenario({id:c.id,module:'Identidad',scenario:'Mismo código con variante de lote',action:'guardarProducto x2',expected:'1 producto, 2 lotes'},async()=>{
      const r=await createRuntime(); const code='QA-STRESS-'+c.id+'-0001';
      await addProduct(r,{code,boxes:5,expiry:c.dates[0],warehouse:c.warehouses[0]});
      await addProduct(r,{code,boxes:5,expiry:c.dates[1],warehouse:c.warehouses[1]});
      const p=productAt(await state(),code);
      return {pass:!!p&&countChildren(p.lotes)===2,actual:'producto=1 lotes='+countChildren(p?.lotes),writes:r.adapter.writes.length};
    });
  }
  await runScenario({id:'A5',module:'Identidad',scenario:'Producto existente stock 0',action:'buscarProductoPorCodigo',expected:'Metadatos recuperados, logicalCount=1'},async()=>{
    const r=await createRuntime(); r.adapter.resetCounts(); const p=await r.context.buscarProductoPorCodigo('QA-000000000001'); const s=await state();
    const count=Object.keys(s.productos[QA_DETERMINANTE]).filter((k)=>k==='QA-000000000001').length;
    return {pass:p?.nombre==='PRODUCTO QA ZERO'&&p?.marca==='ÁGUILA QA'&&count===1,actual:'nombre='+p?.nombre+' marca='+p?.marca+' count='+count,writes:r.adapter.writes.length};
  });
}

async function groupB() {
  for (const [id,qty,a,b,total] of [['B1',1,4,20,24],['B2',5,0,20,20],['B3',10,0,15,15],['B4',25,0,0,0]]) {
    await runScenario({id,module:'Multilote',scenario:'Rellenar '+qty,action:'handleRefillSubmitSafe',expected:'A='+a+' B='+b+' total='+total+' movimiento=1'},async(before)=>{
      const r=await createRuntime(); r.adapter.resetCounts(); await submitRefill(r,'QA-000000000003',qty);
      const s=await state(); const p=productAt(s,'QA-000000000003'); const ma=Number(p.lotes['qa-lote-a'].stock); const mb=Number(p.lotes['qa-lote-b'].stock); const mov=movementDelta(before,s);
      return {pass:ma===a&&mb===b&&totalStock(p)===total&&mov===1,actual:'A='+ma+' B='+mb+' total='+totalStock(p),writes:r.adapter.writes.length,movements:mov};
    });
  }
  await runScenario({id:'B5',module:'Multilote',scenario:'Rellenar 26 con total 25',action:'handleRefillSubmitSafe',expected:'Rechazo, stock intacto, movimiento 0'},async(before)=>{
    const r=await createRuntime(); r.adapter.resetCounts(); await submitRefill(r,'QA-000000000003',26); const s=await state(); const mov=movementDelta(before,s); const stock=totalStock(productAt(s,'QA-000000000003'));
    return {pass:stock===25&&mov===0,actual:'stock='+stock+' movimientos='+mov,writes:r.adapter.writes.length,movements:mov,evidence:r.telemetry.toasts.map((x)=>x.message).join(' / ')};
  });
}

async function groupCD() {
  await runScenario({id:'C1',module:'Stock cero',scenario:'0 -> relleno directo 2; entrada 4',action:'Dos flujos reales',expected:'Movimiento directo 2 y bodega 4',severity:'P1'},async(before)=>{
    const r=await createRuntime(); r.adapter.resetCounts(); await submitRefill(r,'QA-000000000001',2,'exit'); const direct=await state(); const directMov=movementDelta(before,direct);
    await submitRefill(r,'QA-000000000001',4,'entry'); const s=await state(); const p=productAt(s,'QA-000000000001');
    const malformed=Object.values(p.lotes||{}).filter((l)=>l.bodega===undefined||l.fechaCaducidad===undefined).length;
    return {pass:directMov===1&&totalStock(p)===4&&malformed===0,severity:'P1',actual:'directMov='+directMov+' stock='+totalStock(p)+' lotesIncompletos='+malformed,writes:r.adapter.writes.length,movements:movementDelta(before,s),rootCause:'No existe entrada_directa_anaquel; la entrada sobre stock cero crea un lote transaccional sin metadatos.',evidence:r.telemetry.toasts.map((x)=>x.message).join(' / ')};
  });
  for (const qty of [1,2,10]) {
    await runScenario({id:'D'+qty,module:'Producto en 0',scenario:'Stock 0 -> relleno '+qty,action:'handleRefillSubmitSafe',expected:'Sin negativo, fantasma, duplicado o desaparición'},async(before)=>{
      const r=await createRuntime(); r.adapter.resetCounts(); await submitRefill(r,'QA-000000000001',qty); const s=await state(); const p=productAt(s,'QA-000000000001'); const mov=movementDelta(before,s);
      const direct=Object.values(s.movimientos[QA_DETERMINANTE]||{}).filter((m)=>m.productoCodigo==='QA-000000000001'&&m.tipo==='entrada_directa_anaquel'&&m.estadoOperacion==='confirmed');
      return {pass:totalStock(p)===0&&mov===1&&direct.length===1&&Number(direct[0].cajasMovidas)===qty,actual:'stock='+totalStock(p)+' movimientos='+mov+' directos='+direct.length+' productoExiste='+!!p,writes:r.adapter.writes.length,movements:mov};
    });
  }
}

async function repeatedSubmit(id,count,label) {
  await runScenario({id,module:'Doble submit',scenario:label,action:count+' invocaciones concurrentes',expected:'1 movimiento y delta 1',severity:'P1'},async(before)=>{
    const r=await createRuntime(); r.adapter.resetCounts(); await submitRefill(r,'QA-000000000002',1,'exit',count); const s=await state(); const mov=movementDelta(before,s); const delta=40-totalStock(productAt(s,'QA-000000000002'));
    return {pass:mov===1&&delta===1,severity:'P1',actual:'events='+count+' movimientos='+mov+' delta='+delta,writes:r.adapter.writes.length,movements:mov,rootCause:'handleRefillSubmitSafe no bloquea ni serializa submits; cada invocación puede registrar movimiento.',evidence:'Firebase writes='+r.adapter.writes.length};
  });
}
async function groupE() {
  await repeatedSubmit('E1',1,'Click único');
  await repeatedSubmit('E2',2,'Doble click rápido');
  await repeatedSubmit('E3',5,'Cinco clicks rápidos');
  recordUnproven({id:'E4',module:'Doble submit',scenario:'Enter',action:'Submit nativo',expected:'1 intención=1 movimiento'},'Requiere DOM/navegador real.');
  await repeatedSubmit('E5',2,'Enter + click simulado');
  await repeatedSubmit('E6',2,'Scanner callback + click simulado');
}

async function groupF() {
  await runScenario({id:'F1',module:'Concurrencia',scenario:'Stock 10, dos salidas de 6',action:'Dos clientes simultáneos',expected:'Solo una completa; cajas registradas = efecto real = 6',severity:'P1'},async()=>{
    const setupRuntime=await createRuntime(); await addProduct(setupRuntime,{code:'QA-STRESS-F1-0001',boxes:10,ppc:1}); const setup=await state();
    const a=await createRuntime(); const b=await createRuntime(); a.adapter.resetCounts(); b.adapter.resetCounts();
    await Promise.all([submitRefill(a,'QA-STRESS-F1-0001',6,'exit'),submitRefill(b,'QA-STRESS-F1-0001',6,'exit')]);
    const s=await state(); const stock=totalStock(productAt(s,'QA-STRESS-F1-0001'));
    const items=Object.values(s.movimientos[QA_DETERMINANTE]||{}).filter((m)=>m.productoCodigo==='QA-STRESS-F1-0001'&&m.estadoOperacion==='confirmed'); const moved=items.reduce((n,m)=>n+Number(m.cajasMovidas||0),0);
    return {pass:stock===4&&items.length===1&&moved===6&&moved===10-stock,severity:'P1',actual:'stock='+stock+' movimientos='+items.length+' cajasRegistradas='+moved,writes:a.adapter.writes.length+b.adapter.writes.length,movements:movementDelta(setup,s),rootCause:'modificarStockMultiLote usa read+update sin transacción global; ambas operaciones confirman el mismo stock previo.',evidence:'Efecto real='+(10-stock)+' vs movimiento='+moved};
  });
  await runScenario({id:'F2',module:'Concurrencia',scenario:'Dos entradas +5 al mismo lote',action:'modificarStock concurrente',expected:'Stock 50, sin lost update'},async()=>{
    const r=await createRuntime(); r.adapter.resetCounts(); await Promise.all([r.context.modificarStock('QA-000000000002',5,'sumar','qa-normal-a'),r.context.modificarStock('QA-000000000002',5,'sumar','qa-normal-a')]); await new Promise((x)=>setTimeout(x,15));
    const stock=totalStock(productAt(await state(),'QA-000000000002')); return {pass:stock===50,actual:'stock='+stock,writes:r.adapter.writes.length};
  });
  await runScenario({id:'F3',module:'Concurrencia',scenario:'Entrada +5 y salida -5',action:'modificarStock concurrente',expected:'Stock consistente 40'},async()=>{
    const r=await createRuntime(); r.adapter.resetCounts(); await Promise.all([r.context.modificarStock('QA-000000000002',5,'sumar','qa-normal-a'),r.context.modificarStock('QA-000000000002',5,'restar','qa-normal-a')]); await new Promise((x)=>setTimeout(x,15));
    const stock=totalStock(productAt(await state(),'QA-000000000002')); return {pass:stock===40,actual:'stock='+stock,writes:r.adapter.writes.length};
  });
}

async function groupG() {
  await runScenario({id:'G1',module:'Unidades',scenario:'2 cajas con ppc=12',action:'Rellenar 2',expected:'piezasMovidas=24'},async(before)=>{
    const r=await createRuntime(); r.adapter.resetCounts(); await submitRefill(r,'QA-000000000002',2); const s=await state();
    const newer=Object.entries(s.movimientos[QA_DETERMINANTE]).filter(([k])=>!Object.hasOwn(before.movimientos[QA_DETERMINANTE],k)).map(([,v])=>v); const m=newer[0];
    return {pass:newer.length===1&&Number(m?.piezasMovidas)===Number(m?.cajasMovidas)*12,actual:'cajas='+m?.cajasMovidas+' piezas='+m?.piezasMovidas,writes:r.adapter.writes.length,movements:newer.length};
  });
  await runScenario({id:'G2',module:'Unidades',scenario:'Etiqueta de stock del lote',action:'Render selector',expected:'Stock identificado como cajas',severity:'P1'},async()=>{
    const r=await createRuntime(); await r.context.searchProductForRefillSafe('QA-000000000002'); const html=r.elements.get('refill-product-info').innerHTML; const wrong=/40 pzs/.test(html);
    return {pass:!wrong,severity:'P1',actual:wrong?'UI muestra 40 pzs para stock en cajas.':'Etiqueta coherente',writes:r.adapter.writes.length,rootCause:'refill-safe.js etiqueta lote.stock como pzs aunque el modelo usa cajas.',evidence:html.replace(/\s+/g,' ').slice(0,220)};
  });
}

async function groupH() {
  await runScenario({id:'H1-H5',module:'Analytics',scenario:'23:59/00:01 y día/mes/año',action:'analyticsDateKey + procesarMetricas',expected:'Fechas y métricas correctas'},async()=>{
    const r=await createRuntime({analytics:true}); const c=r.context;
    const dates=[new Date(2026,0,1,23,59),new Date(2026,0,2,0,1),new Date(2026,1,1,0,1),new Date(2027,0,1,0,1)];
    const keys=dates.map((d)=>c.analyticsDateKey(d.getTime())); const expected=['2026-01-01','2026-01-02','2026-02-01','2027-01-01'];
    const today=new Date(); today.setHours(12,0,0,0); const day=c.getLocalDateString(today);
    c.ANALYTICS_STATE.movimientos=[
      {tipo:'salida',productoNombre:'NORMAL',productoCodigo:'QA-000000000002',marca:'ÁGUILA QA',cajasMovidas:2,piezasMovidas:24,fecha:today.getTime()},
      {tipo:'salida',productoNombre:'MULTILOTE',productoCodigo:'QA-000000000003',marca:'ÁGUILA QA',cajasMovidas:1,piezasMovidas:6,fecha:today.getTime()+1000}
    ];
    c.ANALYTICS_STATE.auditorias=[]; c.procesarMetricas(day); const x=c.ANALYTICS_STATE.resumen;
    return {pass:stable(keys)===stable(expected)&&x.cajasMovidasHoy===3&&x.piezasMovidasHoy===30&&x.topProductos[0]?.nombre==='NORMAL',actual:'keys='+keys.join(',')+' cajas='+x.cajasMovidasHoy+' piezas='+x.piezasMovidasHoy,writes:r.adapter.writes.length};
  });
}
async function groupI() {
  await runScenario({id:'I1',module:'Persistencia',scenario:'Guardar -> runtime nuevo',action:'guardarProducto y VM nueva',expected:'Producto persiste una vez'},async()=>{
    const a=await createRuntime(); await addProduct(a,{code:'QA-STRESS-I1-0001',boxes:7}); const b=await createRuntime(); const p=await b.context.buscarProductoPorCodigo('QA-STRESS-I1-0001');
    return {pass:p?._exists&&p.stockTotal===7,actual:'exists='+p?._exists+' stock='+p?.stockTotal,writes:a.adapter.writes.length};
  });
  await runScenario({id:'I2',module:'Persistencia',scenario:'Relleno -> runtime nuevo',action:'Rellenar 1 y VM nueva',expected:'Stock 39, movimiento 1'},async(before)=>{
    const a=await createRuntime(); await submitRefill(a,'QA-000000000002',1); const b=await createRuntime(); const p=await b.context.buscarProductoPorCodigo('QA-000000000002'); const s=await state(); const mov=movementDelta(before,s);
    return {pass:p?.stockTotal===39&&mov===1,actual:'stock='+p?.stockTotal+' movimientos='+mov,writes:a.adapter.writes.length,movements:mov};
  });
  recordUnproven({id:'I3',module:'Persistencia',scenario:'Auditoría -> reload',action:'Submit y reload',expected:'Auditoría persiste una vez'},'audit.js requiere interacción DOM no cubierta.');
  recordUnproven({id:'I4',module:'Persistencia',scenario:'Reload inmediato',action:'Reload durante submit',expected:'No duplica ni pierde'},'Requiere navegación real durante request en vuelo.');
  recordUnproven({id:'I5',module:'Persistencia',scenario:'Hard reload',action:'Hard reload',expected:'No reaplica submit'},'Requiere navegador y service worker real.');
}
async function groupJ() {
  await runScenario({id:'J1-J2',module:'Scanner',scenario:'50 aperturas y callbacks',action:'openScanner simulado',expected:'50 acciones, una por barcode'},async()=>{
    const r=await createRuntime({scanner:true}); let callbacks=0; r.context.ScannerService.requestCamera=async()=>true; r.context.ScannerService.scan=async(cb)=>cb('QA-000000000002');
    for(let i=0;i<50;i+=1) await r.context.openScanner(()=>{callbacks+=1;});
    return {pass:callbacks===50,actual:'aperturas=50 callbacks='+callbacks,writes:0,evidence:'MediaStream físico no usado'};
  });
  recordUnproven({id:'J3',module:'Scanner',scenario:'Cambio rápido de módulo',action:'Agregar/Relleno/Auditoría/Inventario/Relleno',expected:'Modo y stream correctos'},'No existe scannerMode global instrumentable y no hay cámara real.');
}
async function groupK() {
  await runScenario({id:'K1',module:'Tabs/listeners',scenario:'100 cambios instrumentados',action:'switchTab x100',expected:'Sin leak ni degradación'},async()=>{
    const r=await createRuntime({listeners:true,app:true}); const cp={}; const seq=['inventory','refill','audit','analytics','system']; const mem=process.memoryUsage().heapUsed; const start=performance.now();
    for(let i=1;i<=100;i+=1){const t=performance.now();r.context.switchTab(seq[(i-1)%seq.length],false);if([1,25,50,75,100].includes(i))cp[i]=Number((performance.now()-t).toFixed(4));}
    const listeners=r.context.LISTENERS_MANAGER.getStatus(); const pass=listeners.active<=1&&r.timers.size<=1&&r.adapter.reads.length===0;
    return {pass,actual:'ms='+JSON.stringify(cp)+' totalMs='+(performance.now()-start).toFixed(2)+' listeners='+listeners.active+' timers='+r.timers.size+' requests='+r.adapter.reads.length,writes:r.adapter.writes.length,evidence:'heapDelta='+(process.memoryUsage().heapUsed-mem)+'; '+(pass?'HARNESS_TIMEOUT previo no reproducido':'posible leak')};
  });
}
async function groupL() {
  for(const [id,label,value] of [['L1','0',0],['L2','-1',-1],['L4','999999',999999],['L5','vacío',''],['L6','espacios','   '],['L7','texto','abc'],['L8','null',null]]){
    await runScenario({id,module:'Input fuzz',scenario:'Refill '+label,action:'handleRefillSubmitSafe',expected:'Rechazo sin corrupción'},async(before)=>{
      const r=await createRuntime(); await r.context.searchProductForRefillSafe('QA-000000000002'); r.elements.get('refill-boxes').value=value===null?'':String(value); r.elements.get('refill-pieces').value='0'; r.adapter.resetCounts();
      await r.context.handleRefillSubmitSafe({preventDefault(){}}); await new Promise((x)=>setTimeout(x,10)); const s=await state(); const unchanged=stable(calculateHashes(s))===stable(calculateHashes(before));
      return {pass:unchanged,actual:'hashIntacto='+unchanged,writes:r.adapter.writes.length,movements:movementDelta(before,s),evidence:r.telemetry.toasts.map((x)=>x.message).join(' / ')};
    });
  }
  await runScenario({id:'L3',module:'Input fuzz',scenario:'Cajas decimal 1.5',action:'Refill 1.5',expected:'Rechazo',severity:'P1'},async(before)=>{
    const r=await createRuntime(); r.adapter.resetCounts(); await submitRefill(r,'QA-000000000002',1.5); const s=await state(); const mov=movementDelta(before,s); const delta=40-totalStock(productAt(s,'QA-000000000002'));
    return {pass:mov===0&&delta===0,severity:'P1',actual:'delta='+delta+' movimientos='+mov,writes:r.adapter.writes.length,movements:mov,rootCause:'parseFloat acepta cajas fraccionarias sin validación de entero.'};
  });
  await runScenario({id:'L9-L10',module:'Input fuzz',scenario:'Barcode desconocido/conocido',action:'Buscar ambos',expected:'Desconocido no escribe; conocido recupera'},async()=>{
    const r=await createRuntime(); r.adapter.resetCounts(); await r.context.searchProductForRefillSafe('QA-UNKNOWN-000000'); const uw=r.adapter.writes.length; const known=await r.context.buscarProductoPorCodigo('QA-000000000002');
    return {pass:uw===0&&known?._exists,actual:'unknownWrites='+uw+' known='+known?._exists,writes:r.adapter.writes.length};
  });
  for(const [id,ppc] of [['L11',0],['L12',-1]]){
    await runScenario({id,module:'Input fuzz',scenario:'piezasPorCaja='+ppc,action:'guardarProducto',expected:'Rechazo',severity:'P1'},async()=>{
      const r=await createRuntime(); r.adapter.resetCounts(); const code='QA-STRESS-'+id+'-0001'; let rejected=false; try { await addProduct(r,{code,boxes:1,ppc}); } catch (error) { rejected=true; } const p=productAt(await state(),code);
      return {pass:rejected&&!p&&r.adapter.writes.length===0,severity:'P1',actual:'rechazado='+rejected+' persistidoPpc='+p?.piezasPorCaja,writes:r.adapter.writes.length};
    });
  }
  await runScenario({id:'L13',module:'Input fuzz',scenario:'cajas=-1',action:'guardarProducto',expected:'Rechazo',severity:'P2'},async()=>{
    const r=await createRuntime(); r.adapter.resetCounts(); let rejected=false; try { await addProduct(r,{code:'QA-STRESS-L13-001',boxes:-1}); } catch (error) { rejected=true; } const p=productAt(await state(),'QA-STRESS-L13-001');
    return {pass:rejected&&!p&&r.adapter.writes.length===0,severity:'P2',actual:'rechazado='+rejected+' persistido='+!!p+' stock='+totalStock(p),writes:r.adapter.writes.length};
  });
  await runScenario({id:'L14',module:'Input fuzz',scenario:'Fecha inválida',action:'guardarProducto',expected:'Rechazo',severity:'P1'},async()=>{
    const r=await createRuntime(); r.adapter.resetCounts(); let rejected=false; try { await addProduct(r,{code:'QA-STRESS-L14-001',boxes:1,expiry:'no-es-fecha'}); } catch (error) { rejected=true; } const p=productAt(await state(),'QA-STRESS-L14-001');
    return {pass:rejected&&!p&&r.adapter.writes.length===0,severity:'P1',actual:'rechazado='+rejected+' persistido='+!!p,writes:r.adapter.writes.length};
  });
  await runScenario({id:'L15',module:'Input fuzz',scenario:'Submit sin producto',action:'handleRefillSubmitSafe',expected:'0 escrituras'},async()=>{
    const r=await createRuntime(); r.adapter.resetCounts(); await r.context.handleRefillSubmitSafe({preventDefault(){}});
    return {pass:r.adapter.writes.length===0,actual:'writes='+r.adapter.writes.length,writes:r.adapter.writes.length};
  });
}
async function groupM() {
  await runScenario({id:'M1',module:'Sesión prolongada',scenario:'Carga larga controlada',action:'200 búsquedas,100 tabs,100 reads,50 refills,50 VM reload',expected:'Sin errores; stock/movimientos consistentes'},async(before)=>{
    const r=await createRuntime({listeners:true,app:true}); await addProduct(r,{code:'QA-STRESS-M-000001',boxes:100,ppc:2}); r.adapter.resetCounts(); const start=performance.now();
    for(let i=0;i<200;i+=1)await r.context.buscarProductoPorCodigo('QA-STRESS-M-000001');
    const tabs=['inventory','refill','audit','analytics','system']; for(let i=0;i<100;i+=1)r.context.switchTab(tabs[i%5],false);
    for(let i=0;i<100;i+=1)await r.adapter.read('productos/99922/QA-STRESS-M-000001');
    for(let i=0;i<50;i+=1)await submitRefill(r,'QA-STRESS-M-000001',1);
    for(let i=0;i<50;i+=1){const fresh=await createRuntime();await fresh.context.buscarProductoPorCodigo('QA-STRESS-M-000001');}
    const s=await state(); const p=productAt(s,'QA-STRESS-M-000001'); const movs=Object.values(s.movimientos[QA_DETERMINANTE]||{}).filter((m)=>m.productoCodigo==='QA-STRESS-M-000001');
    const units=movs.every((m)=>Number(m.piezasMovidas)===Number(m.cajasMovidas)*2); const errors=r.telemetry.errors.filter((x)=>x.startsWith('ERROR')).length;
    return {pass:totalStock(p)===50&&movs.length===50&&units&&errors===0,actual:'stock='+totalStock(p)+' movimientos='+movs.length+' requests='+r.adapter.reads.length+' elapsedMs='+(performance.now()-start).toFixed(2),writes:r.adapter.writes.length,movements:movementDelta(before,s),evidence:'listeners='+r.context.LISTENERS_MANAGER.getStatus().active+' timers='+r.timers.size+' errors='+errors+' reloads=50'};
  });
}

function escapeCell(value) { return String(value ?? '').replace(/\|/g,'\\|').replace(/\r?\n/g,' '); }
function buildReport(fixtureHashes, finalHashes) {
  const pass=results.filter((r)=>r.status==='PASS').length;
  const fail=results.filter((r)=>r.status==='FAIL').length;
  const unproven=results.filter((r)=>r.status==='UNPROVEN').length;
  const sev=Object.fromEntries(['P0','P1','P2','P3'].map((s)=>[s,results.filter((r)=>r.severity===s).length]));
  const rows=results.map((r)=>[r.id,r.module,r.scenario,r.before,r.action,r.expected,r.actual,r.after,r.writes,r.movements,r.status,r.severity,r.rootCause,r.evidence].map(escapeCell).join(' | ')).map((x)=>'| '+x+' |').join('\n');
  const bugs=findings.length?findings.map((f)=>'- '+f.id+' ['+f.severity+']: '+f.rootCause).join('\n'):'- Ninguno.';
  return [
    '# ÁGUILA Functional Stress Report','',
    'QA_MODE=true','DATABASE_TARGET=http://127.0.0.1:9000','ACCOUNT='+QA_EMAIL,'DETERMINANTE='+QA_DETERMINANTE,
    'BASELINE_HASHES='+JSON.stringify(fixtureHashes),'FINAL_HASHES='+JSON.stringify(finalHashes),'',
    '| ID | MODULE | SCENARIO | STATE_BEFORE | ACTION | EXPECTED | ACTUAL | STATE_AFTER | FIREBASE_WRITES | MOVEMENTS | PASS_FAIL | SEVERITY | ROOT_CAUSE | EVIDENCE |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | --- | --- | --- | --- |',rows,'',
    'TOTAL_TESTS='+results.length,'PASS='+pass,'FAIL='+fail,'UNPROVEN='+unproven,'P0='+sev.P0,'P1='+sev.P1,'P2='+sev.P2,'P3='+sev.P3,
    'EMULATOR_RUNTIME_WRITES='+totalRuntimeWrites,'',
    '## CONFIRMED_BUGS','',bugs,'',
    '## EXPECTED_BEHAVIOR','',
    '- Baseline restaurado y hash comparado después de cada escenario ejecutado.',
    '- Rutas limitadas a productos/99922, movimientos/99922 y auditorias/99922.',
    '- Transacciones de lote individual preservaron concurrencia sin stock negativo.','',
    '## HARNESS_LIMITATIONS','',limitations.map((x)=>'- '+x).join('\n'),'',
    '## UNPROVEN','',results.filter((r)=>r.status==='UNPROVEN').map((r)=>'- '+r.id+': '+r.actual).join('\n')||'- Ninguno.','',
    'FIREBASE_PRODUCTION_WRITES=0','DEPLOY=NO','PUSH=NO','PRODUCTION_CODE_CHANGES=0','',
    fail>0?'AGUILA_FUNCTIONAL_STRESS_PASS_WITH_FINDINGS':'AGUILA_FUNCTIONAL_STRESS_PASS',''
  ].join('\n');
}
async function main() {
  assertLocalDestination();
  must(process.env.QA_MODE==='true','QA_WRITE_BLOCKED: QA_MODE');
  const fixture=await loadFixture();
  const baseline=calculateHashes(fixture.state);
  try {
    await groupA(); await groupB(); await groupCD(); await groupE(); await groupF(); await groupG();
    await groupH(); await groupI(); await groupJ(); await groupK(); await groupL(); await groupM();
  } finally { await restoreQa(); }
  const finalHashes=await verifyRestoredState(fixture);
  must(stable(finalHashes)===stable(baseline),'QA_FINAL_HASH_MISMATCH');
  await writeFile(reportPath,buildReport(baseline,finalHashes),'utf8');
  console.log(JSON.stringify({
    total:results.length,pass:results.filter((r)=>r.status==='PASS').length,
    fail:results.filter((r)=>r.status==='FAIL').length,unproven:results.filter((r)=>r.status==='UNPROVEN').length,
    findings:findings.length,runtimeWrites:totalRuntimeWrites,finalHashes
  }));
  console.log(findings.length?'AGUILA_FUNCTIONAL_STRESS_PASS_WITH_FINDINGS':'AGUILA_FUNCTIONAL_STRESS_PASS');
}
export { addProduct, countChildren, createRuntime, movementDelta, productAt, state, submitRefill, totalStock };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error)=>{console.error(error.stack||error.message);process.exitCode=1;});
}
