// ============================================================
// Águila Inventario Pro - Módulo: audit.js (v2 - Quick Audit)
// Copyright © 2025 José A. G. Betancourt
// ============================================================

// --- STATE MANAGEMENT ---
let currentAuditWarehouse = null;
let currentAuditProduct = null;
let isQuickAuditMode = false;
let quickAuditItems = [];
let userDeterminanteAudit = null;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('✓ Inicializando módulo de Auditoría (v2)...');
    // Normal Mode Listeners
    document.getElementById('save-warehouse-btn').onclick = saveBodega;
    document.getElementById('audit-barcode').onkeypress = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); buscarProductoAudit(); }
    };
    document.getElementById('audit-form').onsubmit = (e) => {
        e.preventDefault();
        registrarConteo();
    };
    // Add event listener for the "Terminar Auditoría" button
    document.getElementById('finish-audit-btn').onclick = finishNormalAudit;
    // Quick Audit Mode Listeners
    document.getElementById('btn-quick-audit-mode').onclick = toggleQuickAuditMode;
    document.getElementById('btn-save-quick-audit').onclick = saveQuickAudit;
    document.getElementById('btn-cancel-quick-audit').onclick = endQuickAudit;

    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            const userId = user.uid;
            const snapshot = await firebase.database().ref(`usuarios/${userId}`).once('value');
            userDeterminanteAudit = snapshot.val()?.determinante;
            console.log('✓ Determinante de auditoría cargado:', userDeterminanteAudit);
        }
    });
});

// ============================================================
// QUICK AUDIT MODE FUNCTIONS
// ============================================================

function toggleQuickAuditMode() {
    isQuickAuditMode = !isQuickAuditMode;
    if (isQuickAuditMode) {
        if (!currentAuditWarehouse) {
            showToast('⚠️ Primero selecciona una bodega para la auditoría rápida.', 'warning');
            document.getElementById('audit-warehouse').focus();
            isQuickAuditMode = false; // Revert
            return;
        }
        startQuickAudit();
    } else {
        endQuickAudit();
    }
}

function startQuickAudit() {
    console.log('⚡ Iniciando Modo de Auditoría Rápida');
    quickAuditItems = [];
    document.getElementById('audit-normal-form').classList.add('hidden');
    document.getElementById('audit-quick-scan-container').classList.remove('hidden');
    document.getElementById('btn-quick-audit-mode').textContent = '⏹️ Terminar Auditoría Rápida';
    document.getElementById('btn-quick-audit-mode').classList.replace('secondary', 'warning');

    window.openScanner({
        onScan: handleQuickAuditScan,
        continuous: true
    });
}

async function handleQuickAuditScan(barcode) {
    console.log('⚡ Escaneo rápido:', barcode);
    const existingItem = quickAuditItems.find(item => item.codigoBarras === barcode);

    if (existingItem) {
        existingItem.quantity++;
        console.log(`⚡ ${existingItem.nombre} | Cantidad: ${existingItem.quantity}`);
    } else {
        const productData = await fetchProductDataByBarcode(barcode);
        if (productData) {
            quickAuditItems.push({
                ...productData,
                quantity: 1
            });
            console.log(`⚡ Nuevo: ${productData.nombre} | Cantidad: 1`);
        } else {
            showToast(`❌ Código ${barcode} no encontrado en el sistema.`, 'error');
            return; // No añadir si no existe
        }
    }
    // Simple feedback without full render
    showToast(`+1 ${existingItem?.nombre || 'Nuevo producto'}`, 'info', 1000);
    renderQuickAuditList(); // Re-render for real-time update
}

// V2: Lectura directa por key desde productos/{det}/{codigoBarras}
async function fetchProductDataByBarcode(barcode) {
    if (!userDeterminanteAudit) return null;
    const safeCode = (typeof sanitizeBarcode === 'function') ? sanitizeBarcode(barcode) : barcode.trim();
    if (!safeCode) return null;

    const snap = await firebase.database()
        .ref(`productos/${userDeterminanteAudit}/${safeCode}`)
        .once('value');

    if (snap.exists()) {
        const product = snap.val();
        return {
            id: safeCode, // En V2, el código de barras ES el id
            nombre: product.nombre,
            marca: product.marca,
            codigoBarras: product.codigoBarras || barcode.trim(),
            stockTotal: parseInt(product.stockTotal) || 0
        };
    }
    return null;
}

function renderQuickAuditList() {
    const listContainer = document.getElementById('quick-audit-list');
    if (quickAuditItems.length === 0) {
        listContainer.innerHTML = '<p style="text-align:center; color: #9ca3af;">Escanea productos para comenzar...</p>';
        return;
    }

    listContainer.innerHTML = quickAuditItems.map((item, index) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid #f3f4f6;">
            <div>
                <strong style="color: #1f2937;">${item.nombre}</strong>
                <small style="color: #6b7280; display: block;">${item.codigoBarras}</small>
            </div>
            <div style="display: flex; align-items: center; gap: 15px;">
                <button onclick="updateQuickAuditItemQuantity(${index}, -1)" class="btn-icon" style="font-size: 20px; color: #ef4444;">-</button>
                <span style="font-size: 1.2em; font-weight: bold; min-width: 30px; text-align: center;">${item.quantity}</span>
                <button onclick="updateQuickAuditItemQuantity(${index}, 1)" class="btn-icon" style="font-size: 20px; color: #22c55e;">+</button>
            </div>
        </div>
    `).join('');
}

function updateQuickAuditItemQuantity(index, change) {
    const item = quickAuditItems[index];
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            // Eliminar si la cantidad es 0 o menos
            quickAuditItems.splice(index, 1);
        }
        renderQuickAuditList();
    }
}

async function saveQuickAudit() {
    if (quickAuditItems.length === 0) {
        showToast('⚠️ No hay productos en la lista para guardar.', 'warning');
        return;
    }

    showToast('💾 Guardando conteo rápido... por favor espera.', 'info');
    const updates = {};
    const auditLog = [];

    // V2: Lectura directa por key, un solo nodo por producto
    for (const item of quickAuditItems) {
        const safeCode = (typeof sanitizeBarcode === 'function') ? sanitizeBarcode(item.codigoBarras) : item.codigoBarras.trim();
        const snap = await firebase.database()
            .ref(`productos/${userDeterminanteAudit}/${safeCode}`)
            .once('value');

        if (snap.exists()) {
            const product = snap.val();
            const systemStock = parseInt(product.stockTotal) || 0;
            const diferencia = item.quantity - systemStock;

            if (diferencia !== 0) {
                // V2: Actualizar stockTotal directamente en el nodo único
                updates[`productos/${userDeterminanteAudit}/${safeCode}/stockTotal`] = item.quantity;
                updates[`productos/${userDeterminanteAudit}/${safeCode}/ultimaAuditoria`] = getLocalISOString();

                auditLog.push({
                    producto: item.nombre,
                    bodega: currentAuditWarehouse,
                    esperado: systemStock,
                    contado: item.quantity,
                    diferencia: diferencia,
                    fecha: getLocalISOString(),
                    usuario: firebase.auth().currentUser.email,
                    modo: 'rapido'
                });
            }
        }
    }

    try {
        await firebase.database().ref().update(updates);
        for (const log of auditLog) {
            await firebase.database().ref(`auditorias/${userDeterminanteAudit}`).push(log);
        }
        showToast('✅ Auditoría Rápida guardada con éxito!', 'success');
        endQuickAudit();
        location.reload(); // Recargar para ver cambios
    } catch (error) {
        console.error("Error al guardar auditoría rápida:", error);
        showToast('❌ Error guardando los datos.', 'error');
    }
}

function endQuickAudit() {
    if (window.scannerActive) {
        window.closeScanner();
    }
    console.log('⏹️ Terminando Modo de Auditoría Rápida');
    isQuickAuditMode = false;
    quickAuditItems = [];
    document.getElementById('audit-normal-form').classList.remove('hidden');
    document.getElementById('audit-quick-scan-container').classList.add('hidden');
    document.getElementById('btn-quick-audit-mode').textContent = '⚡ Activar Modo de Auditoría Rápida';
    document.getElementById('btn-quick-audit-mode').classList.replace('warning', 'secondary');
    renderQuickAuditList(); // Clear the list display
}


// ============================================================
// NORMAL AUDIT MODE FUNCTIONS (Legacy)
// ============================================================

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
    display.innerHTML = `📍 Auditando: <strong>${currentAuditWarehouse}</strong>`;
    display.style.cssText = "background:#e0f2fe; color:#0369a1; padding:15px; border-radius:10px; border-left:5px solid #0ea5e9; margin-bottom:15px; font-size:14px;";
    input.disabled = true;
    document.getElementById('save-warehouse-btn').style.display = 'none';
    document.getElementById('finish-audit-btn').style.display = 'block'; // Make finish audit button visible
    showToast('Bodega fijada. ¡Buen trabajo!', 'success');
    setTimeout(() => document.getElementById('audit-barcode').focus(), 300);
}

// V2: Búsqueda directa por key en productos/{det}/{codigoBarras}
async function buscarProductoAudit() {
    const barcode = document.getElementById('audit-barcode').value.trim();
    if (!currentAuditWarehouse) {
        showToast('⚠️ Selecciona primero la bodega', 'warning');
        return;
    }
    if (barcode.length < 3) return;

    try {
        const safeCode = (typeof sanitizeBarcode === 'function') ? sanitizeBarcode(barcode) : barcode;
        const snap = await firebase.database()
            .ref(`productos/${userDeterminanteAudit}/${safeCode}`)
            .once('value');

        if (snap.exists()) {
            const data = snap.val();
            currentAuditProduct = {
                id: safeCode,
                codigoBarras: barcode,
                ...data,
                // V2: usar stockTotal como campo principal
                cajas: parseInt(data.stockTotal) || 0
            };

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
        const diferencia = cajasContadas - currentAuditProduct.cajas;
        // V2: Actualizar stockTotal en productos/{det}/{codigoBarras}
        await firebase.database().ref(`productos/${userDeterminanteAudit}/${currentAuditProduct.id}`).update({
            stockTotal: cajasContadas,
            ultimaAuditoria: getLocalISOString(),
            fechaActualizacion: getLocalISOString(),
            actualizadoPor: firebase.auth().currentUser.email
        });
        await firebase.database().ref(`auditorias/${userDeterminanteAudit}`).push({
            producto: currentAuditProduct.nombre,
            bodega: currentAuditWarehouse,
            esperado: currentAuditProduct.cajas,
            contado: cajasContadas,
            diferencia: diferencia,
            fecha: getLocalISOString(),
            usuario: firebase.auth().currentUser.email,
            modo: 'normal'
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

// ============================================================
// NEW: Finish Normal Audit
// ============================================================
function finishNormalAudit() {
    console.log('🏁 Terminando Auditoría Normal');
    currentAuditWarehouse = null;
    currentAuditProduct = null;

    const warehouseInput = document.getElementById('audit-warehouse');
    const saveWarehouseBtn = document.getElementById('save-warehouse-btn');
    const warehouseDisplay = document.getElementById('current-warehouse-display');
    const finishAuditBtn = document.getElementById('finish-audit-btn');

    warehouseInput.value = '';
    warehouseInput.disabled = false;
    saveWarehouseBtn.style.display = 'block';
    warehouseDisplay.innerHTML = 'Ninguna bodega seleccionada';
    warehouseDisplay.style.cssText = "padding:12px;background:var(--bg);border-radius:8px;color:var(--muted);text-align:center;margin-bottom:20px;";

    limpiarCamposAudit(true); // Clear product-related fields

    showToast('✅ Auditoría Normal finalizada. Puedes empezar una nueva.', 'success');
    finishAuditBtn.style.display = 'none'; // Hide the button after finishing
}

// Expose functions to be called from inline event handlers
window.updateQuickAuditItemQuantity = updateQuickAuditItemQuantity;
