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
  console.log('🔐 [LoginModal] Initialiseren...');
  
  const modalWrapper = document.querySelector('[data-modal-wrapper="login"]');
  const modal = document.querySelector('[data-modal="login"]');
  const backdrop = document.querySelector('[data-modal-backdrop="login"]');
  
  if (!modalWrapper || !modal) {
    console.warn('⚠️ [LoginModal] Login modal elements niet gevonden in DOM');
    return;
  }

  console.log('✅ [LoginModal] Modal elements gevonden, setup event listeners...');

  // Open modal triggers
  const openTriggers = document.querySelectorAll('[data-action="auth-open-login"]');
  openTriggers.forEach(trigger => {
    trigger.addEventListener('click', () => openModal(modalWrapper, modal));
  });
  console.log(`✅ [LoginModal] ${openTriggers.length} open trigger(s) geregistreerd`);

  // Close modal triggers - zoek in hele modalWrapper
  const closeTriggers = modalWrapper.querySelectorAll('[data-modal-close]');
  closeTriggers.forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeModal(modalWrapper, modal);
    });
  });
  console.log(`✅ [LoginModal] ${closeTriggers.length} close trigger(s) geregistreerd`);

  // Backdrop click to close
  if (backdrop) {
    backdrop.addEventListener('click', () => closeModal(modalWrapper, modal));
    console.log('✅ [LoginModal] Backdrop close handler geregistreerd');
  }

  // Submit handler
  const submitTrigger = modal.querySelector('[data-modal-submit]');
  if (submitTrigger) {
    submitTrigger.addEventListener('click', (e) => handleLogin(e, modal, modalWrapper));
    console.log('✅ [LoginModal] Submit handler geregistreerd');
  }

  // Real-time validation & button state management
  const emailField = modal.querySelector('[data-modal-field="emailadres"]');
  const passwordField = modal.querySelector('[data-modal-field="wachtwoord"]');
  
  [emailField, passwordField].forEach(field => {
    if (field) {
      // Clear errors on input
      field.addEventListener('input', () => {
        clearFieldError(modal, field.getAttribute('data-modal-field'));
        updateSubmitButton(modal);
      });
      
      // Validate on blur
      field.addEventListener('blur', () => {
        validateModalField(modal, field);
        updateSubmitButton(modal);
      });
    }
  });
  
  console.log('✅ [LoginModal] Field validation handlers geregistreerd');
  console.log('🔐 [LoginModal] Initialisatie compleet');
}

/**
 * Open the login modal
 * @param {HTMLElement} modalWrapper - The modal wrapper element
 * @param {HTMLElement} modal - The modal form element
 */
function openModal(modalWrapper, modal) {
  if (!modalWrapper) return;
  
  console.log('🔓 [LoginModal] Modal openen...');
  
  modalWrapper.style.display = 'flex';
  
  // Clear any previous errors
  clearModalErrors(modal);
  
  // Reset form fields
  if (modal) {
    const emailField = modal.querySelector('[data-modal-field="emailadres"]');
    const passwordField = modal.querySelector('[data-modal-field="wachtwoord"]');
    if (emailField) emailField.value = '';
    if (passwordField) passwordField.value = '';
    
    // Reset button state
    updateSubmitButton(modal);
  }
  
  console.log('✅ [LoginModal] Modal geopend');
}

/**
 * Close the login modal
 * @param {HTMLElement} modalWrapper - The modal wrapper element
 * @param {HTMLElement} modal - The modal form element
 */
function closeModal(modalWrapper, modal) {
  if (!modalWrapper) return;
  
  console.log('🔒 [LoginModal] Modal sluiten...');
  
  modalWrapper.style.display = 'none';
  clearModalErrors(modal);
  
  console.log('✅ [LoginModal] Modal gesloten');
}

/**
 * Handle login form submission
 * @param {Event} e - Click event
 * @param {HTMLElement} modal - The modal form element
 * @param {HTMLElement} modalWrapper - The modal wrapper element
 */
async function handleLogin(e, modal, modalWrapper) {
  e.preventDefault();

  console.log('🔐 [LoginModal] Login submit gestart...');

  const emailField = modal.querySelector('[data-modal-field="emailadres"]');
  const passwordField = modal.querySelector('[data-modal-field="wachtwoord"]');
  const submitButton = modal.querySelector('[data-modal-submit]');
  const generalError = modal.querySelector('[data-modal-error="general"]');

  // Clear previous errors
  clearModalErrors(modal);

  // Get field values
  const email = emailField?.value?.trim();
  const password = passwordField?.value?.trim();

  console.log('📧 [LoginModal] Email:', email ? `${email.substring(0, 3)}***` : 'leeg');
  console.log('🔑 [LoginModal] Password:', password ? '***' : 'leeg');

  // Validate email field
  if (!email) {
    const emailError = modal.querySelector('[data-modal-error="emailadres"]');
    showError(emailError, 'Vul je e-mailadres in');
    emailField?.focus();
    console.warn('⚠️ [LoginModal] Validatie gefaald: email leeg');
    return;
  }

  // Validate email format using formValidator
  const emailValidation = validateEmail(email);

  if (!emailValidation.valid) {
    const emailError = modal.querySelector('[data-modal-error="emailadres"]');
    showError(emailError, emailValidation.error);
    emailField?.focus();
    console.warn('⚠️ [LoginModal] Validatie gefaald: ongeldig email formaat');
    return;
  }

  // Validate password field
  if (!password) {
    const passwordError = modal.querySelector('[data-modal-error="wachtwoord"]');
    showError(passwordError, 'Vul je wachtwoord in');
    passwordField?.focus();
    console.warn('⚠️ [LoginModal] Validatie gefaald: wachtwoord leeg');
    return;
  }

  // Validate password format using validatePassword
  const passwordValidation = validatePassword(password);

  if (!passwordValidation.valid) {
    const passwordError = modal.querySelector('[data-modal-error="wachtwoord"]');
    showError(passwordError, passwordValidation.error);
    passwordField?.focus();
    console.warn('⚠️ [LoginModal] Validatie gefaald: wachtwoord voldoet niet aan eisen');
    return;
  }

  console.log('✅ [LoginModal] Client-side validatie geslaagd');
  console.log('🔄 [LoginModal] Aanroepen authClient.login()...');

  // Show loader
  showLoader(submitButton);

  try {
    const loginStartTime = Date.now();
    
    // Call authClient login
    const result = await authClient.login(email, password);
    
    const loginDuration = Date.now() - loginStartTime;
    console.log(`⏱️ [LoginModal] Login request duurde ${loginDuration}ms`);
    console.log('🔍 [LoginModal] Result object:', result);
    console.log('🔍 [LoginModal] Result type:', typeof result);
    console.log('🔍 [LoginModal] Has user:', !!result?.user);
    console.log('🔍 [LoginModal] Has session:', !!result?.session);

    // Check if login was successful (authClient returns data object directly)
    if (result && result.user) {
      console.log('✅ [LoginModal] Login succesvol!');
      console.log('👤 [LoginModal] User:', result.user?.email, '| Role:', result.user?.role);
      
      // Hide loader
      hideLoader(submitButton);

      // Close modal
      closeModal(modalWrapper, modal);

      // Dispatch auth:success event
      const authEvent = new CustomEvent('auth:success', {
        detail: {
          user: result.user,
          role: result.user?.role || 'klant'
        }
      });
      document.dispatchEvent(authEvent);

      console.log('📢 [LoginModal] auth:success event dispatched');
      console.log('🎉 [LoginModal] Login flow compleet');
    } else {
      // Show error - shouldn't reach here normally
      console.error('❌ [LoginModal] Login gefaald: Ongeldige response');
      hideLoader(submitButton);
      showError(generalError, 'Inloggen mislukt. Probeer het opnieuw.');
    }
  } catch (error) {
    console.error('❌ [LoginModal] Login error:', error);
    console.error('🔍 [LoginModal] Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
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

/**
 * Clear error for a specific field
 * @param {HTMLElement} modal - The modal element
 * @param {string} fieldName - The field name (emailadres, wachtwoord)
 */
function clearFieldError(modal, fieldName) {
  if (!modal || !fieldName) return;
  
  const errorEl = modal.querySelector(`[data-modal-error="${fieldName}"]`);
  if (errorEl) {
    hideError(errorEl);
  }
}

/**
 * Validate a modal field using formValidator
 * @param {HTMLElement} modal - The modal element
 * @param {HTMLElement} field - The field element to validate
 * @returns {boolean} True if valid
 */
function validateModalField(modal, field) {
  if (!field) return false;
  
  const fieldName = field.getAttribute('data-modal-field');
  const value = field.value?.trim();
  
  // Skip validation if field is empty and user hasn't interacted yet
  if (!value) return true;
  
  let validation = { valid: true, error: null };
  
  // Email field validation
  if (fieldName === 'emailadres') {
    validation = validateEmail(value);
  }
  
  // Password field validation
  if (fieldName === 'wachtwoord') {
    validation = validatePassword(value);
  }
  
  // Show/hide error based on validation
  const errorEl = modal.querySelector(`[data-modal-error="${fieldName}"]`);
  if (!validation.valid && errorEl) {
    showError(errorEl, validation.error);
    console.log(`⚠️ [LoginModal] Field validatie: ${fieldName} - ${validation.error}`);
  } else if (errorEl) {
    hideError(errorEl);
  }
  
  return validation.valid;
}

/**
 * Simple email validation
 * @param {string} email - Email to validate
 * @returns {object} - { valid: boolean, error: string|null }
 */
function validateEmail(email) {
  if (!email || email.trim() === '') {
    return { valid: false, error: 'Vul je e-mailadres in' };
  }
  
  // Email regex: bevat @ en minimaal één punt na @
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Voer een geldig e-mailadres in' };
  }
  
  return { valid: true, error: null };
}

/**
 * Simple password validation
 * @param {string} password - Password to validate
 * @returns {object} - { valid: boolean, error: string|null }
 */
function validatePassword(password) {
  if (!password || password.trim() === '') {
    return { valid: false, error: 'Vul je wachtwoord in' };
  }
  
  // Minimum 8 characters (volgt commonFields.js pattern)
  if (password.length < 8) {
    return { valid: false, error: 'Wachtwoord moet minimaal 8 karakters zijn' };
  }
  
  return { valid: true, error: null };
}

/**
 * Update submit button state based on form validity
 * @param {HTMLElement} modal - The modal element
 */
function updateSubmitButton(modal) {
  if (!modal) return;
  
  const submitButton = modal.querySelector('[data-modal-submit]');
  const emailField = modal.querySelector('[data-modal-field="emailadres"]');
  const passwordField = modal.querySelector('[data-modal-field="wachtwoord"]');
  
  if (!submitButton) return;
  
  const email = emailField?.value?.trim();
  const password = passwordField?.value?.trim();
  
  // Enable button only if both fields have values
  const isValid = email && password;
  
  if (isValid) {
    submitButton.disabled = false;
    submitButton.classList.remove('is-disabled');
  } else {
    submitButton.disabled = true;
    submitButton.classList.add('is-disabled');
  }
}
