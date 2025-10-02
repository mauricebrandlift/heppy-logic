// auditService: append-only audit logging
import { supabaseConfig } from '../config/index.js';
import { httpClient } from '../utils/apiClient.js';

function uuid(){
  return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0,v=c==='x'?r:(r&0x3|0x8);return v.toString(16);});
}

export const auditService = {
  async log(module, entityId, action, performedBy, details, correlationId){
    try {
      const url = `${supabaseConfig.url}/rest/v1/audit_logs`;
      const body = { id: uuid(), module, entity_id: entityId, action, performed_by: performedBy||null, details: details||null };
      const resp = await httpClient(url, { method:'POST', headers:{ 'Content-Type':'application/json','apikey':supabaseConfig.anonKey,'Authorization':`Bearer ${supabaseConfig.anonKey}`,'Prefer':'return=minimal' }, body: JSON.stringify(body) }, correlationId);
      if(!resp.ok){
        const t = await resp.text();
        console.warn(JSON.stringify({ level:'WARN', correlationId, msg:'audit_insert_failed', status: resp.status, text: t }));
      }
      return true;
    } catch(e){
      console.warn(JSON.stringify({ level:'WARN', correlationId, msg:'audit_exception', error:e.message }));
      return false;
    }
  }
};
