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
  
  // Validatie
  if (!matchId) {
    showStateBlock('error');
    const errorBlock = document.querySelector('[data-state-block="error"]');
    if (errorBlock) {
      showError('Geen match ID gevonden in de URL.', errorBlock);
    }
    return;
  }
  
  // Toon loading
  showStateBlock('loading');
  
  try {
    // Haal match details op
    console.log('[schoonmaakActieForm] Ophalen match details...', matchId);
    const matchData = await fetchMatchDetails(matchId);
    console.log('[schoonmaakActieForm] Match details:', matchData);
    
    // Check of match al verwerkt is
    if (matchData.status !== 'open') {
      console.log('[schoonmaakActieForm] Match is al verwerkt:', matchData.status);
      showStateBlock('expired');
      return;
    }
    
    // Bind match info naar UI
    bindMatchInfo(matchData);
    
    // Toon formulier
    showStateBlock('form');
    
    // Haal schema op
    const schema = getFormSchema(FORM_NAME);
    if (!schema) {
      throw new Error(`Schema niet gevonden voor ${FORM_NAME}`);
    }
    
    // Zoek form element
    const formElement = document.querySelector(`[data-form-name="${FORM_NAME}"]`);
    if (!formElement) {
      throw new Error(`Form element niet gevonden: ${FORM_NAME}`);
    }
    
    // Preselecteer action als in URL
    if (action === 'approve' || action === 'decline') {
      const radio = formElement.querySelector(`[data-field-name="action"][value="${action}"]`);
      if (radio) {
        radio.checked = true;
        toggleRedenWrapper(action);
      }
    }
    
    // Event listeners voor action radio
    const actionRadios = formElement.querySelectorAll('[data-field-name="action"]');
    actionRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        toggleRedenWrapper(e.target.value);
      });
    });
    
    // Submit action met validatie
    const submitAction = async (formData) => {
      const action = formData.action;
      const reden = formData.reden?.trim() || '';
      
      // Valideer dat reden verplicht is bij afwijzen
      if (action === 'decline' && !reden) {
        throw {
          code: 'DECLINE_REASON_REQUIRED',
          message: 'Geef een reden op voor het afwijzen van deze opdracht.'
        };
      }
      
      // Call juiste API
      if (action === 'approve') {
        console.log('[schoonmaakActieForm] Goedkeuren match...', matchId);
        await approveMatch(matchId);
        return { success: true, message: 'Opdracht geaccepteerd!' };
      } else {
        console.log('[schoonmaakActieForm] Afwijzen match...', matchId, reden);
        await rejectMatch(matchId, reden);
        return { success: true, message: 'Opdracht afgewezen. We zoeken een andere schoonmaker.' };
      }
    };
    
    // Initialiseer formHandler
    formHandler.init({
      formName: FORM_NAME,
      schema,
      onSubmit: submitAction,
      onSuccess: (result) => {
        console.log('[schoonmaakActieForm] Submit succesvol', result);
        // formHandler toont automatisch success state
      },
      onError: (error) => {
        console.error('[schoonmaakActieForm] Submit fout', error);
        // formHandler toont automatisch error
      }
    });
    
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
