// public/forms/address/addressCheckForm.js
import { formHandler } from '../logic/formHandler.js';
import { addressCheckFormSchema } from '../schemas/addressCheckFormSchema.js';

/**
 * Initializes the address check form.
 * This function is called by the page-specific script (e.g., homePage.js)
 * when the address check form is present on the page.
 */
export function initializeAddressCheckForm() {
  if (!formHandler || typeof formHandler.init !== 'function') {
    console.error('formHandler or formHandler.init is not available. Ensure formHandler.js is loaded and correct.');
    return;
  }
  if (!addressCheckFormSchema) {
    console.error('addressCheckFormSchema is not available. Ensure addressCheckFormSchema.js is loaded and correct.');
    return;
  }

  // Pass the specific schema for the address check form to the generic handler
  formHandler.init(addressCheckFormSchema);
  console.log('addressCheckForm.js: Initialization requested for postcode-form.');
}
