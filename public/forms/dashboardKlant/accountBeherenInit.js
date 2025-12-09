// public/forms/dashboardKlant/accountBeherenInit.js
/**
 * Account Beheren - Klant Dashboard
 * 
 * 5 aparte formulieren:
 * 1. Profiel (voornaam + achternaam)
 * 2. Email
 * 3. Telefoonnummer
 * 4. Adresgegevens (met postcode check)
 * 5. Wachtwoord wijzigen
 */

import { apiClient } from '../../utils/api/client.js';
import { authClient } from '../../utils/auth/authClient.js';
import { checkAddress } from '../../utils/api/address.js';

/**
 * Toon/verberg loading state op button
 */
function setButtonLoading(button, isLoading) {
  if (isLoading) {
    button.classList.add('is-loading');
    button.disabled = true;
  } else {
    button.classList.remove('is-loading');
    button.disabled = false;
  }
}

/**
 * Toon success boodschap
 */
function showSuccess(formElement, message = 'Wijzigingen opgeslagen!') {
  const successWrapper = formElement.querySelector('.form_message-success-wrapper');
  const successDiv = formElement.querySelector('.form_message-success div');
  
  if (successWrapper && successDiv) {
    successDiv.textContent = message;
    successWrapper.style.display = 'block';
    
    setTimeout(() => {
      successWrapper.style.display = 'none';
    }, 3000);
  }
}

/**
 * Toon error boodschap
 */
function showError(formElement, message = 'Er ging iets mis. Probeer het opnieuw.') {
  const errorWrapper = formElement.querySelector('.form_message-error-wrapper');
  const errorDiv = formElement.querySelector('.form_message-error div');
  
  if (errorWrapper && errorDiv) {
    errorDiv.textContent = message;
    errorWrapper.style.display = 'block';
    
    setTimeout(() => {
      errorWrapper.style.display = 'none';
    }, 5000);
  }
}

/**
 * Toon field-level error
 */
function showFieldError(fieldName, message) {
  const errorEl = document.querySelector(`[data-error-for="${fieldName}"]`);
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.remove('hide');
  }
}

/**
 * Verberg field-level error
 */
function hideFieldError(fieldName) {
  const errorEl = document.querySelector(`[data-error-for="${fieldName}"]`);
  if (errorEl) {
    errorEl.classList.add('hide');
  }
}

/**
 * Verberg alle field errors
 */
function hideAllFieldErrors() {
  document.querySelectorAll('[data-error-for]').forEach(el => {
    el.classList.add('hide');
  });
}

// =============================================================================
// 1. PROFIEL FORMULIER (Voornaam + Achternaam)
// =============================================================================

function initProfielForm() {
  const form = document.querySelector('[data-account-form="profiel"]');
  const button = document.querySelector('[data-account-save="profiel"]');
  
  if (!form || !button) {
    console.warn('[Account] Profiel form of button niet gevonden');
    return;
  }

  const voornaamInput = form.querySelector('[data-field-name="voornaam"]');
  const achternaamInput = form.querySelector('[data-field-name="achternaam"]');

  // Opslaan handler
  button.addEventListener('click', async (e) => {
    e.preventDefault();
    hideAllFieldErrors();

    const voornaam = voornaamInput?.value.trim();
    const achternaam = achternaamInput?.value.trim();

    // Validatie
    if (!voornaam || !achternaam) {
      showError(form, 'Vul alle velden in.');
      return;
    }

    setButtonLoading(button, true);

    try {
      const authState = authClient.getAuthState();
      await apiClient('/routes/dashboard/klant/update-profiel', {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${authState.access_token}` },
        body: JSON.stringify({ voornaam, achternaam })
      });

      showSuccess(form);
      console.log('✅ Profiel bijgewerkt');

    } catch (error) {
      console.error('❌ Profiel update error:', error);
      showError(form, error.message || 'Kon profiel niet bijwerken.');
    } finally {
      setButtonLoading(button, false);
    }
  });

  console.log('✅ Profiel formulier geïnitialiseerd');
}

// =============================================================================
// 2. EMAIL FORMULIER
// =============================================================================

function initEmailForm() {
  const form = document.querySelector('[data-account-form="email"]');
  const button = document.querySelector('[data-account-save="email"]');
  
  if (!form || !button) {
    console.warn('[Account] Email form of button niet gevonden');
    return;
  }

  const emailInput = form.querySelector('[data-field-name="email"]');

  button.addEventListener('click', async (e) => {
    e.preventDefault();
    hideAllFieldErrors();

    const email = emailInput?.value.trim();

    // Validatie
    if (!email || !email.includes('@')) {
      showError(form, 'Vul een geldig e-mailadres in.');
      return;
    }

    setButtonLoading(button, true);

    try {
      const authState = authClient.getAuthState();
      await apiClient('/routes/dashboard/klant/update-email', {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${authState.access_token}` },
        body: JSON.stringify({ email })
      });

      showSuccess(form, 'E-mailadres bijgewerkt! Controleer je inbox voor bevestiging.');
      console.log('✅ Email bijgewerkt');

    } catch (error) {
      console.error('❌ Email update error:', error);
      showError(form, error.message || 'Kon e-mailadres niet bijwerken.');
    } finally {
      setButtonLoading(button, false);
    }
  });

  console.log('✅ Email formulier geïnitialiseerd');
}

// =============================================================================
// 3. TELEFOONNUMMER FORMULIER
// =============================================================================

function initTelefoonForm() {
  const form = document.querySelector('[data-account-form="telefoon"]');
  const button = document.querySelector('[data-account-save="telefoon"]');
  
  if (!form || !button) {
    console.warn('[Account] Telefoon form of button niet gevonden');
    return;
  }

  const telefoonInput = form.querySelector('[data-field-name="telefoon"]');

  button.addEventListener('click', async (e) => {
    e.preventDefault();
    hideAllFieldErrors();

    const telefoon = telefoonInput?.value.trim();

    // Validatie
    if (!telefoon || telefoon.length < 10) {
      showError(form, 'Vul een geldig telefoonnummer in.');
      return;
    }

    setButtonLoading(button, true);

    try {
      const authState = authClient.getAuthState();
      await apiClient('/routes/dashboard/klant/update-telefoon', {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${authState.access_token}` },
        body: JSON.stringify({ telefoon })
      });

      showSuccess(form);
      console.log('✅ Telefoon bijgewerkt');

    } catch (error) {
      console.error('❌ Telefoon update error:', error);
      showError(form, error.message || 'Kon telefoonnummer niet bijwerken.');
    } finally {
      setButtonLoading(button, false);
    }
  });

  console.log('✅ Telefoon formulier geïnitialiseerd');
}

// =============================================================================
// 4. ADRES FORMULIER (met postcode check)
// =============================================================================

function initAdresForm() {
  const form = document.querySelector('[data-account-form="adres"]');
  const button = document.querySelector('[data-account-save="adres"]');
  
  if (!form || !button) {
    console.warn('[Account] Adres form of button niet gevonden');
    return;
  }

  const postcodeInput = form.querySelector('[data-field-name="postcode"]');
  const huisnummerInput = form.querySelector('[data-field-name="huisnummer"]');
  const toevoegingInput = form.querySelector('[data-field-name="toevoeging"]');
  const straatInput = form.querySelector('[data-field-name="straatnaam"]');
  const plaatsInput = form.querySelector('[data-field-name="plaats"]');

  // Postcode check bij blur op huisnummer
  if (postcodeInput && huisnummerInput) {
    const handleAddressCheck = async () => {
      const postcode = postcodeInput.value.trim();
      const huisnummer = huisnummerInput.value.trim();
      
      if (!postcode || !huisnummer) return;

      hideFieldError('postcode');
      hideFieldError('huisnummer');

      try {
        const addressData = await checkAddress(postcode, huisnummer);
        
        if (straatInput) straatInput.value = addressData.straat || '';
        if (plaatsInput) plaatsInput.value = addressData.plaats || '';
        
      } catch (error) {
        console.error('Adres check error:', error);
        showFieldError('global', 'Kon adres niet ophalen. Controleer postcode en huisnummer.');
      }
    };

    huisnummerInput.addEventListener('blur', handleAddressCheck);
    postcodeInput.addEventListener('blur', handleAddressCheck);
  }

  // Opslaan handler
  button.addEventListener('click', async (e) => {
    e.preventDefault();
    hideAllFieldErrors();

    const postcode = postcodeInput?.value.trim();
    const huisnummer = huisnummerInput?.value.trim();
    const toevoeging = toevoegingInput?.value.trim() || null;
    const straat = straatInput?.value.trim();
    const plaats = plaatsInput?.value.trim();

    // Validatie
    if (!postcode || !huisnummer || !straat || !plaats) {
      showError(form, 'Vul alle verplichte velden in.');
      return;
    }

    setButtonLoading(button, true);

    try {
      const authState = authClient.getAuthState();
      await apiClient('/routes/dashboard/klant/update-adres', {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${authState.access_token}` },
        body: JSON.stringify({ postcode, huisnummer, toevoeging, straat, plaats })
      });

      showSuccess(form);
      console.log('✅ Adres bijgewerkt');

    } catch (error) {
      console.error('❌ Adres update error:', error);
      showError(form, error.message || 'Kon adres niet bijwerken.');
    } finally {
      setButtonLoading(button, false);
    }
  });

  console.log('✅ Adres formulier geïnitialiseerd');
}

// =============================================================================
// 5. WACHTWOORD FORMULIER
// =============================================================================

function initWachtwoordForm() {
  const form = document.querySelector('[data-account-form="wachtwoord"]');
  const button = document.querySelector('[data-account-save="wachtwoord"]');
  
  if (!form || !button) {
    console.warn('[Account] Wachtwoord form of button niet gevonden');
    return;
  }

  const huidigInput = form.querySelector('[data-field-name="huidig-wachtwoord"]');
  const nieuwInput = form.querySelector('[data-field-name="nieuw-wachtwoord"]');
  const bevestigInput = form.querySelector('[data-field-name="bevestig-wachtwoord"]');

  button.addEventListener('click', async (e) => {
    e.preventDefault();
    hideAllFieldErrors();

    const huidig = huidigInput?.value;
    const nieuw = nieuwInput?.value;
    const bevestig = bevestigInput?.value;

    // Validatie
    if (!huidig || !nieuw || !bevestig) {
      showError(form, 'Vul alle velden in.');
      return;
    }

    if (nieuw.length < 8) {
      showError(form, 'Nieuw wachtwoord moet minimaal 8 tekens zijn.');
      return;
    }

    if (nieuw !== bevestig) {
      showError(form, 'Wachtwoorden komen niet overeen.');
      return;
    }

    setButtonLoading(button, true);

    try {
      const authState = authClient.getAuthState();
      await apiClient('/routes/dashboard/klant/update-wachtwoord', {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${authState.access_token}` },
        body: JSON.stringify({ huidigWachtwoord: huidig, nieuwWachtwoord: nieuw })
      });

      showSuccess(form, 'Wachtwoord succesvol gewijzigd!');
      
      // Clear inputs
      if (huidigInput) huidigInput.value = '';
      if (nieuwInput) nieuwInput.value = '';
      if (bevestigInput) bevestigInput.value = '';
      
      console.log('✅ Wachtwoord bijgewerkt');

    } catch (error) {
      console.error('❌ Wachtwoord update error:', error);
      showError(form, error.message || 'Kon wachtwoord niet wijzigen. Controleer je huidige wachtwoord.');
    } finally {
      setButtonLoading(button, false);
    }
  });

  console.log('✅ Wachtwoord formulier geïnitialiseerd');
}

// =============================================================================
// DATA OPHALEN EN VULLEN
// =============================================================================

async function loadUserData() {
  try {
    const authState = authClient.getAuthState();
    const userData = await apiClient('/routes/dashboard/klant/profiel', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${authState.access_token}` }
    });

    // Vul profiel
    const voornaamInput = document.querySelector('[data-field-name="voornaam"]');
    const achternaamInput = document.querySelector('[data-field-name="achternaam"]');
    if (voornaamInput) voornaamInput.value = userData.voornaam || '';
    if (achternaamInput) achternaamInput.value = userData.achternaam || '';

    // Vul email
    const emailInput = document.querySelector('[data-field-name="email"]');
    if (emailInput) emailInput.value = userData.email || '';

    // Vul telefoon
    const telefoonInput = document.querySelector('[data-field-name="telefoon"]');
    if (telefoonInput) telefoonInput.value = userData.telefoon || '';

    // Vul adres
    if (userData.adres) {
      const postcodeInput = document.querySelector('[data-field-name="postcode"]');
      const huisnummerInput = document.querySelector('[data-field-name="huisnummer"]');
      const toevoegingInput = document.querySelector('[data-field-name="toevoeging"]');
      const straatInput = document.querySelector('[data-field-name="straatnaam"]');
      const plaatsInput = document.querySelector('[data-field-name="plaats"]');

      if (postcodeInput) postcodeInput.value = userData.adres.postcode || '';
      if (huisnummerInput) huisnummerInput.value = userData.adres.huisnummer || '';
      if (toevoegingInput) toevoegingInput.value = userData.adres.toevoeging || '';
      if (straatInput) straatInput.value = userData.adres.straat || '';
      if (plaatsInput) plaatsInput.value = userData.adres.plaats || '';
    }

    console.log('✅ User data geladen');

  } catch (error) {
    console.error('❌ Fout bij laden user data:', error);
  }
}

// =============================================================================
// MAIN INIT
// =============================================================================

export async function initAccountBeheren() {
  console.log('⚙️ [Account Beheren] Initialiseren...');

  // Laad user data
  await loadUserData();

  // Initialiseer alle formulieren
  initProfielForm();
  initEmailForm();
  initTelefoonForm();
  initAdresForm();
  initWachtwoordForm();

  console.log('✅ [Account Beheren] Alle formulieren geïnitialiseerd');
}
