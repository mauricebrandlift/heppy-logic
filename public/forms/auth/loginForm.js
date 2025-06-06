// public/forms/auth/loginForm.js
/**
 * Login formulier handler
 * Integreert met het formHandler systeem en de authClient
 */
import { formHandler } from '../logic/formHandler.js';
import { getFormSchema } from '../schemas/formSchemas.js';
import { authClient } from '../../utils/auth/authClient.js';

/**
 * Initialiseert het login formulier
 */
export function initLoginForm() {
  console.log('🚀 [LoginForm] Initialiseren...');

  // Haal formulier schema op
  const schema = getFormSchema('inloggen-form');
  
  if (!schema) {
    console.error('❌ [LoginForm] Geen schema gevonden voor login formulier');
    return;
  }
    // Voeg submit handler toe
  schema.submit = {
    action: async (formData) => {
      try {
        // Log gebruiker in
        const result = await authClient.login(formData.emailadres, formData.wachtwoord);
        
        console.log('✅ [LoginForm] Login succesvol, gebruikersrol:', result.user.role);
        return { success: true, data: result.user };
        
      } catch (error) {
        console.error('❌ [LoginForm] Login fout:', error);
        
        // Bepaal error type en bericht
        let errorCode = 'AUTH_ERROR';
        if (error.statusCode === 401) {
          errorCode = 'AUTH_FAILED';
        }
        
        // Gooi error voor formHandler
        throw { 
          code: errorCode, 
          message: error.message 
        };
      }
    },
    onSuccess: (result) => {
      console.log('✅ [LoginForm] Formulier succesvol verwerkt, doorverwijzen naar dashboard...');
      
      // Redirect naar juiste dashboard pagina op basis van rol
      window.location.href = authClient.getDashboardUrl();
    },
    onError: (error) => {
      console.error('❌ [LoginForm] Submit error:', error);
      // FormHandler toont automatisch de foutmelding op basis van globalMessages in het schema
    }
  };

  // Initialiseer form handler met schema
  formHandler.init(schema);

  console.log('✅ [LoginForm] Initialisatie voltooid');
}

// Initialiseer login form wanneer pagina geladen is
document.addEventListener('DOMContentLoaded', () => {
  // Check of we op de login pagina zijn (check aanwezigheid van login form element)
  const loginForm = document.querySelector('[data-form-name="inloggen-form"]');
  if (loginForm) {
    initLoginForm();
  }
  
  // Check of gebruiker al ingelogd is
  if (authClient.isAuthenticated()) {
    // Controleer of we niet al op dashboard zijn (voorkom loop)
    const currentPath = window.location.pathname;
    if (currentPath === '/inloggen') {
      // Redirect naar juiste dashboard
      window.location.href = authClient.getDashboardUrl();
    }
  }
});
