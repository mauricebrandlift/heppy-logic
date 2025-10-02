// addressService: create address records
import { supabaseConfig } from '../config/index.js';
import { httpClient } from '../utils/apiClient.js';

function uuid(){
  return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0,v=c==='x'?r:(r&0x3|0x8);return v.toString(16);});
}

export const addressService = {
  async create(meta, correlationId){
    const id = uuid();
    const url = `${supabaseConfig.url}/rest/v1/adressen`;
    const body = { id, straat: meta.straat||null, huisnummer: meta.huisnummer||null, toevoeging: meta.toevoeging||null, postcode: meta.postcode||null, plaats: meta.plaats||null };
    const resp = await httpClient(url, { method:'POST', headers:{ 'Content-Type':'application/json','apikey':supabaseConfig.anonKey,'Authorization':`Bearer ${supabaseConfig.anonKey}`,'Prefer':'return=minimal' }, body: JSON.stringify(body) }, correlationId);
    if(!resp.ok) throw new Error(`adressen insert failed: ${await resp.text()}`);
    return { id };
  }
};
