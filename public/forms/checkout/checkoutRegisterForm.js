// public/forms/checkout/checkoutRegisterForm.js
/**
 * Checkout registratie formulier handler
 * Voor registratie binnen checkout modal met adres
 */
import { formHandler } from '../logic/formHandler.js';
import { getFormSchema } from '../schemas/formSchemas.js';
import { authClient } from '../../utils/auth/authClient.js';
import { apiClient } from '../../utils/api/client.js';
import { initAddressLookupTrigger } from '../logic/formTriggers.js';

/**
 * Initialiseert het checkout registratie formulier
 */
export function initCheckoutRegisterForm() {
  console.log('🚀 [CheckoutRegisterForm] Initialiseren...');

  // Haal formulier schema op
  const schema = getFormSchema('checkout-register-form');
  
  if (!schema) {
    console.error('❌ [CheckoutRegisterForm] Geen schema gevonden');
    return;
  }

  // Voeg submit handler toe
  schema.submit = {
    action: async (formData) => {
      try {
        // Registreer gebruiker
        const response = await apiClient('/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            voornaam: formData['register-voornaam'],
            achternaam: formData['register-achternaam'],
            email: formData['register-email'],
            password: formData['register-password'],
            adres: {
              postcode: formData['register-postcode'],
              huisnummer: formData['register-huisnummer'],
              toevoeging: formData['register-toevoeging'] || null,
              straatnaam: formData['register-straatnaam'],
              plaats: formData['register-plaats']
            }
          })
        });
        
        console.log('✅ [CheckoutRegisterForm] Registratie succesvol');
        
        // Auto-login na registratie
        await authClient.login(formData['register-email'], formData['register-password']);
        
        return { success: true };
        
      } catch (error) {
        console.error('❌ [CheckoutRegisterForm] Registratie fout:', error);
        
        // Bepaal error code
        let errorCode = 'REGISTRATION_ERROR';
        if (error.message?.includes('already exists')) {
          errorCode = 'EMAIL_EXISTS';
        }
        
        throw { 
          code: errorCode, 
          message: error.message 
        };
      }
    },
    onSuccess: () => {
      console.log('✅ [CheckoutRegisterForm] Registratie succesvol, dispatch event');
      
      // Dispatch auth success event voor checkoutPage
      document.dispatchEvent(new Event('auth:success'));
    },
    onError: (error) => {
      console.error('❌ [CheckoutRegisterForm] Submit error:', error);
    }
  };

  // Initialiseer form handler
  const handler = formHandler.init(schema);

  // Voeg address lookup trigger toe
  if (handler) {
    initAddressLookupTrigger(handler, {
      postcodeField: 'register-postcode',
      huisnummerField: 'register-huisnummer',
      straatField: 'register-straatnaam',
      plaatsField: 'register-plaats'
    });
  }

  console.log('✅ [CheckoutRegisterForm] Initialisatie voltooid');
}
