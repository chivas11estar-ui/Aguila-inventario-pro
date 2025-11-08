// ============================================================
// Águila Inventario Pro - Inventory Enhanced
// Buscador + Desplegables por marca
// ============================================================

let expandedBrands = {}; // Controlar qué marcas están expandidas

document.addEventListener('DOMContentLoaded', function() {
  console.log('🔍 Configurando buscador de inventario...');

  // Crear buscador si no existe
  const inventoryList = document.getElementById('inventory-list');
  if (inventoryList && !document.getElementById('inventory-search')) {
    const searchHTML = `
      <div style="margin-bottom:20px;">
        <input 
          id="inventory-search" 
          type="text" 
          placeholder="🔍 Buscar producto, marca o código..." 
          style="width:100%;padding:12px;border:2px solid var(--border);border-radius:8px;font-size:14px;box-sizing:border-box;"
        />
      </div>
    `;
    inventoryList.insertAdjacentHTML('beforebegin', searchHTML);

    // Evento de búsqueda
    const searchInput = document.getElementById('inventory-search');
    if (searchInput) {
      searchInput.addEventListener('input', function() {
        filterInventory(this.value.toLowerCase());
      });
    }
  }

  console.log('✅ Buscador configurado');
});

// ============================================================
// FILTRAR INVENTARIO
// ============================================================
function filterInventory(searchTerm) {
  const inventoryList = document.getElementById('inventory-list');
  if (!inventoryList) return;

  const brandSections = inventoryList.querySelectorAll('[data-brand-section]');

  brandSections.forEach(section => {
    const brand = section.getAttribute('data-brand-section');
    const products = section.querySelectorAll('[data-product-item]');
    let visibleCount = 0;

    products.forEach(product => {
      const productName = product.getAttribute('data-product-name') || '';
      const productCode = product.getAttribute('data-product-code') || '';
      
      const matches = 
        productName.toLowerCase().includes(searchTerm) ||
        productCode.toLowerCase().includes(searchTerm) ||
        brand.toLowerCase().includes(searchTerm);

      if (matches) {
        product.style.display = 'block';
        visibleCount++;
      } else {
        product.style.display = 'none';
      }
    });

    // Mostrar/ocultar sección de marca
    const brandHeader = section.querySelector('[data-brand-header]');
    if (visibleCount > 0) {
      section.style.display = 'block';
      if (brandHeader) {
        const countSpan = brandHeader.querySelector('[data-product-count]');
        if (countSpan) {
          countSpan.textContent = visibleCount;
        }
      }
    } else {
      section.style.display = 'none';
    }
  });
}

// ============================================================
// TOGGLE MARCA (EXPANDIR/CONTRAER)
// ============================================================
function toggleBrand(brand) {
  const section = document.querySelector(`[data-brand-section="${brand}"]`);
  if (!section) return;

  const productsList = section.querySelector('[data-products-list]');
  const header = section.querySelector('[data-brand-header]');
  
  if (!productsList || !header) return;

  const isExpanded = expandedBrands[brand] || false;
  expandedBrands[brand] = !isExpanded;

  if (expandedBrands[brand]) {
    // Expandir
    productsList.style.display = 'block';
    header.style.opacity = '1';
    console.log('📂 Expandido:', brand);
  } else {
    // Contraer
    productsList.style.display = 'none';
    header.style.opacity = '0.7';
    console.log('📁 Contraído:', brand);
  }
}

// ============================================================
// INICIALIZAR DESPLEGABLES
// ============================================================
function initCollapsibles() {
  const brandHeaders = document.querySelectorAll('[data-brand-header]');
  
  brandHeaders.forEach(header => {
    const brand = header.getAttribute('data-brand-name');
    if (brand) {
      // Por defecto expandidos
      expandedBrands[brand] = true;
      
      header.style.cursor = 'pointer';
      header.addEventListener('click', function() {
        toggleBrand(brand);
      });
    }
  });

  console.log('✅ Desplegables inicializados');
}

// Monitorear cambios en el inventario
const observer = new MutationObserver(() => {
  if (document.querySelector('[data-brand-header]')) {
    initCollapsibles();
  }
});

observer.observe(document.getElementById('inventory-list') || document.body, {
  childList: true,
  subtree: true
});

console.log('✅ inventory-enhanced.js cargado');