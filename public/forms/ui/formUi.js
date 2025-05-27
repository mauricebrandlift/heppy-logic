// public/forms/ui/formUi.js

/**
 * UI helper functies voor formulieren:
 * - tonen/verbergen van field-specific errors
 * - tonen/verbergen van global form errors
 * - togglen van submit button
 * - togglen van alle form fields
 * - tonen/verbergen van loader op button
 */

/** Toon error(s) onder een specifiek veld.
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
        el.classList.add('visible');
      }
    });
  } else {
    // single field error
    const el = formEl.querySelector(`[data-error-for="${field}"]`);
    if (el) {
      el.textContent = message;
      el.classList.add('visible');
    }
  }
}

/** Verberg alle field errors en global errors
 * @param {HTMLFormElement} formEl
 * @param {string} [fieldName] - optioneel: alleen voor dit veld
 */
export function clearErrors(formEl, fieldName) {
  if (fieldName) {
    const el = formEl.querySelector(`[data-error-for="${fieldName}"]`);
    if (el) {
      el.textContent = '';
      el.classList.remove('visible');
    }
  } else {
    // clear all field errors
    formEl.querySelectorAll('[data-error-for]').forEach((el) => {
      el.textContent = '';
      el.classList.remove('visible');
    });
  }
}

/** Toon één of meerdere globale form-fouten in element met data-error-for="global"
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
  el.classList.add('visible');
}

/** Verberg global form error
 * @param {HTMLFormElement} formEl
 */
export function clearGlobalError(formEl) {
  const el = formEl.querySelector('[data-error-for="global"]');
  if (!el) return;
  el.innerHTML = '';
  el.classList.remove('visible');
}

/** Toggle disabled-state van button
 * @param {HTMLButtonElement} button
 * @param {boolean} isEnabled
 */
export function toggleButton(button, isEnabled) {
  if (!button) return;
  button.disabled = !isEnabled;
}

/** Toggle disabled-state van alle form fields
 * @param {HTMLFormElement} formEl
 * @param {boolean} isEnabled
 */
export function toggleFields(formEl, isEnabled) {
  formEl.querySelectorAll('input, select, textarea, button').forEach((el) => {
    if (el.type !== 'submit') el.disabled = !isEnabled;
  });
}

/** Voeg loader-element toe aan button (bijv. spinner)
 * @param {HTMLButtonElement} button
 */
export function showLoader(button) {
  if (!button) return;
  button.dataset.originalText = button.textContent;
  button.textContent = '⏳ Wachten...';
  button.disabled = true;
}

/** Haal loader weg en herstel originele button text
 * @param {HTMLButtonElement} button
 */
export function hideLoader(button) {
  if (!button) return;
  button.textContent = button.dataset.originalText || button.textContent;
  delete button.dataset.originalText;
}
