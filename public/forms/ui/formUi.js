// filepath: c:\Users\mauri\OneDrive\MIJN BEDRIJF BRANDLIFT 2.0\KLANTEN\Heppy world\CODEREN 2\heppy-logic\public\forms\ui\formUi.js
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
   * Assumes an error message element exists with a `data-error-for` attribute matching the input's `data-field-name`.
   * The error element should have a 'hide' class to be removed when showing the error.
   * @param {HTMLElement} formElement - The form DOM element.
   * @param {string} fieldName - The schema name of the field (e.g., 'postcode'). Used for console warnings if needed.
   * @param {string} errorMessage - The error message to display.
   * @param {object} fieldSchema - The schema configuration for this specific field, containing `dataFieldName`.
   */
  showFieldError: function(formElement, fieldName, errorMessage, fieldSchema) {
    if (!formElement || !fieldName || !errorMessage || !fieldSchema || !fieldSchema.dataFieldName) {
      console.warn('FormUI: Missing required parameters for showFieldError.');
      return;
    }
    const inputElement = formElement.querySelector(`[data-field-name="${fieldSchema.dataFieldName}"]`);
    const errorElement = formElement.querySelector(`[data-error-for="${fieldSchema.dataFieldName}"]`);

    if (errorElement) {
      errorElement.innerHTML = errorMessage; // Or innerText, depending on whether HTML is allowed in messages
      errorElement.classList.remove('hide');
    } else {
      console.warn(`FormUI: Error element with [data-error-for="${fieldSchema.dataFieldName}"] not found for field: ${fieldName}`);
    }

    if (inputElement) {
      // inputElement.classList.add('input-error'); // Removed
      // inputElement.setAttribute('aria-invalid', 'true'); // Removed
      if (errorElement) { // Only set aria-describedby if the error element exists
        const errorElementId = `${fieldSchema.dataFieldName}-error-message`; // Ensure unique ID
        errorElement.id = errorElementId;
        // inputElement.setAttribute('aria-describedby', errorElementId); // Removed
      }
    } else {
      console.warn(`FormUI: Input element not found for field: ${fieldSchema.dataFieldName}`);
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
    const inputElement = formElement.querySelector(`[data-field-name="${fieldSchema.dataFieldName}"]`);
    const errorElement = formElement.querySelector(`[data-error-for="${fieldSchema.dataFieldName}"]`);

    if (errorElement) {
      errorElement.innerHTML = ''; // Clear the message
      errorElement.classList.add('hide'); // Add 'hide' class to hide it
    }
    // else {
    //   console.warn(`FormUI: Error element [data-error-for="${fieldSchema.dataFieldName}"] not found for field: ${fieldName} when clearing error.`);
    // }

    if (inputElement) {
      // inputElement.classList.remove('input-error'); // Removed
      // inputElement.removeAttribute('aria-invalid'); // Removed
      // inputElement.removeAttribute('aria-describedby'); // Removed
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