// public/forms/logic/formHandler.js

import { sanitizeField } from './formInputSanitizer.js';
import { validateForm } from '../validators/formValidator.js';
import {
  showFieldErrors,
  showGlobalError,
  clearGlobalError,
  clearErrors,
  toggleButton,
} from '../ui/formUi.js';
import { saveFormData, loadFormData, saveGlobalFieldData, loadGlobalFieldData } from './formStorage.js';
import { inputFilters } from './formInputFilters.js'; // Importeer de input filters

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
   * Stap 5: Voer een initiële validatie uit op basis van de geladen/initiële data.
   * Stap 6: Bind een click listener aan de submit-knop die pre-validatie uitvoert (alle fouten tonen) alvorens handleSubmit aan te roepen.
   * Stap 7: Update de initiële staat van de submit-knop (enabled/disabled) op basis van de validatie.
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

      // Form-specifieke data overschrijft eventuele globale waarde
      if (formSpecificSavedData[fieldName] !== undefined) {
        valueToLoad = formSpecificSavedData[fieldName];
        console.log(`🔄 [FormHandler] Veld '${fieldName}' (form-specific): Geladen formulierwaarde (overschrijft globaal indien aanwezig): ${valueToLoad}`);
      }
      
      if (valueToLoad !== undefined) {
        // Pas sanitization toe op de geladen waarde
        this.formData[fieldName] = sanitizeField(valueToLoad, fieldConfig, fieldName);
        fieldEl.value = this.formData[fieldName]; // Zet gesanitized waarde in DOM
        console.log(
          `🔄 [FormHandler] Veld '${fieldName}' ingesteld op geladen & gesanitized waarde: ${this.formData[fieldName]}`
        );
      } else {
        // Geen opgeslagen waarde gevonden, gebruik (en sanitize) de huidige DOM-waarde
        const initialRawValue = fieldEl.value || ''; // Haal huidige waarde uit DOM, of '' indien falsy
        this.formData[fieldName] = sanitizeField(initialRawValue, fieldConfig, fieldName); // Sanitize deze waarde
        // Update het DOM-element alleen als de sanitization de waarde heeft veranderd
        if (initialRawValue !== this.formData[fieldName]) {
            fieldEl.value = this.formData[fieldName];
        }
        console.log(`🔄 [FormHandler] Veld '${fieldName}' niet in storage, gebruikt DOM waarde ('${initialRawValue}') gesanitized naar: '${this.formData[fieldName]}'`);
      }

      this.formState[fieldName] = { isTouched: false };
      // Gebruik het 'change' event om handleInput aan te roepen.
      // Dit zorgt ervoor dat validatie en foutmeldingen voor tekstvelden pas verschijnen
      // nadat het veld de focus verliest.
      fieldEl.addEventListener('change', (e) => this.handleInput(fieldName, e));

      // Toepassen van input filters via keydown, indien gedefinieerd in het schema
      if (fieldConfig.inputFilter && inputFilters[fieldConfig.inputFilter]) {
        const filterFunction = inputFilters[fieldConfig.inputFilter];
        fieldEl.addEventListener('keydown', filterFunction);
        console.log(`🔒 [FormHandler] Input filter '${fieldConfig.inputFilter}' toegepast op veld '${fieldName}'.`);

        // Specifieke attributen instellen op basis van filtertype, indien nodig.
        // Dit centraliseert de logica voor attributen die direct gerelateerd zijn aan het filter.
        if (fieldConfig.inputFilter === 'postcode') {
          fieldEl.setAttribute('maxlength', '6');
        }
        // Voorbeeld: als je een maxLength zou willen instellen voor 'digitsOnly' via schema:
        // if (fieldConfig.inputFilter === 'digitsOnly' && fieldConfig.maxLength) {
        //   fieldEl.setAttribute('maxlength', fieldConfig.maxLength.toString());
        // }
      } else if (fieldConfig.inputFilter) {
        // Log een waarschuwing als een filter is opgegeven maar niet bestaat.
        console.warn(`⚠️ [FormHandler] Input filter '${fieldConfig.inputFilter}' gedefinieerd voor veld '${fieldName}', maar niet gevonden in formInputFilters.js.`);
      }
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
        `❌ [FormHandler] Submit button [data-form-button="${this.schema.name}"] niet gevonden in ${schema.selector}`
      );
    } else {
      submitBtn.addEventListener('click', (e) => {
        // Voer client-side validatie uit direct bij de klik, voordat handleSubmit wordt aangeroepen.
        const { isFormValid: isFormCurrentlyValid, fieldErrors: currentFieldErrors } = validateForm(
          this.formData,
          this.schema,
          this.formState
        );

        if (!isFormCurrentlyValid) {
          e.preventDefault(); // Voorkom de daadwerkelijke submit en het aanroepen van handleSubmit
          
          // Wis alle bestaande fouten en toon de huidige set fouten
          clearErrors(this.formElement);
          Object.entries(currentFieldErrors).forEach(([fName, msg]) => {
            showFieldErrors(this.formElement, fName, msg);
          });

          // Bepaal en toon een globale foutmelding
          const hasEmptyRequired = Object.entries(this.schema.fields).some(
            ([fieldName, fieldConfig]) =>
              fieldConfig.validators && // Zorg ervoor dat validators array bestaat
              fieldConfig.validators.includes('required') &&
              (!this.formData[fieldName] || String(this.formData[fieldName]).trim() === '')
          );

          const globalMessages = this.schema.globalMessages || {}; // Haal globale messages uit schema
          let messageToShow = globalMessages.DEFAULT_INVALID_SUBMIT || 'Niet alle velden zijn correct ingevuld.';

          if (hasEmptyRequired) {
            messageToShow = globalMessages.REQUIRED_FIELDS_MISSING || 'Niet alle verplichte velden zijn ingevuld.';
          }
          
          clearGlobalError(this.formElement);
          showGlobalError(this.formElement, messageToShow);
          
          console.warn(`🚦 [FormHandler] Submit poging geblokkeerd door click listener (formulier ongeldig). Fouten:`, currentFieldErrors);
          return; // Stop verdere uitvoering in deze listener
        }
        
        // Als het formulier hier wel geldig is, ga dan pas naar de handleSubmit flow
        this.handleSubmit(e); 
      });
    }
    // Update de submit button state direct na initialisatie en het binden van alle events
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
    const fieldSchema = this.schema.fields[fieldName];
    if (!fieldSchema) {
      console.warn(`[FormHandler] Geen fieldSchema gevonden voor '${fieldName}' in handleInput.`);
      return;
    }

    const target = event.target;
    const rawValue = target.value;
    
    // De sanitization via sanitizeField blijft belangrijk,
    // vooral voor het afhandelen van geplakte content en het correct formatteren (bijv. uppercase voor postcode letters).
    const cleanValue = sanitizeField(rawValue, fieldSchema, fieldName);

    // Als de waarde in het veld daadwerkelijk is veranderd door de sanitizer (bijv. na plakken of door keydown preventie die niet alles ving)
    // update dan het veld. De keydown voorkomt al veel, maar dit is een fallback.
    if (target.value !== cleanValue) {
      target.value = cleanValue;
    }
    
    this.formData[fieldName] = cleanValue;
    this.formState[fieldName].isTouched = true;
    
    const persistType = fieldSchema.persist;

    if (persistType === 'global') {
      saveGlobalFieldData(fieldName, cleanValue);
      console.log(`💾 [FormHandler] Globaal opgeslagen '${fieldName}' →`, cleanValue);
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
    const { fieldErrors } = validateForm({ [fieldName]: cleanValue }, this.schema, this.formState);
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
