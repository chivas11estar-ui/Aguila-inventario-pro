# Auditoría de Higiene del Repositorio - Águila Inventario Pro

Este documento clasifica los archivos del proyecto según su uso y relevancia para el runtime activo de la PWA.

## 🟢 ARCHIVOS ACTIVOS (ACTIVE)
*Componentes críticos para el funcionamiento de la aplicación.*

| Archivo | Razón |
|---|---|
| `app-loader.js` | Orquestador de carga de módulos. |
| `app.js` | Lógica central y navegación. |
| `auth.js` | Gestión de autenticación y flujo de arranque. |
| `inventory-core.js` | Motor de base de datos (Firebase RTDB) y transacciones. |
| `inventory.js` | Estado global del inventario y filtrado. |
| `inventory-ui.js` | Renderizado de la lista de productos y marcas. |
| `refill-safe.js` | Gestión de entradas, salidas y modo recepción actual. |
| `audit.js` | Módulo de auditoría física y auditoría rápida. |
| `search-controller.js` | Buscador global híbrido (texto + escáner). |
| `profile.js` | Lógica de preferencias y tema. |
| `profile-ui.js` | Renderizado del perfil del promotor. |
| `ai-phrases.js` | Generador de frases motivacionales con IA. |
| `phrases.js` | Gestión de frases personalizadas. |
| `weather.js` | Integración con Open-Meteo para el clima. |
| `analytics.js` | Procesamiento de datos estadísticos. |
| `analytics-ui.js` | Gráficas y reportes de ventas. |
| `security-utils.js` | Sanitización de datos y escape HTML (XSS Protection). |
| `date-utils.js` | Utilidades de tiempo locales. |
| `firebase-config.js` | Configuración blindada de Firebase. |
| `telemetry-auto.js` | Capturador de errores (Bridge silenciado). |
| `scanner-mlkit.js` | Motor principal de escaneo de códigos de barras. |
| `ui.js` | Componentes genéricos de UI y steppers. |
| `listener-manager.js` | Gestión de suscripciones a Firebase para evitar fugas de memoria. |
| `index.html` | Punto de entrada y Shell de la PWA. |
| `service-worker.js` | Estrategia de cache y offline. |
| `manifest.json` | Metadatos de la PWA. |
| `styles.css` / `custom-styles.css` | Capa visual y diseño Indigo Horizon. |
| `tailwind-built.css` | CSS generado por Tailwind v4. |

## 🟡 ARCHIVOS LEGACY (LEGACY-KEEP)
*Archivos no críticos para el uso diario pero útiles para mantenimiento o migración.*

| Archivo | Razón |
|---|---|
| `migrate-to-v2.js` | Permite migrar datos de la estructura antigua a la V3. |
| `ai-phrases-enhanced.js` | Versión alternativa del generador de frases. |
| `Instalar-Agente-Local.ps1` | Script para configuración de entorno. |
| `Agente-Local-Qwen.ps1` | Script para integración con IA local. |

## 🟠 CANDIDATOS A ELIMINACIÓN (DELETE-CANDIDATE)
*Archivos que parecen no tener uso en el runtime actual.*

| Archivo | Razón |
|---|---|
| `scanner-events.js` | Indica explícitamente ser "Legacy" y delega a `ui.js`. |
| `system-events.js` | Busca IDs (`btn-diagnostico`, `btn-stats`) que ya no existen en `index.html`. |
| `src/` | Carpeta vacía. |

## 🔴 BASURA CONFIRMADA (CONFIRMED-JUNK)
*Archivos redundantes o en conflicto.*

| Archivo | Razón |
|---|---|
| `readme.md` / `README.md` | Existe una duplicidad de nombre por conflicto de mayúsculas en Windows/Git. |

## Dependencias Críticas
La jerarquía de carga definida en `app-loader.js` es la fuente de verdad del grafo de dependencias. Cualquier cambio en el orden de carga de los archivos 🟢 ACTIVE puede romper el sistema por condiciones de carrera (Race Conditions).
