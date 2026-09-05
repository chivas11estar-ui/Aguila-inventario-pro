# Diseño Funcional: Recepción Temporal Inteligente

## Concepto: "El Ferrari de la Mañana" 🏎️
El objetivo es permitir que el promotor registre 50 tarimas de producto en minutos, dejándolos en un estado de "Por Ubicar", para luego distribuirlos en bodegas reales durante su recorrido físico por la tienda.

## 1. Modelo de Datos Propuesto
Mantendremos la compatibilidad con **Multi-Lote V3**. La "Recepción Temporal" se representará como una bodega virtual reservada:

- **Nombre Reservado**: `🚚 POR ACOMODAR`
- **Identificador de Lote**: Generado mediante `generarLoteId("🚚 POR ACOMODAR", fechaCaducidad)`.

Este modelo permite:
- Que el stock total del producto incluya la mercancía recién llegada.
- Que el sistema de inventario liste el producto como disponible pero indique que no está en su ubicación final.
- Trazabilidad total mediante transacciones atómicas.

## 2. Flujo de Recepción Rápida (UI/UX)
Se creará una interfaz optimizada para pantallas móviles:
1. **Escaneo / Búsqueda**: Foco automático en el buscador por nombre/código.
2. **Identificación**: Al seleccionar, muestra gramaje y piezas por caja.
3. **Cantidad**: Stepper gigante `[-] [ 10 ] [+]`.
4. **Caducidad**: Default al día de hoy o última caducidad conocida.
5. **Acción**: Botón "RECIBIR".
6. **Siguiente**: El formulario se limpia pero mantiene el foco en el buscador para el siguiente producto (One-hand operation).

## 3. Lógica de Auditoría y Asignación (El "Move-on-Audit")
Cuando el promotor entra en `audit.js` para auditar la "Bodega 12":
1. **Detección**: Al escanear un producto, el sistema busca lotes en `🚚 POR ACOMODAR`.
2. **Balanceo Atómico**: 
   - Si el promotor cuenta 10 cajas en Bodega 12.
   - El sistema tiene 0 en Bodega 12 pero 45 en `🚚 POR ACOMODAR`.
   - El sistema **mueve** 10 cajas de `🚚 POR ACOMODAR` → `Bodega 12`.
3. **Resultado**: 
   - Bodega 12 = 10 cajas.
   - `🚚 POR ACOMODAR` = 35 cajas.
   - Historial de movimientos registra: "Asignación desde recepción temporal".

## 4. Garantías de Concurrencia
Se utilizarán **Firebase Transactions** en `inventory-core.js` para:
- Evitar que dos promotores "tomen" las mismas cajas de la recepción temporal simultáneamente.
- Garantizar que la suma total (Bodega A + Bodega B + Por Acomodar) siempre sea igual a la recepción original.

## 5. Rendimiento (Optimización de Lecturas)
- **Carga On-Demand**: La lista de "Productos por Acomodar" solo se consultará cuando el usuario entre a la pestaña de Auditoría o Recepción.
- **Listeners Selectivos**: No recargar el inventario completo tras cada escaneo rápido; actualizar solo el objeto local para feedback inmediato.
