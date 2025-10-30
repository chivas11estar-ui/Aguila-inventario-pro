// ============================================================
// Águila Inventario Pro - Módulo: inventory.js
// Copyright © 2025 José A. G. Betancourt
// VERSIÓN CON FILTRO DE STOCK 0
// ============================================================

let inventoryData = [];
let filteredInventory = [];
let currentBrandFilter = 'all';
let userDeterminante = null;
let mostrarProductosSinStock = false; // NUEVO: Toggle para productos sin stock

// ============================================================
// SISTEMA DE ALERTAS DE CADUCIDAD POR MARCA
// ============================================================

const BRAND_EXPIRY_CONFIG = {
  'Sabritas': 30,
  'Gamesa': 60,
  'Quaker': 60,
  "Sonric's": 60,
  'Cacahuate': 30,
  'default': 60
};

// ... (funciones de notificación y urgencia sin cambios)

/**
 * Función que obtiene el determinante del usuario (ID de la tienda)
 * Si ya está cargado en la variable, lo retorna, sino lo busca en Firebase.
 */
async function getUserDeterminante() {
  // USANDO window.firebaseAuth y window.firebaseDB
  const userId = window.firebaseAuth.currentUser?.uid;
  if (!userId) return null;
  
  try {
    const snapshot = await window.firebaseDB.ref('promotores/' + userId).once('value');
    const userData = snapshot.val();
    return userData?.determinante || null;
  } catch (error) {
    console.error('❌ Error al obtener determinante:', error);
    return null;
  }
}

// ============================================================
// CARGAR INVENTARIO
// ============================================================
/**
 * Inicia la escucha en tiempo real del inventario para la tienda del promotor.
 */
async function loadInventory() {
  console.log('📦 Cargando inventario...');
  
  // USANDO window.firebaseAuth
  const userId = window.firebaseAuth.currentUser?.uid;
  if (!userId) {
    console.error('❌ No hay usuario autenticado');
    return;
  }
  
  if (!userDeterminante) {
    userDeterminante = await getUserDeterminante();
  }
  
  if (!userDeterminante) {
    console.error('❌ No se pudo obtener el determinante');
    showToast('Error: No se encontró información de la tienda', 'error');
    return;
  }
  
  console.log('🏪 Cargando inventario de tienda:', userDeterminante);
  
  // USANDO window.firebaseDB
  const inventoryRef = window.firebaseDB.ref('inventario/' + userDeterminante);
  
  inventoryRef.on('value', (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      inventoryData = Object.keys(data).map(key => ({
        id: key,
        ...data[key]
      }));
      
      console.log('✅ Inventario cargado:', inventoryData.length, 'productos');
      
      updateDashboardStats();
      filteredInventory = [...inventoryData];
      displayInventory(filteredInventory);
      updateBrandFilters();
      
      setTimeout(() => {
        checkExpiringProducts();
      }, 2000);
      
    } else {
      console.log('📭 No hay productos en el inventario');
      inventoryData = [];
      filteredInventory = [];
      displayEmptyInventory();
    }
  }, (error) => {
    console.error('❌ Error al cargar inventario:', error);
    showToast('Error al cargar inventario: ' + error.message, 'error');
  });
}

// ... (Resto de funciones de filtrado, renderizado, etc., sin cambios mayores)

// ============================================================
// ELIMINAR PRODUCTO (AJUSTADO)
// ============================================================
async function deleteProduct(productId, productName) {
  // Usamos un modal o un confirm si es estrictamente necesario, pero idealmente un modal UI
  if (!window.confirm(`¿Estás seguro de eliminar "${productName}"?`)) {
    return;
  }
  
  console.log('🗑️ Eliminando producto:', productId);
  
  if (!userDeterminante) {
    userDeterminante = await getUserDeterminante();
  }
  
  if (!userDeterminante) {
    showToast('Error: No se encontró información de la tienda', 'error');
    return;
  }
  
  // USANDO window.firebaseDB
  window.firebaseDB.ref('inventario/' + userDeterminante + '/' + productId).remove()
    .then(() => {
      console.log('✅ Producto eliminado');
      showToast('Producto eliminado correctamente', 'success');
    })
    .catch((error) => {
      console.error('❌ Error al eliminar:', error);
      showToast('Error al eliminar producto: ' + error.message, 'error');
    });
}

// ============================================================
// AGREGAR O ACTUALIZAR PRODUCTO (AJUSTADO)
// ============================================================
document.getElementById('add-product-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  console.log('💾 Guardando producto...');
  
  if (!userDeterminante) {
    userDeterminante = await getUserDeterminante();
  }
  
  if (!userDeterminante) {
    showToast('Error: No se encontró información de la tienda', 'error');
    return;
  }
  
  // Aseguramos que window.firebaseAuth exista antes de acceder a .currentUser.email
  const currentUserEmail = window.firebaseAuth.currentUser?.email || 'Promotor Desconocido';
  
  const formData = {
    codigoBarras: document.getElementById('add-barcode').value.trim(),
    nombre: document.getElementById('add-product-name').value.trim(),
    marca: document.getElementById('add-brand').value,
    piezasPorCaja: parseInt(document.getElementById('add-pieces-per-box').value),
    ubicacion: document.getElementById('add-warehouse').value.trim(),
    fechaCaducidad: document.getElementById('add-expiry-date').value,
    cajas: parseInt(document.getElementById('add-boxes').value),
    fechaActualizacion: new Date().toISOString(),
    // USANDO la referencia segura:
    actualizadoPor: currentUserEmail 
  };
  
  const form = document.getElementById('add-product-form');
  const editingId = form.dataset.editingId;
  
  try {
    if (editingId) {
      // USANDO window.firebaseDB
      await window.firebaseDB.ref('inventario/' + userDeterminante + '/' + editingId).update(formData);
      showToast('Producto actualizado correctamente', 'success');
      delete form.dataset.editingId;
      form.reset();
    } else {
      // USANDO window.firebaseDB
      formData.fechaCreacion = new Date().toISOString();
      await window.firebaseDB.ref('inventario/' + userDeterminante).push(formData);
      showToast('Producto agregado correctamente', 'success');
      form.reset();
    }
  } catch (error) {
    console.error('Error al guardar/actualizar producto:', error);
    showToast('Error al guardar: ' + error.message, 'error');
  }
});