// public/forms/logic/formHandler.js
import { loadFormData, saveFieldData } from './formStorage.js';

const formHandler = {
  init: function(schema) {
    console.log('Form handler init called for form:', schema.formName);

    const formElement = document.querySelector(`[data-form-name="${schema.formName}"]`);
    if (!formElement) {
      console.error(`Form element not found for form: ${schema.formName}`);
      return;
    }

    // Load existing data from localStorage
    const loadedData = loadFormData(schema.fields);
    console.log('Loaded data from localStorage:', loadedData);

    // TODO (next step): Populate form fields with loadedData using formUi.js
    // Example: populateFields(formElement, schema.fields, loadedData);

    // TODO (later step): Set up event listeners for input fields
    // this.setupEventListeners(formElement, schema);

    // TODO (later step): Initial validation and button state update
    // this.validateForm(formElement, schema, loadedData);
  },

  // Placeholder for handling input changes
  handleInput: function(event, formElement, schema) {
    const fieldName = event.target.dataset.fieldName;
    const value = event.target.value; // Basic value, sanitization will be added
    const fieldSchema = schema.fields[fieldName];

    if (!fieldSchema) {
      console.warn(`No schema found for field: ${fieldName}`);
      return;
    }

    console.log(`Input changed for field: ${fieldName}, Value: ${value}`);

    // TODO: Sanitize input using formInputSanitizer.js

    // Save to localStorage
    if (fieldSchema.localStorageKey) {
      saveFieldData(fieldSchema.localStorageKey, value);
      console.log(`Saved ${fieldName} to localStorage key: ${fieldSchema.localStorageKey}`);
    }

    // TODO: Validate field using formValidator.js
    // TODO: Update error messages using formUi.js
    // TODO: Re-validate entire form and update button state
  },

  // Placeholder for setting up event listeners
  setupEventListeners: function(formElement, schema) {
    Object.keys(schema.fields).forEach(fieldName => {
      const fieldConfig = schema.fields[fieldName];
      const inputElement = formElement.querySelector(`[data-field-name="${fieldConfig.dataFieldName}"]`);
      if (inputElement) {
        inputElement.addEventListener('input', (event) => this.handleInput(event, formElement, schema));
      }
    });

    // TODO: Add submit listener
  }
  // We will add more methods here: e.g., handleSubmit, validateField, validateForm, updateButtonState etc.
};

export { formHandler };
