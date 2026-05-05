// ============================================================
// Águila Inventario Pro - ML Kit Barcode Scanner
// Copyright © 2025 José A. G. Betancourt
// Escáner profesional con ML Kit Vision (Modo Continuo Habilitado)
// ============================================================

let scannerStream = null;
let scannerActive = false;
let scanOptions = { onScan: null, continuous: false };
let barcodeDetector = null;
let animationFrameId = null;
let lastDetectedCode = null;
let detectionCount = 0;

console.log('📷 ML Kit Scanner (v2-continuo) iniciando...');

// ============================================================
// INICIALIZAR BARCODE DETECTOR (ML KIT)
// ============================================================
async function initBarcodeDetector() {
  if (barcodeDetector) return barcodeDetector;
  console.log('🔍 Inicializando ML Kit Barcode Detector...');
  if (!('BarcodeDetector' in window)) {
    console.info('ℹ️ ML Kit BarcodeDetector no disponible nativamente (Usando fallback si es necesario)');
    return null;
  }
  try {
    barcodeDetector = new BarcodeDetector({
      formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code', 'data_matrix']
    });
    console.log('✅ ML Kit Detector inicializado');
    return barcodeDetector;
  } catch (error) {
    console.error('❌ Error inicializando detector:', error);
    return null;
  }
}

// ============================================================
// ABRIR ESCÁNER (Refactorizado para Opciones)
// ============================================================
async function openScanner(options) {
  console.log('📷 Abriendo escáner ML Kit con opciones:', options);

  const { onScan, continuous = false } = options;

  if (!onScan || typeof onScan !== 'function') {
    console.error('❌ onScan callback no es una función válida');
    return;
  }

  scanOptions = { onScan, continuous };
  lastDetectedCode = null;
  detectionCount = 0;

  if (!barcodeDetector) {
    barcodeDetector = await initBarcodeDetector();
    if (!barcodeDetector) {
      alert('❌ Tu navegador no soporta el escáner avanzado.\nUsa Chrome, Edge o Samsung Internet.');
      return;
    }
  }

  const modal = document.getElementById('scanner-modal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('active');
  }

  try {
    scannerStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        focusMode: { ideal: 'continuous' }
      },
      audio: false
    });

    const video = document.getElementById('scanner-video');
    if (video) {
      video.srcObject = scannerStream;
      video.onloadedmetadata = () => {
        video.play().then(() => {
          scannerActive = true;
          startScanning(video);
        }).catch(err => console.error('❌ Error reproduciendo video:', err));
      };
    }
  } catch (error) {
    console.error('❌ Error accediendo cámara:', error);
    if (error.name === 'NotAllowedError') {
      alert('❌ Permiso de cámara denegado. Actívalo en los ajustes de tu navegador.');
    } else {
      alert('❌ Error de cámara: ' + error.message);
    }
    closeScanner();
  }
}

// ============================================================
// ESCANEAR CONTINUAMENTE (Refactorizado para Modo Continuo)
// ============================================================
async function startScanning(video) {
  if (!scannerActive || !barcodeDetector) {
    return;
  }

  try {
    const barcodes = await barcodeDetector.detect(video);

    if (barcodes && barcodes.length > 0) {
      const code = barcodes[0].rawValue;

      if (code && code.length >= 8) {
        if (lastDetectedCode === code) {
          detectionCount++;

          if (detectionCount >= 2) { // Confirmación de 2 lecturas
            console.log('✅✅ CÓDIGO CONFIRMADO:', code);

            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
            playBeep();

            if (scanOptions.onScan) {
              scanOptions.onScan(code);
            }

            if (scanOptions.continuous) {
              // --- MODO CONTINUO ---
              console.log('🔄 Modo continuo: reiniciando para siguiente escaneo');
              lastDetectedCode = null; // Permite escanear el mismo código de nuevo
              detectionCount = 0;
              // Feedback visual
              const overlay = document.querySelector('.scanner-overlay');
              if (overlay) {
                overlay.classList.add('flash-success');
                setTimeout(() => overlay.classList.remove('flash-success'), 300);
              }
            } else {
              // --- MODO ÚNICO ---
              closeScanner();
              return; // Detener el bucle
            }
          }
        } else {
          lastDetectedCode = code;
          detectionCount = 1;
        }
      }
    }
  } catch (error) {
    // Ignorar errores menores de detección que ocurren a veces
  }

  animationFrameId = requestAnimationFrame(() => startScanning(video));
}

// ============================================================
// SONIDO DE BEEP
// ============================================================
function playBeep() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gain.gain.setValueAtTime(0.3, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  } catch (e) { /* Silencio si falla */ }
}

// ============================================================
// CERRAR ESCÁNER
// ============================================================
function closeScanner() {
  console.log('🔴 Cerrando escáner...');
  scannerActive = false;

  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  if (scannerStream) {
    scannerStream.getTracks().forEach(track => track.stop());
    scannerStream = null;
  }

  const video = document.getElementById('scanner-video');
  if (video) video.srcObject = null;

  const modal = document.getElementById('scanner-modal');
  if (modal) {
    modal.classList.remove('active');
    modal.classList.add('hidden');
  }

  scanOptions = { onScan: null, continuous: false };
  lastDetectedCode = null;
  detectionCount = 0;
  console.log('✅ Escáner cerrado');
}

// ============================================================
// INICIALIZACIÓN Y ESTILOS
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('📷 Inicializando módulo scanner ML Kit (v2-continuo)...');

  const closeBtn = document.getElementById('close-scanner');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      closeScanner();
    });
  }

  // Añadir estilos para el feedback visual
  const style = document.createElement('style');
  style.innerHTML = `
    .scanner-overlay.flash-success {
      animation: flash-animation 0.3s ease-out;
    }
    @keyframes flash-animation {
      0% { background-color: rgba(74, 222, 128, 0); }
      50% { background-color: rgba(74, 222, 128, 0.4); }
      100% { background-color: rgba(74, 222, 128, 0); }
    }
  `;
  document.head.appendChild(style);

  // Pre-inicializar detector
  setTimeout(initBarcodeDetector, 1500);

  console.log('✅ Scanner ML Kit (v2-continuo) listo');
});

// ============================================================
// EXPONER GLOBALMENTE
// ============================================================
window.openScanner = openScanner;
window.closeScanner = closeScanner;

console.log('✅ scanner-mlkit.js (v2-continuo) cargado correctamente');