// public/forms/logic/formStorage.js

const PREFILL_DATA_KEY = 'heppyFormsPrefillData';
const FLOW_DATA_KEY = 'heppyFormsFlowData';

/**
 * Helper function to safely get and parse a JSON object from localStorage.
 * @param {string} mainKey - The top-level key in localStorage (e.g., PREFILL_DATA_KEY).
 * @returns {object} The parsed object or an empty object if not found or error.
 */
function _getStorageObject(mainKey) {
  try {
    const rawData = localStorage.getItem(mainKey);
    return rawData ? JSON.parse(rawData) : {};
  } catch (error) {
    console.error(`Error reading or parsing data from localStorage for key ${mainKey}:`, error);
    return {}; // Return empty object on error to prevent further issues
  }
}

/**
 * Helper function to safely stringify and set a JSON object in localStorage.
 * @param {string} mainKey - The top-level key in localStorage.
 * @param {object} data - The object to save.
 */
function _setStorageObject(mainKey, data) {
  try {
    localStorage.setItem(mainKey, JSON.stringify(data));
  } catch (error) {
    console.error(`Error saving data to localStorage for key ${mainKey}:`, error);
  }
}

/**
 * Saves the value of a specific form field to the prefill data in localStorage.
 * Data is stored under PREFILL_DATA_KEY -> formName -> localStorageKeyFromSchema.
 * @param {string} formName - The name of the form (e.g., 'postcode-form').
 * @param {object} fieldSchema - The schema object for the specific field, containing its localStorageKey.
 * @param {any} value - The value to save.
 */
export function saveFieldData(formName, fieldSchema, value) {
  if (!formName || typeof formName !== 'string' || formName.trim() === '') {
    console.error('FormStorage: formName must be a non-empty string for saveFieldData.');
    return;
  }
  if (!fieldSchema || typeof fieldSchema.localStorageKey !== 'string' || fieldSchema.localStorageKey.trim() === '') {
    console.error('FormStorage: fieldSchema with a valid localStorageKey must be provided for saveFieldData.');
    return;
  }

  const prefillData = _getStorageObject(PREFILL_DATA_KEY);
  if (!prefillData[formName]) {
    prefillData[formName] = {};
  }
  prefillData[formName][fieldSchema.localStorageKey] = value;
  _setStorageObject(PREFILL_DATA_KEY, prefillData);
}

/**
 * Loads all prefill data for a given form from localStorage.
 * It retrieves the data stored by saveFieldData and maps it to an object
 * where keys are the fieldNames from the schema.
 * @param {string} formName - The name of the form.
 * @param {object} fieldsSchema - The fields part of the form schema, mapping fieldName to fieldConfig (which includes localStorageKey).
 * @returns {object} An object containing the loaded prefill data, with field names (from schema) as keys.
 */
export function loadFormData(formName, fieldsSchema) {
  const loadedDataForForm = {};
  if (!formName || typeof formName !== 'string' || formName.trim() === '') {
    console.error('FormStorage: formName must be a non-empty string for loadFormData.');
    return loadedDataForForm;
  }
  if (typeof fieldsSchema !== 'object' || fieldsSchema === null) {
    console.error('FormStorage: Invalid fieldsSchema provided to loadFormData for form:', formName);
    return loadedDataForForm;
  }

  const prefillData = _getStorageObject(PREFILL_DATA_KEY);
  const formSpecificPrefill = prefillData[formName] || {};

  for (const fieldName in fieldsSchema) {
    if (Object.hasOwnProperty.call(fieldsSchema, fieldName)) {
      const fieldConfig = fieldsSchema[fieldName];
      if (fieldConfig && typeof fieldConfig.localStorageKey === 'string') {
        if (Object.hasOwnProperty.call(formSpecificPrefill, fieldConfig.localStorageKey)) {
          // Value is already parsed by _getStorageObject if it was stored as JSON.
          // However, saveFieldData stores it directly. Let's ensure consistency.
          // Since saveFieldData stores the value as is (could be string, number, boolean),
          // and localStorage stores everything as string, JSON.stringify was used in the old saveFieldData.
          // The new saveFieldData also stores the value as is within the JSON structure.
          // So, no extra parsing should be needed here if _getStorageObject works correctly.
          loadedDataForForm[fieldName] = formSpecificPrefill[fieldConfig.localStorageKey];
        }
      }
    }
  }
  return loadedDataForForm;
}

/**
 * Clears all prefill data for a specific form from localStorage.
 * @param {string} formName - The name of the form.
 */
export function clearFormPrefillData(formName) {
  if (!formName || typeof formName !== 'string' || formName.trim() === '') {
    console.error('FormStorage: formName must be a non-empty string for clearFormPrefillData.');
    return;
  }
  const prefillData = _getStorageObject(PREFILL_DATA_KEY);
  if (prefillData[formName]) {
    delete prefillData[formName];
    _setStorageObject(PREFILL_DATA_KEY, prefillData);
  }
}

/**
 * Saves validated ("flow") data for an entire form to localStorage.
 * @param {string} formName - The name of the form.
 * @param {object} data - The validated form data object to save.
 */
export function saveFlowData(formName, data) {
  if (!formName || typeof formName !== 'string' || formName.trim() === '') {
    console.error('FormStorage: formName must be a non-empty string for saveFlowData.');
    return;
  }
  if (typeof data !== 'object' || data === null) {
    console.error('FormStorage: Data for saveFlowData must be an object for form:', formName);
    return;
  }
  const flowData = _getStorageObject(FLOW_DATA_KEY);
  flowData[formName] = data;
  _setStorageObject(FLOW_DATA_KEY, flowData);
}

/**
 * Loads validated ("flow") data for a specific form from localStorage.
 * @param {string} formName - The name of the form.
 * @returns {object|null} The stored flow data object for the form, or null if not found.
 */
export function loadFlowData(formName) {
  if (!formName || typeof formName !== 'string' || formName.trim() === '') {
    console.error('FormStorage: formName must be a non-empty string for loadFlowData.');
    return null;
  }
  const flowData = _getStorageObject(FLOW_DATA_KEY);
  return flowData[formName] || null;
}

/**
 * Clears validated ("flow") data for a specific form from localStorage.
 * @param {string} formName - The name of the form.
 */
export function clearFlowData(formName) {
  if (!formName || typeof formName !== 'string' || formName.trim() === '') {
    console.error('FormStorage: formName must be a non-empty string for clearFlowData.');
    return;
  }
  const flowData = _getStorageObject(FLOW_DATA_KEY);
  if (flowData[formName]) {
    delete flowData[formName];
    _setStorageObject(FLOW_DATA_KEY, flowData);
  }
}
