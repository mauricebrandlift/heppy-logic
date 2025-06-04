// public/forms/logic/formTriggers.js

import { fetchAddressDetails } from '../../utils/api/index.js';
import { showError, hideError, isErrorVisible } from '../ui/formUi.js';
import { saveGlobalFieldData, saveFlowData, loadFlowData } from './formStorage.js';
import { API_CONFIG } from '../../config/apiConfig.js';

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
    if (event && event.target) {
      const inputField = event.target;
      const fieldWrapper = inputField.closest('.form-field-wrapper');
      
      if (fieldWrapper) {
        fieldWrapper.classList.remove('has-error');
      }
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
    // Call without creating a synthetic event, just need to trigger the address lookup
    handleFieldInput(null);
  }
  
  // Return cleanup function
  return function cleanup() {
    postcodeInput.removeEventListener('input', handleFieldInput);
    huisnummerInput.removeEventListener('input', handleFieldInput);
    clearTimeout(debounceTimeout);
  };
}

/**
 * Houdt de status van de prijsconfiguratie bij
 * Deze wordt eenmalig opgehaald van de API en daarna hergebruikt
 */
const pricingConfigState = {
  config: {
    timePerM2: null,       // minuten per 10m2
    timePerToilet: null,   // minuten per toilet
    timePerBathroom: null, // minuten per badkamer
    pricePerHour: null,    // prijs per uur
    minHours: 3            // minimum aantal uren per schoonmaak
  },
  isLoading: false,        // flag voor het laden van de prijsconfiguratie
  isLoaded: false          // flag voor het checken of de prijsconfiguratie is geladen
};

/**
 * Haalt de prijsconfiguratie op van de backend API
 * @returns {Promise<boolean>} true als het ophalen is gelukt, false als er een fout optrad
 */
async function fetchPricingConfiguration() {
  if (pricingConfigState.isLoading) {
    return new Promise(resolve => {
      // Als de configuratie al wordt opgehaald, wacht dan tot het klaar is
      const checkInterval = setInterval(() => {
        if (!pricingConfigState.isLoading) {
          clearInterval(checkInterval);
          resolve(pricingConfigState.isLoaded);
        }
      }, 100);
    });
  }
  
  if (pricingConfigState.isLoaded) {
    return true;
  }
  
  pricingConfigState.isLoading = true;
  
  try {
    console.log('[formTriggers] Ophalen prijsconfiguratie...');
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PRICING}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`);
    }
    
    const data = await response.json();
    console.log('[formTriggers] Prijsconfiguratie opgehaald:', data);
    
    // Verwerk de data uit de database
    if (Array.isArray(data.pricing) && data.pricing.length > 0) {
      data.pricing.forEach(item => {
        const configKey = item.config_key;
        const configValue = parseFloat(item.config_value);
        
        switch(configKey) {
          case 'timePerM2':
            pricingConfigState.config.timePerM2 = configValue;
            break;
          case 'timePerToilet':
            pricingConfigState.config.timePerToilet = configValue;
            break;
          case 'timePerBathroom':
            pricingConfigState.config.timePerBathroom = configValue;
            break;
          case 'pricePerHour':
            pricingConfigState.config.pricePerHour = configValue;
            break;
          case 'minHours':
            if (configValue > 0) {
              pricingConfigState.config.minHours = configValue;
            }
            break;
        }
      });
      
      pricingConfigState.isLoaded = true;
      console.log('[formTriggers] Prijsconfiguratie verwerkt:', pricingConfigState.config);
      return true;
    } else {
      console.error('[formTriggers] Geen geldige prijsconfiguratie gevonden in de API respons');
      return false;
    }
  } catch (error) {
    console.error('[formTriggers] Fout bij ophalen prijsconfiguratie:', error);
    return false;
  } finally {
    pricingConfigState.isLoading = false;
  }
}

/**
 * Bereken de uren op basis van de invoergegevens en prijsconfiguratie
 * @param {number} m2 - Aantal vierkante meters
 * @param {number} toilets - Aantal toiletten
 * @param {number} bathrooms - Aantal badkamers
 * @returns {number} - Berekende uren (niet afgerond)
 */
function calculateHours(m2, toilets, bathrooms) {
  // Bereken totale minuten
  const m2Minutes = (m2 / 10) * (pricingConfigState.config.timePerM2 || 0);
  const toiletMinutes = toilets * (pricingConfigState.config.timePerToilet || 0);
  const bathroomMinutes = bathrooms * (pricingConfigState.config.timePerBathroom || 0);
  
  const totalMinutes = m2Minutes + toiletMinutes + bathroomMinutes;
  const hours = totalMinutes / 60;
  
  console.log(`[formTriggers] Berekening: ${m2}m² (${m2Minutes}min) + ${toilets} toiletten (${toiletMinutes}min) + ${bathrooms} badkamers (${bathroomMinutes}min) = ${totalMinutes}min = ${hours}u`);
  
  return hours;
}

/**
 * Rond uren af naar boven naar het dichtstbijzijnde halve uur, met een minimum
 * @param {number} hours - Onafgeronde uren
 * @returns {number} - Afgeronde uren (minimum 3, afgerond naar boven per half uur)
 */
function roundHoursUp(hours) {
  // Minimum van 3 uur (of de waarde uit de configuratie)
  const minHours = pricingConfigState.config.minHours || 3;
  
  if (hours <= 0) return minHours;
  
  // Rond af naar boven naar het dichtstbijzijnde halve uur
  const roundedHours = Math.ceil(hours * 2) / 2;
  
  // Zorg ervoor dat het resultaat niet lager is dan het minimum
  return Math.max(roundedHours, minHours);
}

/**
 * Bereken de prijs op basis van de afgeronde uren en het uurtarief
 * @param {number} hours - Afgeronde uren
 * @returns {number} - Berekende prijs
 */
function calculatePrice(hours) {
  return hours * (pricingConfigState.config.pricePerHour || 0);
}

/**
 * Trigger voor het berekenen van schoonmaakuren en -kosten
 * op basis van oppervlakte, aantal toiletten en badkamers.
 * 
 * Deze trigger:
 * - Berekent het aantal benodigde uren
 * - Past afrondingsregels toe (minimum 3 uur, afronden naar boven per half uur)
 * - Berekent de prijs op basis van de afgeronde uren
 * - Update de weergavevelden in het formulier
 * 
 * @param {Object} formHandler - De formHandler instantie
 * @param {Object} options - Configuratie opties
 * @param {string} options.m2Field - Naam van het oppervlakte veld (default: 'abb_m2')
 * @param {string} options.toiletsField - Naam van het toiletten veld (default: 'abb_toiletten')
 * @param {string} options.bathroomsField - Naam van het badkamers veld (default: 'abb_badkamers')
 * @param {string} options.hoursDisplay - Data-attribuut voor het uren weergaveveld (default: 'calculate_form_abb_uren')
 * @param {string} options.priceDisplay - Data-attribuut voor het prijs weergaveveld (default: 'calculate_form_abb_prijs')
 * @param {string} options.hoursUpButton - Data-attribuut voor de uren verhogen knop (default: 'uren_up')
 * @param {string} options.hoursDownButton - Data-attribuut voor de uren verlagen knop (default: 'uren_down')
 * @returns {Function} Cleanup functie om event listeners te verwijderen
 */
export function initHoursCalculationTrigger(formHandler, options = {}) {
  const config = {
    m2Field: 'abb_m2',
    toiletsField: 'abb_toiletten',
    bathroomsField: 'abb_badkamers',
    hoursDisplay: 'calculate_form_abb_uren',
    priceDisplay: 'calculate_form_abb_prijs',
    hoursUpButton: 'uren_up',
    hoursDownButton: 'uren_down',
    ...options
  };
  
  // Houdt de huidige berekende waarden bij
  const calculation = {
    hours: 0,              // berekende uren
    adjustedHours: 0,      // afgeronde uren (minimum 3, afgerond naar boven per half uur)
    price: 0               // berekende prijs
  };

  const formElement = formHandler.formElement;
  if (!formElement) {
    console.error('[formTriggers] Geen formulierelement gevonden in formHandler');
    return () => {}; // Noop cleanup function
  }

  // Haal velden op
  const m2Input = formElement.querySelector(`[data-field-name="${config.m2Field}"]`);
  const toiletsInput = formElement.querySelector(`[data-field-name="${config.toiletsField}"]`);
  const bathroomsInput = formElement.querySelector(`[data-field-name="${config.bathroomsField}"]`);
  
  // Haal weergavevelden op
  const hoursDisplay = formElement.querySelector(`[data-field-total="${config.hoursDisplay}"]`);
  const priceDisplay = formElement.querySelector(`[data-field-total="${config.priceDisplay}"]`);
  
  // Haal knoppen op
  const hoursUpButton = formElement.querySelector(`[data-btn="${config.hoursUpButton}"]`);
  const hoursDownButton = formElement.querySelector(`[data-btn="${config.hoursDownButton}"]`);

  // Controleer of de benodigde velden aanwezig zijn
  if (!m2Input || !toiletsInput || !bathroomsInput) {
    console.error('[formTriggers] Kon invoervelden niet vinden voor berekening schoonmaakuren');
    return () => {};
  }
  
  if (!hoursDisplay || !priceDisplay) {
    console.warn('[formTriggers] Weergavevelden voor uren of prijs niet gevonden');
  }

  let debounceTimeout = null;

  /**
   * Update de UI met de berekende waarden
   */
  function updateCalculationUI() {
    // Update uren weergave
    if (hoursDisplay) {
      hoursDisplay.textContent = `${calculation.adjustedHours} uur`;
    }
    
    // Update prijs weergave
    if (priceDisplay) {
      priceDisplay.textContent = `€ ${calculation.price.toFixed(2).replace('.', ',')}`;
    }
      // Sla de berekende waarden op voor gebruik in volgende stappen
    const flowData = loadFlowData('abonnement-aanvraag') || {};
    
    // Update de flow data met de berekende waarden
    flowData.abb_uren = calculation.adjustedHours.toString();
    flowData.abb_prijs = calculation.price.toFixed(2);
    
    saveFlowData('abonnement-aanvraag', flowData);
    
    // Voor backward compatibility, sla ook op in de global field data
    saveGlobalFieldData('abb_uren', calculation.adjustedHours.toString());
    saveGlobalFieldData('abb_prijs', calculation.price.toFixed(2));
  }

  /**
   * Voer de berekeningen uit op basis van de formuliergegevens
   */
  async function performCalculations() {
    // Zorg ervoor dat we de prijsconfiguratie hebben
    if (!pricingConfigState.isLoaded) {
      const success = await fetchPricingConfiguration();
      if (!success) {
        console.error('[formTriggers] Kon berekening niet uitvoeren: prijsconfiguratie niet beschikbaar');
        return;
      }
    }
    
    // Haal de waarden op
    const m2 = parseInt(m2Input.value) || 0;
    const toilets = parseInt(toiletsInput.value) || 0;
    const bathrooms = parseInt(bathroomsInput.value) || 0;
    
    // Bereken uren
    const calculatedHours = calculateHours(m2, toilets, bathrooms);
    calculation.hours = calculatedHours;
    
    // Rond uren af naar boven (minimum 3 uur, per half uur)
    calculation.adjustedHours = roundHoursUp(calculatedHours);
    
    // Bereken prijs
    calculation.price = calculatePrice(calculation.adjustedHours);
    
    // Update de UI
    updateCalculationUI();
  }

  /**
   * Event handler voor veranderingen in de inputvelden
   */
  function handleFieldInput() {
    // Voer berekeningen uit met debounce om overmatige berekeningen te voorkomen
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(performCalculations, 300);
  }
  
  /**
   * Setup voor uren +/- knoppen
   */
  function setupHourButtons() {
    if (hoursUpButton) {
      hoursUpButton.addEventListener('click', function(e) {
        e.preventDefault();
        
        // Verhoog de uren met een half uur
        calculation.adjustedHours += 0.5;
        
        // Update de prijs
        calculation.price = calculatePrice(calculation.adjustedHours);
        
        // Update de UI
        updateCalculationUI();
      });
    }
    
    if (hoursDownButton) {
      hoursDownButton.addEventListener('click', function(e) {
        e.preventDefault();
        
        // Minimum van 3 uur of de berekende uren als die hoger zijn
        const minHours = Math.max(pricingConfigState.config.minHours || 3, calculation.hours);
        
        // Als we al op het minimum zitten, doe niets
        if (calculation.adjustedHours <= minHours) {
          return;
        }
        
        // Verlaag de uren met een half uur, maar niet onder het minimum
        calculation.adjustedHours = Math.max(calculation.adjustedHours - 0.5, minHours);
        
        // Update de prijs
        calculation.price = calculatePrice(calculation.adjustedHours);
        
        // Update de UI
        updateCalculationUI();
      });
    }
  }

  // Bind event listeners
  m2Input.addEventListener('input', handleFieldInput);
  toiletsInput.addEventListener('input', handleFieldInput);
  bathroomsInput.addEventListener('input', handleFieldInput);
  
  // Set up the hour buttons
  setupHourButtons();
  
  // Voer initiële berekening uit als er al waarden zijn
  if (m2Input.value || toiletsInput.value || bathroomsInput.value) {
    performCalculations();
  }

  // Return cleanup functie
  return () => {
    m2Input.removeEventListener('input', handleFieldInput);
    toiletsInput.removeEventListener('input', handleFieldInput);
    bathroomsInput.removeEventListener('input', handleFieldInput);
    clearTimeout(debounceTimeout);
    
    // Verwijder click events van knoppen
    if (hoursUpButton) {
      hoursUpButton.replaceWith(hoursUpButton.cloneNode(true));
    }
    if (hoursDownButton) {
      hoursDownButton.replaceWith(hoursDownButton.cloneNode(true));
    }
  };
}
