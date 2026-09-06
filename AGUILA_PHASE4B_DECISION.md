# Águila Inventario Pro - Phase 4B Final Decision: Temporary Reception Design

## Consolidated Executive Summary

### 1. Modelo Actual Confirmado
- **Arquitectura**: Multi-Lote V3.
- **Persistencia**: Firebase Realtime Database con aislamiento por `determinante`.
- **Invariante**: El stock total es la suma de los stocks de los lotes hijos.
- **Estado**: Funcional pero requiere optimización de flujo para recepciones masivas.

### 2. Modelo Propuesto: Recepción Temporal Transaccional
- **Concepto**: Utilizar una ubicación virtual reservada (`🚚 POR ACOMODAR`) para el ingreso rápido de mercancía matutina.
- **Ubicación Técnica**: Un lote estándar dentro del mapa de `lotes` del producto.
- **ID de Lote**: `b64("🚚 POR ACOMODAR" + "_" + fechaCaducidad)`.

### 3. Flujo Funcional de Recepción
1. **Identificación**: Escaneo de código de barras o búsqueda por nombre (Catálogo Global).
2. **Registro**: Ingreso de cantidad (Cajas/Piezas).
3. **Persistencia**: Transacción atómica que incrementa el stock en el lote `🚚 POR ACOMODAR`.
4. **Ciclo**: Foco automático al buscador para el siguiente producto.

### 4. Flujo de Auditoría (Distribución Inteligente)
- Al auditar una bodega real (p. ej. "Bodega 12"):
  - Si `Conteo > Stock_Sistema_Bodega`, se verifica si existe stock en `🚚 POR ACOMODAR`.
  - Se realiza un **Balanceo Atómico**: Se descuenta de `🚚 POR ACOMODAR` y se suma a "Bodega 12" en un solo paso.
  - Si el conteo supera el total (`Bodega + Recepción`), el sistema pregunta si se trata de mercancía nueva o error de conteo.

### 5. Reglas e Invariantes
- **Regla de Oro**: Nunca se duplica el stock; la recepción temporal es una "reserva" que se consume durante la auditoría.
- **Atomicidad**: Obligatorio el uso de `productRef.transaction()` para evitar *lost updates* en entornos multi-promotor.

### 6. Criterios de Aceptación
- **PASS**: ARCHITECTURE, SECURITY, QA, UX.
- **CONTRADICCIONES**: 0 detectadas.
- **RIESGOS**: Baja conectividad en Walmart durante la recepción (Mitigado por cola de sincronización local).

### 7. Plan de Implementación (Fase 4C)
- **Archivos a Modificar**:
  - `inventory-core.js`: Lógica de balanceo entre lotes.
  - `audit.js`: Integración de la detección de recepción temporal.
  - `refill-safe.js`: Nuevo modo de "Recepción Ferrari".
- **Archivos Intocables**:
  - `database.rules.json` (Las reglas actuales ya cubren el modelo).
  - `auth.js` (No requiere cambios de lógica de sesión).

## Estatus Final: APPROVED FOR PHASE 4C
El diseño cumple con los requisitos de velocidad, integridad y trazabilidad. Se autoriza el paso a la fase de implementación tras revisión humana.
