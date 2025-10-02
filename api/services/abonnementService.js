// abonnementService: create abonnement records
import { supabaseConfig } from '../config/index.js';
import { httpClient } from '../utils/apiClient.js';

function uuid(){
  return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0,v=c==='x'?r:(r&0x3|0x8);return v.toString(16);});
}

export const abonnementService = {
  async create(meta, userId, aanvraagId, correlationId){
    const id = uuid();
    const url = `${supabaseConfig.url}/rest/v1/abonnementen`;
    const body = { id, gebruiker_id: userId, schoonmaak_aanvraag_id: aanvraagId, uren: meta.uren||null, startdatum: meta.startdatum||null, status:'wachtrij', frequentie: meta.frequentie||null, sessions_per_4w: meta.sessions_per_4w||null, prijs_per_sessie_cents: meta.prijs_per_sessie_cents||null, bundle_amount_cents: meta.bundle_amount_cents||null, next_billing_date: meta.next_billing_date||null };
    const resp = await httpClient(url, { method:'POST', headers:{ 'Content-Type':'application/json','apikey':supabaseConfig.anonKey,'Authorization':`Bearer ${supabaseConfig.anonKey}`,'Prefer':'return=minimal' }, body: JSON.stringify(body) }, correlationId);
    if(!resp.ok) throw new Error(`abonnementen insert failed: ${await resp.text()}`);
    return { id };
  }
};
