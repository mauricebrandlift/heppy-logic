/**
 * @fileoverview Dieptereiniging stap 3: Schoonmaker selectie formulier
 * Laadt beschikbare schoonmakers op basis van plaats, datum en benodigde uren.
 * Verschil met abonnement: geen dagdelen selectie, alleen schoonmaker keuze.
 */

import { formHandler } from '../logic/formHandler.js';
import { getFormSchema } from '../schemas/formSchemas.js';
import { loadFlowData, saveFlowData } from '../logic/formStorage.js';
import { fetchAvailableCleaners } from '../../utils/api/cleaners.js';

/**
 * Initialiseert het schoonmaker selectie formulier voor dieptereiniging
 */
export async function initDrSchoonmakerForm() {
  console.log('🚀 [DR Schoonmaker Form] ===== INITIALISATIE START =====');

  const formElement = document.querySelector('[data-form-name="dr_schoonmaker-form"]');
  console.log('[DR Schoonmaker Form] Form element gevonden:', !!formElement);
  
  if (!formElement) {
    console.warn('⚠️ [DR Schoonmaker Form] Form element niet gevonden');
    return;
  }

  // Initialiseer formHandler met schema
  const schema = getFormSchema('dr_schoonmaker-form');
  console.log('[DR Schoonmaker Form] Schema geladen:', schema);
  
  if (schema) {
    formHandler.init(schema);
    console.log('[DR Schoonmaker Form] FormHandler geïnitialiseerd');
  }

  // Haal bestaande keuze op (bij terugkomen)
  const existingChoice = formHandler.formData.schoonmakerKeuze || null;
  console.log('[DR Schoonmaker Form] Bestaande keuze:', existingChoice);

  // Check of alle UI elementen aanwezig zijn
  const listContainer = document.querySelector('[data-element="schoonmakers-list"]');
  const loadingSpinner = document.querySelector('[data-loading-spinner="schoonmakers"]');
  const emptyState = document.querySelector('[data-element="schoonmakers-empty"]');
  const totalElement = document.querySelector('[data-element="schoonmakers-total"]');
  const template = document.querySelector('[data-render-element="schoonmaker"]');
  
  console.log('[DR Schoonmaker Form] UI elementen check:', {
    listContainer: !!listContainer,
    loadingSpinner: !!loadingSpinner,
    emptyState: !!emptyState,
    totalElement: !!totalElement,
    template: !!template
  });

  // Laad schoonmakers (error handling gebeurt in loadCleaners zelf)
  console.log('[DR Schoonmaker Form] Start laden schoonmakers...');
  await loadCleaners(existingChoice);

  // Setup event handlers
  setupEventHandlers();

  console.log('✅ [DR Schoonmaker Form] ===== INITIALISATIE COMPLEET =====');
}

/**
 * Laadt beschikbare schoonmakers van de API
 */
async function loadCleaners(existingChoice) {
  console.log('📦 [DR Schoonmaker Form] loadCleaners() START');
  
  const listContainer = document.querySelector('[data-element="schoonmakers-list"]');
  const loadingSpinner = document.querySelector('[data-loading-spinner="schoonmakers"]');
  const emptyState = document.querySelector('[data-element="schoonmakers-empty"]');
  const totalElement = document.querySelector('[data-element="schoonmakers-total"]');

  console.log('[DR Schoonmaker Form] UI elementen voor loading:', {
    listContainer: !!listContainer,
    loadingSpinner: !!loadingSpinner,
    emptyState: !!emptyState
  });

  // Toon loading
  if (loadingSpinner) {
    loadingSpinner.style.display = 'flex';
    console.log('[DR Schoonmaker Form] Loading spinner getoond');
  }
  if (listContainer) listContainer.style.display = 'none';
  if (emptyState) emptyState.style.display = 'none';

  try {
    // Haal flow data op via loadFlowData helper
    const flowData = loadFlowData('dieptereiniging-aanvraag') || {};
    console.log('[DR Schoonmaker Form] Flow data geladen:', flowData);
    
    // Controleer vereiste velden
    if (!flowData.dr_plaats || !flowData.dr_datum || !flowData.dr_uren) {
      console.error('❌ [DR Schoonmaker Form] Missing required flow data:', {
        dr_plaats: flowData.dr_plaats,
        dr_datum: flowData.dr_datum,
        dr_uren: flowData.dr_uren,
        allKeys: Object.keys(flowData)
      });
      throw new Error('Adres- of opdrachtgegevens ontbreken. Ga terug naar de vorige stap.');
    }

    console.log('🌐 [DR Schoonmaker Form] Fetching cleaners from API...', {
      plaats: flowData.dr_plaats,
      datum: flowData.dr_datum,
      uren: flowData.dr_uren,
      type: 'dieptereiniging'
    });
    
    const response = await fetchAvailableCleaners({
      plaats: flowData.dr_plaats,
      datum: flowData.dr_datum,
      minUren: flowData.dr_uren,
      type: 'dieptereiniging' // Signal to use dieptereiniging endpoint
    });

    console.log('📨 [DR Schoonmaker Form] API response:', response);

    const cleaners = response.cleaners || [];
    console.log(`👥 [DR Schoonmaker Form] Cleaners count: ${cleaners.length}`);

    // Verberg loading
    if (loadingSpinner) {
      loadingSpinner.style.display = 'none';
      console.log('[DR Schoonmaker Form] Loading spinner verborgen');
    }

    if (cleaners.length === 0) {
      console.warn('⚠️ [DR Schoonmaker Form] Geen schoonmakers gevonden');
      // Toon empty state
      if (emptyState) {
        emptyState.style.display = 'block';
        console.log('[DR Schoonmaker Form] Empty state getoond');
      }
      return;
    }

    // Render schoonmakers
    console.log('[DR Schoonmaker Form] Start rendering schoonmakers...');
    renderCleaners(cleaners, existingChoice);

    // Update totaal
    if (totalElement) {
      totalElement.textContent = cleaners.length;
      console.log(`[DR Schoonmaker Form] Totaal element updated: ${cleaners.length}`);
    }

    // Toon lijst
    if (listContainer) {
      listContainer.style.display = 'block';
      console.log('[DR Schoonmaker Form] Lijst container getoond');
    }

  } catch (error) {
    console.error('❌ [DR Schoonmaker Form] ERROR in loadCleaners:', error);
    console.error('[DR Schoonmaker Form] Error stack:', error.stack);
    
    // Verberg loading
    if (loadingSpinner) loadingSpinner.style.display = 'none';
    
    // Toon empty state (geen alert!)
    if (emptyState) {
      emptyState.style.display = 'block';
      console.log('[DR Schoonmaker Form] Empty state getoond na error');
    }
  }
  
  console.log('✅ [DR Schoonmaker Form] loadCleaners() COMPLEET');
}

/**
 * Rendert schoonmaker kaarten in de lijst
 */
function renderCleaners(cleaners, existingChoice) {
  console.log('🎨 [DR Schoonmaker Form] renderCleaners() START');
  
  const template = document.querySelector('[data-render-element="schoonmaker"]');
  const listContainer = document.querySelector('[data-element="schoonmakers-list"]');

  console.log('[DR Schoonmaker Form] Template & container check:', {
    template: !!template,
    listContainer: !!listContainer
  });

  if (!template || !listContainer) {
    console.error('❌ [DR Schoonmaker Form] Missing template or list container');
    return;
  }

  console.log(`[DR Schoonmaker Form] Rendering ${cleaners.length} cleaners`);

  // Clear bestaande items (behalve template)
  const existingCards = listContainer.querySelectorAll('[data-render-element="schoonmaker"]:not([data-render-element="schoonmaker"]:first-child)');
  console.log(`[DR Schoonmaker Form] Removing ${existingCards.length} existing cards`);
  existingCards.forEach(card => card.remove());

  // Render elke schoonmaker
  cleaners.forEach((cleaner, index) => {
    console.log(`[DR Schoonmaker Form] Rendering cleaner ${index + 1}/${cleaners.length}:`, {
      id: cleaner.id,
      naam: `${cleaner.voornaam} ${cleaner.achternaam}`,
      plaats: cleaner.plaats
    });
    
    const card = template.cloneNode(true);
    card.style.display = 'block'; // Template is meestal hidden
    
    // Vul schoonmaker data
    fillCleanerCard(card, cleaner);

    // Voeg toe aan lijst
    listContainer.appendChild(card);
    console.log(`[DR Schoonmaker Form] ✅ Card ${index + 1} toegevoegd aan lijst`);
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
    } else {
      console.warn('⚠️ [DR Schoonmaker Form] "Geen voorkeur" radio niet gevonden');
    }
  }
  
  console.log('✅ [DR Schoonmaker Form] renderCleaners() COMPLEET');
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
    return; // FormHandler zal validation tonen
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
    return; // FormHandler zal validation tonen
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


