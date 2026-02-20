// public/forms/dashboardSchoonmaker/accountBeherenInit.js
/**
 * Account beheren initialisatie voor schoonmakers
 * Bevat 5 aparte formulieren: profiel, email, telefoon, adres, wachtwoord
 * + Stripe Connect button voor bankgegevens
 * Gebruikt formHandler.init() zoals alle andere flows
 */
import { formHandler } from '../logic/formHandler.js';
import { getFormSchema } from '../schemas/formSchemas.js';
import { apiClient } from '../../utils/api/client.js';
import { authClient } from '../../utils/auth/authClient.js';
import { fetchAddressDetails } from '../../utils/api/address.js';
import { initAddressLookupTrigger } from '../logic/formTriggers.js';
import { hideAllSuccessMessages } from '../ui/formUi.js';

/**
 * Load user data from API for prefilling
 */
async function loadUserData() {
  const authState = authClient.getAuthState();
  if (!authState?.access_token) {
    console.error('❌ [Account Beheren Schoonmaker] Geen access token');
    return null;
  }

  try {
    const profileData = await apiClient('/routes/dashboard/schoonmaker/profile', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${authState.access_token}` }
    });

    console.log('🔍 [Account Beheren Schoonmaker] Profile API response:', profileData);

    // All data from API (including email from database)
    const userData = {
      id: authState.user?.id,
      role: authState.user?.role,
      ...profileData
    };

    console.log('🔍 [Account Beheren Schoonmaker] Combined userData:', userData);
    return userData;
  } catch (error) {
    console.error('❌ [Account Beheren Schoonmaker] Error loading user data:', error);
    return null;
  }
}

// ============================================================================
// 1. PROFIEL FORM
// ============================================================================

function initProfielForm(userData) {
  const schema = getFormSchema('account-profiel-form');
  if (!schema) return;

  // Custom submit action
  schema.submit = {
    action: async (formData) => {
      const authState = authClient.getAuthState();
      const response = await apiClient('/routes/dashboard/schoonmaker/update-profiel', {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${authState.access_token}` },
        body: formData
      });

      return { message: 'Naam succesvol bijgewerkt' };
    },
    onSuccess: () => {
      const formName = 'account-profiel-form';
      // Show inline success message
      formHandler.showSuccessState(formName, {
        messageAttribute: formName,
        hideForm: false,
        scrollIntoView: false
      });
      
      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        console.log(`[Account Beheren Schoonmaker] Auto-hiding success for ${formName}`);
        const successEl = document.querySelector(`[data-success-message="${formName}"]`);
        if (successEl) {
          successEl.style.display = 'none';
        }
      }, 5000);
    }
  };

  // Pass userData as initialData to formHandler
  formHandler.init(schema, userData);
}

// ============================================================================
// 2. EMAIL FORM
// ============================================================================

function initEmailForm(userData) {
  const schema = getFormSchema('account-email-form');
  if (!schema) return;

  schema.submit = {
    action: async (formData) => {
      const authState = authClient.getAuthState();
      await apiClient('/routes/dashboard/schoonmaker/update-email', {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${authState.access_token}` },
        body: formData
      });
      return { message: 'Email succesvol bijgewerkt' };
    },
    onSuccess: () => {
      const formName = 'account-email-form';
      formHandler.showSuccessState(formName, {
        messageAttribute: formName,
        hideForm: false,
        scrollIntoView: false
      });
      setTimeout(() => {
        const successEl = document.querySelector(`[data-success-message="${formName}"]`);
        if (successEl) successEl.style.display = 'none';
      }, 5000);
    }
  };

  formHandler.init(schema, userData);
}

// ============================================================================
// 3. TELEFOON FORM
// ============================================================================

function initTelefoonForm(userData) {
  const schema = getFormSchema('account-telefoon-form');
  if (!schema) return;

  schema.submit = {
    action: async (formData) => {
      const authState = authClient.getAuthState();
      await apiClient('/routes/dashboard/schoonmaker/update-telefoon', {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${authState.access_token}` },
        body: formData
      });
      return { message: 'Telefoon succesvol bijgewerkt' };
    },
    onSuccess: () => {
      const formName = 'account-telefoon-form';
      formHandler.showSuccessState(formName, {
        messageAttribute: formName,
        hideForm: false,
        scrollIntoView: false
      });
      setTimeout(() => {
        const successEl = document.querySelector(`[data-success-message="${formName}"]`);
        if (successEl) successEl.style.display = 'none';
      }, 5000);
    }
  };

  formHandler.init(schema, userData);
}

// ============================================================================
// 4. ADRES FORM
// ============================================================================

function initAdresForm(userData) {
  const schema = getFormSchema('account-adres-form');
  if (!schema) return;

  schema.submit = {
    action: async (formData) => {
      // Address verification - before submitting
      const addressDetails = await fetchAddressDetails(
        formData.postcode,
        formData.huisnummer,
        formData.toevoeging || ''
      );

      if (!addressDetails) {
        const error = new Error('Ongeldig adres. Controleer je postcode en huisnummer.');
        error.code = 'ADDRESS_NOT_FOUND';
        throw error;
      }

      const authState = authClient.getAuthState();
      const response = await apiClient('/routes/dashboard/schoonmaker/update-adres', {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${authState.access_token}` },
        body: {
          ...formData,
          straatnaam: addressDetails.straat,
          plaats: addressDetails.plaats
        }
      });

      return { message: 'Adres succesvol bijgewerkt' };
    },
    onSuccess: () => {
      const formName = 'account-adres-form';
      // Show inline success message
      formHandler.showSuccessState(formName, {
        messageAttribute: formName,
        hideForm: false,
        scrollIntoView: false
      });
      
      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        console.log(`[Account Beheren Schoonmaker] Auto-hiding success for ${formName}`);
        const successEl = document.querySelector(`[data-success-message="${formName}"]`);
        if (successEl) {
          successEl.style.display = 'none';
        }
      }, 5000);
    }
  };

  // Pass userData as initialData to formHandler
  formHandler.init(schema, userData);

  // Initialize address lookup trigger (automatic lookup on postcode/huisnummer change)
  initAddressLookupTrigger(formHandler, {
    postcodeField: 'postcode',
    huisnummerField: 'huisnummer',
    straatField: 'straatnaam',
    plaatsField: 'plaats'
  });
}

// ============================================================================
// 5. WACHTWOORD FORM
// ============================================================================

function initWachtwoordForm() {
  const schema = getFormSchema('account-wachtwoord-form');
  if (!schema) return;

  schema.submit = {
    action: async (formData) => {
      // Custom validation: passwords must match
      if (formData.nieuwWachtwoord !== formData.bevestigWachtwoord) {
        const error = new Error('Wachtwoorden komen niet overeen');
        error.code = 'PASSWORD_MISMATCH';
        throw error;
      }

      // Custom validation: new password must be different
      if (formData.huidigWachtwoord === formData.nieuwWachtwoord) {
        const error = new Error('Nieuw wachtwoord moet verschillen van huidig wachtwoord');
        error.code = 'SAME_PASSWORD';
        throw error;
      }

      const authState = authClient.getAuthState();
      await apiClient('/routes/dashboard/schoonmaker/update-wachtwoord', {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${authState.access_token}` },
        body: {
          huidigWachtwoord: formData.huidigWachtwoord,
          nieuwWachtwoord: formData.nieuwWachtwoord
        }
      });

      // Clear password fields after success
      ['huidigWachtwoord', 'nieuwWachtwoord', 'bevestigWachtwoord'].forEach(fieldName => {
        const field = document.querySelector(`[data-field-name="${fieldName}"]`);
        if (field) field.value = '';
      });

      return { message: 'Wachtwoord succesvol gewijzigd • Je wordt uitgelogd...' };
    },
    onSuccess: () => {
      const formName = 'account-wachtwoord-form';
      
      // 🔒 BELANGRIJK: Clear localStorage DIRECT om race conditions te voorkomen
      // Token is al invalid op server (Supabase invalideerde bij password change)
      // Als we niet direct clearen, kan gebruiker nog navigeren naar dashboard pages
      // die dan 401 errors krijgen en dubbele redirects veroorzaken
      console.log('[Account Beheren Schoonmaker] Clearing localStorage direct na wachtwoord wijziging');
      localStorage.removeItem('heppy_auth');
      
      // Show inline success message
      formHandler.showSuccessState(formName, {
        messageAttribute: formName,
        hideForm: false,
        scrollIntoView: false
      });
      
      // Logout en redirect na 3 seconden
      setTimeout(() => {
        console.log('[Account Beheren Schoonmaker] Redirecting na wachtwoord wijziging...');
        window.location.href = '/inloggen?message=Wachtwoord gewijzigd. Log opnieuw in met je nieuwe wachtwoord.';
      }, 3000);
    }
  };

  formHandler.init(schema);
}

// ============================================================================
// 6. STRIPE CONNECT BUTTON
// ============================================================================

function initStripeConnectButton() {
  const stripeBtn = document.querySelector('[data-stripe-connect-btn]');
  if (!stripeBtn) {
    console.warn('[Account Beheren Schoonmaker] Stripe Connect button niet gevonden');
    return;
  }

  stripeBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    
    try {
      const authState = authClient.getAuthState();
      if (!authState?.access_token) {
        console.error('❌ [Stripe Connect] Geen access token');
        return;
      }

      console.log('🔗 [Stripe Connect] Ophalen login link...');

      // Get Stripe Connect login link
      const response = await apiClient('/routes/dashboard/schoonmaker/stripe-connect-link', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${authState.access_token}` }
      });

      if (response.loginLink) {
        // Redirect to Stripe
        window.location.href = response.loginLink;
      } else {
        console.error('❌ [Stripe Connect] Geen login link ontvangen');
      }
    } catch (error) {
      console.error('❌ [Stripe Connect] Error:', error);
    }
  });
}

// ============================================================================
// MAIN INIT
// ============================================================================

export async function initAccountBeheren() {
  console.log('⚙️ [Account Beheren Schoonmaker] Initialiseren...');

  // ⚠️ BELANGRIJK: Check authenticatie EERST voordat we iets doen
  // Dit voorkomt race conditions tijdens redirect
  const authState = authClient.getAuthState();
  if (!authState || !authState.access_token) {
    console.warn('⚠️ [Account Beheren Schoonmaker] Geen authenticatie, stoppen met initialisatie');
    return; // Stop direct, laat dashboardAuth.js de redirect afhandelen
  }

  // Hide all success messages on page load (so they're visible in Webflow editor)
  hideAllSuccessMessages();

  // Load user data
  const userData = await loadUserData();
  if (!userData) {
    console.error('❌ [Account Beheren Schoonmaker] Kon user data niet laden');
    return;
  }

  // Initialize all 5 forms (each isolated via formHandler)
  initProfielForm(userData);
  initEmailForm(userData);
  initTelefoonForm(userData);
  initAdresForm(userData);
  initWachtwoordForm();

  // Initialize Stripe Connect button
  initStripeConnectButton();

  console.log('✅ [Account Beheren Schoonmaker] Alle formulieren geïnitialiseerd');
}
