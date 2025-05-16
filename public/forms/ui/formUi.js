/**
 * UI-helper functies voor formulierscripts.
 * Behandelt het tonen/verbergen van foutmeldingen, togglen van knoppen en velden,
 * tonen van loaders en prefill van saved data.
 *
 * @module public/forms/ui/formUi
 * @version 1.0.0
 */

/**
 * Vul formuliervelden in met opgeslagen data.
 * @param {HTMLFormElement} formEl - Het formulier-element
 * @param {Object.<string, any>} data - Data object met keys overeenkomend met data-field-name
 */
export function prefillFields(formEl, data) {
  Object.entries(data).forEach(([key, value]) => {
    const input = formEl.querySelector(`[data-field-name="${key}"]`);
    if (input) {
      input.value = value;
    }
  });
}

/**
 * Verwijdert alle foutmeldingen uit het formulier.
 * @param {HTMLFormElement} formEl
 */
export function clearErrors(formEl) {
  // remove field errors
  formEl.querySelectorAll('.form-error').forEach(el => el.remove());
  // remove global errors
  const globalError = formEl.querySelector('.form-global-error');
  if (globalError) globalError.remove();
}

/**
 * Toont foutmeldingen voor een specifiek veld of een lijst met foutobjecten.
 * @param {HTMLFormElement} formEl
 * @param {string|Array<{field: string|null, message: string}>} fieldOrErrors
 * @param {Array<{field: string, message: string}>} [errors]
 */
export function showErrors(formEl, fieldOrErrors, errors) {
  clearErrors(formEl);
  // multiple errors passed
  if (Array.isArray(fieldOrErrors)) {
    fieldOrErrors.forEach(err => {
      if (err.field) {
        showFieldError(formEl, err.field, err.message);
      } else {
        showGlobalError(formEl, err.message);
      }
    });
  } else if (errors && Array.isArray(errors)) {
    // single field with errors array
    errors.forEach(err => {
      showFieldError(formEl, fieldOrErrors, err.message);
    });
  }
}

/**
 * Toont een foutmelding bij een specifiek veld.
 * @param {HTMLFormElement} formEl
 * @param {string} fieldName
 * @param {string} message
 */
function showFieldError(formEl, fieldName, message) {
  const input = formEl.querySelector(`[data-field-name="${fieldName}"]`);
  if (!input) return;
  const errorEl = document.createElement('div');
  errorEl.className = 'form-error';
  errorEl.textContent = message;
  input.insertAdjacentElement('afterend', errorEl);
}

/**
 * Toont een globale foutmelding bovenaan het formulier.
 * @param {HTMLFormElement} formEl
 * @param {string} message
 */
export function showGlobalError(formEl, message) {
  const errorEl = document.createElement('div');
  errorEl.className = 'form-global-error';
  errorEl.textContent = message;
  formEl.insertAdjacentElement('afterbegin', errorEl);
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
  if (original) {
    submitBtn.textContent = original;
    submitBtn.removeAttribute('data-original-text');
  }
  submitBtn.disabled = false;
}
