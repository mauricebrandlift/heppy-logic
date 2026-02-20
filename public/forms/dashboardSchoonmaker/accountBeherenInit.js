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

  // Setup postcode lookup trigger
  initAddressLookupTrigger('account-adres-form');

  schema.submit = {
    action: async (formData) => {
      const authState = authClient.getAuthState();
      await apiClient('/routes/dashboard/schoonmaker/update-adres', {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${authState.access_token}` },
        body: formData
      });
      return { message: 'Adres succesvol bijgewerkt' };
    },
    onSuccess: () => {
      const formName = 'account-adres-form';
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
// 5. WACHTWOORD FORM
// ============================================================================

function initWachtwoordForm() {
  const schema = getFormSchema('account-wachtwoord-form');
  if (!schema) return;

  schema.submit = {
    action: async (formData) => {
      const authState = authClient.getAuthState();
      await apiClient('/routes/dashboard/schoonmaker/update-wachtwoord', {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${authState.access_token}` },
        body: formData
      });
      return { message: 'Wachtwoord succesvol gewijzigd' };
    },
    onSuccess: () => {
      const formName = 'account-wachtwoord-form';
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

  // Check of we op account beheren pagina zijn
  const accountBeherenPage = document.querySelector('[data-dashboard-page="account-beheren"]');
  if (!accountBeherenPage) {
    console.log('[Account Beheren Schoonmaker] Niet op account beheren pagina, skip init');
    return;
  }

  // Check authenticatie
  const authState = authClient.getAuthState();
  if (!authState || !authState.access_token) {
    console.warn('⚠️ [Account Beheren Schoonmaker] Geen authenticatie');
    return;
  }

  const user = await authClient.getCurrentUser();
  if (!user || user.rol !== 'schoonmaker') {
    console.error('❌ [Account Beheren Schoonmaker] Geen toegang');
    return;
  }

  try {
    // Load user data
    const userData = await loadUserData();
    if (!userData) {
      console.error('❌ [Account Beheren Schoonmaker] Kon user data niet laden');
      return;
    }

    // Initialize all forms
    initProfielForm(userData);
    initEmailForm(userData);
    initTelefoonForm(userData);
    initAdresForm(userData);
    initWachtwoordForm();

    // Initialize Stripe Connect button
    initStripeConnectButton();

    console.log('✅ [Account Beheren Schoonmaker] Alle formulieren geïnitialiseerd');

  } catch (error) {
    console.error('❌ [Account Beheren Schoonmaker] Error:', error);
  }
}
