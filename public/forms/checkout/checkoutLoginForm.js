// public/forms/checkout/checkoutLoginForm.js
/**
 * Checkout login formulier handler
 * Voor login binnen checkout modal
 */
import { formHandler } from '../logic/formHandler.js';
import { getFormSchema } from '../schemas/formSchemas.js';
import { authClient } from '../../utils/auth/authClient.js';

/**
 * Initialiseert het checkout login formulier
 */
export function initCheckoutLoginForm() {
  console.log('🚀 [CheckoutLoginForm] Initialiseren...');

  // Haal formulier schema op
  const schema = getFormSchema('checkout-login-form');
  
  if (!schema) {
    console.error('❌ [CheckoutLoginForm] Geen schema gevonden');
    return;
  }

  // Voeg submit handler toe
  schema.submit = {
    action: async (formData) => {
      try {
        // Log gebruiker in
        const result = await authClient.login(formData['login-email'], formData['login-password']);
        
        console.log('✅ [CheckoutLoginForm] Login succesvol');
        return { success: true, data: result.user };
        
      } catch (error) {
        console.error('❌ [CheckoutLoginForm] Login fout:', error);
        
        // Bepaal error code
        let errorCode = 'AUTH_ERROR';
        if (error.statusCode === 401) {
          errorCode = 'AUTH_FAILED';
        }
        
        throw { 
          code: errorCode, 
          message: error.message 
        };
      }
    },
    onSuccess: (result) => {
      console.log('✅ [CheckoutLoginForm] Login succesvol, dispatch event');
      
      // Dispatch auth success event voor checkoutPage
      document.dispatchEvent(new Event('auth:success'));
    },
    onError: (error) => {
      console.error('❌ [CheckoutLoginForm] Submit error:', error);
    }
  };

  // Initialiseer form handler
  formHandler.init(schema);

  console.log('✅ [CheckoutLoginForm] Initialisatie voltooid');
}
