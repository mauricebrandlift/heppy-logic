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
 * Toon spinner in de knop, verberg het standaard icoon, en disable de knop.
 * @param {HTMLButtonElement} button De knop waarop de loader getoond moet worden.
 */
export function showLoader(button) {
  if (!button) return;

  const iconElement = button.querySelector('.is-icon'); // Standaard icoon in de knop
  const spinnerElement = button.querySelector('.is-spinner'); // Spinner element in de knop

  if (iconElement) {
    iconElement.style.display = 'none';
  }
  if (spinnerElement) {
    spinnerElement.style.display = 'inline-block'; // Of 'block', afhankelijk van je CSS voor de spinner
  } else {
    // Fallback als er geen .is-spinner element is.
    // Overweeg hier de oude tekstverandering te herintroduceren indien nodig.
    console.warn('[FormUi] Geen .is-spinner element gevonden in de knop:', button);
  }

  button.disabled = true;
  button.classList.add('is-disabled');
}

/**
 * Verberg spinner in de knop, toon het standaard icoon, en enable de knop.
 * @param {HTMLButtonElement} button De knop waarvan de loader verborgen moet worden.
 */
export function hideLoader(button) {
  if (!button) return;

  const iconElement = button.querySelector('.is-icon'); // Standaard icoon in de knop
  const spinnerElement = button.querySelector('.is-spinner'); // Spinner element in de knop

  if (spinnerElement) {
    spinnerElement.style.display = 'none';
  }
  if (iconElement) {
    iconElement.style.display = 'inline-block'; // Of 'block', afhankelijk van je CSS
  } else {
    // Fallback als er geen .is-icon element is om te herstellen.
    console.warn('[FormUi] Geen .is-icon element gevonden in de knop om te herstellen:', button);
  }

  button.disabled = false;
  button.classList.remove('is-disabled');
}
