// ============================================================
// Ãguila Inventario Pro - MÃ³dulo: ai-phrases.js (HARDENED v3)
// GeneraciÃ³n de Frases Motivacionales con IA y Capa de Seguridad
// EVOLUCION: Netlify Function genera la frase en servidor + fallback local
// FIX v3: Clima correcto, santo del dÃ­a, timezone local, limpieza
// Copyright Â© 2026 JosÃ© A. G. Betancourt
// ============================================================

'use strict';

/**
 * CIERRE SEGURO (CLOSURE) PARA LLAVES DE IA
 */
const AIService = (function() {

                       // Endpoints disponibles (orden de prioridad)
                       const NETLIFY_FUNCTION_URL = '/.netlify/functions/generate-phrase';

                       /**
             * SANITIZACIÃ“N DE ENTRADAS (Anti-Prompt Injection)
             */
                       function sanitize(text) {
                                       if (!text) return '';
                                       return String(text)
                                           .replace(/[<>{}[\]\\\/]/g, '')
                                           .substring(0, 100)
                                           .trim();
                       }

                       /**
             * Obtener fecha local en formato YYYY-MM-DD (zona horaria del usuario)
             * FIX: Antes usaba toISOString() que devuelve UTC y causaba desfase de 6h
             */
                       function getLocalDateString() {
                                       const now = new Date();
                                       const year = now.getFullYear();
                                       const month = String(now.getMonth() + 1).padStart(2, '0');
                                       const day = String(now.getDate()).padStart(2, '0');
                                       return `${year}-${month}-${day}`;
                       }

                       /**
             * Obtener santo del dÃ­a (lista local para no depender de API externa)
             * Cubre los 366 dÃ­as del aÃ±o con santos mexicanos populares
             */
                       function getSantoDia() {
                                       const now = new Date();
                                       const mes = now.getMonth() + 1;
                                       const dia = now.getDate();
                                       const key = `${mes}-${dia}`;

                const santos = {
                                    // Enero
                                    '1-1': 'MarÃ­a Madre de Dios', '1-2': 'San Basilio', '1-3': 'Santa Genoveva',
                                    '1-4': 'San Rigoberto', '1-5': 'San SimeÃ³n', '1-6': 'Santos Reyes Magos',
                                    '1-7': 'San Raimundo', '1-8': 'San Severino', '1-9': 'San JuliÃ¡n',
                                    '1-10': 'San Gonzalo', '1-11': 'San Higinio', '1-12': 'Santa Tatiana',
                                    '1-13': 'San Hilario', '1-14': 'San FÃ©lix', '1-15': 'San Mauro',
                                    '1-16': 'San Marcelo', '1-17': 'San Antonio Abad', '1-18': 'Santa Prisca',
                                    '1-19': 'San Mario', '1-20': 'San SebastiÃ¡n', '1-21': 'Santa InÃ©s',
                                    '1-22': 'San Vicente', '1-23': 'San Ildefonso', '1-24': 'San Francisco de Sales',
                                    '1-25': 'ConversiÃ³n de San Pablo', '1-26': 'San Timoteo', '1-27': 'Santa Ãngela',
                                    '1-28': 'Santo TomÃ¡s de Aquino', '1-29': 'San Valero', '1-30': 'Santa Martina',
                                    '1-31': 'San Juan Bosco',
                                    // Febrero
                                    '2-1': 'Santa BrÃ­gida', '2-2': 'DÃ­a de la Candelaria', '2-3': 'San Blas',
                                    '2-4': 'San AndrÃ©s Corsino', '2-5': 'Santa Ãgueda', '2-6': 'San Pablo Miki',
                                    '2-7': 'San Ricardo', '2-8': 'Santa Josefina', '2-9': 'Santa Apolonia',
                                    '2-10': 'Santa EscolÃ¡stica', '2-11': 'Virgen de Lourdes', '2-12': 'Santa Eulalia',
                                    '2-13': 'San Benigno', '2-14': 'San ValentÃ­n', '2-15': 'San Faustino',
                                    '2-16': 'Santa Juliana', '2-17': 'San Alejo', '2-18': 'San Eladio',
                                    '2-19': 'San Ãlvaro', '2-20': 'San LeÃ³n', '2-21': 'San Pedro DamiÃ¡n',
                                    '2-22': 'CÃ¡tedra de San Pedro', '2-23': 'San Policarpo', '2-24': 'San Modesto',
                                    '2-25': 'San CesÃ¡reo', '2-26': 'San Alejandro', '2-27': 'San Gabriel',
                                    '2-28': 'San RomÃ¡n', '2-29': 'San Augusto',
                                    // Marzo
                                    '3-1': 'San David', '3-2': 'San Simplicio', '3-3': 'Santa Catalina',
                                    '3-4': 'San Casimiro', '3-5': 'San AdriÃ¡n', '3-6': 'Santa Coleta',
                                    '3-7': 'Santo TomÃ¡s de Aquino', '3-8': 'San Juan de Dios', '3-9': 'Santa Francisca',
                                    '3-10': 'San Simplicio', '3-11': 'San Eulogio', '3-12': 'San Gregorio Magno',
                                    '3-13': 'San Rodrigo', '3-14': 'Santa Matilde', '3-15': 'San Raimundo',
                                    '3-16': 'San Abraham', '3-17': 'San Patricio', '3-18': 'San Cirilo',
                                    '3-19': 'San JosÃ©', '3-20': 'Santa Claudia', '3-21': 'San Benito',
                                    '3-22': 'Santa Lea', '3-23': 'Santo Toribio', '3-24': 'San Agapito',
                                    '3-25': 'AnunciaciÃ³n del SeÃ±or', '3-26': 'San Braulio', '3-27': 'San Ruperto',
                                    '3-28': 'San Sixto', '3-29': 'San Eustasio', '3-30': 'San Juan ClÃ­maco',
                                    '3-31': 'San BenjamÃ­n',
                                    // Abril
                                    '4-1': 'San Hugo', '4-2': 'San Francisco de Paula', '4-3': 'San Ricardo',
                                    '4-4': 'San Isidoro', '4-5': 'San Vicente Ferrer', '4-6': 'San Celestino',
                                    '4-7': 'San Juan Bautista de la Salle', '4-8': 'San Dionisio',
                                    '4-9': 'Santa Casilda', '4-10': 'San Ezequiel', '4-11': 'San Estanislao',
                                    '4-12': 'San Julio', '4-13': 'San MartÃ­n', '4-14': 'San Tiburcio',
                                    '4-15': 'Santa Anastasia', '4-16': 'Santa Bernardita', '4-17': 'San Aniceto',
                                    '4-18': 'San Perfecto', '4-19': 'San LeÃ³n IX', '4-20': 'Santa InÃ©s de Montepulciano',
                                    '4-21': 'San Anselmo', '4-22': 'San Sotero', '4-23': 'San Jorge',
                                    '4-24': 'San Fidel', '4-25': 'San Marcos', '4-26': 'Virgen del Buen Consejo',
                                    '4-27': 'Santa Zita', '4-28': 'San Pedro Chanel', '4-29': 'Santa Catalina de Siena',
                                    '4-30': 'San PÃ­o V',
                                    // Mayo
                                    '5-1': 'San JosÃ© Obrero', '5-2': 'San Atanasio', '5-3': 'Santos Felipe y Santiago',
                                    '5-4': 'Santa MÃ³nica', '5-5': 'San Hilario', '5-6': 'San Juan ante Portam',
                                    '5-7': 'Santa Flavia', '5-8': 'Virgen de LujÃ¡n', '5-9': 'San Gregorio',
                                    '5-10': 'San Juan de Ãvila', '5-11': 'San Mamerto', '5-12': 'Santo Domingo de la Calzada',
                                    '5-13': 'Virgen de FÃ¡tima', '5-14': 'San MatÃ­as', '5-15': 'San Isidro Labrador',
                                    '5-16': 'San Juan Nepomuceno', '5-17': 'San Pascual BailÃ³n', '5-18': 'San FÃ©lix',
                                    '5-19': 'San Celestino', '5-20': 'San Bernardino', '5-21': 'San CristÃ³bal Magallanes',
                                    '5-22': 'Santa Rita', '5-23': 'San Juan Bautista Rossi', '5-24': 'MarÃ­a Auxiliadora',
                                    '5-25': 'San Beda', '5-26': 'San Felipe Neri', '5-27': 'San AgustÃ­n de Canterbury',
                                    '5-28': 'San GermÃ¡n', '5-29': 'Santa Ãšrsula', '5-30': 'San Fernando',
                                    '5-31': 'VisitaciÃ³n de MarÃ­a',
                                    // Junio
                                    '6-1': 'San Justino', '6-2': 'San Marcelino', '6-3': 'San Carlos Lwanga',
                                    '6-4': 'Santa Clotilde', '6-5': 'San Bonifacio', '6-6': 'San Norberto',
                                    '6-7': 'San Roberto', '6-8': 'San Medardo', '6-9': 'San EfrÃ©n',
                                    '6-10': 'Santa Oliva', '6-11': 'San BernabÃ©', '6-12': 'San Juan de SahagÃºn',
                                    '6-13': 'San Antonio de Padua', '6-14': 'San Eliseo', '6-15': 'San Vito',
                                    '6-16': 'San Juan Francisco Regis', '6-17': 'San Gregorio', '6-18': 'San Marcos',
                                    '6-19': 'San Romualdo', '6-20': 'San Silverio', '6-21': 'San Luis Gonzaga',
                                    '6-22': 'San Paulino', '6-23': 'San JosÃ© Cafasso', '6-24': 'San Juan Bautista',
                                    '6-25': 'San Guillermo', '6-26': 'San Pelayo', '6-27': 'San Cirilo de AlejandrÃ­a',
                                    '6-28': 'San Ireneo', '6-29': 'San Pedro y San Pablo', '6-30': 'Santos ProtomÃ¡rtires',
                                    // Julio
                                    '7-1': 'San AarÃ³n', '7-2': 'San Martiniano', '7-3': 'Santo TomÃ¡s',
                                    '7-4': 'Santa Isabel de Portugal', '7-5': 'San Antonio MarÃ­a Zaccaria',
                                    '7-6': 'Santa MarÃ­a Goretti', '7-7': 'San FermÃ­n', '7-8': 'San AdriÃ¡n',
                                    '7-9': 'San NicolÃ¡s', '7-10': 'Santa VerÃ³nica', '7-11': 'San Benito',
                                    '7-12': 'San Juan Gualberto', '7-13': 'San Enrique', '7-14': 'San Camilo de Lelis',
                                    '7-15': 'San Buenaventura', '7-16': 'Virgen del Carmen', '7-17': 'San Alejo',
                                    '7-18': 'San Federico', '7-19': 'Santa Marina', '7-20': 'San ElÃ­as',
                                    '7-21': 'San Lorenzo de Brindis', '7-22': 'Santa MarÃ­a Magdalena',
                                    '7-23': 'Santa BrÃ­gida', '7-24': 'San Francisco Solano', '7-25': 'Santiago ApÃ³stol',
                                    '7-26': 'San JoaquÃ­n y Santa Ana', '7-27': 'San Celestino', '7-28': 'San Pedro Poveda',
                                    '7-29': 'Santa Marta', '7-30': 'San Pedro CrisÃ³logo', '7-31': 'San Ignacio de Loyola',
                                    // Agosto
                                    '8-1': 'San Alfonso', '8-2': 'San Eusebio', '8-3': 'Santa Lidia',
                                    '8-4': 'San Juan MarÃ­a Vianney', '8-5': 'Virgen de las Nieves',
                                    '8-6': 'TransfiguraciÃ³n del SeÃ±or', '8-7': 'San Cayetano', '8-8': 'Santo Domingo',
                                    '8-9': 'Santa Teresa Benedicta', '8-10': 'San Lorenzo', '8-11': 'Santa Clara',
                                    '8-12': 'Santa Juana de Chantal', '8-13': 'San Ponciano', '8-14': 'San Maximiliano',
                                    '8-15': 'AsunciÃ³n de MarÃ­a', '8-16': 'San Esteban de HungrÃ­a', '8-17': 'San Jacinto',
                                    '8-18': 'Santa Elena', '8-19': 'San Juan Eudes', '8-20': 'San Bernardo',
                                    '8-21': 'San PÃ­o X', '8-22': 'Santa MarÃ­a Reina', '8-23': 'Santa Rosa de Lima',
                                    '8-24': 'San BartolomÃ©', '8-25': 'San Luis Rey de Francia', '8-26': 'Santa Teresa de JesÃºs',
                                    '8-27': 'Santa MÃ³nica', '8-28': 'San AgustÃ­n', '8-29': 'Martirio de San Juan Bautista',
                                    '8-30': 'Santa Rosa de Lima', '8-31': 'San RamÃ³n Nonato',
                                    // Septiembre
                                    '9-1': 'San Gil', '9-2': 'San Elpidio', '9-3': 'San Gregorio Magno',
                                    '9-4': 'Santa RosalÃ­a', '9-5': 'Santa Teresa de Calcuta', '9-6': 'San ZacarÃ­as',
                                    '9-7': 'Santa Regina', '9-8': 'Natividad de MarÃ­a', '9-9': 'San Pedro Claver',
                                    '9-10': 'San NicolÃ¡s de Tolentino', '9-11': 'San Jacinto', '9-12': 'Dulce Nombre de MarÃ­a',
                                    '9-13': 'San Juan CrisÃ³stomo', '9-14': 'ExaltaciÃ³n de la Santa Cruz',
                                    '9-15': 'Virgen de los Dolores', '9-16': 'San Cornelio', '9-17': 'San Roberto Belarmino',
                                    '9-18': 'San JosÃ© de Cupertino', '9-19': 'San Jenaro', '9-20': 'San AndrÃ©s Kim',
                                    '9-21': 'San Mateo', '9-22': 'San Mauricio', '9-23': 'San PÃ­o de Pietrelcina',
                                    '9-24': 'Virgen de la Merced', '9-25': 'San CleofÃ¡s', '9-26': 'San Cosme y San DamiÃ¡n',
                                    '9-27': 'San Vicente de PaÃºl', '9-28': 'San Lorenzo Ruiz', '9-29': 'Santos ArcÃ¡ngeles',
                                    '9-30': 'San JerÃ³nimo',
                                    // Octubre
                                    '10-1': 'Santa Teresita del NiÃ±o JesÃºs', '10-2': 'Santos Ãngeles Custodios',
                                    '10-3': 'San Francisco de Borja', '10-4': 'San Francisco de AsÃ­s',
                                    '10-5': 'San FroilÃ¡n', '10-6': 'San Bruno', '10-7': 'Virgen del Rosario',
                                    '10-8': 'Santa Pelagia', '10-9': 'San Dionisio', '10-10': 'San Francisco de Borja',
                                    '10-11': 'San Juan XXIII', '10-12': 'Virgen del Pilar',
                                    '10-13': 'San Eduardo', '10-14': 'San Calixto', '10-15': 'Santa Teresa de JesÃºs',
                                    '10-16': 'Santa Margarita', '10-17': 'San Ignacio de AntioquÃ­a',
                                    '10-18': 'San Lucas', '10-19': 'San Pedro de AlcÃ¡ntara', '10-20': 'Santa Irene',
                                    '10-21': 'Santa Ãšrsula', '10-22': 'San Juan Pablo II', '10-23': 'San Juan de Capistrano',
                                    '10-24': 'San Antonio MarÃ­a Claret', '10-25': 'San Frutos', '10-26': 'San Evaristo',
                                    '10-27': 'San Sabas', '10-28': 'San SimÃ³n y San Judas', '10-29': 'San Narciso',
                                    '10-30': 'San Alfonso RodrÃ­guez', '10-31': 'San QuintÃ­n',
                                    // Noviembre
                                    '11-1': 'Todos los Santos', '11-2': 'Fieles Difuntos',
                                    '11-3': 'San MartÃ­n de Porres', '11-4': 'San Carlos Borromeo',
                                    '11-5': 'San ZacarÃ­as', '11-6': 'San Leonardo', '11-7': 'San Ernesto',
                                    '11-8': 'San Godofredo', '11-9': 'DedicaciÃ³n de San Juan de LetrÃ¡n',
                                    '11-10': 'San LeÃ³n Magno', '11-11': 'San MartÃ­n de Tours',
                                    '11-12': 'San Josafat', '11-13': 'San Leandro', '11-14': 'San Serapio',
                                    '11-15': 'San Alberto Magno', '11-16': 'Santa Margarita de Escocia',
                                    '11-17': 'Santa Isabel de HungrÃ­a', '11-18': 'San OdÃ³n', '11-19': 'San Rafael de la Salle',
                                    '11-20': 'San FÃ©lix de Valois', '11-21': 'PresentaciÃ³n de MarÃ­a',
                                    '11-22': 'Santa Cecilia', '11-23': 'San Clemente', '11-24': 'San AndrÃ©s Dung-Lac',
                                    '11-25': 'Santa Catalina de AlejandrÃ­a', '11-26': 'San Silvestre',
                                    '11-27': 'Virgen de la Medalla Milagrosa', '11-28': 'San Jaime',
                                    '11-29': 'San Saturnino', '11-30': 'San AndrÃ©s ApÃ³stol',
                                    // Diciembre
                                    '12-1': 'San Eloy', '12-2': 'Santa Bibiana', '12-3': 'San Francisco Javier',
                                    '12-4': 'Santa BÃ¡rbara', '12-5': 'San Sabas', '12-6': 'San NicolÃ¡s de Bari',
                                    '12-7': 'San Ambrosio', '12-8': 'Inmaculada ConcepciÃ³n', '12-9': 'San Juan Diego',
                                    '12-10': 'Virgen de Loreto', '12-11': 'San DÃ¡maso', '12-12': 'Virgen de Guadalupe',
                                    '12-13': 'Santa LucÃ­a', '12-14': 'San Juan de la Cruz', '12-15': 'San Valeriano',
                                    '12-16': 'Santa Adelaida', '12-17': 'San LÃ¡zaro', '12-18': 'Virgen de la Esperanza',
                                    '12-19': 'San Nemesio', '12-20': 'Santo Domingo de Silos', '12-21': 'San Pedro Canisio',
                                    '12-22': 'Santa Francisca Cabrini', '12-23': 'San Juan de Kety',
                                    '12-24': 'Santa Adela', '12-25': 'Natividad del SeÃ±or', '12-26': 'San Esteban',
                                    '12-27': 'San Juan ApÃ³stol', '12-28': 'Santos Inocentes', '12-29': 'Santo TomÃ¡s Becket',
                                    '12-30': 'San Sabino', '12-31': 'San Silvestre'
                };

                return santos[key] || null;
                       }

                       function getInventoryPhraseContext() {
                                       const productos = window.INVENTORY_STATE?.productos || window.inventoryStore?.productos || [];
                                       if (!Array.isArray(productos) || productos.length === 0) {
                                                       return { stockCount: null, outOfStockCount: null };
                                       }

                                       let stockCount = 0;
                                       let outOfStockCount = 0;

                                       productos.forEach(product => {
                                                       const boxes = Number(product.cajas ?? product.cantidad ?? product.stock ?? product.totalCajas ?? 0);
                                                       const pieces = Number(product.piezasSueltas ?? product.piezas ?? product.totalPiezas ?? 0);
                                                       if (boxes > 0 || pieces > 0) {
                                                                       stockCount += 1;
                                                       } else {
                                                                       outOfStockCount += 1;
                                                       }
                                       });

                                       return { stockCount, outOfStockCount };
                       }

                       /**
             * RUTA 1: Llamar a Netlify Function (Groq - Sin autenticaciÃ³n Firebase requerida)
             */
                       async function generateViaNetlify(userName) {
                                       const safeName = sanitize(userName);
                                       const now = new Date();
                                       const days = ['domingo','lunes','martes','miÃ©rcoles','jueves','viernes','sÃ¡bado'];
                                       const weatherData = window.PROFILE_STATE?.weather || null;
                                       const santo = getSantoDia();
                                       const inventoryContext = getInventoryPhraseContext();

                const payload = {
                                    userName: safeName,
                                    hourOfDay: now.getHours(),
                                    dayOfWeek: days[now.getDay()],
                                    date: now.toLocaleDateString('es-MX'),
                                    weather: weatherData?.condition || null,
                                    temperature: weatherData?.temperature || null,
                                    humidity: weatherData?.humidity || null,
                                    city: weatherData?.city || 'MÃ©xico',
                                    saint: santo,
                                    stockCount: inventoryContext.stockCount,
                                    outOfStockCount: inventoryContext.outOfStockCount
                };

                console.log('[IA] Descargando frase generada por Netlify...', payload);

                const controller = new AbortController();
                                       const timeout = setTimeout(() => controller.abort(), 8000);

                try {
                                    const response = await fetch(NETLIFY_FUNCTION_URL, {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify(payload),
                                                            signal: controller.signal
                                    });

                                           clearTimeout(timeout);

                                           if (!response.ok) {
                                                                   const errorData = await response.json().catch(() => ({}));
                                                                   console.warn('âš ï¸ Netlify Function error:', response.status, errorData);
                                                                   throw new Error(errorData.error || `HTTP ${response.status}`);
                                           }

                                           const data = await response.json();
                                    let phrase = data.phrase || '';

                                           // Control de longitud: mÃ¡x 20 palabras (aumentado para dar espacio al contexto)
                                           if (phrase && phrase.split(' ').length > 20) {
                                                                   phrase = phrase.split(' ').slice(0, 20).join(' ');
                                           }

                                           console.log('[IA] Frase recibida desde Netlify:', phrase);
                                    return { phrase, source: data.source || 'netlify-server' };

                } catch (error) {
                                    clearTimeout(timeout);
                                    if (error.name === 'AbortError') {
                                                            console.warn('â±ï¸ Netlify Function timeout (8s)');
                                    } else {
                                                            console.warn('âš ï¸ Netlify Function fallÃ³:', error.message);
                                    }
                                    throw error;
                }
                       }

                       /**
             * FUNCIÃ“N PRINCIPAL
             * 1. Netlify Function: el servidor genera la frase y la app solo descarga el resultado.
             * 2. Fallback local: solo si Netlify no responde.
             */
                       async function generate(userName) {
                                       try {
                                                       const result = await generateViaNetlify(userName);
                                                       if (result.phrase) return result.phrase;
                                       } catch (e) {
                                                       console.log('[IA] Netlify no respondio, usando fallback local...');
                                       }

                                       return getFallbackPhrase(userName);
                       }

                       function normalizePhrase(text) {
                                       return String(text || '')
                                           .toLowerCase()
                                           .replace(/[^\w\sÃ¡Ã©Ã­Ã³ÃºÃ±Ã¼]/gi, ' ')
                                           .replace(/\s+/g, ' ')
                                           .trim();
                       }

                       function isHighQualityPhrase(text) {
                                       const clean = String(text || '').trim();
                                       if (!clean) return false;
                                       const words = clean.split(/\s+/);
                                       if (words.length < 5 || words.length > 20) return false;
                                       const generic = ['hola', 'buenos dÃ­as', 'Ã¡nimo', 'vamos', 'excelente'];
                                       const norm = normalizePhrase(clean);
                                       return !generic.some(g => norm === g);
                       }

                       return { generate, getLocalDateString, getSantoDia, normalizePhrase, isHighQualityPhrase };
})();


// ============================================================
// OBTENER FRASE DEL DÃA (con cachÃ© en Firebase y seguridad)
// FIX: Usa fecha local en vez de UTC para el cachÃ©
// ============================================================
async function getDailyAIPhrase(userId, userName) {
            const today = AIService.getLocalDateString();
            const startedAt = Date.now();

    try {
                    // Verificar si ya hay una frase en cachÃ© para hoy
                const phraseRef = firebase.database().ref(`usuarios/${userId}/frasesIA/${today}`);
                    const snapshot = await phraseRef.once('value');

                if (snapshot.exists()) {
                                    console.log('ðŸ“¦ [IA] Frase cacheada encontrada para hoy (' + today + ')');
                                    return snapshot.val();
                }

                // Cargar preferencias para tono de frase
                const prefSnap = await firebase.database().ref(`usuarios/${userId}/preferencias/frases`).once('value');
                const pref = prefSnap.val() || {};
                const tone = String(pref.tone || 'motivacional');

                // Historial corto para evitar repeticiÃ³n
                const historySnap = await firebase.database().ref(`usuarios/${userId}/frasesIA`).once('value');
                const historyObj = historySnap.val() || {};
                const history = Object.entries(historyObj)
                    .sort((a, b) => String(b[0]).localeCompare(String(a[0])))
                    .slice(0, 14)
                    .map(([, v]) => AIService.normalizePhrase(v));

                // Generar nueva frase vÃ­a cascada de IA
                console.log('ðŸ†• [IA] Generando nueva frase para ' + today + '...');
                    let newPhrase = await AIService.generate(`${userName} (${tone})`);
                    let usedFallback = false;

                    if (!AIService.isHighQualityPhrase(newPhrase) || history.includes(AIService.normalizePhrase(newPhrase))) {
                                        const alt = getFallbackPhrase(userName);
                                        newPhrase = AIService.isHighQualityPhrase(alt) ? alt : `Hoy sumas valor en cada anaquel, ${userName}.`;
                                        usedFallback = true;
                    }

                    await phraseRef.set(newPhrase);

                    // TelemetrÃ­a ligera
                    await firebase.database().ref(`usuarios/${userId}/frasesIA_telemetria/${today}`).set({
                                        generatedAt: Date.now(),
                                        latencyMs: Date.now() - startedAt,
                                        usedFallback,
                                        tone,
                                        source: 'auto'
                    });

                    return newPhrase;

    } catch (error) {
                    if (error.message === 'RATE_LIMIT_EXCEEDED') {
                                        console.log('ðŸ›¡ï¸ Usando fallback por lÃ­mite de cuota');
                    }
                    const fallback = getFallbackPhrase(userName);
                    try {
                                        await firebase.database().ref(`usuarios/${userId}/frasesIA_telemetria/${today}`).set({
                                                            generatedAt: Date.now(),
                                                            latencyMs: Date.now() - startedAt,
                                                            usedFallback: true,
                                                            tone: 'motivacional',
                                                            source: 'fallback-error'
                                        });
                    } catch (_) {}
                    return fallback;
    }
}


// ============================================================
// MOSTRAR FRASE DEL DÃA EN LA UI (con estado "Cargando...")
// ============================================================
function normalizeAIPhraseText(value) {
            return String(value ?? '')
                            .replace(/\u00c3\u0081/g, 'Á')
                            .replace(/\u00c3\u00a1/g, 'á')
                            .replace(/\u00c3\u0089/g, 'É')
                            .replace(/\u00c3\u00a9/g, 'é')
                            .replace(/\u00c3\u008d/g, 'Í')
                            .replace(/\u00c3\u00ad/g, 'í')
                            .replace(/\u00c3\u0093/g, 'Ó')
                            .replace(/\u00c3\u00b3/g, 'ó')
                            .replace(/\u00c3\u009a/g, 'Ú')
                            .replace(/\u00c3\u00ba/g, 'ú')
                            .replace(/\u00c3\u0091/g, 'Ñ')
                            .replace(/\u00c3\u00b1/g, 'ñ')
                            .replace(/\u00c2\u00a1/g, '¡')
                            .replace(/\u00c2\u00bf/g, '¿')
                            .replace(/\u00e2\u009c\u00a8/g, '✨')
                            .replace(/\u00f0\u009f\u008c\u009f/g, '⭐')
                            .replace(/\u00f0\u009f\u0092\u00aa/g, '💪')
                            .replace(/\u00f0\u009f\u00a6\u0085/g, '')
                            .replace(/\u00f0\u009f\u009a\u0080/g, '🚀')
                            .replace(/\u00f0\u009f\u008f\u0086/g, '🏆')
                            .replace(/\u00f0\u009f\u0093\u0088/g, '')
                            .replace(/\u00f0\u009f\u0092\u008e/g, '')
                            .replace(/\u00f0\u009f\u008e\u00af/g, '')
                            .replace(/\s+/g, ' ')
                            .trim();
}

async function displayDailyAIPhrase() {
            const user = firebase.auth().currentUser;
            if (!user) return;

    // Mostrar estado de carga
    const phraseContainer = document.getElementById('motivational-phrase');
            if (phraseContainer) {
                            phraseContainer.textContent = 'Generando frase del dia...';
                            phraseContainer.style.opacity = '0.6';
            }

    try {
                    const userSnapshot = await firebase.database().ref(`usuarios/${user.uid}`).once('value');
                    const userData = userSnapshot.val();
                    const fullName = userData?.nombrePromotor || 'Campeón';
                    const firstName = fullName.split(' ')[0];

                const phrase = await getDailyAIPhrase(user.uid, firstName);

                if (phraseContainer) {
                                    phraseContainer.textContent = `"${normalizeAIPhraseText(phrase)}"`;
                                    phraseContainer.style.opacity = '1';
                                    phraseContainer.style.transition = 'opacity 0.3s ease-in';
                }
    } catch (error) {
                    console.error('ðŸ›¡ï¸ Error UI-IA:', error);
                    if (phraseContainer) {
                                        phraseContainer.textContent = `"${getFallbackPhrase('Campeón')}"`;
                                        phraseContainer.style.opacity = '1';
                    }
    }
}


// ============================================================
// FALLBACK CON CLIMA (Frases locales de respaldo)
// FIX: Usa .condition en vez de .description
// ============================================================
function getFallbackPhrase(userName) {
            const weatherCond = (window.PROFILE_STATE?.weather?.condition || '').toLowerCase();
            let climateHint = '';

    if (weatherCond.includes('rain') || weatherCond.includes('lluvia')) {
                    climateHint = 'aunque llueva';
    } else if (weatherCond.includes('cloud') || weatherCond.includes('nublado') || weatherCond.includes('overcast')) {
                    climateHint = 'aunque el cielo esté nublado';
    } else if (weatherCond.includes('sun') || weatherCond.includes('clear') || weatherCond.includes('despejado')) {
                    climateHint = 'con este gran sol';
    } else if (weatherCond.includes('partly')) {
                    climateHint = 'con este buen clima';
    }

    const santo = AIService.getSantoDia();
    const santoHint = santo ? ` En día de ${normalizeAIPhraseText(santo)}.` : '';

    const phrases = [
                    `¡${userName}, brilla ${climateHint}! Tu energía contagia al equipo.${santoHint} ⭐`,
                    `${userName}, hoy vendes fuerte ${climateHint}. Eres un campeón.${santoHint} 💪`,
                    `${userName}, avanza ${climateHint}. Cada paso cuenta hoy.${santoHint}`,
                    `¡Arriba ${userName}! Hoy es tu día para destacar ${climateHint}.${santoHint} 🚀`,
                    `${userName}, tu esfuerzo vale oro. A darlo todo hoy.${santoHint} 🏆`,
                    `¡Éxito total para ${userName}! El anaquel te espera.${santoHint}`,
                    `${userName}, eres pieza clave del equipo. ¡Ánimo ${climateHint}!${santoHint}`,
                    `Hoy brillas ${userName}. Con actitud todo se logra.${santoHint} ✨`,
                    `${userName}, cada producto que acomodas suma. ¡Vamos!${santoHint}`,
                    `¡${userName}, el inventario perfecto se logra con ganas como las tuyas!${santoHint}`
                ];

    return normalizeAIPhraseText(phrases[Math.floor(Math.random() * phrases.length)]);
}


// ============================================================
// EXPORTAR FUNCIONES SEGURAS
// ============================================================
window.getDailyAIPhrase = getDailyAIPhrase;
window.displayDailyAIPhrase = displayDailyAIPhrase;

console.log('ðŸ›¡ï¸ ai-phrases.js v3: Netlify/Groq + Firebase/Gemini + fallback local. Fix: clima, santo, timezone.');
