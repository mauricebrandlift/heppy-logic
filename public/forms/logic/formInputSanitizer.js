/**
 * Sanitization and data collection utilities for form modules.
 *
 * @module public/forms/logic/formInputSanitizer
 * @version 1.0.0
 */

/**
 * Trim whitespace and escape HTML special characters in a string.
 * @param {string} value - Raw input value
 * @returns {string} Sanitized string
 */
export function sanitize(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  // Basic HTML escape
  return trimmed
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Collects all form input values into an object keyed by data-field-name.
 * @param {HTMLFormElement} formEl - The form element
 * @returns {Object.<string, string>} Named values of all inputs
 */
export function collect(formEl) {
  const data = {};
  const inputs = formEl.querySelectorAll('[data-field-name]');
  inputs.forEach((input) => {
    const name = input.getAttribute('data-field-name');
    let value = '';
    if (input.type === 'checkbox') {
      value = input.checked;
    } else if (input.type === 'radio') {
      if (input.checked) {
        value = input.value;
      } else {
        // skip unchecked radios
        return;
      }
    } else {
      value = input.value;
    }
    data[name] = sanitize(value);
  });
  return data;
}
