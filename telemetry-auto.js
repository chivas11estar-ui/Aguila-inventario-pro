/**
 * Aguila Inventario Pro - telemetry-auto.js
 * Capturador de errores para el Bridge de autorreparacion.
 */

(function () {
    if (window.__AGUILA_TELEMETRY_ACTIVE) return;
    window.__AGUILA_TELEMETRY_ACTIVE = true;

    const BRIDGE_ENDPOINT = 'https://136.67.102.100.sslip.io/errors';
    const API_KEY_APP = 'aguila-telemetry-v1';
    const QUEUE_KEY = 'aguila_telemetry_queue';
    const MAX_QUEUE = 25;

    // Interruptor para silenciar la telemetria si el Bridge no esta disponible.
    // Poner en false para evitar cualquier fetch a un bridge caido (evita
    // ERR_CONNECTION_TIMEOUT en la consola). Por defecto activo, pero el fetch
    // usa un timeout corto y aborta silenciosamente si el bridge no responde.
    const TELEMETRY_ENABLED = window.AGUILA_TELEMETRY_ENABLED !== false;
    const FETCH_TIMEOUT_MS = 3000;

    window.AGUILA_TELEMETRY_STATUS = {
        active: TELEMETRY_ENABLED,
        endpoint: BRIDGE_ENDPOINT,
        lastSentAt: null,
        lastError: null,
        queued: 0
    };

    // console.log('[TELEMETRY] Agente de escucha activo');

    function getDeterminante() {
        return window.PROFILE_STATE?.determinante ||
            window.INVENTORY_STATE?.determinante ||
            window.INVENTORY_CORE?.determinante ||
            'desconocido';
    }

    function readQueue() {
        try {
            return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
        } catch (error) {
            return [];
        }
    }

    function writeQueue(queue) {
        const nextQueue = queue.slice(-MAX_QUEUE);
        localStorage.setItem(QUEUE_KEY, JSON.stringify(nextQueue));
        window.AGUILA_TELEMETRY_STATUS.queued = nextQueue.length;
    }

    function queuePayload(payload) {
        const queue = readQueue();
        queue.push(payload);
        writeQueue(queue);
    }

    async function sendPayload(payload) {
        if (!TELEMETRY_ENABLED) return null;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

        try {
            const response = await fetch(BRIDGE_ENDPOINT, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`Bridge HTTP ${response.status}`);
            }

            window.AGUILA_TELEMETRY_STATUS.lastSentAt = new Date().toISOString();
            window.AGUILA_TELEMETRY_STATUS.lastError = null;
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            // Fallo silencioso: si el bridge no responde, guardamos en cola
            // sin generar errores de red visibles en la consola.
            if (error && error.name === 'AbortError') {
                const abortErr = new Error(`Bridge timeout ${FETCH_TIMEOUT_MS}ms`);
                abortErr.silent = true;
                throw abortErr;
            }
            error.silent = true;
            throw error;
        }
    }

    async function flushQueue() {
        const queue = readQueue();
        if (!queue.length) return;

        const pending = [];
        for (const payload of queue) {
            try {
                await sendPayload(payload);
            } catch (error) {
                pending.push(payload);
                window.AGUILA_TELEMETRY_STATUS.lastError = error.message;
            }
        }
        writeQueue(pending);
    }

    async function reportError(errorData) {
        if (!TELEMETRY_ENABLED) return;

        const payload = {
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            error: errorData,
            auth: {
                apiKey: API_KEY_APP,
                determinante: getDeterminante()
            }
        };

        try {
            await sendPayload(payload);
            flushQueue();
            // console.log('[TELEMETRY] Error reportado al Bridge');
        } catch (error) {
            queuePayload(payload);
            window.AGUILA_TELEMETRY_STATUS.lastError = error.message;
            // Silenciado para evitar spam en consola si el bridge no está disponible
            // console.warn('[TELEMETRY] Bridge no disponible; error guardado en cola local:', error.message);
        }
    }

    window.AGUILA_REPORT_ERROR = reportError;

    window.addEventListener('error', (event) => {
        reportError({
            type: 'runtime_error',
            message: event.message,
            source: event.filename,
            line: event.lineno,
            column: event.colno,
            stack: event.error ? event.error.stack : null
        });
    });

    window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason;
        reportError({
            type: 'unhandled_rejection',
            message: reason?.message || String(reason || 'Unknown rejection'),
            stack: reason?.stack || null
        });
    });

    ['error', 'warn'].forEach((level) => {
        const original = console[level];
        console[level] = function telemetryConsoleCapture(...args) {
            original.apply(console, args);
            const text = args.map((arg) => {
                if (arg instanceof Error) return `${arg.message}\n${arg.stack || ''}`;
                if (typeof arg === 'string') return arg;
                try { return JSON.stringify(arg); } catch (error) { return String(arg); }
            }).join(' ');

            if (text.includes('[TELEMETRY]')) return;
            reportError({ type: `console_${level}`, message: text }).catch(() => {});
        };
    });

    if (TELEMETRY_ENABLED) {
        flushQueue();
    }
})();
