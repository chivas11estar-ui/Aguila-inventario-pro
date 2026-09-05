# Candidatos a Eliminación - Auditoría de Higiene

Basado en el análisis de dependencias y referencias cruzadas, los siguientes archivos son candidatos para su eliminación definitiva del repositorio.

## 1. Archivos Confirmados como Basura (🔴 CONFIRMED-JUNK)
| Archivo | Razón |
|---|---|
| `readme.md` | Duplicado de `README.md`. Git en Windows presenta conflictos con este archivo. Se recomienda conservar `README.md` (mayúsculas) como estándar. |
| `scanner-events.js` | Contenido vacío (solo un log). Su funcionalidad fue absorbida por `ui.js`. |

## 2. Candidatos a Eliminación (🟠 DELETE-CANDIDATE)
| Archivo | Razón |
|---|---|
| `system-events.js` | Registra eventos para botones que no existen en el HTML actual (`btn-diagnostico`, `btn-stats`, `btn-clear-data`). |
| `src/` (carpeta) | Carpeta vacía sin archivos fuente activos. |

## 3. Archivos Especiales (🟡 LEGACY-KEEP)
*NO ELIMINAR, pero mover a una carpeta de utilidades o mantenimiento.*
- `migrate-to-v2.js`
- `ai-phrases-enhanced.js`

## Plan de Acción Recomendado
1. Realizar un backup local de los archivos 🔴 y 🟠.
2. Proceder con `git rm` para limpiar el árbol de trabajo.
3. Actualizar `app-loader.js` para retirar la carga de archivos eliminados.
4. Actualizar `service-worker.js` para retirar los archivos del caché.
