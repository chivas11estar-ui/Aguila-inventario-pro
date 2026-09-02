🦅 Águila Inventario Pro v9.0

> Sistema profesional de gestión de inventario para promotores de tienda, con sincronización en tiempo real, escáner avanzado (Google ML Kit) y soporte PWA con modo offline.

[![Netlify Status](https://api.netlify.com/api/v1/badges/YOUR-BADGE-ID/deploy-status)](https://app.netlify.com/sites/aguilainvantario/deploys)
![Firebase](https://img.shields.io/badge/Firebase-Realtime_DB-orange)
![ML Kit](https://img.shields.io/badge/Google-ML_Kit-red)
![PWA](https://img.shields.io/badge/PWA-Instalable_%2B_Offline-blueviolet)
![License](https://img.shields.io/badge/license-Proprietary-red)

---

## 🚀 Deploy (GitHub + Netlify)

- Repo: `chivas11estar-ui/Aguila-inventario-pro` (rama `main`).
- El push a `main` dispara el deploy automático en Netlify (`aguilainventario.netlify.app`).
- JS/CSS se sirven con `no-cache` y el service worker se autoactualiza (`updateViaCache:'none'` + `reg.update()`), así que un deploy toma efecto sin limpiar caché ni Ctrl+F5.
- Motor de inventario: `inventory-core.js` V3 Multi-Lote con transacciones atómicas y catálogo compartido.

---

## 📋 Tabla de Contenidos
- [Características](#características)
- [Tecnologías](#tecnologías)
- [Demo en Vivo](#demo-en-vivo)
- [Instalación Rápida](#instalación-rápida)
- [Configuración de Firebase](#configuración-de-firebase)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Estructura de Datos](#estructura-de-datos)
- [Cómo Usar](#cómo-usar)
- [Roadmap](#roadmap)
- [Autor](#autor)

---

## ✨ Características

### 🔐 Autenticación Segura
- Login/registro con Firebase Authentication  
- Recuperación de contraseña vía email  
- Sistema de determinantes (tiendas multi-usuario)  
- Sesiones persistentes  

### 📦 Inventario Multi-Tienda
- Vista por marcas (Sabritas, Gamesa, Quaker, Sonric's)  
- Búsqueda en tiempo real por nombre, código o marca  
- Agrupación inteligente por bodega  
- Alertas de caducidad automáticas  
- Edición y eliminación de productos  
- Sincronización instantánea entre promotores  

### 📷 Escáner Profesional (Google ML Kit)
- Escaneo ultrarrápido  
- Soporte para EAN-13, UPC-A, QR, Data Matrix, Code128 y más  
- Feedback visual, sonido y vibración  
- Modo seguro con doble lectura  
- Disponible en Agregar, Relleno y Auditoría  

### 🔄 Relleno/Reabastecimiento
- Autofill completo por escaneo  
- Validación de stock  
- Movimientos registrados con historial  
- Contador diario  

### ✓ Auditoría Inteligente
- Selección de bodega  
- Stock del sistema visible  
- Autofill al escanear  
- Checkmarks visuales  
- Comparación con diferencias  
- Resumen final  

### 📱 Progressive Web App (PWA)
- Instalación en Android, iOS, Windows, Mac  
- Modo offline completo  
- Service worker con estrategia cache-first  
- Splash screen personalizado  

### ⚙️ Sistema
- Diagnóstico técnico  
- Estado de Firebase  
- Estadísticas del inventario  
- Limpieza de datos locales  

---

## 🛠️ Tecnologías

**Frontend:** HTML5, CSS3, JavaScript ES6+  
**Backend:** Firebase Authentication & Realtime Database  
**APIs:** ML Kit, Service Worker, Notification API  
**DevOps:** Netlify CI/CD, GitHub  

---

## 🌐 Demo en Vivo
🔗 https://aguilainvantario.netlify.app

**Credenciales de prueba:**

Email: demo@aguilapro.com Contraseña: demo123456

---

## 🚀 Instalación Rápida

### Requisitos
- Chrome 90+ o equivalente  
- Proyecto Firebase  
- Git  

### 1. Clonar
```bash
git clone https://github.com/chivas11estar-ui/Aguila-inventario-pro.git
cd Aguila-inventario-pro

2. Crear proyecto en Firebase

3. Configurar firebase-config.js

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project.firebaseio.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();

4. Ejecutar local o desplegar

python -m http.server 8000


---

🔥 Reglas de Seguridad críticas

(Versión validada para multi-tienda con determinantes)

<details>
<summary>Ver reglas</summary>{ ... tus reglas sin cambios ... }

</details>


📁 Estructura del Proyecto

📦 Águila Inventario Pro/
│
├── index.html
├── styles.css
├── custom-styles.css
│
├── firebase-config.js
├── manifest.json
│
├── auth.js
├── app.js
├── ui.js
│
├── inventory.js
├── inventory-enhanced.js
├── refill.js
├── audit.js
├── system.js
│
├── scanner-mlkit.js
├── scanner-events.js
│
├── service-worker.js
├── netlify.toml
│
└── assets/
    ├── icon-192x192.png
    └── icon-512x512.png




📖 Cómo Usar

➕ Agregar Producto

Escanear → Autofill

Seleccionar marca/bodega

Guardar


📦 Inventario

Filtrar por marca

Buscar por código o nombre

Expandir bodegas


🔄 Relleno

Escanear → autofill

Ingresar cajas

Guardar


✓ Auditoría

Seleccionar bodega

Escanear productos

Finalizar y guardar diferencias


⚙️ Sistema

Diagnóstico

Estadísticas

Limpiar datos





🔮 Roadmap

Auditoría visual avanzada

Reportes PDF/Excel

Notificaciones push

Modo oscuro

rol Supervisor





👤 Autor

José A. G. Betancourt
🐙 GitHub: https://github.com/chivas11estar-ui
📧 Email: chivas11estar@gmail.com
🌐 Web: https://aguilapro.com




🙏 Agradecimientos

Google ML Kit

Firebase

Netlify

PepsiCo





  Hecho con ❤️ para promotores que merecen herramientas profesionales

