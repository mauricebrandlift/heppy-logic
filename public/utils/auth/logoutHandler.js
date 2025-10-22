/**
 * Logout Handler
 * Handles logout button clicks throughout the application
 * 
 * Dependencies:
 * - authClient.js for logout functionality
 */

import { authClient } from './authClient.js';

/**
 * Initialize logout handlers for all logout buttons
 */
export function initLogoutHandlers() {
  const logoutButtons = document.querySelectorAll('[data-action="auth-logout"]');
  
  if (logoutButtons.length === 0) {
    console.log('ℹ️ [LogoutHandler] Geen logout buttons gevonden op deze pagina');
    return;
  }

  logoutButtons.forEach(button => {
    button.addEventListener('click', handleLogout);
  });

  console.log(`✅ [LogoutHandler] ${logoutButtons.length} logout button(s) geïnitialiseerd`);
}

/**
 * Handle logout button click
 * @param {Event} e - Click event
 */
async function handleLogout(e) {
  e.preventDefault();
  
  console.log('👋 [LogoutHandler] Uitloggen gestart...');
  
  try {
    // Call authClient logout
    const result = await authClient.logout();
    
    if (result.success) {
      console.log('✅ [LogoutHandler] Uitloggen succesvol');
      
      // Dispatch auth:logout event voor reactieve components
      document.dispatchEvent(new CustomEvent('auth:logout'));
      
      // Reload page om state te resetten
      window.location.reload();
    } else {
      console.error('❌ [LogoutHandler] Uitloggen mislukt:', result.error);
      // Reload anyway om safe te zijn
      window.location.reload();
    }
  } catch (error) {
    console.error('[LogoutHandler] Error tijdens logout:', error);
    // Reload anyway om safe te zijn
    window.location.reload();
  }
}
