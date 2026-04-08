/**
 * Águila Inventario Pro - Módulo: security-utils.js
 * CAPA DE SEGURIDAD SIMPLIFICADA (PASSTHROUGH)
 * 
 * NOTA: La encriptación AES-256 ha sido desactivada para simplificar el flujo.
 * El aislamiento de datos se gestiona ahora exclusivamente vía Firebase Security Rules.
 */

'use strict';

/**
 * Encripta una cadena de texto (PASSTHROUGH)
 * Retorna el texto original sin modificaciones para mantener compatibilidad.
 */
window.encryptData = function(plainText) {
    // Retornamos el texto tal cual, asegurando que sea string si no es nulo
    return (plainText !== null && plainText !== undefined) ? String(plainText) : plainText;
};

/**
 * Desencripta una cadena de texto (PASSTHROUGH)
 * Retorna el texto original sin procesar lógica de CryptoJS.
 */
window.decryptData = function(cipherText) {
    if (!cipherText || typeof cipherText !== 'string') return cipherText;

    // Si el dato aún tiene el prefijo legacy "aes:", lo limpiamos para mostrar el hash
    // o simplemente retornamos la cadena para que el sistema no rompa.
    // En un passthrough puro, devolvemos el valor recibido.
    return cipherText;
};

console.log('🛡️ Security Utils: Modo Passthrough (Encriptación Desactivada) activo.');