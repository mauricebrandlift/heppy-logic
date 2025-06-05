// public/forms/logic/dagdelenHelper.js
/**
 * 📅 Helper functies voor het werken met dagdelen
 * ==============================================
 * Bevat utilities voor:
 * - Conversie tussen UI-dagdelen en database formaat
 * - Formatteren van dagdelen voor API aanroepen
 * - Controle van beschikbaarheid tegen dagdeelvoorkeuren
 */

import { debounce } from '../../utils/helpers/asyncUtils.js';

// Constanten voor dagdelen
export const DAGDELEN = {
  OCHTEND: 'ochtend',  // 7:00 - 11:59
  MIDDAG: 'middag',    // 12:00 - 16:59
  AVOND: 'avond'       // 17:00 - 21:59
};

// Tijdsvakken voor dagdelen (voor UI/weergave)
export const TIJDSVAKKEN = {
  [DAGDELEN.OCHTEND]: '07:00 - 12:00',
  [DAGDELEN.MIDDAG]: '12:00 - 17:00',
  [DAGDELEN.AVOND]: '17:00 - 22:00'
};

// Dagen mapping (voor UI/weergave)
export const DAGEN = {
  'ma': 'maandag',
  'di': 'dinsdag',
  'wo': 'woensdag',
  'do': 'donderdag',
  'vr': 'vrijdag',
  'za': 'zaterdag',
  'zo': 'zondag'
};

/**
 * Zet UI dagdeel attributen (data-dagdeel="ma-ochtend") om naar database formaat
 * 
 * @param {Array<string>} uiDagdelen - Array van UI dagdeel strings (bijv. ["ma-ochtend", "di-middag"])
 * @returns {Object} - Object in database formaat: { "maandag": ["ochtend"], "dinsdag": ["middag"] }
 */
export function convertUIDagdelenNaarDB(uiDagdelen) {
  if (!uiDagdelen || !Array.isArray(uiDagdelen) || uiDagdelen.length === 0) {
    return null; // Als er geen dagdelen zijn geselecteerd, return null
  }

  const result = {};

  uiDagdelen.forEach(dagdeelString => {
    // Format is: "ma-ochtend", "di-middag", etc.
    const [dagKort, dagdeel] = dagdeelString.split('-');
    
    if (!dagKort || !dagdeel || !DAGEN[dagKort] || 
        ![DAGDELEN.OCHTEND, DAGDELEN.MIDDAG, DAGDELEN.AVOND].includes(dagdeel)) {
      console.warn(`⚠️ Ongeldig dagdeel format: ${dagdeelString}`);
      return; // Skip deze entry
    }
    
    const volledigeDag = DAGEN[dagKort];
    
    // Voeg toe aan het resultaat
    if (!result[volledigeDag]) {
      result[volledigeDag] = [];
    }
    
    result[volledigeDag].push(dagdeel);
  });

  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Controleert of een beschikbaarheidsblok binnen de gekozen dagdelen valt
 * 
 * @param {string} dag - De dag van het blok ('maandag', 'dinsdag', etc)
 * @param {string} tijd - De tijd van het blok ('09:00', '14:00', etc)
 * @param {Object} dagdelenFilter - De dagdelen filter: { "maandag": ["ochtend"], "dinsdag": ["middag"] }
 * @returns {boolean} - true als het blok binnen de dagdelen valt of als er geen filter is
 */
export function isBeschikbaarheidInDagdeel(dag, tijd, dagdelenFilter) {
  // Als er geen filter is, valt alles binnen de filter
  if (!dagdelenFilter) return true;
  
  // Als deze dag niet in de filter zit, return false
  if (!dagdelenFilter[dag]) return false;
  
  // Bepaal in welk dagdeel deze tijd valt
  const uur = parseInt(tijd.split(':')[0], 10);
  let dagdeel;
  
  if (uur >= 7 && uur < 12) {
    dagdeel = DAGDELEN.OCHTEND;
  } else if (uur >= 12 && uur < 17) {
    dagdeel = DAGDELEN.MIDDAG;
  } else if (uur >= 17 && uur < 22) {
    dagdeel = DAGDELEN.AVOND;
  } else {
    return false; // Buiten reguliere uren
  }
  
  // Check of dit dagdeel in de filter voor deze dag zit
  return dagdelenFilter[dag].includes(dagdeel);
}

/**
 * Verzamelt geselecteerde dagdelen uit checkboxes in een formulier
 * 
 * @param {HTMLFormElement} formElement - Het formulierelement 
 * @returns {Array<string>} - Array van geselecteerde dagdeel strings
 */
export function getSelectedDagdelenFromForm(formElement) {
  if (!formElement) return [];
  
  const dagdeelCheckboxes = formElement.querySelectorAll(
    'input[type="checkbox"][data-field-name="dagdeel"]:checked'
  );
  
  return Array.from(dagdeelCheckboxes).map(checkbox => checkbox.getAttribute('data-dagdeel'))
    .filter(Boolean); // Filter out nulls/undefined
}

/**
 * Gedebouncede functie voor het ophalen van schoonmakers bij wijziging van dagdelen
 * 
 * @param {Function} fetchFunctie - De functie die wordt aangeroepen na debouncing
 * @param {number} wachtTijd - De wachttijd in ms voor debouncing
 * @returns {Function} De gedebouncede versie van de functie
 */
export const debouncedDagdelenUpdate = (fetchFunctie, wachtTijd = 400) => debounce(fetchFunctie, wachtTijd);

/**
 * Format beschikbaarheid van een schoonmaker voor weergave in de UI
 * Vernieuwd om beschikbaarheid per uur weer te geven, van 7:00 tot 22:00
 * 
 * @param {Array} beschikbaarheid - Beschikbaarheids array van schoonmaker
 * @param {Object} dagdelenFilter - Optionele filter om alleen bepaalde dagdelen te tonen
 * @returns {Object} - Gedetailleerde beschikbaarheid per dag met status per uur
 */
export function formateerBeschikbaarheid(beschikbaarheid, dagdelenFilter = null) {
  if (!Array.isArray(beschikbaarheid)) {
    return {};
  }
  
  // Definieer alle uren van de dag die we willen weergeven (7:00 - 22:00)
  const alleUren = [];
  for (let i = 7; i <= 22; i++) {
    alleUren.push(`${i.toString().padStart(2, '0')}:00`);
  }
  
  // Initialize resultaat structuur met alle dagen en uren
  const dagVolgorde = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'];
  const resultaat = dagVolgorde.map(dag => {
    // Maak een object voor deze dag met elk uur als 'niet-beschikbaar'
    return {
      dag,
      uurBlokken: alleUren.map(uur => ({
        uur,
        status: 'niet-beschikbaar'
      }))
    };
  });
  
  // Verwerk de beschikbare tijdslots
  beschikbaarheid.forEach(slot => {
    const { dag, uur, status } = slot;
    
    // Als er een filter is, check of deze beschikbaarheid daarin valt
    if (dagdelenFilter && !isBeschikbaarheidInDagdeel(dag, uur, dagdelenFilter)) {
      return;
    }
    
    // Vind de dag in het resultaat
    const dagIndex = dagVolgorde.indexOf(dag);
    if (dagIndex === -1) return;
    
    // Vind het uur voor deze dag
    const uurIndex = alleUren.indexOf(uur);
    if (uurIndex === -1) return;
    
    // Update de status voor dit uur
    resultaat[dagIndex].uurBlokken[uurIndex].status = status;
  });
  
  // Voeg dagdelen classificatie toe en groepeer per dagdeel
  resultaat.forEach(dagItem => {
    // Voeg classificatie toe voor elk uur
    dagItem.uurBlokken.forEach(uurBlok => {
      const uur = parseInt(uurBlok.uur.split(':')[0], 10);
      
      // Classificeer het uur in een dagdeel
      if (uur >= 7 && uur < 12) {
        uurBlok.dagdeel = DAGDELEN.OCHTEND;
      } else if (uur >= 12 && uur < 17) {
        uurBlok.dagdeel = DAGDELEN.MIDDAG;
      } else if (uur >= 17 && uur < 22) {
        uurBlok.dagdeel = DAGDELEN.AVOND;
      }
    });
    
    // Bereken beschikbaarheid per dagdeel
    dagItem.dagdelen = {};
    [DAGDELEN.OCHTEND, DAGDELEN.MIDDAG, DAGDELEN.AVOND].forEach(dagdeel => {
      const urenInDagdeel = dagItem.uurBlokken.filter(uurBlok => uurBlok.dagdeel === dagdeel);
      const beschikbareUren = urenInDagdeel.filter(uurBlok => uurBlok.status === 'beschikbaar').length;
      
      dagItem.dagdelen[dagdeel] = {
        totaalUren: urenInDagdeel.length,
        beschikbareUren: beschikbareUren,
        volledigBeschikbaar: beschikbareUren === urenInDagdeel.length,
        deelsBeschikbaar: beschikbareUren > 0 && beschikbareUren < urenInDagdeel.length,
        nietBeschikbaar: beschikbareUren === 0
      };
    });
  });
  
  return resultaat;
}
