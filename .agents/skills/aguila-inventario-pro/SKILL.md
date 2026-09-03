---
name: aguila-inventario-pro
description: Mantener, diagnosticar y modificar Águila Inventario Pro, una PWA de inventario compartido por determinante para promotores de campo. Usar al investigar errores de producción, Firebase, PWA/offline, escáner, entrada, relleno, auditoría, búsqueda, perfiles, bridge de telemetría o reparaciones sugeridas por Gemini.
---

# Águila Inventario Pro

Trabajar como guardián técnico de una PWA de inventario para promotores que operan con prisa en tienda. Priorizar integridad de stock, claridad móvil y reversibilidad.

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
- Mantener la interfaz apta para móvil, botones táctiles y captura rápida por código de barras.
- **Modo Oscuro:** Todas las utilidades `dark:` de Tailwind y los estilos personalizados deben obedecer exclusivamente a la clase `.dark` en el `<html>` (independiente del sistema operativo).
- **Contraste:** Garantizar legibilidad en modo oscuro usando variables semánticas (`--text`, `--muted`, `--surface-dim`) y evitando colores fijos (`#1e293b`, `white`) en el JS/HTML.
- **Buscador:** El buscador global en la pestaña de Stock debe inicializarse de forma robusta tras la carga de módulos para evitar errores de sincronización.
- **IA de Frases:** El sistema de frases motivacionales utiliza una Netlify Function con Groq/Llama-3. Siempre debe tener un fallback local y limpiar etiquetas de tono (ej. `(motivacional)`) antes de mostrar el texto.
- **Clima:** La escena del clima debe mantenerse nítida (sin filtros blur excesivos) para garantizar claridad visual en el perfil.
- **Limpieza Ferrari:** El repositorio debe mantenerse libre de archivos duplicados (`-josekarla1`), carpetas vacías y archivos de configuración redundantes. Solo la carpeta `APP AGUILA` se sincroniza con GitHub.
- Ejecutar validación de sintaxis o la prueba más cercana antes de entregar un cambio.

## Errores del Bridge (DESHABILITADO — referencia histórica)

`telemetry-auto.js` captura errores del navegador, pero el servidor `aguila-bridge` está **apagado y ya no se usa**. La app funciona sin él (el fetch al bridge usa timeout corto y fallo silencioso). El bloque de abajo es solo referencia por si se reactiva algún día.

El bridge podría pedir a una IA una reparación, pero una sugerencia de IA **no es una autorización de cambio**:

1. Confirmar que la fuente pertenece a `aguilainventario.netlify.app` y que el archivo existe dentro de `APP AGUILA`.
2. Correlacionar `bugs.log`, el error, el archivo y los datos de la determinante sin exponer claves, tokens ni información de usuarios.
3. Revisar la propuesta completa de IA como un diff: preservar la mayor parte del archivo, validar sintaxis y buscar efectos secundarios.
4. Dejar `DRY_RUN=true` y `ENABLE_GIT_PUSH=false` mientras se diagnostica. Requerir revisión humana antes de habilitar una reparación automática o publicar.
5. Si el error no contiene `source` o proviene de otro dominio, no reparar automáticamente.

Consultar `references/bridge-gemini.md` para el estado actual del bridge.

## Entrega

Informar causa, impacto, archivos tocados, validación y pasos de prueba. Si hay una acción externa pendiente, separarla claramente del diagnóstico y pedir autorización.
