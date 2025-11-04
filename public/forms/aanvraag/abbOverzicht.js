// public/forms/aanvraag/abbOverzicht.js
// Overzicht-stap: toont alleen ingevulde gegevens uit de flow

import { loadFlowData } from '../logic/formStorage.js';
import { formHandler } from '../logic/formHandler.js';

const FORM_NAME = 'abb_overzicht-form';
const FORM_SELECTOR = `[data-form-name="${FORM_NAME}"]`;
const NEXT_FORM_NAME = 'abb_persoonsgegevens-form';

function goToFormStep(nextFormName) {
  console.log('[AbbOverzicht] goToFormStep →', nextFormName);
  if (window.navigateToFormStep) {
    const navigated = window.navigateToFormStep(FORM_NAME, nextFormName);
    if (navigated) {
      console.log('[AbbOverzicht] navigateToFormStep succesvol', nextFormName);
      return true;
    }
    console.warn('[AbbOverzicht] navigateToFormStep kon niet navigeren, probeer fallback.');
  }

  if (window.jumpToSlideByFormName) {
    console.log('[AbbOverzicht] Fallback jumpToSlideByFormName', nextFormName);
    window.jumpToSlideByFormName(nextFormName);
    return true;
  }

  if (window.moveToNextSlide) {
    console.log('[AbbOverzicht] Fallback moveToNextSlide (geen target match)');
    window.moveToNextSlide();
    return true;
  }

  console.error('[AbbOverzicht] Geen slider navigatie functie gevonden.');
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

function formatFrequentie(value) {
  if (!value) return '—';
  const mapping = {
    perweek: 'Elke week (1× per week)',
    pertweeweek: 'Om de week (1× per 2 weken)',
  };
  const normalized = String(value).trim().toLowerCase();
  return mapping[normalized] || value;
}

// Bepaal maandag (ISO) van een gegeven week in een jaar
function getMondayOfISOWeek(week, year) {
  // 4 januari is altijd in week 1 volgens ISO 8601
  const simple = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = simple.getUTCDay() || 7; // 1..7
  // Maandag van week 1
  const mondayWeek1 = new Date(simple);
  mondayWeek1.setUTCDate(simple.getUTCDate() - dayOfWeek + 1);
  // Maandag van gewenste week
  const monday = new Date(mondayWeek1);
  monday.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7);
  return monday;
}

function formatWeekRange(week) {
  const now = new Date();
  const year = now.getFullYear();
  if (!week || isNaN(Number(week))) return '';
  const monday = getMondayOfISOWeek(Number(week), year);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const fmt = (d) => d.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `Startweek ${week}. Dit is de week van ${fmt(monday)} t/m ${fmt(sunday)}.`;
}

export function initAbbOverzicht() {
  console.log('🧾 [AbbOverzicht] Initialiseren overzicht…');
  const flow = loadFlowData('abonnement-aanvraag') || {};

  // Frequentie (optioneel in flow)
  const frequentieValue = flow.abb_frequentie || flow.frequentie || '';
  setText('[data-overview="frequentie"]', formatFrequentie(frequentieValue));

  // Startweek: weeknr + datum-range
  const weeknr = flow.weeknr || flow.startweek || '';
  const weekText = weeknr ? formatWeekRange(weeknr) : '';
  setText('[data-overview="startweek"]', weekText);

  // Adres en plaats
  const adresParts = [flow.straatnaam, flow.huisnummer].filter(Boolean);
  setText('[data-overview="adres"]', adresParts.join(' '));
  setText('[data-overview="plaats"]', flow.plaats || '');

  // Oppervlakte en sanitair
  setText('[data-overview="m2"]', flow.abb_m2 ?? '');
  setText('[data-overview="toiletten"]', flow.abb_toiletten ?? '');
  setText('[data-overview="badkamers"]', flow.abb_badkamers ?? '');

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
  const uren = flow.abb_uren != null ? formatNumber(flow.abb_uren) : '';
  setText('[data-overview="uren"]', uren);
  // Toon bedrag zonder €-teken
  const kosten = flow.abb_prijs != null ? String(Number(flow.abb_prijs).toFixed(2)).replace('.', ',') : '';
  setText('[data-overview="kosten"]', kosten);

  console.log('✅ [AbbOverzicht] Overzicht gevuld.');

  // Initialiseer deze stap als "formulier" zodat de Webflow-knop via formHandler werkt
  const schema = {
    name: FORM_NAME,
    selector: FORM_SELECTOR,
    fields: {},
    submit: {
      action: async () => {
        // Geen extra actie; alle data is al in de flow bewaard door eerdere stappen
      },
      onSuccess: () => {
        // Volg hetzelfde patroon als andere stappen: eerst module laden + init, daarna navigeren
        import('./abbPersoonsgegevensForm.js')
          .then((m) => {
            if (m && typeof m.initAbbPersoonsgegevensForm === 'function') {
              m.initAbbPersoonsgegevensForm();
            }
            goToFormStep(NEXT_FORM_NAME);
          })
          .catch((err) => {
            console.error('[AbbOverzicht] Kon persoonsgegevens stap niet laden:', err);
            goToFormStep(NEXT_FORM_NAME);
          });
      }
    }
  };
  try {
    formHandler.init(schema);
  } catch (e) {
    console.warn('[AbbOverzicht] Kon formHandler niet initialiseren voor overzicht:', e);
  }
  
  // 🔙 PREV BUTTON HANDLER - Re-initialiseer vorige stap bij terug navigeren
  setupPrevButtonHandler();
}

/**
 * Setup prev button handler voor terug navigatie
 * Re-initialiseert stap 3 (dagdelen/schoonmaker) voordat er terug wordt genavigeerd
 */
// Store handler reference om duplicate listeners te voorkomen
let prevButtonHandler = null;

function setupPrevButtonHandler() {
  const prevButton = document.querySelector('[data-form-button-prev="abb_overzicht-form"]');
  
  if (!prevButton) {
    console.log('[AbbOverzicht] Geen prev button gevonden met [data-form-button-prev="abb_overzicht-form"]');
    return;
  }
  
  console.log('[AbbOverzicht] Prev button gevonden, event handler toevoegen...');
  
  // Verwijder oude handler indien aanwezig
  if (prevButtonHandler) {
    prevButton.removeEventListener('click', prevButtonHandler);
    console.log('[AbbOverzicht] ♻️ Oude prev button handler verwijderd');
  }
  
  // Definieer nieuwe handler
  prevButtonHandler = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('[AbbOverzicht] 🔙 Prev button clicked - navigeer naar stap 3 (dagdelen/schoonmaker)');
    
    // Re-initialiseer de VORIGE stap (stap 3 = abbDagdelenSchoonmakerForm) VOOR navigatie
    import('./abbDagdelenSchoonmakerForm.js').then(module => {
      console.log('[AbbOverzicht] ♻️ Re-init abbDagdelenSchoonmakerForm voor terug navigatie...');
      module.initAbbDagdelenSchoonmakerForm();
      
      // NA re-init, ga naar vorige slide
      if (typeof window.moveToPrevSlide === 'function') {
        console.log('[AbbOverzicht] Roep window.moveToPrevSlide() aan');
        window.moveToPrevSlide();
      } else {
        console.warn('[AbbOverzicht] window.moveToPrevSlide() niet beschikbaar');
      }
    }).catch(err => {
      console.error('[AbbOverzicht] ❌ Fout bij re-init abbDagdelenSchoonmakerForm:', err);
      if (typeof window.moveToPrevSlide === 'function') {
        window.moveToPrevSlide();
      }
    });
  };
  
  // Voeg nieuwe handler toe
  prevButton.addEventListener('click', prevButtonHandler);
  
  console.log('[AbbOverzicht] ✅ Prev button handler toegevoegd');
}
