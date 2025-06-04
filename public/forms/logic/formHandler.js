// public/forms/logic/formHandler.js

import { sanitizeField } from './formInputSanitizer.js';
import { validateForm } from '../validators/formValidator.js';
import {
  showFieldErrors,
  showGlobalError,
  clearGlobalError,
  clearErrors,
  toggleButton,
  showLoader,
  hideLoader,
  toggleFields,
  showError,
  hideError,
  isErrorVisible,
} from '../ui/formUi.js';
import {
  saveFormData,
  loadFormData,
  saveGlobalFieldData,
  loadGlobalFieldData,
} from './formStorage.js';
import { inputFilters } from './formInputFilters.js'; // Importeer de input filters
import { initAddressLookupTrigger } from './formTriggers.js'; // Importeer triggers

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
  _triggerCleanupFunctions: [], // Opslag voor cleanup functie van triggers

  /**
   * 🔌 Initialiseert triggers op basis van het schema
   *
   * Roept de juiste triggerfunctie aan op basis van het trigger type
   * en slaat de cleanup functie op voor latere opruiming
   */
  _initTriggers() {
    // Ruim eerst eventuele oude triggers op
    this._cleanupTriggers();

    // Check of schema triggers bevat
    if (!this.schema.triggers || !Array.isArray(this.schema.triggers)) {
      return;
    }

    // Initialiseer elke trigger uit het schema
    for (const trigger of this.schema.triggers) {
      if (!trigger.type) continue;

      let cleanup = null;

      switch (trigger.type) {
        case 'addressLookup':
          console.log(`🔌 [formHandler] Initialiseren addressLookup trigger`);
          cleanup = initAddressLookupTrigger(this, trigger.config || {});
          break;
        // Hier kunnen meer trigger types worden toegevoegd
        default:
          console.warn(`⚠️ [formHandler] Onbekend trigger type: ${trigger.type}`);
          continue;
      }

      if (typeof cleanup === 'function') {
        this._triggerCleanupFunctions.push(cleanup);
      }
    }
  },

  /**
   * 🧹 Ruimt eventuele actieve triggers op door de cleanup functies aan te roepen
   */
  _cleanupTriggers() {
    if (this._triggerCleanupFunctions && this._triggerCleanupFunctions.length > 0) {
      console.log(
        `🧹 [formHandler] Opruimen van ${this._triggerCleanupFunctions.length} actieve triggers`
      );
      for (const cleanup of this._triggerCleanupFunctions) {
        if (typeof cleanup === 'function') {
          cleanup();
        }
      }
      this._triggerCleanupFunctions = [];
    }
  },

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
    console.log(
      `🔄 [FormHandler] Initializing form data for ${schema.name}. Form-specific saved:`,
      formSpecificSavedData
    );

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
          console.log(
            `🔄 [FormHandler] Veld '${fieldName}' (global): Geladen globale waarde: ${valueToLoad}`
          );
        }
      }

      // Form-specifieke data overschrijft eventuele globale waarde
      if (formSpecificSavedData[fieldName] !== undefined) {
        valueToLoad = formSpecificSavedData[fieldName];
        console.log(
          `🔄 [FormHandler] Veld '${fieldName}' (form-specific): Geladen formulierwaarde (overschrijft globaal indien aanwezig): ${valueToLoad}`
        );
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
        console.log(
          `🔄 [FormHandler] Veld '${fieldName}' niet in storage, gebruikt DOM waarde ('${initialRawValue}') gesanitized naar: '${this.formData[fieldName]}'`
        );
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
        console.log(
          `🔒 [FormHandler] Input filter '${fieldConfig.inputFilter}' toegepast op veld '${fieldName}'.`
        );

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
        console.warn(
          `⚠️ [FormHandler] Input filter '${fieldConfig.inputFilter}' gedefinieerd voor veld '${fieldName}', maar niet gevonden in formInputFilters.js.`
        );
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

    // Initialiseer triggers indien aanwezig in het schema
    this._initTriggers();

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
          let messageToShow =
            globalMessages.DEFAULT_INVALID_SUBMIT || 'Niet alle velden zijn correct ingevuld.';

          if (hasEmptyRequired) {
            messageToShow =
              globalMessages.REQUIRED_FIELDS_MISSING ||
              'Niet alle verplichte velden zijn ingevuld.';
          }

          clearGlobalError(this.formElement);
          showGlobalError(this.formElement, messageToShow);

          console.warn(
            `🚦 [FormHandler] Submit poging geblokkeerd door click listener (formulier ongeldig). Fouten:`,
            currentFieldErrors
          );
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

    // Sanitize de input waarde op basis van het veldschema.
    const cleanValue = sanitizeField(rawValue, fieldSchema, fieldName);

    // Update de DOM-waarde als de gesanitizede waarde anders is.
    // Dit is vooral relevant als de keydown-filters (indien aanwezig) niet alle gevallen dekken (bijv. plakken).
    if (target.value !== cleanValue) {
      // Toekomstige overweging: cursorpositie herstellen na wijziging van target.value (Suggestie 2.2)
      target.value = cleanValue;
    }

    // Update de interne formulierdata met de gesanitizede waarde.
    // Dit is de 'single source of truth' voor de data van dit veld.
    this.formData[fieldName] = cleanValue;
    this.formState[fieldName].isTouched = true; // Markeer het veld als 'touched'.
    console.log(`📝 [FormHandler] Data voor '${fieldName}' geüpdatet naar: '${cleanValue}'`);

    // Logica voor het persisteren (opslaan) van de veldwaarde.
    const persistType = fieldSchema.persist;

    if (persistType === 'global') {
      // Sla de gesanitizede waarde globaal op (bijv. in localStorage onder de veldnaam).
      saveGlobalFieldData(fieldName, cleanValue);
      console.log(`💾 [FormHandler] Globaal opgeslagen '${fieldName}' →`, cleanValue);
    } else if (persistType === 'form') {
      /**
       * @type {Object<string, any>}
       * @description Object dat wordt opgeslagen voor het huidige formulier.
       * Bevat alleen velden uit this.schema.fields die 'persist: 'form'' hebben,
       * met hun gesanitizede waarden uit this.formData.
       */
      const formDataToSave = {};

      // Itereer over alle velden gedefinieerd in het schema van dit formulier.
      Object.keys(this.schema.fields).forEach((fName) => {
        const currentFieldConfig = this.schema.fields[fName];
        // Controleer of het huidige veld in de iteratie 'persist: 'form'' heeft.
        if (currentFieldConfig && currentFieldConfig.persist === 'form') {
          // Voeg het veld toe aan formDataToSave.
          // De waarde wordt gehaald uit this.formData, die de meest recente,
          // gesanitizede waarde voor elk veld bevat.
          if (this.formData.hasOwnProperty(fName)) {
            formDataToSave[fName] = this.formData[fName];
          } else {
            // Fallback: als een veld in het schema staat met 'persist: 'form'',
            // maar om een of andere reden niet in this.formData voorkomt (zou niet moeten gebeuren na correcte initialisatie),
            // sla dan een lege string op om data-integriteit te waarborgen.
            formDataToSave[fName] = '';
            console.warn(
              `[FormHandler] Veld '${fName}' (met persist: 'form') niet gevonden in this.formData tijdens opslaan voor formulier '${this.schema.name}'. Opgeslagen als lege string.`
            );
          }
        }
      });
      // Sla het samengestelde formDataToSave object op onder de naam van het formulier.
      saveFormData(this.schema.name, formDataToSave);
      console.log(
        `💾 [FormHandler] Formulier-specifieke opslag voor '${this.schema.name}' bijgewerkt vanwege input op '${fieldName}'. Opgeslagen data:`,
        formDataToSave
      );
    } else if (persistType && persistType !== 'none') {
      // Log een waarschuwing als een onbekend persistType is opgegeven.
      console.warn(
        `[FormHandler] Veld '${fieldName}' heeft een onbekend persist type: '${persistType}'. Wordt niet opgeslagen.`
      );
    }

    // Valideer het veld en het gehele formulier, en update de UI (foutmeldingen, submit knop status).
    // validateForm retourneert de algehele validiteit van het formulier, specifieke veldfouten, en alle fouten.
    const {
      isFormValid: isOverallFormValid,
      fieldErrors,
      allErrors,
    } = validateForm(this.formData, this.schema, this.formState);
    const fieldError = fieldErrors[fieldName]; // Haal de specifieke fout voor het huidige veld op.

    // Wis eerst eventuele bestaande foutmeldingen voor dit specifieke veld.
    clearErrors(this.formElement, fieldName);
    if (fieldError) {
      // Als er een validatiefout is voor dit veld, toon deze dan.
      showFieldErrors(this.formElement, fieldName, fieldError);
      console.warn(
        `❌ [FormHandler] Validatie fout in '${fieldName}' (na ${event.type} event): ${fieldError}`
      );
    } else {
      // Als er geen fout is, log dit dan.
      console.log(
        `✅ [FormHandler] '${fieldName}' gevalideerd zonder fouten (na ${event.type} event)`
      );
    }

    // Voer eventuele 'triggers' uit die gedefinieerd zijn in het schema voor dit veld.
    // Triggers zijn acties die uitgevoerd worden wanneer een veld aan bepaalde voorwaarden voldoet (bijv. valide is).
    if (fieldSchema.triggers) {
      fieldSchema.triggers.forEach((trigger) => {
        // Voer de trigger actie alleen uit als de 'when' conditie (bijv. 'valid') overeenkomt
        // en er geen specifieke fout is voor dit veld.
        if (trigger.when === 'valid' && !fieldError) {
          console.log(
            `⚙️ [FormHandler] Trigger '${
              trigger.action.name || 'anonieme actie'
            }' voor '${fieldName}' wordt uitgevoerd.`
          );
          try {
            // Roep de actie aan en geef de huidige formulierdata en de formHandler instantie (this) mee.
            // Dit stelt de actie in staat om andere velden te beïnvloeden of formHandler methodes aan te roepen.
            trigger.action(this.formData, this);
          } catch (err) {
            console.error(
              `💥 [FormHandler] Fout tijdens uitvoeren trigger voor veld '${fieldName}':`,
              err
            );
          }
        }
      });
    }

    // Update de status van de submit knop (bijv. enabled/disabled) op basis van de algehele validiteit van het formulier.
    this.updateSubmitState();
  },
  /**
   * 🔄 Controleert volledige formulier-validatie en togglet de submit-knop.
   *
   * Gebruikt validateForm om de globale validatie-status te bepalen.
   * Controleert ook of velden die server-validatie nodig hebben ingevuld zijn.
   */
  updateSubmitState() {
    const { isFormValid: basicFormValid } = validateForm(this.formData, this.schema, this.formState);
    
    // Haal alle velden op die server-validatie vereisen 
    const serverValidatedFields = Object.entries(this.schema.fields || {})
      .filter(([_, fieldSchema]) => fieldSchema.requiresServerValidation)
      .map(([fieldName]) => fieldName);

    // Controleer of alle velden die server-validatie vereisen ingevuld zijn
    const areServerValidatedFieldsPopulated = serverValidatedFields.length === 0 || 
      serverValidatedFields.every(field => {
        return this.formData[field] && this.formData[field].trim() !== '';
      });

    const isFormValid = basicFormValid && areServerValidatedFieldsPopulated;
    
    const btn = this.formElement.querySelector(`[data-form-button="${this.schema.name}"]`);
    if (btn) {
      // Voeg een check toe of de knop bestaat voordat toggleButton wordt aangeroepen
      toggleButton(btn, isFormValid);
      console.log(
        `🔄 [FormHandler] Submit button ${isFormValid ? 'enabled ✅' : 'disabled ❌'} for form ${
          this.schema.name
        } (basic validation: ${basicFormValid}, server fields populated: ${areServerValidatedFieldsPopulated})`
      );
    } else {
      console.warn(
        `[FormHandler] Submit button [data-form-button="${this.schema.name}"] niet gevonden in updateSubmitState voor formulier ${this.schema.name}`
      );
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

  /**
   * 🧹 Ruimt alle resources op die door het formulier worden gebruikt.
   * Dient aangeroepen te worden wanneer een formulier niet meer nodig is.
   */
  destroy() {
    console.log(`🧹 [FormHandler] Opruimen van formulier: ${this.schema?.name}`);

    // Ruim triggers op
    this._cleanupTriggers();

    // Reset state
    this.schema = null;
    this.formElement = null;
    this.formData = {};
    this.formState = {};
  },
};
