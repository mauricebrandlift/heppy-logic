// public/forms/address/addressCheckForm.js

import { formHandler } from '../logic/formHandler.js';
import { getFormSchema } from '../schemas/formSchemas.js';

const FORM_NAME = 'postcode-form';

/**
 * Initialiseert het postcode-check formulier, inclusief custom submit-logic.
 */
export function initAddressCheckForm() {
  console.log(`🚀 [addressCheckForm] Initializing form: ${FORM_NAME}`);

  const schema = getFormSchema(FORM_NAME);
  if (!schema) {
    console.error(`❌ [addressCheckForm] Schema '${FORM_NAME}' not found`);
    return;
  }

  // Voeg per-form custom submit-logic toe
  schema.submit = {
    /**
     * Custom action die wordt uitgevoerd door formHandler.
     * De formHandler toont de loader VOOR deze actie en verbergt deze ERNA.
     */
    action: async (formData) => { // formData wordt meegegeven door formHandler
      console.log('✅ [addressCheckForm] Validatie succesvol, custom action gestart met formData:', formData);
      console.log('[addressCheckForm] Wachten voor 5 seconden...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      console.log('[addressCheckForm] 5 seconden voorbij, navigeren...');

      const nextPage = '/aanvragen/opties';
      window.location.href = nextPage;
    },
    /**
     * onSuccess wordt aangeroepen na een succesvolle action (indien action geen error throwt).
     * In dit geval, omdat action navigeert, zal onSuccess waarschijnlijk niet meer relevant zijn
     * op de client die de navigatie initieert.
     */
    onSuccess: () => {
      console.log('✅ [addressCheckForm] Actie succesvol afgerond (waarschijnlijk al genavigeerd).');
    }
  };

  // Start de generieke handler met het opgehaalde schema
  formHandler.init(schema);
}
