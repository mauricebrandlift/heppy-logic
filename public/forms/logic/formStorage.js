/**
 * Opslag-utilities voor formulierdata.
 * Ondersteunt twee opslagtypes:
 *  1) 'flowData' voor gevalideerde data bij submit
 *  2) 'formData' voor prefill data tijdens invullen
 *
 * @module public/forms/logic/formStorage
 * @version 1.0.1
 */

/**
 * Haalt gevalideerde formulierdata op (flowData) uit localStorage.
 * @param {string} key - Naam van het formulier of stap (bijv. 'postcode-form')
 * @returns {any|null} Het opgeslagen object of null als niet gevonden
 */
export function getFormData(key) {
  try {
    const all = JSON.parse(localStorage.getItem('flowData') || '{}');
    return all[key] ?? null;
  } catch (err) {
    console.error(`[formStorage] Fout bij getFormData key="${key}"`, err);
    return null;
  }
}

/**
 * Slaat gevalideerde formulierdata op (flowData) in localStorage.
 * @param {string} key - Naam van het formulier of stap
 * @param {any} value - Object met gevalideerde data
 */
export function setFormData(key, value) {
  try {
    const all = JSON.parse(localStorage.getItem('flowData') || '{}');
    all[key] = value;
    localStorage.setItem('flowData', JSON.stringify(all));
  } catch (err) {
    console.error(`[formStorage] Fout bij setFormData key="${key}"`, err);
  }
}

/**
 * Haalt prefill data op (formData) uit localStorage.
 * @param {string} key - Naam van het formulier of stap
 * @returns {any|null} Het opgeslagen object of null als niet gevonden
 */
export function getPrefillData(key) {
  try {
    const all = JSON.parse(localStorage.getItem('formData') || '{}');
    return all[key] ?? null;
  } catch (err) {
    console.error(`[formStorage] Fout bij getPrefillData key="${key}"`, err);
    return null;
  }
}

/**
 * Slaat prefill data op (formData) in localStorage.
 * @param {string} key - Naam van het formulier of stap
 * @param {any} value - Object met huidige invulwaarden
 */
export function setPrefillData(key, value) {
  try {
    const all = JSON.parse(localStorage.getItem('formData') || '{}');
    all[key] = value;
    localStorage.setItem('formData', JSON.stringify(all));
  } catch (err) {
    console.error(`[formStorage] Fout bij setPrefillData key="${key}"`, err);
  }
}
