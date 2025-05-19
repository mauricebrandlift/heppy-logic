// public/forms/logic/formStorage.js

/**
 * Saves the value of a specific form field to localStorage.
 * The key in localStorage can be specific to the field or shared if localStorageKey is provided.
 * @param {string} formName - The name of the form (e.g., 'postcode-form').
 * @param {string} fieldName - The name of the field (e.g., 'postcode').
 * @param {any} value - The value to save.
 * @param {string} localStorageKey - The specific key to use for localStorage (e.g., 'shared.postcode').
 */
export function saveFieldData(localStorageKey, value) {
  if (typeof localStorageKey !== 'string' || localStorageKey.trim() === '') {
    console.error('localStorageKey must be a non-empty string', { localStorageKey });
    return;
  }
  try {
    localStorage.setItem(localStorageKey, JSON.stringify(value));
  } catch (error) {
    console.error(`Error saving data to localStorage for key ${localStorageKey}:`, error);
  }
}

/**
 * Loads the value of a specific form field from localStorage.
 * @param {string} key - The localStorage key.
 * @returns {string|null} The stored value, or null if not found or an error occurs.
 */
export function loadFieldData(key) {
  if (typeof key !== 'string' || key.trim() === '') {
    console.error('FormStorage: Invalid key provided for loadFieldData.');
    return null;
  }
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.error(`FormStorage: Error loading data for key "${key}" from localStorage:`, error);
    return null;
  }
}

/**
 * Loads all data for a given form from localStorage based on its fields schema.
 * @param {string} formName - The name of the form.
 * @param {object} fieldsSchema - The fields part of the form schema, containing localStorageKey for each field.
 * @returns {object} An object containing the loaded data, with field names as keys.
 */
export function loadFormData(fieldsSchema) {
  const loadedData = {};
  if (typeof fieldsSchema !== 'object' || fieldsSchema === null) {
    console.error('Invalid fieldsSchema provided to loadFormData');
    return loadedData;
  }

  for (const fieldName in fieldsSchema) {
    if (Object.hasOwnProperty.call(fieldsSchema, fieldName)) {
      const fieldConfig = fieldsSchema[fieldName];
      if (fieldConfig && typeof fieldConfig.localStorageKey === 'string') {
        try {
          const storedValue = localStorage.getItem(fieldConfig.localStorageKey);
          if (storedValue !== null) {
            loadedData[fieldName] = JSON.parse(storedValue);
          }
        } catch (error) {
          console.error(
            `Error loading or parsing data from localStorage for key ${fieldConfig.localStorageKey}:`,
            error
          );
        }
      }
    }
  }
  return loadedData;
}

/**
 * Clears a specific field's data from localStorage.
 * @param {string} localStorageKey - The specific key to use for localStorage.
 */
export function clearFieldData(localStorageKey) {
  if (typeof localStorageKey !== 'string' || localStorageKey.trim() === '') {
    console.error('localStorageKey must be a non-empty string for clearFieldData', { localStorageKey });
    return;
  }
  try {
    localStorage.removeItem(localStorageKey);
  } catch (error) {
    console.error(`Error removing data from localStorage for key ${localStorageKey}:`, error);
  }
}

/**
 * Clears all data for a given form from localStorage based on its fields schema.
 * @param {object} fieldsSchema - The fields part of the form schema.
 */
export function clearFormData(fieldsSchema) {
  if (typeof fieldsSchema !== 'object' || fieldsSchema === null) {
    console.error('Invalid fieldsSchema provided to clearFormData');
    return;
  }
  for (const fieldName in fieldsSchema) {
    if (Object.hasOwnProperty.call(fieldsSchema, fieldName)) {
      const fieldConfig = fieldsSchema[fieldName];
      if (fieldConfig && typeof fieldConfig.localStorageKey === 'string') {
        clearFieldData(fieldConfig.localStorageKey);
      }
    }
  }
}
