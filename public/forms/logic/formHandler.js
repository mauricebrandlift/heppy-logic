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
      Object.keys(this.schema.fields).forEach(fName => {
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
            console.warn(`[FormHandler] Veld '${fName}' (met persist: 'form') niet gevonden in this.formData tijdens opslaan voor formulier '${this.schema.name}'. Opgeslagen als lege string.`);
          }
        }
      });
      // Sla het samengestelde formDataToSave object op onder de naam van het formulier.
      saveFormData(this.schema.name, formDataToSave);
      console.log(`💾 [FormHandler] Formulier-specifieke opslag voor '${this.schema.name}' bijgewerkt vanwege input op '${fieldName}'. Opgeslagen data:`, formDataToSave);
    } else if (persistType && persistType !== 'none') {
      // Log een waarschuwing als een onbekend persistType is opgegeven.
      console.warn(`[FormHandler] Veld '${fieldName}' heeft een onbekend persist type: '${persistType}'. Wordt niet opgeslagen.`);
    }

    // Valideer het veld en het gehele formulier, en update de UI (foutmeldingen, submit knop status).
    // validateForm retourneert de algehele validiteit van het formulier, specifieke veldfouten, en alle fouten.
    const { isFormValid: isOverallFormValid, fieldErrors, allErrors } = validateForm(this.formData, this.schema, this.formState);
    const fieldError = fieldErrors[fieldName]; // Haal de specifieke fout voor het huidige veld op.
    
    // Wis eerst eventuele bestaande foutmeldingen voor dit specifieke veld.
    clearErrors(this.formElement, fieldName); 
    if (fieldError) {
      // Als er een validatiefout is voor dit veld, toon deze dan.
      showFieldErrors(this.formElement, fieldName, fieldError);
      console.warn(`❌ [FormHandler] Validatie fout in '${fieldName}' (na ${event.type} event): ${fieldError}`);
    } else {
      // Als er geen fout is, log dit dan.
      console.log(`✅ [FormHandler] '${fieldName}' gevalideerd zonder fouten (na ${event.type} event)`);
    }

    // Voer eventuele 'triggers' uit die gedefinieerd zijn in het schema voor dit veld.
    // Triggers zijn acties die uitgevoerd worden wanneer een veld aan bepaalde voorwaarden voldoet (bijv. valide is).
    if (fieldSchema.triggers) {
      fieldSchema.triggers.forEach((trigger) => {
        // Voer de trigger actie alleen uit als de 'when' conditie (bijv. 'valid') overeenkomt
        // en er geen specifieke fout is voor dit veld.
        if (trigger.when === 'valid' && !fieldError) {
          console.log(`⚙️ [FormHandler] Trigger '${trigger.action.name || 'anonieme actie'}' voor '${fieldName}' wordt uitgevoerd.`);
          try {
            // Roep de actie aan en geef de huidige formulierdata en de formHandler instantie (this) mee.
            // Dit stelt de actie in staat om andere velden te beïnvloeden of formHandler methodes aan te roepen.
            trigger.action(this.formData, this); 
          } catch (err) {
            console.error(`💥 [FormHandler] Fout tijdens uitvoeren trigger voor veld '${fieldName}':`, err);
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
    console.log(`[FormHandler] handleSubmit aangeroepen voor formulier: ${this.schema.name}`);

    // Sla een referentie naar de submit-knop op voor consistent gebruik.
    const submitBtn = event.target.closest('[data-form-button]') || this.formElement.querySelector(`[data-form-button="${this.schema.name}"]`);
    let globalMessage = '';
    let apiResult = null;
    let isApiError = false;

    const { isFormValid, fieldErrors } = validateForm(this.formData, this.schema, this.formState);

    if (!isFormValid) {
      console.warn('[FormHandler] Submit poging op ongeldig formulier in handleSubmit. Fouten:', fieldErrors);
      clearErrors(this.formElement);
      Object.entries(fieldErrors).forEach(([fName, msg]) => showFieldErrors(this.formElement, fName, msg));
      
      const hasEmptyRequired = Object.entries(this.schema.fields).some(
        ([, cfg]) => cfg.validators?.includes('required') && (!this.formData[cfg.name] || String(this.formData[cfg.name]).trim() === '')
      );
      globalMessage = hasEmptyRequired
        ? (this.schema.globalMessages?.REQUIRED_FIELDS_MISSING || 'Niet alle verplichte velden zijn ingevuld.')
        : (this.schema.globalMessages?.DEFAULT_INVALID_SUBMIT || 'Controleer de invoer en probeer het opnieuw.');
      
      clearGlobalError(this.formElement);
      showGlobalError(this.formElement, globalMessage, 'error');
      if (submitBtn) toggleButton(submitBtn, false); // Houd knop disabled
      return;
    }

    // Controleer of er een submit actie gedefinieerd is in het schema.
    if (this.schema.submit && typeof this.schema.submit.action === 'function') {
      if (submitBtn) showLoader(submitBtn); // Toon loader op de knop
      // Schakel alle formuliervelden uit tijdens de API call voor een betere UX.
      toggleFields(this.formElement, Object.keys(this.schema.fields), undefined, true); // (formEl, fieldNames, show=undefined, disable=true)
      isApiError = false;

      try {
        console.log(`[FormHandler] API call (schema.submit.action) starten voor formulier ${this.schema.name} met data:`, this.formData);
        // De formulier-specifieke action (bijv. uit addressCheckForm.js) is verantwoordelijk
        // voor het gooien van een Error met een gebruikersvriendelijke message.
        apiResult = await this.schema.submit.action(this.formData, this.formElement);

        // Verwerk het resultaat van de API call.
        if (apiResult && apiResult.success !== false) { // Behandel gevallen waar success niet expliciet true is maar ook geen error
          globalMessage = apiResult.message || this.schema.globalMessages?.success || 'Formulier succesvol verwerkt.';
          console.log(`[FormHandler] API call succesvol voor ${this.schema.name}. Resultaat:`, apiResult);
          
          // Bepaal of velden disabled moeten blijven na succes.
          if (this.schema.submit.disableFieldsOnSuccess === true) {
            // Velden blijven disabled (zoals ingesteld voor de API call).
          } else if (Array.isArray(this.schema.submit.disableFieldsOnSuccess)) {
            // Schakel specifieke velden uit, en schakel de rest in.
            const allFieldNames = Object.keys(this.schema.fields);
            const fieldsToEnable = allFieldNames.filter(name => !this.schema.submit.disableFieldsOnSuccess.includes(name));
            toggleFields(this.formElement, this.schema.submit.disableFieldsOnSuccess, undefined, true); // disable specifieke
            if (fieldsToEnable.length > 0) {
              toggleFields(this.formElement, fieldsToEnable, undefined, false); // enable de rest
            }
          } else {
            // Standaard: schakel alle velden weer in na succes.
            toggleFields(this.formElement, Object.keys(this.schema.fields), undefined, false);
          }
          // TODO: Implementeer logica voor hideFieldsOnSuccess en showFields indien nodig.

        } else if (apiResult && apiResult.error) {
          // De API retourneerde een gestructureerd error object (bijv. { success: false, error: 'bericht' }).
          globalMessage = apiResult.error;
          isApiError = true;
          console.warn(`[FormHandler] API call voor ${this.schema.name} gaf een gestructureerde error terug:`, apiResult.error);
        } else {
          // Fallback: API call was niet succesvol of gaf geen duidelijk resultaat.
          globalMessage = this.schema.globalMessages?.DEFAULT_API_ERROR || 'Er is iets misgegaan. Probeer het later opnieuw.';
          isApiError = true;
          console.warn(`[FormHandler] API call voor ${this.schema.name} was niet succesvol of gaf geen duidelijk resultaat. Resultaat:`, apiResult);
        }
      } catch (err) {
        // Een error werd gegooid tijdens de API call (bijv. netwerkfout, of de action gooide een error).
        isApiError = true;
        console.error(`❌ [FormHandler] Submit error:`, err);
        
        const gm = this.schema.globalMessages || {};
        // Prioriteit voor de message van de gegooide error, die specifiek zou moeten zijn.
        if (err && err.message) {
          globalMessage = err.message;
        } else if (err && err.code && gm[err.code]) {
          // Fallback naar een gemapte code als err.message ontbreekt maar err.code wel bestaat.
          globalMessage = gm[err.code];
        } else {
          // Laatste fallback naar een generieke melding.
          globalMessage = gm.DEFAULT_API_ERROR || 'Er is iets misgegaan. Probeer het later opnieuw.';
        }
      } finally {
        if (submitBtn) hideLoader(submitBtn); // Verberg loader altijd.
        
        // Schakel velden weer in als er een API error was, of als de API call niet succesvol was
        // EN de velden niet expliciet disabled moeten blijven na een (mislukte) poging.
        // Dit voorkomt dat velden disabled blijven bij een onverwachte fout.
        if (isApiError || (apiResult && apiResult.success === false)) {
          // Alleen enablen als disableFieldsOnSuccess niet specifiek true is voor het hele formulier.
          // Als disableFieldsOnSuccess een array is, is het gedrag complexer en wordt het hier niet volledig afgehandeld
          // voor het error geval; de focus ligt op het enablen bij een duidelijke error.
          if (this.schema.submit.disableFieldsOnSuccess !== true) {
            toggleFields(this.formElement, Object.keys(this.schema.fields), undefined, false);
          }
        } else if (apiResult && apiResult.success !== false) {
          // Als het succesvol was, is de field toggle logica al afgehandeld in de try block.
        } else {
          // Onverwachte situatie, voor de zekerheid velden enablen als ze niet expliciet disabled moeten zijn.
           if (this.schema.submit.disableFieldsOnSuccess !== true) {
            toggleFields(this.formElement, Object.keys(this.schema.fields), undefined, false);
          }
        }
      }
    } else {
      // Geen API call gedefinieerd in schema.
      globalMessage = this.schema.globalMessages?.success || 'Formulier succesvol verwerkt (geen API call).';
      console.log(`[FormHandler] Formulier ${this.schema.name} verwerkt (geen API call).`);
    }

    // Toon de globale boodschap (succes of fout).
    clearGlobalError(this.formElement);
    if (globalMessage) {
      const isSuccessMessage = (apiResult && apiResult.success !== false && !isApiError);
      showGlobalError(this.formElement, globalMessage, isSuccessMessage ? 'success' : 'error');
    }

    // Update de status van de submit knop.
    if (submitBtn) {
      const shouldDisableAfterSuccess = this.schema.submit?.disableButtonOnSuccess === true;
      if (apiResult && apiResult.success !== false && shouldDisableAfterSuccess) {
        toggleButton(submitBtn, false); // Disable na succes indien geconfigureerd.
      } else if (isApiError || (apiResult && apiResult.success === false)) {
        toggleButton(submitBtn, true); // Houd knop enabled bij fout, zodat gebruiker opnieuw kan proberen.
        this.updateSubmitState(); // Her-evalueer op basis van huidige data (kan weer disablen als form ongeldig is).
      } else {
        // Algemeen geval: update op basis van huidige validiteit.
        this.updateSubmitState();
      }
    }

    // Eventueel formulier resetten na succesvolle submit.
    if (apiResult && apiResult.success !== false && !isApiError && this.schema.resetFormOnSuccess) {
      console.log(`[FormHandler] Formulier ${this.schema.name} resetten na succesvolle submit.`);
      this.formElement.reset();
      Object.keys(this.formData).forEach(key => {
        const fieldSchema = this.schema.fields[key];
        this.formData[key] = fieldSchema?.defaultValue ?? '';
        if (this.formState[key]) this.formState[key].isTouched = false;
      });
      clearErrors(this.formElement);
      if (Object.values(this.schema.fields).some(f => f.persist === 'form')) {
        clearFormData(this.schema.name);
      }
      this.updateSubmitState();
    }
  },
};
