// filepath: c:\Users\mauri\OneDrive\MIJN BEDRIJF BRANDLIFT 2.0\KLANTEN\Heppy world\CODEREN 2\heppy-logic\public\forms\validators\formValidator.js
/**
 * Form Validation (formValidator.js)
 * Provides structured validation logic on a per-field or per-field-type basis.
 */

// --- Field-Specific Validator Definitions ---
const fieldValidators = {
  postcode: {
    validate: function(value, fieldSchema, fieldState) { // Added fieldState
      const errors = [];
      const displayName = fieldSchema.displayName || 'Postcode';
      const val = String(value || '').trim();

      // Only validate required if the field has been touched
      if (fieldSchema.required && fieldState && fieldState.isTouched && val === '') {
        errors.push(`${displayName} is required.`);
        return { isValid: false, errors }; // Early exit if required, touched and empty
      }
      // If not required or not touched (for required check), and empty, it's valid regarding emptiness
      if (val === '') return { isValid: true, errors: [] }; 

      const pattern = /^[1-9][0-9]{3}\s?[A-Z]{2}$/i;
      if (!pattern.test(val)) {
        errors.push(`${displayName} must be in the format 1234 AB.`);
      }
      // Add other postcode specific checks if needed
      return { isValid: errors.length === 0, errors };
    }
  },

  huisnummer: {
    validate: function(value, fieldSchema, fieldState) { // Added fieldState
      const errors = [];
      const displayName = fieldSchema.displayName || 'Huisnummer';
      const val = String(value || '').trim();

      if (fieldSchema.required && fieldState && fieldState.isTouched && val === '') {
        errors.push(`${displayName} is required.`);
        return { isValid: false, errors };
      }
      if (val === '') return { isValid: true, errors: [] };

      // Basic check for numbers, allowing for additions like 'A', 'bis', '1-3'
      // This can be made more strict or complex based on specific requirements
      if (!/^\d+[a-zA-Z0-9\-]*$/.test(val)) {
        errors.push(`${displayName} should start with a number and can include letters or hyphens.`);
      }
      if (val.length > (fieldSchema.maxLength || 10)) { // Default max length or from schema
        errors.push(`${displayName} seems too long (max ${fieldSchema.maxLength || 10} chars).`);
      }
      return { isValid: errors.length === 0, errors };
    }
  },

  email: {
    validate: function(value, fieldSchema, fieldState) { // Added fieldState
      const errors = [];
      const displayName = fieldSchema.displayName || 'Email';
      const val = String(value || '').trim();

      if (fieldSchema.required && fieldState && fieldState.isTouched && val === '') {
        errors.push(`${displayName} is required.`);
        return { isValid: false, errors };
      }
      if (val === '') return { isValid: true, errors: [] };

      // Basic email pattern, can be replaced with a more comprehensive one if needed
      const pattern = /^[\w\.-]+@[\w\.-]+\.\w{2,}$/;
      if (!pattern.test(val)) {
        errors.push(`${displayName} is not a valid email address.`);
      }
      return { isValid: errors.length === 0, errors };
    }
  },

  genericText: {
    validate: function(value, fieldSchema, fieldState) { // Added fieldState
      const errors = [];
      const displayName = fieldSchema.displayName || 'Field';
      const val = String(value || '').trim();

      if (fieldSchema.required && fieldState && fieldState.isTouched && val === '') {
        errors.push(`${displayName} is required.`);
        return { isValid: false, errors };
      }
      if (val === '') return { isValid: true, errors: [] }; // Valid if not required (or not touched for required) and empty

      if (fieldSchema.minLength && val.length < fieldSchema.minLength) {
        errors.push(`${displayName} must be at least ${fieldSchema.minLength} characters long.`);
      }
      if (fieldSchema.maxLength && val.length > fieldSchema.maxLength) {
        errors.push(`${displayName} must be no more than ${fieldSchema.maxLength} characters long.`);
      }
      if (fieldSchema.regexPattern) {
        try {
          const regex = new RegExp(fieldSchema.regexPattern);
          if (!regex.test(val)) {
            errors.push(fieldSchema.regexMessage || `${displayName} has an invalid format.`);
          }
        } catch (e) {
          console.error('FormValidator: Invalid regexPattern in schema for', displayName, e);
          errors.push(`Configuration error for ${displayName} validation.`);
        }
      }
      return { isValid: errors.length === 0, errors };
    }
  },
  // Add more field-specific validators here
  // e.g., phoneNumber, date, numberRange, etc.
};

// --- Main Validator Export ---
export const formValidator = {
  /**
   * Validates a single field's value based on its schema and state.
   * The schema should specify a `validatorType` corresponding to a key in `fieldValidators`.
   * @param {*} value - The current value of the field.
   * @param {object} fieldSchema - The schema object for the field.
   * @param {string} fieldName - The name of the field (used as fallback for validatorType).
   * @param {object} fieldState - The state object for the field (e.g., { isTouched: false, isDirty: false }).
   * @returns {{isValid: boolean, errorMessages: string[]}} Validation result with an array of error messages.
   */
  validateField: function(value, fieldSchema, fieldName, fieldState) { // Added fieldState parameter
    if (!fieldSchema) {
      console.warn(`FormValidator: No fieldSchema provided for field: ${fieldName}`);
      return { isValid: true, errorMessages: [] }; // Or treat as invalid, based on desired strictness
    }

    // Ensure fieldState is an object, even if not provided or null
    const currentFieldState = fieldState || { isTouched: false, isDirty: false };

    const validatorKey = fieldSchema.validatorType || fieldName; // Prefer explicit validatorType
    const specificValidator = fieldValidators[validatorKey];

    if (specificValidator && typeof specificValidator.validate === 'function') {
      const result = specificValidator.validate(value, fieldSchema, currentFieldState); // Pass currentFieldState
      return {
        isValid: result.isValid,
        errorMessages: result.errors || []
      };
    } else {
      // Fallback to genericText validator if no specific one is found and schema has relevant props
      // or if validatorType is explicitly 'genericText'.
      if (validatorKey === 'genericText' || fieldSchema.minLength || fieldSchema.maxLength || fieldSchema.regexPattern || fieldSchema.required) {
        const genericResult = fieldValidators.genericText.validate(value, fieldSchema, currentFieldState); // Pass currentFieldState
        return {
            isValid: genericResult.isValid,
            errorMessages: genericResult.errors || []
        };
      }
      // If no validator is found and no generic properties, consider it valid or log a warning.
      console.warn(`FormValidator: No validator found for type/key: '${validatorKey}' for field ${fieldName}. Field will pass validation by default.`);
      return { isValid: true, errorMessages: [] };
    }
  },

  /**
   * Validates all fields in a form based on the provided data, full form schema, and form state.
   * @param {object} formData - An object where keys are fieldNames and values are their current values.
   * @param {object} formSchema - The full schema for the form, containing the 'fields' object.
   * @param {object} formState - An object where keys are fieldNames and values are their state objects (e.g., { isTouched, isDirty }).
   * @returns {{isFormValid: boolean, fieldErrors: object}} 
   *          isFormValid: true if all fields are valid.
   *          fieldErrors: An object where keys are fieldNames and values are arrays of their error messages.
   */
  validateForm: function(formData, formSchema, formState) { // Added formState parameter
    const fieldErrors = {};
    let isFormValid = true;

    if (!formSchema || !formSchema.fields) {
      console.error('FormValidator: Invalid formSchema (or missing fields property) provided to validateForm.');
      return { isFormValid: false, fieldErrors: { _global: ['Form configuration error.'] } };
    }

    for (const fieldName in formSchema.fields) {
      if (Object.hasOwnProperty.call(formSchema.fields, fieldName)) {
        const fieldSch = formSchema.fields[fieldName];
        const value = formData ? formData[fieldName] : undefined;
        // Get the state for the current field, default if not provided
        const currentFieldState = (formState && formState[fieldName]) ? formState[fieldName] : { isTouched: false, isDirty: false };
        
        const validationResult = this.validateField(value, fieldSch, fieldName, currentFieldState); // Pass currentFieldState
        
        fieldErrors[fieldName] = validationResult.errorMessages; // Store messages even if valid (empty array)
        if (!validationResult.isValid) {
          isFormValid = false;
        }
      }
    }
    return { isFormValid, fieldErrors };
  }
};