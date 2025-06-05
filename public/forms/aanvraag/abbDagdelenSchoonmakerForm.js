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

// Import functie voor volgende slide (functie in de Webflow omgeving)
// Wordt op dezelfde manier gebruikt als in abbOpdrachtForm.js
const moveToNextSlide = window.moveToNextSlide || (() => console.warn('⚠️ moveToNextSlide functie niet beschikbaar.'));

// Status object voor dit formulier
const formStatus = {
  isLoading: false,
  schoonmakersWrapper: null,
  schoonmakerTemplate: null,
  totaalSchoonmakers: 0
};

/**
 * Verbergt de globale foutmelding
 */
function hideErrorMessage() {
  // Zoek specifiek binnen het huidige formulier naar het error element
  const formElement = document.querySelector('[data-form-name="abb_dagdelen-schoonmaker-form"]');
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
  const formElement = document.querySelector('[data-form-name="abb_dagdelen-schoonmaker-form"]');
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

/**
 * Rendert een schoonmaker in de UI met geavanceerde beschikbaarheidsweergave
 * 
 * @param {Object} schoonmaker - Schoonmaker data
 * @param {Object} dagdelenFilter - Optionele filter voor beschikbaarheid 
 * @returns {HTMLElement} - Het schoonmaker element
 */
function renderSchoonmaker(schoonmaker, dagdelenFilter = null) {
  if (!formStatus.schoonmakerTemplate) {
    console.error('❌ [SchoonmakerForm] Geen schoonmaker template gevonden');
    return null;
  }
  
  // Kloon het template
  const schoonmakerEl = formStatus.schoonmakerTemplate.cloneNode(true);
  schoonmakerEl.style.display = 'block'; // Maak zichtbaar
  
  // Voeg id toe als waarde voor de radio button
  const radioEl = schoonmakerEl.querySelector('input[type="radio"]');
  if (radioEl) {
    radioEl.value = schoonmaker.schoonmaker_id;
    
    // Voeg attributen toe volgens form schema
    radioEl.setAttribute('data-field-name', 'schoonmakerKeuze');
    radioEl.name = 'schoonmakerKeuze';
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
  
  return schoonmakerEl;
}

/**
 * Rendert alle schoonmakers in de UI
 * 
 * @param {Array} schoonmakers - Array van schoonmaker objecten
 * @param {Object} filterDagdelen - Optioneel filter voor dagdelen
 */
function renderSchoonmakers(schoonmakers, filterDagdelen = null) {
  if (!formStatus.schoonmakersWrapper) {
    console.error('❌ [SchoonmakerForm] Geen schoonmakers wrapper gevonden');
    return;
  }
  
  // Leeg de container eerst
  formStatus.schoonmakersWrapper.innerHTML = '';
  formStatus.totaalSchoonmakers = schoonmakers.length;
  
  // Toon feedback als er geen schoonmakers zijn
  if (schoonmakers.length === 0) {
    const noCleanersMsg = document.createElement('div');
    noCleanersMsg.className = 'geen-schoonmakers-melding';
    noCleanersMsg.textContent = filterDagdelen 
      ? 'Geen schoonmakers beschikbaar op de geselecteerde dagdelen.'
      : 'Geen schoonmakers beschikbaar in jouw regio.';
    formStatus.schoonmakersWrapper.appendChild(noCleanersMsg);
    return;
  }
  
  // Toon het aantal gevonden schoonmakers
  const samenvattingEl = document.createElement('div');
  samenvattingEl.className = 'schoonmakers-samenvatting';
  samenvattingEl.setAttribute('data-schoonmakers-count', schoonmakers.length);
  samenvattingEl.innerHTML = `
    <p class="schoonmakers-count-text">
      <strong>${schoonmakers.length}</strong> ${schoonmakers.length === 1 ? 'schoonmaker' : 'schoonmakers'} beschikbaar.
    </p>
  `;
  formStatus.schoonmakersWrapper.appendChild(samenvattingEl);
  
  // Voeg alle schoonmakers toe
  schoonmakers.forEach(schoonmaker => {
    const schoonmakerEl = renderSchoonmaker(schoonmaker, filterDagdelen);
    if (schoonmakerEl) {
      formStatus.schoonmakersWrapper.appendChild(schoonmakerEl);
      
      // Initialiseer de beschikbaarheid toggle voor deze schoonmaker
      initBeschikbaarheidsToggle(schoonmakerEl);
    }
  });
}

/**
 * Voeg de "geen voorkeur" radio-optie toe aan de lijst
 * @param {HTMLElement} wrapper - Container voor de opties 
 */
function addNoPreferenceOption(wrapper) {
  if (!wrapper) return;
  
  // Check of er al een geen-voorkeur element is
  const existing = wrapper.querySelector('[data-option="geen-voorkeur"]');
  if (existing) return;
  
  const noPreferenceEl = document.createElement('div');
  noPreferenceEl.className = 'schoonmaker-optie geen-voorkeur';
  noPreferenceEl.setAttribute('data-option', 'geen-voorkeur');
  
  noPreferenceEl.innerHTML = `
    <label class="radio-wrapper">
      <input type="radio" name="schoonmakerKeuze" value="geenVoorkeur" data-field-name="schoonmakerKeuze">
      <span class="radio-label">Geen voorkeur</span>
    </label>
    <div class="geen-voorkeur-toelichting">
      Wij kiezen voor jou een geschikte schoonmaker.
    </div>
  `;
  
  // Voeg toe aan het begin van de wrapper
  if (wrapper.firstChild) {
    wrapper.insertBefore(noPreferenceEl, wrapper.firstChild);
  } else {
    wrapper.appendChild(noPreferenceEl);
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
    
    // Update form status
    formHandler.validateField('schoonmakerKeuze');
    
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
  const schema = getFormSchema('abb_dagdelen-schoonmaker-form');
  
  // Vind waar de schoonmakers getoond worden
  formStatus.schoonmakersWrapper = document.querySelector('.schoonmakers-wrapper');
  
  // Vind het template voor een schoonmaker item
  formStatus.schoonmakerTemplate = document.querySelector('[data-render-element="schoonmaker"]');
  
  // Verberg het template als het gevonden is
  if (formStatus.schoonmakerTemplate) {
    formStatus.schoonmakerTemplate.style.display = 'none';
  } else {
    console.error('❌ [SchoonmakerForm] Geen schoonmaker template gevonden met attribuut [data-render-element="schoonmaker"]');
  }
  
  // Voeg submit handler toe aan schema
  schema.submit = {
    action: async (formData) => {
      // Sla geselecteerde schoonmaker en dagdelen op in flow data
      const flowData = loadFlowData('abonnement-aanvraag') || {};
      
      // Sla schoonmaker ID op
      flowData.schoonmakerKeuze = formData.schoonmakerKeuze;
      
      // Verzamel geselecteerde dagdelen
      const formElement = document.querySelector(schema.selector);
      const selectedDagdelen = getSelectedDagdelenFromForm(formElement);
      const dagdelenDB = convertUIDagdelenNaarDB(selectedDagdelen);
      
      // Sla dagdelen op
      flowData.dagdelenVoorkeur = dagdelenDB;
      flowData.selectedDagdelen = selectedDagdelen; // Voor eventuele UI updates later
      
      // Sla op in flow data
      saveFlowData('abonnement-aanvraag', flowData);
      
      // Voor backward compatibility
      saveGlobalFieldData('schoonmakerKeuze', formData.schoonmakerKeuze);
    },
    onSuccess: () => {
      console.log('✅ [AbbDagdelenSchoonmakerForm] Formulier succesvol verwerkt, naar volgende slide...');

      moveToNextSlide();
    }
  };
  
  // Initialiseer form handler met schema
  formHandler.init(schema);
  
  const formElement = document.querySelector(schema.selector);
  if (!formElement) {
    console.error('❌ [AbbDagdelenSchoonmakerForm] Formulier element niet gevonden');
    return;
  }
  
  // Initialiseer dagdeel selectie event listeners
  initDagdeelSelectors(formElement);
  
  // Haal initiële schoonmakers op (zonder dagdelen filter)
  await fetchEnToonSchoonmakers(formElement, false);
  
  // Check voor bestaande selectie (als we terugkomen vanaf een volgende stap)
  const flowData = loadFlowData('abonnement-aanvraag') || {};
  
  if (flowData.schoonmakerKeuze) {
    // Vind de radio button met deze waarde en selecteer deze
    const radio = formElement.querySelector(`input[name="schoonmakerKeuze"][value="${flowData.schoonmakerKeuze}"]`);
    if (radio) {
      radio.checked = true;
    }
  }
  
  // Vink eventueel opgeslagen dagdelen aan
  if (Array.isArray(flowData.selectedDagdelen)) {
    flowData.selectedDagdelen.forEach(dagdeel => {
      const checkbox = formElement.querySelector(`input[data-field-name="dagdeel"][data-dagdeel="${dagdeel}"]`);
      if (checkbox) {
        checkbox.checked = true;
      }
    });
  }
  
  console.log('✅ [AbbDagdelenSchoonmakerForm] Initialisatie voltooid');
}
