// public/pages/dashboardSchoonmakerChatPage.js
/**
 * Entry point voor dashboard schoonmaker chat pagina
 */
import { initChat } from '../forms/dashboardSchoonmaker/chatInit.js';

// Start chat wanneer DOM geladen is
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initChat);
} else {
  initChat();
}
