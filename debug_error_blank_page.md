# 🔧 DEBUGGING: Página en Blanco Después de Scroll (Error #2)

## Problema Reportado
Después de hacer scroll en cualquier pestaña, el contenido principal desaparece dejando solo header, footer y navegación.

## Pasos para Reproducir
1. Navegar a cualquier pestaña (Stock, Rellenar, Datos, etc.)
2. Hacer scroll down 3+ veces
3. Contenido desaparece (página blanca)
4. Presionar Home key recupera parcialmente

## Debugging en DevTools (F12)

### Paso 1: Abrir DevTools
```
Presionar: F12
Ir a: Elements / Inspector
```

### Paso 2: Inspeccionar Elementos Principales
Cuando el contenido desaparece, inspecciona estos elementos:

```html
<!-- Element 1: Main App Container -->
<section id="app-container">
  <!-- Verificar en Computed Styles:
    - display: flex/block/none?
    - height: auto/100vh/0?
    - overflow: auto/hidden/visible?
  -->
</section>

<!-- Element 2: Tab Content (Active) -->
<div id="tab-{tabName}" class="tab-content active">
  <!-- Verificar en Computed Styles:
    - display: block/none?
    - height: auto/100vh/0?
    - overflow: auto/hidden?
  -->
</div>

<!-- Element 3: Content Container -->
<div class="main-container" or similar>
  <!-- Verificar:
    - height: auto/0/100%?
    - min-height: defined?
  -->
</div>
```

### Paso 3: Verificar Atributos Específicos

En la pestaña **Console**, ejecuta:

```javascript
// Verificar si el tab está visible
const activeTab = document.querySelector('.tab-content.active');
console.log('Active tab:', activeTab);
console.log('Display:', window.getComputedStyle(activeTab).display);
console.log('Height:', window.getComputedStyle(activeTab).height);
console.log('Overflow:', window.getComputedStyle(activeTab).overflow);
console.log('Visibility:', window.getComputedStyle(activeTab).visibility);

// Verificar app-container
const appContainer = document.getElementById('app-container');
console.log('App container height:', window.getComputedStyle(appContainer).height);
console.log('App container display:', window.getComputedStyle(appContainer).display);

// Verificar si hay elemento con height: 0
document.querySelectorAll('*').forEach(el => {
  const h = window.getComputedStyle(el).height;
  if (h === '0px' && el.offsetParent !== null) {
    console.log('⚠️ Elemento con height: 0px', el);
  }
});
```

## Fix Implementado

### En app.js (switchTab function)
Se agregó scroll reset al cambiar de tab:

```javascript
const tab = document.getElementById(`tab-${tabName}`);
if (tab) {
  tab.classList.add('active');
  
  // 🔧 FIX #2: Reset scroll al cambiar de tab
  tab.scrollTop = 0;
  window.scrollTo(0, 0);
}
```

### En styles.css (Verificar que existen)
```css
#app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.tab-content {
  display: none;
  flex: 1;
  overflow-y: auto;
}

.tab-content.active {
  display: block;
}
```

## Posibles Causas

### ❌ Causa 1: Height: 0 en algún elemento
```css
/* Incorrecto: */
.main-container { height: 0; }

/* Correcto: */
.main-container { height: auto; overflow-y: auto; }
```

### ❌ Causa 2: Overflow oculto en contenedor padre
```css
/* Incorrecto: */
.app-container { overflow: hidden; height: 100%; }

/* Correcto: */
.app-container { overflow: hidden; height: 100vh; }
```

### ❌ Causa 3: Display: none no se remueve correctamente
```javascript
/* Incorrecto: */
tab.classList.add('active');
// Pero CSS no tiene .active { display: block; }

/* Correcto: */
const tab = document.getElementById(`tab-${tabName}`);
if (tab) {
  tab.classList.add('active');
  // Asegurar que CSS tiene:
  // .tab-content.active { display: block; }
}
```

## Checklist de Verificación

- [ ] ¿El `.tab-content.active` tiene `display: block` en CSS?
- [ ] ¿El `.tab-content` tiene `display: none` por defecto?
- [ ] ¿El contenedor padre tiene altura definida correctamente?
- [ ] ¿Hay conflictos entre `height: 100vh` y `overflow: auto`?
- [ ] ¿Se ejecuta `window.scrollTo(0, 0)` al cambiar de tab?
- [ ] ¿Hay JavaScript que oculta el elemento después de que se muestra?

## Network Activity
Si el problema ocurre después de cierto scroll y es intermitente, podría ser causado por:
1. Carga lenta de datos en segundo plano
2. Evento que oculta el elemento mientras carga
3. CSS media query que se activa

Abre pestaña **Network** en DevTools y verifica:
- ¿Hay peticiones a Firebase durante el scroll?
- ¿Hay cambios en el DOM mientras carga?

## Reporte de Resultado

Después de investigar en DevTools, reporta:

1. **¿Qué elemento tiene `height: 0`?**
2. **¿Qué elemento tiene `display: none` cuando ocurre?**
3. **¿Se ejecuta `switchTab()` correctamente?**
4. **¿Hay errores en Console?**

Con esta información, se puede hacer un fix más específico.

---

**Última actualización:** 2026-04-12  
**Fix aplicado:** app.js scroll reset + documentación para debugging
