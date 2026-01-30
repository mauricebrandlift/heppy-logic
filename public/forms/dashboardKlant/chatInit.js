// public/forms/dashboardKlant/chatInit.js
/**
 * Chat pagina initialisatie
 * WhatsApp-achtige chat interface tussen klant en schoonmaker
 */
import { apiClient } from '../../utils/api/client.js';
import { authClient } from '../../utils/auth/authClient.js';

let currentChatUser = null;
let pollingInterval = null;
let laatsteBerichtId = null; // Track laatste bericht voor polling
let isInitialLoad = true;

/**
 * Formatteer tijd voor schoonmaker lijst preview
 * Vandaag = tijdstip (14:32), anders = datum (28 jan)
 */
function formatTimeForList(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    // Vandaag: toon alleen tijd
    return date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  } else {
    // Andere dag: toon datum
    return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
  }
}

/**
 * Formatteer tijd voor chat berichten
 * Volledige datum + tijd
 */
function formatTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString('nl-NL', { 
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Verkort tekst voor preview
 */
function truncateText(text, maxLength = 50) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Haal gekoppelde schoonmakers op en render links
 */
async function loadSchoonmakersList() {
  console.log('📋 [Chat] Laden schoonmakers lijst...');

  const listContainer = document.querySelector('[data-schoonmaker-list-container]');
  const emptyState = document.querySelector('[data-schoonmaker-empty]');
  const template = document.querySelector('[data-schoonmaker-list-item]');

  if (!listContainer || !template) {
    console.error('[Chat] List container of template niet gevonden');
    return;
  }

  try {
    const authState = authClient.getAuthState();
    if (!authState?.access_token) {
      console.error('[Chat] Geen auth token');
      return;
    }

    // Haal schoonmakers op
    const data = await apiClient('/routes/berichten/schoonmakers', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authState.access_token}`
      }
    });

    console.log(`✅ [Chat] ${data.gebruikers.length} schoonmakers opgehaald`);

    // Toggle empty state - gebruik display style
    if (data.gebruikers.length === 0) {
      if (emptyState) emptyState.style.display = 'block';
      if (template) template.style.display = 'none';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    // Clear bestaande items
    const parent = template.parentElement;
    const existingItems = parent.querySelectorAll('[data-schoonmaker-list-item]:not([data-schoonmaker-list-item][data-schoonmaker-id=""])');
    existingItems.forEach(item => item.remove());

    // Render schoonmakers
    data.gebruikers.forEach((schoonmaker, index) => {
      const clone = template.cloneNode(true);
      clone.setAttribute('data-schoonmaker-id', schoonmaker.id);
      clone.classList.remove('schoonmaker-item-template');
      clone.style.display = ''; // Zichtbaar maken

      // Vul data in
      const fotoEl = clone.querySelector('[data-schoonmaker-foto]');
      const naamEl = clone.querySelector('[data-schoonmaker-naam]');
      const previewEl = clone.querySelector('[data-laatste-bericht-preview]');
      const datumTijdEl = clone.querySelector('[data-laatste-bericht-datum-tijd]');
      const badgeEl = clone.querySelector('[data-ongelezen-badge]');

      if (fotoEl && schoonmaker.foto_url) {
        fotoEl.src = schoonmaker.foto_url;
        fotoEl.alt = `${schoonmaker.voornaam} ${schoonmaker.achternaam}`;
      }

      if (naamEl) {
        naamEl.textContent = `${schoonmaker.voornaam} ${schoonmaker.achternaam || ''}`.trim();
      }

      if (previewEl) {
        if (schoonmaker.laatsteBericht) {
          previewEl.textContent = truncateText(schoonmaker.laatsteBericht.inhoud);
        } else {
          previewEl.textContent = 'Nog geen berichten';
          previewEl.style.fontStyle = 'italic';
          previewEl.style.opacity = '0.6';
        }
      }

      if (datumTijdEl) {
        if (schoonmaker.laatsteBericht) {
          datumTijdEl.textContent = formatTimeForList(schoonmaker.laatsteBericht.aangemaakt_op);
        } else {
          datumTijdEl.textContent = '';
        }
      }

      if (badgeEl) {
        if (schoonmaker.ongelezenCount > 0) {
          badgeEl.textContent = schoonmaker.ongelezenCount;
          badgeEl.style.display = 'block';
        } else {
          badgeEl.style.display = 'none';
        }
      }

      // Click handler: open chat
      clone.addEventListener('click', () => {
        openChat(schoonmaker);
      });

      parent.appendChild(clone);

      // Open eerste chat automatisch bij initial load
      if (index === 0 && isInitialLoad) {
        isInitialLoad = false;
        setTimeout(() => openChat(schoonmaker), 100);
      }
    });

    template.style.display = 'none';

  } catch (error) {
    console.error('❌ [Chat] Error bij laden schoonmakers:', error);
    if (emptyState) {
      emptyState.style.display = 'block';
      emptyState.textContent = 'Er ging iets mis bij het laden van je chats.';
    }
  }
}

/**
 * Open chat met een schoonmaker
 */
async function openChat(schoonmaker) {
  console.log(`💬 [Chat] Open chat met ${schoonmaker.id}`);

  currentChatUser = schoonmaker;

  // Update actieve state in lijst - gebruik is-active
  const allItems = document.querySelectorAll('[data-schoonmaker-list-item]');
  allItems.forEach(item => {
    if (item.getAttribute('data-schoonmaker-id') === schoonmaker.id) {
      item.classList.add('is-active');
    } else {
      item.classList.remove('is-active');
    }
  });

  // Update chat header
  const chatFoto = document.querySelector('[data-chat-foto]');
  const chatNaam = document.querySelector('[data-chat-naam]');

  if (chatFoto && schoonmaker.foto_url) {
    chatFoto.src = schoonmaker.foto_url;
    chatFoto.alt = `${schoonmaker.voornaam} ${schoonmaker.achternaam}`;
  }

  if (chatNaam) {
    chatNaam.textContent = `${schoonmaker.voornaam} ${schoonmaker.achternaam || ''}`.trim();
  }

  // Toon chat container, verberg empty state
  const chatContainer = document.querySelector('[data-chat-container]');
  const chatHeader = document.querySelector('[data-chat-header]');
  const berichtenFormWrapper = document.querySelector('[data-berichten-form-wrapper]');
  const emptyChat = document.querySelector('[data-chat-empty]');
  
  if (chatContainer) chatContainer.style.display = 'block';
  if (chatHeader) chatHeader.style.display = 'block';
  if (berichtenFormWrapper) berichtenFormWrapper.style.display = 'block';
  if (emptyChat) emptyChat.style.display = 'none';

  // Laad berichten
  await loadChatMessages(schoonmaker.id);

  // Start polling voor nieuwe berichten
  startPolling(schoonmaker.id);

  // Markeer berichten als gelezen
  await markAsRead(schoonmaker.id);

  // Update ongelezen badge naar 0
  const listItem = document.querySelector(`[data-schoonmaker-id="${schoonmaker.id}"]`);
  if (listItem) {
    const badge = listItem.querySelector('[data-ongelezen-badge]');
    if (badge) {
      badge.style.display = 'none';
    }
  }
}

/**
 * Laad chat berichten
 */
async function loadChatMessages(anderePersoonId, scrollToTop = true) {
  console.log(`📥 [Chat] Laden berichten met ${anderePersoonId}`);
  
  const chatContainer = document.querySelector('[data-chat-container]');
  const chatLoadingState = document.querySelector('[data-chat-loading-state]');
  const berichtenContainer = document.querySelector('[data-berichten-container]');
  const template = document.querySelector('[data-bericht-item]');
  const emptyChat = document.querySelector('[data-chat-leeg]');

  if (!berichtenContainer || !template) {
    console.error('[Chat] Berichten container of template niet gevonden');
    return;
  }

  // Toon loading state
  if (chatLoadingState) chatLoadingState.style.display = 'block';
  if (berichtenContainer) berichtenContainer.style.display = 'none';
  if (emptyChat) emptyChat.style.display = 'none';

  try {
    const authState = authClient.getAuthState();
    if (!authState?.access_token) {
      console.error('[Chat] Geen auth token');
      return;
    }

    const userId = authState.user.id;

    // Haal berichten op (bij polling: alleen nieuwe berichten)
    let url = `/routes/berichten/chat?andere_persoon_id=${anderePersoonId}`;
    if (laatsteBerichtId && !scrollToTop) {
      // Bij polling: alleen berichten NA laatste bekende bericht
      url += `&na_bericht_id=${laatsteBerichtId}`;
    }
    
    const data = await apiClient(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authState.access_token}`
      }
    });

    console.log(`✅ [Chat] ${data.berichten.length} berichten opgehaald`);

    // Bij volledige load (niet polling): clear laatste bericht ID
    if (scrollToTop) {
      laatsteBerichtId = null;
    }

    // Verberg loading state
    if (chatLoadingState) chatLoadingState.style.display = 'none';

    // Als polling en geen nieuwe berichten: return vroeg
    if (!scrollToTop && data.berichten.length === 0) {
      console.log('🔄 [Chat] Geen nieuwe berichten bij polling');
      return;
    }

    // Toggle empty state (alleen bij volledige load)
    if (scrollToTop && data.berichten.length === 0) {
      if (emptyChat) {
        emptyChat.style.display = 'block';
        const chatNaam = document.querySelector('[data-chat-naam]')?.textContent || 'deze schoonmaker';
        emptyChat.textContent = `Nog geen berichten met ${chatNaam}. Stuur een bericht om de chat te starten!`;
      }
      if (berichtenContainer) berichtenContainer.style.display = 'none';
      return;
    }

    if (emptyChat) emptyChat.style.display = 'none';
    if (berichtenContainer) berichtenContainer.style.display = 'flex';

    const parent = template.parentElement;
    
    // Bij volledige load: clear bestaande items, bij polling: append alleen
    if (scrollToTop) {
      const existingItems = parent.querySelectorAll('[data-bericht-item]:not(.bericht-item-template)');
      existingItems.forEach(item => item.remove());
    }

    // Render berichten (nieuwste bovenaan, dus DESC volgorde is al goed)
    data.berichten.forEach(bericht => {
      const clone = template.cloneNode(true);
      clone.setAttribute('data-bericht-id', bericht.id);
      clone.classList.remove('bericht-item-template');
      clone.style.display = ''; // Zichtbaar maken

      // Bepaal of ontvangen of verzonden
      const isOntvangen = bericht.verzender_id !== userId;
      if (isOntvangen) {
        clone.classList.add('is-ontvangen');
      } else {
        clone.classList.add('is-verzonden');
      }

      // Vul data in
      const naamEl = clone.querySelector('[data-bericht-naam]');
      const tekstEl = clone.querySelector('[data-bericht-tekst]');
      const tijdEl = clone.querySelector('[data-bericht-tijd]');

      if (naamEl) {
        naamEl.textContent = isOntvangen ? 
          (currentChatUser ? `${currentChatUser.voornaam} ${currentChatUser.achternaam || ''}`.trim() : 'Schoonmaker') : 
          'Jij';
      }

      if (tekstEl) {
        tekstEl.textContent = bericht.inhoud;
      }

      if (tijdEl) {
        tijdEl.textContent = formatTime(bericht.aangemaakt_op);
      }

      // Voeg toe BOVEN aan de container (nieuwste bovenaan)
      if (parent.firstChild && parent.firstChild !== template) {
        parent.insertBefore(clone, parent.firstChild);
      } else {
        parent.appendChild(clone);
      }
    });

    // Update laatste bericht ID (eerste in array = nieuwste, want DESC order)
    if (data.berichten.length > 0) {
      laatsteBerichtId = data.berichten[0].id;
    }

    template.style.display = 'none';

    // Scroll naar boven (nieuwste bericht)
    if (scrollToTop && berichtenContainer) {
      berichtenContainer.scrollTop = 0;
    }

  } catch (error) {
    console.error('❌ [Chat] Error bij laden berichten:', error);
    
    // Verberg loading, toon error
    if (chatLoadingState) chatLoadingState.style.display = 'none';
    if (emptyChat) {
      emptyChat.style.display = 'block';
      emptyChat.textContent = 'Er ging iets mis bij het laden van berichten.';
    }
    console.error('❌ [Chat] Error bij laden berichten:', error);
  }
}

/**
 * Verstuur een nieuw bericht
 */
async function verstuurBericht() {
  if (!currentChatUser) {
    console.error('[Chat] Geen actieve chat');
    return;
  }

  const inputEl = document.querySelector('[data-bericht-input]');
  if (!inputEl) {
    console.error('[Chat] Input element niet gevonden');
    return;
  }

  const inhoud = inputEl.value.trim();
  if (!inhoud) {
    return; // Lege berichten niet versturen
  }

  console.log(`📤 [Chat] Verstuur bericht naar ${currentChatUser.id}`);

  try {
    const authState = authClient.getAuthState();
    if (!authState?.access_token) {
      console.error('[Chat] Geen auth token');
      return;
    }

    await apiClient('/routes/berichten/verstuur', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authState.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ontvanger_id: currentChatUser.id,
        inhoud,
        match_id: currentChatUser.matchId || null
      })
    });

    console.log(`✅ [Chat] Bericht verstuurd`);

    // Clear input
    inputEl.value = '';

    // Herlaad berichten
    await loadChatMessages(currentChatUser.id, true);

    // Update schoonmaker lijst (laatste bericht preview)
    await loadSchoonmakersList();

  } catch (error) {
    console.error('❌ [Chat] Error bij versturen bericht:', error);
    alert('Er ging iets mis bij het versturen van je bericht. Probeer het opnieuw.');
  }
}

/**
 * Markeer berichten als gelezen
 */
async function markAsRead(anderePersoonId) {
  try {
    const authState = authClient.getAuthState();
    if (!authState?.access_token) return;

    await apiClient('/routes/berichten/markeer-gelezen', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authState.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        andere_persoon_id: anderePersoonId
      })
    });

    console.log('✅ [Chat] Berichten gemarkeerd als gelezen');
  } catch (error) {
    console.error('⚠️ [Chat] Markeren als gelezen mislukt:', error);
  }
}

/**
 * Start polling voor nieuwe berichten
 */
function startPolling(anderePersoonId) {
  // Stop bestaande polling
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }

  // Poll elke 30 seconden
  pollingInterval = setInterval(async () => {
    if (currentChatUser && currentChatUser.id === anderePersoonId) {
      console.log('🔄 [Chat] Polling nieuwe berichten...');
      await loadChatMessages(anderePersoonId, false); // Niet scrollen bij refresh
      await loadSchoonmakersList(); // Update lijst voor nieuwe badges
    }
  }, 30000); // 30 seconden
}

/**
 * Stop polling
 */
function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

/**
 * Initialiseer chat pagina
 */
export async function initChat() {
  console.log('💬 [Chat] Initialiseren chat pagina...');

  // Check auth
  const authState = authClient.getAuthState();
  if (!authState || !authState.access_token) {
    console.error('[Chat] Geen auth token - redirect naar login');
    window.location.href = '/login';
    return;
  }

  // Toon loading state
  const loadingState = document.querySelector('[data-loading-state]');
  const contentState = document.querySelector('[data-content-state]');
  
  if (loadingState) loadingState.style.display = 'block';
  if (contentState) contentState.style.display = 'none';

  // Zet initial state rechterkant: alleen empty state zichtbaar
  const chatContainer = document.querySelector('[data-chat-container]');
  const chatHeader = document.querySelector('[data-chat-header]');
  const berichtenFormWrapper = document.querySelector('[data-berichten-form-wrapper]');
  const emptyChat = document.querySelector('[data-chat-empty]');
  
  if (chatContainer) chatContainer.style.display = 'none';
  if (chatHeader) chatHeader.style.display = 'none';
  if (berichtenFormWrapper) berichtenFormWrapper.style.display = 'none';
  if (emptyChat) emptyChat.style.display = 'block';

  try {
    // Laad schoonmakers lijst
    await loadSchoonmakersList();

    // Verberg loading, toon content
    if (loadingState) loadingState.style.display = 'none';
    if (contentState) contentState.style.display = 'block';

  } catch (error) {
    console.error('❌ [Chat] Initialisatie error:', error);
    
    // Toon error state
    if (loadingState) loadingState.style.display = 'none';
    if (contentState) {
      contentState.style.display = 'block';
      const emptyState = document.querySelector('[data-schoonmaker-empty]');
      if (emptyState) {
        emptyState.style.display = 'block';
        emptyState.textContent = 'Er ging iets mis bij het laden. Probeer de pagina te verversen.';
      }
    }
  }

  // Setup form submit handler
  const form = document.querySelector('[data-bericht-form]');
  const submitBtn = document.querySelector('[data-bericht-submit]');
  const inputEl = document.querySelector('[data-bericht-input]');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await verstuurBericht();
    });
  }

  if (submitBtn) {
    submitBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await verstuurBericht();
    });
  }

  // Enter key in input (zonder Shift = verstuur)
  if (inputEl) {
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        verstuurBericht();
      }
    });
  }

  // Cleanup bij page unload
  window.addEventListener('beforeunload', () => {
    stopPolling();
  });

  console.log('✅ [Chat] Chat pagina geïnitialiseerd');
}
