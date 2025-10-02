// intakeService: update intake status by stripe payment intent id
import { supabaseConfig } from '../config/index.js';
import { httpClient } from '../utils/apiClient.js';

export const intakeService = {
  async updateStatus(paymentIntentId, status, correlationId){
    try {
      const url = `${supabaseConfig.url}/rest/v1/intakes?stripe_payment_intent_id=eq.${paymentIntentId}`;
      const body = { status, last_activity: new Date().toISOString() };
      const resp = await httpClient(url, { method:'PATCH', headers:{ 'Content-Type':'application/json','apikey':supabaseConfig.anonKey,'Authorization':`Bearer ${supabaseConfig.anonKey}`,'Prefer':'return=minimal' }, body: JSON.stringify(body) }, correlationId);
      if(!resp.ok){
        const t = await resp.text();
        console.warn(JSON.stringify({ level:'WARN', correlationId, msg:'intake_update_failed', status: resp.status, text: t }));
      }
      return true;
    } catch(e){
      console.warn(JSON.stringify({ level:'WARN', correlationId, msg:'intake_update_exception', error:e.message }));
      return false;
    }
  }
};
