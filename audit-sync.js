/**
 * Águila Inventario Pro - Módulo: audit-sync.js (RTDB ONLY)
 * Versión 7.6 - Sincronización Atómica Multi-Ruta
 * Copyright © 2026 José A. G. Betancourt
 */

'use strict';

window.AUDIT_SYNC = {
    isSyncing: false,

    async syncAuditSession() {
        if (this.isSyncing || window.AUDIT_PRO.session.length === 0) return;

        const confirmSync = confirm(`¿Deseas cerrar la auditoría y sincronizar ${window.AUDIT_PRO.session.length} ítems?`);
        if (!confirmSync) return;

        this.isSyncing = true;
        this.toggleLoadingOverlay(true);

        const det = await window.getCachedDeterminante();
        if (!det) {
            showToast("❌ Error: Determinante no encontrado", "error");
            this.isSyncing = false;
            this.toggleLoadingOverlay(false);
            return;
        }

        // Multi-ruta update para atomicidad en RTDB
        const updates = {};
        const discrepancies = [];
        const timestamp = Date.now();
        const userEmail = firebase.auth().currentUser.email;

        try {
            const itemsToSync = window.AUDIT_PRO.session.filter(item => item.status !== 'MATCH');

            if (itemsToSync.length === 0) {
                showToast("✅ Auditoría sin discrepancias", "success");
                this.executeSuccessFlow();
                return;
            }

            for (const item of itemsToSync) {
                if (item.code === 'DESCONOCIDO' || !item.code) {
                    discrepancies.push(item);
                    continue; 
                }

                const path = `productos/${det}/${item.code}`;
                updates[`${path}/stockTotal`] = item.counted;
                updates[`${path}/ultimaAuditoria`] = timestamp;
                updates[`${path}/auditadoPor`] = userEmail;

                discrepancies.push(item);
            }

            // Ejecutar actualización masiva en RTDB
            await firebase.database().ref().update(updates);

            // Generar Reporte en RTDB
            await this.generateAuditReportRTDB(det, discrepancies, timestamp, userEmail);

            this.executeSuccessFlow();

        } catch (error) {
            console.error("❌ Error en Sync RTDB:", error);
            showToast("❌ Error de sincronización. Reintenta.", "error");
        } finally {
            this.isSyncing = false;
            this.toggleLoadingOverlay(false);
        }
    },

    async generateAuditReportRTDB(det, discrepancies, timestamp, userEmail) {
        try {
            const reportRef = firebase.database().ref(`auditorias/${det}`).push();
            await reportRef.set({
                timestamp: timestamp,
                auditor_email: userEmail,
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
            console.log("📊 Reporte guardado en RTDB:", reportRef.key);
        } catch (e) {
            console.error("⚠️ Error reporte RTDB:", e);
        }
    },

    executeSuccessFlow() {
        setTimeout(() => {
            window.AUDIT_PRO.session = [];
            window.AUDIT_PRO.lastCode = null;
            if (typeof window.renderAuditList === 'function') window.renderAuditList();
            showToast("📦 Auditoría Sincronizada", "success");
            if (typeof window.switchTab === 'function') window.switchTab('inventory');
        }, 500);
    },

    toggleLoadingOverlay(show) {
        let overlay = document.getElementById('audit-sync-overlay');
        if (!overlay && show) {
            overlay = document.createElement('div');
            overlay.id = 'audit-sync-overlay';
            overlay.style = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:10000;display:flex;flex-direction:column;align-items:center;justify-content:center;backdrop-filter:blur(4px);";
            overlay.innerHTML = '<div class="sync-loader"></div><h3 style="color:white;margin-top:20px;">Sincronizando RTDB...</h3>';
            document.body.appendChild(overlay);
        }
        if (overlay) overlay.style.display = show ? 'flex' : 'none';
    }
};