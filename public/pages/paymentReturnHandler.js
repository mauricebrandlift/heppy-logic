// public/pages/paymentReturnHandler.js
// Vroege redirect-afhandeling vóór individuele form init zodat we niet onnodig op stap 1 blijven.
// Ondersteunt zowel abonnement als dieptereiniging flows.
import { loadFlowData, saveFlowData } from '../forms/logic/formStorage.js';
import { apiClient } from '../utils/api/client.js';
import { safeTrack, logStepCompleted } from '../utils/tracking/simpleFunnelTracker.js';

(async function handlePaymentReturnEarly(){
  try {
    const params = new URLSearchParams(window.location.search);
    const intentId = params.get('payment_intent');
    const redirectStatus = params.get('redirect_status');
    const marker = params.get('afterPayment');
    if (!intentId && !marker && !redirectStatus) return; // geen redirect context

    // Detecteer flow type: probeer alle flows te laden
    const abonnementFlow = loadFlowData('abonnement-aanvraag');
    const dieptereinigingFlow = loadFlowData('dieptereiniging-aanvraag');
    const verhuisFlow = loadFlowData('verhuis-aanvraag');
    const bankReinigingFlow = loadFlowData('bankreiniging-aanvraag');
    const tapijtFlow = loadFlowData('tapijt-aanvraag');
    
    // Bepaal actieve flow op basis van welke data aanwezig is
    let activeFlow = null;
    let flowType = null;
    let flowKey = null;
    
    // Priority order: verhuis > dieptereiniging > bankreiniging > tapijt > abonnement
    if (verhuisFlow && Object.keys(verhuisFlow).length > 1) {
      activeFlow = verhuisFlow;
      flowType = 'verhuis_opleverschoonmaak';
      flowKey = 'verhuis-aanvraag';
      console.log('[PaymentReturnEarly] Detected flow: verhuis_opleverschoonmaak');
    } else if (dieptereinigingFlow && Object.keys(dieptereinigingFlow).length > 1) {
      activeFlow = dieptereinigingFlow;
      flowType = 'dieptereiniging';
      flowKey = 'dieptereiniging-aanvraag';
      console.log('[PaymentReturnEarly] Detected flow: dieptereiniging');
    } else if (bankReinigingFlow && Object.keys(bankReinigingFlow).length > 1) {
      activeFlow = bankReinigingFlow;
      flowType = 'bankreiniging';
      flowKey = 'bankreiniging-aanvraag';
      console.log('[PaymentReturnEarly] Detected flow: bankreiniging');
    } else if (tapijtFlow && Object.keys(tapijtFlow).length > 1) {
      activeFlow = tapijtFlow;
      flowType = 'tapijt';
      flowKey = 'tapijt-aanvraag';
      console.log('[PaymentReturnEarly] Detected flow: tapijt');
    } else if (abonnementFlow && Object.keys(abonnementFlow).length > 1) {
      activeFlow = abonnementFlow;
      flowType = 'abonnement';
      flowKey = 'abonnement-aanvraag';
      console.log('[PaymentReturnEarly] Detected flow: abonnement');
    } else {
      // Geen flow data, skip
      console.warn('[PaymentReturnEarly] No flow data found');
      return;
    }

    // Sla payment intent ID op in actieve flow
    if (!activeFlow.paymentIntentId && intentId) {
      activeFlow.paymentIntentId = intentId;
      saveFlowData(flowKey, activeFlow);
    }

    if (!intentId) return; // zonder intent geen status

    const res = await apiClient(`/routes/stripe/retrieve-payment-intent?id=${encodeURIComponent(intentId)}`, { method: 'GET' });
    const status = res?.status;
    console.log('[PaymentReturnEarly] Status:', status, 'for flow:', flowType);
    const cleanUrl = window.location.origin + window.location.pathname; // alleen path


    if (status === 'succeeded') {
      // 🎯 TRACK COMPLETION - Step 6 with is_completion = true
      await safeTrack(() => logStepCompleted(flowType, 'success', 6, {
        is_completion: true,
        payment_intent_id: intentId
      }));
      
      // Redirect naar dedicated succes pagina met flow-specifieke parameters
      const base = window.location.origin;
      const intentParam = encodeURIComponent(intentId);
      
      let successUrl;
      if (flowType === 'abonnement') {
        // Abonnement: meegeven van frequentie
        const extra = activeFlow.frequentie ? `&freq=${encodeURIComponent(activeFlow.frequentie)}` : '';
        successUrl = `${base}/aanvragen/succes/abonnement?pi=${intentParam}${extra}`;
      } else if (flowType === 'dieptereiniging') {
        // Dieptereiniging: meegeven van datum, uren, m2, etc.
        const params = [];
        if (activeFlow.dr_datum) params.push(`datum=${encodeURIComponent(activeFlow.dr_datum)}`);
        if (activeFlow.dr_uren) params.push(`uren=${encodeURIComponent(activeFlow.dr_uren)}`);
        if (activeFlow.dr_m2) params.push(`m2=${encodeURIComponent(activeFlow.dr_m2)}`);
        if (activeFlow.dr_toiletten) params.push(`toiletten=${encodeURIComponent(activeFlow.dr_toiletten)}`);
        if (activeFlow.dr_badkamers) params.push(`badkamers=${encodeURIComponent(activeFlow.dr_badkamers)}`);
        const extra = params.length > 0 ? '&' + params.join('&') : '';
        successUrl = `${base}/aanvragen/succes/dieptereiniging?pi=${intentParam}${extra}`;
      } else if (flowType === 'verhuis_opleverschoonmaak') {
        // Verhuis/Opleverschoonmaak: meegeven van datum, uren, m2, etc.
        const params = [];
        if (activeFlow.vh_datum) params.push(`datum=${encodeURIComponent(activeFlow.vh_datum)}`);
        if (activeFlow.vh_uren) params.push(`uren=${encodeURIComponent(activeFlow.vh_uren)}`);
        if (activeFlow.vh_m2) params.push(`m2=${encodeURIComponent(activeFlow.vh_m2)}`);
        if (activeFlow.vh_toiletten) params.push(`toiletten=${encodeURIComponent(activeFlow.vh_toiletten)}`);
        if (activeFlow.vh_badkamers) params.push(`badkamers=${encodeURIComponent(activeFlow.vh_badkamers)}`);
        const extra = params.length > 0 ? '&' + params.join('&') : '';
        successUrl = `${base}/aanvragen/succes/verhuis-opleveringsschoonmaak?pi=${intentParam}${extra}`;
      }
      
      console.log('[PaymentReturnEarly] Redirecting to:', successUrl);
      window.location.replace(successUrl);
      return; // Stop verdere verwerking
    }
    if (status === 'processing') {
      // Laat bestaande flow doorgaan: user komt terug op betaal stap en polling in betaalmodule.
      return; // Geen redirect; user blijft waar hij is.
    }
    if (['requires_payment_method','canceled','requires_action'].includes(status)) {
      // Laat user terugvallen op betaal stap zonder redirect.
      return;
    }
  } catch (e) {
    console.warn('[PaymentReturnEarly] Fout tijdens early handling', e);
  }
})();
