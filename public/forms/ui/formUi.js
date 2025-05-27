// public/forms/ui/formUi.js

// Vul formuliervelden in met opgeslagen data
export function prefillFields(formEl, data) {
  Object.entries(data).forEach(([field, value]) => {
    const input = formEl.querySelector(`[data-field-name="${field}"]`);
    if (input) input.value = value;
  });
}

// Maak alle foutplaceholders leeg
export function clearErrors(formEl) {
  formEl.querySelectorAll('[data-error-for]').forEach(el => {
    el.textContent = '';
  });
}

// Maak foutplaceholder voor één veld leeg
export function clearFieldError(formEl, fieldName) {
  const placeholder = formEl.querySelector(`[data-error-for="${fieldName}"]`);
  if (placeholder) placeholder.textContent = '';
}

// Toon foutmelding voor één veld
export function showFieldError(formEl, fieldName, message) {
  const placeholder = formEl.querySelector(`[data-error-for="${fieldName}"]`);
  if (placeholder) placeholder.textContent = message;
}

// Toon globale foutmelding
export function showGlobalError(formEl, message) {
  const placeholder = formEl.querySelector('[data-error-for="global"]');
  if (placeholder) placeholder.textContent = message;
}

// Toon meerdere fouten; clear eerst alles
export function showErrors(formEl, errorList) {
  clearErrors(formEl);
  if (!Array.isArray(errorList)) return;
  errorList.forEach(err => {
    if (err.field) showFieldError(formEl, err.field, err.message);
    else showGlobalError(formEl, err.message);
  });
}

// Toggle submit-knop
export function toggleButton(buttonEl, isEnabled) {
  buttonEl.disabled = !isEnabled;
}

// Schakel alle velden in/uit
export function toggleFields(formEl, enabled) {
  Array.from(formEl.elements).forEach(el => el.disabled = !enabled);
}

// Toon loader op knop
export function showLoader(buttonEl) {
  const original = buttonEl.textContent;
  buttonEl.setAttribute('data-original-text', original);
  buttonEl.textContent = '';
  const spinner = document.createElement('span');
  spinner.className = 'spinner';
  buttonEl.appendChild(spinner);
  buttonEl.disabled = true;
}

// Verberg loader en herstel tekst
export function hideLoader(buttonEl) {
  const original = buttonEl.getAttribute('data-original-text');
  if (original !== null) {
    buttonEl.textContent = original;
    buttonEl.removeAttribute('data-original-text');
  }
  buttonEl.disabled = false;
}
