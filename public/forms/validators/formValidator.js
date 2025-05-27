const fieldValidators = {
  genericText: {
    /**
     * @param {string} value
     * @param {FieldSchema} schema
     * @param {FieldState} state
     * @returns {ValidationResult}
     */
    validate(value, schema, state) {
      const errors = [];
      const name = schema.displayName;
      const val = String(value || '').trim();

      if (schema.required && state.isTouched && val === '') {
        errors.push(`${name} is verplicht.`);
      }

      return { isValid: errors.length === 0, errorMessages: errors };
    }
  },
  postcode: {
    /**
     * @param {string} value
     * @param {FieldSchema} schema
     * @param {FieldState} state
     * @returns {ValidationResult}
     */
    validate(value, schema, state) {
      const errors = [];
      const name = schema.displayName;
      const val = String(value || '').trim();

      if (schema.required && state.isTouched && val === '') {
        errors.push(`${name} is verplicht.`);
      }

      if (val !== '') {
        const pattern = /^[1-9][0-9]{3}\s?[A-Za-z]{2}$/;
        if (!pattern.test(val)) {
          errors.push(schema.regexMessage || `${name} is niet geldig.`);
        }
      }

      return { isValid: errors.length === 0, errorMessages: errors };
    }
  },
  huisnummer: {
    /**
     * @param {string} value
     * @param {FieldSchema} schema
     * @param {FieldState} state
     * @returns {ValidationResult}
     */
    validate(value, schema, state) {
      const errors = [];
      const name = schema.displayName;
      const val = String(value || '').trim();

      if (schema.required && state.isTouched && val === '') {
        errors.push(`${name} is verplicht.`);
      }

      if (val !== '' && !/^\d+$/.test(val)) {
        errors.push(`${name} moet een getal zijn.`);
      }

      return { isValid: errors.length === 0, errorMessages: errors };
    }
  },
  toevoeging: {
    /**
     * @param {string} value
     * @param {FieldSchema} schema
     * @param {FieldState} state
     * @returns {ValidationResult}
     */
    validate(value, schema, state) {
      const errors = [];
      const name = schema.displayName;
      const val = String(value || '').trim();

      if (schema.required && state.isTouched && val === '') {
        errors.push(`${name} is verplicht.`);
      }

      return { isValid: errors.length === 0, errorMessages: errors };
    }
  }
};

/**
 * Validates a single field based on its schema and state.
 * @param {string} value - The field value to validate.
 * @param {FieldSchema} schema - Schema defining the field validation rules.
 * @param {string} fieldName - Key name of the field in the form data.
 * @param {FieldState} [state={ isTouched: false, isDirty: false }] - Current state of the field.
 * @returns {ValidationResult}
 */
export function validateField(value, schema, fieldName, state = { isTouched: false, isDirty: false }) {
  const validatorType = schema.validatorType || 'genericText';
  const validator = fieldValidators[validatorType] || fieldValidators.genericText;
  return validator.validate(value, schema, state);
}

/**
 * Validates an entire form based on formData and formSchema.
 * @param {{ [key: string]: any }} formData - Key/value map of form field entries.
 * @param {{ fields: { [key: string]: FieldSchema } }} formSchema - Schema containing definitions for each field.
 * @param {{ [key: string]: FieldState }} [formState={}] - Current state of each form field.
 * @returns {{ isFormValid: boolean, fieldErrors: { [key: string]: string[] } }}
 */
export function validateForm(formData, formSchema, formState = {}) {
  let isFormValid = true;
  const fieldErrors = /** @type {{ [key: string]: string[] }} */ ({});

  for (const fieldName in formSchema.fields) {
    const schema = formSchema.fields[fieldName];
    const value = formData[fieldName];
    const state = formState[fieldName] || { isTouched: false, isDirty: false };
    const result = validateField(value, schema, fieldName, state);

    fieldErrors[fieldName] = result.errorMessages;
    if (!result.isValid) {
      isFormValid = false;
    }
  }

  return { isFormValid, fieldErrors };
}
