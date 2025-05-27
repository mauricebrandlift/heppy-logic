export const allFormSchemas = {
  'postcode-form': { // This is the formName
    formName: 'postcode-form', // Repeating formName inside for consistency with how schema might be passed around
    fields: {
      postcode: {
        dataFieldName: 'postcode',
        localStorageKey: 'shared.postcode',
        required: true,
        validatorType: 'postcode', // Explicitly link to 'postcode' validator
        displayName: 'Postcode'    // Added for better error messages
      },
      huisnummer: {
        dataFieldName: 'huisnummer',
        localStorageKey: 'shared.huisnummer',
        required: true,
        validatorType: 'huisnummer', // Explicitly link to 'huisnummer' validator
        displayName: 'Huisnummer' // Added for better error messages
      },
      toevoeging: {
        dataFieldName: 'toevoeging',
        localStorageKey: 'shared.toevoeging',
        required: false,
        validatorType: 'genericText', // Use 'genericText' for optional simple text
        displayName: 'Toevoeging',  // Added for better error messages
        maxLength: 10             // Example: genericText can use this
      }
    },
    submitButtonSelector: '[data-form-button="postcode-form"]'
    // We can add API endpoint details here later for external validation
  }
  // Add other form schemas here, e.g.:
  // 'another-form': { ...schema for another-form... }
};

// Optional: Helper function to get a specific schema
export function getFormSchema(formName) {
  return allFormSchemas[formName] || null;
}
