/**
 * Águila Inventario Pro - Módulo: audit-sync.js
 * Sincronización Atómica y Consistencia de Stock
 * Copyright © 2026 José A. G. Betancourt
 */

'use strict';

window.AUDIT_SYNC = {
    isSyncing: false,

    /**
     * 1. LÓGICA DE BATCH: Sincronización masiva con Firestore y RTDB
     */
    async syncAuditSession() {
        if (this.isSyncing || window.AUDIT_PRO.session.length === 0) return;

        const confirmSync = confirm(`¿Deseas cerrar la auditoría y sincronizar ${window.AUDIT_PRO.session.length} ítems?`);
        if (!confirmSync) return;

        this.isSyncing = true;
        this.toggleLoadingOverlay(true);

        const det = await window.getCachedDeterminante();
        if (!det) {
            showToast("❌ Error: No se encontró determinante", "error");
            this.isSyncing = false;
            this.toggleLoadingOverlay(false);
            return;
        }

        const batch = window.firestore.batch();
        const rtdbUpdates = {};
        const discrepancies = [];
        const sessionStartTime = window.AUDIT_PRO.sessionStartTime || new Date().toISOString();

        try {
            // Filtrar solo los productos que tuvieron cambios o discrepancias
            const itemsToSync = window.AUDIT_PRO.session.filter(item => item.status !== 'MATCH');

            if (itemsToSync.length === 0) {
                showToast("✅ Auditoría limpia (Sin discrepancias)", "success");
                this.executeSuccessFlow();
                return;
            }

            for (const item of itemsToSync) {
                // VALIDACIÓN CRÍTICA: Si el producto es desconocido, no intentamos 
                // actualizar el documento de producto para evitar errores de batch.
                if (item.code === 'DESCONOCIDO' || !item.code) {
                    console.warn(`⚠️ Saltando actualización de DB para producto desconocido: ${item.name}`);
                    discrepancies.push(item);
                    continue; 
                }

                const fsRef = window.firestore.doc(`stores/${det}/products/${item.code}`);
                const rtdbPath = `productos/${det}/${item.code}`;

                // A. Preparar actualización en Firestore (Metadata y Auditoría)
                batch.set(fsRef, {
                    inventory: {
                        current_stock: item.counted,
                        last_audit_at: firebase.firestore.FieldValue.serverTimestamp(),
                        last_audit_session: sessionStartTime
                    }
                }, { merge: true });

                // B. Preparar actualización en RTDB (Stock Real-Time)
                rtdbUpdates[`${rtdbPath}/stockTotal`] = item.counted;
                rtdbUpdates[`${rtdbPath}/ultimaAuditoria`] = Date.now();
                rtdbUpdates[`${rtdbPath}/auditadoPor`] = firebase.auth().currentUser.email;

                discrepancies.push(item);
            }

            // C. Ejecución de la transacción híbrida
            await Promise.all([
                batch.commit(),
                firebase.database().ref().update(rtdbUpdates)
            ]);

            // D. Generar Reporte de Historial
            await this.generateAuditReport(det, discrepancies);

            // E. Éxito y Limpieza
            this.executeSuccessFlow();

        } catch (error) {
            console.error("❌ Error Crítico en Sync:", error);
            showToast("❌ Error de red. Intenta de nuevo.", "error");
        } finally {
            this.isSyncing = false;
            this.toggleLoadingOverlay(false);
        }
    },

    /**
     * Crea un registro en la colección audit_history
     */
    async generateAuditReport(det, discrepancies) {
        try {
            const reportRef = window.firestore.collection(`stores/${det}/audit_history`).doc();
            await reportRef.set({
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                auditor_email: firebase.auth().currentUser.email,
                total_scanned: window.AUDIT_PRO.session.length,
                discrepancies_count: discrepancies.length,
                items: discrepancies.map(d => ({
                    barcode: d.code,
                    name: d.name,
                    expected: d.expected,
                    counted: d.counted,
                    diff: d.counted - d.expected
                }))
            });
            console.log("📊 Reporte de auditoría generado");
        } catch (e) {
            console.error("⚠️ No se pudo generar el reporte:", e);
        }
    },

    /**
     * Animación de Feedback y Reseteo
     */
    executeSuccessFlow() {
        const container = document.querySelector('.audit-pro-container');
        if (container) {
            container.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
            container.style.opacity = '0';
            container.style.transform = 'scale(0.95)';
        }

        setTimeout(() => {
            // Reset de memoria volátil
            window.AUDIT_PRO.session = [];
            window.AUDIT_PRO.lastCode = null;
            window.AUDIT_PRO.sessionStartTime = null;

            if (typeof window.renderAuditList === 'function') {
                window.renderAuditList();
            }

            showToast("📦 Auditoría Sincronizada", "success");

            if (container) {
                container.style.opacity = '1';
                container.style.transform = 'scale(1)';
            }

            // Volver a la pestaña de inventario para ver cambios
            if (typeof window.switchTab === 'function') {
                window.switchTab('inventory');
            }
        }, 500);
    },

    toggleLoadingOverlay(show) {
        let overlay = document.getElementById('audit-sync-overlay');
        
        if (!overlay && show) {
            overlay = document.createElement('div');
            overlay.id = 'audit-sync-overlay';
            overlay.style = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.85); z-index: 10000;
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                backdrop-filter: blur(4px);
            `;
            overlay.innerHTML = `
                <div class="sync-loader"></div>
                <h3 style="color: white; margin-top: 20px; font-family: Inter, sans-serif;">Sincronizando con Firebase...</h3>
                <p style="color: #888; font-size: 14px;">No cierres la aplicación</p>
                <style>
                    .sync-loader {
                        width: 48px; height: 48px; border: 5px solid #FFF;
                        border-bottom-color: #2563eb; border-radius: 50%;
                        display: inline-block; box-sizing: border-box;
                        animation: rotation 1s linear infinite;
                    }
                    @keyframes rotation { 0% { transform: rotate(0deg) } 100% { transform: rotate(360deg) } }
                </style>
            `;
            document.body.appendChild(overlay);
        }
        
        if (overlay) overlay.style.display = show ? 'flex' : 'none';
    }
};
