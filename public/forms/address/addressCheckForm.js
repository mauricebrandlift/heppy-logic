// public/forms/address/addressCheckForm.js
import { formHandler } from '../logic/formHandler.js';
import { getFormSchema } from '../schemas/formSchemas.js';

export function initializeAddressCheckForm() {
  if (!formHandler || typeof formHandler.init !== 'function') {
    console.error('formHandler or formHandler.init is not available. Ensure formHandler.js is loaded and correct.');
    return;
  }

  const addressSchema = getFormSchema('postcode-form'); // Get the specific schema

  if (!addressSchema) { // New check for the retrieved schema
    console.error("Schema for 'postcode-form' not found in formSchemas.js. Ensure it's defined correctly.");
    return;
  }

  // Pass the specific schema for the address check form to the generic handler
  formHandler.init(addressSchema); // Use the retrieved schema
  console.log('addressCheckForm.js: Initialization requested for postcode-form.');
}
