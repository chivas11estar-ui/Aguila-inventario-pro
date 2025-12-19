// ============================================================
// Águila Inventario Pro - ML Kit Barcode Scanner
// Copyright © 2025 José A. G. Betancourt
// Escáner profesional con ML Kit Vision
// ============================================================

let scannerStream = null;
let scannerActive = false;
let scannerCallback = null;
let barcodeDetector = null;
let animationFrameId = null;
let lastDetectedCode = null;
let detectionCount = 0;

console.log('📷 ML Kit Scanner iniciando...');

// ============================================================
// INICIALIZAR BARCODE DETECTOR (ML KIT)
// ============================================================
async function initBarcodeDetector() {
  console.log('🔍 Inicializando ML Kit Barcode Detector...');
  
  // Verificar soporte
  if (!('BarcodeDetector' in window)) {
    console.warn('⚠️ ML Kit BarcodeDetector no disponible');
    return null;
  }
  
  try {
    // Crear detector con formatos soportados
    barcodeDetector = new BarcodeDetector({
      formats: [
        'ean_13',      // EAN-13 (más común)
        'ean_8',       // EAN-8
        'upc_a',       // UPC-A
        'upc_e',       // UPC-E
        'code_128',    // Code 128
        'code_39',     // Code 39
        'code_93',     // Code 93
        'codabar',     // Codabar
        'itf',         // ITF
        'qr_code',     // QR Code
        'data_matrix'  // Data Matrix
      ]
    });
    
    console.log('✅ ML Kit Detector inicializado');
    return barcodeDetector;
    
  } catch (error) {
    console.error('❌ Error inicializando detector:', error);
    return null;
  }
}

// ============================================================
// ABRIR ESCÁNER
// ============================================================
async function openScanner(callback) {
  console.log('📷 Abriendo escáner ML Kit...');
  
  if (!callback || typeof callback !== 'function') {
    console.error('❌ Callback no válido');
    return;
  }
  
  scannerCallback = callback;
  lastDetectedCode = null;
  detectionCount = 0;
  
  // Inicializar detector si no existe
  if (!barcodeDetector) {
    barcodeDetector = await initBarcodeDetector();
    
    if (!barcodeDetector) {
      alert('❌ Tu navegador no soporta ML Kit.\nUsa Chrome, Edge o Samsung Internet.');
      return;
    }
  }
  
  // Mostrar modal
  const modal = document.getElementById('scanner-modal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('active');
    console.log('✅ Modal abierto');
  }
  
  // Solicitar cámara
  try {
    console.log('📷 Solicitando acceso a cámara...');
    
    scannerStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' }, // Cámara trasera
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        focusMode: { ideal: 'continuous' }
      },
      audio: false
    });
    
    console.log('✅ Cámara accedida');
    
    const video = document.getElementById('scanner-video');
    if (video) {
      video.srcObject = scannerStream;
      
      // Esperar a que metadata esté lista
      video.onloadedmetadata = () => {
        console.log('✅ Metadata cargado');
        video.play().then(() => {
          console.log('✅ Video en reproducción');
          scannerActive = true;
          startScanning(video);
        }).catch(err => {
          console.error('❌ Error reproduciendo:', err);
        });
      };
    }
    
  } catch (error) {
    console.error('❌ Error accediendo cámara:', error);
    
    if (error.name === 'NotAllowedError') {
      alert('❌ Permiso de cámara denegado.\nActiva los permisos en tu dispositivo.');
    } else if (error.name === 'NotFoundError') {
      alert('❌ No hay cámara disponible.');
    } else {
      alert('❌ Error: ' + error.message);
    }
    
    closeScanner();
  }
}

// ============================================================
// ESCANEAR CONTINUAMENTE
// ============================================================
async function startScanning(video) {
  if (!scannerActive || !barcodeDetector) {
    console.log('🛑 Escaneo detenido');
    return;
  }
  
  try {
    // Detectar códigos en el frame actual
    const barcodes = await barcodeDetector.detect(video);
    
    if (barcodes && barcodes.length > 0) {
      const barcode = barcodes[0];
      const code = barcode.rawValue || barcode.value;
      
      // Validar código
      if (code && code.length >= 8) {
        
        // Confirmar 2 lecturas del mismo código
        if (lastDetectedCode === code) {
          detectionCount++;
          
          if (detectionCount >= 2) {
            console.log('✅✅ CÓDIGO CONFIRMADO:', code);
            console.log('📋 Formato:', barcode.format);
            
            // Vibración feedback
            if (navigator.vibrate) {
              navigator.vibrate([100, 50, 100]);
            }
            
            // Sonido (opcional)
            playBeep();
            
            // Ejecutar callback
            if (scannerCallback) {
              scannerCallback(code);
            }
            
            // Cerrar escáner
            closeScanner();
            return;
          }
        } else {
          // Nuevo código detectado
          lastDetectedCode = code;
          detectionCount = 1;
          console.log('🔍 Detectado:', code, '(confirmando...)');
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error detectando:', error);
  }
  
  // Continuar escaneo (30 FPS)
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
  } catch (e) {
    // Silenciosos si no funciona
  }
}

// ============================================================
// CERRAR ESCÁNER
// ============================================================
function closeScanner() {
  console.log('🔴 Cerrando escáner...');
  
  scannerActive = false;
  
  // Cancelar animación
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  
  // Detener stream de video
  if (scannerStream) {
    scannerStream.getTracks().forEach(track => {
      track.stop();
      console.log('✅ Track detenido');
    });
    scannerStream = null;
  }
  
  // Limpiar video
  const video = document.getElementById('scanner-video');
  if (video) {
    video.srcObject = null;
  }
  
  // Ocultar modal
  const modal = document.getElementById('scanner-modal');
  if (modal) {
    modal.classList.remove('active');
    modal.classList.add('hidden');
  }
  
  scannerCallback = null;
  lastDetectedCode = null;
  detectionCount = 0;
  
  console.log('✅ Escáner cerrado');
}

// ============================================================
// CONFIGURAR BOTÓN CERRAR
// ============================================================
function setupScannerCloseButton() {
  const closeBtn = document.getElementById('close-scanner');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      closeScanner();
    });
    console.log('✅ Botón cerrar configurado');
  }
}

// ============================================================
// INICIALIZACIÓN
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('📷 Inicializando módulo scanner ML Kit...');
  
  setupScannerCloseButton();
  
  // Pre-inicializar detector
  setTimeout(() => {
    initBarcodeDetector();
  }, 1500);
  
  console.log('✅ Scanner ML Kit listo');
});

// ============================================================
// EXPONER GLOBALMENTE
// ============================================================
window.openScanner = openScanner;
window.closeScanner = closeScanner;
window.initBarcodeDetector = initBarcodeDetector;

console.log('✅ scanner-mlkit.js cargado correctamente');