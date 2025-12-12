// public/pages/verifyEmailPage.js
/**
 * Email Verificatie Pagina
 * 
 * Wordt geladen wanneer gebruiker op verificatie link klikt in email.
 * URL format: /dashboard/klant/verify-email?token=xxx
 * 
 * Flow:
 * 1. Haal token uit URL
 * 2. Roep verify-email-change endpoint aan
 * 3. Toon success of error message
 * 4. Redirect naar dashboard na 3 seconden (bij success)
 */

import { apiClient } from '../utils/api/client.js';

export function initVerifyEmailPage() {
  // Check of we op de juiste pagina zitten
  const pageIdentifier = document.querySelector('[data-dashboard-page="verify-email"]');
  if (!pageIdentifier) return;

  console.log('[VerifyEmail] Pagina geladen');

  // UI elementen
  const loadingEl = document.querySelector('[data-verify-status="loading"]');
  const successEl = document.querySelector('[data-verify-status="success"]');
  const errorEl = document.querySelector('[data-verify-status="error"]');
  const errorMessageEl = document.querySelector('[data-verify-error-message]');

  // Hide all states initially via attribute
  if (loadingEl) loadingEl.style.display = 'none';
  if (successEl) successEl.style.display = 'none';
  if (errorEl) errorEl.style.display = 'none';

  // Show loading state
  if (loadingEl) loadingEl.style.display = 'block';

  // Haal token uit URL
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');

  if (!token) {
    console.error('[VerifyEmail] Geen token in URL');
    showError('Ongeldige verificatie link. Token ontbreekt.');
    return;
  }

  // Verify email via API
  verifyEmail(token);

  function showLoading() {
    if (loadingEl) loadingEl.style.display = 'block';
    if (successEl) successEl.style.display = 'none';
    if (errorEl) errorEl.style.display = 'none';
  }

  function showSuccess(message) {
    if (loadingEl) loadingEl.style.display = 'none';
    if (successEl) {
      successEl.style.display = 'block';
      const messageEl = successEl.querySelector('[data-success-message]');
      if (messageEl && message) {
        messageEl.textContent = message;
      }
    }
    if (errorEl) errorEl.style.display = 'none';

    // Redirect naar dashboard na 3 seconden
    setTimeout(() => {
      window.location.href = '/dashboard/klant';
    }, 3000);
  }

  function showError(message) {
    if (loadingEl) loadingEl.style.display = 'none';
    if (successEl) successEl.style.display = 'none';
    if (errorEl) {
      errorEl.style.display = 'block';
      if (errorMessageEl) {
        errorMessageEl.textContent = message || 'Er ging iets mis bij het verifiëren van je email.';
      }
    }
  }

  async function verifyEmail(token) {
    try {
      console.log('[VerifyEmail] Verificatie starten...');

      const result = await apiClient(`/routes/dashboard/klant/verify-email-change?token=${token}`, {
        method: 'GET'
      });

      console.log('[VerifyEmail] ✅ Email geverifieerd:', result);

      let successMessage = 'Je email is succesvol gewijzigd!';
      if (result.schoonmakerGenotificeerd) {
        successMessage += ' Je schoonmaker is automatisch op de hoogte gebracht.';
      }

      showSuccess(successMessage);

    } catch (error) {
      console.error('[VerifyEmail] ❌ Fout:', error);

      let errorMessage = 'Er ging iets mis bij het verifiëren van je email.';

      // Specifieke foutmeldingen
      if (error.error === 'TOKEN_NOT_FOUND') {
        errorMessage = 'Ongeldige verificatie link. Controleer of je de juiste link hebt gebruikt.';
      } else if (error.error === 'TOKEN_ALREADY_USED') {
        errorMessage = 'Deze verificatie link is al gebruikt. Je email is waarschijnlijk al gewijzigd.';
      } else if (error.error === 'TOKEN_EXPIRED') {
        errorMessage = 'Deze verificatie link is verlopen. Vraag een nieuwe email wijziging aan via je dashboard.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      showError(errorMessage);
    }
  }
}

// Auto-init wanneer DOM ready is
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initVerifyEmailPage);
} else {
  initVerifyEmailPage();
}
