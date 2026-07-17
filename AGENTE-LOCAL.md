# Águila Local con Ollama y Qwen

Este respaldo usa Codex CLI como agente de archivos y comandos, pero genera las respuestas con
`qwen2.5-coder:7b` en Ollama dentro de esta computadora. No consume la cuota semanal de modelos en la nube.

## Estado en esta PC

- Ollama quedó instalado con el instalador oficial de PowerShell.
- El modelo `qwen2.5-coder:7b` quedó descargado.
- La API local respondió en `http://localhost:11434`.
- Codex CLI respondió usando `provider: ollama` y `model: qwen2.5-coder:7b`.

Si una terminal vieja no reconoce `ollama`, ciérrala y abre una terminal nueva. Windows a veces no actualiza el `PATH`
en ventanas que ya estaban abiertas.

## Uso diario

1. Abre PowerShell dentro de la carpeta del proyecto.
2. Ejecuta:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\Agente-Local-Qwen.ps1
   ```

3. Escribe la tarea como normalmente se la pedirías a Codex.

El archivo `AGENTS.md` de esta carpeta le da al agente su rol: experto técnico de Águila Inventario Pro,
enfocado en promotores de campo, piso de ventas, entradas, rellenos, auditorías, Firebase, PWA y modo oscuro.

El agente arranca con acceso de escritura limitado a la carpeta seleccionada y aprobación `on-request`.
No uses `danger-full-access` ni desactives las aprobaciones salvo que sepas exactamente por qué.

Para trabajar en otro proyecto:

```powershell
powershell -ExecutionPolicy Bypass -File .\Agente-Local-Qwen.ps1 -Proyecto 'C:\ruta\del\proyecto'
```

## Ejemplo de prompt cuando estés trabajando

```text
Me salió este error en Águila Inventario:
[pega aquí el error o captura]

Analiza la causa, dime qué archivos tocarías y propón el arreglo.
No publiques ni cambies nada externo sin avisarme.
```

## Modelo elegido

`qwen2.5-coder:7b` ocupa aproximadamente 4.7 GB y es la opción equilibrada para este equipo con
Ryzen 3 5300G y 16 GB de RAM. El modelo 14B puede superar los 9 GB y dejaría poco margen para el
navegador y las herramientas de desarrollo.

## Privacidad y límites

- Las inferencias del modelo se ejecutan en `localhost:11434`.
- El modelo no sustituye copias de seguridad ni revisión humana antes de publicar.
- Será más lento y menos capaz que Codex en la nube, especialmente en cambios grandes.
- GitHub, Firebase y Netlify siguen necesitando conexión a internet aunque el modelo sea local.
- Si quieres usarlo desde fuera de casa/trabajo, configura acceso remoto seguro; no expongas `localhost:11434` a internet.
