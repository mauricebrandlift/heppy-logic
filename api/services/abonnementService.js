// abonnementService: create abonnement records
import { supabaseConfig } from '../config/index.js';
import { httpClient } from '../utils/apiClient.js';

function uuid(){
  return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0,v=c==='x'?r:(r&0x3|0x8);return v.toString(16);});
}

/**
 * Bereken volgende factuur datum op basis van frequentie
 * @param {string} startdatum - ISO date string (YYYY-MM-DD)
 * @param {string} frequentie - 'weekly', 'pertweeweek', 'pervierweken'
 * @returns {string|null} ISO date string voor next billing
 */
function calculateNextBillingDate(startdatum, frequentie) {
  if (!startdatum || !frequentie) return null;
  
  try {
    const start = new Date(startdatum);
    
    // Bereken aantal dagen om toe te voegen
    let daysToAdd;
    switch(frequentie) {
      case 'weekly':
        daysToAdd = 7;
        break;
      case 'pertweeweek':
        daysToAdd = 14;
        break;
      case 'pervierweken':
        daysToAdd = 28;
        break;
      default:
        console.warn(`Unknown frequentie: ${frequentie}, defaulting to 28 days`);
        daysToAdd = 28;
    }
    
    const nextBilling = new Date(start);
    nextBilling.setDate(nextBilling.getDate() + daysToAdd);
    
    // Return als ISO string (YYYY-MM-DD)
    return nextBilling.toISOString().split('T')[0];
  } catch (error) {
    console.error(`Error calculating next_billing_date: ${error.message}`);
    return null;
  }
}

export const abonnementService = {
  async create(meta, userId, aanvraagId, correlationId){
    const id = uuid();
    
    // Bereken next_billing_date
    const nextBillingDate = calculateNextBillingDate(meta.startdatum, meta.frequentie);
    console.log(`📅 [AbonnementService] Calculated next_billing_date: ${nextBillingDate} (from ${meta.startdatum} + ${meta.frequentie}) [${correlationId}]`);
    
    const url = `${supabaseConfig.url}/rest/v1/abonnementen`;
    const body = { 
      id, 
      gebruiker_id: userId, 
      schoonmaak_aanvraag_id: aanvraagId, 
      uren: meta.uren||null, 
      startdatum: meta.startdatum||null, 
      status:'wachtrij', 
      frequentie: meta.frequentie||null, 
      sessions_per_4w: meta.sessions_per_4w||null, 
      prijs_per_sessie_cents: meta.prijs_per_sessie_cents||null, 
      bundle_amount_cents: meta.bundle_amount_cents||null, 
      next_billing_date: nextBillingDate,
      last_billed_at: new Date().toISOString() // Eerste betaling is NU
    };
    const resp = await httpClient(url, { method:'POST', headers:{ 'Content-Type':'application/json','apikey':supabaseConfig.anonKey,'Authorization':`Bearer ${supabaseConfig.anonKey}`,'Prefer':'return=minimal' }, body: JSON.stringify(body) }, correlationId);
    if(!resp.ok) throw new Error(`abonnementen insert failed: ${await resp.text()}`);
    return { id };
  },

  async updatePaymentMethod(abonnementId, paymentMethodId, correlationId){
    console.log(`💳 [AbonnementService] Updating payment method for ${abonnementId}: ${paymentMethodId} [${correlationId}]`);
    const url = `${supabaseConfig.url}/rest/v1/abonnementen?id=eq.${abonnementId}`;
    const resp = await httpClient(url, { 
      method:'PATCH', 
      headers:{ 
        'Content-Type':'application/json',
        'apikey':supabaseConfig.anonKey,
        'Authorization':`Bearer ${supabaseConfig.anonKey}`,
        'Prefer':'return=minimal' 
      }, 
      body: JSON.stringify({ stripe_payment_method_id: paymentMethodId }) 
    }, correlationId);
    if(!resp.ok) throw new Error(`abonnement payment method update failed: ${await resp.text()}`);
    console.log(`✅ [AbonnementService] Payment method updated [${correlationId}]`);
  }
};
