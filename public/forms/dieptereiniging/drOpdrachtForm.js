// public/forms/dieptereiniging/drOpdrachtForm.js
// Formulier handling voor stap 2 van de dieptereiniging aanvraag: opdracht details

import { formHandler } from '../logic/formHandler.js';
import { getFormSchema } from '../schemas/formSchemas.js';
import { saveFlowData, loadFlowData } from '../logic/formStorage.js';
import { showError, hideError } from '../ui/formUi.js';
import { logStepCompleted } from '../../utils/tracking/simpleFunnelTracker.js';

const FORM_NAME = 'dr_opdracht-form';
const NEXT_FORM_NAME = 'dr_persoonsgegevens-form'; // TODO: aanpassen naar juiste volgende stap

// Prijsconstanten - TODO: ophalen van API/env
const PRIJS_PER_UUR = 45; // €45 per uur
const SPOED_TOESLAG = 100; // €100 extra bij spoed
const MIN_DAGEN_VOORUIT = 2; // Minimaal 2 dagen vooruit
const SPOED_DREMPEL_DAGEN = 7; // < 7 dagen = spoed
const MAX_DAGEN_VOORUIT = 90; // Maximaal 3 maanden (90 dagen)

// Berekenin constanten voor uren
const MINUTEN_PER_10M2 = 10; // 10 minuten per 10m2
const MINUTEN_PER_TOILET = 15; // 15 minuten per toilet
const MINUTEN_PER_BADKAMER = 30; // 30 minuten per badkamer
const MIN_UREN = 4; // Minimum 4 uur voor dieptereiniging

// Huidige berekening
const calculation = {
  uren: 0,
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
 * Bereken aantal dagen tussen vandaag en gekozen datum
 */
function berekenDagenVooruit(datumString) {
  if (!datumString) return 0;
  
  const vandaag = new Date();
  vandaag.setHours(0, 0, 0, 0); // Zet tijd op middernacht voor accurate dag vergelijking
  
  const gekozenDatum = new Date(datumString);
  gekozenDatum.setHours(0, 0, 0, 0);
  
  const verschilMs = gekozenDatum - vandaag;
  const dagen = Math.floor(verschilMs / (1000 * 60 * 60 * 24));
  
  return dagen;
}

/**
 * Valideer of gekozen datum binnen toegestane bereik valt
 */
function valideerDatum(datumString) {
  const dagen = berekenDagenVooruit(datumString);
  
  if (dagen < MIN_DAGEN_VOORUIT) {
    return {
      valid: false,
      error: `Kies een datum minimaal ${MIN_DAGEN_VOORUIT} dagen vooruit. We hebben tijd nodig om een schoonmaker in te plannen.`
    };
  }
  
  if (dagen > MAX_DAGEN_VOORUIT) {
    return {
      valid: false,
      error: `Je kunt maximaal ${MAX_DAGEN_VOORUIT} dagen (3 maanden) vooruit plannen.`
    };
  }
  
  return { valid: true, dagen };
}

/**
 * Bereken aantal uren op basis van m2, toiletten en badkamers
 */
function berekenUren(m2, toiletten, badkamers) {
  // Converteer naar nummers en handel edge cases af
  const m2Num = parseInt(m2) || 0;
  const toilettenNum = parseInt(toiletten) || 0;
  const badkamersNum = parseInt(badkamers) || 0;
  
  // Bereken totale minuten
  let totaalMinuten = 0;
  totaalMinuten += (m2Num / 10) * MINUTEN_PER_10M2; // Per 10m2
  totaalMinuten += toilettenNum * MINUTEN_PER_TOILET;
  totaalMinuten += badkamersNum * MINUTEN_PER_BADKAMER;
  
  // Converteer naar uren en rond af naar boven per heel uur
  let uren = Math.ceil(totaalMinuten / 60);
  
  // Minimum uren check
  if (uren < MIN_UREN) {
    uren = MIN_UREN;
  }
  
  console.log(`[drOpdrachtForm] Berekening: ${m2Num}m2 + ${toilettenNum} toiletten + ${badkamersNum} badkamers = ${totaalMinuten} min = ${uren} uur`);
  
  return uren;
}

/**
 * Bereken totaalprijs inclusief spoed toeslag
 */
function berekenPrijs(uren, isSpoed) {
  const basisPrijs = uren * PRIJS_PER_UUR;
  const spoedToeslag = isSpoed ? SPOED_TOESLAG : 0;
  const totaalPrijs = basisPrijs + spoedToeslag;
  
  calculation.uren = uren;
  calculation.basisPrijs = basisPrijs;
  calculation.spoedToeslag = spoedToeslag;
  calculation.totaalPrijs = totaalPrijs;
  calculation.isSpoed = isSpoed;
  
  console.log(`[drOpdrachtForm] Prijs: ${uren}u × €${PRIJS_PER_UUR} = €${basisPrijs}${isSpoed ? ' + €' + SPOED_TOESLAG + ' spoed' : ''} = €${totaalPrijs}`);
  
  return { basisPrijs, spoedToeslag, totaalPrijs };
}

/**
 * Update UI met berekende waarden
 */
function updateBerekeningUI(formElement) {
  // Update uren display
  const urenElement = formElement.querySelector('[data-field-total="calculate_form_dr_uren"]');
  if (urenElement) {
    urenElement.textContent = calculation.uren;
  }
  
  // Update prijs display
  const prijsElement = formElement.querySelector('[data-field-total="calculate_form_dr_prijs"]');
  if (prijsElement) {
    prijsElement.textContent = `€${calculation.totaalPrijs}`;
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
    }
  }
}

/**
 * Handler voor input wijzigingen - herbereken alles
 */
function handleInputChange(formElement) {
  // Haal waarden op
  const m2Input = formElement.querySelector('[data-field-name="dr_m2"]');
  const toilettenInput = formElement.querySelector('[data-field-name="dr_toiletten"]');
  const badkamersInput = formElement.querySelector('[data-field-name="dr_badkamers"]');
  const datumInput = formElement.querySelector('[data-field-name="dr_datum"]');
  
  const m2 = m2Input?.value || 0;
  const toiletten = toilettenInput?.value || 0;
  const badkamers = badkamersInput?.value || 0;
  const datum = datumInput?.value;
  
  // Bereken uren
  const uren = berekenUren(m2, toiletten, badkamers);
  
  // Check spoed status op basis van datum
  let isSpoed = false;
  if (datum) {
    const dagen = berekenDagenVooruit(datum);
    calculation.dagenVooruit = dagen;
    isSpoed = dagen >= MIN_DAGEN_VOORUIT && dagen < SPOED_DREMPEL_DAGEN;
  }
  
  // Bereken prijs
  berekenPrijs(uren, isSpoed);
  
  // Update UI
  updateBerekeningUI(formElement);
}

/**
 * Initialiseert het opdracht formulier voor de dieptereiniging aanvraag.
 */
export function initDrOpdrachtForm() {
  console.log('[drOpdrachtForm] Initialiseren van formulier:', FORM_NAME);
  
  // Haal het schema op
  const schema = getFormSchema(FORM_NAME);
  
  // Controleer of schema bestaat
  if (!schema) {
    console.error(`[drOpdrachtForm] Schema '${FORM_NAME}' niet gevonden in formSchemas.js!`);
    return;
  }
  
  // Laad eventueel bestaande flow data
  const flowData = loadFlowData('dieptereiniging-aanvraag');
  console.log('[drOpdrachtForm] Bestaande flow data:', flowData);
  
  // Definieer de submit actie
  schema.submit = {
    action: async (formData) => {
      console.log('[drOpdrachtForm] Submit action gestart met formData:', formData);
      
      const { dr_datum, dr_m2, dr_toiletten, dr_badkamers } = formData;
      
      // Valideer datum
      const datumValidatie = valideerDatum(dr_datum);
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
      
      // Bereken finale waarden
      const uren = berekenUren(dr_m2, dr_toiletten, dr_badkamers);
      const isSpoed = datumValidatie.dagen < SPOED_DREMPEL_DAGEN;
      const prijsBerekening = berekenPrijs(uren, isSpoed);
      
      // Sla alles op in flow data
      const updatedFlowData = loadFlowData('dieptereiniging-aanvraag') || {};
      updatedFlowData.dr_datum = dr_datum;
      updatedFlowData.dr_m2 = dr_m2;
      updatedFlowData.dr_toiletten = dr_toiletten;
      updatedFlowData.dr_badkamers = dr_badkamers;
      updatedFlowData.uren = uren;
      updatedFlowData.basis_prijs = prijsBerekening.basisPrijs;
      updatedFlowData.spoed_toeslag = prijsBerekening.spoedToeslag;
      updatedFlowData.totaal_prijs = prijsBerekening.totaalPrijs;
      updatedFlowData.is_spoed = isSpoed;
      updatedFlowData.dagen_vooruit = datumValidatie.dagen;
      
      saveFlowData('dieptereiniging-aanvraag', updatedFlowData);
      
      console.log('[drOpdrachtForm] Flow data opgeslagen:', updatedFlowData);
      
      // 🎯 TRACK STEP COMPLETION
      logStepCompleted('dieptereiniging', 'opdracht', 2, {
        datum: dr_datum,
        m2: dr_m2,
        toiletten: dr_toiletten,
        badkamers: dr_badkamers,
        uren,
        prijs: prijsBerekening.totaalPrijs,
        is_spoed: isSpoed
      }).catch(err => console.warn('[drOpdrachtForm] Tracking failed:', err));
    },
    
    onSuccess: () => {
      console.log('[drOpdrachtForm] Submit succesvol, navigeer naar volgende stap');
      
      // Navigeer naar volgende stap (TODO: aanpassen naar juiste stap)
      goToFormStep(NEXT_FORM_NAME);
    }
  };
  
  // Initialiseer de formHandler met het bijgewerkte schema
  formHandler.init(schema);
  
  // Haal form element op
  const formElement = document.querySelector(schema.selector);
  if (!formElement) {
    console.error('[drOpdrachtForm] Form element niet gevonden!');
    return;
  }
  
  // Bind input change events voor real-time berekening
  const inputFields = ['dr_m2', 'dr_toiletten', 'dr_badkamers', 'dr_datum'];
  inputFields.forEach(fieldName => {
    const input = formElement.querySelector(`[data-field-name="${fieldName}"]`);
    if (input) {
      input.addEventListener('input', () => handleInputChange(formElement));
      input.addEventListener('change', () => handleInputChange(formElement));
    }
  });
  
  // Pre-fill formuliervelden als er flowData beschikbaar is
  if (flowData) {
    const m2Field = formElement.querySelector('[data-field-name="dr_m2"]');
    const toilettenField = formElement.querySelector('[data-field-name="dr_toiletten"]');
    const badkamersField = formElement.querySelector('[data-field-name="dr_badkamers"]');
    const datumField = formElement.querySelector('[data-field-name="dr_datum"]');
    
    if (flowData.dr_m2 && m2Field) m2Field.value = flowData.dr_m2;
    if (flowData.dr_toiletten && toilettenField) toilettenField.value = flowData.dr_toiletten;
    if (flowData.dr_badkamers && badkamersField) badkamersField.value = flowData.dr_badkamers;
    if (flowData.dr_datum && datumField) datumField.value = flowData.dr_datum;
    
    // Update ook de formData in de formHandler
    if (flowData.dr_m2) formHandler.formData.dr_m2 = flowData.dr_m2;
    if (flowData.dr_toiletten) formHandler.formData.dr_toiletten = flowData.dr_toiletten;
    if (flowData.dr_badkamers) formHandler.formData.dr_badkamers = flowData.dr_badkamers;
    if (flowData.dr_datum) formHandler.formData.dr_datum = flowData.dr_datum;
    
    // Trigger initiële berekening
    handleInputChange(formElement);
  }
  
  console.log(`[drOpdrachtForm] Formulier '${FORM_NAME}' is succesvol geïnitialiseerd.`);
}
