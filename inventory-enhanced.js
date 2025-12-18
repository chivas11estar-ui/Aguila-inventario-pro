// ============================================================
// Águila Inventario Pro - Inventory Enhanced (Versión PRO 2025)
// Mejorado: rendimiento, estabilidad, UX y compatibilidad total
// ============================================================

let expandedBrands = JSON.parse(localStorage.getItem("expandedBrands") || "{}");

// ============================================================
// UTILIDAD: Espera (debounce) para búsquedas rápidas
// ============================================================
function debounce(fn, delay = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ============================================================
// CREAR BUSCADOR (solo una vez)
// ============================================================
function ensureSearchBar() {
  const inventoryList = document.getElementById("inventory-list");
  if (!inventoryList) return;

  // Si ya existe, no volver a crearlo
  if (document.getElementById("inventory-search")) return;

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
  inventoryList.insertAdjacentHTML("beforebegin", searchHTML);

  const searchInput = document.getElementById("inventory-search");
  searchInput.addEventListener(
    "input",
    debounce(() => filterInventory(searchInput.value.toLowerCase()), 200)
  );
}

// ============================================================
// FILTRAR INVENTARIO (Versión optimizada)
// ============================================================
function filterInventory(searchTerm) {
  const inventoryList = document.getElementById("inventory-list");
  if (!inventoryList) return;

  const sections = inventoryList.querySelectorAll("[data-brand-section]");
  let totalVisible = 0;

  sections.forEach(section => {
    const brand = (section.dataset.brandSection || "").toLowerCase();
    const items = section.querySelectorAll("[data-product-item]");
    let visibleCount = 0;

    items.forEach(item => {
      const name = item.dataset.productName?.toLowerCase() || "";
      const code = item.dataset.productCode?.toLowerCase() || "";

      const matches =
        name.includes(searchTerm) ||
        code.includes(searchTerm) ||
        brand.includes(searchTerm);

      item.style.display = matches ? "block" : "none";
      if (matches) visibleCount++;
    });

    const header = section.querySelector("[data-brand-header]");
    if (header) {
      const countSpan = header.querySelector("[data-product-count]");
      if (countSpan) countSpan.textContent = visibleCount;
    }

    section.style.display = visibleCount > 0 ? "block" : "none";
    if (visibleCount > 0) totalVisible++;
  });

  if (totalVisible === 0) {
    showToast("Ningún producto coincide con la búsqueda", "warning");
  }
}

// ============================================================
// EXPANDIR / COLAPSAR MARCAS
// ============================================================
function toggleBrand(brand) {
  const section = document.querySelector(`[data-brand-section="${brand}"]`);
  if (!section) return;

  const productsList = section.querySelector("[data-products-list]");
  if (!productsList) return;

  const isExpanded = expandedBrands[brand] ?? true;
  const newState = !isExpanded;

  expandedBrands[brand] = newState;
  localStorage.setItem("expandedBrands", JSON.stringify(expandedBrands));

  if (newState) {
    productsList.classList.add("expanded");
  } else {
    productsList.classList.remove("expanded");
  }
}

// ============================================================
// INICIALIZAR DESPLEGABLES
// ============================================================
function initCollapsibles() {
  const headers = document.querySelectorAll("[data-brand-header]");
  if (!headers.length) return;

  headers.forEach(header => {
    const brand = header.dataset.brandName;
    const section = document.querySelector(`[data-brand-section="${brand}"]`);
    const productList = section?.querySelector("[data-products-list]");

    if (!brand || !productList) return;

    header.style.cursor = "pointer";
    header.addEventListener("click", () => toggleBrand(brand));

    // Restaurar estado desde localStorage
    if (expandedBrands[brand] === false) {
      productList.classList.remove("expanded");
    } else {
      productList.classList.add("expanded");
    }
  });

  console.log("✅ Desplegables de inventario listos");
}

// ============================================================
// OBSERVER - Detecta cuando inventario se actualiza
// ============================================================
const invObserver = new MutationObserver(() => {
  ensureSearchBar();
  initCollapsibles();
});

document.addEventListener("DOMContentLoaded", () => {
  ensureSearchBar();
  initCollapsibles();

  invObserver.observe(document.getElementById("inventory-list") || document.body, {
    childList: true,
    subtree: true
  });
});

console.log("✅ inventory-enhanced.js (PRO) listo");