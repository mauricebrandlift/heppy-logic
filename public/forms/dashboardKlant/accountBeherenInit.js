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

/**
 * Prefill form fields with user data
 */
function prefillForm(formName, userData) {
  const fieldMap = {
    'account-profiel-form': ['voornaam', 'achternaam'],
    'account-email-form': ['email'],
    'account-telefoon-form': ['telefoon'],
    'account-adres-form': ['postcode', 'huisnummer', 'toevoeging']
  };

  const fields = fieldMap[formName];
  if (!fields) return;

  fields.forEach(fieldName => {
    const field = document.querySelector(`[data-field-name="${fieldName}"]`);
    if (field && userData[fieldName]) {
      field.value = userData[fieldName];
    }
  });
}

// ============================================================================
// 1. PROFIEL FORM
// ============================================================================

function initProfielForm(userData) {
  const schema = getFormSchema('account-profiel-form');
  if (!schema) return;

  // Prefill
  prefillForm('account-profiel-form', userData);

  // Custom submit action
  schema.submit = {
    action: async (formData) => {
      const authState = authClient.getAuthState();
      const response = await apiClient('/routes/dashboard/klant/update-profiel', {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${authState.access_token}` },
        body: formData
      });

      // Return success message
      let message = 'Naam succesvol bijgewerkt';
      if (response.schoonmakerGenotificeerd) {
        message += ' • Je schoonmaker is op de hoogte gebracht';
      }
      return { message };
    }
  };

  formHandler.init(schema);
}

// ============================================================================
// 2. EMAIL FORM
// ============================================================================

function initEmailForm(userData) {
  const schema = getFormSchema('account-email-form');
  if (!schema) return;

  prefillForm('account-email-form', userData);

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
    }
  };

  formHandler.init(schema);
}

// ============================================================================
// 3. TELEFOON FORM
// ============================================================================

function initTelefoonForm(userData) {
  const schema = getFormSchema('account-telefoon-form');
  if (!schema) return;

  prefillForm('account-telefoon-form', userData);

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
    }
  };

  formHandler.init(schema);
}

// ============================================================================
// 4. ADRES FORM
// ============================================================================

function initAdresForm(userData) {
  const schema = getFormSchema('account-adres-form');
  if (!schema) return;

  prefillForm('account-adres-form', userData);

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

      let message = 'Adres succesvol bijgewerkt';
      if (response.schoonmakerGenotificeerd) {
        message += ' • Je schoonmaker is op de hoogte gebracht';
      }
      return { message };
    }
  };

  formHandler.init(schema);
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
        message: 'Wachtwoord succesvol gewijzigd • Andere sessies zijn uitgelogd'
      };
    }
  };

  formHandler.init(schema);
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

  // Initialize all 5 forms (each isolated via formHandler)
  initProfielForm(userData);
  initEmailForm(userData);
  initTelefoonForm(userData);
  initAdresForm(userData);
  initWachtwoordForm();

  console.log('✅ [Account Beheren] Alle formulieren geïnitialiseerd');
}
