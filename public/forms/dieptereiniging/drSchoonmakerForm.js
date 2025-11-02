/**
 * @fileoverview Dieptereiniging stap 3: Schoonmaker selectie formulier
 * Laadt beschikbare schoonmakers op basis van plaats, datum en benodigde uren.
 * Verschil met abonnement: geen dagdelen selectie, alleen schoonmaker keuze.
 */

import { formHandler } from '../logic/formHandler.js';
import { fetchAvailableCleaners } from '../../utils/api/cleaners.js';

/**
 * Initialiseert het schoonmaker selectie formulier voor dieptereiniging
 */
export async function initDrSchoonmakerForm() {
  console.log('[DR Schoonmaker Form] Initializing...');

  const formElement = document.querySelector('[data-form-name="dr_schoonmaker-form"]');
  if (!formElement) {
    console.warn('[DR Schoonmaker Form] Form element not found');
    return;
  }

  // Haal flow data op
  const flowData = getFlowData();
  if (!flowData) {
    console.error('[DR Schoonmaker Form] Missing required flow data');
    showError('Kan geen schoonmakers laden. Ga terug naar de vorige stap.');
    return;
  }

  console.log('[DR Schoonmaker Form] Flow data:', flowData);

  // Haal bestaande keuze op (bij terugkomen)
  const existingChoice = formHandler.formData.schoonmakerKeuze || null;
  console.log('[DR Schoonmaker Form] Existing choice:', existingChoice);

  // Laad schoonmakers
  await loadCleaners(flowData, existingChoice);

  // Setup event handlers
  setupEventHandlers();

  console.log('[DR Schoonmaker Form] Initialization complete');
}

/**
 * Haalt benodigde data uit de flow
 */
function getFlowData() {
  const flowKey = 'dieptereiniging-aanvraag';
  const flowDataStr = sessionStorage.getItem(flowKey);
  
  if (!flowDataStr) {
    console.error('[DR Schoonmaker Form] No flow data found in sessionStorage');
    return null;
  }

  let flowData;
  try {
    flowData = JSON.parse(flowDataStr);
  } catch (e) {
    console.error('[DR Schoonmaker Form] Failed to parse flow data:', e);
    return null;
  }

  // Valideer vereiste velden
  const plaats = flowData.dr_plaats;
  const datum = flowData.dr_datum;
  const uren = flowData.dr_uren;

  if (!plaats || !datum || !uren) {
    console.error('[DR Schoonmaker Form] Missing required fields:', { plaats, datum, uren });
    return null;
  }

  return { plaats, datum, uren };
}

/**
 * Laadt beschikbare schoonmakers van de API
 */
async function loadCleaners(flowData, existingChoice) {
  const listContainer = document.querySelector('[data-element="schoonmakers-list"]');
  const loadingSpinner = document.querySelector('[data-loading-spinner="schoonmakers"]');
  const emptyState = document.querySelector('[data-element="schoonmakers-empty"]');
  const totalElement = document.querySelector('[data-element="schoonmakers-total"]');

  // Toon loading
  if (loadingSpinner) loadingSpinner.style.display = 'flex';
  if (listContainer) listContainer.style.display = 'none';
  if (emptyState) emptyState.style.display = 'none';

  try {
    console.log('[DR Schoonmaker Form] Fetching cleaners from API...');
    
    const response = await fetchAvailableCleaners({
      plaats: flowData.plaats,
      datum: flowData.datum,
      minUren: flowData.uren,
      type: 'dieptereiniging' // Signal to use dieptereiniging endpoint
    });

    console.log('[DR Schoonmaker Form] API response:', response);

    const cleaners = response.cleaners || [];
    console.log('[DR Schoonmaker Form] Cleaners count:', cleaners.length);

    // Verberg loading
    if (loadingSpinner) loadingSpinner.style.display = 'none';

    if (cleaners.length === 0) {
      // Toon empty state
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    // Render schoonmakers
    renderCleaners(cleaners, existingChoice);

    // Update totaal
    if (totalElement) {
      totalElement.textContent = cleaners.length;
    }

    // Toon lijst
    if (listContainer) listContainer.style.display = 'block';

  } catch (error) {
    console.error('[DR Schoonmaker Form] Failed to load cleaners:', error);
    
    // Verberg loading
    if (loadingSpinner) loadingSpinner.style.display = 'none';
    
    // Toon error
    showError('Kon geen schoonmakers laden. Probeer het opnieuw.');
  }
}

/**
 * Rendert schoonmaker kaarten in de lijst
 */
function renderCleaners(cleaners, existingChoice) {
  const template = document.querySelector('[data-render-element="schoonmaker"]');
  const listContainer = document.querySelector('[data-element="schoonmakers-list"]');

  if (!template || !listContainer) {
    console.error('[DR Schoonmaker Form] Missing template or list container');
    return;
  }

  console.log('[DR Schoonmaker Form] Rendering', cleaners.length, 'cleaners');

  // Clear bestaande items (behalve template)
  const existingCards = listContainer.querySelectorAll('[data-render-element="schoonmaker"]:not([data-render-element="schoonmaker"]:first-child)');
  existingCards.forEach(card => card.remove());

  // Render elke schoonmaker
  cleaners.forEach((cleaner, index) => {
    const card = template.cloneNode(true);
    card.style.display = 'block'; // Template is meestal hidden
    
    // Vul schoonmaker data
    fillCleanerCard(card, cleaner);

    // Voeg toe aan lijst
    listContainer.appendChild(card);

    console.log(`[DR Schoonmaker Form] Rendered cleaner ${index + 1}:`, cleaner.voornaam, cleaner.achternaam);
  });

  // Pre-select bestaande keuze indien aanwezig
  if (existingChoice) {
    const radioToSelect = listContainer.querySelector(`input[name="schoonmakerKeuze"][value="${existingChoice}"]`);
    if (radioToSelect) {
      radioToSelect.checked = true;
      console.log('[DR Schoonmaker Form] Pre-selected existing choice:', existingChoice);
    }
  } else {
    // Anders: selecteer "Geen voorkeur" (eerste optie)
    const geenVoorkeurRadio = document.querySelector('input[name="schoonmakerKeuze"][value="geenVoorkeur"]');
    if (geenVoorkeurRadio) {
      geenVoorkeurRadio.checked = true;
      console.log('[DR Schoonmaker Form] Pre-selected "Geen voorkeur"');
    }
  }
}

/**
 * Vult een schoonmaker kaart met data
 */
function fillCleanerCard(card, cleaner) {
  // Foto
  const foto = card.querySelector('[data-schoonmaker="schoonmaker-foto"]');
  if (foto && cleaner.profielfoto) {
    foto.src = cleaner.profielfoto;
    foto.alt = `${cleaner.voornaam} ${cleaner.achternaam}`;
  }

  // Naam
  const naam = card.querySelector('[data-schoonmaker="naam"]');
  if (naam) {
    naam.textContent = `${cleaner.voornaam} ${cleaner.achternaam}`;
  }

  // Plaats
  const plaats = card.querySelector('[data-schoonmaker="plaats"]');
  if (plaats && cleaner.plaats) {
    plaats.textContent = cleaner.plaats;
  }

  // Rating (sterren)
  const stars = card.querySelector('[data-field-profile="stars"]');
  if (stars && cleaner.rating) {
    const rating = parseFloat(cleaner.rating);
    stars.textContent = rating.toFixed(1);
    // Optioneel: voeg visuele sterren toe via CSS/classes
  }

  // Aantal reviews
  const reviews = card.querySelector('[data-schoonmaker="total-reviews"]');
  if (reviews && cleaner.aantal_beoordelingen) {
    reviews.textContent = cleaner.aantal_beoordelingen;
  }

  // Beschikbaarheid grid (visueel, niet selecteerbaar)
  renderBeschikbaarheidGrid(card, cleaner.beschikbaarheid);

  // Radio button value - gebruik 'id' van database functie
  const radio = card.querySelector('input[type="radio"][name="schoonmakerKeuze"]');
  if (radio) {
    radio.value = cleaner.id;
  }
}

/**
 * Rendert beschikbaarheid grid visueel (geen interactie)
 * Toont welke uren beschikbaar zijn op de gekozen dag
 */
function renderBeschikbaarheidGrid(card, beschikbaarheid) {
  if (!beschikbaarheid || !Array.isArray(beschikbaarheid)) {
    console.log('[DR Schoonmaker Form] No beschikbaarheid data');
    return;
  }

  console.log('[DR Schoonmaker Form] Rendering beschikbaarheid grid:', beschikbaarheid);

  // Beschikbaarheid is array van { dag, dagdeel, start_tijd, eind_tijd }
  // Voor dieptereiniging: toon alleen relevante tijdslots
  beschikbaarheid.forEach(slot => {
    const dag = slot.dag; // bijv. 'maandag'
    const dagdeel = slot.dagdeel; // bijv. 'ochtend'
    
    // Zoek het grid element voor deze combinatie
    const gridElement = card.querySelector(`[data-schoonmaker-dagdeel="${dag}-${dagdeel}"]`);
    if (gridElement) {
      // Markeer als beschikbaar (bijv. via class)
      gridElement.classList.add('beschikbaar');
      
      // Optioneel: toon tijden
      gridElement.setAttribute('title', `${slot.start_tijd} - ${slot.eind_tijd}`);
    }
  });
}

/**
 * Setup event handlers voor formulier
 */
function setupEventHandlers() {
  const formElement = document.querySelector('[data-form-name="dr_schoonmaker-form"]');
  if (!formElement) return;

  // Submit handler
  formElement.addEventListener('submit', handleSubmit);

  // Radio change handlers (optioneel, voor visuele feedback)
  const radios = formElement.querySelectorAll('input[name="schoonmakerKeuze"]');
  radios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      console.log('[DR Schoonmaker Form] Selected:', e.target.value);
    });
  });

  console.log('[DR Schoonmaker Form] Event handlers registered');
}

/**
 * Handle formulier submit
 */
async function handleSubmit(e) {
  e.preventDefault();
  console.log('[DR Schoonmaker Form] Form submitted');

  const selectedRadio = document.querySelector('input[name="schoonmakerKeuze"]:checked');
  
  if (!selectedRadio) {
    console.error('[DR Schoonmaker Form] No schoonmaker selected');
    showError('Selecteer een schoonmaker om door te gaan');
    return;
  }

  const selectedValue = selectedRadio.value;
  console.log('[DR Schoonmaker Form] Selected value:', selectedValue);

  // Bij "Geen voorkeur": kies eerste beschikbare schoonmaker
  let schoonmakerId = selectedValue;
  if (selectedValue === 'geenVoorkeur') {
    schoonmakerId = getFirstAvailableCleanerId();
    console.log('[DR Schoonmaker Form] Geen voorkeur selected, using first cleaner:', schoonmakerId);
  }

  if (!schoonmakerId || schoonmakerId === 'geenVoorkeur') {
    console.error('[DR Schoonmaker Form] No valid schoonmaker ID found');
    showError('Geen beschikbare schoonmaker gevonden');
    return;
  }

  // Sla keuze op in formData
  formHandler.formData.schoonmakerKeuze = selectedValue;
  formHandler.formData.schoonmaker_id = schoonmakerId;

  // Sla ook op in flow storage
  updateFlowData('schoonmaker_id', schoonmakerId);

  console.log('[DR Schoonmaker Form] Saved choice:', { 
    schoonmakerKeuze: selectedValue, 
    schoonmaker_id: schoonmakerId 
  });

  // Navigeer naar volgende stap (stap 4: persoonsgegevens)
  navigateToNextStep();
}

/**
 * Haalt ID van eerste beschikbare schoonmaker
 */
function getFirstAvailableCleanerId() {
  const listContainer = document.querySelector('[data-element="schoonmakers-list"]');
  if (!listContainer) return null;

  const firstRadio = listContainer.querySelector('input[type="radio"][name="schoonmakerKeuze"]:not([value="geenVoorkeur"])');
  return firstRadio ? firstRadio.value : null;
}

/**
 * Update flow data in sessionStorage
 */
function updateFlowData(key, value) {
  const flowKey = 'dieptereiniging-aanvraag';
  const flowDataStr = sessionStorage.getItem(flowKey);
  
  if (!flowDataStr) {
    console.error('[DR Schoonmaker Form] No flow data to update');
    return;
  }

  try {
    const flowData = JSON.parse(flowDataStr);
    flowData[key] = value;
    sessionStorage.setItem(flowKey, JSON.stringify(flowData));
    console.log('[DR Schoonmaker Form] Updated flow data:', key, value);
  } catch (e) {
    console.error('[DR Schoonmaker Form] Failed to update flow data:', e);
  }
}

/**
 * Navigeer naar volgende stap
 */
function navigateToNextStep() {
  console.log('[DR Schoonmaker Form] Navigating to next step...');
  
  // Gebruik Webflow page navigation
  // Pas aan naar jouw specifieke stap 4 page slug
  const nextPageUrl = '/aanvraag-dieptereiniging/stap-4-persoonsgegevens'; // Pas aan indien nodig
  
  // Optie 1: Gebruik window.location
  window.location.href = nextPageUrl;
  
  // Optie 2: Als je een custom navigator hebt, gebruik die
  // if (window.flowNavigator) {
  //   window.flowNavigator.goToStep(4);
  // }
}

/**
 * Toon error bericht aan gebruiker
 */
function showError(message) {
  console.error('[DR Schoonmaker Form] Error:', message);
  
  // Zoek error display element
  const errorElement = document.querySelector('[data-error="schoonmaker-form"]');
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    
    // Auto-hide na 5 seconden
    setTimeout(() => {
      errorElement.style.display = 'none';
    }, 5000);
  } else {
    // Fallback: gebruik alert
    alert(message);
  }
}
