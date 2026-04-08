// ============================================================
// Águila Inventario Pro - listener-manager.js
// FASE 2.1: Gestión centralizada de listeners Firebase
// Previene memory leaks acumulando listeners sin desuscribirse
// Copyright © 2025 José A. G. Betancourt
// ============================================================

'use strict';

// ============================================================
// SISTEMA CENTRALIZADO DE LISTENERS
// ============================================================
window.LISTENERS_MANAGER = {
  _listeners: {},
  _isDestroyed: false,

  // Registrar un nuevo listener
  register(name, unsubscribeFn) {
    if (this._listeners[name]) {
      console.warn(`⚠️ [LISTENERS] Ya existe listener "${name}". Desuscribiendo anterior...`);
      this.unsubscribe(name);
    }

    this._listeners[name] = {
      unsubscribe: unsubscribeFn,
      createdAt: new Date().toISOString(),
      active: true
    };

    console.log(`✅ [LISTENERS] Registrado: ${name}`);
  },

  // Desuscribir un listener específico
  unsubscribe(name) {
    if (!this._listeners[name]) {
      console.warn(`⚠️ [LISTENERS] No existe listener: ${name}`);
      return false;
    }

    try {
      const listener = this._listeners[name];
      if (typeof listener.unsubscribe === 'function') {
        listener.unsubscribe();
        listener.active = false;
      }
      delete this._listeners[name];
      console.log(`✅ [LISTENERS] Desuscrito: ${name}`);
      return true;
    } catch (error) {
      console.error(`❌ [LISTENERS] Error desuscribiendo ${name}:`, error);
      return false;
    }
  },

  // Desuscribir TODOS los listeners
  unsubscribeAll() {
    console.log(`🧹 [LISTENERS] Limpiando ${Object.keys(this._listeners).length} listeners...`);

    Object.keys(this._listeners).forEach(name => {
      try {
        const listener = this._listeners[name];
        if (typeof listener.unsubscribe === 'function') {
          listener.unsubscribe();
        }
      } catch (error) {
        console.error(`⚠️ [LISTENERS] Error limpiando ${name}:`, error);
      }
    });

    this._listeners = {};
    console.log(`✅ [LISTENERS] Todos los listeners limpiados`);
  },

  // Obtener estado de listeners (para debugging)
  getStatus() {
    const activeListeners = Object.keys(this._listeners).filter(
      name => this._listeners[name].active
    );

    return {
      total: Object.keys(this._listeners).length,
      active: activeListeners.length,
      names: activeListeners,
      details: this._listeners
    };
  },

  // Destroy: para usar al cerrar sesión
  destroy() {
    this._isDestroyed = true;
    this.unsubscribeAll();
    console.log(`✅ [LISTENERS] Gestor destruido - sesión cerrada`);
  }
};

// ============================================================
// AUTOLIMPIEZA AL DESCONECTARSE
// ============================================================
window.addEventListener('beforeunload', () => {
  if (window.LISTENERS_MANAGER && !window.LISTENERS_MANAGER._isDestroyed) {
    window.LISTENERS_MANAGER.unsubscribeAll();
  }
});

// Al hacer logout, también limpiar
window.addEventListener('logout', () => {
  if (window.LISTENERS_MANAGER) {
    window.LISTENERS_MANAGER.destroy();
  }
});

console.log('✅ listener-manager.js cargado correctamente');
