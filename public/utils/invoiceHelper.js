// public/utils/invoiceHelper.js
/**
 * Invoice Helper Utility
 * 
 * Herbruikbare functies voor het ophalen en tonen van Stripe facturen
 * Voor gebruik op detail paginas van: bestellingen, abonnementen, en opdrachten
 */

import { apiClient } from './api/client.js';

/**
 * Haal Stripe Invoice hosted URL op via invoice ID
 * 
 * @param {string} stripeInvoiceId - Stripe Invoice ID (in_xxx)
 * @returns {Promise<string|null>} Hosted invoice URL of null bij fout
 */
export async function getInvoiceUrl(stripeInvoiceId) {
  if (!stripeInvoiceId) {
    console.warn('[InvoiceHelper] No invoice ID provided');
    return null;
  }

  try {
    const response = await apiClient('/api/routes/stripe/get-invoice-url', {
      method: 'POST',
      body: JSON.stringify({ invoiceId: stripeInvoiceId })
    });

    if (response.hostedInvoiceUrl) {
      return response.hostedInvoiceUrl;
    }

    console.warn('[InvoiceHelper] No hosted invoice URL in response', response);
    return null;

  } catch (error) {
    console.error('[InvoiceHelper] Failed to fetch invoice URL:', error);
    return null;
  }
}

/**
 * Initialiseer factuur download button
 * Zoekt naar buttons met [data-invoice-button] attribuut en koppelt functionaliteit
 * 
 * @param {Object} options - Configuratie opties
 * @param {string} options.invoiceId - Stripe Invoice ID (optioneel als data-invoice-id attribuut aanwezig)
 * @param {string} options.buttonSelector - CSS selector voor button (default: '[data-invoice-button]')
 * @param {Function} options.onLoading - Callback tijdens laden (default: disabled + loading state)
 * @param {Function} options.onError - Callback bij fout (default: console.error + alert)
 * @param {Function} options.onSuccess - Callback bij succes (default: open URL in new tab)
 */
export function initInvoiceButton(options = {}) {
  const {
    invoiceId,
    buttonSelector = '[data-invoice-button]',
    onLoading = defaultLoadingHandler,
    onError = defaultErrorHandler,
    onSuccess = defaultSuccessHandler
  } = options;

  const buttons = document.querySelectorAll(buttonSelector);

  if (buttons.length === 0) {
    console.warn(`[InvoiceHelper] No buttons found with selector: ${buttonSelector}`);
    return;
  }

  buttons.forEach(button => {
    // Haal invoice ID op van button data attribuut of gebruik global invoiceId
    const buttonInvoiceId = button.dataset.invoiceId || invoiceId;

    if (!buttonInvoiceId) {
      console.warn('[InvoiceHelper] Button has no invoice ID', button);
      button.style.display = 'none'; // Verberg button als geen invoice ID
      return;
    }

    // Klik handler
    button.addEventListener('click', async (e) => {
      e.preventDefault();

      // Loading state
      onLoading(button, true);

      try {
        const invoiceUrl = await getInvoiceUrl(buttonInvoiceId);

        if (!invoiceUrl) {
          throw new Error('Geen factuur URL ontvangen');
        }

        // Success
        onSuccess(button, invoiceUrl);

      } catch (error) {
        // Error
        onError(button, error);
      } finally {
        // Reset loading state
        onLoading(button, false);
      }
    });

    console.log(`[InvoiceHelper] Invoice button initialized for: ${buttonInvoiceId}`);
  });
}

/**
 * Default loading handler - disable button en toon loading state
 */
function defaultLoadingHandler(button, isLoading) {
  if (isLoading) {
    button.disabled = true;
    button.dataset.originalText = button.textContent;
    button.textContent = 'Laden...';
  } else {
    button.disabled = false;
    if (button.dataset.originalText) {
      button.textContent = button.dataset.originalText;
      delete button.dataset.originalText;
    }
  }
}

/**
 * Default error handler - log en toon alert
 */
function defaultErrorHandler(button, error) {
  console.error('[InvoiceHelper] Error:', error);
  alert('Factuur kon niet worden geladen. Probeer het later opnieuw.');
}

/**
 * Default success handler - open URL in nieuw tabblad
 */
function defaultSuccessHandler(button, invoiceUrl) {
  window.open(invoiceUrl, '_blank', 'noopener,noreferrer');
}

/**
 * Verkrijg invoice ID vanuit bestelling, betaling of opdracht data
 * Helper functie om invoice ID op te halen uit verschillende data bronnen
 * 
 * @param {Object} data - Data object (bestelling, betaling, of opdracht)
 * @returns {string|null} Stripe Invoice ID of null
 */
export function extractInvoiceId(data) {
  if (!data) return null;
  
  // Direct invoice ID veld
  if (data.stripe_invoice_id) {
    return data.stripe_invoice_id;
  }
  
  // Nested in betaling object
  if (data.betaling && data.betaling.stripe_invoice_id) {
    return data.betaling.stripe_invoice_id;
  }
  
  console.warn('[InvoiceHelper] No invoice ID found in data', data);
  return null;
}

/**
 * Check of een factuur beschikbaar is
 * Toon of verberg invoice button op basis van beschikbaarheid
 * 
 * @param {string|null} invoiceId - Stripe Invoice ID
 * @param {HTMLElement} button - Button element om te tonen/verbergen
 */
export function toggleInvoiceButton(invoiceId, button) {
  if (!button) return;

  if (invoiceId) {
    button.style.display = ''; // Toon button
    button.dataset.invoiceId = invoiceId;
  } else {
    button.style.display = 'none'; // Verberg button
  }
}
