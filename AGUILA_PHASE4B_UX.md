# Águila Inventario Pro - Phase 4B: UI/UX Design

## Principle: The "Formula 1" Morning Routine
Speed is the only metric that matters at 6:00 AM.

## 1. Quick Reception Screen (New Tab or Mode)
- **Automatic Focus**: The barcode scanner or search input must have focus immediately.
- **Identified Product Card**: Large font for product name and gramage.
- **The "Giant Stepper"**: Large `[ - ]` and `[ + ]` buttons surrounding a central quantity field.
- **One-Tap Confirm**: "RECIBIR" button should be a floating action button (FAB) or a full-width bottom button.
- **Success Feedback**: Brief haptic vibration (if supported) and a temporary green flash of the quantity.
- **Zero Friction**: Auto-clear and auto-focus for the next scan.

## 2. Audit Intelligence (Contextual Feedback)
- When a product is scanned during audit, if it has stock in `🚚 POR ACOMODAR`, show a subtle indicator:
  - *"📦 45 boxes waiting for location"*
- **Balance Indicator**: As the user types the count, show a real-time preview of where the stock is coming from.

## 3. Offline First
- Show a "Syncing" status indicator.
- Ensure the search function works with the local `INVENTORY_STATE` while offline.
