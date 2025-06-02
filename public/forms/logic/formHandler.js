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
 *  - Input sanitizing: alle invoer opschonen volgens schema-regels.
 *  - Validatie: veld- en formulier-validatie met veld- en globale fouten.
 *  - Opslag: persisteren en herladen van formulierdata in localStorage (formulier-specifiek of globaal).
 *  - UI-updates: tonen van loaders, uitschakelen van velden, tonen/wissen van fouten en bijwerken van knop-states.
 *  - Submit flow: afhandelen van de submit-actie, inclusief custom acties en success/error callbacks.
 *  - Triggers: uitvoeren van gedefinieerde acties op basis van veld-events (bv. na validatie).
 */
export const formHandler = {
  schema: null, // Formulier schema met velden, validatie en submit-configuratie
  formElement: null, // DOM-element van het formulier
  formData: {}, // Huidige gesanitized waarden van alle velden
  formState: {}, // State per veld (bijv. isTouched)

  /**
   * 🛠️ Initialiseer de form handler met het gegeven schema.
   *
   * Stappen:
   *  1. Bind het formulier-element uit de DOM.
   *  2. Laad eerder opgeslagen data (globaal en formulier-specifiek), sanitize deze en zet waarden in formData en DOM.
   *     Als er geen opgeslagen data is, wordt de initiële DOM-waarde gebruikt en gesanitized.
   *  3. Initialiseer de formState voor elk veld.
   *  4. Bind input/change event listeners aan de velden voor real-time afhandeling.
   *  5. Voer een initiële validatie uit op basis van de geladen/initiële data.
   *  6. Bind een click listener aan de submit-knop die pre-validatie uitvoert alvorens handleSubmit aan te roepen.
   *  7. Update de initiële staat van de submit-knop (enabled/disabled) op basis van de validatie.
   *
   * @param {object} schema - De configuratie-object voor het formulier, inclusief naam, selector, velddefinities, en submit-logica.
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

      let valueToLoad; 
      const persistType = fieldConfig.persist;

      if (persistType === 'global') {
        const globalValue = loadGlobalFieldData(fieldName);
        if (globalValue !== null) { 
          valueToLoad = globalValue;
          console.log(`🔄 [FormHandler] Veld '${fieldName}' (global): Geladen globale waarde: ${valueToLoad}`);
        }
      }

      if (formSpecificSavedData[fieldName] !== undefined) {
        valueToLoad = formSpecificSavedData[fieldName];
        console.log(`🔄 [FormHandler] Veld '${fieldName}' (form-specific): Geladen formulierwaarde (overschrijft globaal indien aanwezig): ${valueToLoad}`);
      }
      
      if (valueToLoad !== undefined) {
        this.formData[fieldName] = sanitizeField(valueToLoad, fieldConfig, fieldName); // Sanitize loaded value
        fieldEl.value = this.formData[fieldName]; 
        console.log(
          `🔄 [FormHandler] Veld '${fieldName}' ingesteld op geladen & gesanitized waarde: ${this.formData[fieldName]}`
        );
      } else {
        const initialRawValue = fieldEl.value || '';
        this.formData[fieldName] = sanitizeField(initialRawValue, fieldConfig, fieldName);
        if (initialRawValue !== this.formData[fieldName]) {
            fieldEl.value = this.formData[fieldName]; 
        }
        console.log(`🔄 [FormHandler] Veld '${fieldName}' niet in storage, gebruikt DOM waarde ('${initialRawValue}') gesanitized naar: '${this.formData[fieldName]}'`);
      }

      this.formState[fieldName] = { isTouched: false };
      fieldEl.addEventListener('input', (e) => this.handleInput(fieldName, e));
      if (['SELECT', 'INPUT'].includes(fieldEl.tagName) && (fieldEl.type === 'checkbox' || fieldEl.type === 'radio' || fieldEl.tagName === 'SELECT')) {
        fieldEl.addEventListener('change', (e) => this.handleInput(fieldName, e));
      }
    });
    
    console.log(`🔄 [FormHandler] Initial formData state na laden en DOM sync:`, { ...this.formData });

    const { isFormValid, fieldErrors } = validateForm(
      this.formData,
      this.schema,
      this.formState
    );
    Object.entries(fieldErrors).forEach(([f, msg]) =>
      console.log(`🔍 [FormHandler] Na prefill - veld '${f}' validatie fout: ${msg}`)
    );
    console.log(`🔍 [FormHandler] Na prefill - formulier valid: ${isFormValid}`);

    const submitBtn = this.formElement.querySelector(`[data-form-button="${this.schema.name}"]`);
    if (!submitBtn) {
      console.error(
        `❌ [FormHandler] Submit button [data-form-button="${this.schema.name}"] niet gevonden in ${schema.selector}`
      );
    } else {
      submitBtn.addEventListener('click', (e) => {
        const { isFormValid: isFormCurrentlyValid, fieldErrors: currentFieldErrors } = validateForm(
          this.formData,
          this.schema,
          this.formState
        );
        if (!isFormCurrentlyValid) {
          e.preventDefault(); 
          clearErrors(this.formElement);
          Object.entries(currentFieldErrors).forEach(([fName, msg]) => {
            showFieldErrors(this.formElement, fName, msg);
          });

          const hasEmptyRequired = Object.entries(this.schema.fields).some(
            ([f, cfg]) =>
              cfg.validators.includes('required') &&
              (!this.formData[f] || String(this.formData[f]).trim() === '')
          );
          const message = hasEmptyRequired
            ? 'Niet alle verplichte velden zijn ingevuld.'
            : 'Niet alle velden zijn correct ingevuld.';
          clearGlobalError(this.formElement);
          showGlobalError(this.formElement, message);
          console.warn(`🚦 [FormHandler] Submit poging geblokkeerd, formulier ongeldig. Fouten:`, currentFieldErrors);
          return;
        }
        this.handleSubmit(e);
      });
    }
    this.updateSubmitState();
  },

  /**
   * 📝 Handler voor input- en change-events op formuliervelden.
   *
   * Werkwijze:
   *  1. Haal de ruwe waarde uit het event.
   *  2. Sanitize de waarde op basis van de veldconfiguratie in het schema.
   *  3. Update het DOM-element met de gesanitized waarde en probeer de cursorpositie te behouden.
   *  4. Update `this.formData` met de gesanitized waarde en markeer het veld als `isTouched` in `this.formState`.
   *  5. Persisteer de waarde in localStorage indien geconfigureerd (globaal of formulier-specifiek).
   *  6. Valideer het gehele formulier, maar wis en toon specifiek de foutmeldingen voor het huidige veld.
   *  7. Voer eventuele gedefinieerde triggers uit als het veld valide is. Triggers ontvangen `this.formData` en de `formHandler` instantie (`this`).
   *  8. Update de staat van de submit-knop op basis van de algehele validiteit van het formulier.
   *
   * @param {string} fieldName - De naam van het veld zoals gedefinieerd in het schema.
   * @param {Event} event - Het input- of change-event object.
   */
  handleInput(fieldName, event) {
    const rawValue = event.target.value;
    const fieldSchema = this.schema.fields[fieldName];
    const sanitizedValue = sanitizeField(rawValue, fieldSchema, fieldName);
    
    if (event.target.value !== sanitizedValue) {
      const cursorPos = event.target.selectionStart;
      event.target.value = sanitizedValue;
      try {
        // Behoud cursorpositie alleen als de lengte niet is veranderd, anders zet aan het eind.
        // Dit is een vereenvoudiging; complexere logica kan nodig zijn voor perfect cursorbehoud.
        const newCursorPos = (rawValue.length === sanitizedValue.length) ? cursorPos : sanitizedValue.length;
        event.target.setSelectionRange(newCursorPos, newCursorPos);
      } catch (e) {
        console.warn(`[FormHandler] Kon cursor positie niet herstellen voor veld ${fieldName}`, e);
      }
    }
    
    console.log(`✏️ [FormHandler] Input '${fieldName}': raw='${rawValue}' → clean='${sanitizedValue}'`);

    this.formData[fieldName] = sanitizedValue;
    this.formState[fieldName].isTouched = true;
    
    const persistType = fieldSchema.persist;

    if (persistType === 'global') {
      saveGlobalFieldData(fieldName, sanitizedValue);
      console.log(`💾 [FormHandler] Globaal opgeslagen '${fieldName}' →`, sanitizedValue);
    } else if (persistType === 'form') {
      const formDataToSave = {};
      Object.keys(this.schema.fields).forEach(fName => {
        if (this.schema.fields[fName].persist === 'form') {
          formDataToSave[fName] = this.formData.hasOwnProperty(fName) ? this.formData[fName] : (this.formElement.querySelector(`[data-field-name="${fName}"]`)?.value || '');
        }
      });
      saveFormData(this.schema.name, formDataToSave);
      console.log(`💾 [FormHandler] Formulier-specifieke opslag voor '${this.schema.name}' bijgewerkt vanwege '${fieldName}'. Opgeslagen data:`, formDataToSave);
    } else {
      console.log(`💾 [FormHandler] Veld '${fieldName}' niet opgeslagen (persist type: ${persistType || 'none'}).`);
    }

    const { isFormValid: isOverallFormValid, fieldErrors } = validateForm(this.formData, this.schema, this.formState);
    const fieldError = fieldErrors[fieldName];
    
    clearErrors(this.formElement, fieldName); 
    if (fieldError) {
      showFieldErrors(this.formElement, fieldName, fieldError);
      console.warn(`❌ [FormHandler] Validatie fout in '${fieldName}': ${fieldError}`);
    } else {
      console.log(`✅ [FormHandler] '${fieldName}' gevalideerd zonder fouten`);
    }

    console.log(`🔄 [FormHandler] Na input - formulier valid: ${isOverallFormValid}`);

    if (fieldSchema.triggers) {
      fieldSchema.triggers.forEach((trigger) => {
        if (trigger.when === 'valid' && !fieldError) { 
          console.log(`⚙️ [FormHandler] Trigger '${trigger.action.name || 'anonymous trigger'}' voor '${fieldName}'`);
          trigger.action(this.formData, this); // Geef formHandler (this) mee
        }
      });
    }
    this.updateSubmitState(); 
  },

  /**
   * 🔄 Controleert de volledige validiteit van het formulier en past de staat (enabled/disabled) van de submit-knop aan.
   *
   * Gebruikt `validateForm` om de huidige validatiestatus van het gehele formulier te bepalen
   * en `toggleButton` (uit `formUi.js`) om de visuele en functionele staat van de knop bij te werken.
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
   * 🚨 Behandelt de daadwerkelijke indiening van het formulier.
   * Deze methode wordt aangeroepen vanuit de click-listener van de submit-knop,
   * nadat die listener heeft geverifieerd dat het formulier client-side valide is.
   *
   * Stappen:
   *  1. Voorkom het standaard browsergedrag voor het formulier-event (bv. pagina herladen).
   *  2. Wis alle bestaande foutmeldingen (zowel veld-specifiek als globaal).
   *  3. Toon een loader op de submit-knop en schakel alle formuliervelden tijdelijk uit.
   *  4. Voer de asynchrone `submit.action` uit die in het formulierschema is gedefinieerd,
   *     en geef `this.formData` mee.
   *  5. Bij succesvolle afronding van de actie:
   *     - Verberg de loader en schakel de velden weer in.
   *     - Roep de `submit.onSuccess` callback aan (indien gedefinieerd in het schema).
   *  6. Bij een fout tijdens de actie:
   *     - Verberg de loader en schakel de velden weer in.
   *     - Toon een globale foutmelding op basis van de ontvangen error of standaardberichten.
   *
   * @param {Event} event - Het event object (meestal een 'click' event van de submit-knop).
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
