// public/forms/schemas/addressCheckFormSchema.js

/**
 * Schema for the Address Check Form (postcode-form).
 * Defines the structure, validation rules, and other configurations for the form.
 */
export const addressCheckFormSchema = {
  formName: 'postcode-form', // Corresponds to data-form-name attribute in HTML
  fields: {
    postcode: {
      dataFieldName: 'postcode', // Corresponds to data-field-name attribute
      localStorageKey: 'shared.postcode', // Using 'shared' prefix for potentially reusable fields
      required: true
    },
    huisnummer: {
      dataFieldName: 'huisnummer', // Corresponds to data-field-name attribute
      localStorageKey: 'shared.huisnummer',
      required: true
    },
    toevoeging: {
      dataFieldName: 'toevoeging', // Corresponds to data-field-name attribute
      localStorageKey: 'shared.toevoeging',
      required: false
    }
  },
  submitButtonSelector: '[data-form-button="postcode-form"]'
  // We can add API endpoint details here later for external validation
};
