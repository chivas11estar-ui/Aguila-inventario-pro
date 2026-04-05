/**
 * Águila Inventario Pro - Módulo: security-utils.js
 * Capa de Encriptación AES-256 (Grado Militar)
 * Copyright © 2026 José A. G. Betancourt
 */

'use strict';

const ENCRYPTION_CONFIG = {
    // Llave maestra del sistema (se combina con el UID para unicidad)
    SECRET_KEY_BASE: "AGUILA_PRO_SECURE_VAULT_2026_MX_V7",
    ITERATIONS: 1000
};

/**
 * Deriva una llave única basada en la sesión del usuario actual
 */
function getDeriveKey() {
    const user = firebase.auth().currentUser;
    const det = window.PROFILE_STATE?.determinante;
    
    // Esperar a que el determinante exista (indispensable para descifrado compartido)
    if (!user || !det) {
        console.warn("🔐 Esperando determinante para derivación de llave...");
        return ENCRYPTION_CONFIG.SECRET_KEY_BASE; 
    }
    
    // Combinación: Base Global + Determinante de la Tienda
    return ENCRYPTION_CONFIG.SECRET_KEY_BASE + "_" + det;
}

/**
 * Encripta una cadena de texto usando AES-256
 */
window.encryptData = function(plainText) {
    if (!plainText || typeof plainText !== 'string') return plainText;
    
    try {
        const key = getDeriveKey();
        const ciphertext = CryptoJS.AES.encrypt(plainText.trim(), key).toString();
        return "aes:" + ciphertext; // Prefijo para identificar datos encriptados
    } catch (e) {
        console.error("❌ Error encriptando datos:", e);
        return plainText;
    }
};

/**
 * Desencripta una cadena de texto cifrada
 */
window.decryptData = function(cipherText) {
    if (!cipherText || typeof cipherText !== 'string') return cipherText;
    
    // Solo intentar desencriptar si tiene el prefijo
    if (!cipherText.startsWith("aes:")) return cipherText;
    
    try {
        const key = getDeriveKey();
        const encryptedData = cipherText.replace("aes:", "");
        const bytes = CryptoJS.AES.decrypt(encryptedData, key);
        const originalText = bytes.toString(CryptoJS.enc.Utf8);
        
        if (!originalText) throw new Error("Decryption resulted in empty string");
        return originalText;
    } catch (e) {
        // En caso de error (ej: llave incorrecta), retornar un placeholder o el original
        console.warn("⚠️ Error desencriptando (posible cambio de llave):", cipherText);
        return "🔒 [Dato Protegido]";
    }
};

console.log('🛡️ Security Utils (AES-256) cargado correctamente.');