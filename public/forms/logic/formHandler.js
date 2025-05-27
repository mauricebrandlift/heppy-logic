// public/forms/logic/formHandler.js
import { loadFormData, saveFieldData } from './formStorage.js';
import { formInputSanitizer } from './formInputSanitizer.js';
import * as formValidator from '../validators/formValidator.js';
import {
  populateFields,
  setButtonState,
  showFieldError,
  clearFieldError,
  showGlobalError
} from '../ui/formUi.js';

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
    populateFields(this.currentFormElement, this.currentFormSchema.fields, this.currentFormData);
    this.setupEventListeners();
    this._updateFormValidityAndButtonState();
  },

  _updateFormValidityAndButtonState: function() {
    if (!this.currentSchema || !this.currentFormElement) return;

    const validationResult = formValidator.validateForm(
      this.currentFormData,
      this.currentSchema,
      this.currentFormState
    );
    const submitButton = this.currentFormElement.querySelector(
      this.currentSchema.submitButtonSelector
    );

    if (submitButton) {
      setButtonState(submitButton, validationResult.isFormValid);
    } else {
      console.warn(
        `Submit button not found with selector: ${this.currentSchema.submitButtonSelector}`
      );
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
    const sanitized = formInputSanitizer.sanitizeField(
      rawValue,
      this.currentSchema.fields[fieldName],
      fieldName
    );
    this.currentFormData[fieldName] = sanitized;
    this.currentFormState[fieldName].isDirty =
      sanitized !== this.initialFormData[fieldName];

    // Field-level validation
    const result = formValidator.validateField(
      sanitized,
      this.currentSchema.fields[fieldName],
      fieldName,
      this.currentFormState[fieldName]
    );

    if (!result.isValid) {
      showFieldError(
        this.currentFormElement,
        fieldName,
        result.errorMessages.join(' '),
        this.currentSchema.fields[fieldName]
      );
    } else {
      clearFieldError(
        this.currentFormElement,
        fieldName,
        this.currentSchema.fields[fieldName]
      );
    }

    saveFieldData(
      this.currentSchema.formName,
      this.currentSchema.fields[fieldName],
      sanitized
    );
    this._updateFormValidityAndButtonState();
  },

  setupEventListeners: function() {
    Object.keys(this.currentSchema.fields).forEach(fieldName => {
      const selector = `[data-field-name="${fieldName}"]`;
      const inputEl = this.currentFormElement.querySelector(selector);
      if (inputEl) {
        inputEl.addEventListener('input', event => this.handleInput(event));
        inputEl.addEventListener('blur', event => this.handleInput(event));
      } else {
        console.warn('Input not found for:', fieldName);
      }
    });

    this.currentFormElement.addEventListener(
      'submit',
      event => this.handleSubmit(event)
    );
  },

  handleSubmit: function(event) {
    event.preventDefault();
    console.log('Form submission initiated for:', this.currentSchema.formName);

    // Touch all fields
    Object.keys(this.currentFormState).forEach(fieldName => {
      this.currentFormState[fieldName].isTouched = true;
    });

    const validationResult = formValidator.validateForm(
      this.currentFormData,
      this.currentSchema,
      this.currentFormState
    );

    // Show per-field errors
    Object.keys(this.currentSchema.fields).forEach(fieldName => {
      const errors = validationResult.fieldErrors[fieldName] || [];
      if (errors.length) {
        showFieldError(
          this.currentFormElement,
          fieldName,
          errors.join(' '),
          this.currentSchema.fields[fieldName]
        );
      } else {
        clearFieldError(
          this.currentFormElement,
          fieldName,
          this.currentSchema.fields[fieldName]
        );
      }
    });

    this._updateFormValidityAndButtonState();

    if (validationResult.isFormValid) {
      console.log('Form valid, data:', this.currentFormData);
      showGlobalError(
        this.currentFormElement,
        'Form submitted successfully.'
      );
    } else {
      console.warn('Form invalid, please fix errors.');
      showGlobalError(
        this.currentFormElement,
        'Please correct the errors in the form.'
      );
    }
  }
};

export { formHandler };
