// public/forms/dashboardKlant/accountBeherenInit.js
/**
 * Account beheren initialisatie voor klanten
 * Bevat 5 aparte formulieren: profiel, email, telefoon, adres, wachtwoord
 */
import { apiClient } from '../../utils/api/client.js';
import { authClient } from '../../utils/auth/authClient.js';
import { checkAddress } from '../../utils/api/address.js';

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

  // Toon success wrapper
  const successWrapper = formWrapper.querySelector('.form_message-success-wrapper');
  if (successWrapper) {
    const messageDiv = successWrapper.querySelector('.form_message-success div');
    if (messageDiv) messageDiv.textContent = message;
    successWrapper.style.display = 'block';

    // Reset na 3 seconden
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
 * UI Helper: Set button loading state
 */
function setButtonLoading(button, isLoading) {
  if (isLoading) {
    button.classList.add('is-loading');
    button.style.pointerEvents = 'none';
  } else {
    button.classList.remove('is-loading');
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

    // Email form
    setFieldValue('email', 'email', data.email);

    // Telefoon form
    setFieldValue('telefoon', 'telefoon', data.telefoon);

    // Adres form
    if (data.adres) {
      setFieldValue('adres', 'postcode', data.adres.postcode);
      setFieldValue('adres', 'huisnummer', data.adres.huisnummer);
      setFieldValue('adres', 'toevoeging', data.adres.toevoeging);
      setFieldValue('adres', 'straatnaam', data.adres.straat);
      setFieldValue('adres', 'plaats', data.adres.plaats);
    }

    // Wachtwoord form blijft LEEG (geen prefill)

    console.log('✅ [Account Beheren] Velden gevuld met user data');

  } catch (error) {
    console.error('❌ [Account Beheren] Fout bij laden user data:', error);
  }
}

// =============================================================================
// 1. PROFIEL FORM (voornaam + achternaam)
// =============================================================================

function initProfielForm() {
  const button = document.querySelector('[data-account-save="profiel"]');
  if (!button) return;

  button.addEventListener('click', async (e) => {
    e.preventDefault();
    
    const formName = 'profiel';
    clearAllErrors(formName);
    setButtonLoading(button, true);

    try {
      const voornaam = getFieldValue(formName, 'voornaam');
      const achternaam = getFieldValue(formName, 'achternaam');

      // Validatie
      if (!voornaam) {
        showFieldError(formName, 'voornaam', 'Voornaam is verplicht');
        setButtonLoading(button, false);
        return;
      }
      if (!achternaam) {
        showFieldError(formName, 'achternaam', 'Achternaam is verplicht');
        setButtonLoading(button, false);
        return;
      }

      // API call
      const authState = authClient.getAuthState();
      await apiClient('/routes/dashboard/klant/update-profiel', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authState.access_token}`
        },
        body: { voornaam, achternaam }
      });

      console.log('✅ [Profiel] Bijgewerkt');
      showSuccess(formName, 'Profiel bijgewerkt!');

    } catch (error) {
      console.error('❌ [Profiel] Fout:', error);
      showGlobalError(formName, error.message || 'Er ging iets mis');
    } finally {
      setButtonLoading(button, false);
    }
  });
}

// =============================================================================
// 2. EMAIL FORM
// =============================================================================

function initEmailForm() {
  const button = document.querySelector('[data-account-save="email"]');
  if (!button) return;

  button.addEventListener('click', async (e) => {
    e.preventDefault();
    
    const formName = 'email';
    clearAllErrors(formName);
    setButtonLoading(button, true);

    try {
      const email = getFieldValue(formName, 'email');

      // Validatie
      if (!email || !email.includes('@')) {
        showFieldError(formName, 'email', 'Geldig e-mailadres is verplicht');
        setButtonLoading(button, false);
        return;
      }

      // API call
      const authState = authClient.getAuthState();
      await apiClient('/routes/dashboard/klant/update-email', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authState.access_token}`
        },
        body: { email }
      });

      console.log('✅ [Email] Bijgewerkt');
      showSuccess(formName, 'E-mailadres bijgewerkt! Controleer je inbox voor bevestiging.');

    } catch (error) {
      console.error('❌ [Email] Fout:', error);
      showGlobalError(formName, error.message || 'Er ging iets mis');
    } finally {
      setButtonLoading(button, false);
    }
  });
}

// =============================================================================
// 3. TELEFOON FORM
// =============================================================================

function initTelefoonForm() {
  const button = document.querySelector('[data-account-save="telefoon"]');
  if (!button) return;

  button.addEventListener('click', async (e) => {
    e.preventDefault();
    
    const formName = 'telefoon';
    clearAllErrors(formName);
    setButtonLoading(button, true);

    try {
      const telefoon = getFieldValue(formName, 'telefoon');

      // Validatie
      if (!telefoon || telefoon.length < 10) {
        showFieldError(formName, 'telefoon', 'Geldig telefoonnummer is verplicht (minimaal 10 tekens)');
        setButtonLoading(button, false);
        return;
      }

      // API call
      const authState = authClient.getAuthState();
      await apiClient('/routes/dashboard/klant/update-telefoon', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authState.access_token}`
        },
        body: { telefoon }
      });

      console.log('✅ [Telefoon] Bijgewerkt');
      showSuccess(formName, 'Telefoonnummer bijgewerkt!');

    } catch (error) {
      console.error('❌ [Telefoon] Fout:', error);
      showGlobalError(formName, error.message || 'Er ging iets mis');
    } finally {
      setButtonLoading(button, false);
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

  // Postcode check on blur
  if (postcodeField && huisnummerField) {
    const checkPostcode = async () => {
      const postcode = postcodeField.value.trim();
      const huisnummer = huisnummerField.value.trim();

      if (!postcode || !huisnummer) return;

      try {
        const result = await checkAddress(postcode, huisnummer);
        
        if (result.straat && result.plaats) {
          setFieldValue(formName, 'straatnaam', result.straat);
          setFieldValue(formName, 'plaats', result.plaats);
          clearFieldError(formName, 'postcode');
          clearFieldError(formName, 'huisnummer');
        }
      } catch (error) {
        console.error('❌ [Adres] Postcode check fout:', error);
        showFieldError(formName, 'postcode', 'Ongeldig adres');
      }
    };

    postcodeField.addEventListener('blur', checkPostcode);
    huisnummerField.addEventListener('blur', checkPostcode);
  }

  // Save button
  if (!button) return;

  button.addEventListener('click', async (e) => {
    e.preventDefault();
    
    clearAllErrors(formName);
    setButtonLoading(button, true);

    try {
      const postcode = getFieldValue(formName, 'postcode');
      const huisnummer = getFieldValue(formName, 'huisnummer');
      const toevoeging = getFieldValue(formName, 'toevoeging');
      const straat = getFieldValue(formName, 'straatnaam');
      const plaats = getFieldValue(formName, 'plaats');

      // Validatie
      if (!postcode) {
        showFieldError(formName, 'postcode', 'Postcode is verplicht');
        setButtonLoading(button, false);
        return;
      }
      if (!huisnummer) {
        showFieldError(formName, 'huisnummer', 'Huisnummer is verplicht');
        setButtonLoading(button, false);
        return;
      }
      if (!straat || !plaats) {
        showFieldError(formName, 'postcode', 'Vul eerst een geldige postcode en huisnummer in');
        setButtonLoading(button, false);
        return;
      }

      // API call
      const authState = authClient.getAuthState();
      await apiClient('/routes/dashboard/klant/update-adres', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authState.access_token}`
        },
        body: { postcode, huisnummer, toevoeging, straat, plaats }
      });

      console.log('✅ [Adres] Bijgewerkt');
      showSuccess(formName, 'Adres bijgewerkt!');

    } catch (error) {
      console.error('❌ [Adres] Fout:', error);
      showGlobalError(formName, error.message || 'Er ging iets mis');
    } finally {
      setButtonLoading(button, false);
    }
  });
}

// =============================================================================
// 5. WACHTWOORD FORM (met verificatie huidig wachtwoord)
// =============================================================================

function initWachtwoordForm() {
  const button = document.querySelector('[data-account-save="wachtwoord"]');
  if (!button) return;

  button.addEventListener('click', async (e) => {
    e.preventDefault();
    
    const formName = 'wachtwoord';
    clearAllErrors(formName);
    setButtonLoading(button, true);

    try {
      const huidigWachtwoord = getFieldValue(formName, 'huidig-wachtwoord');
      const nieuwWachtwoord = getFieldValue(formName, 'nieuw-wachtwoord');
      const bevestigWachtwoord = getFieldValue(formName, 'bevestig-wachtwoord');

      // Validatie
      if (!huidigWachtwoord) {
        showFieldError(formName, 'huidig-wachtwoord', 'Huidig wachtwoord is verplicht');
        setButtonLoading(button, false);
        return;
      }
      if (!nieuwWachtwoord || nieuwWachtwoord.length < 8) {
        showFieldError(formName, 'nieuw-wachtwoord', 'Nieuw wachtwoord moet minimaal 8 tekens zijn');
        setButtonLoading(button, false);
        return;
      }
      if (nieuwWachtwoord !== bevestigWachtwoord) {
        showFieldError(formName, 'bevestig-wachtwoord', 'Wachtwoorden komen niet overeen');
        setButtonLoading(button, false);
        return;
      }

      // API call (backend verifieert huidig wachtwoord)
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
      
      // Clear wachtwoord velden na success
      setFieldValue(formName, 'huidig-wachtwoord', '');
      setFieldValue(formName, 'nieuw-wachtwoord', '');
      setFieldValue(formName, 'bevestig-wachtwoord', '');
      
      showSuccess(formName, 'Wachtwoord succesvol gewijzigd!');

    } catch (error) {
      console.error('❌ [Wachtwoord] Fout:', error);
      
      // Specifieke error voor verkeerd huidig wachtwoord
      if (error.message && error.message.includes('onjuist')) {
        showFieldError(formName, 'huidig-wachtwoord', 'Huidig wachtwoord is onjuist');
      } else {
        showGlobalError(formName, error.message || 'Er ging iets mis');
      }
    } finally {
      setButtonLoading(button, false);
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
