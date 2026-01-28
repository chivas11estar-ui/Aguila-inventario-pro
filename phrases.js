// ============================================================
// Águila Inventario Pro - Módulo: phrases.js
// Gestión de Frases Motivacionales
// ============================================================

let userMotivationalPhrases = [];
let userPhrasesRef = null;

// ============================================================
// INICIALIZACIÓN DEL MÓDULO
// ============================================================
function initMotivationalPhrases(userId) {
  console.log('💬 Inicializando módulo de frases motivacionales...');
  if (!userId) {
    console.error('❌ ID de usuario no proporcionado para frases.');
    return;
  }
  userPhrasesRef = firebase.database().ref(`usuarios/${userId}/frasesMotivacionales`);

  // Listener para cambios en tiempo real
  userPhrasesRef.on('value', (snapshot) => {
    if (snapshot.exists()) {
      userMotivationalPhrases = Object.entries(snapshot.val()).map(([id, value]) => ({ id, text: value.text }));
    } else {
      // Si no hay frases, se puede añadir una por defecto
      userMotivationalPhrases = [{ id: 'default', text: '¡A darlo todo hoy! 🦅' }];
    }
    console.log('📚 Frases cargadas:', userMotivationalPhrases.length);
    
    // Si el contenedor de la lista es visible, renderizar
    if (document.getElementById('phrases-list')) {
        renderPhrasesList();
    }
    // Mostrar una frase al azar en el header
    displayRandomPhrase();
  });

  setupPhrasesEventListeners();
}

// ============================================================
// MOSTRAR FRASE ALEATORIA EN EL HEADER
// ============================================================
function displayRandomPhrase() {
  const phraseContainer = document.getElementById('motivational-phrase');
  if (!phraseContainer || userMotivationalPhrases.length === 0) {
    return;
  }
  const randomIndex = Math.floor(Math.random() * userMotivationalPhrases.length);
  const randomPhrase = userMotivationalPhrases[randomIndex];
  phraseContainer.textContent = `"${randomPhrase.text}"`;
}

// ============================================================
// RENDERIZAR LA LISTA DE FRASES EN EL PERFIL
// ============================================================
function renderPhrasesList() {
  const listContainer = document.getElementById('phrases-list');
  if (!listContainer) return;

  if (userMotivationalPhrases.length === 0 || (userMotivationalPhrases.length === 1 && userMotivationalPhrases[0].id === 'default')) {
    listContainer.innerHTML = '<p style="text-align:center; color: #9ca3af;">Aún no has añadido frases personalizadas.</p>';
    return;
  }

  listContainer.innerHTML = userMotivationalPhrases.map(phrase => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid #f3f4f6;">
      <span style="color: #1f2937; font-style: italic;">“${phrase.text}”</span>
      ${phrase.id !== 'default' ? `
      <button 
        onclick="deleteMotivationalPhrase('${phrase.id}')" 
        class="btn-icon error" 
        style="font-size: 16px; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;"
        title="Eliminar frase"
      >
        ❌
      </button>
      ` : ''}
    </div>
  `).join('');
}


// ============================================================
// AÑADIR UNA NUEVA FRASE
// ============================================================
async function addMotivationalPhrase(event) {
    event.preventDefault();
    const input = document.getElementById('new-phrase-input');
    const phraseText = input.value.trim();

    if (!phraseText) {
        showToast('⚠️ Escribe una frase para añadir.', 'warning');
        return;
    }
    
    if (!userPhrasesRef) {
        showToast('❌ Error de conexión. No se pudo guardar la frase.', 'error');
        return;
    }

    // Si la única frase es la por defecto, eliminarla antes de añadir la nueva.
    if (userMotivationalPhrases.length === 1 && userMotivationalPhrases[0].id === 'default') {
        await userPhrasesRef.set(null);
    }
    
    try {
        await userPhrasesRef.push({ text: phraseText });
        showToast('✅ ¡Frase añadida con éxito!', 'success');
        input.value = '';
    } catch (error) {
        console.error('❌ Error añadiendo frase:', error);
        showToast('❌ No se pudo guardar la frase. Error: ' + error.message, 'error');
    }
}

// ============================================================
// ELIMINAR UNA FRASE
// ============================================================
async function deleteMotivationalPhrase(phraseId) {
  if (!confirm('¿Estás seguro de que quieres eliminar esta frase?')) {
    return;
  }

  if (!userPhrasesRef) {
    showToast('❌ Error de conexión. No se pudo eliminar la frase.', 'error');
    return;
  }

  try {
    await userPhrasesRef.child(phraseId).remove();
    showToast('🗑️ Frase eliminada.', 'info');
  } catch (error) {
    console.error('❌ Error eliminando frase:', error);
    showToast('❌ No se pudo eliminar la frase. Error: ' + error.message, 'error');
  }
}


// ============================================================
// CONFIGURAR EVENT LISTENERS
// ============================================================
function setupPhrasesEventListeners() {
    const form = document.getElementById('add-phrase-form');
    if (form) {
        // Asegurarse de no añadir el listener múltiples veces
        if (!form.dataset.listenerAttached) {
            form.addEventListener('submit', addMotivationalPhrase);
            form.dataset.listenerAttached = 'true';
        }
    }
}

// Exponer la función de eliminación al scope global para el onclick
window.deleteMotivationalPhrase = deleteMotivationalPhrase;

// Inicialización diferida
document.addEventListener('DOMContentLoaded', () => {
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            initMotivationalPhrases(user.uid);
        }
    });
});

console.log('✅ phrases.js cargado correctamente');
