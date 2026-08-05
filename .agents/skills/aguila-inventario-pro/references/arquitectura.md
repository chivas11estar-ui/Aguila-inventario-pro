# Arquitectura y reglas de dominio

## Producto

Águila Inventario Pro es una PWA JavaScript vanilla para promotores de PepsiCo/Sabritas. Debe funcionar rápido en móvil y tolerar conectividad imperfecta.

## Datos y acceso

- Autenticación: Firebase Authentication.
- Perfil: `usuarios/{uid}` con `determinante`, `nombrePromotor` y `nombreTienda`.
- Inventario compartido: `productos/{determinante}/{codigoBarras}`.
- Movimientos: `movimientos/{determinante}`.
- Auditorías: `auditorias/{determinante}`.

Dos promotores de la misma determinante ven y modifican el mismo inventario. No usar `uid` como clave de inventario. Validar siempre que la determinante del perfil coincida con la ruta que se lee o escribe.

## Módulos principales

| Área | Archivos principales | Riesgo |
| --- | --- | --- |
| Arranque y sesión | `index.html`, `auth.js`, `login.js`, `app.js` | Alto |
| Inventario y lotes | `inventory-core.js`, `inventory.js`, `inventory-ui.js`, `lote-mover.js` | Crítico |
| Relleno y entrada | `refill-safe.js` | Crítico |
| Auditoría | `audit.js` | Crítico |
| Búsqueda y escáner | `search-controller.js`, `scanner-mlkit.js` | Medio |
| Datos | `analytics.js`, `analytics-ui.js` | Medio |
| PWA | `service-worker.js`, `manifest.json` | Alto |
| Telemetría | Pendiente de restauración en el cliente | Alto |

## Flujos que no deben romperse

1. El código de barras identifica el producto y puede consolidar lotes/bodegas.
2. La entrada, el relleno, los movimientos y la auditoría deben reflejarse para todos los usuarios de la determinante.
3. Productos agotados se calculan por stock total del producto, no por un lote aislado.
4. Los scripts se pueden cargar de manera directa o diferida: verificar la ruta real de carga antes de agregar un módulo.
5. El service worker requiere una nueva versión de caché cuando cambian recursos de la app.

## Comprobaciones antes de una corrección

- Reproducir con una determinante de prueba o datos no destructivos.
- Confirmar que el archivo se carga y que los símbolos globales necesarios existen.
- Ejecutar `node --check <archivo>` cuando esté disponible.
- Para cambios críticos, revisar lectura y escritura de Firebase, listener y UI afectada.
- No desplegar ni cambiar Firebase sin aprobación.
