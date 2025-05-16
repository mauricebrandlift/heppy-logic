/**
 * Validatie-engine voor formuliermodules.
 * Biedt functies voor veld-, formulier- en volledige validatie.
 *
 * @module public/forms/validators/formValidator
 * @version 1.0.1
 */

/**
 * Valideert één veld op basis van het schema, en retourneert maximaal één fout.
 * Levert console.logs voor waarde en validatiestatus.
 * @param {object} schemaFields - Object met veldschema's uit formSchema.js
 * @param {string} fieldName - Naam van het veld
 * @param {string} value - Ingevoerde waarde
 * @returns {{ field: string, message: string }[]} Lijst met maximaal één fout-object (lege array als valide)
 */
export function validateField(schemaFields, fieldName, value) {
  console.log(`[formValidator] validateField called for field="${fieldName}" value="${value}"`);
  const fieldSchema = schemaFields[fieldName];
  if (!fieldSchema) {
    console.log(`[formValidator] no schema for field="${fieldName}", considered valid`);
    return [];
  }

  // 1) Required check
  if (fieldSchema.required && value.trim() === '') {
    const msg = fieldSchema.message || `${fieldName} is verplicht.`;
    console.log(`[formValidator] field="${fieldName}" failed required check`);
    return [{ field: fieldName, message: msg }];
  }

  // 2) Type check (string)
  if (fieldSchema.type === 'string' && typeof value !== 'string') {
    const msg = fieldSchema.message || `${fieldName} moet tekst zijn.`;
    console.log(`[formValidator] field="${fieldName}" failed type check`);
    return [{ field: fieldName, message: msg }];
  }

  // 3) Pattern check
  if (fieldSchema.pattern && !fieldSchema.pattern.test(value)) {
    const msg = fieldSchema.message || `${fieldName} heeft een ongeldig formaat.`;
    console.log(`[formValidator] field="${fieldName}" failed pattern check`);
    return [{ field: fieldName, message: msg }];
  }

  console.log(`[formValidator] field="${fieldName}" passed validation`);
  return [];
}

/**
 * Valideert de volledigheid van alle velden in een formulier.
 * Logt de uiteindelijke validatiestatus.
 * @param {object} schemaFields - Object met veldschema's
 * @param {HTMLFormElement} formEl - Het formulier-element
 * @returns {boolean} True als alle velden valide zijn, anders false
 */
export function validateForm(schemaFields, formEl) {
  console.log('[formValidator] validateForm start');
  const inputs = Array.from(formEl.querySelectorAll('[data-field-name]'));
  for (const input of inputs) {
    const name = input.getAttribute('data-field-name');
    const value = input.value.trim();
    const fieldErrors = validateField(schemaFields, name, value);
    if (fieldErrors.length > 0) {
      console.log(`[formValidator] validateForm found errors in field="${name}"`, fieldErrors);
      console.log('[formValidator] validateForm result: false');
      return false;
    }
  }
  console.log('[formValidator] validateForm result: true');
  return true;
}

/**
 * Voert complete validatie uit (sync + async) waarbij externe checks via API kunnen plaatsvinden.
 * Logt sync en async validatiestatus.
 * @param {object} schemaFields - Object met veldschema's
 * @param {object} data - Object met naam-waarde paren van alle velden
 * @param {object} api - Object met optionele async validatiefuncties
 * @returns {Promise<{ field: string|null, message: string }[]>} Lijst met fout-objecten
 */
export async function validateFull(schemaFields, data, api = {}) {
  console.log('[formValidator] validateFull called with data:', data);
  const errors = [];

  // Lokale veldvalidatie
  for (const [fieldName, value] of Object.entries(data)) {
    const fieldErrors = validateField(schemaFields, fieldName, value);
    if (fieldErrors.length) {
      console.log(`[formValidator] validateFull sync error on field="${fieldName}"`, fieldErrors[0]);
      errors.push(fieldErrors[0]);
    }
  }
  console.log('[formValidator] validateFull sync validation errors:', errors);

  // Externe validatie (optioneel)
  const asyncFn = api.fetchAddressValidation || api.getAddressInfo;
  if (asyncFn && errors.length === 0) {
    console.log('[formValidator] validateFull calling async validation');
    try {
      const result = await asyncFn(data);
      console.log('[formValidator] async validation result:', result);
      if (result && result.isCovered === false) {
        const globalError = { field: null, message: 'Adres buiten servicegebied.' };
        console.log('[formValidator] validateFull async coverage failed', globalError);
        errors.push(globalError);
      }
    } catch (err) {
      const globalError = { field: null, message: err.message || 'Externe validatie mislukt.' };
      console.error('[formValidator] async validation error', err);
      errors.push(globalError);
    }
  }

  console.log('[formValidator] validateFull returning errors:', errors);
  return errors;
}
