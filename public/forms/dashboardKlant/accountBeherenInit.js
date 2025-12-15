// public/forms/dashboardKlant/accountBeherenInit.js
/**
 * Account beheren initialisatie voor klanten
 * Bevat 5 aparte formulieren: profiel, email, telefoon, adres, wachtwoord
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
    console.error('❌ [Account Beheren] Geen access token');
    return null;
  }

  try {
    const profileData = await apiClient('/routes/dashboard/klant/profile', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${authState.access_token}` }
    });

    console.log('🔍 [Account Beheren] Profile API response:', profileData);

    // All data from API (including email from database)
    const userData = {
      id: authState.user?.id,
      role: authState.user?.role,
      ...profileData // email comes from API (user_profiles table)
    };

    console.log('🔍 [Account Beheren] Combined userData:', userData);
    return userData;
  } catch (error) {
    console.error('❌ [Account Beheren] Error loading user data:', error);
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
      const response = await apiClient('/routes/dashboard/klant/update-profiel', {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${authState.access_token}` },
        body: formData
      });

      // Build success message
      let message = 'Naam succesvol bijgewerkt';
      if (response.schoonmakerGenotificeerd) {
        message += ' • Je schoonmaker is op de hoogte gebracht';
      }
      return { message };
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
        console.log(`[Account Beheren] Auto-hiding success for ${formName}`);
        const successEl = document.querySelector(`[data-success-message="${formName}"]`);
        if (successEl) {
          successEl.style.display = 'none';
          console.log(`[Account Beheren] Success message hidden for ${formName}`);
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
      await apiClient('/routes/dashboard/klant/request-email-change', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authState.access_token}` },
        body: { nieuwEmail: formData.email }
      });

      return { 
        message: 'Verificatie-email verzonden naar je nieuwe e-mailadres • Klik op de link in de email om te bevestigen'
      };
    },
    onSuccess: () => {
      const formName = 'account-email-form';
      // Show inline success message
      formHandler.showSuccessState(formName, {
        messageAttribute: formName,
        hideForm: false,
        scrollIntoView: false
      });
      
      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        console.log(`[Account Beheren] Auto-hiding success for ${formName}`);
        const successEl = document.querySelector(`[data-success-message="${formName}"]`);
        if (successEl) {
          successEl.style.display = 'none';
          console.log(`[Account Beheren] Success message hidden for ${formName}`);
        }
      }, 5000);
    }
  };

  // Pass userData as initialData to formHandler
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
      const response = await apiClient('/routes/dashboard/klant/update-telefoon', {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${authState.access_token}` },
        body: formData
      });

      let message = 'Telefoonnummer succesvol bijgewerkt';
      if (response.schoonmakerGenotificeerd) {
        message += ' • Je schoonmaker is op de hoogte gebracht';
      }
      return { message };
    },
    onSuccess: () => {
      const formName = 'account-telefoon-form';
      // Show inline success message
      formHandler.showSuccessState(formName, {
        messageAttribute: formName,
        hideForm: false,
        scrollIntoView: false
      });
      
      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        console.log(`[Account Beheren] Auto-hiding success for ${formName}`);
        const successEl = document.querySelector(`[data-success-message="${formName}"]`);
        if (successEl) {
          successEl.style.display = 'none';
          console.log(`[Account Beheren] Success message hidden for ${formName}`);
        }
      }, 5000);
    }
  };

  // Pass userData as initialData to formHandler
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
      // Address verification
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
      const response = await apiClient('/routes/dashboard/klant/update-adres', {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${authState.access_token}` },
        body: {
          ...formData,
          straat: addressDetails.straat,
          plaats: addressDetails.plaats
        }
      });

      // Debug: log response flags
      console.log('[accountBeheren] Adres response:', {
        buitenDekking: response.buitenDekking,
        heeftActiefAbonnement: response.heeftActiefAbonnement,
        schoonmakerGenotificeerd: response.schoonmakerGenotificeerd
      });

      // Build success message
      let message = 'Adres succesvol bijgewerkt';
      if (response.schoonmakerGenotificeerd) {
        message += ' • Je schoonmaker is op de hoogte gebracht';
      }
      
      // Store response flags for onSuccess handler
      return { 
        message,
        customData: {
          buitenDekking: response.buitenDekking,
          heeftActiefAbonnement: response.heeftActiefAbonnement
        }
      };
    },
    onSuccess: (result) => {
      // Check if we need to show a modal instead of success message
      if (result?.customData?.buitenDekking) {
        showModal('adres-buiten-dekking');
      } else if (result?.customData?.heeftActiefAbonnement) {
        showModal('adres-schoonmaker-notify');
      } else {
        const formName = 'account-adres-form';
        // Show inline success message for non-subscription users
        formHandler.showSuccessState(formName, {
          messageAttribute: formName,
          hideForm: false,
          scrollIntoView: false
        });
        
        // Auto-hide success message after 5 seconds
        setTimeout(() => {
          console.log(`[Account Beheren] Auto-hiding success for ${formName}`);
          const successEl = document.querySelector(`[data-success-message="${formName}"]`);
          if (successEl) {
            successEl.style.display = 'none';
            console.log(`[Account Beheren] Success message hidden for ${formName}`);
          }
        }, 5000);
      }
    }
  };

  // Pass userData as initialData to formHandler (includes straat/plaats from DB)
  formHandler.init(schema, userData);

  // Initialize address lookup trigger (automatic lookup on postcode/huisnummer change)
  initAddressLookupTrigger(formHandler, {
    postcodeField: 'postcode',
    huisnummerField: 'huisnummer',
    straatField: 'straatnaam',
    plaatsField: 'plaats'
  });
}

/**
 * Show modal helper
 */
function showModal(modalName) {
  console.log('[accountBeheren] showModal called with:', modalName);
  const modalWrapper = document.querySelector(`[data-modal-wrapper="${modalName}"]`);
  console.log('[accountBeheren] Modal element found:', !!modalWrapper);
  
  if (modalWrapper) {
    modalWrapper.style.display = 'flex';
    console.log('[accountBeheren] Modal display set to flex');
    
    // Setup close handlers
    const closeTriggers = modalWrapper.querySelectorAll('[data-modal-close]');
    closeTriggers.forEach(trigger => {
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        modalWrapper.style.display = 'none';
      });
    });
  } else {
    console.warn(`[accountBeheren] Modal not found: [data-modal-wrapper="${modalName}"]`);
  }
}

// ============================================================================
// 5. WACHTWOORD FORM
// ============================================================================

function initWachtwoordForm() {
  const schema = getFormSchema('account-wachtwoord-form');
  if (!schema) return;

  // No prefill for password fields

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
      await apiClient('/routes/dashboard/klant/update-wachtwoord', {
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

      return { 
        message: 'Wachtwoord succesvol gewijzigd • Je wordt uitgelogd...'
      };
    },
    onSuccess: () => {
      const formName = 'account-wachtwoord-form';
      // Show inline success message
      formHandler.showSuccessState(formName, {
        messageAttribute: formName,
        hideForm: false,
        scrollIntoView: false
      });
      
      // Logout and redirect after 3 seconds
      setTimeout(() => {
        console.log('[Account Beheren] Uitloggen na wachtwoord wijziging...');
        authClient.logout();
        window.location.href = '/inloggen?message=Wachtwoord gewijzigd. Log opnieuw in met je nieuwe wachtwoord.';
      }, 3000);
    }
  };

  formHandler.init(schema);
}

// ============================================================================
// MAIN INIT
// ============================================================================

export async function initAccountBeheren() {
  console.log('⚙️ [Account Beheren] Initialiseren...');

  // Hide all success messages on page load (so they're visible in Webflow editor)
  hideAllSuccessMessages();

  // Load user data
  const userData = await loadUserData();
  if (!userData) {
    console.error('❌ [Account Beheren] Kon user data niet laden');
    return;
  }

  // Initialize all 5 forms (each isolated via formHandler)
  initProfielForm(userData);
  initEmailForm(userData);
  initTelefoonForm(userData);
  initAdresForm(userData);
  initWachtwoordForm();

  console.log('✅ [Account Beheren] Alle formulieren geïnitialiseerd');
}
