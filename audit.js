// ============================================================
// Águila Inventario Pro - Módulo: audit.js (FINAL)
// ============================================================

let currentAuditWarehouse = null;
let currentAuditProduct = null;

// Configuración de eventos al cargar
document.addEventListener('DOMContentLoaded', () => {
    const btnSaveBodega = document.getElementById('save-warehouse-btn');
    if (btnSaveBodega) btnSaveBodega.onclick = saveBodega;

    const barcodeInput = document.getElementById('audit-barcode');
    if (barcodeInput) {
        barcodeInput.onkeypress = (e) => {
            if (e.key === 'Enter') { 
                e.preventDefault(); 
                buscarProductoAudit(); 
            }
        };
    }

    const auditForm = document.getElementById('audit-form');
    if (auditForm) {
        auditForm.onsubmit = (e) => {
            e.preventDefault();
            registrarConteo();
        };
    }
});

function saveBodega() {
    const input = document.getElementById('audit-warehouse');
    const display = document.getElementById('current-warehouse-display');
    const val = input.value.trim();

    if (!val) {
        showToast('⚠️ Por favor escribe el nombre de la bodega', 'warning');
        input.focus();
        return;
    }

    currentAuditWarehouse = val;
    
    // UI: Bloquear selección y mostrar estado activo
    display.innerHTML = `📍 Auditando: <strong>${currentAuditWarehouse}</strong>`;
    display.style.display = 'block';
    display.className = 'status-banner-active'; // Asegúrate de tener este CSS o usa inline
    display.style.cssText = "background:#e0f2fe; color:#0369a1; padding:15px; border-radius:10px; border-left:5px solid #0ea5e9; margin-bottom:15px; font-size:14px;";

    input.disabled = true;
    document.getElementById('save-warehouse-btn').style.display = 'none';
    document.getElementById('finish-audit-btn').style.display = 'block';
    
    showToast('Bodega fijada. ¡Buen trabajo!', 'success');
    
    // Foco automático al escáner con pequeño delay para asegurar renderizado
    setTimeout(() => {
        const bcInput = document.getElementById('audit-barcode');
        bcInput.focus();
        bcInput.scrollIntoView({ behavior: 'smooth' });
    }, 400);
}

async function buscarProductoAudit() {
    const barcode = document.getElementById('audit-barcode').value.trim();
    if (!currentAuditWarehouse) {
        showToast('⚠️ Selecciona primero la bodega', 'warning');
        return;
    }
    if (barcode.length < 3) return;

    try {
        const userId = firebase.auth().currentUser.uid;
        const userSnap = await firebase.database().ref(`usuarios/${userId}`).once('value');
        const det = userSnap.val()?.determinante;

        const snap = await firebase.database().ref(`inventario/${det}`)
            .orderByChild('codigoBarras').equalTo(barcode).once('value');

        if (snap.exists()) {
            const data = snap.val();
            const id = Object.keys(data)[0];
            currentAuditProduct = { id, ...data[id] };

            document.getElementById('audit-nombre').value = currentAuditProduct.nombre;
            const info = document.getElementById('audit-stock-info');
            info.style.display = 'block';
            info.innerHTML = `📊 Stock en sistema: <strong>${currentAuditProduct.cajas}</strong> cajas`;
            
            document.getElementById('audit-boxes').focus();
        } else {
            showToast('❌ Producto no encontrado en esta tienda', 'error');
            limpiarCamposAudit(false);
        }
    } catch (e) {
        console.error(e);
        showToast('Error de búsqueda', 'error');
    }
}

async function registrarConteo() {
    const cajasContadas = parseInt(document.getElementById('audit-boxes').value);
    
    if (isNaN(cajasContadas) || !currentAuditProduct) {
        showToast('⚠️ Datos incompletos', 'warning');
        return;
    }

    try {
        const userId = firebase.auth().currentUser.uid;
        const userSnap = await firebase.database().ref(`usuarios/${userId}`).once('value');
        const det = userSnap.val()?.determinante;
        const diferencia = cajasContadas - currentAuditProduct.cajas;

        // 1. Actualizar Inventario
        await firebase.database().ref(`inventario/${det}/${currentAuditProduct.id}`).update({
            cajas: cajasContadas,
            ultimaAuditoria: new Date().toISOString()
        });

        // 2. Guardar Histórico
        await firebase.database().ref(`auditorias/${det}`).push({
            producto: currentAuditProduct.nombre,
            bodega: currentAuditWarehouse,
            esperado: currentAuditProduct.cajas,
            contado: cajasContadas,
            diferencia: diferencia,
            fecha: new Date().toISOString(),
            usuario: firebase.auth().currentUser.email
        });

        showToast(diferencia === 0 ? '✅ Inventario exacto' : `⚠️ Ajuste de ${diferencia} cajas`, 'success');
        limpiarCamposAudit(true);

    } catch (e) {
        showToast('Error al guardar datos', 'error');
    }
}

function limpiarCamposAudit(todo) {
    document.getElementById('audit-barcode').value = '';
    document.getElementById('audit-boxes').value = '';
    document.getElementById('audit-nombre').value = '';
    document.getElementById('audit-stock-info').style.display = 'none';
    document.getElementById('audit-barcode').focus();
}

function terminarAuditoria() {
    if(confirm('¿Deseas finalizar la sesión en esta bodega?')) {
        location.reload(); // Forma más limpia de resetear todo el estado
    }
}
