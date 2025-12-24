# 🦅 Águila Inventario Pro v7.6

> Sistema profesional de gestión de inventario para promotores de tienda, con sincronización en tiempo real, escáner de nivel profesional (Google ML Kit) y soporte PWA con modo offline.

[![Netlify Status](https://api.netlify.com/api/v1/badges/YOUR-BADGE-ID/deploy-status)](https://app.netlify.com/sites/aguilainvantario/deploys)
![Firebase](https://img.shields.io/badge/Firebase-Realtime_DB-orange)
![ML Kit](https://img.shields.io/badge/Google-ML_Kit-red)
![PWA](https://img.shields.io/badge/PWA-Instalable_%2B_Offline-blueviolet)
[![License](https://img.shields.io/badge/license-Proprietary-red.svg)](LICENSE)

---

## 📋 Tabla de Contenidos

- [Características](#-características)
- [Tecnologías](#-tecnologías)
- [Demo en Vivo](#-demo-en-vivo)
- [Instalación Rápida](#-instalación-rápida)
- [Configuración de Firebase](#-configuración-de-firebase)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Estructura de Datos](#-estructura-de-datos)
- [Cómo Usar](#-cómo-usar)
- [Roadmap](#-roadmap)
- [Autor](#-autor)

---

## ✨ Características

### 🔐 Autenticación Segura
- **Login/Registro** con Firebase Authentication
- **Recuperación de contraseña** por email
- **Sistema de determinantes** (ID único de tienda para multi-usuario)
- **Sesiones persistentes** en el dispositivo

### 📦 Inventario Multi-Tienda
- **Visualización por marca** (Sabritas, Gamesa, Quaker, Sonric's)
- **Búsqueda en tiempo real** por nombre, código o marca
- **Agrupación inteligente por bodega** (mismo producto en múltiples ubicaciones)
- **Alertas de caducidad automáticas** personalizadas por marca
- **Edición y eliminación** de productos
- **Sincronización en tiempo real** entre múltiples promotores de la misma tienda

### 📷 Escáner Profesional (Google ML Kit)
- **Detección de alta velocidad** usando BarcodeDetector API
- **Múltiples formatos soportados:** EAN-13, EAN-8, UPC-A, UPC-E, Code 128, Code 39, QR, Data Matrix
- **Feedback inmediato:** Visual (verde ✓), sonoro (beep) y háptico (vibración)
- **Confirmación de doble lectura** para mayor precisión
- **Funciona en:** Agregar Producto, Relleno, Auditoría

### 🔄 Relleno/Reabastecimiento Optimizado
- **Escaneo con autofill automático** (nombre, marca, piezas/caja se rellenan automáticamente)
- **Búsqueda manual** por código de barras
- **Validación de stock** disponible
- **Actualización automática** del inventario
- **Historial de movimientos** con timestamp
- **Contador diario** de movimientos realizados

### ✓ Auditoría Inteligente
- **Selección de bodega** a auditar
- **Lista de productos esperados** en esa bodega
- **Escaneo con autofill** (campos pre-rellenados)
- **Muestra stock del sistema** en banner destacado
- **Checkmark visual** (✓ verde) al completar cada producto
- **Historial en tiempo real** durante la auditoría
- **Detección automática de diferencias** (faltantes/sobrantes)
- **Resumen final** con estadísticas

### 📱 Progressive Web App (PWA) + Offline
- **Instalable** en Android, iOS, Windows, macOS
- **Funciona sin internet** gracias a Service Worker (Cache-First)
- **Carga rápida** incluso sin conexión
- **Sincronización automática** cuando vuelve la conexión
- **Splash screen personalizado** al abrir la app

### ⚙️ Sistema y Diagnóstico
- **Información del usuario** y tienda asignada
- **Estado de Firebase** en tiempo real
- **Diagnóstico técnico** del dispositivo
- **Estadísticas de inventario** y movimientos
- **Limpiar datos locales** cuando sea necesario

---

## 🛠️ Tecnologías

### Frontend
- **HTML5** - Estructura semántica
- **CSS3** - Variables CSS, Flexbox, Grid, Media Queries
- **JavaScript ES6+** - Modular, async/await, Fetch API

### Backend & Base de Datos
- **Firebase Authentication** - Autenticación segura
- **Firebase Realtime Database** - Sincronización en tiempo real

### APIs & Librerías
- **Google ML Kit (BarcodeDetector)** - Escáner de códigos
- **Firebase SDK v9 (Compat)** - Inicialización de Firebase
- **Service Worker API** - PWA offline
- **Notification API** - Alertas y toasts

### DevOps
- **Netlify** - Hosting + CI/CD automático
- **GitHub** - Control de versiones

---

## 🌐 Demo en Vivo

🔗 **URL:** [https://aguilainvantario.netlify.app](https://aguilainvantario.netlify.app)

**Credenciales de Prueba:**
```
📧 Email: demo@aguilapro.com
🔑 Contraseña: demo123456
```

---

## 🚀 Instalación Rápida

### Requisitos Previos
- Navegador moderno (Chrome 90+, Edge, Safari, Samsung Internet)
- Cuenta de Firebase
- Git

### Pasos

#### 1. Clonar el Repositorio
```bash
git clone https://github.com/chivas11estar-ui/Aguila-inventario-pro.git
cd Aguila-inventario-pro
```

#### 2. Crear Proyecto Firebase
- Ve a [Firebase Console](https://console.firebase.google.com)
- Crear nuevo proyecto
- Habilitar **Authentication** (Email/Password)
- Habilitar **Realtime Database**
- Obtener credenciales Web

#### 3. Configurar Firebase (ver sección siguiente)

#### 4. Desplegar
```bash
# Opción A: Deploy local para testing
python -m http.server 8000
# Abrir: http://localhost:8000

# Opción B: Deploy en Netlify
# Conectar repositorio a Netlify para CI/CD automático
```

---

## 🔥 Configuración de Firebase

### 1. Archivo `firebase-config.js`

Reemplaza el archivo con tus credenciales:

```javascript
// firebase-config.js
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project.firebaseio.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();
```

### 2. Reglas de Seguridad (Realtime Database)

**CRÍTICO:** Estas reglas implementan seguridad multi-tienda.

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    
    "usuarios": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid",
        ".validate": "newData.hasChildren(['email', 'determinante'])"
      }
    },
    
    "inventario": {
      "$determinante": {
        ".read": "root.child('usuarios').child(auth.uid).child('determinante').val() === $determinante",
        ".write": "root.child('usuarios').child(auth.uid).child('determinante').val() === $determinante",
        ".indexOn": ["codigoBarras", "ubicacion", "nombre"],
        "$productoId": {
          ".validate": "newData.hasChildren(['nombre', 'codigoBarras', 'marca', 'cajas', 'ubicacion'])"
        }
      }
    },
    
    "movimientos": {
      "$determinante": {
        ".read": "root.child('usuarios').child(auth.uid).child('determinante').val() === $determinante",
        ".write": "root.child('usuarios').child(auth.uid).child('determinante').val() === $determinante",
        ".indexOn": ["fecha", "tipo", "productoId"]
      }
    },
    
    "auditorias": {
      "$determinante": {
        ".read": "root.child('usuarios').child(auth.uid).child('determinante').val() === $determinante",
        ".write": "root.child('usuarios').child(auth.uid).child('determinante').val() === $determinante",
        ".indexOn": ["fecha", "bodega", "productoId"]
      }
    },
    
    "auditorias_completadas": {
      "$determinante": {
        ".read": "root.child('usuarios').child(auth.uid).child('determinante').val() === $determinante",
        ".write": "root.child('usuarios').child(auth.uid).child('determinante').val() === $determinante",
        ".indexOn": ["fechaFin", "bodega", "estado"]
      }
    }
  }
}
```

---

## 📁 Estructura del Proyecto

```
📦 Águila Inventario Pro/
│
├── 📄 index.html              # App Shell (HTML principal)
├── 🎨 styles.css              # Estilos base y layout
├── 🎨 custom-styles.css       # Estilos avanzados (bodegas, autofill)
│
├── 🔧 CONFIGURACIÓN
│   ├── firebase-config.js     # Credenciales e inicialización
│   └── manifest.json          # PWA Manifest
│
├── 🔐 AUTENTICACIÓN
│   └── auth.js                # Login, Registro, Recuperar contraseña
│
├── 💻 LÓGICA PRINCIPAL
│   ├── app.js                 # Controlador principal
│   └── ui.js                  # Utilidades de UI (Toasts, Modales)
│
├── 📦 MÓDULOS DE NEGOCIO
│   ├── inventory.js           # Cargar, agregar, editar inventario
│   ├── inventory-enhanced.js  # Buscador, desplegables, agrupación
│   ├── refill.js              # Relleno/Movimientos con autofill
│   ├── audit.js               # Auditoría inteligente
│   └── system.js              # Sistema y diagnóstico
│
├── 📷 ESCÁNER
│   ├── scanner-mlkit.js       # Lógica del escáner (ML Kit)
│   └── scanner-events.js      # Eventos de botones de escáner
│
├── ⚙️ PWA
│   └── service-worker.js      # Cache offline y sincronización
│
├── 🚀 DESPLIEGUE
│   └── netlify.toml           # Configuración de Netlify
│
└── 📚 ASSETS
    ├── icon-192x192.png       # Ícono PWA 192x192
    └── icon-512x512.png       # Ícono PWA 512x512
```

---

## 🔩 Estructura de Datos

### `usuarios/{uid}`
Perfil del promotor asignado a una tienda.

```json
{
  "email": "jose@empresa.com",
  "nombrePromotor": "José Betancourt",
  "nombreTienda": "Oxxo Centro",
  "determinante": "12345",
  "fechaRegistro": "2025-11-08T10:30:00.000Z"
}
```

### `inventario/{determinante}/{productId}`
Productos de la tienda, compartidos por todos los promotores con ese determinante.

```json
{
  "codigoBarras": "7501234567890",
  "nombre": "Pepsi 1L",
  "marca": "Sabritas",
  "piezasPorCaja": 24,
  "ubicacion": "Almacén 1",
  "fechaCaducidad": "2025-12-31",
  "cajas": 10,
  "fechaActualizacion": "2025-11-08T15:30:00.000Z"
}
```

### `movimientos/{determinante}/{movementId}`
Historial de rellenos y ajustes.

```json
{
  "tipo": "relleno",
  "productoId": "-Nq...abc",
  "productoNombre": "Pepsi 1L",
  "productoCodigo": "7501234567890",
  "marca": "Sabritas",
  "cajasMovidas": 3,
  "stockAnterior": 10,
  "stockNuevo": 7,
  "ubicacion": "Almacén 1",
  "fecha": "2025-11-08T18:30:00.000Z",
  "realizadoPor": "jose@empresa.com"
}
```

### `auditorias/{determinante}/{auditId}`
Auditorías individuales por producto.

```json
{
  "productoId": "-Nq...abc",
  "productoNombre": "Pepsi 1L",
  "productoCodigo": "7501234567890",
  "marca": "Sabritas",
  "bodega": "Almacén 1",
  "stockRegistrado": 10,
  "stockContado": 9,
  "diferencia": -1,
  "fecha": "2025-11-08T20:00:00.000Z",
  "auditor": "jose@empresa.com"
}
```

### `auditorias_completadas/{determinante}/{sessionId}`
Auditoría completa de una bodega.

```json
{
  "bodega": "Almacén 1",
  "fechaInicio": "2025-11-08T19:00:00.000Z",
  "fechaFin": "2025-11-08T21:00:00.000Z",
  "auditor": "jose@empresa.com",
  "productosAuditados": 25,
  "totalCajas": 120,
  "diferenciasEncontradas": 3,
  "estado": "completada"
}
```

---

## 📖 Cómo Usar

### 1. Agregar Producto
1. Ir a pestaña **➕ Agregar**
2. Escanear código (o escribir manualmente)
3. Completar información
4. Seleccionar marca y bodega
5. Guardar

### 2. Ver Inventario
1. Ir a pestaña **📦 Inventario**
2. Filtrar por marca (click en nombre)
3. Expandir bodega para ver detalles
4. Buscar por nombre o código

### 3. Registrar Relleno
1. Ir a pestaña **🔄 Relleno**
2. Escanear producto (autofill automático)
3. Ingresar cantidad de cajas a mover
4. Guardar

### 4. Auditar Bodega
1. Ir a pestaña **✓ Auditoría**
2. Seleccionar bodega
3. Escanear productos
4. Ingresar cantidad contada
5. Ver checkmarks (✓) al completar
6. Finalizar para aplicar cambios

### 5. Ver Estadísticas
1. Ir a pestaña **⚙️ Sistema**
2. Click en "📊 Estadísticas"
3. Ver movimientos, auditorías, etc.

---

## 🔮 Roadmap

### v7.7 - Auditoría Mejorada
- [ ] Lista visual de productos esperados en bodega
- [ ] Resumen antes de finalizar con confirmaciones
- [ ] Productos "no encontrados" → opción de poner en 0
- [ ] Búsqueda de productos en otras bodegas

### v8.0 - Reportes & Analytics
- [ ] Exportar inventario a Excel/PDF
- [ ] Gráficas de movimientos por día/semana/mes
- [ ] Top 10 productos más movidos
- [ ] Alertas de stock bajo

### v8.1 - Notificaciones
- [ ] Notificaciones push de caducidad
- [ ] Recordatorios de auditoría
- [ ] Alertas de stock crítico

### v8.2 - Funciones Avanzadas
- [ ] Modo oscuro
- [ ] Historial de cambios por producto
- [ ] Chat interno por tienda
- [ ] Rol de supervisor (ver múltiples tiendas)

---

## 📞 Soporte

Si encuentras problemas:

1. Revisa la consola del navegador (F12 → Console)
2. Verifica la conexión a Firebase (⚙️ Sistema → Diagnóstico)
3. Abre un issue en [GitHub](https://github.com/chivas11estar-ui/Aguila-inventario-pro/issues)
4. Contacta al autor

---

## 📄 Licencia

Proprietario © 2025 José A. G. Betancourt. Todos los derechos reservados.

```
Se prohíbe la reproducción, distribución o modificación sin 
autorización expresa del autor. Para licencias comerciales o 
permisos especiales, contacta al autor.
```

---

## 👤 Autor

**José A. G. Betancourt**

- 🐙 GitHub: [@chivas11estar-ui](https://github.com/chivas11estar-ui)
- 📧 Email: chivas11estar@gmail.com
- 🌐 Website: [aguilapro.com](https://aguilapro.com)

---

## 🙏 Agradecimientos

- **Google ML Kit** por el escáner de códigos
- **Firebase** por la infraestructura backend
- **Netlify** por el hosting
- **PepsiCo** por la inspiración

---

<div align="center">

**Hecho con ❤️ para promotores que merecen herramientas profesionales**

[⬆ Volver arriba](#-águila-inventario-pro-v76)

</div>