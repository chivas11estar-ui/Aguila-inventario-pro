🦅 Águila Inventario Pro v8.0
============================

> Sistema profesional de gestión de inventario para promotores de tienda, con sincronización en tiempo real, escáner avanzado (Google ML Kit) y soporte PWA con modo offline.

[![Netlify Status](https://api.netlify.com/api/v1/badges/YOUR-BADGE-ID/deploy-status)](https://app.netlify.com/sites/aguilainvantario/deploys)
![Firebase](https://img.shields.io/badge/Firebase-Realtime_DB-orange)
![ML Kit](https://img.shields.io/badge/Google-ML_Kit-red)
![PWA](https://img.shields.io/badge/PWA-Instalable_%2B_Offline-blueviolet)
![Security](https://img.shields.io/badge/Security-v1.0_Rules-brightgreen)
![License](https://img.shields.io/badge/license-Proprietary-red)

---

## 📋 Tabla de Contenidos

- [Características](#características)
- [Tecnologías](#tecnologías)
- [🔒 SEGURIDAD CRÍTICA](#-seguridad-crítica)
- [Demo en Vivo](#demo-en-vivo)
- [Instalación Rápida](#instalación-rápida)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Cómo Usar](#cómo-usar)
- [Roadmap](#roadmap)
- [Autor](#autor)

---

## ✨ Características

### 🔐 Autenticación Segura
- ✅ Login/registro con Firebase Authentication
- ✅ Recuperación de contraseña vía email
- ✅ Sistema de determinantes (tiendas multi-usuario)
- ✅ Validación de determinante: 4-8 caracteres alfanuméricos
- ✅ Sesiones persistentes con logout seguro

### 📦 Inventario Multi-Tienda
- ✅ Vista por marcas (Sabritas, Gamesa, Quaker, Sonric's)
- ✅ Búsqueda en tiempo real por nombre, código o marca
- ✅ Agrupación inteligente por bodega
- ✅ Alertas de caducidad automáticas
- ✅ Edición y actualización de productos
- ✅ Sincronización instantánea entre promotores

### 📷 Escáner Profesional (Google ML Kit)
- ✅ Escaneo ultrarrápido (<300ms)
- ✅ Soporte para EAN-13 (con validación de checksum), UPC-A, QR, Data Matrix, Code128 y más
- ✅ Feedback visual, sonido y vibración
- ✅ Modo seguro con doble lectura
- ✅ Disponible en Agregar, Relleno y Auditoría

### 🔄 Relleno/Reabastecimiento
- ✅ Autofill completo por escaneo
- ✅ Validación de stock (anti-negativos)
- ✅ Movimientos registrados con historial
- ✅ Contador diario de cajas movidas
- ✅ Modo entrada y salida inteligente

### ✓ Auditoría Inteligente
- ✅ Selección de bodega
- ✅ Stock del sistema visible para comparación
- ✅ Autofill al escanear
- ✅ Checkmarks visuales
- ✅ Comparación automática con diferencias
- ✅ Resumen final con reporte

### 📱 Progressive Web App (PWA)
- ✅ Instalación en Android, iOS, Windows, Mac
- ✅ Modo offline completo (datos cacheados)
- ✅ Service worker con estrategia cache-first
- ✅ Splash screen personalizado

### ⚙️ Sistema
- ✅ Diagnóstico técnico
- ✅ Estado de Firebase
- ✅ Estadísticas del inventario
- ✅ Limpieza de datos locales

---

## 🔒 SEGURIDAD CRÍTICA

### ⚠️ FASE 1: Implementación Obligatoria

APP AGUILA incluye **reglas de seguridad de Firebase (security-rules.json)** que DEBEN deployarse INMEDIATAMENTE.

#### ¿Qué protegen las reglas?

1. **Aislamiento de datos por tienda**
   - Usuario A NO puede ver datos de Usuario B
   - Cada determinante solo es accesible por su propietario

2. **Validación de stock**
   - Stock NUNCA puede ser negativo (bloqueado en DB)
   - Transacciones atómicas (lectura + escritura garantizada)

3. **Validación de códigos de barras**
   - Longitud: 8-14 caracteres
   - Checksum EAN-13 validado en cliente (prevenible)
   - Formato: Caracteres numéricos solo

4. **Validación de determinante**
   - Formato: 4-8 caracteres alfanuméricos MAYÚSCULAS
   - Sin espacios, caracteres especiales
   - Validado en login y registro

### 🚨 CÓMO DEPLOYAR RULES (URGENTE)

#### Opción 1: Firebase Console Web (Sin CLI)
```
1. Ir a: https://console.firebase.google.com
2. Seleccionar proyecto: "promosentry"
3. Realtime Database → Pestaña "Rules"
4. Copiar TODO el contenido de: security-rules.json
5. Pegar en el editor de Rules
6. Hacer CLICK EN "PUBLISH"
```

#### Opción 2: Firebase CLI (Si tienes instalado)
```bash
firebase login
cd "/ruta/al/proyecto"
firebase deploy --only database:rules
```

### 🔍 TESTING DE SEGURIDAD (Obligatorio)

Después de deployar rules, verificar:

**Test 1: Aislamiento de datos**
- Crear 2 usuarios: user1@test.com (TIENDA1) y user2@test.com (TIENDA2)
- Login como user1 → Intentar acceder `/productos/TIENDA2`
- ❌ Resultado esperado: "Access Denied"

**Test 2: Anti-negativos**
- Login como cualquier usuario
- Intentar guardar stock = -5 en un producto
- ❌ Resultado esperado: "Validation Failed"

**Test 3: Determinante válido**
- Login como user1
- Crear producto en `/productos/TIENDA1` con stock válido
- ✅ Resultado esperado: Guardado exitoso

**Test 4: Checksum EAN-13**
- Escanear código EAN-13 falso (número inventado)
- ❌ Resultado esperado: Rechazado con mensaje "Checksum inválido"

### 🔑 Gestión de API Keys

⚠️ **Las API Keys de Firebase están públicas en el cliente** (esto es normal y se mitigaesta con Firebase Rules).

**Mitigación:**
- ✅ Usar reglas de seguridad restrictivas (hecho)
- ✅ No guardar datos sensibles sin protección
- ✅ Habilitar Cloud Logging en Firebase Console para detectar abusos
- ✅ Monitorear accesos anómalos en Firebase Console

---

## 🛠️ Tecnologías

| Capa | Tecnología |
|------|-----------|
| **Frontend** | HTML5, CSS3, JavaScript ES6+ |
| **UI Framework** | Tailwind CSS 4.1.18 |
| **Gráficos** | Chart.js 4.4.1 |
| **Backend** | Firebase Auth + Realtime Database |
| **Scanning** | Google ML Kit Vision API |
| **PWA** | Service Worker API |
| **Hosting** | Netlify CI/CD |

---

## 🌐 Demo en Vivo

🔗 https://aguilainvantario.netlify.app

**Credenciales de prueba:**

```
Email: demo@aguilapro.com
Contraseña: demo123456
Tienda: DEMO1
```

---

## 🚀 Instalación Rápida

### Requisitos
- Chrome 90+, Firefox 88+, Safari 15+, Edge 90+
- Proyecto Firebase (gratuito funciona)
- Git

### 1. Clonar Repositorio

```bash
git clone https://github.com/chivas11estar-ui/Aguila-inventario-pro.git
cd Aguila-inventario-pro
```

### 2. Crear Proyecto Firebase

1. Ir a https://firebase.google.com
2. Click "Crear Proyecto"
3. Nombre: "Águila Inventario"
4. Ubicación: Tu región
5. Crear

### 3. Configurar firebase-config.js

1. En Firebase Console → Proyecto Settings
2. Copiar credenciales (apiKey, authDomain, projectId, etc)
3. Actualizar `firebase-config.js` con tus credenciales
4. **NO COMMITEAR** el archivo con keys reales a GitHub público

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project.firebaseio.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 4. Deployar Firebase Rules

🔴 **CRÍTICO:** Ver sección [SEGURIDAD CRÍTICA](#-seguridad-crítica) arriba.

### 5. Ejecutar Local

```bash
# Opción A: Python
python -m http.server 8000

# Opción B: Node.js (http-server)
npx http-server

# Opción C: Live Server (VS Code extension)
Right-click → Open with Live Server
```

Luego ir a: http://localhost:8000

### 6. Deployar a Producción

```bash
# Opción A: Netlify (recomendado)
npm install -g netlify-cli
netlify login
netlify deploy --prod

# Opción B: GitHub Pages
git push origin main
```

---

## 📁 Estructura del Proyecto

```
📦 Águila Inventario Pro/
│
├── 📄 index.html                # App shell principal
├── 📄 manifest.json             # PWA manifest
├── 🔒 security-rules.json       # Reglas Firebase CRÍTICAS
│
├── 🎨 Estilos
│   ├── styles.css
│   ├── custom-styles.css
│   ├── tailwind-built.css
│   └── tailwind.config.js
│
├── ⚙️ Configuración
│   ├── firebase-config.js       # Configuración Firebase (con Rules)
│   ├── package.json
│   └── netlify.toml
│
├── 🔐 Autenticación
│   └── auth.js                  # Login, Register, Password Recovery
│
├── 📦 Inventario (Core)
│   ├── inventory-core.js        # Lógica por código de barras (v2)
│   ├── inventory.js             # Renderizado e indexación
│   └── inventory-ui.js          # Componentes UI
│
├── 🔄 Operaciones
│   ├── refill-safe.js           # Entrada/Salida de stock
│   ├── audit.js                 # Auditoría física
│   └── system.js                # Diagnósticos
│
├── 📷 Escáner
│   ├── scanner-mlkit.js         # Google ML Kit integration
│   └── scanner-events.js        # Eventos y callbacks
│
├── 📊 Analytics
│   ├── analytics.js             # Cálculos de reportes
│   └── analytics-ui.js          # Dashboards
│
├── 👤 Usuario
│   ├── profile.js               # Perfil de usuario
│   ├── profile-ui.js            # UI de perfil
│   └── phrases.js               # Frases motivacionales
│
├── 🛠️ Utilidades
│   ├── ui.js                    # Toast, modales, UI base
│   ├── date-utils.js            # Manejo de fechas
│   ├── system-events.js         # Eventos del sistema
│   └── weather.js               # Información de clima
│
├── 📱 PWA
│   └── service-worker.js        # Caching offline
│
└── 🖼️ Assets
    ├── icon-192x192.png
    └── icon-512x512.png
```

---

## 📖 Cómo Usar

### ➕ Agregar Producto

1. **Ir a tab "Añadir"**
2. **Escanear código de barras** (📷 botón)
   - O escribir manualmente si no hay cámara
3. **Llenar datos:**
   - Nombre: "Pepsi 1L"
   - Marca: "Pepsi"
   - Piezas/caja: 24
   - Ubicación: "Almacén 1"
   - Caducidad: Fecha
   - Cantidad: # de cajas
4. **Guardar** ✅

### 📦 Ver Inventario

1. **Ir a tab "Stock"**
2. **Filtrar por marca** (opcional)
3. **Buscar** por nombre o código
4. **Expandir bodega** para ver detalles
5. **Editar** haciendo click en el producto

### 🔄 Rellenar (Reabastecimiento)

1. **Ir a tab "Rellenar"**
2. **Elegir modo:**
   - "Salida" = llenar exhibidor (restar stock)
   - "Entrada" = agregar stock
3. **Escanear producto** (📷 botón)
4. **Escribir cantidad** de cajas
5. **Guardar** ✅

### ✓ Auditoría

1. **Ir a tab "Auditar"**
2. **Escribir bodega** a auditar (ej: "Almacén 1")
3. **Hacer click ✓** para confirmar
4. **Escanear productos** y contar físicamente
5. **Escribir cantidad contada**
6. **Guardar** cada conteo
7. **Finalizar auditoría** 🏁

### 📊 Ver Reportes

1. **Ir a tab "Datos"**
2. **Ver gráficos:**
   - Cajas movidas hoy
   - Productos más vendidos
   - Marcas líderes
3. **Descargar reportes** (próximo update)

### ⚙️ Configuración

1. **Ir a tab "Ajustes"**
2. **Ver diagnóstico** del app
3. **Limpiar datos locales** si es necesario
4. **Agregar frases motivacionales** personalizadas
5. **Logout** 🚪

---

## 🔮 Roadmap (v8.0 → v10.0)

### ✅ Completado (v8.0)
- Security Rules
- Validación EAN-13
- Determinante seguro

### 🚧 En Progreso
- Memory leak fixes
- Virtualization
- Dashboards mejorados
- Notificaciones push
- Guardado incremental auditoría

### ⏳ Pendiente
- Atajos de teclado
- Importación CSV
- Offline sync mejorado
- Modo dark/light
- Rol supervisor
- Historial de cambios
- Reportes PDF

---

## 🧪 Testing

### Ejecutar Tests

```bash
npm test
```

### Manual Testing Checklist

- [ ] Login funciona
- [ ] Registro valida determinante (4-8 chars)
- [ ] Agregar producto guarda correctamente
- [ ] Escaneo rápido (<300ms)
- [ ] Relleno actualiza stock
- [ ] Auditoría compara diferencias
- [ ] PWA funciona offline
- [ ] Service Worker cachea assets

---

## 📞 Soporte

**Problema:** La app se carga lentamente
- ✅ Limpiar cache (⚙️ → Limpiar datos)
- ✅ Desactivar navegador VPN
- ✅ Verificar conexión Firebase

**Problema:** Escaneo no funciona
- ✅ Dar permisos de cámara
- ✅ Usar Chrome en lugar de otro navegador
- ✅ En iOS, cambiar a Safari (no funciona en app web)

**Problema:** Datos no se sincronizan
- ✅ Verificar conexión a internet
- ✅ Verificar que Firebase Rules están deployadas
- ✅ Revisar que determinante es correcto

---

## 👤 Autor

**José A. G. Betancourt**

- 🐙 GitHub: https://github.com/chivas11estar-ui
- 📧 Email: chivas11estar@gmail.com
- 🌐 Web: https://aguilapro.com

---

## 📜 Licencia

Propietaria - Todos los derechos reservados © 2025 José A. G. Betancourt

---

## 🙏 Agradecimientos

- Google ML Kit
- Firebase
- Netlify
- PepsiCo

---

Hecho con ❤️ para promotores que merecen herramientas profesionales.
