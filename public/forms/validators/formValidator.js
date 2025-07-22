// public/forms/validators/formValidator.js

/**
 * Validator functies met optionele schema-overrides voor foutmeldingen.
 * Elk geeft bij falen een string error message terug, of null bij succes.
 */
export const validators = {
  required: (value, fieldSchema) => {
    // Voor checkboxes: check of waarde 'true' is (gecheckt)
    if (fieldSchema && fieldSchema.inputType === 'checkbox') {
      const isValid = (value === 'true' || value === true);
      console.log(`🔍 [Validator] Checkbox required check: value='${value}', isValid=${isValid}`);
      return isValid ? null : 'Dit veld is verplicht.';
    }
    // Voor andere velden: check of waarde niet leeg is
    return (value.trim() === '' ? 'Dit veld is verplicht.' : null);
  },
  optional: (_value) => null,
  numeric: (value) => (/^\d+$/.test(value) ? null : 'Alleen cijfers toegestaan.'),
  alphaNumeric: (value) =>
    /^[A-Za-z0-9]+$/.test(value) ? null : 'Alleen letters en cijfers toegestaan.',
  postcode: (value) =>
    /^\d{4}[A-Za-z]{2}$/.test(value) ? null : 'Ongeldige postcode (bijv. 1234AB).',
  positiveNumber: (value) => (Number(value) > 0 ? null : 'Waarde moet groter zijn dan 0.'),
  nonNegativeNumber: (value) => (Number(value) >= 0 ? null : 'Waarde mag niet negatief zijn.'),
  email: (value) => {
    // Eenvoudige email validatie regex - bevat @ en minimaal één punt na @
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value) ? null : 'Voer een geldig e-mailadres in.';
  },
  minLength: (value, fieldSchema) => {
    const minLen = fieldSchema.minLength || 0;
    if (value.length < minLen) {
      return `Minimaal ${minLen} karakters vereist.`;
    }
    return null;
  },
  date: (value) => {
    // Basic date format validation (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(value)) {
      return 'Voer een geldige datum in (YYYY-MM-DD).';
    }
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return 'Voer een geldige datum in.';
    }
    return null;
  },
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
    // Eerst uitvoeren van de validator zelf, geef fieldSchema mee voor checkbox support
    const err = fn(value, fieldSchema);
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
