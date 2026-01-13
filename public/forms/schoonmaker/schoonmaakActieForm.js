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
  const blocks = ['loading', 'form', 'expired', 'error'];
  blocks.forEach(blockName => {
    const block = document.querySelector(`[data-state-block="${blockName}"]`);
    if (block) {
      block.style.display = (blockName === state) ? 'block' : 'none';
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
    const freq = matchData.aanvraag?.gewenste_frequentie === 'weekly' 
      ? '1x per week' 
      : '1x per 2 weken';
    const uren = matchData.aanvraag?.gewenste_uren || 4;
    return `${freq}, ${uren} uur per schoonmaak`;
  } else {
    const uren = matchData.opdracht?.uren || 0;
    const adminNotes = matchData.opdracht?.admin_notities || '';
    return adminNotes ? `${uren} uur - ${adminNotes}` : `${uren} uur`;
  }
}

/**
 * Bind match info naar data-match-info elementen
 */
function bindMatchInfo(matchData) {
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
    naam: matchData.klant?.voornaam || ''
  };

  Object.entries(mappings).forEach(([key, value]) => {
    const el = document.querySelector(`[data-match-info="${key}"]`);
    if (el && value !== undefined) {
      el.textContent = value;
    }
  });
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
      showError('Geen match ID gevonden in de URL.', errorBlock);
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
        coole.log('[schoonmaakActieForm] Submit action gestart met formData:', formData);
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
        return { success: true, message: 'Opdracht geaccepteerd!' };
      } else {
        console.log('[schoonmaakActieForm] 🔴 Afwijzen match...', matchId, reden);
        await rejectMatch(matchId, reden);
        console.log('[schoonmaakActieForm] ✅ Match afgewezen');
        return { success: true, message: 'Opdracht afgewezen. We zoeken een andere schoonmaker.' };
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
        // formHandler toont automatisch success state
      },
      onError: (error) => {❌ Fout bij initialiseren:', error);
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
        showError(message, errorBlock);
        console.log('[schoonmaakActieForm] Error bericht getoond:', message);
      } else {
        console.error('[schoonmaakActieForm] Error block niet gevonden in DOM!');
      }
    }
  }
  
  console.log('[schoonmaakActieForm] Init functie voltooid'); 
  } catch (error) {
    console.error('[schoonmaakActieForm] Fout bij initialiseren:', error);
    
    // Toon error state
    if (error.code === 'MATCH_NOT_FOUND') {
      showStateBlock('expired');
    } else {
      showStateBlock('error');
      const errorBlock = document.querySelector('[data-state-block="error"]');
      if (errorBlock) {
        const message = error.message || 'Er is een fout opgetreden bij het laden van de gegevens.';
        showError(message, errorBlock);
      }
    }
  }
}
