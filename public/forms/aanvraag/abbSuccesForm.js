// public/forms/aanvraag/abbSuccesForm.js
// Initialiseert de success slide na geslaagde betaling
import { loadFlowData, clearFlowData } from '../logic/formStorage.js';

export function initAbbSuccesForm() {
  const selector = '[data-form-name="abb_succes-form"]';
  const root = document.querySelector(selector);
  if (!root) return; // Slide niet aanwezig op deze pagina
  console.log('🎉 [AbbSucces] Initialiseren success slide');

  const flow = loadFlowData('abonnement-aanvraag') || {};
  // Velden vullen (indien elementen aanwezig)
  function setText(sel, val) {
    const el = root.querySelector(sel);
    if (el) el.textContent = val ?? '';
  }

  const sessions = flow.sessionsPer4W || (flow.frequentie === 'perweek' ? 4 : 2);
  setText('[data-success="naam"]', [flow.voornaam, flow.achternaam].filter(Boolean).join(' '));
  setText('[data-success="email"]', flow.emailadres || '');
  setText('[data-success="frequentie"]', flow.frequentie === 'perweek' ? 'Elke week' : 'Om de week');
  setText('[data-success="bedrag"]', flow.bundleAmount ? `€ ${flow.bundleAmount}` : '');
  setText('[data-success="sessies"]', sessions);
  setText('[data-success="payment-intent"]', flow.paymentIntentId ? flow.paymentIntentId.replace('pi_','…pi_') : '');

  // Optioneel: flow opruimen (laat basisgegevens nog even staan indien je redirect naar dashboard later nodig hebt)
  // clearFlowData('abonnement-aanvraag'); // -> comment nu uit zodat user terug niet leeg ziet.

  console.log('✅ [AbbSucces] Success slide gevuld.');
}

// Auto-init bij module load na een klein timeout zodat DOM klaar is
setTimeout(() => {
  try { initAbbSuccesForm(); } catch (e) { console.error('[AbbSucces] Init fout', e); }
}, 50);
