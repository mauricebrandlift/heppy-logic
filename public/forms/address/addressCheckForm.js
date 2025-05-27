// public/forms/address/addressCheckForm.js

import { formHandler } from '../logic/formHandler.js';
import { getFormSchema } from '../schemas/formSchemas.js';

const FORM_NAME = 'postcode-form';

/**
 * Initialiseert het postcode-check formulier via de generieke formHandler.
 */
export function initAddressCheckForm() {
  console.log(`🚀 [addressCheckForm] Initializing form: ${FORM_NAME}`);

  const schema = getFormSchema(FORM_NAME);
  if (!schema) {
    console.error(`❌ [addressCheckForm] Schema '${FORM_NAME}' not found`);
    return;
  }

  // Start de generieke handler met het opgehaalde schema
  formHandler.init(schema);
}