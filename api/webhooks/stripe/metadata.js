// Metadata contract + mapping + validation used by Stripe payment flows

export const metadataContract = {
  required: ['email','frequentie','prijs_per_sessie_cents','bundle_amount_cents'],
  optional: ['voornaam','achternaam','telefoon','straat','huisnummer','toevoeging','postcode','plaats','uren','sessions_per_4w','startdatum','next_billing_date']
};

export function mapAndNormalizeMetadata(raw={}){
  const result = {};
  for (const key of [...metadataContract.required, ...metadataContract.optional]){
    if (raw[key] !== undefined) result[key] = raw[key];
  }
  ['prijs_per_sessie_cents','bundle_amount_cents','sessions_per_4w','uren'].forEach(k => { if(result[k] != null) result[k] = Number(result[k]); });
  return result;
}

export function validateMetadata(meta){
  const missing = metadataContract.required.filter(k => meta[k] === undefined || meta[k] === null || meta[k] === '');
  return { valid: missing.length === 0, missing };
}
