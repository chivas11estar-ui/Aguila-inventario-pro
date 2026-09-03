# Bridge de telemetría (DESHABILITADO / NO OPERATIVO)

## Estado actual (verificado 2026-09)

El servidor `aguila-bridge` está **apagado**: no escucha en el puerto 3000, no hay `.env` real (solo `.env.example`), y `bugs.log` solo contiene una entrada de prueba de julio. **La app NO depende de él**: `telemetry-auto.js` reporta errores con un toggle `TELEMETRY_ENABLED` (default activo), timeout de 3s vía `AbortController` y fallo silencioso en cola local. Si el bridge está caído, el frontend funciona igual y no genera ruido en consola.

**El proyecto ya no usa el bridge.** Se conserva la carpeta por referencia histórica. No intentar levantar ni habilitar autorreparación sin autorización explícita.

## Qué era (referencia histórica)

1. `telemetry-auto.js` captura `error`, `unhandledrejection` y consola.
2. Envía `POST /errors` al servidor `aguila-bridge` con mensaje, archivo, línea, stack y determinante.
3. `server.js` valida origen/dominio y escribe un evento JSON por línea en `bugs.log`.
4. Si se habilita, `repair-agent.js` selecciona el archivo, solicita una propuesta a un modelo de IA, valida sintaxis y puede crear una rama Git.

## Protección requerida (si algún día se reactiva)

- Validar `APP_DOMAIN`, `ALLOWED_ORIGINS`, tamaño JSON y `BRIDGE_API_KEY` antes de exponer el servidor.
- No registrar tokens, claves de la IA, contraseñas ni datos personales en `bugs.log`.
- `ENABLE_AUTO_REPAIR` permite escribir archivos: mantenerlo apagado para investigación y activar sólo con aprobación humana.
- `ENABLE_GIT_PUSH` permite publicar una rama: mantenerlo apagado durante pruebas.
- `DRY_RUN=true` permite observar una reparación sin escribir ni publicar.
- Limitar intentos con `MAX_REPAIR_ATTEMPTS`; investigar ciclos repetidos manualmente.
- El `.env.example` ya viene en MODO SEGURO (`ENABLE_AUTO_REPAIR=false`, `DRY_RUN=true`, `ENABLE_GIT_PUSH=false`).

## Revisión de una reparación sugerida por IA

1. Verificar que el archivo identificado corresponda a la URL y al flujo reportado.
2. Comparar propuesta con el archivo original; rechazar reescrituras amplias sin justificación.
3. Revisar que no modifique rutas de Firebase, credenciales, reglas, telemetría o despliegue sin autorización.
4. Validar sintaxis y probar el flujo afectado.
5. Crear un commit/PR sólo después de revisión humana; desplegar únicamente con autorización.
