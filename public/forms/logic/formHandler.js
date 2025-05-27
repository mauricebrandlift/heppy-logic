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
    console.log('Form handler init called for form:', schema.formName);
    this.currentSchema = schema;
    this.currentFormElement = document.querySelector(`[data-form-name="${schema.formName}"]`);

    if (!this.currentFormElement) {
      console.error(`Form element not found for form: ${schema.formName}`);
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

    console.log('Initial FormData:', this.currentFormData);
    console.log('Initial FormState:', this.currentFormState);

    // Prefill UI
    prefillFields(this.currentFormElement, this.currentFormData);
    this.setupEventListeners();
    this._updateFormValidityAndButtonState();
  },

  _updateFormValidityAndButtonState: function() {
    if (!this.currentSchema || !this.currentFormElement) return;

    const isValid = formValidator.validateForm(
      this.currentSchema.fields,
      this.currentFormElement
    );
    const submitButton = this.currentFormElement.querySelector(
      `[data-form-button="${this.currentSchema.formName}"]`
    );

    if (submitButton) {
      toggleButton(submitButton, isValid);
    } else {
      console.warn(`Submit button not found for form: ${this.currentSchema.formName}`);
    }
  },

  handleInput: function(event) {
    const fieldName = event.target.dataset.fieldName;
    if (!fieldName || !this.currentSchema.fields[fieldName]) {
      console.warn('No schema for field:', fieldName);
      return;
    }
    const rawValue = event.target.value;

    this.currentFormState[fieldName].isTouched = true;
    const clean = sanitize(rawValue);
    this.currentFormData[fieldName] = clean;
    this.currentFormState[fieldName].isDirty = clean !== this.initialFormData[fieldName];

    // Field-level validation
    const fieldErrors = formValidator.validateField(
      this.currentSchema.fields,
      fieldName,
      clean
    );

    if (fieldErrors.length) {
      showFieldError(this.currentFormElement, fieldName, fieldErrors[0].message);
    } else {
      clearFieldError(this.currentFormElement, fieldName);
    }

    // Save prefill
    saveFieldData(this.currentSchema.formName, { localStorageKey: fieldName }, clean);
    this._updateFormValidityAndButtonState();
  },

  setupEventListeners: function() {
    Object.keys(this.currentSchema.fields).forEach(fieldName => {
      const selector = `[data-field-name="${fieldName}"]`;
      const inputEl = this.currentFormElement.querySelector(selector);
      if (inputEl) {
        inputEl.addEventListener('input', event => this.handleInput(event));
      } else {
        console.warn('Input not found for:', fieldName);
      }
    });

    this.currentFormElement.addEventListener('submit', event => this.handleSubmit(event));
  },

  async handleSubmit(event) {
    event.preventDefault();
    console.log('Form submission initiated for:', this.currentSchema.formName);

    showLoader(event.submitter);
    toggleFields(this.currentFormElement, false);

    const data = collect(this.currentFormElement);
    const errors = await formValidator.validateFull(
      this.currentSchema.fields,
      data,
      { fetchAddressValidation: null }
    );

    if (errors.length) {
      showErrors(this.currentFormElement, errors);
      hideLoader(event.submitter);
      toggleFields(this.currentFormElement, true);
    } else {
      saveFieldData(this.currentSchema.formName, null, data);
      console.log('Form data saved:', data);
      showGlobalError(this.currentFormElement, 'Form submitted successfully.');
    }
  }
};

export { formHandler };
