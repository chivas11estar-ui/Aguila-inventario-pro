// ============================================================
// Águila Inventario Pro - Módulo: phrases.js
// Gestión de Frases Motivacionales
// Copyright © 2025 José A. G. Betancourt
// ============================================================

let userMotivationalPhrases = [];
let userPhrasesRef = null;
let currentUserName = 'Campeón'; // Valor por defecto

// ============================================================
// INICIALIZACIÓN DEL MÓDULO
// ============================================================
function initMotivationalPhrases(userId) {
  console.log('💬 Inicializando módulo de frases motivacionales...');
  if (!userId) {
    console.error('❌ ID de usuario no proporcionado para frases.');
    return;
  }

  // 1. Obtener el nombre del usuario una sola vez
  firebase.database().ref(`usuarios/${userId}/nombrePromotor`).once('value')
    .then(snap => {
      const name = snap.val();
      if (name) {
        // Tomar solo el primer nombre para que sea más corto
        currentUserName = name.split(' ')[0];
      }
    });

  userPhrasesRef = firebase.database().ref(`usuarios/${userId}/frasesMotivacionales`);

  // Listener para cambios en tiempo real
  userPhrasesRef.on('value', (snapshot) => {
    if (snapshot.exists()) {
      userMotivationalPhrases = Object.entries(snapshot.val()).map(([id, value]) => ({ id, text: value.text }));
    } else {
      // Si no hay frases, se puede añadir una por defecto con el placeholder
      userMotivationalPhrases = [{ id: 'default', text: '¡A darlo todo hoy, {nombre}! 🦅' }];
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

  // INICIO: Integración con IA
  if (window.displayDailyAIPhrase) {
    window.displayDailyAIPhrase().catch(err => {
      console.warn('⚠️ Falló frase IA, usando frases manuales:', err);
      displayRandomPhrase();
    });
  } else {
    displayRandomPhrase();
  }
}

// ============================================================
// MOSTRAR FRASE ALEATORIA EN EL HEADER
// ============================================================
function displayRandomPhrase() {
  const phraseContainer = document.getElementById('motivational-phrase');
  if (!phraseContainer || userMotivationalPhrases.length === 0) {
    return;
  }

  // No sobrescribir si ya hay una frase de la IA (las de la IA vienen entre comillas)
  if (phraseContainer.textContent && phraseContainer.textContent.startsWith('"') && !phraseContainer.dataset.isManual) {
    console.log('✨ Manteniendo frase de la IA');
    return;
  }

  const randomIndex = Math.floor(Math.random() * userMotivationalPhrases.length);
  const randomPhrase = userMotivationalPhrases[randomIndex];

  // Reemplazar el placeholder {nombre} por el nombre real
  const finalText = randomPhrase.text.replace(/{nombre}/g, currentUserName);

  phraseContainer.textContent = `"${finalText}"`;
  phraseContainer.dataset.isManual = 'true';
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
// AÑADIR UNA NUEVA FRASE (CON SANITIZACIÓN)
// ============================================================
async function addMotivationalPhrase(event) {
  event.preventDefault();
  const input = document.getElementById('new-phrase-input');
  
  // SANITIZACIÓN: Eliminar etiquetas HTML y caracteres de control (Anti-Injection/XSS)
  const rawText = input.value.trim();
  const phraseText = rawText
    .replace(/<[^>]*>/g, "") // Eliminar HTML
    .replace(/[{}()[\]]/g, "") // Eliminar llaves que puedan confundir placeholders
    .substring(0, 100); // Límite razonable

  if (!phraseText || phraseText.length < 3) {
    showToast('⚠️ La frase es muy corta o contiene caracteres prohibidos.', 'warning');
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
