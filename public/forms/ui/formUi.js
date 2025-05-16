/**
 * UI-helper functies voor formulierscripts.
 * Behandelt het tonen/verbergen van foutmeldingen via placeholders,
 * togglen van knoppen en velden, tonen van loaders en prefill van saved data.
 *
 * Verwacht statische error-elementen in de HTML met:
 *   - data-error-for="<fieldName>" voor veldspecifieke fouten
 *   - data-error-for="global" voor globale fouten
 *
 * @module public/forms/ui/formUi
 * @version 1.0.1
 */

/**
 * Vul formuliervelden in met opgeslagen data.
 * @param {HTMLFormElement} formEl - Het formulier-element
 * @param {Object.<string, any>} data - Data object met keys overeenkomend met data-field-name
 */
export function prefillFields(formEl, data) {
  Object.entries(data).forEach(([key, value]) => {
    const input = formEl.querySelector(`[data-field-name="${key}"]`);
    if (input) input.value = value;
  });
}

/**
 * Verwijdert alle foutmeldingen uit het formulier.
 * Leegt de textContent van alle placeholders.
 * @param {HTMLFormElement} formEl
 */
export function clearErrors(formEl) {
  formEl.querySelectorAll('[data-error-for]').forEach(el => {
    el.textContent = '';
  });
}

/**
 * Toont foutmeldingen voor een specifiek veld of een lijst met foutobjecten.
 * Veldfouten worden in de bijbehorende placeholder gezet.
 * Globale fouten in de placeholder met data-error-for="global".
 * @param {HTMLFormElement} formEl
 * @param {string|Array<{field: string|null, message: string}>} fieldOrErrors
 * @param {Array<{field: string, message: string}>} [errors]
 */
export function showErrors(formEl, fieldOrErrors, errors) {
  clearErrors(formEl);
  if (Array.isArray(fieldOrErrors)) {
    fieldOrErrors.forEach(err => {
      if (err.field) showFieldError(formEl, err.field, err.message);
      else showGlobalError(formEl, err.message);
    });
  } else if (errors && Array.isArray(errors)) {
    errors.forEach(err => showFieldError(formEl, fieldOrErrors, err.message));
  }
}

/**
 * Zet een foutmelding in de placeholder voor een veld.
 * @param {HTMLFormElement} formEl
 * @param {string} fieldName
 * @param {string} message
 */
function showFieldError(formEl, fieldName, message) {
  const placeholder = formEl.querySelector(`[data-error-for="${fieldName}"]`);
  if (placeholder) placeholder.textContent = message;
}

/**
 * Zet een globale foutmelding in de placeholder met data-error-for="global".
 * @param {HTMLFormElement} formEl
 * @param {string} message
 */
export function showGlobalError(formEl, message) {
  const placeholder = formEl.querySelector('[data-error-for="global"]');
  if (placeholder) placeholder.textContent = message;
}

/**
 * Toggle de disabled-status van de submit-knop.
 * @param {HTMLButtonElement} submitBtn
 * @param {boolean} isValid
 */
export function toggleButton(submitBtn, isValid) {
  submitBtn.disabled = !isValid;
}

/**
 * Schakel alle form-velden in of uit.
 * @param {HTMLFormElement} formEl
 * @param {boolean} enabled
 */
export function toggleFields(formEl, enabled) {
  Array.from(formEl.elements).forEach(el => { el.disabled = !enabled; });
}

/**
 * Toon een loader/status op de submit-knop.
 * @param {HTMLButtonElement} submitBtn
 */
export function showLoader(submitBtn) {
  submitBtn.setAttribute('data-original-text', submitBtn.textContent);
  submitBtn.textContent = '';
  const spinner = document.createElement('span');
  spinner.className = 'spinner';
  submitBtn.appendChild(spinner);
  submitBtn.disabled = true;
}

/**
 * Verberg de loader en herstel de oorspronkelijke knoptekst.
 * @param {HTMLButtonElement} submitBtn
 */
export function hideLoader(submitBtn) {
  const original = submitBtn.getAttribute('data-original-text');
  if (original) submitBtn.textContent = original;
  submitBtn.removeAttribute('data-original-text');
  submitBtn.disabled = false;
}
