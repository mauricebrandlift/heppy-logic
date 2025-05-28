// public/forms/logic/formStorage.js

const PREFILL_DATA_KEY = 'heppyFormsPrefillData';
const FLOW_DATA_KEY = 'heppyFormsFlowData';
const GLOBAL_FIELDS_DATA_KEY = 'heppyFormsGlobalFields'; // Nieuwe key voor globale velden

/**
 * Haalt een JSON-objekt uit localStorage en parsed het.
 * @param {string} key - LocalStorage key
 * @returns {object} - Parsed object of lege map
 */
function _getStorageObject(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.error(`⚠️ [FormStorage] Fout bij lezen van key '${key}':`, err);
    return {};
  }
}

/**
 * Serialiseert en slaat een object op in localStorage.
 * @param {string} key - LocalStorage key
 * @param {object} obj - Data om op te slaan
 */
function _setStorageObject(key, obj) {
  try {
    localStorage.setItem(key, JSON.stringify(obj));
  } catch (err) {
    console.error(`⚠️ [FormStorage] Fout bij schrijven naar key '${key}':`, err);
  }
}

/**
 * Sla formulier-specifieke prefill data op.
 * @param {string} formName - Unieke formuliernaam
 * @param {object} data - Key/value map van veldwaarden
 */
export function saveFormData(formName, data) {
  if (!formName) return;
  const allPrefill = _getStorageObject(PREFILL_DATA_KEY);
  allPrefill[formName] = data;
  _setStorageObject(PREFILL_DATA_KEY, allPrefill);
}

/**
 * Laad opgeslagen prefill data per formulier.
 * @param {string} formName - Unieke formuliernaam
 * @returns {object|null} - Key/value map of null
 */
export function loadFormData(formName) {
  if (!formName) return null;
  const allPrefill = _getStorageObject(PREFILL_DATA_KEY);
  return allPrefill[formName] || null;
}

/**
 * Verwijder opgeslagen prefill data voor een formulier.
 * @param {string} formName - Unieke formuliernaam
 */
export function clearFormData(formName) {
  if (!formName) return;
  const allPrefill = _getStorageObject(PREFILL_DATA_KEY);
  if (allPrefill[formName]) {
    delete allPrefill[formName];
    _setStorageObject(PREFILL_DATA_KEY, allPrefill);
  }
}

/**
 * Sla een individueel veld globaal op.
 * @param {string} fieldName - Naam van het veld
 * @param {*} value - Waarde van het veld
 */
export function saveGlobalFieldData(fieldName, value) {
  if (!fieldName) return;
  const globalData = _getStorageObject(GLOBAL_FIELDS_DATA_KEY);
  globalData[fieldName] = value;
  _setStorageObject(GLOBAL_FIELDS_DATA_KEY, globalData);
}

/**
 * Laad een individueel globaal opgeslagen veld.
 * @param {string} fieldName - Naam van het veld
 * @returns {*|null} - Waarde van het veld of null
 */
export function loadGlobalFieldData(fieldName) {
  if (!fieldName) return null;
  const globalData = _getStorageObject(GLOBAL_FIELDS_DATA_KEY);
  return globalData[fieldName] !== undefined ? globalData[fieldName] : null;
}

/**
 * Verwijder opgeslagen globale data voor een specifiek veld.
 * @param {string} fieldName - Unieke veldnaam
 */
export function clearGlobalFieldData(fieldName) {
  if (!fieldName) return;
  const globalData = _getStorageObject(GLOBAL_FIELDS_DATA_KEY);
  if (globalData[fieldName] !== undefined) {
    delete globalData[fieldName];
    _setStorageObject(GLOBAL_FIELDS_DATA_KEY, globalData);
  }
}

/**
 * Sla flow-gegevens op (bv. multi-step data).
 * @param {string} formName - Unieke formuliernaam
 * @param {object} data
 */
export function saveFlowData(formName, data) {
  if (!formName) return;
  const flow = _getStorageObject(FLOW_DATA_KEY);
  flow[formName] = data;
  _setStorageObject(FLOW_DATA_KEY, flow);
}

/**
 * Laad flow-gegevens per formulier.
 * @param {string} formName
 * @returns {object|null}
 */
export function loadFlowData(formName) {
  if (!formName) return null;
  const flow = _getStorageObject(FLOW_DATA_KEY);
  return flow[formName] || null;
}

/**
 * Verwijder opgeslagen flow-gegevens voor een formulier.
 * @param {string} formName
 */
export function clearFlowData(formName) {
  if (!formName) return;
  const flow = _getStorageObject(FLOW_DATA_KEY);
  if (flow[formName]) {
    delete flow[formName];
    _setStorageObject(FLOW_DATA_KEY, flow);
  }
}
