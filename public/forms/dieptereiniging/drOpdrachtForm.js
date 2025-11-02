// public/forms/dieptereiniging/drOpdrachtForm.js
// Formulier handling voor stap 2 van de dieptereiniging aanvraag: opdracht details

import { formHandler } from '../logic/formHandler.js';
import { getFormSchema } from '../schemas/formSchemas.js';
import { saveFlowData, loadFlowData } from '../logic/formStorage.js';
import { showError, hideError, showFieldErrors } from '../ui/formUi.js';
import { logStepCompleted } from '../../utils/tracking/simpleFunnelTracker.js';
import { fetchPricingConfiguration } from '../../utils/api/index.js';

const FORM_NAME = 'dr_opdracht-form';
const NEXT_FORM_NAME = 'dr_persoonsgegevens-form';

// Spoed constanten
const SPOED_TOESLAG = 100; // €100 extra bij spoed
const MIN_DAGEN_VOORUIT = 2; // Minimaal 2 dagen vooruit
const SPOED_DREMPEL_DAGEN = 7; // < 7 dagen = spoed
const MAX_DAGEN_VOORUIT = 90; // Maximaal 3 maanden (90 dagen)

// Prijsconfiguratie object (wordt gevuld via API)
const pricingConfig = {
  timePerM2: null,       // minuten per 10m2
  timePerToilet: null,   // minuten per toilet
  timePerBathroom: null, // minuten per badkamer
  pricePerHour: null,    // prijs per uur
  minHours: 3,           // minimum aantal uren
  isLoading: false,
  isLoaded: false
};

// Huidige berekening
const calculation = {
  hours: 0,              // onafgeronde uren
  adjustedHours: 0,      // afgeronde uren (gebruiker kan aanpassen)
  minAllowedHours: 0,    // minimum uren op basis van berekening
  basisPrijs: 0,
  spoedToeslag: 0,
  totaalPrijs: 0,
  isSpoed: false,
  dagenVooruit: 0
};

function goToFormStep(nextFormName) {
  console.log('[drOpdrachtForm] goToFormStep →', nextFormName);
  if (window.navigateToFormStep) {
    const navigated = window.navigateToFormStep(FORM_NAME, nextFormName);
    if (navigated) {
      console.log('[drOpdrachtForm] navigateToFormStep succesvol', nextFormName);
      return true;
    }
    console.warn('[drOpdrachtForm] navigateToFormStep kon niet navigeren, probeer fallback.');
  }

  if (window.jumpToSlideByFormName) {
    console.log('[drOpdrachtForm] Fallback jumpToSlideByFormName', nextFormName);
    window.jumpToSlideByFormName(nextFormName);
    return true;
  }

  if (window.moveToNextSlide) {
    console.log('[drOpdrachtForm] Fallback moveToNextSlide (geen target match)');
    window.moveToNextSlide();
    return true;
  }

  console.error('[drOpdrachtForm] Geen slider navigatie functie gevonden.');
  return false;
}

/**
 * Haal de prijsconfiguratie op van de backend API
 */
async function getPricingConfiguration() {
  if (pricingConfig.isLoading || pricingConfig.isLoaded) {
    return pricingConfig.isLoaded;
  }
  
  pricingConfig.isLoading = true;
  
  try {
    console.log('🔄 [drOpdrachtForm] Ophalen prijsconfiguratie via API client...');
    const result = await fetchPricingConfiguration('dieptereiniging');
    const data = result;
    
    console.log('✅ [drOpdrachtForm] Prijsconfiguratie opgehaald:', data);
    
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
      console.log('✅ [drOpdrachtForm] Prijsconfiguratie verwerkt:', {
        timePerM2: pricingConfig.timePerM2,
        timePerToilet: pricingConfig.timePerToilet,
        timePerBathroom: pricingConfig.timePerBathroom,
        pricePerHour: pricingConfig.pricePerHour,
        minHours: pricingConfig.minHours
      });
      return true;
    } else {
      console.error('❌ [drOpdrachtForm] Geen geldige prijsconfiguratie gevonden in de API respons');
      return false;
    }
  } catch (error) {
    console.error('❌ [drOpdrachtForm] Fout bij ophalen prijsconfiguratie:', error);
    return false;
  } finally {
    pricingConfig.isLoading = false;
  }
}

/**
 * Bereken aantal dagen tussen vandaag en gekozen datum
 */
function berekenDagenVooruit(datumString) {
  if (!datumString) return 0;
  
  const vandaag = new Date();
  vandaag.setHours(0, 0, 0, 0);
  
  const gekozenDatum = new Date(datumString);
  gekozenDatum.setHours(0, 0, 0, 0);
  
  const verschilMs = gekozenDatum - vandaag;
  const dagen = Math.floor(verschilMs / (1000 * 60 * 60 * 24));
  
  console.log(`[drOpdrachtForm] Datum check: ${datumString} = ${dagen} dagen vooruit`);
  
  return dagen;
}

/**
 * Valideer of gekozen datum binnen toegestane bereik valt
 */
function valideerDatum(datumString, formElement = null, showUI = true) {
  if (!datumString) {
    return { valid: false, error: 'Kies een datum' };
  }
  
  const dagen = berekenDagenVooruit(datumString);
  
  console.log(`[drOpdrachtForm] Valideer datum: ${datumString}, dagen: ${dagen}, min: ${MIN_DAGEN_VOORUIT}, max: ${MAX_DAGEN_VOORUIT}`);
  
  const datumField = formElement?.querySelector('[data-field-name="dr_datum"]');
  const errorContainer = formElement?.querySelector('[data-error-for="dr_datum"]');
  
  if (dagen < MIN_DAGEN_VOORUIT) {
    const error = `Kies een datum minimaal ${MIN_DAGEN_VOORUIT} dagen vooruit. We hebben tijd nodig om een schoonmaker in te plannen.`;
    console.log('❌ [drOpdrachtForm] Datum te vroeg:', error);
    
    if (showUI && errorContainer) {
      showFieldErrors(formElement, 'dr_datum', error);
      datumField?.classList.add('input-error');
    }
    
    return { valid: false, error, dagen };
  }
  
  if (dagen > MAX_DAGEN_VOORUIT) {
    const error = `Je kunt maximaal ${MAX_DAGEN_VOORUIT} dagen (3 maanden) vooruit plannen.`;
    console.log('❌ [drOpdrachtForm] Datum te ver:', error);
    
    if (showUI && errorContainer) {
      showFieldErrors(formElement, 'dr_datum', error);
      datumField?.classList.add('input-error');
    }
    
    return { valid: false, error, dagen };
  }
  
  // Datum is geldig - verwijder eventuele errors
  if (showUI && errorContainer) {
    hideError(errorContainer);
    datumField?.classList.remove('input-error');
  }
  
  console.log('✅ [drOpdrachtForm] Datum geldig:', dagen, 'dagen');
  
  return { valid: true, dagen };
}

/**
 * Bereken de uren op basis van de invoergegevens
 */
function calculateHours(m2, toilets, bathrooms) {
  const m2Num = parseInt(m2) || 0;
  const toiletsNum = parseInt(toilets) || 0;
  const bathroomsNum = parseInt(bathrooms) || 0;
  
  // Bereken totale minuten
  const m2Minutes = (m2Num / 10) * (pricingConfig.timePerM2 || 0);
  const toiletMinutes = toiletsNum * (pricingConfig.timePerToilet || 0);
  const bathroomMinutes = bathroomsNum * (pricingConfig.timePerBathroom || 0);
  
  const totalMinutes = m2Minutes + toiletMinutes + bathroomMinutes;
  const hours = totalMinutes / 60;
  
  console.log(`🧮 [drOpdrachtForm] Berekening: ${m2Num}m² (${m2Minutes}min) + ${toiletsNum} toiletten (${toiletMinutes}min) + ${bathroomsNum} badkamers (${bathroomMinutes}min) = ${totalMinutes}min = ${hours}u`);
  
  return hours;
}

/**
 * Rond uren af naar boven naar het dichtstbijzijnde halve uur, met een minimum
 */
function roundHoursUp(hours) {
  const minHours = pricingConfig.minHours || 3;
  
  if (hours <= 0) return minHours;
  
  // Rond af naar boven naar het dichtstbijzijnde halve uur
  const roundedHours = Math.ceil(hours * 2) / 2;
  
  // Zorg ervoor dat het resultaat niet lager is dan het minimum
  return Math.max(roundedHours, minHours);
}

/**
 * Formatteer uren voor UI-weergave
 */
function formatHours(hours) {
  if (typeof hours !== 'number' || Number.isNaN(hours)) {
    return '0';
  }

  const normalized = Math.round((hours + Number.EPSILON) * 2) / 2;
  const formatted = normalized % 1 === 0 ? normalized.toFixed(0) : normalized.toFixed(1);
  return formatted.replace('.0', '');
}

/**
 * Bereken de prijs op basis van de afgeronde uren en uurtarief + spoed
 */
function calculatePrice(hours, isSpoed) {
  const basisPrijs = hours * (pricingConfig.pricePerHour || 0);
  const spoedToeslag = isSpoed ? SPOED_TOESLAG : 0;
  const totaalPrijs = basisPrijs + spoedToeslag;
  
  return { basisPrijs, spoedToeslag, totaalPrijs };
}

/**
 * Normaliseer naar halve uren stappen
 */
function normaliseHalfStep(val) {
  return Math.round((val + Number.EPSILON) * 2) / 2;
}

/**
 * Update de UI met de berekende waarden
 */
function updateCalculationUI(formElement) {
  if (!formElement) return;
  
  // Update uren weergave
  const urenField = formElement.querySelector('[data-field-total="calculate_form_dr_uren"]');
  if (urenField) {
    urenField.textContent = formatHours(calculation.adjustedHours);
  }
  
  // Update minimum uren weergave
  const minUrenField = formElement.querySelector('[data-field-total="calculate_form__min_dr_uren"]');
  if (minUrenField) {
    const minHoursValue = calculation.minAllowedHours > 0 
      ? calculation.minAllowedHours 
      : roundHoursUp(pricingConfig.minHours || 0);
    minUrenField.textContent = formatHours(minHoursValue);
  }
  
  // Update prijs weergave (ZONDER € teken, want Webflow heeft die al)
  const prijsField = formElement.querySelector('[data-field-total="calculate_form_dr_prijs"]');
  if (prijsField) {
    prijsField.textContent = `${calculation.totaalPrijs.toFixed(2).replace('.', ',')}`;
  }
  
  // Update spoed waarschuwing
  const spoedWarning = formElement.querySelector('[data-spoed-warning="dr_opdracht-form"]');
  if (spoedWarning) {
    if (calculation.isSpoed) {
      spoedWarning.style.display = 'block';
      spoedWarning.innerHTML = `
        <strong>⚡ Spoedopdracht</strong><br>
        Je hebt een datum binnen ${SPOED_DREMPEL_DAGEN} dagen gekozen. 
        We rekenen €${SPOED_TOESLAG} spoedtoeslag om snel een schoonmaker voor je te regelen.
      `;
    } else {
      spoedWarning.style.display = 'none';
      spoedWarning.innerHTML = '';
    }
  }
  
  // Sla de berekende waarden op in flow data
  const flowData = loadFlowData('dieptereiniging-aanvraag') || {};
  flowData.dr_uren = calculation.adjustedHours.toString();
  flowData.dr_prijs = calculation.totaalPrijs.toFixed(2);
  flowData.dr_min_uren = calculation.minAllowedHours.toString();
  flowData.dr_basis_prijs = calculation.basisPrijs.toFixed(2);
  flowData.dr_spoed_toeslag = calculation.spoedToeslag.toFixed(2);
  flowData.is_spoed = calculation.isSpoed;
  
  saveFlowData('dieptereiniging-aanvraag', flowData);
}

/**
 * Voer alle berekeningen uit en update de UI
 */
async function performCalculations(formElement) {
  // Zorg ervoor dat we de prijsconfiguratie hebben
  if (!pricingConfig.isLoaded) {
    const success = await getPricingConfiguration();
    if (!success) {
      console.error('❌ [drOpdrachtForm] Kon berekening niet uitvoeren: prijsconfiguratie niet beschikbaar');
      return;
    }
  }
  
  // Haal waarden op
  const m2 = formElement.querySelector('[data-field-name="dr_m2"]')?.value || 0;
  const toiletten = formElement.querySelector('[data-field-name="dr_toiletten"]')?.value || 0;
  const badkamers = formElement.querySelector('[data-field-name="dr_badkamers"]')?.value || 0;
  const datum = formElement.querySelector('[data-field-name="dr_datum"]')?.value;
  
  console.log('[drOpdrachtForm] Perform calculations:', { m2, toiletten, badkamers, datum });
  
  // Bereken uren
  const calculatedHours = calculateHours(m2, toiletten, badkamers);
  calculation.hours = calculatedHours;
  
  // Rond uren af naar boven (minimum 3 uur, per half uur)
  calculation.adjustedHours = roundHoursUp(calculatedHours);
  calculation.minAllowedHours = calculation.adjustedHours;
  
  // Check spoed status
  let isSpoed = false;
  if (datum) {
    const datumValidatie = valideerDatum(datum, formElement, false); // Geen UI errors tijdens live calc
    if (datumValidatie.valid) {
      calculation.dagenVooruit = datumValidatie.dagen;
      isSpoed = datumValidatie.dagen < SPOED_DREMPEL_DAGEN;
    }
  }
  calculation.isSpoed = isSpoed;
  
  // Bereken prijs
  const prijsBerekening = calculatePrice(calculation.adjustedHours, isSpoed);
  calculation.basisPrijs = prijsBerekening.basisPrijs;
  calculation.spoedToeslag = prijsBerekening.spoedToeslag;
  calculation.totaalPrijs = prijsBerekening.totaalPrijs;
  
  // Update de UI
  updateCalculationUI(formElement);
  
  // Trigger formHandler hervalidatie om submit button te updaten
  if (formHandler.validateForm) {
    setTimeout(() => {
      formHandler.validateForm();
    }, 50);
  }
}

/**
 * Initialiseert het opdracht formulier voor de dieptereiniging aanvraag
 */
export async function initDrOpdrachtForm() {
  console.log('[drOpdrachtForm] Initialiseren van formulier:', FORM_NAME);
  
  // Haal het schema op
  const schema = getFormSchema(FORM_NAME);
  
  // Controleer of schema bestaat
  if (!schema) {
    console.error(`[drOpdrachtForm] Schema '${FORM_NAME}' niet gevonden in formSchemas.js!`);
    return;
  }
  
  // Haal form element op EERST (voor error display)
  const formElement = document.querySelector(schema.selector);
  if (!formElement) {
    console.error('[drOpdrachtForm] Form element niet gevonden!');
    return;
  }
  
  console.log('[drOpdrachtForm] Formulier gevonden, ophalen prijsconfiguratie...');
  
  // Haal de prijsconfiguratie op
  const success = await getPricingConfiguration();
  if (!success) {
    console.error('❌ [drOpdrachtForm] Kan formulier niet initialiseren: prijsconfiguratie ophalen mislukt');
    // Toon error aan gebruiker
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'background: #fee; border: 1px solid #c00; color: #c00; padding: 1rem; border-radius: 4px; margin-bottom: 1rem;';
    errorDiv.textContent = 'Er ging iets mis bij het laden van de prijsinformatie. Probeer de pagina opnieuw te laden.';
    formElement.prepend(errorDiv);
    return;
  }
  
  console.log('✅ [drOpdrachtForm] Prijsconfiguratie geladen, koppelen event handlers...');
  
  // Laad eventueel bestaande flow data
  const flowData = loadFlowData('dieptereiniging-aanvraag');
  console.log('[drOpdrachtForm] Bestaande flow data:', flowData);
  
  // Definieer de submit actie
  schema.submit = {
    action: async (formData) => {
      console.log('[drOpdrachtForm] Submit action gestart met formData:', formData);
      
      const { dr_datum, dr_m2, dr_toiletten, dr_badkamers } = formData;
      
      // Valideer datum met UI feedback
      const datumValidatie = valideerDatum(dr_datum, formElement, true);
      if (!datumValidatie.valid) {
        const error = new Error(datumValidatie.error);
        error.code = 'INVALID_DATE';
        error.fieldName = 'dr_datum';
        throw error;
      }
      
      // Check of alle velden ingevuld zijn
      if (!dr_m2 || !dr_toiletten || !dr_badkamers) {
        const error = new Error('Vul alle velden in om door te gaan.');
        error.code = 'INCOMPLETE_FORM';
        throw error;
      }
      
      // Gebruik de huidige calculation waarden (al berekend tijdens input)
      // Sla alles op in flow data
      const updatedFlowData = loadFlowData('dieptereiniging-aanvraag') || {};
      updatedFlowData.dr_datum = dr_datum;
      updatedFlowData.dr_m2 = dr_m2;
      updatedFlowData.dr_toiletten = dr_toiletten;
      updatedFlowData.dr_badkamers = dr_badkamers;
      updatedFlowData.dr_uren = calculation.adjustedHours.toString();
      updatedFlowData.dr_basis_prijs = calculation.basisPrijs.toFixed(2);
      updatedFlowData.dr_spoed_toeslag = calculation.spoedToeslag.toFixed(2);
      updatedFlowData.dr_totaal_prijs = calculation.totaalPrijs.toFixed(2);
      updatedFlowData.is_spoed = calculation.isSpoed;
      updatedFlowData.dagen_vooruit = datumValidatie.dagen;
      
      saveFlowData('dieptereiniging-aanvraag', updatedFlowData);
      
      console.log('[drOpdrachtForm] Flow data opgeslagen:', updatedFlowData);
      
      // 🎯 TRACK STEP COMPLETION
      logStepCompleted('dieptereiniging', 'opdracht', 2, {
        datum: dr_datum,
        m2: dr_m2,
        toiletten: dr_toiletten,
        badkamers: dr_badkamers,
        uren: calculation.adjustedHours,
        prijs: calculation.totaalPrijs,
        is_spoed: calculation.isSpoed
      }).catch(err => console.warn('[drOpdrachtForm] Tracking failed:', err));
    },
    
    onSuccess: () => {
      console.log('[drOpdrachtForm] Submit succesvol, navigeer naar volgende stap');
      
      // Navigeer naar volgende stap
      goToFormStep(NEXT_FORM_NAME);
    }
  };
  
  // Initialiseer de formHandler met het bijgewerkte schema
  formHandler.init(schema);
  
  // Haal input velden op
  const m2Input = formElement.querySelector('[data-field-name="dr_m2"]');
  const toilettenInput = formElement.querySelector('[data-field-name="dr_toiletten"]');
  const badkamersInput = formElement.querySelector('[data-field-name="dr_badkamers"]');
  const datumInput = formElement.querySelector('[data-field-name="dr_datum"]');
  
  console.log('[drOpdrachtForm] Input elements gevonden:', {
    m2Input: !!m2Input,
    toilettenInput: !!toilettenInput,
    badkamersInput: !!badkamersInput,
    datumInput: !!datumInput
  });
  
  // Event listeners voor live berekeningen
  [m2Input, toilettenInput, badkamersInput].forEach(input => {
    if (input) {
      input.addEventListener('input', () => {
        console.log(`[drOpdrachtForm] Input gewijzigd: ${input.dataset.fieldName} = ${input.value}`);
        
        // Update formHandler data
        if (formHandler.formData) {
          formHandler.formData[input.dataset.fieldName] = input.value;
        }
        
        performCalculations(formElement);
      });
    }
  });
  
  // Speciale behandeling voor datum veld (validatie + spoed check)
  if (datumInput) {
    const handleDatumChange = async () => {
      const datum = datumInput.value;
      console.log(`[drOpdrachtForm] Datum change event: ${datum}`);
      
      // Update formHandler data DIRECT
      if (formHandler.formData) {
        formHandler.formData.dr_datum = datum;
        console.log('[drOpdrachtForm] formHandler.formData.dr_datum updated:', datum);
      }
      
      if (datum) {
        const validatie = valideerDatum(datum, formElement, true); // showUI = true
        
        if (validatie.valid) {
          // Update berekeningen (voor spoed check)
          await performCalculations(formElement);
        }
      }
    };
    
    // Luister naar BEIDE events (Webflow kan input of change gebruiken)
    datumInput.addEventListener('change', handleDatumChange);
    datumInput.addEventListener('input', handleDatumChange);
    
    console.log('[drOpdrachtForm] Datum event listeners toegevoegd aan:', datumInput);
  } else {
    console.warn('[drOpdrachtForm] ⚠️ Datum input niet gevonden!');
  }
  
  // Uren +/- buttons
  const increaseBtn = formElement.querySelector('[data-btn="uren_up"]');
  const decreaseBtn = formElement.querySelector('[data-btn="uren_down"]');
  
  if (increaseBtn) {
    increaseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('[drOpdrachtForm] Uren verhogen (+0.5)');
      
      calculation.adjustedHours = normaliseHalfStep(calculation.adjustedHours + 0.5);
      
      // Herbereken prijs met nieuwe uren
      const prijsBerekening = calculatePrice(calculation.adjustedHours, calculation.isSpoed);
      calculation.basisPrijs = prijsBerekening.basisPrijs;
      calculation.spoedToeslag = prijsBerekening.spoedToeslag;
      calculation.totaalPrijs = prijsBerekening.totaalPrijs;
      
      updateCalculationUI(formElement);
    });
  }
  
  if (decreaseBtn) {
    decreaseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('[drOpdrachtForm] Uren verlagen (-0.5)');
      
      const minHours = calculation.minAllowedHours > 0 
        ? calculation.minAllowedHours 
        : (pricingConfig.minHours || 3);
      
      const nextValue = normaliseHalfStep(calculation.adjustedHours - 0.5);
      calculation.adjustedHours = Math.max(nextValue, minHours);
      
      console.log(`[drOpdrachtForm] Nieuwe uren: ${calculation.adjustedHours} (min: ${minHours})`);
      
      // Herbereken prijs met nieuwe uren
      const prijsBerekening = calculatePrice(calculation.adjustedHours, calculation.isSpoed);
      calculation.basisPrijs = prijsBerekening.basisPrijs;
      calculation.spoedToeslag = prijsBerekening.spoedToeslag;
      calculation.totaalPrijs = prijsBerekening.totaalPrijs;
      
      updateCalculationUI(formElement);
    });
  }
  
  // Herstel vorige invoer als die er is (bijv. na terug navigeren)
  if (flowData && (flowData.dr_m2 || flowData.dr_toiletten || flowData.dr_badkamers)) {
    console.log('[drOpdrachtForm] Herstellen vorige invoer:', flowData);
    
    if (m2Input && flowData.dr_m2) m2Input.value = flowData.dr_m2;
    if (toilettenInput && flowData.dr_toiletten) toilettenInput.value = flowData.dr_toiletten;
    if (badkamersInput && flowData.dr_badkamers) badkamersInput.value = flowData.dr_badkamers;
    if (datumInput && flowData.dr_datum) datumInput.value = flowData.dr_datum;
    
    // Update formHandler.formData
    if (flowData.dr_m2) formHandler.formData.dr_m2 = flowData.dr_m2;
    if (flowData.dr_toiletten) formHandler.formData.dr_toiletten = flowData.dr_toiletten;
    if (flowData.dr_badkamers) formHandler.formData.dr_badkamers = flowData.dr_badkamers;
    if (flowData.dr_datum) formHandler.formData.dr_datum = flowData.dr_datum;
    
    // Trigger initiële berekening
    await performCalculations(formElement);
  } else {
    // Toon standaard minimum uren als er nog geen invoer is
    const minUrenField = formElement.querySelector('[data-field-total="calculate_form__min_dr_uren"]');
    if (minUrenField) {
      minUrenField.textContent = formatHours(pricingConfig.minHours || 3);
    }
  }
  
  console.log(`✅ [drOpdrachtForm] Formulier '${FORM_NAME}' is succesvol geïnitialiseerd.`);
}
