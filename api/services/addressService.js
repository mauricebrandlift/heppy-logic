// addressService: create address records
import { supabaseConfig } from '../config/index.js';
import { httpClient } from '../utils/apiClient.js';
import { getExternalAddressDetails } from '../checks/addressLookupService.js';

function uuid(){
  return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0,v=c==='x'?r:(r&0x3|0x8);return v.toString(16);});
}

export const addressService = {
  async create(meta, correlationId){
    const id = uuid();
    
    // Haal coordinaten op via externe API als postcode en huisnummer beschikbaar zijn
    let latitude = null;
    let longitude = null;
    
    if (meta.postcode && meta.huisnummer) {
      try {
        console.log(`🌍 [AddressService] Fetching coordinates for ${meta.postcode} ${meta.huisnummer} [${correlationId}]`);
        const addressDetails = await getExternalAddressDetails(meta.postcode, meta.huisnummer, correlationId);
        latitude = addressDetails.latitude || null;
        longitude = addressDetails.longitude || null;
        console.log(`✅ [AddressService] Coordinates retrieved: lat=${latitude}, lon=${longitude} [${correlationId}]`);
      } catch (error) {
        console.warn(`⚠️ [AddressService] Could not fetch coordinates: ${error.message} [${correlationId}]`);
        // Non-fatal: continue zonder coordinates
      }
    }
    
    const url = `${supabaseConfig.url}/rest/v1/adressen`;
    const body = { 
      id, 
      straat: meta.straat||null, 
      huisnummer: meta.huisnummer||null, 
      toevoeging: meta.toevoeging||null, 
      postcode: meta.postcode||null, 
      plaats: meta.plaats||null,
      latitude: latitude,
      longitude: longitude
    };
    const resp = await httpClient(url, { method:'POST', headers:{ 'Content-Type':'application/json','apikey':supabaseConfig.anonKey,'Authorization':`Bearer ${supabaseConfig.anonKey}`,'Prefer':'return=minimal' }, body: JSON.stringify(body) }, correlationId);
    if(!resp.ok) throw new Error(`adressen insert failed: ${await resp.text()}`);
    return { id };
  }
};
