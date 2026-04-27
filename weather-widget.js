weather-widget.js
/**
 * Weather Widget - Carga clima desde API wttr.in
  * Muestra temperatura en tiempo real en el header
   */

   async function loadWeatherWidget() {
      try {
            const response = await fetch('https://wttr.in/?format=j1');
                if (!response.ok) {
                          throw new Error('No se pudo obtener el clima');
                }
                    
                        const data = await response.json();
                            const current = data.current_condition[0];
                                const temp = current.temp_C;
                                    const condition = current.description;
                                        
                                            // Buscar el elemento del widget en el DOM
                                                const weatherElement = document.querySelector('.weather-widget');
                                                    if (weatherElement) {
                                                              weatherElement.innerHTML = `
                                                                      <span title="${condition}">
                                                                                🌡️ ${temp}°C
                                                                                        </span>
                                                                                              `;
                                                                                                    weatherElement.style.cursor = 'pointer';
                                                    }
      } catch (error) {
            console.warn('[Weather Widget] Clima no disponible:', error.message);
                // Silenciosamente falla si no hay conexión
                    const weatherElement = document.querySelector('.weather-widget');
                        if (weatherElement) {
                                  weatherElement.innerHTML = '<span>—</span>';
                        }
      }
   }

   // Cargar clima al inicializar
   if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', loadWeatherWidget);
   } else {
      loadWeatherWidget();
   }

   // Actualizar cada 5 minutos (300000 ms)
   setInterval(loadWeatherWidget, 300000);

   // Exportar para uso en otros módulos
   window.loadWeatherWidget = loadWeatherWidget;