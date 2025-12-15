// public/forms/dashboardKlant/accountBeherenInit.js
/**
 * Account beheren initialisatie voor klanten
 * Bevat 5 aparte formulieren: profiel, email, telefoon, adres, wachtwoord
 * Gebruikt schema-driven validatie via formHandler
 */
import { formHandler } from '../logic/formHandler.js';
import { getFormSchema } from '../schemas/formSchemas.js';
import { apiClient } from '../../utils/api/client.js';
import { authClient } from '../../utils/auth/authClient.js';
import { fetchAddressDetails } from '../../utils/api/address.js';
import { showError as showErrorElement, hideError, showFieldErrors, clearErrors } from '../ui/formUi.js';

// Wrapper functions om formUi functies te gebruiken met selector-based API
function showError(fieldName, message, formSelector) {
  const formEl = document.querySelector(formSelector);
  if (!formEl) return;
  
  if (fieldName === 'global') {
    const errorEl = formEl.querySelector('[data-error-for="global"]');
    if (errorEl) {
      showErrorElement(errorEl, message);
    }
  } else {
    showFieldErrors(formEl, fieldName, message);
  }
}

function clearError(formSelector, fieldName = null) {
  const formEl = document.querySelector(formSelector);
  if (!formEl) return;
  
  if (fieldName) {
    const errorEl = formEl.querySelector(`[data-error-for="${fieldName}"]`);
    if (errorEl) hideError(errorEl);
  } else {
    clearErrors(formEl);
  }
}

function showSuccess(message, formSelector) {
  const formEl = document.querySelector(formSelector);
  if (!formEl) return;
  
  const successWrapper = formEl.querySelector('.form_message-success-wrapper');
  if (!successWrapper) return;
  
  const successDiv = successWrapper.querySelector('.form_message-success > div');
  if (successDiv) {
    successDiv.textContent = message;
  }
  
  successWrapper.style.display = 'flex';
  successWrapper.setAttribute('aria-hidden', 'false');
  
  // Auto-hide na 5 seconden
  setTimeout(() => {
    successWrapper.style.display = 'none';
    successWrapper.setAttribute('aria-hidden', 'true');
  }, 5000);
}

// Store original values for change detection
const originalValues = {
  profiel: {},
  email: {},
  telefoon: {},
  adres: {},
  wachtwoord: {}
};

// ============================================================================
// SHARED HELPERS
// ============================================================================

/**
 * Get field value via data-field-name
 */
function getFieldValue(fieldName) {
  const field = document.querySelector(`[data-field-name="${fieldName}"]`);
  return field ? field.value : '';
}

/**
 * Set field value via data-field-name
 */
function setFieldValue(fieldName, value) {
  const field = document.querySelector(`[data-field-name="${fieldName}"]`);
  if (field) field.value = value;
}

/**
 * Set button disabled state
 */
function setButtonDisabled(button, disabled) {
  if (disabled) {
    button.style.opacity = '0.5';
    button.style.pointerEvents = 'none';
  } else {
    button.style.opacity = '1';
    button.style.pointerEvents = 'auto';
  }
}

/**
 * Check if form values changed
 */
function hasFormChanged(formName, currentValues) {
  const original = originalValues[formName];
  return Object.keys(currentValues).some(key => currentValues[key] !== original[key]);
}

/**
 * Update button state based on changes
 */
function updateButtonState(formName, button, getCurrentValues) {
  const currentValues = getCurrentValues();
  const hasChanges = hasFormChanged(formName, currentValues);
  setButtonDisabled(button, !hasChanges);
}

/**
 * Load user data from API
 * Uses /dashboard/klant/profile for profiel data (not /auth/me)
 */
async function loadUserData() {
  console.log('🔄 [Account Beheren] Loading user data...');
  
  const authState = authClient.getAuthState();
  if (!authState?.access_token) {
    console.error('❌ [Account Beheren] Geen access token');
    return null;
  }

  try {
    // Haal profiel data op via dedicated endpoint
    const profileData = await apiClient('/routes/dashboard/klant/profile', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authState.access_token}`
      }
    });

    console.log('✅ [Account Beheren] Profile data loaded:', profileData);
    
    // Combine met basis auth data uit authState
    return {
      id: authState.user?.id,
      email: authState.user?.email,
      role: authState.user?.role,
      ...profileData
    };
  } catch (error) {
    console.error('❌ [Account Beheren] Error loading user data:', error);
    return null;
  }
}

// ============================================================================
// 1. PROFIEL FORM (voornaam, achternaam)
// ============================================================================

async function initProfielForm(userData) {
  console.log('👤 [Profiel] Initialiseren...');
  
  const formName = 'account-profiel-form';
  const schema = getFormSchema(formName);
  if (!schema) {
    console.error(`❌ [Profiel] Schema '${formName}' niet gevonden`);
    return;
  }

  const formEl = document.querySelector(schema.selector);
  const button = document.querySelector('[data-form-button="account-profiel-form"]');
  
  if (!formEl || !button) {
    console.warn('⚠️ [Profiel] Form of button niet gevonden');
    return;
  }

  // Prefill values
  if (userData) {
    setFieldValue('voornaam', userData.voornaam || '');
    setFieldValue('achternaam', userData.achternaam || '');
    
    originalValues.profiel = {
      voornaam: userData.voornaam || '',
      achternaam: userData.achternaam || ''
    };
  }

  setButtonDisabled(button, true);

  // Enable button on input
  formEl.addEventListener('input', () => {
    updateButtonState('profiel', button, () => ({
      voornaam: getFieldValue('voornaam'),
      achternaam: getFieldValue('achternaam')
    }));
  });

  // Handle submit
  button.addEventListener('click', async (e) => {
    e.preventDefault();
    
    // Duplicate prevention
    if (button.dataset.requesting === 'true') return;
    
    try {
      button.dataset.requesting = 'true';
      setButtonDisabled(button, true);

      // Collect and validate
      const formData = {
        voornaam: getFieldValue('voornaam'),
        achternaam: getFieldValue('achternaam')
      };

      const validation = formHandler.validateForm(formData, schema);
      if (!validation.isFormValid) {
        validation.fieldErrors.forEach((error) => {
          showError(error.fieldName, error.message, schema.selector);
        });
        return;
      }

      // Submit
      const authState = authClient.getAuthState();
      const response = await apiClient('/routes/dashboard/klant/update-adres', {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${authState.access_token}` },
        body: formData
      });

      console.log('✅ [Profiel] Bijgewerkt');
      
      // Update original values
      originalValues.profiel = { ...formData };
      setButtonDisabled(button, true);
      
      // Success message
      let successMessage = 'Naam succesvol bijgewerkt';
      if (response.schoonmakerGenotificeerd) {
        successMessage += ' • Je schoonmaker is op de hoogte gebracht';
      }
      showSuccess(successMessage, schema.selector);

    } catch (error) {
      console.error('❌ [Profiel] Error:', error);
      showError('global', error.message || 'Er ging iets mis', schema.selector);
    } finally {
      delete button.dataset.requesting;
      updateButtonState('profiel', button, () => ({
        voornaam: getFieldValue('voornaam'),
        achternaam: getFieldValue('achternaam')
      }));
    }
  });
}

// ============================================================================
// 2. EMAIL FORM
// ============================================================================

async function initEmailForm(userData) {
  console.log('📧 [Email] Initialiseren...');
  
  const formName = 'account-email-form';
  const schema = getFormSchema(formName);
  if (!schema) {
    console.error(`❌ [Email] Schema '${formName}' niet gevonden`);
    return;
  }

  const formEl = document.querySelector(schema.selector);
  const button = document.querySelector('[data-form-button="account-email-form"]');
  
  if (!formEl || !button) {
    console.warn('⚠️ [Email] Form of button niet gevonden');
    return;
  }

  // Prefill
  if (userData) {
    setFieldValue('email', userData.email || '');
    originalValues.email = { email: userData.email || '' };
  }

  setButtonDisabled(button, true);

  // Enable button on input
  formEl.addEventListener('input', () => {
    updateButtonState('email', button, () => ({
      email: getFieldValue('email')
    }));
  });

  // Handle submit
  button.addEventListener('click', async (e) => {
    e.preventDefault();
    
    if (button.dataset.requesting === 'true') return;
    
    try {
      button.dataset.requesting = 'true';
      setButtonDisabled(button, true);

      const formData = { email: getFieldValue('email') };

      const validation = formHandler.validateForm(formData, schema);
      if (!validation.isFormValid) {
        validation.fieldErrors.forEach((error) => {
          showError(error.fieldName, error.message, schema.selector);
        });
        return;
      }

      // Submit
      const authState = authClient.getAuthState();
      await apiClient('/routes/dashboard/klant/request-email-change', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authState.access_token}` },
        body: { nieuwEmail: formData.email }
      });

      console.log('✅ [Email] Verificatie verzonden');
      
      // Reset to original (not changed until verified)
      setFieldValue('email', originalValues.email.email);
      setButtonDisabled(button, true);
      
      showSuccess('Verificatie-email verzonden naar je nieuwe e-mailadres • Klik op de link in de email om te bevestigen', schema.selector);

    } catch (error) {
      console.error('❌ [Email] Error:', error);
      showError('global', error.message || 'Er ging iets mis', schema.selector);
    } finally {
      delete button.dataset.requesting;
      updateButtonState('email', button, () => ({
        email: getFieldValue('email')
      }));
    }
  });
}

// ============================================================================
// 3. TELEFOON FORM
// ============================================================================

async function initTelefoonForm(userData) {
  console.log('📞 [Telefoon] Initialiseren...');
  
  const formName = 'account-telefoon-form';
  const schema = getFormSchema(formName);
  if (!schema) {
    console.error(`❌ [Telefoon] Schema '${formName}' niet gevonden`);
    return;
  }

  const formEl = document.querySelector(schema.selector);
  const button = document.querySelector('[data-form-button="account-telefoon-form"]');
  
  if (!formEl || !button) {
    console.warn('⚠️ [Telefoon] Form of button niet gevonden');
    return;
  }

  // Prefill
  if (userData) {
    setFieldValue('telefoon', userData.telefoon || '');
    originalValues.telefoon = { telefoon: userData.telefoon || '' };
  }

  setButtonDisabled(button, true);

  formEl.addEventListener('input', () => {
    updateButtonState('telefoon', button, () => ({
      telefoon: getFieldValue('telefoon')
    }));
  });

  button.addEventListener('click', async (e) => {
    e.preventDefault();
    
    if (button.dataset.requesting === 'true') return;
    
    try {
      button.dataset.requesting = 'true';
      setButtonDisabled(button, true);

      const formData = { telefoon: getFieldValue('telefoon') };

      const validation = formHandler.validateForm(formData, schema);
      if (!validation.isFormValid) {
        validation.fieldErrors.forEach((error) => {
          showError(error.fieldName, error.message, schema.selector);
        });
        return;
      }

      const authState = authClient.getAuthState();
      const response = await apiClient('/routes/dashboard/klant/update-telefoon', {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${authState.access_token}` },
        body: formData
      });

      console.log('✅ [Telefoon] Bijgewerkt');
      
      originalValues.telefoon = { ...formData };
      setButtonDisabled(button, true);
      
      let successMessage = 'Telefoonnummer succesvol bijgewerkt';
      if (response.schoonmakerGenotificeerd) {
        successMessage += ' • Je schoonmaker is op de hoogte gebracht';
      }
      showSuccess(successMessage, schema.selector);

    } catch (error) {
      console.error('❌ [Telefoon] Error:', error);
      showError('global', error.message || 'Er ging iets mis', schema.selector);
    } finally {
      delete button.dataset.requesting;
      updateButtonState('telefoon', button, () => ({
        telefoon: getFieldValue('telefoon')
      }));
    }
  });
}

// ============================================================================
// 4. ADRES FORM
// ============================================================================

async function initAdresForm(userData) {
  console.log('🏠 [Adres] Initialiseren...');
  
  const formName = 'account-adres-form';
  const schema = getFormSchema(formName);
  if (!schema) {
    console.error(`❌ [Adres] Schema '${formName}' niet gevonden`);
    return;
  }

  const formEl = document.querySelector(schema.selector);
  const button = document.querySelector('[data-form-button="account-adres-form"]');
  
  if (!formEl || !button) {
    console.warn('⚠️ [Adres] Form of button niet gevonden');
    return;
  }

  // Prefill
  if (userData) {
    setFieldValue('postcode', userData.postcode || '');
    setFieldValue('huisnummer', userData.huisnummer || '');
    setFieldValue('toevoeging', userData.toevoeging || '');
    
    originalValues.adres = {
      postcode: userData.postcode || '',
      huisnummer: userData.huisnummer || '',
      toevoeging: userData.toevoeging || ''
    };
  }

  setButtonDisabled(button, true);

  formEl.addEventListener('input', () => {
    updateButtonState('adres', button, () => ({
      postcode: getFieldValue('postcode'),
      huisnummer: getFieldValue('huisnummer'),
      toevoeging: getFieldValue('toevoeging')
    }));
  });

  button.addEventListener('click', async (e) => {
    e.preventDefault();
    
    if (button.dataset.requesting === 'true') return;
    
    try {
      button.dataset.requesting = 'true';
      setButtonDisabled(button, true);

      const formData = {
        postcode: getFieldValue('postcode'),
        huisnummer: getFieldValue('huisnummer'),
        toevoeging: getFieldValue('toevoeging')
      };

      const validation = formHandler.validateForm(formData, schema);
      if (!validation.isFormValid) {
        validation.fieldErrors.forEach((error) => {
          showError(error.fieldName, error.message, schema.selector);
        });
        return;
      }

      // Address verification
      const addressDetails = await fetchAddressDetails(
        formData.postcode,
        formData.huisnummer,
        formData.toevoeging
      );

      if (!addressDetails) {
        showError('global', 'Ongeldig adres. Controleer je postcode en huisnummer.', schema.selector);
        return;
      }

      const authState = authClient.getAuthState();
      const response = await apiClient('/routes/dashboard/klant/update-adres', {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${authState.access_token}` },
        body: {
          ...formData,
          straat: addressDetails.straat,
          plaats: addressDetails.plaats
        }
      });

      console.log('✅ [Adres] Bijgewerkt');
      
      originalValues.adres = { ...formData };
      setButtonDisabled(button, true);
      
      let successMessage = 'Adres succesvol bijgewerkt';
      if (response.schoonmakerGenotificeerd) {
        successMessage += ' • Je schoonmaker is op de hoogte gebracht';
      }
      showSuccess(successMessage, schema.selector);

    } catch (error) {
      console.error('❌ [Adres] Error:', error);
      showError('global', error.message || 'Er ging iets mis', schema.selector);
    } finally {
      delete button.dataset.requesting;
      updateButtonState('adres', button, () => ({
        postcode: getFieldValue('postcode'),
        huisnummer: getFieldValue('huisnummer'),
        toevoeging: getFieldValue('toevoeging')
      }));
    }
  });
}

// ============================================================================
// 5. WACHTWOORD FORM
// ============================================================================

async function initWachtwoordForm() {
  console.log('🔒 [Wachtwoord] Initialiseren...');
  
  const formName = 'account-wachtwoord-form';
  const schema = getFormSchema(formName);
  if (!schema) {
    console.error(`❌ [Wachtwoord] Schema '${formName}' niet gevonden`);
    return;
  }

  const formEl = document.querySelector(schema.selector);
  const button = document.querySelector('[data-form-button="account-wachtwoord-form"]');
  
  if (!formEl || !button) {
    console.warn('⚠️ [Wachtwoord] Form of button niet gevonden');
    return;
  }

  // No prefill for passwords
  setButtonDisabled(button, true);

  formEl.addEventListener('input', () => {
    const hasInput = getFieldValue('huidigWachtwoord') || 
                     getFieldValue('nieuwWachtwoord') || 
                     getFieldValue('bevestigWachtwoord');
    setButtonDisabled(button, !hasInput);
  });

  button.addEventListener('click', async (e) => {
    e.preventDefault();
    
    if (button.dataset.requesting === 'true') return;
    
    try {
      button.dataset.requesting = 'true';
      setButtonDisabled(button, true);

      const formData = {
        huidigWachtwoord: getFieldValue('huidigWachtwoord'),
        nieuwWachtwoord: getFieldValue('nieuwWachtwoord'),
        bevestigWachtwoord: getFieldValue('bevestigWachtwoord')
      };

      const validation = formHandler.validateForm(formData, schema);
      if (!validation.isFormValid) {
        validation.fieldErrors.forEach((error) => {
          showError(error.fieldName, error.message, schema.selector);
        });
        return;
      }

      // Custom validation: passwords match
      if (formData.nieuwWachtwoord !== formData.bevestigWachtwoord) {
        showError('bevestigWachtwoord', 'Wachtwoorden komen niet overeen', schema.selector);
        return;
      }

      // Custom validation: new password different from current
      if (formData.huidigWachtwoord === formData.nieuwWachtwoord) {
        showError('nieuwWachtwoord', 'Nieuw wachtwoord moet verschillen van huidig wachtwoord', schema.selector);
        return;
      }

      const authState = authClient.getAuthState();
      await apiClient('/routes/dashboard/klant/update-wachtwoord', {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${authState.access_token}` },
        body: {
          huidigWachtwoord: formData.huidigWachtwoord,
          nieuwWachtwoord: formData.nieuwWachtwoord
        }
      });

      console.log('✅ [Wachtwoord] Bijgewerkt');
      
      // Clear all password fields (security)
      setFieldValue('huidigWachtwoord', '');
      setFieldValue('nieuwWachtwoord', '');
      setFieldValue('bevestigWachtwoord', '');
      setButtonDisabled(button, true);
      
      showSuccess('Wachtwoord succesvol gewijzigd • Andere sessies zijn uitgelogd', schema.selector);

    } catch (error) {
      console.error('❌ [Wachtwoord] Error:', error);
      
      // Specific error handling
      if (error.message && error.message.includes('onjuist')) {
        showError('huidigWachtwoord', 'Huidig wachtwoord is onjuist', schema.selector);
      } else {
        showError('global', error.message || 'Er ging iets mis bij het wijzigen van je wachtwoord', schema.selector);
      }
    } finally {
      delete button.dataset.requesting;
      const hasInput = getFieldValue('huidigWachtwoord') || 
                       getFieldValue('nieuwWachtwoord') || 
                       getFieldValue('bevestigWachtwoord');
      setButtonDisabled(button, !hasInput);
    }
  });
}

// ============================================================================
// MAIN INIT
// ============================================================================

export async function initAccountBeheren() {
  console.log('⚙️ [Account Beheren] Initialiseren...');

  // Load user data
  const userData = await loadUserData();
  if (!userData) {
    console.error('❌ [Account Beheren] Kon user data niet laden');
    return;
  }

  // Initialize all 5 forms
  await initProfielForm(userData);
  await initEmailForm(userData);
  await initTelefoonForm(userData);
  await initAdresForm(userData);
  await initWachtwoordForm(); // No prefill

  console.log('✅ [Account Beheren] Alle formulieren geïnitialiseerd');
}
