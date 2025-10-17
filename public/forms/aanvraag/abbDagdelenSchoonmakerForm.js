// public/forms/aanvraag/abbDagdelenSchoonmakerForm.js
/**
 * 👥 Stap 3: Abonnement Dagdelen en Schoonmaker Keuze Formulier
 * ===========================================================
 * Dit formulier laat gebruikers voorkeursdagdelen selecteren en een schoonmaker kiezen
 */

import { formHandler } from '../logic/formHandler.js';
import { getFormSchema } from '../schemas/formSchemas.js';
import { saveFlowData, loadFlowData, saveGlobalFieldData } from '../logic/formStorage.js';
import { fetchAvailableCleaners } from '../../utils/api/cleaners.js';
import { verwerkSchoonmakers } from '../../utils/helpers/schoonmakerUtils.js';
import {
  convertUIDagdelenNaarDB,
  getSelectedDagdelenFromForm,
  debouncedDagdelenUpdate,
  formateerBeschikbaarheid,
  DAGEN,
  DAGDELEN,
  TIJDSVAKKEN
} from '../logic/dagdelenHelper.js';

const FORM_NAME = 'abb_dagdelen-schoonmaker-form';
const FORM_SELECTOR = `[data-form-name="${FORM_NAME}"]`;
const NEXT_FORM_NAME = 'abb_overzicht-form';

function goToFormStep(nextFormName) {
  console.log('[AbbDagdelenSchoonmakerForm] goToFormStep →', nextFormName);
  if (window.navigateToFormStep) {
    const navigated = window.navigateToFormStep(FORM_NAME, nextFormName);
    if (navigated) {
      console.log('[AbbDagdelenSchoonmakerForm] navigateToFormStep succesvol', nextFormName);
      return true;
    }
    console.warn('[AbbDagdelenSchoonmakerForm] navigateToFormStep kon niet navigeren, probeer fallback.');
  }

  if (window.jumpToSlideByFormName) {
    console.log('[AbbDagdelenSchoonmakerForm] Fallback jumpToSlideByFormName', nextFormName);
    window.jumpToSlideByFormName(nextFormName);
    return true;
  }

  if (window.moveToNextSlide) {
    console.log('[AbbDagdelenSchoonmakerForm] Fallback moveToNextSlide (geen target match)');
    window.moveToNextSlide();
    return true;
  }

  console.error('[AbbDagdelenSchoonmakerForm] Geen slider navigatie functie gevonden.');
  return false;
}

// Status object voor dit formulier
const formStatus = {
  isLoading: false,
  schoonmakersWrapper: null, // [data-element="schoonmakers-list"]
  schoonmakerTemplate: null,
  schoonmakerPrototype: null,
  totaalSchoonmakers: 0,
  totaalElement: null,        // [data-element="schoonmakers-total"]
  geenVoorkeurElement: null,  // [data-element="schoonmakers-geen-voorkeur"]
  emptyElement: null          // [data-element="schoonmakers-empty"]
};

/**
 * Verbergt de globale foutmelding
 */
function hideErrorMessage() {
  // Zoek specifiek binnen het huidige formulier naar het error element
  const formElement = document.querySelector(FORM_SELECTOR);
  if (!formElement) return;
  
  const errorElement = formElement.querySelector('[data-error-for="global"]');
  if (errorElement) {
    errorElement.classList.add('hide');
    errorElement.textContent = '';
  }
}

/**
 * Toont een foutmelding in het globale error element
 * @param {string} message - De foutmelding om te tonen
 * @param {string} type - Type fout (error, warning, info)
 */
function showErrorMessage(message, type = 'error') {
  // Zoek specifiek binnen het huidige formulier naar het error element
  const formElement = document.querySelector(FORM_SELECTOR);
  if (!formElement) return;
  
  const errorElement = formElement.querySelector('[data-error-for="global"]');
  if (!errorElement) return;
  
  errorElement.textContent = message;
  errorElement.classList.remove('hide');
  
  // Optioneel: voeg CSS klasse toe op basis van type
  errorElement.className = `error-message ${type}`;
}

/**
 * Toont een laad-indicator
 * @param {boolean} isLoading - Of geladen wordt
 */
function updateLoadingState(isLoading) {
  formStatus.isLoading = isLoading;
  
  // Vind de spinner en content container
  const loadingSpinner = document.querySelector('[data-loading-spinner="schoonmakers"]');
  const contentContainer = document.querySelector('[data-schoonmakers-container]');
  
  // Toon of verberg de spinner door de hide class toe te voegen of te verwijderen
  if (loadingSpinner) {
    if (isLoading) {
      loadingSpinner.classList.remove('hide');
    } else {
      loadingSpinner.classList.add('hide');
    }
  }
  
  // Update de opacity en interactie van de content container
  if (contentContainer) {
    contentContainer.style.opacity = isLoading ? '0.6' : '1';
    contentContainer.style.pointerEvents = isLoading ? 'none' : 'auto';
  }
  
  // Verberg eventuele foutmeldingen bij het starten van een nieuwe laadactie
  if (isLoading) {
    hideErrorMessage();
  }
}

function resetRadioState(container, contextLabel = '') {
  if (!container) return;

  const radio = container.querySelector('input[type="radio"]');
  const label = radio ? radio.closest('label, .w-radio') : null;
  const redirectedTargets = container.querySelectorAll('.w--redirected-checked, .w--redirected-focus');
  const isCheckedTargets = container.querySelectorAll('.is-checked');

  const beforeState = {
    context: contextLabel,
    containerClasses: container ? Array.from(container.classList || []) : [],
    labelClasses: label ? Array.from(label.classList || []) : [],
    radioChecked: radio ? radio.checked : null,
    radioAriaChecked: radio ? radio.getAttribute('aria-checked') : null,
    labelAriaChecked: label ? label.getAttribute('aria-checked') : null,
  };

  console.debug('[SchoonmakerForm] Reset radio state - before', beforeState);

  if (radio) {
    radio.checked = false;
    radio.removeAttribute('checked');
    radio.defaultChecked = false;
    radio.setAttribute('aria-checked', 'false');
    radio.dispatchEvent(new Event('change', { bubbles: true }));
  }

  const targets = [container, label].filter(Boolean);

  targets.forEach((el) => {
    el.classList.remove('w--redirected-checked', 'w--redirected-focus');
    el.classList.remove('is-checked');
    if (el.hasAttribute('aria-checked')) {
      el.setAttribute('aria-checked', 'false');
    }
    if (el.hasAttribute('aria-selected')) {
      el.setAttribute('aria-selected', 'false');
    }
  });

  redirectedTargets.forEach((el) => {
    el.classList.remove('w--redirected-checked', 'w--redirected-focus');
    if (el.hasAttribute('aria-checked')) {
      el.setAttribute('aria-checked', 'false');
    }
    if (el.hasAttribute('aria-selected')) {
      el.setAttribute('aria-selected', 'false');
    }
  });

  isCheckedTargets.forEach((el) => {
    el.classList.remove('is-checked');
  });

  const afterState = {
    context: contextLabel,
    containerClasses: container ? Array.from(container.classList || []) : [],
    labelClasses: label ? Array.from(label.classList || []) : [],
    radioChecked: radio ? radio.checked : null,
    radioAriaChecked: radio ? radio.getAttribute('aria-checked') : null,
    labelAriaChecked: label ? label.getAttribute('aria-checked') : null,
  };

  console.debug('[SchoonmakerForm] Reset radio state - after', afterState);
}

/**
 * Rendert een schoonmaker in de UI met geavanceerde beschikbaarheidsweergave
 * 
 * @param {Object} schoonmaker - Schoonmaker data
 * @param {Object} dagdelenFilter - Optionele filter voor beschikbaarheid 
 * @returns {HTMLElement} - Het schoonmaker element
 */
function renderSchoonmaker(schoonmaker, dagdelenFilter = null) {
  const sourceTemplate = formStatus.schoonmakerPrototype || formStatus.schoonmakerTemplate;
  if (!sourceTemplate) {
    console.error('❌ [SchoonmakerForm] Geen schoonmaker template beschikbaar om te klonen');
    return null;
  }
  
  // Kloon het template
  const schoonmakerEl = sourceTemplate.cloneNode(true);
  schoonmakerEl.style.display = 'block'; // Maak zichtbaar

  resetRadioState(schoonmakerEl, 'clone');
  
  // Voeg id toe als waarde voor de radio button
  const radioEl = schoonmakerEl.querySelector('input[type="radio"]');
  if (radioEl) {
    radioEl.value = schoonmaker.schoonmaker_id;
    
    // Voeg attributen toe volgens form schema
    radioEl.setAttribute('data-field-name', 'schoonmakerKeuze');
    radioEl.name = 'schoonmakerKeuze';
  // Zorg dat template 'checked' niet per ongeluk overerft
  radioEl.checked = false;
  radioEl.removeAttribute('checked');
  }
  
  // Vul schoonmaker data in met de nieuwe data-schoonmaker attributen
  // Toon alleen voornaam op basis van data-schoonmaker="naam"
  const naamEl = schoonmakerEl.querySelector('[data-schoonmaker="naam"]');
  if (naamEl) {
    naamEl.textContent = schoonmaker.voornaam;
  }
  
  // Plaats op basis van data-schoonmaker="plaats"
  const plaatsEl = schoonmakerEl.querySelector('[data-schoonmaker="plaats"]');
  if (plaatsEl) {
    plaatsEl.textContent = schoonmaker.plaats;
  }
  
  // Profielfoto op basis van data-schoonmaker="foto"
  const fotoEl = schoonmakerEl.querySelector('[data-schoonmaker="foto"]');
  if (fotoEl && schoonmaker.profielfoto) {
    fotoEl.src = schoonmaker.profielfoto;
    fotoEl.alt = `Foto van ${schoonmaker.voornaam}`;
  }
  
  // Vul schoonmaker profiel data in met de data-schoonmaker-profile attributen
  // Naam voor profiel, alleen voornaam
  const profielNaamEl = schoonmakerEl.querySelector('[data-schoonmaker-profile="naam"]');
  if (profielNaamEl) {
    profielNaamEl.textContent = schoonmaker.voornaam;
  }
  
  // Plaats voor profiel
  const profielPlaatsEl = schoonmakerEl.querySelector('[data-schoonmaker-profile="plaats"]');
  if (profielPlaatsEl) {
    profielPlaatsEl.textContent = schoonmaker.plaats;
  }
  
  // Profielfoto voor profiel
  const profielFotoEl = schoonmakerEl.querySelector('[data-schoonmaker-profile="foto"]');
  if (profielFotoEl && schoonmaker.profielfoto) {
    profielFotoEl.src = schoonmaker.profielfoto;
    profielFotoEl.alt = `Foto van ${schoonmaker.voornaam}`;
  }
  
  // Beschikbaarheid
  const beschikbaarheidContainer = schoonmakerEl.querySelector('[data-schoonmaker-profile="beschikbaarheid-wrapper"]');
  if (beschikbaarheidContainer && schoonmaker.beschikbaarheid) {
    const beschikbaarheid = formateerBeschikbaarheid(schoonmaker.beschikbaarheid, dagdelenFilter);
    
    // Leeg de container eerst
    beschikbaarheidContainer.innerHTML = '';
    
    // Maak beschikbaarheid items voor elke dag
    beschikbaarheid.forEach(dagItem => {
      const { dag, dagdelen, uurBlokken } = dagItem;
      
      // Maak een dag-element voor elk beschikbaarheid-item
      const dagElement = document.createElement('div');
      dagElement.setAttribute('data-schoonmaker-profile', 'beschikbaarheid-item');
      dagElement.setAttribute('data-dag', dag);
      
      // Voeg de dag naam toe
      const dagNaamElement = document.createElement('div');
      dagNaamElement.className = 'dag-naam';
      dagNaamElement.textContent = dag;
      dagElement.appendChild(dagNaamElement);
      
      // Maak een container voor uur items
      const urenContainer = document.createElement('div');
      urenContainer.className = 'uren-container';
      
      // Maak uur items van 7:00 tot 22:00
      for (let uur = 7; uur <= 22; uur++) {
        const uurFormatted = `${uur.toString().padStart(2, '0')}:00`;
        
        // Vind of dit uur beschikbaar is
        const uurInfo = uurBlokken.find(blok => blok.uur === uurFormatted);
        const isBeschikbaar = uurInfo && uurInfo.status === 'beschikbaar';
        
        // Maak uur item
        const uurItem = document.createElement('div');
        uurItem.setAttribute('data-schoonmaker', 'uur-item');
        
        // Voeg uur text toe
        const uurText = document.createElement('span');
        uurText.setAttribute('data-schoonmaker', 'uur-text');
        uurText.textContent = uurFormatted;
        uurItem.appendChild(uurText);
        
        // Voeg beschikbaarheidsblok toe
        const uurBlock = document.createElement('span');
        uurBlock.setAttribute('data-schoonmaker', 'uur-block');
        uurBlock.className = isBeschikbaar ? 'beschikbaar' : 'niet-beschikbaar';
        uurItem.appendChild(uurBlock);
        
        urenContainer.appendChild(uurItem);
      }
      
      dagElement.appendChild(urenContainer);
      beschikbaarheidContainer.appendChild(dagElement);    });
  }
  
  // Nieuwe dagdeel weergave (7 kolommen x 3 dagdelen structuur)
  // Regel: Een dagdeel is 'available' als er voldoende aaneengesloten uren zijn binnen dat dagdeel OF
  // een aaneengesloten blok dat dit dagdeel raakt en samen met aansluitend volgend dagdeel de benodigde uren dekt.
  try {
    const requiredHoursRaw = (loadFlowData && loadFlowData('abonnement-aanvraag') || {}).abb_uren;
    const requiredHours = parseFloat(requiredHoursRaw) || 0; // fallback 0 => geen speciale highlight
    if (Array.isArray(schoonmaker.beschikbaarheid)) {
      const daypartAvailability = berekenDagdeelBeschikbaarheid(schoonmaker.beschikbaarheid, requiredHours);
      const daypartElems = schoonmakerEl.querySelectorAll('[data-field-name="schoonmaker-dagdeel"]');
      daypartElems.forEach(el => {
        const key = el.getAttribute('data-schoonmaker-dagdeel'); // bv ma-ochtend
        const isAvailable = !!daypartAvailability[key];
        // Vind child wrappers
        const availEl = el.querySelector('.beschikbaarheid_item_check-wrp.is-available');
        const unavailEl = el.querySelector('.beschikbaarheid_item_check-wrp.is-unavalable, .beschikbaarheid_item_check-wrp.is-unavailable');
        if (availEl) availEl.style.display = isAvailable ? 'flex' : 'none';
        if (unavailEl) unavailEl.style.display = isAvailable ? 'none' : 'flex';
      });
    }
  } catch (e) {
    console.warn('[SchoonmakerForm] Kon dagdeel beschikbaarheid niet renderen:', e);
  }
  
  return schoonmakerEl;
}

/**
 * Berekent dagdeel beschikbaarheid op basis van ruwe beschikbaarheidsuren.
 * verwacht slots: [{ dag: 'maandag', uur: '09:00', status: 'beschikbaar' }, ...]
 * @param {Array} slots
 * @param {number} requiredHours
 * @returns {Object} mapping 'ma-ochtend' => boolean
 */
function berekenDagdeelBeschikbaarheid(slots, requiredHours) {
  const result = {};
  if (!Array.isArray(slots) || slots.length === 0) return result;
  // Define day short codes mapping consistent with dagdelenHelper.js
  const dayMap = { maandag: 'ma', dinsdag: 'di', woensdag: 'wo', donderdag: 'do', vrijdag: 'vr', zaterdag: 'za', zondag: 'zo' };
  // Daypart hour ranges (start inclusive, end exclusive) in hours
  const dayparts = [
    { code: 'ochtend', start: 7, end: 12 },
    { code: 'middag', start: 12, end: 17 },
    { code: 'avond', start: 17, end: 22 }
  ];
  // Groepeer beschikbaar uren per dag
  const byDay = {};
  slots.forEach(s => {
    if (s.status !== 'beschikbaar') return;
    const h = parseInt(String(s.uur).split(':')[0], 10);
    if (isNaN(h)) return;
    if (!byDay[s.dag]) byDay[s.dag] = new Set();
    byDay[s.dag].add(h);
  });
  // Helper om aaneengesloten blokken te vinden
  function contiguousBlocks(hourSet) {
    const hours = Array.from(hourSet).sort((a,b)=>a-b);
    const blocks = [];
    let start = null, prev = null;
    hours.forEach(h => {
      if (start === null) { start = h; prev = h; return; }
      if (h === prev + 1) { prev = h; return; }
      blocks.push({ start, end: prev + 1, length: (prev + 1) - start }); // end exclusive
      start = h; prev = h;
    });
    if (start !== null) blocks.push({ start, end: prev + 1, length: (prev + 1) - start });
    return blocks;
  }
  Object.entries(byDay).forEach(([dag, hourSet]) => {
    const blocks = contiguousBlocks(hourSet);
    dayparts.forEach((dp, idx) => {
      const key = `${dayMap[dag] || ''}-${dp.code}`;
      let available = false;
      if (requiredHours <= 0) {
        // markeer dagdeel beschikbaar als er minimaal 1 uur aanwezig is in range
        available = blocks.some(b => Math.max(b.start, dp.start) < Math.min(b.end, dp.end));
      } else {
        // 1) Block binnen dagdeel genoeg?
        available = blocks.some(b => {
          const overlap = Math.max(0, Math.min(b.end, dp.end) - Math.max(b.start, dp.start));
          return overlap >= requiredHours;
        });
        // 2) Contigue blok dat dagdeel raakt én totale bloklengte >= requiredHours
        if (!available) {
          available = blocks.some(b => {
            const overlaps = Math.max(b.start, dp.start) < Math.min(b.end, dp.end);
            return overlaps && b.length >= requiredHours;
          });
        }
        // 3) Combinatie met volgend dagdeel: een blok dat beide dagdelen raakt en totale overlap >= requiredHours
        if (!available && idx < dayparts.length - 1) {
          const next = dayparts[idx + 1];
            available = blocks.some(b => {
              const overlapCombined = Math.max(0, Math.min(b.end, next.end) - Math.max(b.start, dp.start));
              // Vereist dat blok start vóór einde huidige dagdeel en eind na start volgend dagdeel
              const spans = b.start < dp.end && b.end > next.start;
              return spans && overlapCombined >= requiredHours;
            });
        }
      }
      result[key] = available;
    });
  });
  return result;
}

/**
 * Rendert alle schoonmakers in de UI
 * 
 * @param {Array} schoonmakers - Array van schoonmaker objecten
 * @param {Object} filterDagdelen - Optioneel filter voor dagdelen
 */
function renderSchoonmakers(schoonmakers, filterDagdelen = null) {
  if (!formStatus.schoonmakersWrapper) {
    console.error('❌ [SchoonmakerForm] Geen schoonmakers list container gevonden');
    return;
  }

  // Reset list
  formStatus.schoonmakersWrapper.innerHTML = '';
  formStatus.totaalSchoonmakers = schoonmakers.length;

  // Update total element (buiten de lijst)
  if (formStatus.totaalElement) {
    if (schoonmakers.length > 0) {
      formStatus.totaalElement.style.display = '';
      formStatus.totaalElement.textContent = `${schoonmakers.length} ${schoonmakers.length === 1 ? 'schoonmaker' : 'schoonmakers'} beschikbaar`;
    } else {
      formStatus.totaalElement.style.display = 'none';
      formStatus.totaalElement.textContent = '';
    }
  }

  // Geen voorkeur element tonen / verbergen
  if (formStatus.geenVoorkeurElement) {
    formStatus.geenVoorkeurElement.style.display = schoonmakers.length > 0 ? '' : 'none';
  }

  // Leeg melding element
  if (formStatus.emptyElement) {
    if (schoonmakers.length === 0) {
      formStatus.emptyElement.style.display = '';
    } else {
      formStatus.emptyElement.style.display = 'none';
    }
  }

  if (schoonmakers.length === 0) return; // niets verder renderen

  // Render schoonmakers
  schoonmakers.forEach(schoonmaker => {
    const schoonmakerEl = renderSchoonmaker(schoonmaker, filterDagdelen);
    if (schoonmakerEl) {
      formStatus.schoonmakersWrapper.appendChild(schoonmakerEl);
      initBeschikbaarheidsToggle(schoonmakerEl);
    }
  });
}

/**
 * Bind change-events voor dynamisch gerenderde schoonmaker radio's zodat
 * formHandler validatie en submit-state correct worden geüpdatet.
 * @param {HTMLFormElement} formElement
 */
function bindSchoonmakerRadioEvents(formElement) {
  if (!formElement) return;
  const radios = formElement.querySelectorAll('input[type="radio"][name="schoonmakerKeuze"]');
  radios.forEach((radio) => {
    if (radio.dataset.bound === '1') return; // dubbele binding voorkomen
    radio.addEventListener('change', (e) => {
      try {
        if (formHandler && typeof formHandler.handleInput === 'function') {
          formHandler.handleInput('schoonmakerKeuze', e, FORM_NAME);
        }
        if (formHandler && typeof formHandler.updateSubmitState === 'function') {
          formHandler.updateSubmitState(FORM_NAME);
        }
      } catch (err) {
        console.warn('[SchoonmakerForm] Kon radio change niet verwerken:', err);
      }
    });
    radio.dataset.bound = '1';
  });
}

/**
 * Voeg de "geen voorkeur" radio-optie toe aan de lijst
 * @param {HTMLElement} wrapper - Container voor de opties 
 */
function addNoPreferenceOption() {
  // Niet meer dynamisch toevoegen; element bestaat extern
  if (formStatus.geenVoorkeurElement) {
    // Zorg dat radio de juiste attributen heeft
    const radio = formStatus.geenVoorkeurElement.querySelector('input[type="radio"]');
    if (radio) {
      radio.name = 'schoonmakerKeuze';
      radio.setAttribute('data-field-name', 'schoonmakerKeuze');
      if (!radio.value) radio.value = 'geenVoorkeur';
      // Default: niet geselecteerd bij laden of her-render
      radio.checked = false;
      radio.removeAttribute('checked');
    }
    resetRadioState(formStatus.geenVoorkeurElement, 'geen-voorkeur-init');
  }
}

/**
 * Leegt de huidige schoonmaker selectie (DOM + formHandler state) en
 * zorgt dat de submit button wordt uitgeschakeld totdat er een keuze is.
 * @param {HTMLFormElement} formElement
 */
function clearSchoonmakerKeuze(formElement) {
  if (!formElement) return;
  // Uncheck alle radio's in de groep
  const radios = formElement.querySelectorAll('input[type="radio"][name="schoonmakerKeuze"]');
  radios.forEach(r => { r.checked = false; r.removeAttribute('checked'); });

  if (formStatus.geenVoorkeurElement) {
    resetRadioState(formStatus.geenVoorkeurElement, 'geen-voorkeur-clear');
  }

  // Reset formHandler state zodat validateForm geen oude waarde gebruikt
  try {
    if (formHandler && typeof formHandler.runWithFormContext === 'function') {
      formHandler.runWithFormContext(FORM_NAME, () => {
        if (formHandler.formData) {
          formHandler.formData.schoonmakerKeuze = '';
        }
        if (typeof formHandler.updateSubmitState === 'function') {
          formHandler.updateSubmitState(FORM_NAME);
        }
      });
    }
  } catch (e) {
    console.warn('[SchoonmakerForm] Kon keuze reset niet volledig doorvoeren:', e);
  }
}

/**
 * Haalt schoonmakers op van de API en rendert ze
 * @param {HTMLFormElement} formElement - Het formulier element
 * @param {boolean} gebruikDagdelenFilter - Of dagdelen moeten worden gefilterd
 */
async function fetchEnToonSchoonmakers(formElement, gebruikDagdelenFilter = false) {
  if (!formElement) return;
  
  try {
    updateLoadingState(true);
    
    // Haal flow data op voor gebruiker coordinaten en plaats
    const flowData = loadFlowData('abonnement-aanvraag') || {};
    
    // Controleer of de vereiste gegevens aanwezig zijn in flowData
    // In vorige stappen worden deze opgeslagen in flowData (niet in adresData)
    if (!flowData.plaats) {
      console.error('❌ [SchoonmakerForm] Plaats ontbreekt in flowData', flowData);
      throw new Error('Adresgegevens ontbreken. Ga terug naar de adresstap.');
    }
    
    if (!flowData.abb_uren) {
      console.error('❌ [SchoonmakerForm] Uren ontbreken in flowData', flowData);
      throw new Error('Opdrachtgegevens (uren) ontbreken. Ga terug naar de opdrachtstap.');
    }
    
    // Coördinaten kunnen uit adresData of flowData komen (voor consistentie)
    const adresData = loadFlowData('adresData') || {};
    const latitude = flowData.latitude || adresData.latitude;
    const longitude = flowData.longitude || adresData.longitude;
    
    if (!latitude || !longitude) {
      console.warn('⚠️ [SchoonmakerForm] Coördinaten ontbreken, afstandberekening mogelijk onnauwkeurig');
    }
    
    // Bereid parameters voor
    const params = {
      plaats: flowData.plaats,
      uren: parseFloat(flowData.abb_uren)
    };
    
    // Voeg dagdelen toe als filter indien nodig
    if (gebruikDagdelenFilter) {
      const selectedDagdelen = getSelectedDagdelenFromForm(formElement);
      if (selectedDagdelen && selectedDagdelen.length > 0) {
        params.dagdelen = convertUIDagdelenNaarDB(selectedDagdelen);
      }
    }
    
    // Haal schoonmakers op
    const schoonmakers = await fetchAvailableCleaners(params);
      // Sorteer en verrijk met extra informatie (afstanden)
    const verwerkteLijst = verwerkSchoonmakers(
      schoonmakers, 
      parseFloat(latitude || 0), 
      parseFloat(longitude || 0)
    );
    
    // Render schoonmakers
    renderSchoonmakers(verwerkteLijst, gebruikDagdelenFilter ? params.dagdelen : null);
    
    // Voeg geen-voorkeur optie toe
    addNoPreferenceOption(formStatus.schoonmakersWrapper);
    
  // Leeg selectie na (her)render zodat knop disabled is tot er een keuze is
  clearSchoonmakerKeuze(formElement);

  // Update form status: herbereken submit-state i.p.v. niet-bestaande validateField
    // (andere formulieren vertrouwen op de centrale validatie-flow in formHandler)
    if (formHandler && typeof formHandler.updateSubmitState === 'function') {
      formHandler.updateSubmitState(FORM_NAME);
    }

  // Bind events op de dynamisch gerenderde radio's
  bindSchoonmakerRadioEvents(formElement);
    
    // Verberg eventuele error meldingen omdat we succesvol schoonmakers hebben geladen
    hideErrorMessage();
    
  } catch (error) {
    console.error('❌ [SchoonmakerForm] Fout bij ophalen schoonmakers:', error);
    
    if (error.message.includes('Benodigde gegevens')) {
      showErrorMessage('Benodigde gegevens ontbreken. Ga terug naar vorige stap.', 'warning');
    } else if (error.name === 'NetworkError' || error.message.includes('network')) {
      showErrorMessage('Geen verbinding met de server. Controleer je internetverbinding.', 'error');
    } else {
      showErrorMessage('Er is een probleem opgetreden bij het ophalen van schoonmakers.', 'error');
    }
  } finally {
    updateLoadingState(false);
  }
}

/**
 * Initialiseert de beschikbaarheidsdetails toggle functionaliteit
 * @param {HTMLElement} schoonmakerEl - Het schoonmaker element
 */
function initBeschikbaarheidsToggle(schoonmakerEl) {
  const beschikbaarheidTabel = schoonmakerEl.querySelector('.beschikbaarheid-tabel');
  const beschikbaarheidDetails = schoonmakerEl.querySelector('[data-beschikbaarheid-details]');
  
  if (!beschikbaarheidTabel || !beschikbaarheidDetails) return;
  
  // Voeg event listeners toe aan rijen om details te tonen/verbergen
  const dagRijen = beschikbaarheidTabel.querySelectorAll('tbody tr');
  dagRijen.forEach(rij => {
    rij.addEventListener('click', () => {
      const dagNaam = rij.getAttribute('data-dag');
      
      // Toon of verberg de details voor deze dag
      const alleDetails = beschikbaarheidDetails.querySelectorAll('.dag-details');
      alleDetails.forEach(detail => detail.style.display = 'none');
      
      const dagDetail = beschikbaarheidDetails.querySelector(`[data-dag-details="${dagNaam}"]`);
      if (dagDetail) {
        beschikbaarheidDetails.style.display = 'block';
        dagDetail.style.display = 'block';
      }
      
      // Markeer geselecteerde rij
      dagRijen.forEach(r => r.classList.remove('geselecteerd'));
      rij.classList.add('geselecteerd');
    });
  });
  
  // Voeg een sluit knop toe aan de details view
  const sluitKnop = document.createElement('button');
  sluitKnop.type = 'button';
  sluitKnop.className = 'beschikbaarheid-details-sluiten';
  sluitKnop.textContent = '×';
  sluitKnop.setAttribute('aria-label', 'Details sluiten');
  
  sluitKnop.addEventListener('click', (e) => {
    e.stopPropagation();
    beschikbaarheidDetails.style.display = 'none';
    dagRijen.forEach(r => r.classList.remove('geselecteerd'));
  });
  
  beschikbaarheidDetails.insertBefore(sluitKnop, beschikbaarheidDetails.firstChild);
}

/**
 * Initialiseert de event listeners voor dagdelen checkboxes
 * @param {HTMLFormElement} formElement - Het formulier element
 */
function initDagdeelSelectors(formElement) {
  const dagdeelCheckboxes = formElement.querySelectorAll('input[type="checkbox"][data-field-name="dagdeel"]');
  
  if (dagdeelCheckboxes.length === 0) {
    console.warn('⚠️ [SchoonmakerForm] Geen dagdeel checkboxes gevonden');
    return;
  }
  
  // Maak een debounced update functie
  const updateSchoonmakers = debouncedDagdelenUpdate(() => {
  fetchEnToonSchoonmakers(formElement, true);
  }, 500); // 500ms debounce
  
  // Voeg change listeners toe aan alle dagdeel checkboxes
  dagdeelCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
  // Bij wijziging dagdelen: herladen + selectie leegmaken zodra nieuwe lijst klaar is
  updateSchoonmakers();
    });
  });
}

/**
 * Initialiseert het formulier
 */
export async function initAbbDagdelenSchoonmakerForm() {
  console.log('🚀 [AbbDagdelenSchoonmakerForm] Initialiseren...');
  
  // Haal formulierschema op
  const schema = getFormSchema(FORM_NAME);
  
  // Vind nieuwe containers op basis van data-element attributen
  formStatus.schoonmakersWrapper = document.querySelector('[data-element="schoonmakers-list"]');
  formStatus.totaalElement = document.querySelector('[data-element="schoonmakers-total"]');
  formStatus.geenVoorkeurElement = document.querySelector('[data-element="schoonmakers-geen-voorkeur"]');
  formStatus.emptyElement = document.querySelector('[data-element="schoonmakers-empty"]');
  
  // Vind het template voor een schoonmaker item
  formStatus.schoonmakerTemplate = document.querySelector('[data-render-element="schoonmaker"]');
  
  if (formStatus.schoonmakerTemplate) {
    if (!formStatus.schoonmakerPrototype) {
  formStatus.schoonmakerPrototype = formStatus.schoonmakerTemplate.cloneNode(true);
  resetRadioState(formStatus.schoonmakerPrototype, 'prototype');
    }
    formStatus.schoonmakerTemplate.style.display = 'none';
  } else if (!formStatus.schoonmakerPrototype) {
    console.error('❌ [SchoonmakerForm] Geen schoonmaker template gevonden met attribuut [data-render-element="schoonmaker"] en geen fallback prototype beschikbaar');
  }
  
  // Voeg submit handler toe aan schema
  schema.submit = {
    action: async (formData) => {
      // Sla geselecteerde schoonmaker en dagdelen op in flow data
      const flowData = loadFlowData('abonnement-aanvraag') || {};
      
      // Sla schoonmaker ID op
      flowData.schoonmakerKeuze = formData.schoonmakerKeuze;

      // Sla voornaam van geselecteerde schoonmaker op voor overzicht (indien van toepassing)
      try {
        const formElement = document.querySelector(schema.selector);
        if (formElement && formData.schoonmakerKeuze && formData.schoonmakerKeuze !== 'geenVoorkeur') {
          const selectedRadio = formElement.querySelector(`input[type="radio"][name="schoonmakerKeuze"][value="${formData.schoonmakerKeuze}"]`);
          if (selectedRadio) {
            const card = selectedRadio.closest('[data-render-element="schoonmaker"]');
            const naamEl = card ? card.querySelector('[data-schoonmaker="naam"]') : null;
            const voornaam = naamEl ? (naamEl.textContent || '').trim() : '';
            if (voornaam) {
              flowData.schoonmakerVoornaam = voornaam;
            }
          }
        } else {
          // Geen voorkeur of niets gekozen: geen naam tonen in overzicht
          if (flowData.schoonmakerVoornaam) delete flowData.schoonmakerVoornaam;
        }
      } catch (e) {
        console.warn('[AbbDagdelenSchoonmakerForm] Kon voornaam niet opslaan voor overzicht:', e);
      }
      
      // Verzamel geselecteerde dagdelen
      const formElement = document.querySelector(schema.selector);
      const selectedDagdelen = getSelectedDagdelenFromForm(formElement);

      // Verwijder eventuele opgeslagen dagdelen-voorkeuren zodat er niets wordt geprefilled
      if ('dagdelenVoorkeur' in flowData) delete flowData.dagdelenVoorkeur;
      if ('selectedDagdelen' in flowData) delete flowData.selectedDagdelen;

      // (optioneel) gebruik selectedDagdelen runtime voor logging/debugging
      if (selectedDagdelen.length > 0) {
        console.debug('[AbbDagdelenSchoonmakerForm] Dagdelen geselecteerd (niet persistent opgeslagen):', selectedDagdelen);
      }

      // Sla overige flow data (zoals schoonmakerkeuze) op, zonder dagdelen in storage te houden
      saveFlowData('abonnement-aanvraag', flowData);
      
      // Voor backward compatibility
      saveGlobalFieldData('schoonmakerKeuze', formData.schoonmakerKeuze);
    },
    onSuccess: () => {
      console.log('✅ [AbbDagdelenSchoonmakerForm] Formulier succesvol verwerkt, naar volgende slide...');
      // Laad en initialiseer de overzicht-stap, navigeer daarna
      import('./abbOverzicht.js')
        .then((module) => {
          try {
            module.initAbbOverzicht();
          } catch (e) {
            console.warn('[AbbDagdelenSchoonmakerForm] Overzicht init gaf een waarschuwing:', e);
          }
          goToFormStep(NEXT_FORM_NAME);
        })
        .catch((err) => {
          console.error('[AbbDagdelenSchoonmakerForm] Kon overzicht stap niet laden:', err);
          goToFormStep(NEXT_FORM_NAME);
        });
    }
  };
  
  // Initialiseer form handler met schema
  formHandler.init(schema);
  
  const formElement = document.querySelector(schema.selector);
  if (!formElement) {
    console.error('❌ [AbbDagdelenSchoonmakerForm] Formulier element niet gevonden');
    return;
  }

  // Zorg dat er bij start geen selectie actief is en de knop disabled is
  clearSchoonmakerKeuze(formElement);
  if (formHandler && typeof formHandler.updateSubmitState === 'function') {
    formHandler.updateSubmitState(FORM_NAME);
  }
  
  // Initialiseer dagdeel selectie event listeners
  initDagdeelSelectors(formElement);

  const hasPresetDagdelen = !!formElement.querySelector('input[type="checkbox"][data-field-name="dagdeel"]:checked');

  if (hasPresetDagdelen) {
    await fetchEnToonSchoonmakers(formElement, true);
  } else {
    await fetchEnToonSchoonmakers(formElement, false);
  }
  
  // Check voor bestaande selectie (als we terugkomen vanaf een volgende stap)
  const flowData = loadFlowData('abonnement-aanvraag') || {};
  // Geen auto-herstel van schoonmakerKeuze: gebruiker moet bewust kiezen in deze stap
  if ('dagdelenVoorkeur' in flowData || 'selectedDagdelen' in flowData) {
    delete flowData.dagdelenVoorkeur;
    delete flowData.selectedDagdelen;
    saveFlowData('abonnement-aanvraag', flowData);
  }
  
  // Zorg dat de submit-state klopt na init (start disabled tot er een keuze is)
  if (formHandler && typeof formHandler.updateSubmitState === 'function') {
    formHandler.updateSubmitState(FORM_NAME);
  }

  console.log('✅ [AbbDagdelenSchoonmakerForm] Initialisatie voltooid');
}
