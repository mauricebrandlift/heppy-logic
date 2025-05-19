// public/forms/logic/formHandler.js
import { loadFormData, saveFieldData } from './formStorage.js'; 
import { formUi } from '../ui/formUi.js';
import { formInputSanitizer } from './formInputSanitizer.js';
import { formValidator } from '../validators/formValidator.js';

const formHandler = {
  currentSchema: null,
  currentFormElement: null,
  currentFormData: {},
  currentFormState: {}, // Stores { isTouched: boolean, isDirty: boolean } for each field
  initialFormData: {}, // To compare for isDirty state

  init: function(schema) {
    console.log('Form handler init called for form:', schema.formName);
    this.currentSchema = schema;
    this.currentFormElement = document.querySelector(`[data-form-name="${schema.formName}"]`);

    if (!this.currentFormElement) {
      console.error(`Form element not found for form: ${schema.formName}`);
      return;
    }

    // Correctly pass both formName and fields schema to loadFormData
    const allLoadedData = loadFormData(this.currentSchema.formName, this.currentSchema.fields);
    
    this.currentFormData = {};
    this.initialFormData = {};
    
    Object.keys(this.currentSchema.fields).forEach(fieldName => {
      const fieldConfig = this.currentSchema.fields[fieldName];
      this.currentFormData[fieldName] = allLoadedData[fieldName] !== undefined ? allLoadedData[fieldName] : (fieldConfig.defaultValue || '');
      this.initialFormData[fieldName] = allLoadedData[fieldName] !== undefined ? allLoadedData[fieldName] : (fieldConfig.defaultValue || '');
      this.currentFormState[fieldName] = { isTouched: false, isDirty: false };
    });

    console.log('Initial FormData based on schema and storage:', this.currentFormData);
    console.log('Initial FormState:', this.currentFormState);

    formUi.populateFields(this.currentFormElement, schema.fields, this.currentFormData);
    this.setupEventListeners();

    this._updateFormValidityAndButtonState();
  },

  _updateFormValidityAndButtonState: function() {
    if (!this.currentSchema || !this.currentFormElement) return;

    const validationResult = formValidator.validateForm(this.currentFormData, this.currentSchema, this.currentFormState);
    const submitButton = this.currentFormElement.querySelector(this.currentSchema.submitButtonSelector);
    
    if (submitButton) {
      formUi.setButtonState(submitButton, validationResult.isFormValid);
    } else {
      console.warn(`Submit button not found with selector: ${this.currentSchema.submitButtonSelector}`);
    }

    // Optionally, display global form errors if any (not directly from validateForm in current setup)
    // formUi.clearGlobalError(this.currentFormElement);
    // if (validationResult.globalErrors && validationResult.globalErrors.length > 0) {
    //   formUi.showGlobalError(this.currentFormElement, validationResult.globalErrors.join(' '));
    // }
  },

  handleInput: function(event) { 
    const fieldName = event.target.dataset.fieldName;
    const rawValue = event.target.value;
    
    if (!fieldName || !this.currentSchema.fields[fieldName]) {
      console.warn(`Field name attribute missing or no schema found for field:`, event.target);
      return;
    }
    const fieldSchema = this.currentSchema.fields[fieldName];

    this.currentFormState[fieldName].isTouched = true;

    const sanitizedValue = formInputSanitizer.sanitizeField(rawValue, fieldSchema, fieldName);
    // console.log(`Field: ${fieldName}, Raw: "${rawValue}", Sanitized: "${sanitizedValue}"`);

    this.currentFormData[fieldName] = sanitizedValue;
    this.currentFormState[fieldName].isDirty = (sanitizedValue !== (this.initialFormData[fieldName] === undefined ? '' : this.initialFormData[fieldName]));

    const validationResult = formValidator.validateField(sanitizedValue, fieldSchema, fieldName, this.currentFormState[fieldName]);

    if (!validationResult.isValid) {
      formUi.showFieldError(this.currentFormElement, fieldName, validationResult.errorMessages.join(' '), fieldSchema);
    } else {
      formUi.clearFieldError(this.currentFormElement, fieldName, fieldSchema);
    }

    // Save field data using the refactored formStorage.js `saveFieldData(fieldName, value, formId)`
    saveFieldData(fieldName, sanitizedValue, this.currentSchema.formName);
    // console.log(`Saved ${fieldName} (value: ${sanitizedValue}) to localStorage for form ${this.currentSchema.formName}`);

    this._updateFormValidityAndButtonState();
  },

  setupEventListeners: function() { 
    Object.keys(this.currentSchema.fields).forEach(fieldName => {
      const inputElement = this.currentFormElement.querySelector(`[data-field-name="${fieldName}"]`);
      
      if (inputElement) {
        inputElement.addEventListener('input', (event) => this.handleInput(event));
        inputElement.addEventListener('blur', (event) => {
            if (!this.currentFormState[fieldName].isTouched) {
                this.currentFormState[fieldName].isTouched = true;
            }
            // Re-run handleInput logic on blur to catch cases like tabbing away from an empty required field
            this.handleInput(event); 
        });
      } else {
        console.warn(`Input element not found for field: ${fieldName} with selector [data-field-name="${fieldName}"]`);
      }
    });

    // Submit listener
    if (this.currentFormElement) {
        this.currentFormElement.addEventListener('submit', (event) => this.handleSubmit(event));
    }
  },

  handleSubmit: function(event) {
    event.preventDefault(); // Prevent default form submission
    console.log('Form submission initiated for:', this.currentSchema.formName);

    // Mark all fields as touched to ensure all validations run (e.g., for required fields not yet interacted with)
    Object.keys(this.currentFormState).forEach(fieldName => {
        this.currentFormState[fieldName].isTouched = true;
    });

    // Re-validate the whole form
    const validationResult = formValidator.validateForm(this.currentFormData, this.currentSchema, this.currentFormState);
    
    // Update all field error UI based on full form validation
    Object.keys(this.currentSchema.fields).forEach(fieldName => {
        const fieldSch = this.currentSchema.fields[fieldName];
        const errors = validationResult.fieldErrors[fieldName];
        if (errors && errors.length > 0) {
            formUi.showFieldError(this.currentFormElement, fieldName, errors.join(' '), fieldSch);
        } else {
            formUi.clearFieldError(this.currentFormElement, fieldName, fieldSch);
        }
    });

    this._updateFormValidityAndButtonState(); // Update button based on final validation

    if (validationResult.isFormValid) {
      console.log('Form is valid. Sanitized Data:', this.currentFormData);
      // TODO: Implement actual submission logic (e.g., API call)
      // Access this.currentFormData for the data to submit.
      // Example: this.submitData(this.currentFormData);
      formUi.showGlobalError(this.currentFormElement, 'Form submitted successfully (simulation)!', 'success'); // Example success message
      
      // Optionally, clear prefill data after successful submission if desired
      // import { clearFormPrefillData } from './formStorage.js';
      // clearFormPrefillData(this.currentSchema.formName);
      // console.log(`Cleared prefill data for form: ${this.currentSchema.formName}`);
      
      // Optionally, reset the form to initial state or clear it
      // this.resetForm(); 
    } else {
      console.warn('Form is invalid. Please check errors.');
      formUi.showGlobalError(this.currentFormElement, 'Please correct the errors in the form.');
    }
  }
  // Placeholder for resetForm if needed
  // resetForm: function() { ... }
};

export { formHandler };
