// filepath: c:\Users\mauri\OneDrive\MIJN BEDRIJF BRANDLIFT 2.0\KLANTEN\Heppy world\CODEREN 2\heppy-logic\public\forms\ui\formUI.js
/**
 * Form UI Management (formUi.js)
 * Handles all direct DOM manipulations for form elements, including populating fields,
 * displaying/clearing errors, and managing button states.
 */

export const formUi = {
  /**
   * Populates form fields with data.
   * @param {HTMLElement} formElement - The form DOM element.
   * @param {object} fieldsSchema - The schema object for the form's fields.
   * @param {object} data - Data to populate fields with (keys should match fieldNames in schema).
   */
  populateFields: function(formElement, fieldsSchema, data) {
    if (!formElement || !fieldsSchema || !data) {
      console.warn('FormUI: Missing required parameters for populateFields.');
      return;
    }

    for (const fieldName in fieldsSchema) {
      if (Object.hasOwnProperty.call(fieldsSchema, fieldName)) {
        const fieldConfig = fieldsSchema[fieldName];
        const inputElement = formElement.querySelector(`[data-field-name="${fieldConfig.dataFieldName}"]`);
        if (inputElement) {
          if (data[fieldName] !== undefined) {
            inputElement.value = data[fieldName];
          }
        } else {
          console.warn(`FormUI: Input element not found for field: ${fieldConfig.dataFieldName}`);
        }
      }
    }
  },

  /**
   * Displays an error message for a specific form field.
   * Assumes an error message element exists within a container for the field.
   * Example structure: <div data-field-container="fieldName"><input ...><div class="form-field-error"></div></div>
   * @param {HTMLElement} formElement - The form DOM element.
   * @param {string} fieldName - The schema name of the field (e.g., 'postcode').
   * @param {string} errorMessage - The error message to display.
   * @param {object} fieldSchema - The schema configuration for this specific field.
   */
  showFieldError: function(formElement, fieldName, errorMessage, fieldSchema) {
    if (!formElement || !fieldName || !errorMessage || !fieldSchema || !fieldSchema.dataFieldName) {
      console.warn('FormUI: Missing required parameters for showFieldError.');
      return;
    }
    const fieldContainer = formElement.querySelector(`[data-field-container="${fieldName}"]`);
    const inputElement = formElement.querySelector(`[data-field-name="${fieldSchema.dataFieldName}"]`);

    if (fieldContainer) {
      let errorElement = fieldContainer.querySelector('.form-field-error-message');
      if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.className = 'form-field-error-message';
        // Insert error message after the input or at the end of the container
        const inputForError = fieldContainer.querySelector(`[data-field-name="${fieldSchema.dataFieldName}"]`);
        if (inputForError && inputForError.nextSibling) {
            fieldContainer.insertBefore(errorElement, inputForError.nextSibling);
        } else {
            fieldContainer.appendChild(errorElement);
        }
      }
      errorElement.textContent = errorMessage;
      errorElement.style.display = 'block';
    } else {
      console.warn(`FormUI: Field container not found for field: ${fieldName}`);
    }

    if (inputElement) {
      inputElement.classList.add('input-error'); // Add a class to style the input itself
      inputElement.setAttribute('aria-invalid', 'true');
      inputElement.setAttribute('aria-describedby', `${fieldSchema.dataFieldName}-error`);
      if(fieldContainer && fieldContainer.querySelector('.form-field-error-message')) {
        fieldContainer.querySelector('.form-field-error-message').id = `${fieldSchema.dataFieldName}-error`;
      }
    }
  },

  /**
   * Clears an error message for a specific form field.
   * @param {HTMLElement} formElement - The form DOM element.
   * @param {string} fieldName - The schema name of the field.
   * @param {object} fieldSchema - The schema configuration for this specific field.
   */
  clearFieldError: function(formElement, fieldName, fieldSchema) {
    if (!formElement || !fieldName || !fieldSchema || !fieldSchema.dataFieldName) {
      console.warn('FormUI: Missing required parameters for clearFieldError.');
      return;
    }
    const fieldContainer = formElement.querySelector(`[data-field-container="${fieldName}"]`);
    const inputElement = formElement.querySelector(`[data-field-name="${fieldSchema.dataFieldName}"]`);

    if (fieldContainer) {
      const errorElement = fieldContainer.querySelector('.form-field-error-message');
      if (errorElement) {
        errorElement.textContent = '';
        errorElement.style.display = 'none';
      }
    }
    // else {
    //   console.warn(`FormUI: Field container not found for field: ${fieldName} when clearing error.`);
    // }

    if (inputElement) {
      inputElement.classList.remove('input-error');
      inputElement.removeAttribute('aria-invalid');
      inputElement.removeAttribute('aria-describedby');
    }
  },

  /**
   * Displays a global error message for the form.
   * Assumes an element with data-error-for="global" exists within the form.
   * @param {HTMLElement} formElement - The form DOM element.
   * @param {string} message - The global error message to display.
   */
  showGlobalError: function(formElement, message) {
    if (!formElement || !message) {
      console.warn('FormUI: Missing formElement or message for showGlobalError.');
      return;
    }
    const globalErrorElement = formElement.querySelector('[data-error-for="global"]');
    if (globalErrorElement) {
      globalErrorElement.textContent = message;
      globalErrorElement.style.display = 'block'; // Or use a class to show
    } else {
      console.warn('FormUI: Global error element [data-error-for="global"] not found.');
    }
  },

  /**
   * Clears the global error message for the form.
   * @param {HTMLElement} formElement - The form DOM element.
   */
  clearGlobalError: function(formElement) {
    if (!formElement) {
      console.warn('FormUI: Missing formElement for clearGlobalError.');
      return;
    }
    const globalErrorElement = formElement.querySelector('[data-error-for="global"]');
    if (globalErrorElement) {
      globalErrorElement.textContent = '';
      globalErrorElement.style.display = 'none'; // Or use a class to hide
    }
    // else {
    //   console.warn('FormUI: Global error element [data-error-for="global"] not found when clearing.');
    // }
  },

  /**
   * Sets the enabled/disabled state of a button and updates its class.
   * @param {HTMLElement} buttonElement - The button element.
   * @param {boolean} isActive - True to enable, false to disable.
   */
  setButtonState: function(buttonElement, isActive) {
    if (!buttonElement) {
      console.warn('FormUI: Button element not provided to setButtonState.');
      return;
    }
    buttonElement.disabled = !isActive;
    if (isActive) {
      buttonElement.classList.remove('button-disabled');
      buttonElement.classList.add('button-enabled'); // Optional: if you have specific enabled styles
    } else {
      buttonElement.classList.add('button-disabled');
      buttonElement.classList.remove('button-enabled');
    }
  },

  /**
   * Sets the loading state of a button.
   * @param {HTMLElement} buttonElement - The button element.
   * @param {boolean} isLoading - True to show loading, false to remove.
   * @param {string} [loadingText='Loading...'] - Text to display when loading.
   */
  setButtonLoading: function(buttonElement, isLoading, loadingText = 'Loading...') {
    if (!buttonElement) {
      console.warn('FormUI: Button element not provided to setButtonLoading.');
      return;
    }
    if (isLoading) {
      buttonElement.setAttribute('data-original-text', buttonElement.textContent);
      buttonElement.textContent = loadingText;
      buttonElement.classList.add('is-loading');
      buttonElement.disabled = true;
    } else {
      const originalText = buttonElement.getAttribute('data-original-text');
      if (originalText) {
        buttonElement.textContent = originalText;
        buttonElement.removeAttribute('data-original-text');
      }
      buttonElement.classList.remove('is-loading');
      // Note: This doesn't automatically re-enable the button.
      // Call setButtonState separately if the button should be active after loading.
    }
  }
};