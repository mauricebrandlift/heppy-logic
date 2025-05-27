const sanitizers = {
  /**
   * Generic text sanitizer.
   */
  text: (value, options = {}) => {
    if (typeof value !== 'string') return value;
    let sanitizedValue = value.trim();
    if (options.removeExcessWhitespace !== false) {
      sanitizedValue = sanitizedValue.replace(/\s\s+/g, ' ');
    }
    switch (options.case) {
      case 'uppercase': sanitizedValue = sanitizedValue.toUpperCase(); break;
      case 'lowercase': sanitizedValue = sanitizedValue.toLowerCase(); break;
      case 'titlecase':
        sanitizedValue = sanitizedValue.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
        break;
    }
    return sanitizedValue;
  },
  postcode: value => {
    if (typeof value !== 'string') return value;
    // Forceer hoofdletters en haal alle niet-alfanumerieke tekens weg
    let sanitized = value.toUpperCase().replace(/[^0-9A-Z]/g, '');
    // Pak maximaal 4 cijfers
    const digits = sanitized.slice(0, 4).replace(/[^0-9]/g, '');
    // Pak maximaal 2 letters
    const letters = sanitized.slice(4, 6).replace(/[^A-Z]/g, '');
    // Voeg spatie toe als er letters zijn
    return letters ? `${digits} ${letters}` : digits;
  },
  huisnummer: value => {
    if (value === null || typeof value === 'undefined') return '';
    // Verwijder alle niet-cijfers
    return String(value).replace(/\D/g, '');
  },
  email: value => {
    if (typeof value !== 'string') return value;
    return value.toLowerCase().trim();
  },
  number: (value, options = {}) => {
    if (value == null || String(value).trim() === '') return null;
    let strValue = String(value).trim();
    const regex = options.allowNegative === false ? /[^0-9\.]/g : /[^0-9\.-]/g;
    strValue = strValue.replace(regex, (match, offset) => (match === '-' && offset === 0) ? '-' : '');
    const parts = strValue.split('.');
    if (parts.length > 2) strValue = parts[0] + '.' + parts.slice(1).join('');
    if (strValue.lastIndexOf('-') > 0) return null;
    if (strValue === '' || strValue === '-' || strValue === '.') return null;
    switch (options.type) {
      case 'integer': {
        const iv = parseInt(strValue,10);
        return isNaN(iv) ? null : iv;
      }
      case 'float': {
        const fv = parseFloat(strValue);
        return isNaN(fv) ? null : fv;
      }
      default: return strValue;
    }
  }
};

export const formInputSanitizer = {
  /**
   * Sanitizes a single input value based on its field schema.
   */
  sanitizeField: (value, fieldSchema, fieldName) => {
    if (!fieldSchema) {
      return sanitizers.text(value);
    }
    const key = fieldSchema.sanitizerType || fieldSchema.type;
    const fn = sanitizers[key] || sanitizers[fieldSchema.type] || sanitizers.text;
    const options = fieldSchema.sanitizerOptions || {};
    return fn(value, options);
  },
  /**
   * Sanitizes all values in formData.
   */
  sanitizeAll: (formData, formSchema) => {
    if (!formSchema || !formSchema.fields) return { ...formData };
    const out = {};
    for (const name in formData) {
      if (Object.hasOwnProperty.call(formData, name)) {
        const raw = formData[name];
        const sch = formSchema.fields[name];
        out[name] = sch ? formInputSanitizer.sanitizeField(raw, sch, name) : (typeof raw==='string'? raw.trim():raw);
      }
    }
    return out;
  }
};

/**
 * Trim whitespace from a single value.
 */
export function sanitize(value) {
  return sanitizers.text(value);
}

/**
 * Collects form values keyed by data-field-name.
 */
export function collect(formEl) {
  const data = {};
  formEl.querySelectorAll('[data-field-name]').forEach(input => {
    const key = input.getAttribute('data-field-name');
    data[key] = input.value;
  });
  return data;
}
