/**
 * Validatie-engine voor formuliermodules.
 * Biedt functies voor veld-, formulier- en volledige validatie.
 *
 * @module public/forms/validators/formValidator
 * @version 1.0.1
 */

/**
 * Valideert één veld op basis van het schema, en retourneert maximaal één fout.
 * @param {object} schemaFields - Object met veldschema's uit formSchema.js
 * @param {string} fieldName - Naam van het veld
 * @param {string} value - Ingevoerde waarde
 * @returns {{ field: string, message: string }[]} Lijst met maximaal één fout-object (lege array als valide)
 */
export function validateField(schemaFields, fieldName, value) {
  const fieldSchema = schemaFields[fieldName];
  if (!fieldSchema) return [];

  // 1) Required check
  if (fieldSchema.required && value.trim() === '') {
    const msg = fieldSchema.message || `${fieldName} is verplicht.`;
    return [{ field: fieldName, message: msg }];
  }

  // 2) Type check (string)
  if (fieldSchema.type === 'string' && typeof value !== 'string') {
    const msg = fieldSchema.message || `${fieldName} moet tekst zijn.`;
    return [{ field: fieldName, message: msg }];
  }

  // 3) Pattern check
  if (fieldSchema.pattern && !fieldSchema.pattern.test(value)) {
    const msg = fieldSchema.message || `${fieldName} heeft een ongeldig formaat.`;
    return [{ field: fieldName, message: msg }];
  }

  return [];
}

/**
 * Valideert de volledigheid van alle velden in een formulier.
 * @param {object} schemaFields - Object met veldschema's
 * @param {HTMLFormElement} formEl - Het formulier-element
 * @returns {boolean} True als alle velden valide zijn, anders false
 */
export function validateForm(schemaFields, formEl) {
  const inputs = Array.from(formEl.querySelectorAll('[data-field-name]'));
  for (const input of inputs) {
    const name = input.getAttribute('data-field-name');
    const value = input.value.trim();
    const fieldErrors = validateField(schemaFields, name, value);
    if (fieldErrors.length > 0) return false;
  }
  return true;
}

/**
 * Voert complete validatie uit (sync + async) waarbij externe checks via API kunnen plaatsvinden.
 * Retourneert een lijst van fout-objecten (één per onjuist veld of globale fout).
 *
 * @param {object} schemaFields - Object met veldschema's
 * @param {object} data - Object met naam-waarde paren van alle velden
 * @param {object} api - Object met optionele async validatiefuncties
 * @returns {Promise<{ field: string|null, message: string }[]>} Lijst met fout-objecten
 */
export async function validateFull(schemaFields, data, api = {}) {
  const errors = [];

  // Lokale veldvalidatie
  for (const [fieldName, value] of Object.entries(data)) {
    const fieldErrors = validateField(schemaFields, fieldName, value);
    if (fieldErrors.length) {
      errors.push(fieldErrors[0]);
    }
  }

  // Externe validatie (optioneel)
  if (api.fetchAddressValidation && errors.length === 0) {
    try {
      const result = await api.fetchAddressValidation(data);
      if (result && result.isCovered === false) {
        errors.push({ field: null, message: 'Adres buiten servicegebied.' });
      }
    } catch (err) {
      errors.push({ field: null, message: err.message || 'Externe validatie mislukt.' });
    }
  }

  return errors;
}
