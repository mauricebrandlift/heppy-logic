// public/forms/shared/chatStatsInit.js
/**
 * Chat statistieken component voor dashboard overview
 * Toont aantal gekoppelde schoonmakers en ongelezen berichten
 */
import { apiClient } from '../../utils/api/client.js';
import { authClient } from '../../utils/auth/authClient.js';

/**
 * Initialiseer chat statistieken
 */
export async function initChatStats() {
  console.log('💬 [ChatStats] Initialiseren...');

  const gekoppeldEl = document.querySelector('[data-chat-gekoppeld-count]');
  const ongelezenEl = document.querySelector('[data-chat-ongelezen-count]');

  if (!gekoppeldEl && !ongelezenEl) {
    console.warn('[ChatStats] Geen stats elements gevonden - chat stats worden niet getoond');
    return;
  }

  try {
    // Haal auth state op
    const authState = authClient.getAuthState();
    if (!authState || !authState.access_token) {
      console.error('[ChatStats] Geen auth token gevonden');
      return;
    }

    // Haal stats op
    const data = await apiClient('/routes/berichten/stats', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authState.access_token}`
      }
    });

    console.log(`✅ [ChatStats] Stats opgehaald:`, data);

    // Update DOM
    if (gekoppeldEl) {
      gekoppeldEl.textContent = data.aantalGekoppeld || '0';
    }

    if (ongelezenEl) {
      ongelezenEl.textContent = data.ongelezenCount || '0';
    }

  } catch (error) {
    console.error('❌ [ChatStats] Error:', error);
    
    // Toon 0 bij error
    if (gekoppeldEl) gekoppeldEl.textContent = '0';
    if (ongelezenEl) ongelezenEl.textContent = '0';
  }
}
