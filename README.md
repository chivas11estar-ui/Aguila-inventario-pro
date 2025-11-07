# 🦅 Águila Inventario Pro v7.1

> Sistema profesional de gestión de inventario para promotores de PepsiCo con sincronización en tiempo real y modo offline.

[![Netlify Status](https://api.netlify.com/api/v1/badges/YOUR-BADGE-ID/deploy-status)](https://app.netlify.com/sites/aguilainvantario/deploys)
[![License](https://img.shields.io/badge/license-Proprietary-red.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-7.1-blue.svg)](https://github.com/chivas11estar-ui/Aguila-inventario-pro)

---

## 📋 Tabla de Contenidos

- [Características](#-características)
- [Demo en Vivo](#-demo-en-vivo)
- [Capturas de Pantalla](#-capturas-de-pantalla)
- [Tecnologías](#-tecnologías)
- [Instalación](#-instalación)
- [Uso](#-uso)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Configuración de Firebase](#-configuración-de-firebase)
- [Despliegue](#-despliegue)
- [Contribuir](#-contribuir)
- [Licencia](#-licencia)
- [Autor](#-autor)

---

## ✨ Características

### 🔐 Autenticación Segura
- Login con email y contraseña
- Registro de nuevos usuarios
- Recuperación de contraseña
- Sesiones persistentes
- Cierre de sesión seguro

### 📦 Gestión de Inventario
- ✅ **Agregar productos** con código de barras
- ✅ **Búsqueda inteligente** por nombre, marca o código
- ✅ **Filtros por marca** con contadores en tiempo real
- ✅ **Editar y eliminar** productos
- ✅ **Alertas de caducidad** automáticas
- ✅ **Control de stock** bajo y sin stock

### 📷 Escáner de Códigos de Barras
- Escáner integrado con cámara
- Soporte para múltiples formatos:
  - EAN-13, EAN-8
  - UPC-A, UPC-E
  - Code 128, Code 39
- Búsqueda instantánea al escanear

### 🔄 Movimientos de Stock (Relleno)
- Registro de movimientos del almacén al piso
- Validación de stock disponible
- Actualización automática del inventario
- Historial de movimientos

### 📊 Auditoría Rápida
- Selección de bodega a auditar
- Conteo físico vs sistema
- Detección de diferencias
- Historial de conteos del día
- Contador total de cajas auditadas

### 📈 Dashboard con Estadísticas
- Total de productos únicos
- Total de cajas en inventario
- Movimientos del día
- Productos próximos a vencer (30 días)
- Actualización en tiempo real

### 🌐 Sincronización en Tiempo Real
- Sincronización automática con Firebase
- Múltiples dispositivos conectados
- Sin pérdida de datos
- Detección de conexión online/offline

### 🔧 Sistema y Diagnóstico
- Estado de conexión en tiempo real
- Diagnóstico completo de Firebase
- Estadísticas del inventario
- Limpieza de datos locales
- Información del dispositivo

### 📱 Progressive Web App (PWA)
- Instalable en cualquier dispositivo
- Funciona como app nativa
- Íconos y splash screens personalizados
- Soporte offline (próximamente)

---

## 🌐 Demo en Vivo

🔗 **URL:** [https://aguilainvantario.netlify.app](https://aguilainvantario.netlify.app)

### Credenciales de Prueba
```
Email: demo@aguilapro.com
Contraseña: demo123456
```

---

## 📸 Capturas de Pantalla

### Login y Dashboard
![Login](docs/screenshots/login.png)
![Dashboard](docs/screenshots/dashboard.png)

### Inventario y Búsqueda
![Inventario](docs/screenshots/inventario.png)
![Búsqueda](docs/screenshots/busqueda.png)

### Auditoría y Relleno
![Auditoría](docs/screenshots/auditoria.png)
![Relleno](docs/screenshots/relleno.png)

---

## 🛠️ Tecnologías

### Frontend
- **HTML5** - Estructura semántica
- **CSS3** - Estilos modernos con variables CSS
- **JavaScript (ES6+)** - Lógica de la aplicación
- **Progressive Web App** - Instalable en dispositivos

### Backend / Base de Datos
- **Firebase Authentication** - Autenticación de usuarios
- **Firebase Realtime Database** - Base de datos en tiempo real
- **Firebase Hosting** - Opcional para despliegue

### Librerías
- **QuaggaJS** - Escáner de códigos de barras
- **Firebase SDK 9.22.0** - SDKs de Firebase (Compat)

### Despliegue
- **Netlify** - Hosting y CI/CD automático
- **Git/GitHub** - Control de versiones

---

## 🚀 Instalación

### Requisitos Previos
- Node.js 14+ (opcional, solo para desarrollo local)
- Cuenta de Firebase
- Cuenta de Netlify (o cualquier hosting estático)
- Git

### Clonar el Repositorio

```bash
git clone https://github.com/chivas11estar-ui/Aguila-inventario-pro.git
cd Aguila-inventario-pro
```

### Configurar Firebase

1. **Crear proyecto en Firebase:**
   - Ve a [Firebase Console](https://console.firebase.google.com/)
   - Crea un nuevo proyecto
   - Habilita **Authentication** (Email/Password)
   - Habilita **Realtime Database**

2. **Obtener credenciales:**
   - Ve a Configuración del proyecto → General
   - En "Tus apps" → Web
   - Copia las credenciales

3. **Configurar `firebase-config.js`:**

```javascript
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "tu-proyecto.firebaseapp.com",
  databaseURL: "https://tu-proyecto.firebaseio.com",
  projectId: "tu-proyecto",
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

### Configurar Reglas de Firebase

**Authentication Rules:**
```javascript
// Solo usuarios autenticados
```

**Realtime Database Rules:**
```json
{
  "rules": {
    "usuarios": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    },
    "inventario": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    },
    "movimientos": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    },
    "auditorias": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    }
  }
}
```

---

## 💻 Uso

### Desarrollo Local

#### Opción 1: Servidor Simple (Python)
```bash
# Python 3
python -m http.server 8000

# Abrir en navegador
open http://localhost:8000
```

#### Opción 2: Live Server (VS Code)
1. Instala la extensión "Live Server"
2. Click derecho en `index.html`
3. Selecciona "Open with Live Server"

### Uso de la Aplicación

#### 1. **Registro/Login**
- Abre la aplicación
- Regístrate con email, contraseña y datos de la tienda
- O inicia sesión si ya tienes cuenta

#### 2. **Agregar Productos**
- Ve a la pestaña "Agregar"
- Escanea o escribe el código de barras
- Completa los datos del producto
- Guarda

#### 3. **Ver Inventario**
- Ve a la pestaña "Inventario"
- Usa la búsqueda para encontrar productos
- Filtra por marca
- Edita o elimina productos

#### 4. **Registrar Movimientos (Relleno)**
- Ve a la pestaña "Relleno"
- Escanea el producto
- Ingresa cantidad de cajas a mover
- Registra el movimiento

#### 5. **Realizar Auditoría**
- Ve a la pestaña "Auditar"
- Selecciona la bodega
- Escanea productos
- Registra el conteo físico
- Revisa diferencias

#### 6. **Ver Estadísticas**
- Dashboard muestra resumen general
- Sistema → Estadísticas para detalles
- Sistema → Diagnóstico para estado técnico

---

## 📁 Estructura del Proyecto

```
Aguila-inventario-pro/
├── index.html              # Página principal
├── styles.css              # Estilos de la aplicación
├── firebase-config.js      # Configuración de Firebase
├── auth.js                 # Autenticación
├── ui.js                   # Interfaz de usuario
├── inventory.js            # Gestión de inventario
├── refill.js               # Movimientos de stock
├── audit.js                # Auditorías
├── system.js               # Sistema y diagnóstico
├── app.js                  # Inicializador principal
├── manifest.json           # PWA Manifest
├── service-worker.js       # Service Worker (offline)
├── netlify.toml            # Configuración de Netlify
├── icon-192x192.png        # Ícono PWA 192x192
├── icon-512x512.png        # Ícono PWA 512x512
└── README.md               # Este archivo
```

---

## 🔥 Configuración de Firebase

### Estructura de Datos

#### `usuarios/{uid}`
```json
{
  "email": "usuario@ejemplo.com",
  "nombrePromotor": "Juan Pérez",
  "nombreTienda": "Oxxo Centro",
  "determinante": "12345",
  "fechaRegistro": "2025-01-15T10:30:00.000Z"
}
```

#### `inventario/{uid}/{productId}`
```json
{
  "codigoBarras": "7501234567890",
  "nombre": "Papas Sabritas 50g",
  "marca": "Sabritas",
  "piezasPorCaja": 24,
  "ubicacion": "Almacén 1",
  "fechaCaducidad": "2025-12-31",
  "cajas": 10,
  "fechaCreacion": "2025-01-15T10:30:00.000Z",
  "fechaActualizacion": "2025-01-15T10:30:00.000Z"
}
```

#### `movimientos/{uid}/{movementId}`
```json
{
  "tipo": "relleno",
  "productoId": "abc123",
  "productoNombre": "Papas Sabritas 50g",
  "cantidad": 3,
  "stockAnterior": 10,
  "stockNuevo": 7,
  "fecha": "2025-01-15T10:30:00.000Z"
}
```

#### `auditorias/{uid}/{auditId}`
```json
{
  "productoId": "abc123",
  "productoNombre": "Papas Sabritas 50g",
  "productoCodigo": "7501234567890",
  "marca": "Sabritas",
  "bodega": "Almacén 1",
  "stockRegistrado": 10,
  "stockContado": 9,
  "diferencia": -1,
  "fecha": "2025-01-15T10:30:00.000Z",
  "auditor": "usuario@ejemplo.com"
}
```

---

## 🚢 Despliegue

### Despliegue en Netlify

#### Método 1: Desde GitHub (Recomendado)

1. **Push a GitHub:**
```bash
git add .
git commit -m "Initial commit"
git push origin main
```

2. **Conectar con Netlify:**
   - Ve a [Netlify](https://netlify.com)
   - "New site from Git"
   - Selecciona tu repositorio
   - Build settings (dejar vacío para sitio estático)
   - Deploy!

3. **Configurar Dominio (Opcional):**
   - Site settings → Domain management
   - Add custom domain

#### Método 2: Deploy Manual

```bash
# Instalar Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Deploy
netlify deploy --prod
```

### Despliegue en Otros Servicios

#### Vercel
```bash
npm install -g vercel
vercel
```

#### GitHub Pages
```bash
# En Settings → Pages
# Source: main branch / root
```

---

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add: Amazing Feature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

### Estándares de Código
- Comentarios en español
- Nombres de variables descriptivos
- Console.logs para debugging
- Manejo de errores con try/catch

---

## 📝 Licencia

Este proyecto es **software propietario** y está protegido por derechos de autor.

```
Copyright © 2025 José A. G. Betancourt
Todos los derechos reservados.

Queda prohibida la reproducción, distribución o modificación
sin autorización expresa del autor.
```

Para solicitar licencias comerciales o permisos especiales:
- 📧 Email: jose.betancourt@aguilapro.com

---

## 👤 Autor

**José A. G. Betancourt**

- 🌐 Website: [aguilapro.com](https://aguilapro.com)
- 💼 LinkedIn: [José Betancourt](https://linkedin.com/in/josebetancourt)
- 🐙 GitHub: [@chivas11estar-ui](https://github.com/chivas11estar-ui)
- 📧 Email: chivas11estar@gmail.com

---

## 🙏 Agradecimientos

- **Firebase** por la infraestructura backend
- **QuaggaJS** por el escáner de códigos de barras
- **Netlify** por el hosting gratuito
- **PepsiCo** por la inspiración del proyecto

---

## 📊 Estadísticas del Proyecto

- **Versión:** 7.0
- **Líneas de Código:** ~2,500+
- **Archivos:** 14
- **Última Actualización:** octubre 2025

---

## 🔮 Roadmap

### Próximas Funcionalidades
- [ ] Modo offline completo con Service Worker
- [ ] Exportar inventario a Excel
- [ ] Generar reportes PDF
- [ ] Compartir por WhatsApp
- [ ] Gráficas de movimientos
- [ ] Historial de cambios
- [ ] Multi-tienda (para supervisores)
- [ ] Notificaciones push
- [ ] Dark mode

---

## ❓ FAQ (Preguntas Frecuentes)

### ¿La app funciona sin internet?
Actualmente no, pero estamos trabajando en modo offline para v7.1.

### ¿Puedo usar la app en múltiples dispositivos?
Sí, los datos se sincronizan automáticamente entre dispositivos.

### ¿Es gratis?
Sí para uso individual. Para licencias comerciales contacta al autor.

### ¿Cómo reporto un bug?
Abre un issue en GitHub con descripción detallada y capturas.

---

## 📞 Soporte

Si necesitas ayuda:

1. Revisa la documentación
2. Busca en [Issues](https://github.com/chivas11estar-ui/Aguila-inventario-pro/issues)
3. Abre un nuevo Issue
4. Contacta al autor por email

---

<div align="center">

**Hecho con ❤️ por José A. G. Betancourt**

[⬆ Volver arriba](#-águila-inventario-pro-v70)


</div>
