// public/forms/dieptereiniging/drOverzichtForm.js
// Overzicht-stap dieptereiniging: toont samenvatting van alle ingevulde gegevens

import { loadFlowData } from '../logic/formStorage.js';
import { formHandler } from '../logic/formHandler.js';

const FORM_NAME = 'dr_overzicht-form';
const FORM_SELECTOR = `[data-form-name="${FORM_NAME}"]`;
const NEXT_FORM_NAME = 'dr_persoonsgegevens-form';

function goToFormStep(nextFormName) {
  console.log('[DrOverzichtForm] goToFormStep →', nextFormName);
  if (window.navigateToFormStep) {
    const navigated = window.navigateToFormStep(FORM_NAME, nextFormName);
    if (navigated) {
      console.log('[DrOverzichtForm] navigateToFormStep succesvol', nextFormName);
      return true;
    }
    console.warn('[DrOverzichtForm] navigateToFormStep kon niet navigeren, probeer fallback.');
  }

  if (window.jumpToSlideByFormName) {
    console.log('[DrOverzichtForm] Fallback jumpToSlideByFormName', nextFormName);
    window.jumpToSlideByFormName(nextFormName);
    return true;
  }

  if (window.moveToNextSlide) {
    console.log('[DrOverzichtForm] Fallback moveToNextSlide (geen target match)');
    window.moveToNextSlide();
    return true;
  }

  console.error('[DrOverzichtForm] Geen slider navigatie functie gevonden.');
  return false;
}

function setText(selector, text) {
  const els = document.querySelectorAll(selector);
  els.forEach((el) => { if (el) el.textContent = text ?? ''; });
}

function formatCurrencyEUR(value) {
  const num = Number(value);
  if (isNaN(num)) return '';
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(num);
}

function formatNumber(value) {
  const num = Number(value);
  if (isNaN(num)) return '';
  return new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 1 }).format(num);
}

/**
 * Format datum naar DD-MM-YYYY
 */
function formatDate(dateString) {
  if (!dateString) return '—';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('nl-NL', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  } catch (e) {
    console.warn('[DrOverzichtForm] Datum parse error:', e);
    return '—';
  }
}

export function initDrOverzichtForm() {
  console.log('🧾 [DrOverzichtForm] Initialiseren overzicht…');
  const flow = loadFlowData('dieptereiniging-aanvraag') || {};

  // Adres en plaats
  const adresParts = [flow.straatnaam, flow.huisnummer].filter(Boolean);
  setText('[data-overview="adres"]', adresParts.join(' '));
  setText('[data-overview="plaats"]', flow.plaats || '');

  // Datum (verschil met abonnement: geen startweek, maar datum)
  const datumText = flow.dr_datum ? formatDate(flow.dr_datum) : '—';
  setText('[data-overview="datum"]', datumText);

  // Oppervlakte en sanitair
  setText('[data-overview="m2"]', flow.dr_m2 ?? '');
  setText('[data-overview="toiletten"]', flow.dr_toiletten ?? '');
  setText('[data-overview="badkamers"]', flow.dr_badkamers ?? '');

  // Schoonmaker-keuze
  let schoonmakerText = '';
  if (flow.schoonmakerKeuze === 'geenVoorkeur') {
    schoonmakerText = 'Geen voorkeur';
  } else if (flow.schoonmakerVoornaam) {
    schoonmakerText = flow.schoonmakerVoornaam;
  } else if (flow.schoonmakerKeuze) {
    // fallback: laat niets extra zien als we geen naam hebben
    schoonmakerText = '—';
  } else {
    schoonmakerText = '—';
  }
  setText('[data-overview="schoonmaker_keuze"]', schoonmakerText);

  // Uren en kosten
  const uren = flow.dr_uren != null ? formatNumber(flow.dr_uren) : '';
  setText('[data-overview="uren"]', uren);
  
  // Toon bedrag zonder €-teken (zoals abonnement)
  const kosten = flow.dr_prijs != null ? String(Number(flow.dr_prijs).toFixed(2)).replace('.', ',') : '';
  setText('[data-overview="kosten"]', kosten);

  console.log('✅ [DrOverzichtForm] Overzicht gevuld.');

  // Initialiseer deze stap als "formulier" zodat de Webflow-knop via formHandler werkt
  const schema = {
    name: FORM_NAME,
    selector: FORM_SELECTOR,
    fields: {},
    submit: {
      action: async () => {
        // Geen extra actie; alle data is al in de flow bewaard door eerdere stappen
        console.log('[DrOverzichtForm] Submit action - geen extra validatie nodig');
      },
      onSuccess: () => {
        console.log('[DrOverzichtForm] Submit success, navigeer naar stap 4 (persoonsgegevens)...');
        
        // Volg hetzelfde patroon als andere stappen: eerst module laden + init, daarna navigeren
        import('./drPersoonsgegevensForm.js')
          .then((m) => {
            console.log('[DrOverzichtForm] drPersoonsgegevensForm module geladen');
            if (m && typeof m.initDrPersoonsgegevensForm === 'function') {
              m.initDrPersoonsgegevensForm();
            }
            goToFormStep(NEXT_FORM_NAME);
          })
          .catch((err) => {
            console.error('[DrOverzichtForm] Kon persoonsgegevens stap niet laden:', err);
            goToFormStep(NEXT_FORM_NAME);
          });
      }
    }
  };
  
  try {
    formHandler.init(schema);
    console.log('[DrOverzichtForm] FormHandler geïnitialiseerd');
  } catch (e) {
    console.warn('[DrOverzichtForm] Kon formHandler niet initialiseren voor overzicht:', e);
  }
  
  // 🔙 PREV BUTTON HANDLER - Re-initialiseer vorige stap bij terug navigeren
  setupPrevButtonHandler();
}

/**
 * Setup prev button handler voor terug navigatie
 * Re-initialiseert stap 3 (schoonmaker) voordat er terug wordt genavigeerd
 */
// Store handler reference om duplicate listeners te voorkomen
let prevButtonHandler = null;

function setupPrevButtonHandler() {
  const prevButton = document.querySelector('[data-form-button-prev="dr_overzicht-form"]');
  
  if (!prevButton) {
    console.log('[DrOverzichtForm] Geen prev button gevonden met [data-form-button-prev="dr_overzicht-form"]');
    return;
  }
  
  console.log('[DrOverzichtForm] Prev button gevonden, event handler toevoegen...');
  
  // Verwijder oude handler indien aanwezig
  if (prevButtonHandler) {
    prevButton.removeEventListener('click', prevButtonHandler);
    console.log('[DrOverzichtForm] ♻️ Oude prev button handler verwijderd');
  }
  
  // Definieer nieuwe handler
  prevButtonHandler = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('[DrOverzichtForm] 🔙 Prev button clicked - navigeer naar stap 3 (schoonmaker)');
    
    // Re-initialiseer de VORIGE stap (stap 3 = drSchoonmakerForm) VOOR navigatie
    import('./drSchoonmakerForm.js').then(module => {
      console.log('[DrOverzichtForm] ♻️ Re-init drSchoonmakerForm voor terug navigatie...');
      module.initDrSchoonmakerForm();
      
      // NA re-init, ga naar vorige slide
      if (typeof window.moveToPrevSlide === 'function') {
        console.log('[DrOverzichtForm] Roep window.moveToPrevSlide() aan');
        window.moveToPrevSlide();
      } else {
        console.warn('[DrOverzichtForm] window.moveToPrevSlide() niet beschikbaar');
      }
    }).catch(err => {
      console.error('[DrOverzichtForm] ❌ Fout bij re-init drSchoonmakerForm:', err);
      if (typeof window.moveToPrevSlide === 'function') {
        window.moveToPrevSlide();
      }
    });
  };
  
  // Voeg nieuwe handler toe
  prevButton.addEventListener('click', prevButtonHandler);
  
  console.log('[DrOverzichtForm] ✅ Prev button handler toegevoegd');
}

