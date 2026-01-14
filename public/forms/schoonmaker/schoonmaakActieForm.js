// public/forms/schoonmaker/schoonmaakActieForm.js
/**
 * Schoonmaak Actie Form - Schoonmaker accepteert/weigert aanvraag of opdracht
 * 
 * Deze form volgt het standaard patroon:
 * - formHandler voor orchestratie
 * - Schema uit formSchemas.js
 * - State management via data-state-block attributen
 * - API calls via utils/api/index.js
 */

import { formHandler } from '../logic/formHandler.js';
import { getFormSchema } from '../schemas/formSchemas.js';
import { showError, hideError } from '../ui/formUi.js';
import { fetchMatchDetails, approveMatch, rejectMatch } from '../../utils/api/index.js';

const FORM_NAME = 'schoonmaak-actie-form';

// Store match data globally for use in success state
let currentMatchData = null;

/**
 * Parse URL parameters
 */
function parseParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    matchId: params.get('match_id'),
    action: params.get('action') // 'approve' of 'decline' (optioneel, voor preselectie)
  };
}

/**
 * Toon specifiek state block en verberg anderen
 */
function showStateBlock(state) {
  const blocks = ['loading', 'form', 'expired', 'error', 'success'];
  blocks.forEach(blockName => {
    const block = document.querySelector(`[data-state-block="${blockName}"]`);
    if (block) {
      block.style.display = (blockName === state) ? 'block' : 'none';
    }
  });
}

/**
 * Toon specifieke success wrapper en verberg anderen
 */
function showSuccessWrapper(wrapperName) {
  const wrappers = ['approved-abonnement', 'approved-opdracht', 'declined'];
  wrappers.forEach(name => {
    const wrapper = document.querySelector(`[data-success-wrapper="${name}"]`);
    if (wrapper) {
      wrapper.style.display = (name === wrapperName) ? 'block' : 'none';
    }
  });
}

/**
 * Bepaal match type text voor display
 */
function getMatchType(matchData) {
  if (matchData.type === 'aanvraag') {
    return 'Schoonmaak Abonnement';
  } else {
    const soort = matchData.opdracht?.soort_opdracht || '';
    if (soort === 'dieptereiniging') return 'Eenmalige Opdracht: Dieptereiniging';
    if (soort === 'verhuis') return 'Eenmalige Opdracht: Verhuisreiniging';
    return 'Eenmalige Opdracht';
  }
}

/**
 * Bepaal match details text (frequentie + uren of alleen uren)
 */
function getMatchDetails(matchData) {
  if (matchData.type === 'aanvraag') {
    // schoonmaak_optie: 'perweek', 'pertweeweek', 'eenmalig'
    const optie = matchData.aanvraag?.schoonmaak_optie || 'perweek';
    const freq = optie === 'perweek' 
      ? '1x per week' 
      : optie === 'pertweeweek'
        ? '1x per 2 weken'
        : 'Eenmalig';
    const uren = matchData.aanvraag?.uren || 4;
    return `${freq}, ${uren} uur per schoonmaak`;
  } else {
    // Opdrachten: gebruik gegevens.uren of vaste kolom (schema heeft geen 'uren' kolom!)
    // Check schema: opdrachten heeft geen uren kolom, alleen gegevens (jsonb)
    const adminNotes = matchData.opdracht?.opmerking || '';
    return adminNotes || 'Eenmalige schoonmaak';
  }
}

/**
 * Formatteer datum naar leesbare Nederlandse string
 */
function formatDatum(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('nl-NL', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

/**
 * Formatteer dagdelen naar leesbare lijst
 */
function formatDagdelen(voorkeursdagdelen) {
  if (!voorkeursdagdelen || voorkeursdagdelen.length === 0) {
    return 'Geen voorkeur opgegeven';
  }
  
  const dagNamen = {
    'maandag': 'Maandag',
    'dinsdag': 'Dinsdag',
    'woensdag': 'Woensdag',
    'donderdag': 'Donderdag',
    'vrijdag': 'Vrijdag',
    'zaterdag': 'Zaterdag',
    'zondag': 'Zondag'
  };
  
  return voorkeursdagdelen
    .map(vd => {
      const dagdelen = [];
      if (vd.ochtend) dagdelen.push('ochtend');
      if (vd.middag) dagdelen.push('middag');
      if (vd.avond) dagdelen.push('avond');
      
      if (dagdelen.length === 0) return null;
      
      const dagNaam = dagNamen[vd.dag.toLowerCase()] || vd.dag;
      return `${dagNaam}: ${dagdelen.join(', ')}`;
    })
    .filter(Boolean)
    .join('<br>');
}

/**
 * Bind match info naar data-match-info elementen
 */
function bindMatchInfo(matchData) {
  const isAanvraag = matchData.type === 'aanvraag';
  
  // Klant naam komt van aanvraag.voornaam of moet apart worden opgehaald voor opdrachten
  const klantNaam = isAanvraag 
    ? matchData.aanvraag?.voornaam || ''
    : ''; // Voor opdrachten hebben we geen naam in de tabel
  
  const mappings = {
    type: getMatchType(matchData),
    details: getMatchDetails(matchData),
    plaats: matchData.aanvraag?.plaats || matchData.opdracht?.plaats || '',
    adres: (() => {
      const source = matchData.aanvraag || matchData.opdracht || {};
      const straat = source.straatnaam || '';
      const huisnummer = source.huisnummer || '';
      const toevoeging = source.toevoeging || '';
      return `${straat} ${huisnummer}${toevoeging ? ` ${toevoeging}` : ''}`.trim();
    })(),
    naam: klantNaam
  };

  // Bind basis info
  Object.entries(mappings).forEach(([key, value]) => {
    const el = document.querySelector(`[data-match-info="${key}"]`);
    if (el && value !== undefined) {
      el.textContent = value;
    }
  });
  
  // Bind en toon/verberg conditionale velden
  if (isAanvraag) {
    // Toon startweek voor abonnementen (als het veld bestaat)
    const startweek = matchData.aanvraag?.gewenste_startweek || '';
    const startweekEl = document.querySelector('[data-match-info="startweek"]');
    const startweekWrapper = document.querySelector('[data-match-info-wrapper="startweek"]');
    if (startweekEl && startweek) {
      startweekEl.textContent = startweek;
      if (startweekWrapper) startweekWrapper.style.display = 'block';
    }
    
    // Dagdelen: Deze komen niet uit de basis aanvraag query, skip voorlopig
    // TODO: Fetch voorkeursdagdelen separately if needed
    const dagdelenWrapper = document.querySelector('[data-match-info-wrapper="dagdelen"]');
    if (dagdelenWrapper) dagdelenWrapper.style.display = 'none';
    
    // Verberg startdatum wrapper
    const startdatumWrapper = document.querySelector('[data-match-info-wrapper="startdatum"]');
    if (startdatumWrapper) startdatumWrapper.style.display = 'none';
    
  } else {
    // Toon startdatum voor opdrachten
    const startdatum = matchData.opdracht?.gewenste_datum 
      ? formatDatum(matchData.opdracht.gewenste_datum) 
      : '';
    const startdatumEl = document.querySelector('[data-match-info="startdatum"]');
    const startdatumWrapper = document.querySelector('[data-match-info-wrapper="startdatum"]');
    if (startdatumEl) startdatumEl.textContent = startdatum;
    if (startdatumWrapper) startdatumWrapper.style.display = 'block';
    
    // Verberg abonnement wrappers
    const startweekWrapper = document.querySelector('[data-match-info-wrapper="startweek"]');
    const dagdelenWrapper = document.querySelector('[data-match-info-wrapper="dagdelen"]');
    if (startweekWrapper) startweekWrapper.style.display = 'none';
    if (dagdelenWrapper) dagdelenWrapper.style.display = 'none';
  }
}

/**
 * Toggle reden wrapper visibility based on action
 */
function toggleRedenWrapper(selectedAction) {
  const redenWrapper = document.querySelector('[data-field-wrapper="reden"]');
  if (!redenWrapper) return;
  
  // Toon alleen bij afwijzen
  if (selectedAction === 'decline') {
    redenWrapper.style.display = 'block';
  } else {
    redenWrapper.style.display = 'none';
    // Clear reden field als niet nodig
    const redenField = document.querySelector('[data-field-name="reden"]');
    if (redenField) redenField.value = '';
  }
}

/**
 * Initialiseer formulier
 */
export async function initSchoonmaakActieForm() {
  console.log('[schoonmaakActieForm] Initialiseren...');
  
  const { matchId, action } = parseParams();
  console.log('[schoonmaakActieForm] URL parameters:', { matchId, action });
  
  // Validatie
  if (!matchId) {
    console.error('[schoonmaakActieForm] Geen match_id in URL!');
    showStateBlock('error');
    const errorBlock = document.querySelector('[data-state-block="error"]');
    if (errorBlock) {
      const errorContainer = errorBlock.querySelector('[data-error-for="global"]') || errorBlock;
      showError('Geen match ID gevonden in de URL.', errorContainer);
    } else {
      console.error('[schoonmaakActieForm] Error block niet gevonden!');
    }
    return;
  }
  
  // Toon loading
  console.log('[schoonmaakActieForm] Toon loading state...');
  showStateBlock('loading');
  
  try {
    // Haal match details op
    console.log('[schoonmaakActieForm] Ophalen match details voor match_id:', matchId);
    const matchData = await fetchMatchDetails(matchId);
    console.log('[schoonmaakActieForm] ✅ Match details ontvangen:', matchData);
    
    // Check of match al verwerkt is
    if (matchData.status !== 'open') {
      console.warn('[schoonmaakActieForm] ⚠️ Match is al verwerkt, status:', matchData.status);
      showStateBlock('expired');
      return;
    }
    
    console.log('[schoonmaakActieForm] Match status is open, kan doorgaan');
    
    // Sla match data op voor later gebruik in success state
    currentMatchData = matchData;
    
    // Bind match info naar UI
    console.log('[schoonmaakActieForm] Binding match info naar UI elementen...');
    bindMatchInfo(matchData);
    console.log('[schoonmaakActieForm] ✅ Match info gebind');
    
    // Toon formulier
    console.log('[schoonmaakActieForm] Toon form state...');
    showStateBlock('form');
    
    // Haal schema op
    console.log('[schoonmaakActieForm] Ophalen schema:', FORM_NAME);
    const schema = getFormSchema(FORM_NAME);
    if (!schema) {
      console.error('[schoonmaakActieForm] ❌ Schema niet gevonden voor:', FORM_NAME);
      throw new Error(`Schema niet gevonden voor ${FORM_NAME}`);
    }
    console.log('[schoonmaakActieForm] ✅ Schema gevonden:', schema);
    
    // Zoek form element
    console.log('[schoonmaakActieForm] Zoeken naar form element:', FORM_NAME);
    const formElement = document.querySelector(`[data-form-name="${FORM_NAME}"]`);
    if (!formElement) {
      console.error('[schoonmaakActieForm] ❌ Form element niet gevonden:', FORM_NAME);
      throw new Error(`Form element niet gevonden: ${FORM_NAME}`);
    }
    console.log('[schoonmaakActieForm] ✅ Form element gevonden');
    
    // Preselecteer action als in URL
    if (action === 'approve' || action === 'decline') {
      console.log('[schoonmaakActieForm] Preselecteren action uit URL:', action);
      const radio = formElement.querySelector(`[data-field-name="action"][value="${action}"]`);
      if (radio) {
        radio.checked = true;
        toggleRedenWrapper(action);
        console.log('[schoonmaakActieForm] ✅ Action radio geselecteerd:', action);
      } else {
        console.warn('[schoonmaakActieForm] ⚠️ Action radio niet gevonden voor value:', action);
      }
    }
    
    // Event listeners voor action radio
    console.log('[schoonmaakActieForm] Toevoegen event listeners voor action radios...');
    const actionRadios = formElement.querySelectorAll('[data-field-name="action"]');
    console.log('[schoonmaakActieForm] Gevonden action radios:', actionRadios.length);
    actionRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        console.log('[schoonmaakActieForm] Action gewijzigd naar:', e.target.value);
        toggleRedenWrapper(e.target.value);
      });
    });
    
    // Submit action met validatie
    const submitAction = async (formData) => {
      console.log('[schoonmaakActieForm] Submit action gestart met formData:', formData);
      const action = formData.action;
      const reden = formData.reden?.trim() || '';
      
      console.log('[schoonmaakActieForm] Action:', action, 'Reden:', reden);
      
      // Valideer dat reden verplicht is bij afwijzen
      if (action === 'decline' && !reden) {
        console.error('[schoonmaakActieForm] ❌ Reden verplicht bij afwijzen');
        throw {
          code: 'DECLINE_REASON_REQUIRED',
          message: 'Geef een reden op voor het afwijzen van deze opdracht.'
        };
      }
      
      // Call juiste API
      if (action === 'approve') {
        console.log('[schoonmaakActieForm] 🟢 Goedkeuren match...', matchId);
        await approveMatch(matchId);
        console.log('[schoonmaakActieForm] ✅ Match goedgekeurd');
        return { 
          success: true, 
          message: 'Opdracht geaccepteerd!',
          action: 'approve',
          matchType: currentMatchData?.type
        };
      } else {
        console.log('[schoonmaakActieForm] 🔴 Afwijzen match...', matchId, reden);
        await rejectMatch(matchId, reden);
        console.log('[schoonmaakActieForm] ✅ Match afgewezen');
        return { 
          success: true, 
          message: 'Opdracht afgewezen. We zoeken een andere schoonmaker.',
          action: 'decline',
          matchType: currentMatchData?.type
        };
      }
    };
    
    // Initialiseer formHandler
    console.log('[schoonmaakActieForm] Initialiseren formHandler...');
    formHandler.init({
      formName: FORM_NAME,
      schema,
      onSubmit: submitAction,
      onSuccess: (result) => {
        console.log('[schoonmaakActieForm] ✅ Submit succesvol', result);
        
        // Bind match info ook in success state (voor naam, plaats, datum, etc.)
        bindMatchInfo(currentMatchData);
        
        // Toon success state
        showStateBlock('success');
        
        // Bepaal welke success wrapper te tonen
        let wrapperName;
        if (result.action === 'decline') {
          wrapperName = 'declined';
        } else if (result.matchType === 'aanvraag') {
          wrapperName = 'approved-abonnement';
        } else {
          wrapperName = 'approved-opdracht';
        }
        
        console.log('[schoonmaakActieForm] Toon success wrapper:', wrapperName);
        showSuccessWrapper(wrapperName);
      },
      onError: (error) => {
        console.error('[schoonmaakActieForm] ❌ Submit fout', error);
        // formHandler toont automatisch error
      }
    });
    console.log('[schoonmaakActieForm] ✅ FormHandler geïnitialiseerd');
    
  } catch (error) {
    console.error('[schoonmaakActieForm] ❌ Fout bij initialiseren:', error);
    console.error('[schoonmaakActieForm] Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    
    // Toon error state
    if (error.code === 'MATCH_NOT_FOUND') {
      console.log('[schoonmaakActieForm] Toon expired state (match niet gevonden)');
      showStateBlock('expired');
    } else {
      console.log('[schoonmaakActieForm] Toon error state');
      showStateBlock('error');
      const errorBlock = document.querySelector('[data-state-block="error"]');
      if (errorBlock) {
        const message = error.message || 'Er is een fout opgetreden bij het laden van de gegevens.';
        const errorElement = errorBlock.querySelector('[data-error-message]');
        if (errorElement) {
          errorElement.textContent = message;
          console.log('[schoonmaakActieForm] Error bericht getoond:', message);
        }
      } else {
        console.error('[schoonmaakActieForm] Error block niet gevonden in DOM!');
      }
    }
  }
  
  console.log('[schoonmaakActieForm] Init functie voltooid');
}
