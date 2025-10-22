/**
 * Login Modal Component
 * Handles authentication modal UI interactions and login flow
 * 
 * Dependencies:
 * - authClient.js for authentication API calls
 * - formUi.js for button/spinner/error handling
 */

import { authClient } from './authClient.js';
import { showLoader, hideLoader, showError, hideError } from '../../forms/ui/formUi.js';

/**
 * Initialize login modal functionality
 * Sets up event listeners for opening, closing, and submitting the login modal
 */
export function initLoginModal() {
  const modalWrapper = document.querySelector('[data-modal-wrapper="login"]');
  const modal = document.querySelector('[data-modal="login"]');
  const backdrop = document.querySelector('[data-modal-backdrop="login"]');
  
  if (!modalWrapper || !modal) {
    console.warn('Login modal elements not found in DOM');
    return;
  }

  // Open modal triggers
  const openTriggers = document.querySelectorAll('[data-action="auth-open-login"]');
  openTriggers.forEach(trigger => {
    trigger.addEventListener('click', () => openModal(modalWrapper));
  });

  // Close modal triggers
  const closeTriggers = modal.querySelectorAll('[data-modal-close]');
  closeTriggers.forEach(trigger => {
    trigger.addEventListener('click', () => closeModal(modalWrapper));
  });

  // Backdrop click to close
  if (backdrop) {
    backdrop.addEventListener('click', () => closeModal(modalWrapper));
  }

  // Submit handler
  const submitTrigger = modal.querySelector('[data-modal-submit]');
  if (submitTrigger) {
    submitTrigger.addEventListener('click', (e) => handleLogin(e, modal, modalWrapper));
  }

  // Clear errors when user starts typing
  const emailField = modal.querySelector('[data-modal-field="emailadres"]');
  const passwordField = modal.querySelector('[data-modal-field="wachtwoord"]');
  
  [emailField, passwordField].forEach(field => {
    if (field) {
      field.addEventListener('input', () => clearModalErrors(modal));
    }
  });
}

/**
 * Open the login modal
 * @param {HTMLElement} modalWrapper - The modal wrapper element
 */
function openModal(modalWrapper) {
  if (!modalWrapper) return;
  
  modalWrapper.style.display = 'flex';
  // Clear any previous errors
  clearModalErrors(modalWrapper);
  // Reset form fields
  const form = modalWrapper.querySelector('[data-modal="login"]');
  if (form) {
    const emailField = form.querySelector('[data-modal-field="emailadres"]');
    const passwordField = form.querySelector('[data-modal-field="wachtwoord"]');
    if (emailField) emailField.value = '';
    if (passwordField) passwordField.value = '';
  }
}

/**
 * Close the login modal
 * @param {HTMLElement} modalWrapper - The modal wrapper element
 */
function closeModal(modalWrapper) {
  if (!modalWrapper) return;
  
  modalWrapper.style.display = 'none';
  clearModalErrors(modalWrapper);
}

/**
 * Handle login form submission
 * @param {Event} e - Click event
 * @param {HTMLElement} modal - The modal form element
 * @param {HTMLElement} modalWrapper - The modal wrapper element
 */
async function handleLogin(e, modal, modalWrapper) {
  e.preventDefault();

  const emailField = modal.querySelector('[data-modal-field="emailadres"]');
  const passwordField = modal.querySelector('[data-modal-field="wachtwoord"]');
  const submitButton = modal.querySelector('[data-modal-submit]');
  const generalError = modal.querySelector('[data-modal-error="general"]');

  // Clear previous errors
  clearModalErrors(modal);

  // Validate fields
  const email = emailField?.value?.trim();
  const password = passwordField?.value?.trim();

  if (!email) {
    const emailError = modal.querySelector('[data-modal-error="emailadres"]');
    showError(emailError, 'Vul je e-mailadres in');
    emailField?.focus();
    return;
  }

  if (!password) {
    const passwordError = modal.querySelector('[data-modal-error="wachtwoord"]');
    showError(passwordError, 'Vul je wachtwoord in');
    passwordField?.focus();
    return;
  }

  // Show loader
  showLoader(submitButton);

  try {
    // Call authClient login
    const result = await authClient.login(email, password);

    if (result.success) {
      // Hide loader
      hideLoader(submitButton);

      // Close modal
      closeModal(modalWrapper);

      // Dispatch auth:success event
      document.dispatchEvent(new CustomEvent('auth:success', {
        detail: {
          user: result.user,
          role: result.user?.role || 'klant'
        }
      }));

      console.log('Login successful, auth:success event dispatched');
    } else {
      // Show error
      hideLoader(submitButton);
      showError(generalError, result.error || 'Inloggen mislukt. Controleer je gegevens.');
    }
  } catch (error) {
    console.error('Login error:', error);
    hideLoader(submitButton);
    
    // Show user-friendly error
    const errorMessage = error.message || 'Er ging iets mis. Probeer het opnieuw.';
    showError(generalError, errorMessage);
  }
}

/**
 * Clear all error messages in the modal
 * @param {HTMLElement} modal - The modal element
 */
function clearModalErrors(modal) {
  if (!modal) return;
  
  const errorElements = modal.querySelectorAll('[data-modal-error]');
  errorElements.forEach(errorEl => {
    hideError(errorEl);
  });
}
