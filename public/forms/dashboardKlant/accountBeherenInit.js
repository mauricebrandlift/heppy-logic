// public/forms/dashboardKlant/accountBeherenInit.js
/**
 * Account beheren initialisatie voor klanten
 * Bevat 5 aparte formulieren: profiel, email, telefoon, adres, wachtwoord
 * Buttons zijn disabled totdat er wijzigingen zijn
 */
import { apiClient } from '../../utils/api/client.js';
import { authClient } from '../../utils/auth/authClient.js';
import { fetchAddressDetails } from '../../utils/api/address.js';

// Store original values for change detection
const originalValues = {
  profiel: {},
  email: {},
  telefoon: {},
  adres: {},
  wachtwoord: {}
};

/**
 * UI Helper: Show field error
 */
function showFieldError(formName, fieldName, message) {
  const errorEl = document.querySelector(
    `[data-account-form="${formName}"] [data-error-for="${fieldName}"]`
  );
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.remove('hide');
  }
}

/**
 * UI Helper: Clear field error
 */
function clearFieldError(formName, fieldName) {
  const errorEl = document.querySelector(
    `[data-account-form="${formName}"] [data-error-for="${fieldName}"]`
  );
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.classList.add('hide');
  }
}

/**
 * UI Helper: Clear all errors for a form
 */
function clearAllErrors(formName) {
  const form = document.querySelector(`[data-account-form="${formName}"]`);
  if (!form) return;

  const allErrors = form.querySelectorAll('[data-error-for]');
  allErrors.forEach(errorEl => {
    errorEl.textContent = '';
    errorEl.classList.add('hide');
  });
}

/**
 * UI Helper: Show success message (Webflow native)
 */
function showSuccess(formName, message) {
  const formWrapper = document.querySelector(`[data-account-form="${formName}"]`).parentElement;
  if (!formWrapper) return;

  const successWrapper = formWrapper.querySelector('.form_message-success-wrapper');
  if (successWrapper) {
    const messageDiv = successWrapper.querySelector('.form_message-success div');
    if (messageDiv) messageDiv.textContent = message;
    successWrapper.style.display = 'block';

    setTimeout(() => {
      successWrapper.style.display = 'none';
    }, 3000);
  }
}

/**
 * UI Helper: Show global error message
 */
function showGlobalError(formName, message) {
  const errorEl = document.querySelector(
    `[data-account-form="${formName}"] [data-error-for="global"]`
  );
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.remove('hide');
  }
}

/**
 * UI Helper: Set button disabled state (NO spinner - just disabled)
 */
function setButtonDisabled(button, disabled) {
  if (disabled) {
    button.style.opacity = '0.5';
    button.style.pointerEvents = 'none';
  } else {
    button.style.opacity = '1';
    button.style.pointerEvents = '';
  }
}

/**
 * Get field value by name within a form
 */
function getFieldValue(formName, fieldName) {
  const field = document.querySelector(
    `[data-account-form="${formName}"] [data-field-name="${fieldName}"]`
  );
  return field ? field.value.trim() : '';
}

/**
 * Set field value by name within a form
 */
function setFieldValue(formName, fieldName, value) {
  const field = document.querySelector(
    `[data-account-form="${formName}"] [data-field-name="${fieldName}"]`
  );
  if (field) {
    field.value = value || '';
  }
}

/**
 * Check if form has changes compared to original values
 */
function hasChanges(formName, currentValues) {
  const original = originalValues[formName];
  
  for (const key in currentValues) {
    if (currentValues[key] !== (original[key] || '')) {
      return true;
    }
  }
  
  return false;
}

/**
 * Update button state based on changes
 */
function updateButtonState(formName, button) {
  let currentValues = {};
  
  // Get current values based on form type
  switch(formName) {
    case 'profiel':
      currentValues = {
        voornaam: getFieldValue(formName, 'voornaam'),
        achternaam: getFieldValue(formName, 'achternaam')
      };
      break;
    case 'email':
      currentValues = {
        email: getFieldValue(formName, 'email')
      };
      break;
    case 'telefoon':
      currentValues = {
        telefoon: getFieldValue(formName, 'telefoon')
      };
      break;
    case 'adres':
      currentValues = {
        postcode: getFieldValue(formName, 'postcode'),
        huisnummer: getFieldValue(formName, 'huisnummer'),
        toevoeging: getFieldValue(formName, 'toevoeging'),
        straatnaam: getFieldValue(formName, 'straatnaam'),
        plaats: getFieldValue(formName, 'plaats')
      };
      break;
    case 'wachtwoord':
      // Wachtwoord: enabled als alle 3 velden gevuld zijn
      const huidig = getFieldValue(formName, 'huidig-wachtwoord');
      const nieuw = getFieldValue(formName, 'nieuw-wachtwoord');
      const bevestig = getFieldValue(formName, 'bevestig-wachtwoord');
      setButtonDisabled(button, !huidig || !nieuw || !bevestig);
      return;
  }
  
  // Enable button only if there are changes
  setButtonDisabled(button, !hasChanges(formName, currentValues));
}

// =============================================================================
// LOAD USER DATA (Prefill alle velden behalve wachtwoorden)
// =============================================================================

async function loadUserData() {
  try {
    const authState = authClient.getAuthState();
    if (!authState || !authState.access_token) {
      console.error('❌ [Account Beheren] Geen auth state');
      return;
    }

    console.log('🔄 [Account Beheren] Laden user data...');

    const data = await apiClient('/routes/dashboard/klant/profiel', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authState.access_token}`
      }
    });

    console.log('✅ [Account Beheren] User data geladen:', data);

    // Profiel form
    setFieldValue('profiel', 'voornaam', data.voornaam);
    setFieldValue('profiel', 'achternaam', data.achternaam);
    originalValues.profiel = {
      voornaam: data.voornaam || '',
      achternaam: data.achternaam || ''
    };

    // Email form
    setFieldValue('email', 'email', data.email);
    originalValues.email = {
      email: data.email || ''
    };

    // Telefoon form
    setFieldValue('telefoon', 'telefoon', data.telefoon);
    originalValues.telefoon = {
      telefoon: data.telefoon || ''
    };

    // Adres form
    if (data.adres) {
      setFieldValue('adres', 'postcode', data.adres.postcode);
      setFieldValue('adres', 'huisnummer', data.adres.huisnummer);
      setFieldValue('adres', 'toevoeging', data.adres.toevoeging);
      setFieldValue('adres', 'straatnaam', data.adres.straat);
      setFieldValue('adres', 'plaats', data.adres.plaats);
      originalValues.adres = {
        postcode: data.adres.postcode || '',
        huisnummer: data.adres.huisnummer || '',
        toevoeging: data.adres.toevoeging || '',
        straatnaam: data.adres.straat || '',
        plaats: data.adres.plaats || ''
      };
    }

    // Wachtwoord form blijft LEEG (geen prefill, geen original values)

    console.log('✅ [Account Beheren] Velden gevuld met user data');

  } catch (error) {
    console.error('❌ [Account Beheren] Fout bij laden user data:', error);
  }
}

// =============================================================================
// 1. PROFIEL FORM (voornaam + achternaam)
// =============================================================================

function initProfielForm() {
  const formName = 'profiel';
  const button = document.querySelector('[data-account-save="profiel"]');
  if (!button) return;

  // Initial state: disabled
  setButtonDisabled(button, true);

  // Listen to input changes
  const form = document.querySelector(`[data-account-form="${formName}"]`);
  if (form) {
    form.addEventListener('input', () => {
      updateButtonState(formName, button);
    });
  }

  // Save handler
  button.addEventListener('click', async (e) => {
    e.preventDefault();
    
    clearAllErrors(formName);

    try {
      const voornaam = getFieldValue(formName, 'voornaam');
      const achternaam = getFieldValue(formName, 'achternaam');

      // Validatie
      if (!voornaam) {
        showFieldError(formName, 'voornaam', 'Voornaam is verplicht');
        return;
      }
      if (!achternaam) {
        showFieldError(formName, 'achternaam', 'Achternaam is verplicht');
        return;
      }

      // API call
      const authState = authClient.getAuthState();
      const result = await apiClient('/routes/dashboard/klant/update-profiel', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authState.access_token}`
        },
        body: { voornaam, achternaam }
      });

      console.log('✅ [Profiel] Bijgewerkt');
      
      // Update original values
      originalValues.profiel = { voornaam, achternaam };
      setButtonDisabled(button, true);
      
      // Toon success met extra info als schoonmaker genotificeerd is
      let successMessage = 'Profiel bijgewerkt!';
      if (result.schoonmakerGenotificeerd) {
        successMessage += ' Je schoonmaker is automatisch op de hoogte gebracht.';
      }
      
      showSuccess(formName, successMessage);

    } catch (error) {
      console.error('❌ [Profiel] Fout:', error);
      showGlobalError(formName, error.message || 'Er ging iets mis');
    }
  });
}

// =============================================================================
// 2. EMAIL FORM
// =============================================================================

function initEmailForm() {
  const formName = 'email';
  const button = document.querySelector('[data-account-save="email"]');
  if (!button) return;

  setButtonDisabled(button, true);

  const form = document.querySelector(`[data-account-form="${formName}"]`);
  if (form) {
    form.addEventListener('input', () => {
      updateButtonState(formName, button);
    });
  }

  button.addEventListener('click', async (e) => {
    e.preventDefault();
    
    // Prevent dubbele clicks
    if (button.dataset.requesting === 'true') {
      console.log('[Email] Request al bezig, negeer duplicate click');
      return;
    }
    
    clearAllErrors(formName);

    try {
      // Mark als bezig
      button.dataset.requesting = 'true';
      setButtonDisabled(button, true);
      
      const nieuwEmail = getFieldValue(formName, 'email');

      // Validatie
      if (!nieuwEmail || !nieuwEmail.includes('@')) {
        showFieldError(formName, 'email', 'Geldig e-mailadres is verplicht');
        button.dataset.requesting = 'false';
        return;
      }

      // Email format validatie (zelfde als backend)
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(nieuwEmail)) {
        showFieldError(formName, 'email', 'Voer een geldig e-mailadres in');
        button.dataset.requesting = 'false';
        return;
      }

      const authState = authClient.getAuthState();
      
      // Stap 1: Request email change (stuur verificatie emails)
      const result = await apiClient('/routes/dashboard/klant/request-email-change', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authState.access_token}`
        },
        body: { nieuwEmail }
      });

      console.log('✅ [Email] Verificatie aangevraagd');
      
      // Reset form naar originele waarde (wijziging nog niet definitief)
      const emailInput = document.querySelector(`[data-account-form="${formName}"] input[name="email"]`);
      if (emailInput) {
        emailInput.value = originalValues.email.email || '';
      }
      
      showSuccess(formName, 'Check je nieuwe email voor de verificatie link. Je huidige email blijft actief tot je bevestigt.');

    } catch (error) {
      console.error('❌ [Email] Fout:', error);
      
      // Handle specifieke foutmeldingen
      if (error.errors && error.errors.nieuwEmail) {
        showFieldError(formName, 'email', error.errors.nieuwEmail);
      } else {
        showGlobalError(formName, error.message || 'Er ging iets mis');
      }
    } finally {
      // Reset requesting state
      button.dataset.requesting = 'false';
      setButtonDisabled(button, true);
    }
  });
}

// =============================================================================
// 3. TELEFOON FORM
// =============================================================================

function initTelefoonForm() {
  const formName = 'telefoon';
  const button = document.querySelector('[data-account-save="telefoon"]');
  if (!button) return;

  setButtonDisabled(button, true);

  const form = document.querySelector(`[data-account-form="${formName}"]`);
  if (form) {
    form.addEventListener('input', () => {
      updateButtonState(formName, button);
    });
  }

  button.addEventListener('click', async (e) => {
    e.preventDefault();
    
    // Duplicate click prevention
    if (button.dataset.requesting === 'true') {
      console.log('🚫 [Telefoon] Request already in progress');
      return;
    }
    
    clearAllErrors(formName);

    try {
      button.dataset.requesting = 'true';
      setButtonDisabled(button, true);

      const telefoon = getFieldValue(formName, 'telefoon');

      // Validatie
      if (!telefoon || telefoon.trim() === '') {
        showFieldError(formName, 'telefoon', 'Telefoonnummer is verplicht');
        return;
      }

      // Strip non-digits voor validatie
      const digitsOnly = telefoon.replace(/\D/g, '');
      
      // Dutch phone format check
      if (digitsOnly.length < 10) {
        showFieldError(formName, 'telefoon', 'Telefoonnummer moet minimaal 10 cijfers bevatten');
        return;
      }

      // Check formaat (0 voor nationaal, 31 voor internationaal)
      if (digitsOnly.startsWith('0')) {
        if (digitsOnly.length !== 10) {
          showFieldError(formName, 'telefoon', 'Nederlands telefoonnummer moet 10 cijfers zijn (bijv. 0612345678)');
          return;
        }
      } else if (digitsOnly.startsWith('31')) {
        if (digitsOnly.length < 11 || digitsOnly.length > 12) {
          showFieldError(formName, 'telefoon', 'Internationaal nummer moet 11-12 cijfers zijn (bijv. +31612345678)');
          return;
        }
      } else {
        showFieldError(formName, 'telefoon', 'Telefoonnummer moet beginnen met 06 of +31');
        return;
      }

      const authState = authClient.getAuthState();
      const response = await apiClient('/routes/dashboard/klant/update-telefoon', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authState.access_token}`
        },
        body: { telefoon }
      });

      console.log('✅ [Telefoon] Bijgewerkt');
      
      originalValues.telefoon = { telefoon };
      setButtonDisabled(button, true);
      
      // Dynamic success message
      let successMessage = 'Telefoonnummer succesvol bijgewerkt';
      if (response.schoonmakerGenotificeerd) {
        successMessage += ' • Je schoonmaker is op de hoogte gebracht';
      }
      showSuccess(formName, successMessage);

    } catch (error) {
      console.error('❌ [Telefoon] Fout:', error);
      showGlobalError(formName, error.message || 'Er ging iets mis');
    } finally {
      // Reset requesting flag
      delete button.dataset.requesting;
      updateButtonState(formName, button);
    }
  });
}

// =============================================================================
// 4. ADRES FORM (met postcode check)
// =============================================================================

function initAdresForm() {
  const formName = 'adres';
  const postcodeField = document.querySelector(`[data-account-form="${formName}"] [data-field-name="postcode"]`);
  const huisnummerField = document.querySelector(`[data-account-form="${formName}"] [data-field-name="huisnummer"]`);
  const button = document.querySelector('[data-account-save="adres"]');

  if (!button) return;
  
  setButtonDisabled(button, true);

  const form = document.querySelector(`[data-account-form="${formName}"]`);
  if (form) {
    form.addEventListener('input', () => {
      updateButtonState(formName, button);
    });
  }

  // Postcode check on blur
  if (postcodeField && huisnummerField) {
    const checkPostcode = async () => {
      const postcode = postcodeField.value.trim();
      const huisnummer = huisnummerField.value.trim();

      if (!postcode || !huisnummer) return;

      try {
        const result = await fetchAddressDetails(postcode, huisnummer);
        
        if (result.straat && result.plaats) {
          setFieldValue(formName, 'straatnaam', result.straat);
          setFieldValue(formName, 'plaats', result.plaats);
          clearFieldError(formName, 'postcode');
          clearFieldError(formName, 'huisnummer');
          
          // Trigger change detection
          updateButtonState(formName, button);
        }
      } catch (error) {
        console.error('❌ [Adres] Postcode check fout:', error);
        showFieldError(formName, 'postcode', 'Ongeldig adres');
      }
    };

    postcodeField.addEventListener('blur', checkPostcode);
    huisnummerField.addEventListener('blur', checkPostcode);
  }

  button.addEventListener('click', async (e) => {
    e.preventDefault();
    
    clearAllErrors(formName);

    try {
      const postcode = getFieldValue(formName, 'postcode');
      const huisnummer = getFieldValue(formName, 'huisnummer');
      const toevoeging = getFieldValue(formName, 'toevoeging');
      const straat = getFieldValue(formName, 'straatnaam');
      const plaats = getFieldValue(formName, 'plaats');

      if (!postcode) {
        showFieldError(formName, 'postcode', 'Postcode is verplicht');
        return;
      }
      if (!huisnummer) {
        showFieldError(formName, 'huisnummer', 'Huisnummer is verplicht');
        return;
      }
      if (!straat || !plaats) {
        showFieldError(formName, 'postcode', 'Vul eerst een geldige postcode en huisnummer in');
        return;
      }

      const authState = authClient.getAuthState();
      await apiClient('/routes/dashboard/klant/update-adres', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authState.access_token}`
        },
        body: { postcode, huisnummer, toevoeging, straat, plaats }
      });

      console.log('✅ [Adres] Bijgewerkt');
      
      originalValues.adres = { postcode, huisnummer, toevoeging, straatnaam: straat, plaats };
      setButtonDisabled(button, true);
      
      showSuccess(formName, 'Adres bijgewerkt!');

    } catch (error) {
      console.error('❌ [Adres] Fout:', error);
      showGlobalError(formName, error.message || 'Er ging iets mis');
    }
  });
}

// =============================================================================
// 5. WACHTWOORD FORM (met verificatie huidig wachtwoord)
// =============================================================================

function initWachtwoordForm() {
  const formName = 'wachtwoord';
  const button = document.querySelector('[data-account-save="wachtwoord"]');
  if (!button) return;

  setButtonDisabled(button, true);

  const form = document.querySelector(`[data-account-form="${formName}"]`);
  if (form) {
    form.addEventListener('input', () => {
      updateButtonState(formName, button);
    });
  }

  button.addEventListener('click', async (e) => {
    e.preventDefault();
    
    clearAllErrors(formName);

    try {
      const huidigWachtwoord = getFieldValue(formName, 'huidig-wachtwoord');
      const nieuwWachtwoord = getFieldValue(formName, 'nieuw-wachtwoord');
      const bevestigWachtwoord = getFieldValue(formName, 'bevestig-wachtwoord');

      if (!huidigWachtwoord) {
        showFieldError(formName, 'huidig-wachtwoord', 'Huidig wachtwoord is verplicht');
        return;
      }
      if (!nieuwWachtwoord || nieuwWachtwoord.length < 8) {
        showFieldError(formName, 'nieuw-wachtwoord', 'Nieuw wachtwoord moet minimaal 8 tekens zijn');
        return;
      }
      if (nieuwWachtwoord !== bevestigWachtwoord) {
        showFieldError(formName, 'bevestig-wachtwoord', 'Wachtwoorden komen niet overeen');
        return;
      }

      const authState = authClient.getAuthState();
      await apiClient('/routes/dashboard/klant/update-wachtwoord', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authState.access_token}`
        },
        body: { 
          huidigWachtwoord, 
          nieuwWachtwoord 
        }
      });

      console.log('✅ [Wachtwoord] Bijgewerkt');
      
      // Clear alle wachtwoord velden
      setFieldValue(formName, 'huidig-wachtwoord', '');
      setFieldValue(formName, 'nieuw-wachtwoord', '');
      setFieldValue(formName, 'bevestig-wachtwoord', '');
      setButtonDisabled(button, true);
      
      showSuccess(formName, 'Wachtwoord succesvol gewijzigd!');

    } catch (error) {
      console.error('❌ [Wachtwoord] Fout:', error);
      
      if (error.message && error.message.includes('onjuist')) {
        showFieldError(formName, 'huidig-wachtwoord', 'Huidig wachtwoord is onjuist');
      } else {
        showGlobalError(formName, error.message || 'Er ging iets mis');
      }
    }
  });
}

// =============================================================================
// MAIN INIT
// =============================================================================

export async function initAccountBeheren() {
  console.log('⚙️ [Account Beheren] Initialiseren...');

  // Load user data en prefill alle velden (behalve wachtwoorden)
  await loadUserData();

  // Initialiseer alle 5 formulieren
  initProfielForm();
  initEmailForm();
  initTelefoonForm();
  initAdresForm();
  initWachtwoordForm();

  console.log('✅ [Account Beheren] Alle formulieren geïnitialiseerd');
}
