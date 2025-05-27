// public/forms/logic/formHandler.js

import { sanitizeField } from './formInputSanitizer.js';
import { validateForm } from '../validators/formValidator.js';
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
 *  - Submit flow: optionele API-call en success-/error-afhandeling
 */
export const formHandler = {
  schema: null,       // Formulier schema met velden, validatie en submit-configuratie
  formElement: null,  // DOM-element van het formulier
  formData: {},       // Huidige waarden van alle velden
  formState: {},      // State per veld (bijv. isTouched)

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

    // Laad opgeslagen data voor dit formulier (indien aanwezig)
    this.formData = loadFormData(schema.name) || {};
    this.formState = {};
    clearErrors(this.formElement);
    clearGlobalError(this.formElement);
    console.log(`🔄 [FormHandler] Loaded data:`, this.formData);

    // Voor elk veld: zet value, init state en bind input-event
    Object.keys(schema.fields).forEach((fieldName) => {
      const fieldEl = this.formElement.querySelector(`[name="${fieldName}"]`);
      if (!fieldEl) {
        console.warn(`⚠️ [FormHandler] Veld '${fieldName}' niet gevonden in DOM`);
        return;
      }

      // Stel opgeslagen waarde in als default
      if (this.formData[fieldName] != null) {
        fieldEl.value = this.formData[fieldName];
        console.log(`🔄 [FormHandler] Veld '${fieldName}' ingesteld op opgeslagen waarde: ${this.formData[fieldName]}`);
      }

      // Init state (bijv. voor touched/dirty tracking)
      this.formState[fieldName] = { isTouched: false };

      // Bind input event: sanitize, valideer, sla op, update UI
      fieldEl.addEventListener('input', (e) => this.handleInput(fieldName, e));
    });

    // Bind submit event: verwerk via handleSubmit
    this.formElement.addEventListener('submit', (e) => this.handleSubmit(e));
    console.log(`✅ [FormHandler] Event listeners gebonden voor ${schema.name}`);

    // Nadat velden klaar zijn, update submit-knop (enabled/disabled)
    this.updateSubmitState();
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

    // Update interne data en state
    this.formData[fieldName] = clean;
    this.formState[fieldName].isTouched = true;
    saveFormData(this.schema.name, this.formData);
    console.log(`💾 [FormHandler] Saved '${fieldName}' →`, clean);

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
    const btn = this.formElement.querySelector('[type="submit"]');
    toggleButton(btn, isFormValid);
    console.log(`🔄 [FormHandler] Submit button ${isFormValid ? 'enabled ✅' : 'disabled ❌'}`);
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
   *  6. bij succes: optioneel fetch naar endpoint en onSuccess callback
   * 
   * @param {Event} event - Submit-event van het formulier
   */
  async handleSubmit(event) {
    event.preventDefault();
    console.log(`🚨 [FormHandler] Submit gestart voor formulier: ${this.schema.name}`);
    clearErrors(this.formElement);
    clearGlobalError(this.formElement);
    showLoader(event.submitter);
    toggleFields(this.formElement, false);

    // Valideer compleet formulier
    const { isFormValid, fieldErrors, allErrors } = validateForm(this.formData, this.schema, this.formState);
    if (!isFormValid) {
      console.warn(`❌ [FormHandler] Form validatie failed:`, allErrors);
      hideLoader(event.submitter);
      toggleFields(this.formElement, true);
      // Toon field errors per veld
      showFieldErrors(this.formElement, fieldErrors);
      // Toon globale foutmeldingen
      const messages = allErrors.map((e) => e.message);
      showGlobalError(this.formElement, messages);
      return;
    }

    try {
      let response;
      // Alleen als schema een endpoint specificeert, voer fetch uit
      if (this.schema.submit && this.schema.submit.endpoint) {
        console.log(`🌐 [FormHandler] Fetch naar ${this.schema.submit.method || 'POST'} ${this.schema.submit.endpoint}`);
        response = await fetch(this.schema.submit.endpoint, {
          method: this.schema.submit.method || 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.formData),
        });
        if (!response.ok) throw new Error(`Server returned ${response.status}`);
        console.log(`✅ [FormHandler] Server responded OK (${response.status})`);
      }

      // Sluit loader en heractiveer velden
      hideLoader(event.submitter);
      toggleFields(this.formElement, true);
      console.log(`✅ [FormHandler] Submit succesvolle voor ${this.schema.name}`);
      // Optionele callback bij succes (bijv. redirect, toast)
      if (this.schema.submit && this.schema.submit.onSuccess) {
        this.schema.submit.onSuccess(response);
      }
    } catch (err) {
      console.error(`❌ [FormHandler] Submit error:`, err);
      hideLoader(event.submitter);
      toggleFields(this.formElement, true);
      showGlobalError(this.formElement, err.message || 'Er is iets misgegaan.');
    }
  },
};
