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
    // Voor radio buttons: check of er daadwerkelijk een waarde is geselecteerd
    if (fieldSchema && fieldSchema.inputType === 'radio') {
      const isValid = value && value.trim() !== '';
      console.log(`🔍 [Validator] Radio required check: value='${value}', isValid=${isValid}`);
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
    // Als het veld leeg is en NIET required, accepteer het
    if (!value || value.length === 0) {
      return null; // Geen error als veld leeg is (tenzij required validator apart aanwezig is)
    }
    // Als er wel text is, check de minimum lengte
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
  // Integer validator (onderscheidend t.o.v. numeric puur voor semantiek)
  integer: (value) => (/^-?\d+$/.test(value) ? null : 'Voer een geheel getal in.'),
  // Nieuw: weeknrAllowed validator controleert of weeknummer in dynamische allowedWeeks lijst zit
  weeknrAllowed: (value, fieldSchema) => {
    if (!/^-?\d+$/.test(value)) return 'Voer een geheel weeknummer in.';
    const intVal = parseInt(value, 10);
    if (fieldSchema && Array.isArray(fieldSchema.allowedWeeks)) {
      // Als allowedWeeks nog niet gevuld is (lege lijst), beschouw dit als 'nog niet te valideren'
      if (fieldSchema.allowedWeeks.length === 0) return null;
      if (!fieldSchema.allowedWeeks.includes(intVal)) return 'Selecteer een geldige startweek.';
    }
    return null;
  },
  maxLength: (value, fieldSchema) => {
    const maxLen = fieldSchema.maxLength || Infinity;
    // Als het veld leeg is, geen error
    if (!value || value.length === 0) {
      return null;
    }
    // Als er wel text is, check de maximum lengte
    if (value.length > maxLen) {
      return `Maximaal ${maxLen} karakters toegestaan.`;
    }
    return null;
  },
  // Naam validator (voor voornaam/achternaam)
  name: (value) => {
    // Lege waarde wordt afgehandeld door required validator
    if (!value || value.trim() === '') return null;
    
    // Alleen letters, spaties, koppeltekens, apostrofs toegestaan
    const nameRegex = /^[a-zA-ZÀ-ÿ\s'-]+$/;
    if (!nameRegex.test(value)) {
      return 'Naam mag alleen letters, spaties, koppeltekens en apostrofs bevatten.';
    }
    
    // Minimaal 2 karakters
    if (value.trim().length < 2) {
      return 'Naam moet minimaal 2 karakters bevatten.';
    }
    
    return null;
  },
  // Telefoon validator (Nederlands formaat)
  telefoon: (value) => {
    // Lege waarde wordt afgehandeld door required validator
    if (!value || value.trim() === '') return null;
    
    // Verwijder alle niet-cijfers voor validatie
    const digitsOnly = value.replace(/\D/g, '');
    
    // Minimaal 10 cijfers (Nederlands nummer zonder landcode)
    if (digitsOnly.length < 10) {
      return 'Telefoonnummer moet minimaal 10 cijfers bevatten.';
    }
    
    // Check Nederlands formaat: begint met 0 of 31
    if (!digitsOnly.startsWith('0') && !digitsOnly.startsWith('31')) {
      return 'Voer een geldig Nederlands telefoonnummer in.';
    }
    
    // Internationaal formaat: +31 (11-12 cijfers totaal)
    if (digitsOnly.startsWith('31') && (digitsOnly.length < 11 || digitsOnly.length > 12)) {
      return 'Voer een geldig telefoonnummer in (bijv. +31612345678).';
    }
    
    // Nationaal formaat: 0 (10 cijfers totaal)
    if (digitsOnly.startsWith('0') && digitsOnly.length !== 10) {
      return 'Voer een geldig telefoonnummer in (bijv. 0612345678).';
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
    // Check voor parametric validators (min:X, max:X)
    if (name.includes(':')) {
      const [validatorName, param] = name.split(':');
      const paramValue = parseFloat(param);
      
      if (validatorName === 'min') {
        const numValue = parseFloat(value);
        if (isNaN(numValue) || numValue < paramValue) {
          const errorMessage = override['min'] || `Minimaal ${paramValue}`;
          return errorMessage;
        }
        continue;
      }
      
      if (validatorName === 'max') {
        const numValue = parseFloat(value);
        if (isNaN(numValue) || numValue > paramValue) {
          const errorMessage = override['max'] || `Maximaal ${paramValue}`;
          return errorMessage;
        }
        continue;
      }
      
      console.warn(`⚠️ [Validator] Onbekende parametric validator '${validatorName}' in veld '${fieldName}'`);
      continue;
    }
    
    // Reguliere validators
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
    // Check of er een custom shouldValidateField functie is
    if (typeof formSchema.shouldValidateField === 'function') {
      // Zoek het field element
      const fieldElement = document.querySelector(`[data-field-name="${fieldName}"]`);
      const shouldValidate = formSchema.shouldValidateField(fieldName, fieldElement);
      
      if (!shouldValidate) {
        // Skip validatie voor dit veld
        continue;
      }
    }
    
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
