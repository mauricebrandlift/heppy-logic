// public/forms/logic/formInputSanitizer.js

/**
 * Sanitizers voor veld-invoer. Elk is een pure functie die een string teruggeeft.
 */
export const sanitizers = {
  /** Verwijdert whitespace aan begin en eind */
  trim: (value) => value.trim(),

  /** Zet alle letters om naar hoofdletters */
  uppercase: (value) => value.toUpperCase(),
  
  /** Zet alle letters om naar kleine letters */
  lowercase: (value) => value.toLowerCase(),

  /** Laat alleen numerieke karakters over */
  numericOnly: (value) => value.replace(/\D+/g, ''),

  /** Laat alleen letters en cijfers over */
  alphaNumeric: (value) => value.replace(/[^0-9A-Za-z]+/g, ''),

  /**
   * Postcode-structuur: beperkt tot maximaal 4 cijfers + 2 letters
   * - Eerste tot 4 posities: alleen cijfers
   * - Vervolgens tot 2 posities: alleen letters
   */
  postcodeStructure: (value) => {
    const up = value.toUpperCase();
    const match = up.match(/^(\d{0,4})([A-Z]{0,2})/);
    if (!match) return '';
    return match[1] + (match[2] || '');
  },

  /** Zet eerste letter van elk woord naar hoofdletter */
  capitalizeFirst: (value) => {
    return value.replace(/\b\w/g, letter => letter.toUpperCase());
  },
};

/**
 * Sanitize één veld volgens het schema:
 * - Voer in opgegeven volgorde alle sanitizers uit
 * - Log een waarschuwing bij ontbrekende sanitizer
 *
 * @param {string} value    - De rauwe invoer
 * @param {object} field     - Het schema-object voor dit veld (fields[fieldName])
 * @param {string} fieldName - Naam van het veld (voor logging)
 * @returns {string}         - De gesaniteerde waarde
 */
export function sanitizeField(value, field, fieldName) {
  let result = String(value ?? '');
  
  // Skip sanitization for radio buttons and checkboxes - their values are predefined
  if (field.inputType === 'radio' || field.inputType === 'checkbox') {
    console.log(`🔄 [Sanitizer] Skipping sanitization for ${field.inputType} field '${fieldName}'`);
    return result;
  }
  
  if (!field.sanitizers || !Array.isArray(field.sanitizers)) {
    return result;
  }
  field.sanitizers.forEach((name) => {
    const fn = sanitizers[name];
    if (typeof fn === 'function') {
      result = fn(result);
    } else {
      console.warn(
        `⚠️ [Sanitizer] Geen sanitizer gevonden voor '${name}' in veld '${fieldName}'`
      );
    }
  });
  return result;
}
