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

async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.log('❌ Este navegador no soporta notificaciones');
    return false;
  }
  
  if (Notification.permission === 'granted') {
    console.log('✅ Permisos de notificación ya otorgados');
    return true;
  }
  
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('✅ Permisos de notificación otorgados');
      showToast('Notificaciones activadas', 'success');
      return true;
    } else {
      console.log('⚠️ Permisos de notificación denegados');
      showToast('Permiso de notificaciones denegado', 'warning');
      return false;
    }
  }
  return false;
}

/**
 * Función que obtiene el determinante del usuario (ID de la tienda)
 * Si ya está cargado en la variable, lo retorna, sino lo busca en Firebase.
 */
async function getUserDeterminante() {
    if (userDeterminante) return userDeterminante;
    
    // Asumiendo que el usuario ya está autenticado a este punto
    const user = window.firebaseAuth.currentUser;
    if (!user) {
        console.error('Usuario no autenticado para obtener determinante.');
        return null;
    }

    try {
        const userRef = window.firebaseDB.ref('promotores/' + user.uid);
        const snapshot = await userRef.once('value');
        const userData = snapshot.val();
        
        if (userData && userData.determinante) {
            userDeterminante = userData.determinante;
            console.log('🔑 Determinante de usuario obtenido:', userDeterminante);
            return userDeterminante;
        } else {
            console.error('No se encontró determinante para el usuario:', user.uid);
            return null;
        }
    } catch (error) {
        console.error('Error al obtener el determinante de Firebase:', error);
        return null;
    }
}


// ============================================================
// CARGA Y ESCUCHA DEL INVENTARIO (CRÍTICO)
// ============================================================
/**
 * Inicia la escucha en tiempo real del inventario para la tienda del promotor.
 */
export async function loadInventory() {
  const listElement = document.getElementById('inventory-list');
  listElement.innerHTML = '<p class="text-center text-muted">Conectando con la base de datos...</p>';

  userDeterminante = await getUserDeterminante();

  if (!userDeterminante) {
    listElement.innerHTML = '<p class="text-center text-error">❌ No se pudo cargar el inventario. Falla al obtener ID de Tienda.</p>';
    showToast('Error: No se encontró el ID de su tienda (Determinante)', 'error');
    return;
  }
  
  // Usamos la referencia global a la DB que establecimos en firebase-config.js
  // La ruta de acceso es: /inventario/{determinante de la tienda}
  const inventoryRef = window.firebaseDB.ref('inventario/' + userDeterminante);
  
  // on() establece un listener que se dispara al inicio y cada vez que hay cambios
  inventoryRef.on('value', (snapshot) => {
    try {
      const productsObject = snapshot.val();
      inventoryData = [];
      
      if (productsObject) {
        // Convertir el objeto de productos en un array para facilitar el filtrado y ordenamiento
        inventoryData = Object.keys(productsObject).map(key => ({
          id: key,
          ...productsObject[key]
        }));
        
        console.log(`✅ Inventario cargado: ${inventoryData.length} productos.`);
        
        // Aplicar filtros iniciales y renderizar
        applyFiltersAndRender();
        updateDashboardStats(inventoryData);
        generateBrandFilters(inventoryData);
        
      } else {
        inventoryData = [];
        listElement.innerHTML = '<p class="text-center text-muted">Aún no hay productos registrados. Use la pestaña "Agregar".</p>';
        updateDashboardStats([]);
        generateBrandFilters([]);
      }
    } catch (error) {
      console.error('Error procesando datos del inventario:', error);
      listElement.innerHTML = '<p class="text-center text-error">❌ Error al procesar los datos del inventario.</p>';
      showToast('Error al procesar el inventario: ' + error.message, 'error');
    }
  }, (error) => {
    // ESTE ES EL MANEJADOR DE ERRORES DE CONEXIÓN
    console.error('❌ Error de conexión a Firebase DB:', error);
    listElement.innerHTML = '<p class="text-center text-error">❌ No se pudo conectar a Firebase. Verifique su conexión o reinicie la app.</p>';
    showToast('Fallo en la conexión al servidor: ' + error.message, 'error');
    // Actualizar estado de conexión
    document.getElementById('connection-status-text').textContent = 'Desconectado';
    document.querySelector('.status-indicator').className = 'status-indicator status-error';
  });
}

/**
 * Función para renderizar la lista de inventario.
 */
function renderInventoryList() {
  const listElement = document.getElementById('inventory-list');
  
  if (filteredInventory.length === 0) {
    listElement.innerHTML = '<p class="text-center text-muted">No hay productos que coincidan con los filtros aplicados.</p>';
    return;
  }
  
  // Ordenar por nombre
  filteredInventory.sort((a, b) => a.nombre.localeCompare(b.nombre));
  
  const html = filteredInventory.map(product => {
    const isLowStock = product.cajas <= 1 && product.cajas > 0;
    const isOutofStock = product.cajas === 0;
    const cardClass = isOutofStock ? 'inventory-card out-of-stock' : (isLowStock ? 'inventory-card low-stock' : 'inventory-card');
    
    // Lógica para resaltar caducidad
    const expiryDate = new Date(product.fechaCaducidad);
    const timeToExpiry = expiryDate.getTime() - new Date().getTime();
    const daysToExpiry = Math.ceil(timeToExpiry / (1000 * 60 * 60 * 24));
    const alertThreshold = BRAND_EXPIRY_CONFIG[product.marca] || BRAND_EXPIRY_CONFIG['default'];
    
    let expiryTag = '';
    if (daysToExpiry <= 0) {
      expiryTag = '<span class="tag expired">VENCIDO</span>';
    } else if (daysToExpiry <= alertThreshold) {
      expiryTag = `<span class="tag approaching-expiry">VENCE EN ${daysToExpiry} DÍAS</span>`;
    }

    return `
      <div class="${cardClass}" data-product-id="${product.id}" data-cajas="${product.cajas}">
        <div class="product-header">
          <span class="product-name">${product.nombre}</span>
          ${expiryTag}
        </div>
        <div class="product-details">
          <p><strong>Marca:</strong> ${product.marca}</p>
          <p><strong>Piezas/Caja:</strong> ${product.piezasPorCaja}</p>
          <p><strong>Ubicación:</strong> ${product.ubicacion}</p>
          <p><strong>Caducidad:</strong> ${product.fechaCaducidad}</p>
        </div>
        <div class="stock-info">
          <div class="stock-label">Cajas en Stock</div>
          <div class="stock-value">${product.cajas}</div>
        </div>
        <div class="product-actions">
          <button class="action-btn edit-btn" data-id="${product.id}" aria-label="Editar producto ${product.nombre}">Editar</button>
          <button class="action-btn refill-btn" data-id="${product.id}" aria-label="Mover stock de ${product.nombre}">Mover Stock</button>
          <button class="action-btn delete-btn error" data-id="${product.id}" aria-label="Eliminar producto ${product.nombre}">Eliminar</button>
        </div>
      </div>
    `;
  }).join('');
  
  listElement.innerHTML = html;
  attachInventoryEventListeners();
}

/**
 * Genera y aplica los filtros de búsqueda y marca al inventario.
 */
function applyFiltersAndRender() {
  const searchTerm = document.getElementById('inventory-search').value.toLowerCase();
  
  filteredInventory = inventoryData.filter(product => {
    // 1. Filtrar por stock 0 si el toggle NO está activo
    if (!mostrarProductosSinStock && product.cajas === 0) {
      return false;
    }
    
    // 2. Filtrar por marca
    if (currentBrandFilter !== 'all' && product.marca !== currentBrandFilter) {
      return false;
    }
    
    // 3. Filtrar por búsqueda de texto
    if (searchTerm.length > 0) {
      return product.nombre.toLowerCase().includes(searchTerm) ||
             product.marca.toLowerCase().includes(searchTerm) ||
             product.codigoBarras.toLowerCase().includes(searchTerm);
    }
    
    return true;
  });
  
  renderInventoryList();
}

/**
 * Genera dinámicamente los botones de filtro de marca.
 */
function generateBrandFilters(data) {
  const brands = [...new Set(data.map(p => p.marca))]; // Obtener marcas únicas
  const filterContainer = document.getElementById('brand-filters');
  
  let filterHTML = `<button class="brand-filter-btn ${currentBrandFilter === 'all' ? 'active' : ''}" data-brand="all">Todos</button>`;
  
  brands.forEach(brand => {
    filterHTML += `<button class="brand-filter-btn ${currentBrandFilter === brand ? 'active' : ''}" data-brand="${brand}">${brand}</button>`;
  });
  
  filterContainer.innerHTML = filterHTML;
}

/**
 * Añade los Event Listeners para el Inventario
 */
function attachInventoryEventListeners() {
  // Listener para el input de búsqueda
  document.getElementById('inventory-search').addEventListener('input', applyFiltersAndRender);

  // Listener para los filtros de marca
  document.getElementById('brand-filters').addEventListener('click', (e) => {
    const brand = e.target.dataset.brand;
    if (brand) {
      document.querySelectorAll('.brand-filter-btn').forEach(btn => btn.classList.remove('active'));
      e.target.classList.add('active');
      currentBrandFilter = brand;
      applyFiltersAndRender();
    }
  });

  // NUEVO: Listener para el botón de Toggle de Stock
  document.getElementById('toggle-stock-btn').addEventListener('click', (e) => {
    const button = e.currentTarget;
    const icon = document.getElementById('toggle-icon');

    mostrarProductosSinStock = !mostrarProductosSinStock; // Invertir estado
    button.dataset.stockVisible = mostrarProductosSinStock; // Actualizar atributo de estado

    if (mostrarProductosSinStock) {
      icon.textContent = '🙈';
      button.lastChild.textContent = ' Ocultar Productos Sin Stock';
      button.style.backgroundColor = 'var(--warning)'; // Color para indicar que se muestran
      button.style.color = 'white';
    } else {
      icon.textContent = '👁️‍🗨️';
      button.lastChild.textContent = ' Mostrar Productos Sin Stock';
      button.style.backgroundColor = 'var(--primary-light)'; // Vuelve a color original
      button.style.color = 'var(--primary-dark)';
    }

    applyFiltersAndRender(); // Re-renderizar la lista con el nuevo filtro
  });

  // Listener para los botones de acción
  document.getElementById('inventory-list').addEventListener('click', (e) => {
    const id = e.target.dataset.id;
    if (!id) return;

    if (e.target.classList.contains('edit-btn')) {
      // Lógica de edición
      console.log('Editar producto:', id);
      // Implementar redirección o modal de edición aquí
      showToast(`Preparando edición para producto ID: ${id}`, 'info');

    } else if (e.target.classList.contains('refill-btn')) {
      // Lógica de movimiento de stock (relleno)
      console.log('Mover stock:', id);
      // Implementar redirección a la pestaña de Relleno aquí
      showToast(`Moviendo stock para producto ID: ${id}`, 'info');

    } else if (e.target.classList.contains('delete-btn')) {
      // Lógica de eliminación
      confirmDeletion(id);
    }
  });
}

/**
 * Confirma la eliminación de un producto
 * @param {string} id - ID del producto a eliminar
 */
function confirmDeletion(id) {
  // En lugar de usar alert/confirm, se debería usar un modal personalizado.
  const confirmed = window.confirm('¿Está seguro de que desea eliminar este producto permanentemente?');
  
  if (confirmed) {
    deleteProduct(id);
  }
}

/**
 * Elimina un producto de Firebase
 * @param {string} id - ID del producto a eliminar
 */
async function deleteProduct(id) {
  try {
    if (!userDeterminante) {
      showToast('Error: No se encontró la tienda para eliminar.', 'error');
      return;
    }

    // Usamos la referencia global a la DB que establecimos en firebase-config.js
    await window.firebaseDB.ref('inventario/' + userDeterminante + '/' + id).remove();
    showToast('Producto eliminado correctamente.', 'success');
  } catch (error) {
    console.error('Error al eliminar producto:', error);
    showToast('Error al eliminar: ' + error.message, 'error');
  }
}

// ============================================================
// LÓGICA DE AGREGAR PRODUCTO
// (Se deja como estaba, usando la referencia global window.firebaseDB)
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
  
  const formData = {
    codigoBarras: document.getElementById('add-barcode').value.trim(),
    nombre: document.getElementById('add-product-name').value.trim(),
    marca: document.getElementById('add-brand').value,
    piezasPorCaja: parseInt(document.getElementById('add-pieces-per-box').value),
    ubicacion: document.getElementById('add-warehouse').value.trim(),
    fechaCaducidad: document.getElementById('add-expiry-date').value,
    cajas: parseInt(document.getElementById('add-boxes').value),
    fechaActualizacion: new Date().toISOString(),
    actualizadoPor: window.firebaseAuth.currentUser.email
  };
  
  const form = document.getElementById('add-product-form');
  const editingId = form.dataset.editingId;
  
  try {
    if (editingId) {
      // Actualizar producto existente
      await window.firebaseDB.ref('inventario/' + userDeterminante + '/' + editingId).update(formData);
      showToast('Producto actualizado correctamente', 'success');
      form.removeAttribute('data-editing-id'); // Remover el estado de edición
      form.reset();
    } else {
      // Agregar nuevo producto
      await window.firebaseDB.ref('inventario/' + userDeterminante).push(formData);
      showToast('Producto agregado correctamente', 'success');
      form.reset();
    }
  } catch (error) {
    console.error('Error al guardar/actualizar producto:', error);
    showToast('Error al guardar: ' + error.message, 'error');
  }
});