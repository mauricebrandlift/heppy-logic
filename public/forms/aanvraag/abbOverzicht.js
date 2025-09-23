// public/forms/aanvraag/abbOverzicht.js
// Overzicht-stap: toont alleen ingevulde gegevens uit de flow

import { loadFlowData } from '../logic/formStorage.js';
import { formHandler } from '../logic/formHandler.js';

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
  setText('[data-overview="frequentie"]', flow.abb_frequentie || flow.frequentie || '—');

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
    name: 'abb_overzicht-form',
    selector: '[data-form-name="abb_overzicht-form"]',
    fields: {},
    submit: {
      action: async () => {
        // Geen extra actie; alle data is al in de flow bewaard door eerdere stappen
      },
      onSuccess: () => {
        // Eerst naar de volgende slide navigeren
        if (typeof moveToNextSlide === 'function') {
          moveToNextSlide();
        }
        // Daarna (asynchroon) de volgende stap initialiseren om event-collision te voorkomen
        setTimeout(() => {
          try {
            import('./abbPersoonsgegevensForm.js').then((m) => {
              if (m && typeof m.initAbbPersoonsgegevensForm === 'function') {
                m.initAbbPersoonsgegevensForm();
              }
            }).catch((e) => console.warn('[AbbOverzicht] Kon persoonsgegevens stap niet laden na navigatie:', e));
          } catch (e) {
            console.warn('[AbbOverzicht] Dynamische import niet ondersteund:', e);
          }
        }, 0);
      }
    }
  };
  try {
    formHandler.init(schema);
  } catch (e) {
    console.warn('[AbbOverzicht] Kon formHandler niet initialiseren voor overzicht:', e);
  }
}
