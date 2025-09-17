// public/forms/aanvraag/abbOpdrachtForm.js

import { formHandler } from '../logic/formHandler.js';
import { getFormSchema } from '../schemas/formSchemas.js';
import { fetchPricingConfiguration } from '../../utils/api/index.js';
import { saveGlobalFieldData, loadGlobalFieldData, saveFlowData, loadFlowData } from '../logic/formStorage.js';
import { initWeekSelectTrigger } from '../logic/formTriggers.js';
// Import moveToNextSlide van Webflow indien nodig
// In een live omgeving is deze functie waarschijnlijk globaal beschikbaar door Webflow

/**
 * 🧮 Abonnement Opdracht Form - stap 2 van de abonnement aanvraag
 * 
 * Deze module bevat de logica voor het berekenen van schoonmaakuren en kosten
 * op basis van oppervlakte, aantal toiletten en badkamers.
 * 
 * Functionaliteit:
 * - Berekent automatisch uren op basis van invoergegevens
 * - Haalt prijsconfiguratie op van de backend API
 * - Implementeert knoppen om uren handmatig aan te passen
 * - Berekent prijs op basis van uren en uurtarief
 */

// Deze object houdt de actuele prijsconfiguratie bij
const pricingConfig = {
  timePerM2: null,       // minuten per 10m2
  timePerToilet: null,   // minuten per toilet
  timePerBathroom: null, // minuten per badkamer
  pricePerHour: null,    // prijs per uur
  minHours: 3,           // minimum aantal uren per schoonmaak
  isLoading: false,      // flag voor het laden van de prijsconfiguratie
  isLoaded: false        // flag voor het checken of de prijsconfiguratie is geladen
};

// Huidige berekende waarden
const calculation = {
  hours: 0,              // berekende uren
  adjustedHours: 0,      // afgeronde uren (minimum 3, afgerond naar boven per half uur)
  price: 0               // berekende prijs
};

/**
 * Haal de prijsconfiguratie op van de backend API
 * @returns {Promise<boolean>} true als het ophalen is gelukt, false als er een fout optrad
 */
async function getPricingConfiguration() {
  if (pricingConfig.isLoading || pricingConfig.isLoaded) {
    return pricingConfig.isLoaded;
  }
  
  pricingConfig.isLoading = true;
  
  try {
    console.log('🔄 [AbbOpdrachtForm] Ophalen prijsconfiguratie via API client...');
  const result = await fetchPricingConfiguration('abonnement');
    const data = result;
    
    console.log('✅ [AbbOpdrachtForm] Prijsconfiguratie opgehaald:', data);
    
    // Verwerk de data uit de database
    if (Array.isArray(data.pricing) && data.pricing.length > 0) {
      data.pricing.forEach(item => {
        const configKey = item.config_key;
        const configValue = parseFloat(item.config_value);
        
        switch(configKey) {
          case 'timePer10m2':
          case 'timePerM2': 
            pricingConfig.timePerM2 = configValue;
            break;
          case 'timePerToilet':
            pricingConfig.timePerToilet = configValue;
            break;
          case 'timePerBathroom':
            pricingConfig.timePerBathroom = configValue;
            break;
          case 'pricePerHour':
            pricingConfig.pricePerHour = configValue;
            break;
          case 'minHours':
            if (configValue > 0) {
              pricingConfig.minHours = configValue;
            }
            break;
        }
      });
      
      pricingConfig.isLoaded = true;
      console.log('✅ [AbbOpdrachtForm] Prijsconfiguratie verwerkt:', pricingConfig);
      return true;
    } else {
      console.error('❌ [AbbOpdrachtForm] Geen geldige prijsconfiguratie gevonden in de API respons');
      return false;
    }
  } catch (error) {
    console.error('❌ [AbbOpdrachtForm] Fout bij ophalen prijsconfiguratie:', error);
    return false;
  } finally {
    pricingConfig.isLoading = false;
  }
}

/**
 * Bereken de uren op basis van de invoergegevens en prijsconfiguratie
 * @param {object} formData - Formuliergegevens (m2, toiletten, badkamers)
 * @returns {number} - Berekende uren (niet afgerond)
 */
function calculateHours(formData) {
  const m2 = parseInt(formData.abb_m2) || 0;
  const toilets = parseInt(formData.abb_toiletten) || 0;
  const bathrooms = parseInt(formData.abb_badkamers) || 0;
  
  // Bereken totale minuten
  const m2Minutes = (m2 / 10) * (pricingConfig.timePerM2 || 0);
  const toiletMinutes = toilets * (pricingConfig.timePerToilet || 0);
  const bathroomMinutes = bathrooms * (pricingConfig.timePerBathroom || 0);
  
  const totalMinutes = m2Minutes + toiletMinutes + bathroomMinutes;
  const hours = totalMinutes / 60;
  
  console.log(`🧮 [AbbOpdrachtForm] Berekening: ${m2}m² (${m2Minutes}min) + ${toilets} toiletten (${toiletMinutes}min) + ${bathrooms} badkamers (${bathroomMinutes}min) = ${totalMinutes}min = ${hours}u`);
  
  return hours;
}

/**
 * Rond uren af naar boven naar het dichtstbijzijnde halve uur, met een minimum
 * @param {number} hours - Onafgeronde uren
 * @returns {number} - Afgeronde uren (minimum 3, afgerond naar boven per half uur)
 */
function roundHoursUp(hours) {
  // Minimum van 3 uur
  const minHours = pricingConfig.minHours || 3;
  
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
  return hours * (pricingConfig.pricePerHour || 0);
}

/**
 * Update de UI met de berekende waarden
 * @param {Element} formElement - Het formulierelement
 */
function updateCalculationUI(formElement) {
  if (!formElement) return;
  
  // Update uren weergave
  const urenField = formElement.querySelector('[data-field-total="calculate_form_abb_uren"]');
  if (urenField) {
    urenField.textContent = `${calculation.adjustedHours}`;
  }
  
  // Update prijs weergave
  const prijsField = formElement.querySelector('[data-field-total="calculate_form_abb_prijs"]');
  if (prijsField) {
    prijsField.textContent = `${calculation.price.toFixed(2).replace('.', ',')}`;
  }
    // Sla de berekende waarden op voor gebruik in volgende stappen in de flow
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
 * Voer alle berekeningen uit en update de UI
 * @param {object} formData - Formuliergegevens
 * @param {Element} formElement - Het formulierelement
 */
async function performCalculations(formData, formElement) {  // Zorg ervoor dat we de prijsconfiguratie hebben
  if (!pricingConfig.isLoaded) {
    const success = await getPricingConfiguration();
    if (!success) {
      console.error('❌ [AbbOpdrachtForm] Kon berekening niet uitvoeren: prijsconfiguratie niet beschikbaar');
      return;
    }
  }
  
  // Bereken uren
  const calculatedHours = calculateHours(formData);
  calculation.hours = calculatedHours;
  
  // Rond uren af naar boven (minimum 3 uur, per half uur)
  calculation.adjustedHours = roundHoursUp(calculatedHours);
  
  // Bereken prijs
  calculation.price = calculatePrice(calculation.adjustedHours);
  
  // Update de UI
  updateCalculationUI(formElement);
}

/**
 * Implementeert de logica voor de uren +/- knoppen
 * @param {Element} formElement - Het formulierelement
 */
function setupHourButtons(formElement) {
  if (!formElement) return;
  
  // Krijg de knoppen
  const increaseBtn = formElement.querySelector('[data-btn="uren_up"]');
  const decreaseBtn = formElement.querySelector('[data-btn="uren_down"]');
  
  if (increaseBtn) {
    increaseBtn.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Verhoog de uren met een half uur
      calculation.adjustedHours += 0.5;
      
      // Update de prijs
      calculation.price = calculatePrice(calculation.adjustedHours);
      
      // Update de UI
      updateCalculationUI(formElement);
    });
  }
  
  if (decreaseBtn) {
    decreaseBtn.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Minimum van 3 uur of de berekende uren als die hoger zijn
      const minHours = Math.max(pricingConfig.minHours || 3, calculation.hours);
      
      // Als we al op het minimum zitten, doe niets
      if (calculation.adjustedHours <= minHours) {
        return;
      }
      
      // Verlaag de uren met een half uur, maar niet onder het minimum
      calculation.adjustedHours = Math.max(calculation.adjustedHours - 0.5, minHours);
      
      // Update de prijs
      calculation.price = calculatePrice(calculation.adjustedHours);
      
      // Update de UI
      updateCalculationUI(formElement);
    });
  }
}

/**
 * Initialiseer het formulier
 * @param {Element} formElement - Het formulierelement
 */
export async function initAbbOpdrachtForm() {  console.log('🚀 [AbbOpdrachtForm] Initialiseren...');
  
  // Haal prijsconfiguratie op bij het initialiseren
  await getPricingConfiguration();
  
  // Haal het formulierschema op
  const schema = getFormSchema('abb_opdracht-form');
  
  // Voeg berekening trigger toe voor elk veld dat impact heeft op de berekening
  ['abb_m2', 'abb_toiletten', 'abb_badkamers'].forEach(fieldName => {
    if (schema.fields[fieldName]) {
      if (!schema.fields[fieldName].triggers) {
        schema.fields[fieldName].triggers = [];
      }
      
      schema.fields[fieldName].triggers.push({
        when: 'valid',
        action: (formData, handler) => {
          performCalculations(formData, handler.formElement);
        }
      });
    }
  });
    // Voeg submit logica toe aan het schema
  schema.submit = {
    action: async (formData) => {
      // Voer een laatste berekening uit om zeker te zijn van correcte waarden
      await performCalculations(formData, document.querySelector(schema.selector));
      
      // Sla de formuliergegevens op in de flow data
      const flowData = loadFlowData('abonnement-aanvraag') || {};
      
      // Update de flow data met huidige formuliergegevens
      flowData.abb_m2 = formData.abb_m2;
      flowData.abb_toiletten = formData.abb_toiletten;
      flowData.abb_badkamers = formData.abb_badkamers;
      flowData.weeknr = formData.weeknr; // Sla weeknr op in flow data
      
      // Zorg ervoor dat de berekende waarden ook in de flow data worden opgeslagen
      flowData.abb_uren = calculation.adjustedHours.toString();
      flowData.abb_prijs = calculation.price.toFixed(2);
      
      saveFlowData('abonnement-aanvraag', flowData);
      
      // Voor backward compatibility, sla ook op in de global field data
      saveGlobalFieldData('abb_m2', formData.abb_m2);
      saveGlobalFieldData('abb_toiletten', formData.abb_toiletten);
      saveGlobalFieldData('abb_badkamers', formData.abb_badkamers);
      saveGlobalFieldData('weeknr', formData.weeknr); // Sla ook op in global data    },    onSuccess: () => {
      console.log('✅ [AbbOpdrachtForm] Formulier succesvol verwerkt, naar volgende slide...');
      
      // Import en initialiseer de volgende stap: dagdelen & schoonmaker keuze
      import('./abbDagdelenSchoonmakerForm.js').then(module => {
        console.log('[abbOpdrachtForm] Stap 3 (abbDagdelenSchoonmakerForm) wordt geïnitialiseerd...');
        module.initAbbDagdelenSchoonmakerForm();
        moveToNextSlide();
      }).catch(err => {
        console.error('[abbOpdrachtForm] Kon stap 3 niet laden:', err);
        moveToNextSlide();
      });
    }
  };
  
  // Initialiseer de form handler met ons schema
  formHandler.init(schema);
  
  // Initialiseer de weeknummer selector met datumbereik weergave
  initWeekSelectTrigger(formHandler, { weekField: 'weeknr', infoField: 'weeknr' });
  
  // Set up de uren +/- knoppen
  setupHourButtons(document.querySelector(schema.selector));
    // Haal eventuele opgeslagen flow data op
  const flowData = loadFlowData('abonnement-aanvraag') || {};
  
  // Bereid formulierdata voor met waarden uit de flow of uit de velden zelf
  const formData = {};
  const formElement = document.querySelector(schema.selector);
  
  // Controleer elk veld en vul het in met opgeslagen waarden indien beschikbaar
  ['abb_m2', 'abb_toiletten', 'abb_badkamers', 'weeknr'].forEach(key => {
    // Eerst proberen uit flow data te halen
    if (flowData[key]) {
      formData[key] = flowData[key];
      
      // Vul het veld ook in de UI in
      const el = formElement.querySelector(`[data-field-name="${key}"]`);
      if (el) {
        el.value = flowData[key];
      }
    } else {
      // Anders uit het huidige formulier halen
      const el = formElement.querySelector(`[data-field-name="${key}"]`);
      if (el && el.value) {
        formData[key] = el.value;
      }
    }
  });
  
  // Als er voldoende gegevens zijn, voer dan een berekening uit
  if (formData.abb_m2 || formData.abb_toiletten || formData.abb_badkamers) {
    await performCalculations(formData, formElement);
  }
    console.log('✅ [AbbOpdrachtForm] Initialisatie voltooid');
}

// Exporteer eventuele helper functies die publiekelijk gebruikt kunnen worden
export { performCalculations };
