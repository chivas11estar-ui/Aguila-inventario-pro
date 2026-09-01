/**
 * Águila Pro - Módulo: ai-phrases-enhanced.js
 * Generador de Frases IA Contextual
 * Incluye: Clima, Hora, Santo del Día
 * Máximo 10 palabras por frase
 * Copyright © 2026 José A. G. Betancourt
 */

'use strict';

window.EnhancedPhrases = {
    currentWeather: null,
    currentSaint: null,

    // Obtener datos de clima
    async getWeatherContext() {
        try {
            if (typeof window.getWeatherInfo === 'function') {
                this.currentWeather = await window.getWeatherInfo();
                console.log('☀️ Clima obtenido:', this.currentWeather);
            }
        } catch (error) {
            console.warn('⚠️ No se pudo obtener clima:', error);
        }
    },

    // Obtener santo del día
    async getSaintOfTheDay() {
        // Desactivado para optimizar velocidad (evita error 400 y latencia de red)
        this.currentSaint = 'día bendito';
        return;
    },

    // Generar frase contextual (máximo 10 palabras)
    generateContextualPhrase() {
        const hour = new Date().getHours();
        let greeting = '';

        if (hour < 12) greeting = '🌅 Buenos días';
        else if (hour < 18) greeting = '☀️ Buenas tardes';
        else greeting = '🌙 Buenas noches';

        const weatherPhrase = this.currentWeather?.condition || 'día hermoso';
        const saintPhrase = this.currentSaint || 'día de bendiciones';

        // Frases contextuales (máximo 10 palabras)
        const phrases = [
            `${greeting}. ${weatherPhrase}. Que sea bendito.`, // ~8 palabras
            `☀️ Nuevo día, nuevas oportunidades. ¡Adelante!`, // ~6 palabras
            `💪 Hoy puedes lograr tus metas. Adelante.`, // ~7 palabras
            `📈 Que las ventas suban. ${saintPhrase}.`, // ~6 palabras
            `🛍️ Clientes contentos, tienda feliz. Hoy.`, // ~6 palabras
            `✨ Cada venta cuenta. ¡Sigue adelante siempre!`, // ~6 palabras
            `🎯 Enfocado en el objetivo. Vamos juntos.`, // ~6 palabras
            `💼 Profesional, dedicado, exitoso. Ese eres tú.`, // ~6 palabras
            `🌟 Brilla y destaca hoy en ventas.`, // ~6 palabras
            `🚀 Alcanza nuevas metas. Tú puedes lograrlo.` // ~6 palabras
        ];

        const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
        console.log('💬 Frase generada:', randomPhrase);

        return randomPhrase;
    },

    // Generar frase para auditoría visual
    async generateAuditPhrase() {
        await this.getWeatherContext();
        await this.getSaintOfTheDay();

        const phrases = [
            `📸 Anaquel ${this.currentWeather?.condition || 'perfecto'}. Excelente.`, // ~5 palabras
            `✅ Stock bien distribuido. Muy buena auditoría.`, // ~6 palabras
            `🎯 Presentación impecable. Sigue así siempre.`, // ~6 palabras
            `💯 Inventario ordenado y al día. Perfecto.`, // ~6 palabras
            `🏆 Anaquel de campeones. Felicidades promotor.` // ~6 palabras
        ];

        return phrases[Math.floor(Math.random() * phrases.length)];
    },

    // Inicializar
    async init() {
        console.log('💬 [EnhancedPhrases] Inicializando generador contextual...');
        await this.getWeatherContext();
        await this.getSaintOfTheDay();
        console.log('✅ EnhancedPhrases listo con contexto');
    }
};

// Inicializar cuando está listo
document.addEventListener('DOMContentLoaded', () => {
    window.EnhancedPhrases.init();
});

console.log('✅ ai-phrases-enhanced.js (IA Contextual) cargado correctamente');
