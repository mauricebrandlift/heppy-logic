// public/forms/address/addressCheckForm.js

import { formHandler } from '../logic/formHandler.js';
import { getFormSchema } from '../schemas/formSchemas.js';
import { showGlobalError } from '../ui/formUi.js';

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

  // Voeg per-form custom submit-logic toe: simuleer adres-validatie
  schema.submit = {
    /**
     * Callback bij succesvolle (simulatie) validatie
     */
    onSuccess: () => {
      console.log('✅ [addressCheckForm] Adres succesvol gevalideerd');
      // TODO: hier UX-feedback tonen, bv. toast of redirect
    }
  };

  // Start de generieke handler met het opgehaalde schema
  formHandler.init(schema);
}
