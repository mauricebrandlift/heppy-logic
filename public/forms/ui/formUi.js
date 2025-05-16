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
 * @version 1.0.2
 */

/**
 * Vul formuliervelden in met opgeslagen data.
 * Logt de ingevulde waarden.
 * @param {HTMLFormElement} formEl - Het formulier-element
 * @param {Object.<string, any>} data - Data object met keys overeenkomend met data-field-name
 */
export function prefillFields(formEl, data) {
  console.log('[formUi] prefillFields called with data:', data);
  Object.entries(data).forEach(([key, value]) => {
    const input = formEl.querySelector(`[data-field-name="${key}"]`);
    if (input) {
      console.log(`[formUi] setting field ${key} to value:`, value);
      input.value = value;
    } else {
      console.warn(`[formUi] no input found for prefill key: ${key}`);
    }
  });
}

/**
 * Verwijdert alle foutmeldingen uit het formulier.
 * Logt de weggehaalde placeholders.
 * @param {HTMLFormElement} formEl
 */
export function clearErrors(formEl) {
  console.log('[formUi] clearErrors called');
  formEl.querySelectorAll('[data-error-for]').forEach(el => {
    console.log('[formUi] clearing error placeholder:', el.getAttribute('data-error-for'));
    el.textContent = '';
  });
}

/**
 * Toont foutmeldingen voor een specifiek veld of een lijst met foutobjecten.
 * Logt elk foutbericht.
 * @param {HTMLFormElement} formEl
 * @param {string|Array<{field: string|null, message: string}>} fieldOrErrors
 * @param {Array<{field: string, message: string}>} [errors]
 */
export function showErrors(formEl, fieldOrErrors, errors) {
  console.log('[formUi] showErrors called with:', fieldOrErrors, errors);
  clearErrors(formEl);
  if (Array.isArray(fieldOrErrors)) {
    fieldOrErrors.forEach(err => {
      if (err.field) {
        console.log(`[formUi] showing error for field ${err.field}:`, err.message);
        showFieldError(formEl, err.field, err.message);
      } else {
        console.log('[formUi] showing global error:', err.message);
        showGlobalError(formEl, err.message);
      }
    });
  } else if (errors && Array.isArray(errors)) {
    console.log(`[formUi] showing errors for field ${fieldOrErrors}:`, errors);
    errors.forEach(err => showFieldError(formEl, fieldOrErrors, err.message));
  }
}

/**
 * Zet een foutmelding in de placeholder voor een veld.
 * Logt de placeholder update.
 * @param {HTMLFormElement} formEl
 * @param {string} fieldName
 * @param {string} message
 */
function showFieldError(formEl, fieldName, message) {
  const placeholder = formEl.querySelector(`[data-error-for="${fieldName}"]`);
  if (placeholder) {
    console.log(`[formUi] placeholder ${fieldName} message set to:`, message);
    placeholder.textContent = message;
  } else {
    console.error(`[formUi] no placeholder found for field error: ${fieldName}`);
  }
}

/**
 * Zet een globale foutmelding in de placeholder met data-error-for="global".
 * Logt de placeholder update.
 * @param {HTMLFormElement} formEl
 * @param {string} message
 */
export function showGlobalError(formEl, message) {
  const placeholder = formEl.querySelector('[data-error-for="global"]');
  if (placeholder) {
    console.log('[formUi] global placeholder message set to:', message);
    placeholder.textContent = message;
  } else {
    console.error('[formUi] no placeholder found for global error');
  }
}

/**
 * Toggle de disabled-status van de submit-knop.
 * Logt de nieuwe status.
 * @param {HTMLButtonElement} submitBtn
 * @param {boolean} isValid
 */
export function toggleButton(submitBtn, isValid) {
  console.log('[formUi] toggleButton called, isValid =', isValid);
  submitBtn.disabled = !isValid;
}

/**
 * Schakel alle form-velden in of uit.
 * Logt de togglestatus.
 * @param {HTMLFormElement} formEl
 * @param {boolean} enabled
 */
export function toggleFields(formEl, enabled) {
  console.log('[formUi] toggleFields called, enabled =', enabled);
  Array.from(formEl.elements).forEach(el => {
    el.disabled = !enabled;
  });
}

/**
 * Toon een loader/status op de submit-knop.
 * Logt loader start.
 * @param {HTMLButtonElement} submitBtn
 */
export function showLoader(submitBtn) {
  console.log('[formUi] showLoader called');
  submitBtn.setAttribute('data-original-text', submitBtn.textContent);
  submitBtn.textContent = '';
  const spinner = document.createElement('span');
  spinner.className = 'spinner';
  submitBtn.appendChild(spinner);
  submitBtn.disabled = true;
}

/**
 * Verberg de loader en herstel de oorspronkelijke knoptekst.
 * Logt loader stop.
 * @param {HTMLButtonElement} submitBtn
 */
export function hideLoader(submitBtn) {
  console.log('[formUi] hideLoader called');
  const original = submitBtn.getAttribute('data-original-text');
  if (original) submitBtn.textContent = original;
  submitBtn.removeAttribute('data-original-text');
  submitBtn.disabled = false;
}
