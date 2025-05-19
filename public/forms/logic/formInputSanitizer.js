/**
 * Form Input Sanitization (formInputSanitizer.js)
 * Provides functions to sanitize and normalize form input values.
 */

const sanitizers = {
  /**
   * Generic text sanitizer.
   * - Trims whitespace.
   * - Optionally converts to a specific case (e.g., 'uppercase', 'lowercase', 'titlecase').
   * - Optionally removes excessive whitespace (multiple spaces, leading/trailing newlines).
   * @param {string} value - The input string.
   * @param {object} [options] - Sanitization options.
   * @param {string} [options.case] - 'uppercase', 'lowercase', 'titlecase'.
   * @param {boolean} [options.removeExcessWhitespace=true] - Remove multiple spaces, newlines.
   * @returns {string} The sanitized string.
   */
  text: (value, options = {}) => {
    if (typeof value !== 'string') return value; // Or return '';

    let sanitizedValue = value.trim();

    if (options.removeExcessWhitespace !== false) {
      sanitizedValue = sanitizedValue.replace(/\\s\\s+/g, ' '); // Replace multiple spaces with single
    }

    switch (options.case) {
      case 'uppercase':
        sanitizedValue = sanitizedValue.toUpperCase();
        break;
      case 'lowercase':
        sanitizedValue = sanitizedValue.toLowerCase();
        break;
      case 'titlecase':
        sanitizedValue = sanitizedValue.replace(
          /\\w\\S*/g,
          (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        );
        break;
    }
    return sanitizedValue;
  },

  /**
   * Postcode sanitizer.
   * - Converts to uppercase.
   * - Ensures a space between numbers and letters if missing.
   * - Removes all other internal whitespace.
   * @param {string} value - The postcode string.
   * @returns {string} The sanitized postcode.
   */
  postcode: (value) => {
    if (typeof value !== 'string') return value;
    let sanitized = value.toUpperCase().replace(/\\s+/g, ''); // Remove all spaces initially
    // Add space if format is like 1234AB -> 1234 AB
    if (/^[1-9][0-9]{3}[A-Z]{2}$/.test(sanitized)) {
      sanitized = sanitized.slice(0, 4) + ' ' + sanitized.slice(4);
    }
    return sanitized;
  },

  /**
   * Huisnummer (house number) sanitizer.
   * - Trims whitespace.
   * - (Further specific huisnummer sanitization can be added if needed)
   * @param {string|number} value - The house number.
   * @returns {string} The sanitized house number as a string.
   */
  huisnummer: (value) => {
    if (value === null || typeof value === 'undefined') return '';
    return String(value).trim();
  },

  /**
   * Email sanitizer.
   * - Converts to lowercase.
   * - Trims whitespace.
   * @param {string} value - The email string.
   * @returns {string} The sanitized email.
   */
  email: (value) => {
    if (typeof value !== 'string') return value;
    return value.toLowerCase().trim();
  },

  /**
   * Number sanitizer.
   * - Removes non-numeric characters (except decimal point and minus sign at the start).
   * - Optionally converts to integer or float.
   * @param {string|number} value - The input.
   * @param {object} [options] - Sanitization options.
   * @param {string} [options.type='string'] - 'integer', 'float', or 'string' (to keep as numeric string).
   * @param {boolean} [options.allowNegative=true] - Allow negative numbers.
   * @returns {number|string|null} The sanitized number or null if invalid.
   */
  number: (value, options = {}) => {
    if (value === null || typeof value === 'undefined' || String(value).trim() === '') return null;

    let strValue = String(value).trim();
    
    // Regex to keep numbers, decimal point, and optionally a leading minus sign
    const numericRegex = options.allowNegative === false ? /[^0-9\\.]/g : /[^0-9\\.-]/g;
    strValue = strValue.replace(numericRegex, (match, offset) => {
        // Allow minus sign only at the beginning
        return match === '-' && offset === 0 ? '-' : '';
    });
    
    // Ensure only one decimal point
    const parts = strValue.split('.');
    if (parts.length > 2) {
        strValue = parts[0] + '.' + parts.slice(1).join('');
    }
    // Ensure minus is only at the start
    if (strValue.lastIndexOf('-') > 0) {
        return null; // Invalid format like '12-3'
    }

    if (strValue === '' || strValue === '-' || strValue === '.') return null; // Not a valid number after stripping

    switch (options.type) {
      case 'integer':
        const intVal = parseInt(strValue, 10);
        return isNaN(intVal) ? null : intVal;
      case 'float':
        const floatVal = parseFloat(strValue);
        return isNaN(floatVal) ? null : floatVal;
      default: // 'string' or unspecified
        return strValue; // Return as a sanitized numeric string
    }
  },
  
  // Add more specific sanitizers as needed (e.g., phone, date)
};

export const formInputSanitizer = {
  /**
   * Sanitizes a single input value based on its field schema.
   * The schema should specify a `sanitizerType` corresponding to a key in `sanitizers`.
   * If no `sanitizerType` is found, it defaults to 'text' or applies no sanitization.
   * @param {*} value - The input value to sanitize.
   * @param {object} fieldSchema - The schema object for the field.
   * @param {string} [fieldName] - The name of the field (for logging or fallback).
   * @returns {*} The sanitized value.
   */
  sanitizeField: (value, fieldSchema, fieldName) => {
    if (!fieldSchema) {
      // console.warn(\`FormInputSanitizer: No fieldSchema provided for field: \${fieldName}. Using generic text sanitization.\`);
      return sanitizers.text(value); // Default basic sanitization
    }

    const sanitizerKey = fieldSchema.sanitizerType || fieldSchema.type; // e.g. schema.type could be 'postcode'
    const specificSanitizer = sanitizers[sanitizerKey];
    const sanitizerOptions = fieldSchema.sanitizerOptions || {};

    if (specificSanitizer && typeof specificSanitizer === 'function') {
      return specificSanitizer(value, sanitizerOptions);
    } else if (sanitizers[fieldSchema.type]) { // Fallback to type if sanitizerType is not specific
        return sanitizers[fieldSchema.type](value, sanitizerOptions);
    }
    else {
      // Default to generic text sanitization if no specific or type-based sanitizer is found
      // console.warn(\`FormInputSanitizer: No specific sanitizer for type '\${sanitizerKey}' for field \${fieldName}. Using generic text sanitization.\`);
      return sanitizers.text(value, sanitizerOptions); // Pass options even to default
    }
  },

  /**
   * Sanitizes all values in a formData object based on the provided form schema.
   * @param {object} formData - An object where keys are fieldNames and values are their current values.
   * @param {object} formSchema - The full schema for the form, containing the 'fields' object.
   * @returns {object} A new object with all values sanitized.
   */
  sanitizeAll: (formData, formSchema) => {
    if (!formSchema || !formSchema.fields) {
      console.error('FormInputSanitizer: Invalid formSchema (or missing fields property) provided to sanitizeAll.');
      return { ...formData }; // Return a copy of original data or an empty object
    }

    const sanitizedData = {};
    for (const fieldName in formData) {
      if (Object.hasOwnProperty.call(formData, fieldName)) {
        const fieldSch = formSchema.fields[fieldName];
        const rawValue = formData[fieldName];
        if (fieldSch) { // Only sanitize if schema exists for the field
          sanitizedData[fieldName] = formInputSanitizer.sanitizeField(rawValue, fieldSch, fieldName);
        } else {
          // If no schema, pass through or apply a very basic default
          // console.warn(\`FormInputSanitizer: No schema found for field '\${fieldName}' during sanitizeAll. Value passed through or default sanitized.\`);
          sanitizedData[fieldName] = typeof rawValue === 'string' ? rawValue.trim() : rawValue;
        }
      }
    }
    return sanitizedData;
  }
};
