# Águila Inventario Pro - Phase 4B: QA Test Plan

## Scenario 1: Partial Distribution (60/40 Split)
- **Initial State**: Pepsi 600 - 100 boxes in `🚚 POR ACOMODAR`. 0 in Bodega 12. 0 in Bodega 18.
- **Action 1**: Audit Bodega 12. Count 60 boxes.
- **Expected**: Bodega 12 = 60 boxes. `🚚 POR ACOMODAR` = 40 boxes.
- **Action 2**: Audit Bodega 18. Count 40 boxes.
- **Expected**: Bodega 18 = 40 boxes. `🚚 POR ACOMODAR` = 0 boxes (Lote removed).
- **Total Check**: System `stockTotal` must remain 100 throughout.

## Scenario 2: Surplus Detection (The 120% Case)
- **Initial State**: 100 boxes in `🚚 POR ACOMODAR`.
- **Action**: Audit Bodega 1. Count 120 boxes.
- **Expected**: Prompt user: "20 extra boxes found. Add to stock or recount?". 
  - If "Add": Bodega 1 = 120, `🚚 POR ACOMODAR` = 0.
  - If "Recount": UI stays in audit mode.

## Scenario 3: Deficit Handling (The 60% Case)
- **Initial State**: 100 boxes in `🚚 POR ACOMODAR`.
- **Action**: Audit Bodega 1. Count 60 boxes. End audit.
- **Expected**: Bodega 1 = 60. `🚚 POR ACOMODAR` = 40 (remaining).
- **Audit History**: Record discrepancy of -40 for "Bodega 1" and move event from "Reception".

## Scenario 4: Concurrency (Race Condition)
- **Action**: Two users open Audit for different bodegas. 
  - User A counts 50. 
  - User B counts 60. 
  - Only 100 were in `🚚 POR ACOMODAR`.
- **Expected**: User A succeeds. User B receives a conflict message or is prompted to add the remaining 10 as new stock.

## Scenario 5: Connection Loss
- **Action**: Scan 10 products offline during matinal reception.
- **Expected**: Local sync queue captures all 10. `stockTotal` increments locally. Permanent storage occurs upon reconnection.
