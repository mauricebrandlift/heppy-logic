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
  
  // Check if there are debug logs from previous logout
  const previousLogout = localStorage.getItem('logout_debug');
  if (previousLogout) {
    console.log('📜 [LogoutHandler] === PREVIOUS LOGOUT DEBUG LOGS ===');
    const logs = JSON.parse(previousLogout);
    logs.forEach(log => console.log(log));
    console.log('📜 [LogoutHandler] === END PREVIOUS LOGOUT LOGS ===');
    localStorage.removeItem('logout_debug'); // Clear after reading
  }
  
  const logoutButtons = document.querySelectorAll('[data-action="auth-logout"]');
  
  if (logoutButtons.length === 0) {
    console.log('ℹ️ [LogoutHandler] Geen logout buttons gevonden op deze pagina');
    return;
  }

  logoutButtons.forEach((button, index) => {
    button.addEventListener('click', handleLogout);
    console.log(`✅ [LogoutHandler] Logout button #${index + 1} geregistreerd`);
    
    // Log button attributes for debugging
    const hasPreventReload = button.hasAttribute('data-prevent-reload');
    console.log(`   → Has data-prevent-reload: ${hasPreventReload}`);
  });

  console.log(`✅ [LogoutHandler] ${logoutButtons.length} logout button(s) geïnitialiseerd`);
}

/**
 * Handle logout button click
 * @param {Event} e - Click event
 */
async function handleLogout(e) {
  e.preventDefault();
  
  // Create persistent log for debugging
  const debugLog = [];
  const addLog = (msg) => {
    console.log(msg);
    debugLog.push(msg);
    localStorage.setItem('logout_debug', JSON.stringify(debugLog));
  };
  
  addLog('👋 [LogoutHandler] === LOGOUT GESTART ===');
  addLog('🔄 [LogoutHandler] Aanroepen authClient.logout()...');
  
  // Check if this button has data-prevent-reload attribute
  const preventReload = e.currentTarget.hasAttribute('data-prevent-reload');
  addLog(`🔍 [LogoutHandler] Prevent reload: ${preventReload}`);
  addLog(`🔍 [LogoutHandler] Button element: ${e.currentTarget.tagName}`);
  addLog(`🔍 [LogoutHandler] Button attributes: ${Array.from(e.currentTarget.attributes).map(a => `${a.name}="${a.value}"`).join(', ')}`);
  
  try {
    const logoutStartTime = Date.now();
    
    // Call authClient logout
    // Pass 'redirect' as reason when preventReload is true to prevent authClient from redirecting
    const logoutReason = preventReload ? 'redirect' : undefined;
    await authClient.logout(logoutReason);
    
    const logoutDuration = Date.now() - logoutStartTime;
    addLog(`⏱️ [LogoutHandler] Logout request duurde ${logoutDuration}ms`);
    addLog('✅ [LogoutHandler] Uitloggen succesvol');
    
    // Dispatch auth:logout event voor reactieve components
    const logoutEvent = new CustomEvent('auth:logout');
    document.dispatchEvent(logoutEvent);
    addLog('📢 [LogoutHandler] auth:logout event dispatched');
    
    if (preventReload) {
      // Button heeft data-prevent-reload: dispatch event zonder reload
      addLog('🔄 [LogoutHandler] Prevent reload = true, refresh wrapper state zonder reload...');
      document.dispatchEvent(new CustomEvent('auth:state-changed', { 
        detail: { role: 'guest' } 
      }));
      addLog('✅ [LogoutHandler] auth:state-changed event dispatched, NO RELOAD');
    } else {
      // Normale logout: reload page (authClient.logout already redirected if reason was not 'redirect')
      addLog('🔄 [LogoutHandler] Prevent reload = false, page should have redirected to /inloggen');
    }
  } catch (error) {
    console.error('❌ [LogoutHandler] Error tijdens logout:', error);
    console.error('🔍 [LogoutHandler] Error details:', {
      message: error.message,
      stack: error.stack
    });
    
    if (!preventReload) {
      console.warn('⚠️ [LogoutHandler] Error, reloading page voor safety...');
      window.location.reload();
    } else {
      console.warn('⚠️ [LogoutHandler] Error, maar preventReload=true, geen reload');
      // Dispatch event toch zodat UI kan reageren
      document.dispatchEvent(new CustomEvent('auth:state-changed', { 
        detail: { role: 'guest' } 
      }));
    }
  }
}
