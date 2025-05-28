// public/forms/logic/formHandler.js

import { sanitizeField } from './formInputSanitizer.js';
import { validateForm } from '../validators/formValidator.js';
import {
  showFieldErrors,
  showGlobalError,
  clearGlobalError,
  clearErrors,
  toggleButton,
  toggleFields,
  showLoader,
  hideLoader,
} from '../ui/formUi.js';
import { saveFormData, loadFormData, saveGlobalFieldData, loadGlobalFieldData } from './formStorage.js';

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
  schema: null, // Formulier schema met velden, validatie en submit-configuratie
  formElement: null, // DOM-element van het formulier
  formData: {}, // Huidige waarden van alle velden
  formState: {}, // State per veld (bijv. isTouched)

  /**
   * 🛠️ Initialiseer de form handler met het gegeven schema.
   *
   * Stap 1: vind en bind het formulier in de DOM
   * Stap 2: laad eerder opgeslagen data en zet default values
   * Stap 3: bind events voor input en submit
   * Stap 4: reset foutmeldingen en zet submit-knop-status
   *
   * @param {object} schema - Definitie van velden, validatie en submit-config
   */
  init(schema) {
    console.log(`🚀 [FormHandler] Init formulier: ${schema.name} (selector: ${schema.selector})`);
    this.schema = schema;
    this.formElement = document.querySelector(schema.selector);
    if (!this.formElement) {
      console.error(`❌ [FormHandler] Form element ${schema.selector} niet gevonden`);
      return;
    }

    const formSpecificSavedData = loadFormData(schema.name) || {};
    this.formData = {}; // Reset formData
    this.formState = {};
    clearErrors(this.formElement);
    clearGlobalError(this.formElement);
    console.log(`🔄 [FormHandler] Initializing form data for ${schema.name}. Form-specific saved:`, formSpecificSavedData);

    Object.keys(schema.fields).forEach((fieldName) => {
      const fieldConfig = schema.fields[fieldName];
      const fieldEl = this.formElement.querySelector(`[data-field-name="${fieldName}"]`);
      if (!fieldEl) {
        console.warn(`⚠️ [FormHandler] Veld '${fieldName}' niet gevonden in DOM`);
        return;
      }

      let valueToLoad; // Gebruik undefined om te checken of er iets geladen is
      const persistType = fieldConfig.persist;

      if (persistType === 'global') {
        const globalValue = loadGlobalFieldData(fieldName);
        if (globalValue !== null) { // loadGlobalFieldData returns null if not found or undefined
          valueToLoad = globalValue;
          console.log(`🔄 [FormHandler] Veld '${fieldName}' (global): Geladen globale waarde: ${valueToLoad}`);
        }
      }

      // Form-specifieke data overschrijft eventuele globale waarde
      if (formSpecificSavedData[fieldName] !== undefined) {
        valueToLoad = formSpecificSavedData[fieldName];
        console.log(`🔄 [FormHandler] Veld '${fieldName}' (form-specific): Geladen formulierwaarde (overschrijft globaal indien aanwezig): ${valueToLoad}`);
      }
      
      if (valueToLoad !== undefined) {
        this.formData[fieldName] = valueToLoad;
        fieldEl.value = valueToLoad;
        console.log(
          `🔄 [FormHandler] Veld '${fieldName}' ingesteld op geladen waarde: ${valueToLoad}`
        );
      } else {
        // Als er geen waarde is geladen, gebruik de huidige waarde van het DOM-element (kan leeg zijn)
        this.formData[fieldName] = fieldEl.value || '';
         console.log(`🔄 [FormHandler] Veld '${fieldName}' niet in storage, gebruikt DOM waarde of leeg: '${this.formData[fieldName]}'`);
      }

      this.formState[fieldName] = { isTouched: false };
      fieldEl.addEventListener('change', (e) => this.handleInput(fieldName, e));
    });
    
    console.log(`🔄 [FormHandler] Initial formData state na laden:`, this.formData);

    // **Log validatie na prefill**
    const { isFormValid, fieldErrors, allErrors } = validateForm(
      this.formData,
      this.schema,
      this.formState
    );
    Object.entries(fieldErrors).forEach(([f, msg]) =>
      console.log(`🔍 [FormHandler] Na prefill - veld '${f}' validatie fout: ${msg}`)
    );
    console.log(`🔍 [FormHandler] Na prefill - formulier valid: ${isFormValid}`);

    // Voor elk veld: zet value, init state en bind input-event
    Object.keys(schema.fields).forEach((fieldName) => {
      const fieldEl = this.formElement.querySelector(`[data-field-name="${fieldName}"]`);
      if (!fieldEl) {
        console.warn(`⚠️ [FormHandler] Veld '${fieldName}' niet gevonden in DOM`);
        return;
      }

      // Stel opgeslagen waarde in als default
      if (this.formData[fieldName] != null) {
        fieldEl.value = this.formData[fieldName];
        console.log(
          `🔄 [FormHandler] Veld '${fieldName}' ingesteld op opgeslagen waarde: ${this.formData[fieldName]}`
        );
      }

      // Init state (bijv. voor touched/dirty tracking)
      this.formState[fieldName] = { isTouched: false };

      // Bind input event: sanitize, valideer, sla op, update UI
      fieldEl.addEventListener('change', (e) => this.handleInput(fieldName, e));
    });

    // Bind click op custom submit-knop specifiek voor dit formulier
    const submitBtn = this.formElement.querySelector(`[data-form-button="${this.schema.name}"]`);
    if (!submitBtn) {
      console.error(
        `❌ [FormHandler] Submit button [data-form-button] niet gevonden in ${schema.selector}`
      );
    } else {
      submitBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const { isFormValid, fieldErrors } = validateForm(
          this.formData,
          this.schema,
          this.formState
        );
        if (!isFormValid) {
          // Check op lege verplichte velden
          const hasEmptyRequired = Object.entries(this.schema.fields).some(
            ([f, cfg]) =>
              cfg.validators.includes('required') &&
              (!this.formData[f] || String(this.formData[f]).trim() === '')
          );
          const message = hasEmptyRequired
            ? 'Niet alle verplichte velden ingevuld.'
            : 'Niet alle velden correct ingevuld.';
          clearGlobalError(this.formElement);
          showGlobalError(this.formElement, message);
          return;
        }
        // Indien valide, door naar echte submit-flow
        this.handleSubmit(e);
      });
    }
  },

  /**
   * 📝 Handler voor input-events op velden.
   *
   * Werkwijze:
   *  1. Sanitize raw input
   *  2. Update formData en markeer touched
   *  3. Persisteer waarde in localStorage
   *  4. Valideer alleen dit veld en toon eventuele fouten
   *  5. Voer schema-triggers uit (bv. API-call bij valide combinatie)
   *  6. Update de submit-knop-status
   *
   * @param {string} fieldName - Naam van het veld
   * @param {Event} event - Input-event met raw waarde
   */
  handleInput(fieldName, event) {
    const raw = event.target.value;
    const clean = sanitizeField(raw, this.schema.fields[fieldName], fieldName);
    event.target.value = clean;
    console.log(`✏️ [FormHandler] Input '${fieldName}': raw='${raw}' → clean='${clean}'`);

    this.formData[fieldName] = clean;
    this.formState[fieldName].isTouched = true;
    
    const fieldSchema = this.schema.fields[fieldName];
    const persistType = fieldSchema.persist;

    if (persistType === 'global') {
      saveGlobalFieldData(fieldName, clean);
      console.log(`💾 [FormHandler] Globaal opgeslagen '${fieldName}' →`, clean);
    } else if (persistType === 'form') {
      const formDataToSave = {};
      Object.keys(this.schema.fields).forEach(fName => {
        if (this.schema.fields[fName].persist === 'form') {
          // Zorg ervoor dat de waarde bestaat in this.formData
          formDataToSave[fName] = this.formData.hasOwnProperty(fName) ? this.formData[fName] : '';
        }
      });
      saveFormData(this.schema.name, formDataToSave);
      console.log(`💾 [FormHandler] Formulier-specifieke opslag voor '${this.schema.name}' bijgewerkt vanwege '${fieldName}'. Opgeslagen data:`, formDataToSave);
    } else {
      // persistType is 'none' of niet gedefinieerd
      console.log(`💾 [FormHandler] Veld '${fieldName}' niet opgeslagen (persist type: ${persistType}).`);
    }

    // Valideer alleen dit veld en update UI
    const { fieldErrors } = validateForm({ [fieldName]: clean }, this.schema, this.formState);
    const fieldError = fieldErrors[fieldName];
    clearErrors(this.formElement, fieldName);
    if (fieldError) {
      showFieldErrors(this.formElement, fieldName, fieldError);
      console.warn(`❌ [FormHandler] Validatie fout in '${fieldName}': ${fieldError}`);
    } else {
      console.log(`✅ [FormHandler] '${fieldName}' gevalideerd zonder fouten`);
    }

    // **Log volledige validatie na input**
    const { isFormValid, fieldErrors: feAll } = validateForm(
      this.formData,
      this.schema,
      this.formState
    );
    Object.entries(feAll).forEach(([f, msg]) =>
      console.log(`🔄 [FormHandler] Na input - veld '${f}': ${msg || 'geen fout'}`)
    );
    console.log(`🔄 [FormHandler] Na input - formulier valid: ${isFormValid}`);

    // Voer eventuele triggers uit zoals gedefinieerd in het schema
    if (this.schema.fields[fieldName].triggers) {
      this.schema.fields[fieldName].triggers.forEach((trigger) => {
        if (trigger.when === 'valid' && !fieldError) {
          console.log(`⚙️ [FormHandler] Trigger '${trigger.action.name}' voor '${fieldName}'`);
          trigger.action(this.formData);
        }
      });
    }

    // Check algemene validatie voor aan/uit zetten van submit-knop
    this.updateSubmitState();
  },

  /**
   * 🔄 Controleert volledige formulier-validatie en togglet de submit-knop.
   *
   * Gebruikt validateForm om de globale validatie-status te bepalen.
   */
  updateSubmitState() {
    const { isFormValid } = validateForm(this.formData, this.schema, this.formState);
    const btn = this.formElement.querySelector(`[data-form-button="${this.schema.name}"]`);
    if (btn) { // Voeg een check toe of de knop bestaat voordat toggleButton wordt aangeroepen
      toggleButton(btn, isFormValid);
      console.log(`🔄 [FormHandler] Submit button ${isFormValid ? 'enabled ✅' : 'disabled ❌'} for form ${this.schema.name}`);
    } else {
      console.warn(`[FormHandler] Submit button [data-form-button="${this.schema.name}"] niet gevonden in updateSubmitState voor formulier ${this.schema.name}`);
    }
  },

  /**
   * 🚨 Behandel de submit van het formulier.
   *
   * Stappen:
   *  1. voorkom standaard reload
   *   2. clear alle fouten
   *  3. show loader en disable velden
   *  4. valideren van alle velden en verzamel field + global errors
   *  5. bij fouten: toon field en globale fouten, reset UI
   *  6. bij succes: voer custom action uit en onSuccess callback
   *
   * @param {Event} event - Submit-event van het formulier
   */
  async handleSubmit(event) {
    event.preventDefault();
    clearErrors(this.formElement);
    clearGlobalError(this.formElement);
    showLoader(event.target);
    toggleFields(this.formElement, false);

    try {
      if (this.schema.submit && typeof this.schema.submit.action === 'function') {
        await this.schema.submit.action(this.formData);
      }
      hideLoader(event.target);
      toggleFields(this.formElement, true);
      if (this.schema.submit && typeof this.schema.submit.onSuccess === 'function') {
        this.schema.submit.onSuccess();
      }
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
