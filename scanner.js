// ============================================================
// Águila Inventario Pro - ML Kit Barcode Scanner
// Copyright © 2025 José A. G. Betancourt
// Todos los derechos reservados
// ============================================================

let scannerStream = null;
let scannerActive = false;
let scannerCallback = null;
let barcodeDetector = null;
let animationFrameId = null;

// ============================================================
// INICIALIZAR BARCODE DETECTOR (ML KIT)
// ============================================================
async function initBarcodeDetector() {
  console.log('🔍 Inicializando Barcode Detector...');
  
  // Verificar si el navegador soporta Barcode Detection API
  if (!('BarcodeDetector' in window)) {
    console.warn('⚠️ BarcodeDetector no disponible, usando fallback');
    return null;
  }
  
  try {
    // Crear detector con formatos soportados
    barcodeDetector = new BarcodeDetector({
      formats: [
        'ean_13',      // EAN-13 (más común en productos)
        'ean_8',       // EAN-8
        'upc_a',       // UPC-A
        'upc_e',       // UPC-E
        'code_128',    // Code 128
        'code_39',     // Code 39
        'code_93',     // Code 93
        'codabar',     // Codabar
        'itf',         // ITF (Interleaved 2 of 5)
        'qr_code',     // QR Code
        'data_matrix'  // Data Matrix
      ]
    });
    
    console.log('✅ Barcode Detector inicializado');
    return barcodeDetector;
    
  } catch (error) {
    console.error('❌ Error al inicializar Barcode Detector:', error);
    return null;
  }
}

// ============================================================
// ABRIR ESCÁNER
// ============================================================
async function openScanner(callback) {
  console.log('📷 Abriendo escáner...');
  
  if (!callback || typeof callback !== 'function') {
    console.error('❌ Callback no válido');
    return;
  }
  
  scannerCallback = callback;
  
  // Inicializar detector si no existe
  if (!barcodeDetector) {
    barcodeDetector = await initBarcodeDetector();
    
    if (!barcodeDetector) {
      alert('❌ Tu navegador no soporta el escáner de códigos. Usa Chrome o Edge.');
      return;
    }
  }
  
  // Mostrar modal
  const modal = document.getElementById('scanner-modal');
  if (modal) {
    modal.classList.remove('hidden');
  }
  
  // Solicitar acceso a cámara
  try {
    scannerStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment', // Cámara trasera
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });
    
    const video = document.getElementById('scanner-video');
    if (video) {
      video.srcObject = scannerStream;
      video.play();
      
      // Esperar a que el video esté listo
      video.onloadedmetadata = () => {
        console.log('✅ Cámara iniciada');
        scannerActive = true;
        startScanning(video);
      };
    }
    
  } catch (error) {
    console.error('❌ Error al acceder a la cámara:', error);
    alert('❌ No se pudo acceder a la cámara. Verifica los permisos.');
    closeScanner();
  }
}

// ============================================================
// ESCANEAR CONTINUAMENTE
// ============================================================
async function startScanning(video) {
  if (!scannerActive || !barcodeDetector) {
    console.log('🛑 Escáner detenido');
    return;
  }
  
  try {
    // Detectar códigos en el frame actual
    const barcodes = await barcodeDetector.detect(video);
    
    if (barcodes.length > 0) {
      const barcode = barcodes[0];
      const code = barcode.rawValue;
      
      console.log('✅ Código detectado:', code);
      console.log('📋 Formato:', barcode.format);
      
      // Llamar al callback con el código
      if (scannerCallback) {
        scannerCallback(code);
      }
      
      // Cerrar escáner
      closeScanner();
      
      // Vibrar (si está disponible)
      if (navigator.vibrate) {
        navigator.vibrate(200);
      }
      
      return;
    }
    
  } catch (error) {
    console.error('❌ Error al detectar código:', error);
  }
  
  // Continuar escaneando (60 FPS)
  animationFrameId = requestAnimationFrame(() => startScanning(video));
}

// ============================================================
// CERRAR ESCÁNER
// ============================================================
function closeScanner() {
  console.log('🔴 Cerrando escáner...');
  
  scannerActive = false;
  
  // Detener animación
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  
  // Detener stream de video
  if (scannerStream) {
    scannerStream.getTracks().forEach(track => track.stop());
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
    modal.classList.add('hidden');
  }
  
  scannerCallback = null;
  
  console.log('✅ Escáner cerrado');
}

// ============================================================
// CONFIGURAR BOTÓN CERRAR
// ============================================================
function setupScannerCloseButton() {
  const closeBtn = document.getElementById('close-scanner');
  if (closeBtn) {
    closeBtn.onclick = closeScanner;
    console.log('✅ Botón cerrar escáner configurado');
  }
}

// ============================================================
// INICIALIZACIÓN
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('📷 Inicializando módulo de escáner...');
  
  // Configurar botón cerrar
  setupScannerCloseButton();
  
  // Pre-inicializar detector
  setTimeout(() => {
    initBarcodeDetector();
  }, 2000);
  
  console.log('✅ Módulo de escáner listo');
});

// Exponer funciones globalmente
window.openScanner = openScanner;
window.closeScanner = closeScanner;

console.log('✅ scanner.js (ML Kit) cargado correctamente');