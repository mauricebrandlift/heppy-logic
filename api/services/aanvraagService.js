// aanvraagService: create schoonmaak_aanvraag
import { supabaseConfig } from '../config/index.js';
import { httpClient } from '../utils/apiClient.js';

function uuid(){
  return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0,v=c==='x'?r:(r&0x3|0x8);return v.toString(16);});
}

export const aanvraagService = {
  async create(meta, addressId, correlationId){
    const id = uuid();
    const url = `${supabaseConfig.url}/rest/v1/schoonmaak_aanvragen`;
    const body = { id, voornaam: meta.voornaam||null, achternaam: meta.achternaam||null, email: meta.email||null, telefoon: meta.telefoon||null, adres_id: addressId, uren: meta.uren||null, startdatum: meta.startdatum||null, schoonmaak_optie: meta.frequentie||null, status: 'betaald' };
    const resp = await httpClient(url, { method:'POST', headers:{ 'Content-Type':'application/json','apikey':supabaseConfig.anonKey,'Authorization':`Bearer ${supabaseConfig.anonKey}`,'Prefer':'return=minimal' }, body: JSON.stringify(body) }, correlationId);
    if(!resp.ok) throw new Error(`schoonmaak_aanvragen insert failed: ${await resp.text()}`);
    return { id };
  }
};
