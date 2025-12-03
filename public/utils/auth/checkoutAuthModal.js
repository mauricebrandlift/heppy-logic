/**
 * Checkout Auth Modal Component
 * Handles login and registration in checkout modal
 * 
 * Dependencies:
 * - authClient.js for authentication API calls
 * - formUi.js for button/spinner/error handling
 * - apiClient.js for registration
 */

import { authClient } from './authClient.js';
import { apiClient } from '../api/client.js';
import { showLoader, hideLoader, showError, hideError } from '../../forms/ui/formUi.js';

/**
 * Initialize checkout auth modal functionality
 */
export function initCheckoutAuthModal() {
  console.log('🔐 [CheckoutAuthModal] Initialiseren...');
  
  const modal = document.querySelector('[data-checkout-auth-modal]');
  const loginState = document.querySelector('[data-auth-login-state]');
  const registerState = document.querySelector('[data-auth-register-state]');
  
  if (!modal) {
    console.warn('⚠️ [CheckoutAuthModal] Modal niet gevonden');
    return;
  }

  console.log('✅ [CheckoutAuthModal] Modal gevonden');
  
  // Check if user is already authenticated
  if (authClient.isAuthenticated()) {
    console.log('✅ [CheckoutAuthModal] User al ingelogd, modal verbergen');
    modal.style.display = 'none';
    return; // No need to setup event listeners
  }
  
  console.log('🔓 [CheckoutAuthModal] User niet ingelogd, modal blijft zichtbaar');
  console.log('✅ [CheckoutAuthModal] Setup event listeners...');

  // Close buttons
  const closeButtons = modal.querySelectorAll('[data-modal-close]');
  closeButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      handleModalClose(modal);
    });
  });
  console.log(`✅ [CheckoutAuthModal] ${closeButtons.length} close button(s) geregistreerd`);

  // Backdrop click prevention
  const backdrop = document.querySelector('[data-modal-backdrop]');
  const backgroundOverlay = modal.querySelector('.contact-modal1_background-overlay');
  
  if (backdrop) {
    backdrop.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, true);
  }
  
  if (backgroundOverlay) {
    backgroundOverlay.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, true);
  }

  // Toggle buttons
  const showRegisterBtn = document.querySelector('[data-switch-to-register]');
  const showLoginBtn = document.querySelector('[data-switch-to-login]');
  
  if (showRegisterBtn) {
    showRegisterBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('🔄 [CheckoutAuthModal] Switch naar register');
      showRegisterState(modal, loginState, registerState);
    });
  }
  
  if (showLoginBtn) {
    showLoginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('🔄 [CheckoutAuthModal] Switch naar login');
      showLoginState(modal, loginState, registerState);
    });
  }

  // Login submit
  const loginButton = document.querySelector('[data-form-button="checkout-login"]');
  if (loginButton) {
    loginButton.addEventListener('click', (e) => {
      e.preventDefault();
      handleLogin(modal);
    });
    console.log('✅ [CheckoutAuthModal] Login submit handler geregistreerd');
  }

  // Register submit
  const registerButton = document.querySelector('[data-form-button="checkout-register"]');
  if (registerButton) {
    registerButton.addEventListener('click', (e) => {
      e.preventDefault();
      handleRegister(modal);
    });
    console.log('✅ [CheckoutAuthModal] Register submit handler geregistreerd');
  }

  // Real-time button state for login
  const loginEmail = document.querySelector('[data-field-name="login-email"]');
  const loginPassword = document.querySelector('[data-field-name="login-password"]');
  
  [loginEmail, loginPassword].forEach(field => {
    if (field) {
      field.addEventListener('input', () => {
        clearFieldError(modal, field.getAttribute('data-field-name'));
        updateLoginButton(modal);
      });
      field.addEventListener('blur', () => {
        validateField(modal, field);
        updateLoginButton(modal);
      });
    }
  });

  // Real-time button state for register
  const registerFields = [
    'register-voornaam', 'register-achternaam', 'register-email',
    'register-password', 'register-postcode', 'register-huisnummer',
    'register-straatnaam', 'register-plaats'
  ];
  
  registerFields.forEach(fieldName => {
    const field = document.querySelector(`[data-field-name="${fieldName}"]`);
    if (field) {
      field.addEventListener('input', () => {
        clearFieldError(modal, fieldName);
        updateRegisterButton(modal);
      });
    }
  });

  // Address lookup for register
  initAddressLookup(modal);

  console.log('✅ [CheckoutAuthModal] Initialisatie compleet');
}

/**
 * Show login state
 */
function showLoginState(modal, loginState, registerState) {
  if (loginState) loginState.style.display = 'block';
  if (registerState) registerState.style.display = 'none';
  clearAllErrors(modal);
}

/**
 * Show register state
 */
function showRegisterState(modal, loginState, registerState) {
  if (loginState) loginState.style.display = 'none';
  if (registerState) registerState.style.display = 'block';
  clearAllErrors(modal);
}

/**
 * Handle modal close
 */
function handleModalClose(modal) {
  const authState = authClient.isAuthenticated();
  if (!authState) {
    console.log('⚠️ [CheckoutAuthModal] User moet inloggen');
    const globalError = modal.querySelector('[data-modal-error="general"]');
    showError(globalError, 'Je moet inloggen om een bestelling te plaatsen');
    return;
  }
  
  modal.style.display = 'none';
}

/**
 * Handle login submission
 */
async function handleLogin(modal) {
  console.log('🔐 [CheckoutAuthModal] Login submit gestart...');
  
  clearAllErrors(modal);
  
  const emailField = document.querySelector('[data-field-name="login-email"]');
  const passwordField = document.querySelector('[data-field-name="login-password"]');
  const submitButton = document.querySelector('[data-form-button="checkout-login"]');
  
  const email = emailField?.value?.trim();
  const password = passwordField?.value?.trim();
  
  console.log('📧 [CheckoutAuthModal] Email:', email ? `${email.substring(0, 3)}***` : 'leeg');
  console.log('🔑 [CheckoutAuthModal] Password:', password ? '***' : 'leeg');
  
  // Validate
  if (!email) {
    const emailError = modal.querySelector('[data-modal-error="login-email"]');
    showError(emailError, 'Vul je e-mailadres in');
    return;
  }
  
  const emailValidation = validateEmail(email);
  if (!emailValidation.valid) {
    const emailError = modal.querySelector('[data-modal-error="login-email"]');
    showError(emailError, emailValidation.error);
    return;
  }
  
  if (!password) {
    const passwordError = modal.querySelector('[data-modal-error="login-password"]');
    showError(passwordError, 'Vul je wachtwoord in');
    return;
  }
  
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    const passwordError = modal.querySelector('[data-modal-error="login-password"]');
    showError(passwordError, passwordValidation.error);
    return;
  }
  
  console.log('✅ [CheckoutAuthModal] Validatie geslaagd');
  
  showLoader(submitButton);
  
  try {
    const result = await authClient.login(email, password);
    
    console.log('✅ [CheckoutAuthModal] Login succesvol');
    
    hideLoader(submitButton);
    modal.style.display = 'none';
    
    // Dispatch success event
    document.dispatchEvent(new Event('auth:success'));
    
  } catch (error) {
    console.error('❌ [CheckoutAuthModal] Login error:', error);
    
    hideLoader(submitButton);
    
    const globalError = modal.querySelector('[data-modal-error="general"]');
    showError(globalError, error.message || 'Inloggen mislukt. Probeer het opnieuw.');
  }
}

/**
 * Handle register submission
 */
async function handleRegister(modal) {
  console.log('📝 [CheckoutAuthModal] Register submit gestart...');
  
  clearAllErrors(modal);
  
  const fields = {
    voornaam: document.querySelector('[data-field-name="register-voornaam"]')?.value?.trim(),
    achternaam: document.querySelector('[data-field-name="register-achternaam"]')?.value?.trim(),
    email: document.querySelector('[data-field-name="register-email"]')?.value?.trim(),
    password: document.querySelector('[data-field-name="register-password"]')?.value?.trim(),
    postcode: document.querySelector('[data-field-name="register-postcode"]')?.value?.trim(),
    huisnummer: document.querySelector('[data-field-name="register-huisnummer"]')?.value?.trim(),
    toevoeging: document.querySelector('[data-field-name="register-toevoeging"]')?.value?.trim(),
    straatnaam: document.querySelector('[data-field-name="register-straatnaam"]')?.value?.trim(),
    plaats: document.querySelector('[data-field-name="register-plaats"]')?.value?.trim()
  };
  
  console.log('📋 [CheckoutAuthModal] Fields:', {
    voornaam: fields.voornaam,
    achternaam: fields.achternaam,
    email: fields.email ? `${fields.email.substring(0, 3)}***` : 'leeg',
    postcode: fields.postcode,
    huisnummer: fields.huisnummer
  });
  
  // Basic validation
  if (!fields.voornaam || !fields.achternaam || !fields.email || !fields.password ||
      !fields.postcode || !fields.huisnummer || !fields.straatnaam || !fields.plaats) {
    const globalError = modal.querySelector('[data-modal-error="general"]');
    showError(globalError, 'Vul alle verplichte velden in');
    return;
  }
  
  const submitButton = document.querySelector('[data-form-button="checkout-register"]');
  showLoader(submitButton);
  
  try {
    // Register user
    await apiClient('/routes/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        voornaam: fields.voornaam,
        achternaam: fields.achternaam,
        email: fields.email,
        password: fields.password,
        telefoon: null, // Optional - kan later toegevoegd worden
        adres: {
          postcode: fields.postcode,
          huisnummer: fields.huisnummer,
          toevoeging: fields.toevoeging || null,
          straatnaam: fields.straatnaam,
          plaats: fields.plaats
        }
      })
    });
    
    console.log('✅ [CheckoutAuthModal] Registratie succesvol');
    
    // Auto-login
    await authClient.login(fields.email, fields.password);
    
    console.log('✅ [CheckoutAuthModal] Auto-login succesvol');
    
    hideLoader(submitButton);
    modal.style.display = 'none';
    
    // Dispatch success event
    document.dispatchEvent(new Event('auth:success'));
    
  } catch (error) {
    console.error('❌ [CheckoutAuthModal] Register error:', error);
    
    hideLoader(submitButton);
    
    const globalError = modal.querySelector('[data-modal-error="general"]');
    if (error.message?.includes('already exists')) {
      showError(globalError, 'Dit e-mailadres is al in gebruik');
    } else {
      showError(globalError, error.message || 'Registratie mislukt. Probeer het opnieuw.');
    }
  }
}

/**
 * Initialize address lookup
 */
function initAddressLookup(modal) {
  const postcodeField = document.querySelector('[data-field-name="register-postcode"]');
  const huisnummerField = document.querySelector('[data-field-name="register-huisnummer"]');
  const straatField = document.querySelector('[data-field-name="register-straatnaam"]');
  const plaatsField = document.querySelector('[data-field-name="register-plaats"]');
  
  if (!postcodeField || !huisnummerField) return;
  
  const lookup = async () => {
    const postcode = postcodeField.value?.trim();
    const huisnummer = huisnummerField.value?.trim();
    
    if (!postcode || !huisnummer) return;
    
    try {
      const response = await apiClient(`/routes/address?postcode=${encodeURIComponent(postcode)}&huisnummer=${encodeURIComponent(huisnummer)}`);
      
      if (response.straat && response.plaats) {
        if (straatField) straatField.value = response.straat;
        if (plaatsField) plaatsField.value = response.plaats;
        
        console.log('✅ [CheckoutAuthModal] Adres gevonden:', response.straat, response.plaats);
        
        clearFieldError(modal, 'general');
        updateRegisterButton(modal);
      }
    } catch (error) {
      console.error('❌ [CheckoutAuthModal] Address lookup error:', error);
      const globalError = modal.querySelector('[data-modal-error="general"]');
      showError(globalError, 'Adres niet gevonden. Controleer postcode en huisnummer.');
    }
  };
  
  postcodeField.addEventListener('blur', lookup);
  huisnummerField.addEventListener('blur', lookup);
}

/**
 * Clear all errors
 */
function clearAllErrors(modal) {
  const errorElements = modal.querySelectorAll('[data-modal-error]');
  errorElements.forEach(el => hideError(el));
}

/**
 * Clear field error
 */
function clearFieldError(modal, fieldName) {
  const errorEl = modal.querySelector(`[data-modal-error="${fieldName}"]`);
  if (errorEl) hideError(errorEl);
}

/**
 * Validate field
 */
function validateField(modal, field) {
  const fieldName = field.getAttribute('data-field-name');
  const value = field.value?.trim();
  
  if (!value) return true;
  
  let validation = { valid: true, error: null };
  
  if (fieldName === 'login-email' || fieldName === 'register-email') {
    validation = validateEmail(value);
  }
  
  if (fieldName === 'login-password' || fieldName === 'register-password') {
    validation = validatePassword(value);
  }
  
  const errorEl = modal.querySelector(`[data-modal-error="${fieldName}"]`);
  if (!validation.valid && errorEl) {
    showError(errorEl, validation.error);
  } else if (errorEl) {
    hideError(errorEl);
  }
  
  return validation.valid;
}

/**
 * Email validation
 */
function validateEmail(email) {
  if (!email || email.trim() === '') {
    return { valid: false, error: 'Vul je e-mailadres in' };
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Voer een geldig e-mailadres in' };
  }
  
  return { valid: true, error: null };
}

/**
 * Password validation
 */
function validatePassword(password) {
  if (!password || password.trim() === '') {
    return { valid: false, error: 'Vul je wachtwoord in' };
  }
  
  if (password.length < 8) {
    return { valid: false, error: 'Wachtwoord moet minimaal 8 karakters zijn' };
  }
  
  return { valid: true, error: null };
}

/**
 * Update login button state
 */
function updateLoginButton(modal) {
  const button = document.querySelector('[data-form-button="checkout-login"]');
  const emailField = document.querySelector('[data-field-name="login-email"]');
  const passwordField = document.querySelector('[data-field-name="login-password"]');
  
  if (!button) return;
  
  const email = emailField?.value?.trim();
  const password = passwordField?.value?.trim();
  
  const emailValid = email ? validateEmail(email).valid : false;
  const passwordValid = password ? validatePassword(password).valid : false;
  
  const isValid = emailValid && passwordValid;
  
  button.disabled = !isValid;
  button.classList.toggle('is-disabled', !isValid);
}

/**
 * Update register button state
 */
function updateRegisterButton(modal) {
  const button = document.querySelector('[data-form-button="checkout-register"]');
  
  if (!button) return;
  
  const fields = {
    voornaam: document.querySelector('[data-field-name="register-voornaam"]')?.value?.trim(),
    achternaam: document.querySelector('[data-field-name="register-achternaam"]')?.value?.trim(),
    email: document.querySelector('[data-field-name="register-email"]')?.value?.trim(),
    password: document.querySelector('[data-field-name="register-password"]')?.value?.trim(),
    postcode: document.querySelector('[data-field-name="register-postcode"]')?.value?.trim(),
    huisnummer: document.querySelector('[data-field-name="register-huisnummer"]')?.value?.trim(),
    straatnaam: document.querySelector('[data-field-name="register-straatnaam"]')?.value?.trim(),
    plaats: document.querySelector('[data-field-name="register-plaats"]')?.value?.trim()
  };
  
  const emailValid = fields.email ? validateEmail(fields.email).valid : false;
  const passwordValid = fields.password ? validatePassword(fields.password).valid : false;
  
  const isValid = fields.voornaam && fields.achternaam && emailValid && 
                  passwordValid && fields.postcode && fields.huisnummer && 
                  fields.straatnaam && fields.plaats;
  
  button.disabled = !isValid;
  button.classList.toggle('is-disabled', !isValid);
}

/**
 * Open checkout auth modal (for switching accounts)
 */
export function openCheckoutAuthModal() {
  const modal = document.querySelector('[data-checkout-auth-modal]');
  if (modal) {
    console.log('🔓 [CheckoutAuthModal] Opening modal...');
    modal.style.display = 'flex';
    
    // Show login state by default
    const loginState = document.querySelector('[data-auth-login-state]');
    const registerState = document.querySelector('[data-auth-register-state]');
    if (loginState && registerState) {
      showLoginState(modal, loginState, registerState);
    }
  }
}
