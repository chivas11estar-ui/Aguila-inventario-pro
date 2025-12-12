// scanner-mlkit-v2.js
// ============================================================
// Águila Inventario Pro - ML Kit Scanner (V2 - SOLO ESCANEA)
// - Detecta y devuelve el código al callback proporcionado.
// - No toma decisiones, no abre modales, no crea productos.
// ============================================================

(function(){
  'use strict';

  let scannerStream = null;
  let scannerActive = false;
  let scannerCallback = null;
  let barcodeDetector = null;
  let animationFrameId = null;
  let lastDetectedCode = null;
  let detectionCount = 0;

  function log(...args){ if (console && console.log) console.log('[scanner-v2]', ...args); }

  async function initBarcodeDetector() {
    if (!('BarcodeDetector' in window)) {
      log('BarcodeDetector no disponible en este navegador');
      return null;
    }
    try {
      barcodeDetector = new BarcodeDetector({
        formats: [
          'ean_13','ean_8','upc_a','upc_e',
          'code_128','code_39','code_93','codabar',
          'itf','qr_code','data_matrix'
        ]
      });
      log('Detector inicializado');
      return barcodeDetector;
    } catch (err) {
      console.error('Error initBarcodeDetector', err);
      return null;
    }
  }

  async function openScanner(callback) {
    if (!callback || typeof callback !== 'function') {
      console.error('openScanner: callback inválido');
      return;
    }
    scannerCallback = callback;
    lastDetectedCode = null;
    detectionCount = 0;

    if (!barcodeDetector) {
      barcodeDetector = await initBarcodeDetector();
      if (!barcodeDetector) {
        alert('Tu navegador no soporta BarcodeDetector. Usa Chrome/Edge/Samsung Internet.');
        return;
      }
    }

    // Mostrar modal si existe (UI); el modal es opcional, el scanner funciona sin él.
    const modal = document.getElementById('scanner-modal');
    if (modal) { modal.classList.remove('hidden'); modal.classList.add('active'); }

    try {
      scannerStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });

      const video = document.getElementById('scanner-video');
      if (video) {
        video.srcObject = scannerStream;
        video.onloadedmetadata = () => {
          video.play().then(()=> {
            scannerActive = true;
            startScanning(video);
            log('Cámara en reproducción - escaneo iniciado');
          }).catch(err => console.error('video.play error', err));
        };
      }
    } catch (err) {
      console.error('openScanner getUserMedia error', err);
      closeScanner();
      if (err.name === 'NotAllowedError') alert('Permiso de cámara denegado. Activa permisos.');
      else if (err.name === 'NotFoundError') alert('No se detectó cámara.');
      else alert('Error accediendo cámara: ' + (err.message || err));
    }
  }

  async function startScanning(video) {
    if (!scannerActive || !barcodeDetector) return;
    try {
      const barcodes = await barcodeDetector.detect(video);
      if (barcodes && barcodes.length > 0) {
        const code = barcodes[0].rawValue || barcodes[0].value;
        if (code) {
          // confirmar 2 lecturas iguales para evitar falsos positivos
          if (lastDetectedCode === code) {
            detectionCount++;
            if (detectionCount >= 2) {
              // feedback
              if (navigator.vibrate) navigator.vibrate([100,50,100]);
              try { playBeep(); } catch(e){}
              // entregar resultado
              try { scannerCallback(code); } catch(e){ console.error('scanner callback error', e); }
              // cerrar
              closeScanner();
              return;
            }
          } else {
            lastDetectedCode = code;
            detectionCount = 1;
          }
        }
      }
    } catch (err) {
      console.error('startScanning detect error', err);
    }
    animationFrameId = requestAnimationFrame(()=> startScanning(video));
  }

  function playBeep() {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.connect(g); g.connect(ac.destination);
      osc.frequency.value = 900; osc.type = 'sine';
      g.gain.setValueAtTime(0.25, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.12);
      osc.start(ac.currentTime); osc.stop(ac.currentTime + 0.12);
    } catch(e){}
  }

  function closeScanner() {
    scannerActive = false;
    if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
    if (scannerStream) {
      scannerStream.getTracks().forEach(t => { try { t.stop(); } catch(e){} });
      scannerStream = null;
    }
    const video = document.getElementById('scanner-video');
    if (video) video.srcObject = null;
    const modal = document.getElementById('scanner-modal');
    if (modal) { modal.classList.remove('active'); modal.classList.add('hidden'); }
    scannerCallback = null;
    lastDetectedCode = null;
    detectionCount = 0;
    log('Escáner cerrado');
  }

  // close button if exists
  document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById('close-scanner');
    if (closeBtn) closeBtn.addEventListener('click', (e) => { e.preventDefault(); closeScanner(); });
    // preload detector
    setTimeout(()=> initBarcodeDetector(), 1000);
  });

  // expose
  window.openScanner = openScanner;
  window.closeScanner = closeScanner;
  window.initBarcodeDetector = initBarcodeDetector;

  log('scanner-mlkit-v2 cargado');
})();