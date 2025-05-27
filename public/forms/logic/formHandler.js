// public/forms/logic/formHandler.js

import { sanitizeField } from './formInputSanitizer.js';
import { validateForm, validateField } from '../validators/formValidator.js';
import { showFieldErrors, showGlobalError, clearGlobalError, clearErrors, toggleButton, toggleFields, showLoader, hideLoader } from '../ui/formUi.js';
import { saveFormData, loadFormData } from './formStorage.js';

/**
 * 🚀 Centrale handler voor elk formulier.
 *
 * Verantwoordelijkheden:
 *  - Input sanitizing: alle invoer opschonen volgens schema-regels
 *  - Validatie: veld- en formulier-validatie met veld- en globale fouten
 *  - Opslag: persisteren en herladen van formulierdata in localStorage
 *  - UI-updates: tonen van loaders, uitschakelen van velden en tonen van fouten
 *  - Submit flow: optionele custom action en success-/error-afhandeling
 */
export const formHandler = {
  schema: null,       // Formulier schema met velden, validatie en submit-configuratie
  formElement: null,  // DOM-element van het formulier
  formData: {},       // Huidige waarden van alle velden
  formState: {},      // State per veld (bijv. isTouched)

  /**
   * 🛠️ Initialiseer de form handler met het gegeven schema.
   */
  init(schema) {
    console.log(`🚀 [FormHandler] Init formulier: ${schema.name}`);
    this.schema = schema;
    this.formElement = document.querySelector(schema.selector);
    if (!this.formElement) {
      console.error(`❌ [FormHandler] Form element ${schema.selector} niet gevonden`);
      return;
    }

    // Laad en toon prefill-data
    this.formData = loadFormData(schema.name) || {};
    this.formState = {};
    clearErrors(this.formElement);
    clearGlobalError(this.formElement);

    // Validatie na prefill
    const { isFormValid, fieldErrors } = validateForm(this.formData, this.schema, this.formState);
    Object.entries(fieldErrors).forEach(([f, msg]) =>
      console.log(`🔍 [FormHandler] Na prefill - veld '${f}': ${msg}`)
    );
    console.log(`🔍 [FormHandler] Na prefill - formulier valid: ${isFormValid}`);

    // Bind veld-events
    Object.keys(schema.fields).forEach((fieldName) => {
      const fieldEl = this.formElement.querySelector(`[name="${fieldName}"]`);
      if (!fieldEl) {
        console.warn(`⚠️ [FormHandler] Veld '${fieldName}' niet gevonden`);
        return;
      }
      // init value
      if (this.formData[fieldName] != null) fieldEl.value = this.formData[fieldName];
      this.formState[fieldName] = { isTouched: false };
      fieldEl.addEventListener('input', (e) => this.handleInput(fieldName, e));
      fieldEl.addEventListener('blur', (e) => this.handleBlur(fieldName, e));
    });

    // Bind submit-knop click
    const submitBtn = this.formElement.querySelector('[data-form-button]');
    if (!submitBtn) {
      console.error(`❌ [FormHandler] Submit button [data-form-button] niet gevonden`);
    } else {
      submitBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const { isFormValid, fieldErrors } = validateForm(this.formData, this.schema, this.formState);
        if (!isFormValid) {
          const hasEmptyRequired = Object.entries(this.schema.fields).some(([f, cfg]) =>
            cfg.validators.includes('required') && (!this.formData[f] || String(this.formData[f]).trim() === '')
          );
          const message = hasEmptyRequired
            ? 'Niet alle verplichte velden ingevuld.'
            : 'Niet alle velden correct ingevuld.';
          clearGlobalError(this.formElement);
          showGlobalError(this.formElement, message);
          return;
        }
        this.handleSubmit(e);
      });
    }

    console.log(`✅ [FormHandler] Init compleet`);
    this.updateSubmitState();
  },

  /**
   * 🛑 Valideer veld na blur
   */
  handleBlur(fieldName) {
    const value = String(this.formData[fieldName] || '');
    const error = validateField(fieldName, value, this.schema.fields[fieldName]);
    clearErrors(this.formElement, fieldName);
    if (error) {
      showFieldErrors(this.formElement, fieldName, error);
      console.warn(`🛑 [FormHandler] Fout na blur '${fieldName}': ${error}`);
    }
  },

  /**
   * ✏️ Valideer en log bij input
   */
  handleInput(fieldName, event) {
    const raw = event.target.value;
    const clean = sanitizeField(raw, this.schema.fields[fieldName], fieldName);
    event.target.value = clean;
    console.log(`✏️ [FormHandler] '${fieldName}': '${raw}'→'${clean}'`);

    this.formData[fieldName] = clean;
    this.formState[fieldName].isTouched = true;
    saveFormData(this.schema.name, this.formData);

    // full validation log
    const { isFormValid, fieldErrors } = validateForm(this.formData, this.schema, this.formState);
    Object.entries(fieldErrors).forEach(([f, msg]) =>
      console.log(`🔄 [FormHandler] After input - '${f}': ${msg}`)
    );
    console.log(`🔄 [FormHandler] After input - form valid: ${isFormValid}`);

    this.updateSubmitState();
  },

  /**
   * 🔄 Update submit-knop state
   */
  updateSubmitState() {
    const { isFormValid } = validateForm(this.formData, this.schema, this.formState);
    const btn = this.formElement.querySelector('[data-form-button]');
    toggleButton(btn, isFormValid);
  },

  /**
   * 🚨 Submit flow
   */
  async handleSubmit(event) {
    event.preventDefault();
    clearErrors(this.formElement);
    clearGlobalError(this.formElement);
    showLoader(event.target);
    toggleFields(this.formElement, false);

    try {
      if (this.schema.submit?.action) await this.schema.submit.action(this.formData);
      hideLoader(event.target);
      toggleFields(this.formElement, true);
      this.schema.submit?.onSuccess?.();
    } catch (err) {
      console.error(`❌ [FormHandler] Submit error:`, err);
      hideLoader(event.target);
      toggleFields(this.formElement, true);
      const gm = this.schema.globalMessages || {};
      const code = err.code || (err.name === 'TypeError' ? 'NETWORK_ERROR' : 'DEFAULT');
      const message = gm[code] || gm.DEFAULT || err.message || 'Er is iets misgegaan.';
      showGlobalError(this.formElement, message);
    }
  },
};