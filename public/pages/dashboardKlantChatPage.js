// public/pages/dashboardKlantChatPage.js
/**
 * Entry point voor dashboard klant chat pagina
 */
import { initChat } from '../forms/dashboardKlant/chatInit.js';

// Start chat wanneer DOM geladen is
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initChat);
} else {
  initChat();
}
