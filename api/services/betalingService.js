// betalingService: idempotency + payment linking
import { supabaseConfig } from '../config/index.js';
import { httpClient } from '../utils/apiClient.js';

function uuid(){
  return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0,v=c==='x'?r:(r&0x3|0x8);return v.toString(16);});
}

async function selectByStripeId(stripeId, correlationId){
  const url = `${supabaseConfig.url}/rest/v1/betalingen?stripe_payment_id=eq.${stripeId}&select=id,abonnement_id,gebruiker_id`;
  const resp = await httpClient(url, { headers:{ 'apikey':supabaseConfig.anonKey,'Authorization':`Bearer ${supabaseConfig.anonKey}` } }, correlationId);
  if(!resp.ok) throw new Error(`betalingen select failed: ${await resp.text()}`);
  return resp.json();
}
async function insertBetaling({ stripeId, userId, abonnementId, amount, currency, status, stripe_status }, correlationId){
  const url = `${supabaseConfig.url}/rest/v1/betalingen`;
  const body = { id: uuid(), gebruiker_id: userId, abonnement_id: abonnementId||null, amount_cents: amount, currency, stripe_payment_id: stripeId, status, stripe_status };
  const resp = await httpClient(url, { method:'POST', headers:{ 'Content-Type':'application/json','apikey':supabaseConfig.anonKey,'Authorization':`Bearer ${supabaseConfig.anonKey}`,'Prefer':'return=minimal' }, body: JSON.stringify(body) }, correlationId);
  if(!resp.ok) throw new Error(`betalingen insert failed: ${await resp.text()}`);
  return { id: body.id };
}
async function patchBetaling(stripeId, body, correlationId){
  const url = `${supabaseConfig.url}/rest/v1/betalingen?stripe_payment_id=eq.${stripeId}`;
  const resp = await httpClient(url, { method:'PATCH', headers:{ 'Content-Type':'application/json','apikey':supabaseConfig.anonKey,'Authorization':`Bearer ${supabaseConfig.anonKey}`,'Prefer':'return=minimal' }, body: JSON.stringify(body) }, correlationId);
  if(!resp.ok) throw new Error(`betalingen patch failed: ${await resp.text()}`);
}

export const betalingService = {
  async findByStripePaymentId(stripeId, correlationId){
    const rows = await selectByStripeId(stripeId, correlationId);
    return rows.length ? rows[0] : null;
  },
  async linkOrCreate({ stripeId, userId, abonnementId, amount, currency, status, stripe_status }, correlationId){
    const existing = await selectByStripeId(stripeId, correlationId);
    if(existing.length){
      await patchBetaling(stripeId, { abonnement_id: abonnementId||existing[0].abonnement_id||null, gebruiker_id: userId, amount_cents: amount, currency, status, stripe_status }, correlationId);
      return { id: existing[0].id, updated:true };
    }
    const created = await insertBetaling({ stripeId, userId, abonnementId, amount, currency, status, stripe_status }, correlationId);
    return { id: created.id, created:true };
  }
};
