// userService: find/create users + user_profiles (idempotent by email)
import { supabaseConfig } from '../config/index.js';
import { httpClient } from '../utils/apiClient.js';

function uuid(){
  return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0,v=c==='x'?r:(r&0x3|0x8);return v.toString(16);});
}

async function selectUserByEmail(email, correlationId){
  const url = `${supabaseConfig.url}/rest/v1/user_profiles?email=eq.${encodeURIComponent(email)}&select=id`;
  const resp = await httpClient(url, { headers:{ 'apikey':supabaseConfig.anonKey,'Authorization':`Bearer ${supabaseConfig.anonKey}` } }, correlationId);
  if(!resp.ok) throw new Error(`user_profiles select failed: ${await resp.text()}`);
  return resp.json();
}
async function insertUserProfile({ email, voornaam, achternaam, telefoon, rol }, correlationId){
  const id = uuid();
  const url = `${supabaseConfig.url}/rest/v1/user_profiles`;
  const body = { id, email: email||null, voornaam: voornaam||null, achternaam: achternaam||null, telefoon: telefoon||null, rol: rol||'klant' };
  const resp = await httpClient(url, { method:'POST', headers:{ 'Content-Type':'application/json','apikey':supabaseConfig.anonKey,'Authorization':`Bearer ${supabaseConfig.anonKey}`,'Prefer':'return=minimal' }, body: JSON.stringify(body) }, correlationId);
  if(!resp.ok) throw new Error(`user_profiles insert failed: ${await resp.text()}`);
  return { id };
}

export const userService = {
  async findOrCreateByEmail(meta, correlationId){
    if(!meta.email) throw new Error('email required for user creation');
    const existing = await selectUserByEmail(meta.email, correlationId);
    if(existing.length){
      return { id: existing[0].id, created:false };
    }
    const created = await insertUserProfile({ email: meta.email, voornaam: meta.voornaam, achternaam: meta.achternaam, telefoon: meta.telefoon, rol:'klant' }, correlationId);
    return { id: created.id, created:true };
  }
};
