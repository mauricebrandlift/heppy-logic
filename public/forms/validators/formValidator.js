// public/forms/validators/formValidator.js

/**
 * Validator functies met optionele schema-overrides voor foutmeldingen.
 * Elk geeft bij falen een string error message terug, of null bij succes.
 */
export const validators = {
  required: (value) => (value.trim() === '' ? 'Dit veld is verplicht.' : null),
  optional: (_value) => null,
  numeric: (value) => (/^\d+$/.test(value) ? null : 'Alleen cijfers toegestaan.'),
  alphaNumeric: (value) =>
    /^[A-Za-z0-9]+$/.test(value) ? null : 'Alleen letters en cijfers toegestaan.',
  postcode: (value) =>
    /^\d{4}[A-Za-z]{2}$/.test(value) ? null : 'Ongeldige postcode (bijv. 1234AB).',
  positiveNumber: (value) => (Number(value) > 0 ? null : 'Waarde moet groter zijn dan 0.'),
  nonNegativeNumber: (value) => (Number(value) >= 0 ? null : 'Waarde mag niet negatief zijn.'),
};

/**
 * Validatie van één veld, met override via schema.messages
 * @param {string} fieldName - Naam van het veld
 * @param {string} value - De gesanitiseerde waarde
 * @param {object} fieldSchema - Config incl. validators en messages
 * @returns {string|null} - Foutmelding of null bij geen fout
 */
export function validateField(fieldName, value, fieldSchema) {
  const { validators: list = [], messages: override = {} } = fieldSchema;
  for (const name of list) {
    const fn = validators[name];
    if (typeof fn !== 'function') {
      console.warn(`⚠️ [Validator] Geen validator gevonden voor '${name}' in veld '${fieldName}'`);
      continue;
    }
    // Eerst uitvoeren van de validator zelf
    const err = fn(value);
    if (err) {
      // Alleen bij falen de override uit schema gebruiken
      return override[name] || err;
    }
  }
  return null;
}

/**
 * Validatie van complete formulier.
 * @param {object} formData - map met veldwaarden
 * @param {object} formSchema - Schema incl. fields en globalMessages
 * @param {object} formState - State per veld (bv. isTouched), optioneel
 * @returns {object} - { isFormValid, fieldErrors, allErrors }
 */
export function validateForm(formData, formSchema, formState = {}) {
  const fieldErrors = {};
  const allErrors = [];
  let isFormValid = true;

  for (const [fieldName, cfg] of Object.entries(formSchema.fields)) {
    const raw = String(formData[fieldName] ?? '');
    // Skip optional empty
    if (cfg.validators.includes('optional') && raw.trim() === '') {
      continue;
    }
    const msg = validateField(fieldName, raw, cfg);
    if (msg) {
      fieldErrors[fieldName] = msg;
      allErrors.push({ field: fieldName, message: msg });
      isFormValid = false;
    }
  }

  return { isFormValid, fieldErrors, allErrors };
}
