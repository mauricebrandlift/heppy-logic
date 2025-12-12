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

/**
 * Enhanced audit logging with old/new values, IP address, and user agent
 * @param {Object} params
 * @param {string} params.userId - User performing the action
 * @param {string} params.action - Action identifier (e.g. 'update_profiel')
 * @param {string} [params.entityType] - Entity type being modified (e.g. 'user_profiles')
 * @param {string} [params.entityId] - Entity ID being modified
 * @param {Object} [params.oldValues] - Old values before change
 * @param {Object} [params.newValues] - New values after change
 * @param {string} [params.ipAddress] - IP address of request
 * @param {string} [params.userAgent] - User agent of request
 * @param {string} [params.correlationId] - Optional correlation ID
 */
export async function logAudit({ userId, action, entityType, entityId, oldValues, newValues, ipAddress, userAgent, correlationId }) {
  try {
    const url = `${supabaseConfig.url}/rest/v1/audit_logs`;
    
    const details = {
      entityType: entityType || null,
      oldValues: oldValues || null,
      newValues: newValues || null,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null
    };

    const body = {
      id: uuid(),
      module: 'user_account',
      entity_id: entityId || userId,
      action,
      performed_by: userId,
      details
    };

    const resp = await httpClient(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseConfig.anonKey,
        'Authorization': `Bearer ${supabaseConfig.anonKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(body)
    }, correlationId);

    if (!resp.ok) {
      const text = await resp.text();
      console.warn(JSON.stringify({
        level: 'WARN',
        correlationId,
        msg: 'audit_log_failed',
        status: resp.status,
        text
      }));
      return false;
    }

    console.log(JSON.stringify({
      level: 'INFO',
      correlationId,
      msg: 'audit_log_created',
      action,
      userId,
      entityId: entityId || userId
    }));

    return true;
  } catch (error) {
    console.warn(JSON.stringify({
      level: 'WARN',
      correlationId,
      msg: 'audit_log_exception',
      error: error.message
    }));
    return false;
  }
}
