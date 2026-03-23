/**
 * Águila Inventario Pro - Módulo: audit-pro-ui.js
 * Arquitectura de Auditoría Controlada (OLED Friendly)
 * Copyright © 2026 José A. G. Betancourt
 */

'use strict';

window.AUDIT_PRO = {
    session: [], // Persistencia local de la sesión actual
    state: 'IDLE', // IDLE, SCANNING, VALIDATING
    continuousMode: false,
    lastCode: null,
    debounceTime: 2500,
    lastScanTimestamp: 0,

    // Configuración Visual (OLED)
    theme: {
        bg: '#000000',
        cardMatch: '#064e3b', // Esmeralda muy oscuro
        cardDiff: '#451a03',  // Naranja quemado oscuro
        cardNotFound: '#450a0a', // Rojo sangre oscuro
        text: '#ffffff'
    }
};

/**
 * 1. INICIALIZACIÓN DE LA INTERFAZ PRO
 */
function initAuditProUI() {
    const container = document.getElementById('tab-audit');
    if (!container) return;

    // Inyectar Estilos Críticos Pro
    injectAuditStyles();

    container.innerHTML = `
        <div class="audit-pro-container">
            <!-- ZONA SUPERIOR: CÁMARA Y MIRA -->
            <div class="audit-camera-zone">
                <div id="audit-scanner-view">
                    <div class="telescopic-sight">
                        <div class="sight-corner top-left"></div>
                        <div class="sight-corner top-right"></div>
                        <div class="sight-corner bottom-left"></div>
                        <div class="sight-corner bottom-right"></div>
                        <div class="sight-line"></div>
                    </div>
                </div>
                <div class="audit-status-bar">
                    <span id="audit-state-indicator">⚪ LISTO</span>
                    <button id="btn-sync-audit" onclick="window.AUDIT_SYNC.syncAuditSession()" 
                        style="background: #10b981; color: white; border: none; padding: 4px 12px; border-radius: 20px; font-size: 10px; font-weight: 700; cursor: pointer;">
                        📥 CERRAR AUDITORÍA
                    </button>
                    <span id="audit-session-count">📦 0 Escaneados</span>
                </div>
            </div>

            <!-- ZONA INFERIOR: LISTA DE ALTO CONTRASTE -->
            <div class="audit-list-zone">
                <div id="audit-items-list" class="audit-scroll-area">
                    <div class="audit-empty-state">
                        <p>Presiona el botón para iniciar auditoría</p>
                        <small>Los resultados aparecerán aquí en tiempo real</small>
                    </div>
                </div>
            </div>

            <!-- BOTÓN FLOTANTE (FAB) -->
            <button id="fab-audit-trigger" class="fab-main">
                <span class="material-icons-round">qr_code_scanner</span>
            </button>
        </div>
    `;

    setupAuditListeners();
}

/**
 * 2. LÓGICA DE ESCANEO Y VALIDACIÓN
 */
async function handleAuditScan(code) {
    const now = Date.now();
    
    // Anti-duplicado (Debounce)
    if (code === window.AUDIT_PRO.lastCode && (now - window.AUDIT_PRO.lastScanTimestamp) < window.AUDIT_PRO.debounceTime) {
        return;
    }

    window.AUDIT_PRO.state = 'VALIDATING';
    updateAuditStateUI('🟡 VALIDANDO...', '#f59e0b');
    
    // Feedback Háptico
    if (navigator.vibrate) navigator.vibrate(40);

    // Buscar en el núcleo híbrido (RTDB + Firestore)
    // Nota: Usamos la función global buscarProductoPorCodigo de inventory-core.js
    const product = await window.buscarProductoPorCodigo(code);
    
    const auditItem = {
        timestamp: new Date().toLocaleTimeString(),
        code: code,
        name: (product && product._exists) ? product.nombre : 'DESCONOCIDO',
        brand: (product && product._exists) ? product.marca : 'N/A',
        expected: (product && product._exists) ? (product.stockTotal || 0) : 0,
        counted: 1, // Default por escaneo
        status: 'MATCH'
    };

    if (!product || !product._exists) {
        auditItem.status = 'NOT_FOUND';
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    } else if (auditItem.counted !== auditItem.expected) {
        auditItem.status = 'DIFF';
    }

    // Persistencia Local
    window.AUDIT_PRO.session.unshift(auditItem);
    window.AUDIT_PRO.lastCode = code;
    window.AUDIT_PRO.lastScanTimestamp = now;

    renderAuditList();
    
    if (window.AUDIT_PRO.continuousMode) {
        window.AUDIT_PRO.state = 'SCANNING';
        updateAuditStateUI('🟢 ESCANEANDO...', '#10b981');
    } else {
        stopAuditScanning();
    }
}

/**
 * 3. COMPONENTE: CARD DE ALTO CONTRASTE
 */
function renderAuditList() {
    const list = document.getElementById('audit-items-list');
    const counter = document.getElementById('audit-session-count');
    if (!list || !counter) return;
    
    counter.textContent = `📦 ${window.AUDIT_PRO.session.length} Escaneados`;

    if (window.AUDIT_PRO.session.length === 0) {
        list.innerHTML = `
            <div class="audit-empty-state">
                <p>Presiona el botón para iniciar auditoría</p>
                <small>Los resultados aparecerán aquí en tiempo real</small>
            </div>
        `;
        return;
    }

    list.innerHTML = window.AUDIT_PRO.session.map((item, index) => `
        <div class="audit-card ${item.status.toLowerCase()}" onclick="openManualAdjustment(${index})">
            <div class="card-info">
                <span class="card-time">${item.timestamp}</span>
                <h4 class="card-title">${item.name}</h4>
                <p class="card-subtitle">${item.brand} | ${item.code}</p>
            </div>
            <div class="card-values">
                <div class="val-box">
                    <small>SISTEMA</small>
                    <span>${item.expected}</span>
                </div>
                <div class="val-box highlight">
                    <small>CONTEO</small>
                    <span>${item.counted}</span>
                </div>
            </div>
        </div>
    `).join('');
}

/**
 * 4. MODAL RÁPIDO: AJUSTE MANUAL
 */
function openManualAdjustment(index) {
    const item = window.AUDIT_PRO.session[index];
    const newCount = prompt(`Ajustar cantidad para: ${item.name}`, item.counted);
    
    if (newCount !== null) {
        item.counted = parseInt(newCount) || 0;
        item.status = (item.counted === item.expected) ? 'MATCH' : 'DIFF';
        renderAuditList();
        if (navigator.vibrate) navigator.vibrate(60);
    }
}

/**
 * 5. CONTROLADORES DE EVENTOS Y UI
 */
function setupAuditListeners() {
    const fab = document.getElementById('fab-audit-trigger');
    if (!fab) return;
    
    // Toggle Auditoría
    fab.addEventListener('click', () => {
        if (window.AUDIT_PRO.state === 'IDLE') {
            startAuditScanning();
        } else {
            stopAuditScanning();
        }
    });

    // Soporte para Long Press (Activa modo continuo)
    let longPressTimer;
    fab.addEventListener('touchstart', (e) => {
        longPressTimer = setTimeout(() => {
            window.AUDIT_PRO.continuousMode = true;
            if (navigator.vibrate) navigator.vibrate([100, 30, 100]);
            fab.style.boxShadow = '0 0 20px #10b981';
            showToast('🔄 Modo continuo activado', 'info');
        }, 800);
    });

    fab.addEventListener('touchend', () => clearTimeout(longPressTimer));
    fab.addEventListener('mousedown', () => {
        longPressTimer = setTimeout(() => {
            window.AUDIT_PRO.continuousMode = true;
            if (navigator.vibrate) navigator.vibrate([100, 30, 100]);
            fab.style.boxShadow = '0 0 20px #10b981';
            showToast('🔄 Modo continuo activado', 'info');
        }, 800);
    });
    fab.addEventListener('mouseup', () => clearTimeout(longPressTimer));
}

async function startAuditScanning() {
    updateAuditStateUI('⏳ CÁMARA...', '#3b82f6');
    
    try {
        // V6.2: El servicio ahora crea el video si no existe en el contenedor
        const ready = await window.ScannerService.requestCamera('#audit-scanner-view');
        
        if (ready) {
            window.AUDIT_PRO.state = 'SCANNING';
            const fab = document.getElementById('fab-audit-trigger');
            if (fab) fab.classList.add('active');
            
            // Iniciar feed
            await window.ScannerService.scan(handleAuditScan);
            updateAuditStateUI('🟢 ESCANEANDO...', '#10b981');
        }
    } catch (error) {
        updateAuditStateUI('❌ ERROR CÁMARA', '#ef4444');
        console.error("Fallo al iniciar auditoría:", error);
    }
}

function stopAuditScanning() {
    window.AUDIT_PRO.state = 'IDLE';
    const fab = document.getElementById('fab-audit-trigger');
    if (fab) {
        fab.classList.remove('active');
        fab.style.boxShadow = '';
    }
    window.AUDIT_PRO.continuousMode = false;
    updateAuditStateUI('⚪ LISTO', '#ffffff');
    
    if (window.ScannerService) {
        window.ScannerService.stopDataFlow();
    }
}

function updateAuditStateUI(text, color) {
    const el = document.getElementById('audit-state-indicator');
    if (el) {
        el.textContent = text;
        el.style.color = color;
    }
}

function injectAuditStyles() {
    if (document.getElementById('audit-pro-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'audit-pro-styles';
    style.innerHTML = `
        .audit-pro-container {
            background: #000;
            height: 85vh;
            display: flex;
            flex-direction: column;
            color: #fff;
            font-family: 'Inter', sans-serif;
            position: relative;
        }
        .audit-camera-zone {
            height: 40%;
            position: relative;
            background: #111;
            overflow: hidden;
            border-bottom: 2px solid #333;
        }
        #audit-scanner-view {
            width: 100%; height: 100%;
            background: #000;
        }
        .telescopic-sight {
            position: absolute;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            width: 220px; height: 100px;
            pointer-events: none;
            z-index: 10;
        }
        .sight-corner {
            position: absolute; width: 20px; height: 20px;
            border: 3px solid #10b981;
        }
        .top-left { top: 0; left: 0; border-right: 0; border-bottom: 0; }
        .top-right { top: 0; right: 0; border-left: 0; border-bottom: 0; }
        .bottom-left { bottom: 0; left: 0; border-right: 0; border-top: 0; }
        .bottom-right { bottom: 0; right: 0; border-left: 0; border-top: 0; }
        
        .audit-status-bar {
            position: absolute; bottom: 0; width: 100%;
            background: rgba(0,0,0,0.7); padding: 8px 15px;
            display: flex; justify-content: space-between;
            font-size: 12px; font-weight: 600;
        }
        
        .audit-list-zone { 
            flex: 1; overflow-y: auto; padding: 15px; 
            background: #000;
        }
        .audit-scroll-area { display: flex; flex-direction: column; gap: 10px; }
        
        .audit-empty-state {
            text-align: center; padding: 40px 20px; color: #666;
        }

        .audit-card {
            display: flex; justify-content: space-between;
            padding: 12px 15px; border-radius: 12px; 
            border-left: 5px solid #ccc; background: #111;
            animation: slideIn 0.3s ease-out;
        }
        @keyframes slideIn { from { transform: translateX(-10px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        
        .audit-card.match { border-left-color: #10b981; background: #064e3b22; }
        .audit-card.diff { border-left-color: #f59e0b; background: #451a0322; }
        .audit-card.not_found { border-left-color: #ef4444; background: #450a0a22; }
        
        .card-time { font-size: 9px; color: #888; text-transform: uppercase; }
        .card-title { margin: 2px 0; font-size: 14px; font-weight: 600; color: #fff; }
        .card-subtitle { font-size: 11px; color: #aaa; margin: 0; }
        
        .card-values { display: flex; gap: 12px; align-items: center; }
        .val-box { text-align: center; min-width: 45px; }
        .val-box small { display: block; font-size: 8px; color: #888; font-weight: 700; }
        .val-box span { font-size: 18px; font-weight: 800; }
        .highlight span { color: #10b981; }

        .fab-main {
            position: absolute; bottom: 20px; right: 20px;
            width: 60px; height: 60px; border-radius: 50%;
            background: #2563eb; color: #fff; border: none;
            box-shadow: 0 4px 20px rgba(0,0,0,0.6);
            cursor: pointer; transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            display: flex; align-items: center; justify-content: center;
            z-index: 100;
        }
        .fab-main .material-icons-round { font-size: 30px; }
        .fab-main.active { background: #ef4444; transform: rotate(45deg) scale(1.1); }
    `;
    document.head.appendChild(style);
}

// Inicializar al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
    // Solo inicializar si estamos en la pestaña de auditoría o al cargar la app
    setTimeout(initAuditProUI, 1000);
});

window.initAuditProUI = initAuditProUI;
