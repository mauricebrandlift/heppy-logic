import { loadFormData, saveFieldData } from './formStorage.js';
import { sanitize, collect } from './formInputSanitizer.js';
import * as formValidator from '../validators/formValidator.js';
import {
  prefillFields,
  clearErrors,
  clearFieldError,
  showFieldError,
  showErrors,
  showGlobalError,
  toggleButton,
  toggleFields,
  showLoader,
  hideLoader
} from '../ui/formUi.js';

const formHandler = {
  currentSchema: null,
  currentFormElement: null,
  currentFormData: {},
  currentFormState: {},
  initialFormData: {},

  init: function(schema) {
    console.log('🚀 [FormHandler] Initializing form:', schema.formName);
    this.currentSchema = schema;
    this.currentFormElement = document.querySelector(`[data-form-name="${schema.formName}"]`);

    if (!this.currentFormElement) {
      console.error('❌ [FormHandler] Form element not found for:', schema.formName);
      return;
    }

    // Load stored data
    const allLoadedData = loadFormData(this.currentSchema.formName, this.currentSchema.fields);
    this.currentFormData = {};
    this.initialFormData = {};

    Object.keys(this.currentSchema.fields).forEach(fieldName => {
      const fieldConfig = this.currentSchema.fields[fieldName];
      const stored = allLoadedData[fieldName];
      const value = stored !== undefined ? stored : (fieldConfig.defaultValue || '');
      this.currentFormData[fieldName] = value;
      this.initialFormData[fieldName] = value;
      this.currentFormState[fieldName] = { isTouched: false, isDirty: false };
    });

    console.log('📋 [FormHandler] Initial FormData:', this.currentFormData);
    console.log('📊 [FormHandler] Initial FormState:', this.currentFormState);

    // Prefill UI
    prefillFields(this.currentFormElement, this.currentFormData);
    console.log('⚙️ [FormHandler] Prefilled fields with saved data');
    this.setupEventListeners();
    this._updateFormValidityAndButtonState();
  },

  _updateFormValidityAndButtonState: function() {
    if (!this.currentSchema || !this.currentFormElement) return;
    const isValid = formValidator.validateForm(
      this.currentSchema.fields,
      this.currentFormElement
    );
    console.log(isValid ? '✅ [FormHandler] Form valid: true' : '❌ [FormHandler] Form valid: false');
    const submitButton = this.currentFormElement.querySelector(
      `[data-form-button="${this.currentSchema.formName}"]`
    );
    if (submitButton) {
      toggleButton(submitButton, isValid);
    } else {
      console.warn('⚠️ [FormHandler] Submit button not found');
    }
  },

  handleInput: function(event) {
    const fieldName = event.target.dataset.fieldName;
    const rawValue = event.target.value;
    console.log(`📝 [FormHandler] Input on '${fieldName}':`, rawValue);

    this.currentFormState[fieldName].isTouched = true;
    const clean = sanitize(rawValue);
    console.log(`🔄 [FormHandler] Sanitized '${fieldName}':`, clean);
    this.currentFormData[fieldName] = clean;
    this.currentFormState[fieldName].isDirty = clean !== this.initialFormData[fieldName];

    // Field-level validation
    const fieldErrors = formValidator.validateField(
      this.currentSchema.fields,
      fieldName,
      clean
    );
    if (fieldErrors.length) {
      console.log(`❌ [FormHandler] Field '${fieldName}' valid: false`, fieldErrors);
      showFieldError(this.currentFormElement, fieldName, fieldErrors[0].message);
    } else {
      console.log(`✅ [FormHandler] Field '${fieldName}' valid: true`);
      clearFieldError(this.currentFormElement, fieldName);
    }

    // Save prefill
    const fieldSchema = this.currentSchema.fields[fieldName];
    saveFieldData(this.currentSchema.formName, fieldSchema, clean);
    console.log(`💾 [FormHandler] Saved prefill for '${fieldName}':`, clean);

    this._updateFormValidityAndButtonState();
  },

  setupEventListeners: function() {
    Object.keys(this.currentSchema.fields).forEach(fieldName => {
      const selector = `[data-field-name="${fieldName}"]`;
      const inputEl = this.currentFormElement.querySelector(selector);
      if (inputEl) {
        inputEl.addEventListener('input', event => this.handleInput(event));
      } else {
        console.warn(`⚠️ [FormHandler] Input not found for: ${fieldName}`);
      }
    });
    this.currentFormElement.addEventListener('submit', event => this.handleSubmit(event));
    console.log('🔗 [FormHandler] Event listeners attached');
  },

  async handleSubmit(event) {
    event.preventDefault();
    console.log('📤 [FormHandler] Submission triggered');
    showLoader(event.submitter);
    toggleFields(this.currentFormElement, false);

    const data = collect(this.currentFormElement);
    console.log('📋 [FormHandler] Collected data:', data);

    console.log('🔍 [FormHandler] Running full validation...');
    const errors = await formValidator.validateFull(
      this.currentSchema.fields,
      data,
      { fetchAddressValidation: null }
    );
    if (errors.length) {
      console.log('❌ [FormHandler] Full validation errors:', errors);
      showErrors(this.currentFormElement, errors);
      hideLoader(event.submitter);
      toggleFields(this.currentFormElement, true);
      return;
    }
    console.log('✅ [FormHandler] Full validation passed');

    console.log('💾 [FormHandler] Final form data saved:', data);

    showGlobalError(this.currentFormElement, 'Form submitted successfully.');
    console.log('🎉 [FormHandler] Submission complete');
  }
};

export { formHandler };
