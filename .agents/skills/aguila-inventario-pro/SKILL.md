---
name: aguila-inventario-pro
description: Mantener, diagnosticar y modificar Águila Inventario Pro, una PWA de inventario compartido por determinante para promotores de campo. Usar al investigar errores de producción, Firebase, PWA/offline, escáner, entrada, relleno, auditoría, búsqueda, perfiles, bridge de telemetría o reparaciones sugeridas por IA.
---

# Águila Inventario Pro

Trabajar como guardián técnico de una PWA de inventario para promotores que operan con prisa en tienda. Priorizar integridad de stock, claridad móvil y reversibilidad.

## Estado real del proyecto (verificado 2026-09)

- Repositorio GitHub: `chivas11estar-ui/Aguila-inventario-pro` (rama `main`).
- Deploy: Netlify (`aguilainventario.netlify.app`) vinculado al repo; el push a `main` dispara el deploy automáticamente.
- Motor de inventario: `inventory-core.js` **V3 Multi-Lote** (transacciones atómicas, catálogo compartido `catalogoProductos`, validación de datos). Es la versión activa y más robusta; no hay que "subirlo a V5" — la nomenclatura de versión en el encabezado es inconsistente pero el contenido correcto es este.
- Service worker: caché `aguila-pro-v9.0`, estrategia network-first. JS/CSS se sirven con `no-cache` y el SW se registra con `updateViaCache:'none'` + `reg.update()` para que la app siempre tome la versión nueva tras un deploy (no se requiere Ctrl+F5).
- Bridge de telemetría: `aguila-bridge/` (server.js + repair-agent.js) corre en una VM; los interruptores de seguridad (`DRY_RUN`, `ENABLE_AUTO_REPAIR`, `ENABLE_GIT_PUSH`) deben permanecer apagados durante diagnóstico.

## Antes de cambiar algo

1. Leer `AGENTS.md` y `references/arquitectura.md`.
2. Identificar el flujo afectado: autenticación, inventario/entrada, relleno, auditoría, búsqueda, datos, perfil, PWA o bridge.
3. Para un error, recopilar mensaje, archivo, línea, stack, ruta de Firebase y pasos de reproducción. No inferir una corrección desde el mensaje aislado.
4. Revisar los consumidores y productores del dato. Conservar la separación por `determinante`.
5. Proponer el cambio mínimo. No eliminar funcionalidades, datos, listeners ni compatibilidad sin evidencia.

## Reglas no negociables

- Mantener el inventario compartido en `productos/{determinante}/{codigoBarras}`; nunca moverlo a una ruta por usuario.
- No escribir en Firebase, cambiar reglas, desplegar, hacer push ni habilitar autorreparación sin autorización explícita.
- Tratar los cambios de inventario, lotes, caducidad, movimientos y auditoría como críticos: validar cantidades y no perder registros.
- Al cambiar archivos PWA, actualizar la versión de caché del service worker y comprobar la carga de los scripts en `index.html` o `app-loader.js`.
- Mantener la interfaz apta para móvil, contraste en modo oscuro, botones táctiles y captura rápida por código de barras.
- Ejecutar validación de sintaxis o la prueba más cercana antes de entregar un cambio.

## Errores enviados por el Bridge/IA

El navegador reporta excepciones al bridge mediante `telemetry-auto.js`. Una sugerencia de IA **no es una autorización de cambio**.

Al recibir un reporte:

1. Confirmar que la fuente pertenece a `aguilainventario.netlify.app` y que el archivo existe dentro de `APP AGUILA`.
2. Correlacionar `bugs.log`, el error, el archivo y los datos de la determinante sin exponer claves, tokens ni información de usuarios.
3. Revisar la propuesta completa como un diff: preservar la mayor parte del archivo, validar sintaxis y buscar efectos secundarios.
4. Dejar `DRY_RUN=true` y `ENABLE_GIT_PUSH=false` mientras se diagnostica. Requerir revisión humana antes de habilitar una reparación automática o publicar.
5. Si el error no contiene `source` o proviene de otro dominio, no reparar automáticamente.

Consultar `references/bridge-gemini.md` para endpoints, interruptores y límites.

## Flujo de publicación

1. Editar en `APP AGUILA` (repo git ya inicializado, `origin` → GitHub).
2. `git add` los archivos tocados, `git commit` con mensaje descriptivo, `git push origin main`.
3. Netlify despliega automáticamente; verificar estado con `netlify api` o la API REST (`/api/v1/sites/{id}/deploys`).
4. Si se cambiaron JS/CSS/SW, recordar que el deploy toma efecto sin Ctrl+F5 (no-cache + SW auto-update).

## Entrega

Informar causa, impacto, archivos tocados, validación y pasos de prueba. Si hay una acción externa pendiente, separarla claramente del diagnóstico y pedir autorización.
