// public/forms/logic/formTriggers.js

import { fetchAddressDetails } from '../../utils/api/index.js';
import { showError, hideError, isErrorVisible } from '../ui/formUi.js';

/**
 * Verzameling van herbruikbare formulier triggers.
 * Deze triggers kunnen worden gebruikt in meerdere formulieren
 * voor consistente functionaliteit.
 */

/**
 * Trigger voor het automatisch ophalen en invullen van adresgegevens
 * wanneer postcode en huisnummer zijn ingevuld.
 * 
 * @param {Object} formHandler - De formHandler instantie met toegang tot formulierelementen en data
 * @param {Object} options - Configuratie opties voor de trigger
 * @param {string} options.postcodeField - Naam van het postcode veld (default: 'postcode')
 * @param {string} options.huisnummerField - Naam van het huisnummer veld (default: 'huisnummer')
 * @param {string} options.straatField - Naam van het straat veld (default: 'straatnaam')
 * @param {string} options.plaatsField - Naam van het plaats veld (default: 'plaats')
 * @returns {Function} Cleanup functie om event listeners te verwijderen
 */
export function initAddressLookupTrigger(formHandler, options = {}) {
  const config = {
    postcodeField: 'postcode',
    huisnummerField: 'huisnummer',
    straatField: 'straatnaam',
    plaatsField: 'plaats',
    ...options
  };

  const formElement = formHandler.formElement;
  if (!formElement) {
    console.error('[formTriggers] Geen formulierelement gevonden in formHandler');
    return () => {}; // Noop cleanup function
  }

  // Haal velden op
  const postcodeInput = formElement.querySelector(`[data-field-name="${config.postcodeField}"]`);
  const huisnummerInput = formElement.querySelector(`[data-field-name="${config.huisnummerField}"]`);
  const straatInput = formElement.querySelector(`[data-field-name="${config.straatField}"]`);
  const plaatsInput = formElement.querySelector(`[data-field-name="${config.plaatsField}"]`);

  if (!postcodeInput || !huisnummerInput) {
    console.error('[formTriggers] Kon postcode of huisnummer invoervelden niet vinden');
    return () => {};
  }
  if (!straatInput || !plaatsInput) {
    console.error('[formTriggers] Kon straat of plaats invoervelden niet vinden');
    return () => {};
  }

  let debounceTimeout = null;
  let lastProcessedValues = { postcode: '', huisnummer: '' };

  /**
   * Kijkt of de huidige waarden van postcode en huisnummer valide zijn
   * volgens de validators in het schema
   */
  function areFieldsValid(postcode, huisnummer) {
    const schema = formHandler.schema;
    if (!schema || !schema.fields) return false;

    const postcodeField = schema.fields[config.postcodeField];
    const huisnummerField = schema.fields[config.huisnummerField];

    if (!postcodeField || !postcodeField.validators) return false;
    if (!huisnummerField || !huisnummerField.validators) return false;

    // Controleer of 'required' validators aanwezig zijn en of ze slagen
    for (const validator of postcodeField.validators) {
      if (typeof validator === 'string' && validator === 'postcode') {
        // Eenvoudige postcode validatie (moet verfijnd worden als de echte validator complexer is)
        const postcodeRegex = /^[1-9][0-9]{3}\s?[a-zA-Z]{2}$/;
        if (!postcodeRegex.test(postcode)) return false;
      }
    }

    for (const validator of huisnummerField.validators) {
      if (typeof validator === 'string' && validator === 'required') {
        if (!huisnummer.trim()) return false;
      }
    }

    return true;
  }

  /**
   * Haalt adresgegevens op en vult de formuliervelden in
   */
  async function lookupAndFillAddress() {
    const postcode = postcodeInput.value.trim();
    const huisnummer = huisnummerInput.value.trim();

    // Voorkom onnodige API calls als de waarden niet zijn veranderd
    if (
      postcode === lastProcessedValues.postcode && 
      huisnummer === lastProcessedValues.huisnummer
    ) {
      return;
    }
    
    // Controleer of de waarden valide zijn volgens schema validators
    if (!areFieldsValid(postcode, huisnummer)) {
      return;
    }

    lastProcessedValues = { postcode, huisnummer };
    
    try {
      console.log('[formTriggers] Adres ophalen voor:', { postcode, huisnummer });
      
      const addressDetails = await fetchAddressDetails(postcode, huisnummer);        if (!addressDetails || !addressDetails.straat || !addressDetails.plaats) {
        console.warn('[formTriggers] Geen volledige adresgegevens ontvangen', addressDetails);
        
        // Maak straat en plaats velden leeg
        straatInput.value = '';
        plaatsInput.value = '';
        
        // Update ook formHandler.formData indien beschikbaar
        if (formHandler.formData) {
          formHandler.formData[config.straatField] = '';
          formHandler.formData[config.plaatsField] = '';
        }
        
        // Trigger change events om andere logica te laten weten dat de velden zijn bijgewerkt
        straatInput.dispatchEvent(new Event('change', { bubbles: true }));
        plaatsInput.dispatchEvent(new Event('change', { bubbles: true }));
          // Toon een gebruiksvriendelijke foutmelding uit de commonMessages
        const errorContainer = formElement.querySelector('[data-error-for="global"]');
        if (errorContainer) {
          // Gebruik de error code ADDRESS_NOT_FOUND die in commonMessages.js gedefinieerd is
          const errorCode = 'ADDRESS_NOT_FOUND';
          let errorMessage = 'Geen geldig adres gevonden. Controleer of uw postcode en huisnummer correct zijn ingevoerd.';// Gebruik de foutmelding uit het schema indien beschikbaar
          if (formHandler.schema && formHandler.schema.globalMessages && formHandler.schema.globalMessages[errorCode]) {
            errorMessage = formHandler.schema.globalMessages[errorCode];
          }
          
          showError(errorContainer, errorMessage);
        }
          // Markeer de velden als foutief voor visuele feedback
        const postcodeContainer = postcodeInput.closest('.form-field-wrapper');
        const huisnummerContainer = huisnummerInput.closest('.form-field-wrapper');
        
        if (postcodeContainer) postcodeContainer.classList.add('has-error');
        if (huisnummerContainer) huisnummerContainer.classList.add('has-error');
        
        // Update submit button status om te voorkomen dat formulier verstuurd kan worden
        formHandler.updateSubmitState();
        
        return;
      }      // Als het adres succesvol is opgehaald, verwijder eventuele foutmeldingen en foutstatussen
      const errorContainer = formElement.querySelector('[data-error-for="global"]');
      if (errorContainer) {
        hideError(errorContainer);
      }
      
      // Verwijder eventuele foutstatussen van de velden
      const postcodeContainer = postcodeInput.closest('.form-field-wrapper');
      const huisnummerContainer = huisnummerInput.closest('.form-field-wrapper');
      
      if (postcodeContainer) postcodeContainer.classList.remove('has-error');
      if (huisnummerContainer) huisnummerContainer.classList.remove('has-error');
      
      console.log('[formTriggers] Adresgegevens ontvangen:', addressDetails);
      
      // Vul de velden in
      straatInput.value = addressDetails.straat;
      plaatsInput.value = addressDetails.plaats;
        // Update formHandler.formData
      if (formHandler.formData) {
        formHandler.formData[config.straatField] = addressDetails.straat;
        formHandler.formData[config.plaatsField] = addressDetails.plaats;
      }
      
      // Trigger change events om andere logica te laten weten dat de velden zijn bijgewerkt
      straatInput.dispatchEvent(new Event('change', { bubbles: true }));
      plaatsInput.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Update submit button status nu de velden zijn ingevuld
      formHandler.updateSubmitState();
        } catch (error) {
      console.error('[formTriggers] Fout bij ophalen adresgegevens:', error);
      
      // Maak straat en plaats velden leeg
      straatInput.value = '';
      plaatsInput.value = '';
      
      // Update ook formHandler.formData indien beschikbaar
      if (formHandler.formData) {
        formHandler.formData[config.straatField] = '';
        formHandler.formData[config.plaatsField] = '';
      }
        // Trigger change events om andere logica te laten weten dat de velden zijn bijgewerkt
      straatInput.dispatchEvent(new Event('change', { bubbles: true }));
      plaatsInput.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Update submit button status om te zorgen dat de knop disabled wordt
      formHandler.updateSubmitState();
      
      // Toon een gebruiksvriendelijke foutmelding gebaseerd op het type fout
      const errorContainer = formElement.querySelector('[data-error-for="global"]');
      if (errorContainer) {
        // Bepaal de juiste error code op basis van de error
        let errorCode = 'API_ERROR';
        
        if (error.status === 404) {
          errorCode = 'ADDRESS_NOT_FOUND';
        } else if (error.status === 400) {
          errorCode = 'INVALID_ADDRESS';
        } else if (error.status >= 500) {
          errorCode = 'SERVER_ERROR';
        } else if (error.name === 'NetworkError' || !navigator.onLine) {
          errorCode = 'NETWORK_ERROR';
        } else if (error.message && error.message.includes('timeout')) {
          errorCode = 'API_TIMEOUT';
        }
        
        // Haal foutmelding op uit schema, of gebruik standaard foutmelding
        let errorMessage = 'Er is een fout opgetreden bij het ophalen van uw adres.';        if (formHandler.schema && formHandler.schema.globalMessages && formHandler.schema.globalMessages[errorCode]) {
          errorMessage = formHandler.schema.globalMessages[errorCode];
        }
        
        showError(errorContainer, errorMessage);
      }
        // Markeer de velden als foutief voor visuele feedback
      const postcodeContainer = postcodeInput.closest('.form-field-wrapper');
      const huisnummerContainer = huisnummerInput.closest('.form-field-wrapper');
      
      if (postcodeContainer) postcodeContainer.classList.add('has-error');
      if (huisnummerContainer) huisnummerContainer.classList.add('has-error');
      
      // Update submit button status om te zorgen dat de knop disabled wordt
      formHandler.updateSubmitState();
    }
  }  /**
   * Event handler met debounce voor input events
   */
  function handleFieldInput(event) {
    // Bij nieuwe input, verwijder foutmeldingen en foutstatussen
    const inputField = event.target;
    const fieldWrapper = inputField.closest('.form-field-wrapper');
    
    if (fieldWrapper) {
      fieldWrapper.classList.remove('has-error');
    }    
    
    // Verberg de globale foutmelding wanneer de gebruiker begint met typen
    const errorContainer = formElement.querySelector('[data-error-for="global"]');
    if (errorContainer && isErrorVisible(errorContainer)) {
      hideError(errorContainer);
    }
    
    // Reset de straat- en plaatsnaam velden als ze bestaan
    if (formHandler.formData) {
      // Als een van de postcode of huisnummer velden is gewijzigd,
      // moeten we de afhankelijke velden ook resetten totdat de API is aangeroepen
      if (formHandler.schema && formHandler.schema.fields) {
        const serverValidatedFields = Object.entries(formHandler.schema.fields)
          .filter(([_, fieldConfig]) => fieldConfig.requiresServerValidation)
          .filter(([_, fieldConfig]) => {
            // Check if this field depends on the changed field
            return fieldConfig.validationDependsOn && 
              (fieldConfig.validationDependsOn.includes('postcode') || 
               fieldConfig.validationDependsOn.includes('huisnummer'));
          })
          .map(([fieldName]) => fieldName);
        
        // Reset all server-validated fields that depend on postcode/huisnummer
        serverValidatedFields.forEach(fieldName => {
          formHandler.formData[fieldName] = '';
          const fieldEl = formElement.querySelector(`[data-field-name="${fieldName}"]`);
          if (fieldEl) fieldEl.value = '';
        });
        
        // Update the submit button status to reflect these changes
        formHandler.updateSubmitState();
      }
    }
    
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(lookupAndFillAddress, 500);
  }
  
  // Voeg event listeners toe
  postcodeInput.addEventListener('input', handleFieldInput);
  huisnummerInput.addEventListener('input', handleFieldInput);
  
  // Als velden al waardes hebben bij initialisatie, probeer direct adres op te halen
  if (postcodeInput.value && huisnummerInput.value) {
    handleFieldInput();
  }
  
  // Return cleanup function
  return function cleanup() {
    postcodeInput.removeEventListener('input', handleFieldInput);
    huisnummerInput.removeEventListener('input', handleFieldInput);
    clearTimeout(debounceTimeout);
  };
}
