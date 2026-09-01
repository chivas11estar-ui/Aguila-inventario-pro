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

    window.AGUILA_TELEMETRY_STATUS = {
        active: true,
        endpoint: BRIDGE_ENDPOINT,
        lastSentAt: null,
        lastError: null,
        queued: 0
    };

    console.log('[TELEMETRY] Agente de escucha activo');

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
        const response = await fetch(BRIDGE_ENDPOINT, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Bridge HTTP ${response.status}`);
        }

        window.AGUILA_TELEMETRY_STATUS.lastSentAt = new Date().toISOString();
        window.AGUILA_TELEMETRY_STATUS.lastError = null;
        return response;
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
            console.log('[TELEMETRY] Error reportado al Bridge');
        } catch (error) {
            queuePayload(payload);
            window.AGUILA_TELEMETRY_STATUS.lastError = error.message;
            console.warn('[TELEMETRY] Bridge no disponible; error guardado en cola local:', error.message);
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

    flushQueue();
})();
