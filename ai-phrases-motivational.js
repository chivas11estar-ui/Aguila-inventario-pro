ai-phrases-motivational.js
/**
 * Frases Motivacionales de IA
  * Genera frases inspiracionales para promotores
   */

   const motivationalPhrases = [
      "🌟 El éxito está en los detalles. Cada escaneo cuenta.",
        "📈 Inventario preciso = Ventas garantizadas.",
          "⚡ La sincronización perfecta es tu superpower.",
            "✅ Auditóría hoy, tranquilidad mañana.",
              "💪 Cada producto bien ubicado es una victoria.",
                "😀 Promotores felices, negocios prósperos.",
                  "🎉 Tu precisión es nuestra prioridad.",
                    "� Sincronización en tiempo real = Ventaja competitiva.",
                      "🦅 Águila Inventario: Vuela alto con precisión.",
                        "🌈 Hoy sincronizas, mañana triunfas."
   ];

   /**
    * Muestra una frase aleatoria
     */
     function displayMotivationalPhrase() {
          try {
                const phrase = motivationalPhrases[Math.floor(Math.random() * motivationalPhrases.length)];
                    const phraseElement = document.querySelector('.motivational-phrase');
                        
                            if (phraseElement) {
                                      phraseElement.textContent = phrase;
                                            phraseElement.classList.add('animate-fade-in');
                            }
                                
                                    return phrase;
          } catch (error) {
                console.warn('[Motivational Phrases]', error);
          }
     }

     // Mostrar frase al cargar
     if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', displayMotivationalPhrase);
     } else {
          displayMotivationalPhrase();
     }

     // Cambiar frase cada hora
     setInterval(displayMotivationalPhrase, 3600000);

     // Exportar para uso global
     window.displayMotivationalPhrase = displayMotivationalPhrase;
     window.motivationalPhrases = motivationalPhrases;