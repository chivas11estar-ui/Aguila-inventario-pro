# Bridge de telemetría

## Flujo

1. `telemetry-auto.js` captura `error`, `unhandledrejection` y consola.
2. Envía `POST /errors` al servidor `aguila-bridge` con mensaje, archivo, línea, stack y determinante.
3. `server.js` valida origen/dominio y escribe un evento JSON por línea en `bugs.log`.
4. Si se habilita, `repair-agent.js` selecciona el archivo, solicita una propuesta al modelo de IA configurado, valida sintaxis y puede crear una rama Git.

## Protección requerida

- Validar `APP_DOMAIN`, `ALLOWED_ORIGINS`, tamaño JSON y `BRIDGE_API_KEY` antes de exponer el servidor.
- No registrar tokens, claves de la IA, contraseñas ni datos personales en `bugs.log`.
- `ENABLE_AUTO_REPAIR` permite escribir archivos: mantenerlo apagado para investigación y activar sólo con aprobación humana.
- `ENABLE_GIT_PUSH` permite publicar una rama: mantenerlo apagado durante pruebas.
- `DRY_RUN=true` permite observar una reparación sin escribir ni publicar.
- Limitar intentos con `MAX_REPAIR_ATTEMPTS`; investigar ciclos repetidos manualmente.

## Revisión de una reparación sugerida por IA

1. Verificar que el archivo identificado corresponda a la URL y al flujo reportado.
2. Comparar propuesta con el archivo original; rechazar reescrituras amplias sin justificación.
3. Revisar que no modifique rutas de Firebase, credenciales, reglas, telemetría o despliegue sin autorización.
4. Validar sintaxis y probar el flujo afectado.
5. Crear un commit/PR sólo después de revisión humana; desplegar únicamente con autorización.

## Nota de seguridad pendiente

El `.env.example` del bridge trae por defecto `ENABLE_AUTO_REPAIR=true`, `DRY_RUN=false` y `ENABLE_GIT_PUSH=true`. Antes de exponer el servidor en producción deben quedar en modo seguro (`DRY_RUN=true`, `ENABLE_AUTO_REPAIR=false`, `ENABLE_GIT_PUSH=false`).
