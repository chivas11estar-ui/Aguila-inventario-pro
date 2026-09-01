// ============================================================
// Águila Inventario Pro - QA runtime gate
// Activo exclusivamente en localhost/127.0.0.1 con ?qa=1.
// ============================================================

'use strict';

(function attachAguilaQaRuntime(global) {
  if (global.createAguilaQaRuntime) return;

  const QA_HOSTS = Object.freeze(new Set(['localhost', '127.0.0.1']));
  const QA_EMAIL = 'qa.aguila.20260822@example.com';
  const QA_DETERMINANTE = '99922';
  const QA_PROJECT_ID = 'demo-aguila-qa';
  const QA_API_KEY = 'demo-aguila-qa-api-key';
  const QA_APP_ID = '1:99922:web:aguila-qa';
  const AUTH_TARGET = 'http://127.0.0.1:9099';
  const DATABASE_TARGET = 'http://127.0.0.1:9000';
  const WRITABLE_ROOTS = new Set(['productos', 'movimientos', 'auditorias', 'auditorias_completadas']);

  function normalizePath(value) {
    return String(value || '').replace(/^\/+|\/+$/g, '');
  }

  function joinPath(base, child) {
    return [normalizePath(base), normalizePath(child)].filter(Boolean).join('/');
  }

  function toError(code) {
    const error = new Error(code);
    error.code = code;
    return error;
  }

  function createRuntime(location = global.location, options = {}) {
    const logger = options.logger || global.console || console;
    const hostname = String(location?.hostname || '').toLowerCase();
    const search = String(location?.search || '');
    const requested = new URLSearchParams(search).get('qa') === '1';
    const localhost = QA_HOSTS.has(hostname);
    const enabled = requested && localhost;
    const state = {
      enabled,
      requested,
      localhost,
      hostname,
      databaseTarget: enabled ? DATABASE_TARGET : 'production',
      authTarget: enabled ? AUTH_TARGET : 'production',
      determinanteAllowed: QA_DETERMINANTE,
      productionFirebaseAllowed: !enabled,
      status: enabled ? 'initializing' : 'production',
      failure: null,
      routingConfigured: false,
      networkTargets: []
    };

    let readyPromise = null;

    if (requested && !localhost) {
      logger.warn('QA_MODE_BLOCKED_NONLOCAL', { host: hostname || 'unknown' });
    }

    function logMode() {
      if (!enabled) {
        logger.info('QA_MODE=false');
        logger.info('DATABASE_TARGET=production');
        return;
      }

      logger.info('================================');
      logger.info('ÁGUILA QA EMULATOR MODE');
      logger.info('================================');
      logger.info('QA_MODE=true');
      logger.info(`HOST=${hostname}`);
      logger.info('AUTH_TARGET=127.0.0.1:9099');
      logger.info('DATABASE_TARGET=127.0.0.1:9000');
      logger.info(`DETERMINANTE_ALLOWED=${QA_DETERMINANTE}`);
      logger.info('PRODUCTION_FIREBASE_ALLOWED=false');
      logger.info('================================');
    }

    function block(reason) {
      state.status = 'blocked';
      state.failure = reason;
      state.productionFirebaseAllowed = false;
      logger.error(reason);
      return toError(reason);
    }

    function getFirebaseConfig(productionConfig) {
      if (!enabled) return productionConfig;

      return {
        ...productionConfig,
        apiKey: QA_API_KEY,
        appId: QA_APP_ID,
        authDomain: `${QA_PROJECT_ID}.localhost`,
        databaseURL: `${DATABASE_TARGET}?ns=${QA_PROJECT_ID}`,
        projectId: QA_PROJECT_ID,
        messagingSenderId: '99922',
        storageBucket: `${QA_PROJECT_ID}.appspot.com`
      };
    }

    function assertQaIdentity(email, determinante) {
      if (!enabled) return true;

      const normalizedEmail = String(email || '').trim().toLowerCase();
      const normalizedDeterminante = String(determinante || '').trim().toUpperCase();
      if (normalizedEmail !== QA_EMAIL || normalizedDeterminante !== QA_DETERMINANTE) {
        throw toError('QA_WRITE_BLOCKED');
      }
      return true;
    }

    function assertWriteAllowed(path, updatePayload) {
      if (!enabled) return true;

      const normalized = normalizePath(path);
      const parts = normalized ? normalized.split('/') : [];
      const directPathAllowed = parts.length >= 2 && WRITABLE_ROOTS.has(parts[0]) && parts[1] === QA_DETERMINANTE;

      if (normalized && !directPathAllowed) {
        throw toError('QA_WRITE_BLOCKED');
      }

      if (!normalized && updatePayload && typeof updatePayload === 'object') {
        const entries = Object.keys(updatePayload);
        if (entries.length === 0) throw toError('QA_WRITE_BLOCKED');
        entries.forEach((child) => assertWriteAllowed(child));
      } else if (!normalized) {
        throw toError('QA_WRITE_BLOCKED');
      }

      if (state.status !== 'ready') throw toError('QA_EMULATOR_REQUIRED');
      return true;
    }

    function guardOnDisconnect(onDisconnect, path) {
      return new Proxy(onDisconnect, {
        get(target, property) {
          const value = Reflect.get(target, property, target);
          if (['set', 'setWithPriority', 'update', 'remove'].includes(property)) {
            return (...args) => {
              assertWriteAllowed(path, property === 'update' ? args[0] : undefined);
              return value.apply(target, args);
            };
          }
          return typeof value === 'function' ? value.bind(target) : value;
        }
      });
    }

    function guardReference(reference, path) {
      return new Proxy(reference, {
        get(target, property) {
          const value = Reflect.get(target, property, target);

          if (property === 'child') {
            return (childPath) => guardReference(value.call(target, childPath), joinPath(path, childPath));
          }
          if (property === 'root') return guardReference(value, '');
          if (property === 'parent') {
            const parentPath = normalizePath(path).split('/').slice(0, -1).join('/');
            return value ? guardReference(value, parentPath) : value;
          }
          if (property === 'onDisconnect') {
            return () => guardOnDisconnect(value.call(target), path);
          }
          if (['set', 'setWithPriority', 'update', 'remove', 'transaction'].includes(property)) {
            return (...args) => {
              assertWriteAllowed(path, property === 'update' ? args[0] : undefined);
              return value.apply(target, args);
            };
          }
          if (property === 'push') {
            return (...args) => {
              if (args.length > 0) assertWriteAllowed(path);
              const pushed = value.apply(target, args);
              return guardReference(pushed, joinPath(path, pushed?.key || ''));
            };
          }
          return typeof value === 'function' ? value.bind(target) : value;
        }
      });
    }

    function installDatabaseGuard(database) {
      if (!enabled || database.__aguilaQaWriteGuard) return;
      const originalRef = database.ref.bind(database);
      database.ref = (path = '') => guardReference(originalRef(path), normalizePath(path));
      Object.defineProperty(database, '__aguilaQaWriteGuard', { value: true, configurable: false });
    }

    function configureFirebase({ auth, database }) {
      if (!enabled) {
        logMode();
        return true;
      }

      if (!auth || typeof auth.useEmulator !== 'function' || !database || typeof database.useEmulator !== 'function') {
        throw block('QA_EMULATOR_REQUIRED');
      }

      try {
        auth.useEmulator(AUTH_TARGET, { disableWarnings: true });
        database.useEmulator('127.0.0.1', 9000);
        installDatabaseGuard(database);
        state.routingConfigured = true;
        state.productionFirebaseAllowed = false;
        logMode();
        return true;
      } catch (error) {
        logger.error('QA_EMULATOR_REQUIRED', error?.message || error);
        throw block('QA_EMULATOR_REQUIRED');
      }
    }

    async function probeEndpoint(url, fetchImpl) {
      const fetchFn = fetchImpl || options.fetchImpl || global.fetch;
      if (typeof fetchFn !== 'function') throw toError('QA_EMULATOR_REQUIRED');

      let timeoutId = null;
      const request = Promise.resolve(fetchFn(url, { method: 'GET', cache: 'no-store' }));
      const timeout = new Promise((_, reject) => {
        timeoutId = global.setTimeout(() => reject(toError('QA_EMULATOR_REQUIRED')), 1800);
      });

      try {
        const response = await Promise.race([request, timeout]);
        if (!response || Number(response.status) >= 500) throw toError('QA_EMULATOR_REQUIRED');
        state.networkTargets.push({ url, status: Number(response.status) || 0 });
        return response;
      } finally {
        if (timeoutId !== null) global.clearTimeout(timeoutId);
      }
    }

    function ensureEmulators(fetchImpl) {
      if (!enabled) return Promise.resolve({ status: 'production' });
      if (readyPromise) return readyPromise;
      if (!state.routingConfigured) return Promise.reject(block('QA_EMULATOR_REQUIRED'));

      readyPromise = Promise.all([
        probeEndpoint(`${AUTH_TARGET}/`, fetchImpl),
        probeEndpoint(`${DATABASE_TARGET}/.json?ns=${QA_PROJECT_ID}`, fetchImpl)
      ]).then(() => {
        state.status = 'ready';
        logger.info('QA_RUNTIME_FAIL_CLOSED_PASS');
        return { status: state.status, networkTargets: state.networkTargets.slice() };
      }).catch((error) => {
        readyPromise = null;
        throw block(error?.code || 'QA_EMULATOR_REQUIRED');
      });

      return readyPromise;
    }

    async function requireReady() {
      if (!enabled) return { status: 'production' };
      if (!state.routingConfigured) throw block('QA_EMULATOR_REQUIRED');
      return ensureEmulators();
    }

    return Object.freeze({
      get enabled() { return state.enabled; },
      get requested() { return state.requested; },
      get localhost() { return state.localhost; },
      get hostname() { return state.hostname; },
      get databaseTarget() { return state.databaseTarget; },
      get authTarget() { return state.authTarget; },
      get determinanteAllowed() { return state.determinanteAllowed; },
      get productionFirebaseAllowed() { return state.productionFirebaseAllowed; },
      get status() { return state.status; },
      get failure() { return state.failure; },
      get networkTargets() { return state.networkTargets.slice(); },
      state,
      constants: Object.freeze({ QA_EMAIL, QA_DETERMINANTE, QA_PROJECT_ID, AUTH_TARGET, DATABASE_TARGET }),
      getFirebaseConfig,
      configureFirebase,
      ensureEmulators,
      requireReady,
      assertQaIdentity,
      assertWriteAllowed,
      isQaDeterminanteAllowed: (value) => String(value || '').trim().toUpperCase() === QA_DETERMINANTE
    });
  }

  global.createAguilaQaRuntime = createRuntime;
  global.QA_RUNTIME = createRuntime();
  global.markAguilaBoot?.('T2_QA_DETECTED', { enabled: global.QA_RUNTIME.enabled });
})(window);