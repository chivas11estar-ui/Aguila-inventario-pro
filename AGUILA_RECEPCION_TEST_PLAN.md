# Plan de Pruebas: Recepción Temporal

Este plan detalla los escenarios críticos para validar la nueva funcionalidad de recepción y asignación inteligente.

## Escenario 1: Recepción de Alta Velocidad
- **Acción**: Escanear 5 productos diferentes con gramajes distintos en menos de 1 minuto.
- **Resultado Esperado**: Todos los productos aparecen en el inventario bajo la ubicación `🚚 POR ACOMODAR`. Los lotes se crean con la fecha de caducidad correcta.

## Escenario 2: Acumulación de Cargas
- **Acción**: Recibir 10 cajas de Pepsi, luego volver a recibir 15 cajas del mismo producto/lote.
- **Resultado Esperado**: El lote `🚚 POR ACOMODAR` debe mostrar 25 cajas. No deben existir dos lotes idénticos en la misma ubicación temporal.

## Escenario 3: Asignación por Auditoría (Parcial)
- **Acción**: 
  1. Recibir 100 cajas de Sabritas en `🚚 POR ACOMODAR`.
  2. Iniciar auditoría en "Bodega Norte".
  3. Contar 40 cajas.
- **Resultado Esperado**: 
  - Bodega Norte = 40 cajas.
  - `🚚 POR ACOMODAR` = 60 cajas.
  - Historial registra movimiento de asignación.

## Escenario 4: Control de Excedentes
- **Acción**:
  1. Recibir 10 cajas en `🚚 POR ACOMODAR`.
  2. Auditar 15 cajas en Bodega Sur.
- **Resultado Esperado**: El sistema debe lanzar una alerta indicando que hay 5 cajas excedentes y preguntar si se desean agregar como stock nuevo.

## Escenario 5: Concurrencia de Usuarios
- **Acción**: Dos promotores auditan diferentes bodegas al mismo tiempo para el mismo producto que está en recepción temporal.
- **Resultado Esperado**: Las transacciones de Firebase deben asegurar que el stock se descuente correctamente de la recepción sin duplicarse ni perderse.
