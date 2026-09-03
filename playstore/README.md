# Guia para publicar Aguila Inventario Pro en Google Play

## Ruta recomendada

La app ya funciona como PWA publicada en Netlify, por eso la ruta recomendada es
empaquetarla como Trusted Web Activity (TWA) usando Bubblewrap. Asi la app Android
abre `https://aguilainventario.netlify.app/` sin barra del navegador cuando la
verificacion de Digital Asset Links es correcta.

Google Play requiere Android App Bundle (`.aab`) para apps nuevas.

## Datos sugeridos

- Nombre: Aguila Inventario Pro
- Package ID: `com.aguilainventario.pro`
- URL PWA: `https://aguilainventario.netlify.app/manifest.json`
- Politica de privacidad: `https://aguilainventario.netlify.app/privacy.html`
- Orientacion: portrait
- Display: standalone

## Comandos base

Instalar Bubblewrap:

```powershell
npm install -g @bubblewrap/cli
```

Inicializar proyecto Android TWA:

```powershell
bubblewrap init --manifest=https://aguilainventario.netlify.app/manifest.json
```

Compilar Android App Bundle:

```powershell
bubblewrap build
```

El archivo que se sube a Play Console debe ser `.aab`, no solo `.apk`.

## Digital Asset Links

Cuando Bubblewrap o Android Studio genere la llave de firma, necesitas el
fingerprint SHA-256. Con ese valor crea:

```text
/.well-known/assetlinks.json
```

Usa la plantilla `assetlinks.template.json` y reemplaza:

- `com.aguilainventario.pro`
- `SHA256_FINGERPRINT_AQUI`

Sin `assetlinks.json` correcto, Android puede abrir la app como pestaña web con
barra visible en vez de experiencia TWA completa.

## Antes de enviar a revision

- Probar login, pestañas, scanner y modo offline.
- Confirmar que `https://aguilainventario.netlify.app/privacy.html` responde 200.
- Confirmar que `manifest.json` tiene iconos 192 y 512.
- Revisar Data Safety en Play Console: Firebase Auth, base de datos, camara para escaner y datos operativos de inventario.
- Subir primero a Internal Testing.
