// ============================================================
// Águila Inventario Pro - Módulo: date-utils.js
// Utilidades para manejo de fechas en zona horaria local
// Copyright © 2025 José A. G. Betancourt
// ============================================================

/**
 * Obtiene la fecha actual en formato ISO pero en zona horaria local
 * En lugar de usar UTC, usa la zona horaria del navegador
 * 
 * @returns {string} Fecha en formato "YYYY-MM-DDTHH:mm:ss.sssZ" pero en hora local
 */
function getLocalISOString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');

    // Devolvemos el formato ISO pero SIN la 'Z' al final para que los 
    // navegadores lo interpreten como hora local pura.
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}`;
}

/**
 * Obtiene solo la fecha (sin hora) en formato YYYY-MM-DD en zona horaria local
 * 
 * @param {Date} date - Fecha a formatear (opcional, por defecto usa hoy)
 * @returns {string} Fecha en formato "YYYY-MM-DD"
 */
function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Obtiene el inicio del día en zona horaria local en formato ISO
 * 
 * @param {Date} date - Fecha (opcional, por defecto usa hoy)
 * @returns {string} Fecha de inicio del día en formato ISO local
 */
function getLocalDayStart(date = new Date()) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const offset = d.getTimezoneOffset() * 60000;
    const localTime = new Date(d.getTime() - offset);
    return localTime.toISOString();
}

/**
 * Obtiene el fin del día en zona horaria local en formato ISO
 * 
 * @param {Date} date - Fecha (opcional, por defecto usa hoy)
 * @returns {string} Fecha de fin del día en formato ISO local
 */
function getLocalDayEnd(date = new Date()) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    const offset = d.getTimezoneOffset() * 60000;
    const localTime = new Date(d.getTime() - offset);
    return localTime.toISOString();
}

/**
 * Convierte una fecha ISO (UTC o local) a fecha local en formato YYYY-MM-DD
 * 
 * @param {string} isoString - Fecha en formato ISO
 * @returns {string} Fecha en formato "YYYY-MM-DD" en zona horaria local
 */
function isoToLocalDate(isoString) {
    const date = new Date(isoString);
    return getLocalDateString(date);
}

// Exportar funciones globalmente
window.getLocalISOString = getLocalISOString;
window.getLocalDateString = getLocalDateString;
window.getLocalDayStart = getLocalDayStart;
window.getLocalDayEnd = getLocalDayEnd;
window.isoToLocalDate = isoToLocalDate;

console.log('✅ date-utils.js cargado correctamente');
console.log('🕐 Zona horaria detectada: UTC' + (new Date().getTimezoneOffset() / -60));
