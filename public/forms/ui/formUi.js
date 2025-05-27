export function clearErrors(formEl) {
  console.log('[UI] clearErrors');
  const errorPlaceholders = formEl.querySelectorAll('[data-error-for]');
  errorPlaceholders.forEach(placeholder => {
    const key = placeholder.getAttribute('data-error-for');
    console.log(`[UI] clearing error placeholder for: ${key}`);
    placeholder.textContent = '';
  });
}

export function showErrors(formEl, errorList) {
  console.log('[UI] showErrors', errorList);
  clearErrors(formEl);
  if (!Array.isArray(errorList)) {
    console.warn('[UI] showErrors expects an array of errors');
    return;
  }
  errorList.forEach(err => {
    if (err.field) {
      console.log(`[UI] field error for ${err.field}: ${err.message}`);
      showFieldError(formEl, err.field, err.message);
    } else {
      console.log(`[UI] global error: ${err.message}`);
      showGlobalError(formEl, err.message);
    }
  });
}

function showFieldError(formEl, fieldName, message) {
  const selector = `[data-error-for="${fieldName}"]`;
  const placeholder = formEl.querySelector(selector);
  if (placeholder) {
    console.log(`[UI] setting error for field ${fieldName}: ${message}`);
    placeholder.textContent = message;
  } else {
    console.error(`[UI] no placeholder found for field error: ${fieldName}`);
  }
}

export function showGlobalError(formEl, message) {
  const placeholder = formEl.querySelector('[data-error-for="global"]');
  if (placeholder) {
    console.log(`[UI] setting global error: ${message}`);
    placeholder.textContent = message;
  } else {
    console.error('[UI] no placeholder found for global error');
  }
}

export function toggleButton(buttonEl, isEnabled) {
  console.log(`[UI] toggleButton: setting enabled=${isEnabled}`);
  buttonEl.disabled = !isEnabled;
}

export function toggleFields(formEl, enabled) {
  console.log(`[UI] toggleFields: enabled=${enabled}`);
  Array.from(formEl.elements).forEach(el => {
    el.disabled = !enabled;
  });
}

export function showLoader(buttonEl) {
  console.log('[UI] showLoader');
  const original = buttonEl.textContent;
  buttonEl.setAttribute('data-original-text', original);
  buttonEl.textContent = '';
  const spinner = document.createElement('span');
  spinner.className = 'spinner';
  buttonEl.appendChild(spinner);
  buttonEl.disabled = true;
}

export function hideLoader(buttonEl) {
  console.log('[UI] hideLoader');
  const original = buttonEl.getAttribute('data-original-text');
  if (original !== null) {
    buttonEl.textContent = original;
    buttonEl.removeAttribute('data-original-text');
  }
  buttonEl.disabled = false;
}
