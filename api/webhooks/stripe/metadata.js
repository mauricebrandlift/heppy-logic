// Metadata contract + mapping + validation used by Stripe payment flows

// Abonnement required fields
export const abonnementRequiredFields = ['email','frequentie','prijs_per_sessie_cents','bundle_amount_cents'];

// Dieptereiniging required fields
export const dieptereinigingRequiredFields = ['email','dr_datum','dr_uren'];

export const metadataContract = {
  required: abonnementRequiredFields, // Default for backwards compatibility
  optional: [
    'voornaam','achternaam','telefoon','wachtwoord',
    'straat','huisnummer','toevoeging','postcode','plaats',
    'uren','sessions_per_4w','startdatum','next_billing_date',
    'schoonmaker_id','dagdelen','aanvraagId','flow','auto_assigned',
    // Dieptereiniging specific
    'dr_datum','dr_uren','dr_m2','dr_toiletten','dr_badkamers',
    'calc_source','calc_uren','calc_price_per_hour','calc_total_amount_eur'
  ]
};

export function mapAndNormalizeMetadata(raw={}){
  const result = {};
  
  // Map alle velden
  for (const key of [...abonnementRequiredFields, ...dieptereinigingRequiredFields, ...metadataContract.optional]){
    if (raw[key] !== undefined && raw[key] !== '') {
      result[key] = raw[key];
    }
  }
  
  // Convert numerieke velden naar numbers
  [
    'prijs_per_sessie_cents','bundle_amount_cents','sessions_per_4w','uren',
    'dr_uren','dr_m2','dr_toiletten','dr_badkamers',
    'calc_uren','calc_price_per_hour','calc_total_amount_eur'
  ].forEach(k => { 
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

export function validateMetadata(meta, flow = 'abonnement'){
  let requiredFields;
  
  if (flow === 'dieptereiniging') {
    requiredFields = dieptereinigingRequiredFields;
  } else {
    requiredFields = abonnementRequiredFields;
  }
  
  const missing = requiredFields.filter(k => meta[k] === undefined || meta[k] === null || meta[k] === '');
  return { valid: missing.length === 0, missing };
}
