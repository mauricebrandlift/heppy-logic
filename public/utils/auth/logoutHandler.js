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
  console.log('🚪 [LogoutHandler] Initialiseren...');
  
  const logoutButtons = document.querySelectorAll('[data-action="auth-logout"]');
  
  if (logoutButtons.length === 0) {
    console.log('ℹ️ [LogoutHandler] Geen logout buttons gevonden op deze pagina');
    return;
  }

  logoutButtons.forEach((button, index) => {
    button.addEventListener('click', handleLogout);
    console.log(`✅ [LogoutHandler] Logout button #${index + 1} geregistreerd`);
  });

  console.log(`✅ [LogoutHandler] ${logoutButtons.length} logout button(s) geïnitialiseerd`);
}

/**
 * Handle logout button click
 * @param {Event} e - Click event
 */
async function handleLogout(e) {
  e.preventDefault();
  
  console.log('👋 [LogoutHandler] === LOGOUT GESTART ===');
  console.log('🔄 [LogoutHandler] Aanroepen authClient.logout()...');
  
  try {
    const logoutStartTime = Date.now();
    
    // Call authClient logout
    const result = await authClient.logout();
    
    const logoutDuration = Date.now() - logoutStartTime;
    console.log(`⏱️ [LogoutHandler] Logout request duurde ${logoutDuration}ms`);
    
    if (result.success) {
      console.log('✅ [LogoutHandler] Uitloggen succesvol');
      
      // Dispatch auth:logout event voor reactieve components
      const logoutEvent = new CustomEvent('auth:logout');
      document.dispatchEvent(logoutEvent);
      console.log('📢 [LogoutHandler] auth:logout event dispatched');
      
      // Check of het abonnement aanvraag formulier bestaat op deze pagina
      const persoonsgegevensForm = document.querySelector('[data-form-name="abb_persoonsgegevens-form"]');
      
      console.log('🔍 [LogoutHandler] Persoonsgegevens form exists:', !!persoonsgegevensForm);
      console.log('🔍 [LogoutHandler] Current URL:', window.location.pathname);
      
      if (persoonsgegevensForm) {
        // Formulier bestaat: we zijn op de abonnement aanvraag pagina
        console.log('🔄 [LogoutHandler] Op abonnement pagina, refresh wrapper state zonder reload...');
        document.dispatchEvent(new CustomEvent('auth:state-changed', { 
          detail: { role: 'guest' } 
        }));
      } else {
        // Formulier bestaat niet: andere pagina
        console.log('🔄 [LogoutHandler] Niet op abonnement pagina, reloading...');
        window.location.reload();
      }
    } else {
      console.error('❌ [LogoutHandler] Uitloggen mislukt:', result.error);
      console.warn('⚠️ [LogoutHandler] Reloading page anyway voor safety...');
      // Reload anyway om safe te zijn
      window.location.reload();
    }
  } catch (error) {
    console.error('❌ [LogoutHandler] Error tijdens logout:', error);
    console.error('🔍 [LogoutHandler] Error details:', {
      message: error.message,
      stack: error.stack
    });
    console.warn('⚠️ [LogoutHandler] Reloading page anyway voor safety...');
    // Reload anyway om safe te zijn
    window.location.reload();
  }
}
