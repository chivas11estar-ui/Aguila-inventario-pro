# Diagnóstico del Flujo de Recepción Actual

Este documento describe cómo opera actualmente el registro de entrada de mercancía en la aplicación.

## 1. Modos Actuales en `refill-safe.js`
El sistema utiliza un selector de modo (`setRefillModeSafe`) que alterna entre:
- **Salida (`exit`)**: Resta stock de bodegas reales.
- **Por Piezas (`pieces`)**: Mueve fracciones de caja.
- **Entrada / Alta (`entry`)**: Añade stock a una bodega específica.
- **Recepción Tarima (`reception`)**: Es el modo más reciente, diseñado para velocidad.

## 2. El flujo de "Recepción Tarima" actual
1. **Buscador de Catálogo**: Permite escribir el nombre (ej. "Pepsi") y selecciona el producto del catálogo global.
2. **Ubicación Automática**: Hardcodea la bodega como `📥 Recepción`.
3. **Persistencia**: Crea o actualiza un lote en la ruta `productos/{det}/{codigo}/lotes/{loteId}` donde el `loteId` es un hash de la bodega "📥 Recepción" y la fecha de caducidad.
4. **Impacto en Stock**: El stock se suma al `stockTotal` del producto.

## 3. Lotes y Bodegas (Estructura V3)
Los productos no son planos. Tienen un mapa de `lotes`:
```json
"lotes": {
  "hash_bodega_fecha": {
    "bodega": "Bodega 12",
    "fechaCaducidad": "2027-01-10",
    "stock": 45
  }
}
```

## 4. Limitaciones del flujo actual
- **Falta de Staging Real**: Aunque usa "📥 Recepción", el sistema lo trata como una bodega más. No hay una diferenciación clara entre "Mercancía en el camión/tarima" y "Mercancía ubicada".
- **Asignación Manual**: Para mover de "📥 Recepción" a "Bodega 12", el promotor debe usar el módulo `lote-mover.js` manualmente por cada producto.
- **Velocidad**: El buscador de catálogo es rápido, pero el formulario sigue teniendo campos que el promotor no quiere tocar durante la recepción matutina (como la selección de bodega).

## 5. Auditoría e Integración
Actualmente, `audit.js` tiene una lógica de "Asignación Inteligente" que intenta restar de "📥 Recepción" si detecta un excedente en la bodega auditada. Sin embargo, este proceso es reactivo y no preventivo.
