// public/forms/validators/formValidator.js

/**
 * Validator functies met optionele schema-overrides voor foutmeldingen.
 * Elk geeft bij falen een string error message terug, of null bij succes.
 */
export const validators = {
  required: (value) =>
    value.trim() === '' ? 'Dit veld is verplicht.' : null,
  optional: (_value) => null,
  numeric: (value) =>
    /^\d+$/.test(value) ? null : 'Alleen cijfers toegestaan.',
  alphaNumeric: (value) =>
    /^[A-Za-z0-9]+$/.test(value)
      ? null
      : 'Alleen letters en cijfers toegestaan.',
  postcode: (value) =>
    /^\d{4}[A-Za-z]{2}$/.test(value)
      ? null
      : 'Ongeldige postcode (bijv. 1234AB).',
};

/**
 * Validatie van één veld, met override via schema.messages
 * @param {string} fieldName - Naam van het veld
 * @param {string} value - De gesanitiseerde waarde
 * @param {object} fieldSchema - Config uit formSchemas.js (incl. validators en messages)
 * @returns {string|null} - Foutmelding of null bij geen fout
 */
export function validateField(fieldName, value, fieldSchema) {
  const { validators: list = [], messages: override = {} } = fieldSchema;
  for (const name of list) {
    // eerst kijken of er in het schema een override-bericht is
    const customMessage = override[name];
    let error = null;

    if (customMessage) {
      error = customMessage;
    } else {
      const fn = validators[name];
      if (typeof fn !== 'function') {
        console.warn(
          `⚠️ [Validator] Geen validator gevonden voor '${name}' in veld '${fieldName}'`
        );
        continue;
      }
      error = fn(value);
    }

    if (error) {
      return error;
    }
  }
  return null;
}

/**
 * Validatie van complete formulier.
 * @param {object} formData - Key/value map met alle veldwaarden
 * @param {object} formSchema - Schema uit formSchemas.js
 * @param {object} formState - State per veld (bv. isTouched), optioneel
 * @returns {object} - { isFormValid: boolean, fieldErrors: object, allErrors: Array<{field?:string,message:string}> }
 */
export function validateForm(formData, formSchema, formState = {}) {
  const fieldErrors = {};
  const allErrors = [];
  let isFormValid = true;

  for (const [fieldName, cfg] of Object.entries(formSchema.fields)) {
    const rawValue = String(formData[fieldName] ?? '');

    // sla optionele lege velden over
    if (
      cfg.validators.includes('optional') &&
      rawValue.trim() === ''
    ) {
      continue;
    }

    const message = validateField(fieldName, rawValue, cfg);
    if (message) {
      fieldErrors[fieldName] = message;
      allErrors.push({ field: fieldName, message });
      isFormValid = false;
    }
  }

  return { isFormValid, fieldErrors, allErrors };
}
