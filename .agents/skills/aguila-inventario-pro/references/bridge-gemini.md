# Bridge de telemetría y Gemini

## Flujo

1. La telemetría automática del cliente está pendiente de restauración; mientras tanto, recopilar manualmente `error`, `unhandledrejection` y consola.
2. Envía `POST /errors` al servidor `aguila-bridge` con mensaje, archivo, línea, stack y determinante.
3. `server.js` valida origen/dominio y escribe un evento JSON por línea en `bugs.log`.
4. Si se habilita, `repair-agent.js` selecciona el archivo, solicita una propuesta a Gemini, valida sintaxis y puede crear una rama Git.

## Protección requerida

- Validar `APP_DOMAIN`, `ALLOWED_ORIGINS`, tamaño JSON y `BRIDGE_API_KEY` antes de exponer el servidor.
- No registrar tokens, claves de Gemini, contraseñas ni datos personales en `bugs.log`.
- `ENABLE_AUTO_REPAIR` permite escribir archivos: mantenerlo apagado para investigación y activar sólo con aprobación humana.
- `ENABLE_GIT_PUSH` permite publicar una rama: mantenerlo apagado durante pruebas.
- `DRY_RUN=true` permite observar una reparación sin escribir ni publicar.
- Limitar intentos con `MAX_REPAIR_ATTEMPTS`; investigar ciclos repetidos manualmente.

## Revisión de una reparación Gemini

1. Verificar que el archivo identificado corresponda a la URL y al flujo reportado.
2. Comparar propuesta con el archivo original; rechazar reescrituras amplias sin justificación.
3. Revisar que no modifique rutas de Firebase, credenciales, reglas, telemetría o despliegue sin autorización.
4. Validar sintaxis y probar el flujo afectado.
5. Crear un commit/PR sólo después de revisión humana; desplegar únicamente con autorización.
