// public/forms/ui/formUi.js

/**
 * UI helper functies voor formulieren:
 * - tonen/verbergen van field-specific errors
 * - tonen/verbergen van global form errors
 * - togglen van submit button
 * - togglen van alle form fields
 * - tonen/verbergen van loader op button
 */

/**
 * Toon error(s) onder een specifiek veld.
 * @param {HTMLFormElement} formEl
 * @param {string|object} field - veldnaam of object met { field: message }
 * @param {string} [message] - boodschap (bij individuele call)
 */
export function showFieldErrors(formEl, field, message) {
  if (typeof field === 'object') {
    // batch errors: field is object { fieldName: message }
    Object.entries(field).forEach(([name, msg]) => {
      const el = formEl.querySelector(`[data-error-for="${name}"]`);
      if (el) {
        el.textContent = msg;
        // Toon error: verwijder 'hide' class
        el.classList.remove('hide');
      }
    });
  } else {
    // single field error
    const el = formEl.querySelector(`[data-error-for="${field}"]`);
    if (el) {
      el.textContent = message;
      // Toon error: verwijder 'hide' class
      el.classList.remove('hide');
    }
  }
}

/**
 * Verberg alle field errors en global errors
 * @param {HTMLFormElement} formEl
 * @param {string} [fieldName] - optioneel: alleen voor dit veld
 */
export function clearErrors(formEl, fieldName) {
  if (fieldName) {
    const el = formEl.querySelector(`[data-error-for="${fieldName}"]`);
    if (el) {
      el.textContent = '';
      // Verberg error: voeg 'hide' class toe
      el.classList.add('hide');
    }
  } else {
    // clear all field errors
    formEl.querySelectorAll('[data-error-for]').forEach((el) => {
      el.textContent = '';
      // Verberg error: voeg 'hide' class toe
      el.classList.add('hide');
    });
  }
}

/**
 * Toon één of meerdere globale form-fouten in element met data-error-for="global"
 * @param {HTMLFormElement} formEl
 * @param {string|string[]} messages
 */
export function showGlobalError(formEl, messages) {
  const el = formEl.querySelector('[data-error-for="global"]');
  if (!el) return;
  let html = '';
  if (Array.isArray(messages)) {
    html = '<ul>' + messages.map((m) => `<li>${m}</li>`).join('') + '</ul>';
  } else {
    html = `<div>${messages}</div>`;
  }
  el.innerHTML = html;
  // Toon global error: verwijder 'hide' class
  el.classList.remove('hide');
}

/**
 * Verberg global form error
 * @param {HTMLFormElement} formEl
 */
export function clearGlobalError(formEl) {
  const el = formEl.querySelector('[data-error-for="global"]');
  if (!el) return;
  el.innerHTML = '';
  // Verberg global error: voeg 'hide' class toe
  el.classList.add('hide');
}

/**
 * Toggle disabled-state van button
 * @param {HTMLButtonElement} button
 * @param {boolean} isEnabled
 */
export function toggleButton(button, isEnabled) {
  if (!button) return;
  button.disabled = !isEnabled;
  // Voeg CSS klasse toe voor disabled-state
  button.classList.toggle('is-disabled', !isEnabled);
}

/**
 * Toggle disabled-state van alle form fields
 * @param {HTMLFormElement} formEl
 * @param {boolean} isEnabled
 */
export function toggleFields(formEl, isEnabled) {
  formEl.querySelectorAll('input, select, textarea, button').forEach((el) => {
    el.disabled = !isEnabled;
    // Voeg/verwijder 'is-disabled' class alleen voor buttons
    if (el.tagName === 'BUTTON') {
      el.classList.toggle('is-disabled', !isEnabled);
    }
  });
}

/**
 * Toon spinner in de knop door de 'is-loading' class toe te voegen, en disable de knop.
 * @param {HTMLButtonElement} button De knop waarop de loader getoond moet worden.
 */
export function showLoader(button) {
  if (!button) return;

  button.classList.add('is-loading');
  button.disabled = true;
  button.classList.add('is-disabled'); // Behoud is-disabled voor styling van de disabled state, naast de loading state.
}

/**
 * Verberg spinner in de knop door de 'is-loading' class te verwijderen, en enable de knop.
 * @param {HTMLButtonElement} button De knop waarvan de loader verborgen moet worden.
 */
export function hideLoader(button) {
  if (!button) return;

  button.classList.remove('is-loading');
  button.disabled = false;
  button.classList.remove('is-disabled');
}

/**
 * Controleert de zichtbaarheid van een error element
 * @param {HTMLElement} errorEl - De error container om te controleren
 * @returns {boolean} True als de error zichtbaar is (geen hide class heeft)
 */
export function isErrorVisible(errorEl) {
  if (!errorEl) return false;
  return !errorEl.classList.contains('hide');
}

/**
 * Toon een specifieke error container met consistente styling
 * @param {HTMLElement} errorEl - De error container om te tonen
 * @param {string} message - De error message om te tonen
 */
export function showError(errorEl, message) {
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.classList.remove('hide');
}

/**
 * Verberg een specifieke error container
 * @param {HTMLElement} errorEl - De error container om te verbergen
 */
export function hideError(errorEl) {
  if (!errorEl) return;
  errorEl.textContent = '';
  errorEl.classList.add('hide');
}

/**
 * Synchroniseer stylingklassen voor custom radio groepen (bijv. Webflow "radio-fancy").
 * Zet de actieve klasse op het omliggende label en verwijdert deze van niet-geselecteerde opties.
 * @param {HTMLFormElement} formEl
 * @param {string} fieldName
 * @param {Object} [options]
 * @param {string} [options.activeClass='is-checked']
 * @param {string[]} [options.wrapperSelectors=['.w-radio', '.radio-fancy_field']]
 */
export function syncRadioGroupStyles(formEl, fieldName, options = {}) {
  if (!formEl || !fieldName) return;

  const {
    activeClass = 'is-checked',
    wrapperSelectors = ['.w-radio', '.radio-fancy_field'],
  } = options;

  const radios = formEl.querySelectorAll(`input[type="radio"][data-field-name="${fieldName}"]`);
  if (!radios.length) return;

  radios.forEach((radio) => {
    const isActive = !!radio.checked;

    // Toggle Webflow helper class zodat styling matcht alsof gebruiker zelf klikte
    radio.classList.toggle('w--redirected-checked', isActive);
    radio.setAttribute('aria-checked', isActive ? 'true' : 'false');

    wrapperSelectors.forEach((selector) => {
      const wrapper = radio.closest(selector);
      if (wrapper) {
        wrapper.classList.toggle(activeClass, isActive);
      }
    });
  });
}
