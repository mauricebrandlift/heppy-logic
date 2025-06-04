// public/forms/logic/formTriggers.js

import { fetchAddressDetails } from '../../utils/api/index.js';

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
      
      const addressDetails = await fetchAddressDetails(postcode, huisnummer);
      
      if (!addressDetails || !addressDetails.straat || !addressDetails.plaats) {
        console.warn('[formTriggers] Geen volledige adresgegevens ontvangen', addressDetails);
        // Toon een globale foutmelding
        const errorContainer = formElement.querySelector('[data-error-for="global"]');
        if (errorContainer) {
          errorContainer.textContent = 'Geen geldig adres gevonden. Controleer postcode en huisnummer.';
          errorContainer.style.display = 'block';
        }
        return;
      }
      
      // Als het adres succesvol is opgehaald, verwijder eventuele foutmelding
      const errorContainer = formElement.querySelector('[data-error-for="global"]');
      if (errorContainer) {
        errorContainer.textContent = '';
        errorContainer.style.display = 'none';
      }
      
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
      
    } catch (error) {
      console.error('[formTriggers] Fout bij ophalen adresgegevens:', error);
      // Toon een foutmelding
      const errorContainer = formElement.querySelector('[data-error-for="global"]');
      if (errorContainer) {
        errorContainer.textContent = 'Er is een fout opgetreden bij het ophalen van het adres.';
        errorContainer.style.display = 'block';
      }
    }
  }

  /**
   * Event handler met debounce voor input events
   */
  function handleFieldInput() {
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
