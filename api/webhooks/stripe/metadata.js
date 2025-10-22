// Metadata contract + mapping + validation used by Stripe payment flows

export const metadataContract = {
  required: ['email','frequentie','prijs_per_sessie_cents','bundle_amount_cents'],
  optional: [
    'voornaam','achternaam','telefoon',
    'straat','huisnummer','toevoeging','postcode','plaats',
    'uren','sessions_per_4w','startdatum','next_billing_date',
    'schoonmaker_id','dagdelen','aanvraagId','flow'
  ]
};

export function mapAndNormalizeMetadata(raw={}){
  const result = {};
  
  // Map alle velden
  for (const key of [...metadataContract.required, ...metadataContract.optional]){
    if (raw[key] !== undefined && raw[key] !== '') {
      result[key] = raw[key];
    }
  }
  
  // Convert numerieke velden naar numbers
  ['prijs_per_sessie_cents','bundle_amount_cents','sessions_per_4w','uren'].forEach(k => { 
    if(result[k] != null) {
      const num = Number(result[k]);
      if (!isNaN(num)) result[k] = num;
    }
  });
  
  // Parse dagdelen JSON als het een string is
  if (result.dagdelen && typeof result.dagdelen === 'string') {
    try {
      result.dagdelen = JSON.parse(result.dagdelen);
    } catch (e) {
      console.warn('[Metadata] Could not parse dagdelen JSON:', result.dagdelen);
      delete result.dagdelen; // Verwijder ongeldig veld
    }
  }
  
  return result;
}

export function validateMetadata(meta){
  const missing = metadataContract.required.filter(k => meta[k] === undefined || meta[k] === null || meta[k] === '');
  return { valid: missing.length === 0, missing };
}
