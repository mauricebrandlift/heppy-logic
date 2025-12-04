// public/pages/bestellingSuccesPage.js
/**
 * Webshop Bestelling Success Page
 * Toont bevestiging na succesvolle betaling
 */

import { apiClient } from '../utils/api/client.js';
import { cart } from '../utils/cart.js';

/**
 * Initialize success page
 */
export async function initBestellingSuccesPage() {
  console.log('✅ [BestellingSucces] Initializing success page...');

  // Get payment_intent from URL
  const params = new URLSearchParams(window.location.search);
  const paymentIntentId = params.get('payment_intent');

  if (!paymentIntentId) {
    console.error('[BestellingSucces] No payment_intent in URL');
    showError('Geen betalingsinformatie gevonden. Neem contact op met support.');
    return;
  }

  try {
    // Show loading state
    showLoading();

    // Fetch order details from database via payment intent ID
    const orderData = await fetchOrderByPaymentIntent(paymentIntentId);

    if (!orderData) {
      showError('Bestelling niet gevonden. Neem contact op met support.');
      return;
    }

    // Display order confirmation
    displayOrderConfirmation(orderData);

    // Clear cart after successful order
    cart.clear();
    console.log('[BestellingSucces] ✅ Cart cleared after successful order');

    // Hide loading, show content
    hideLoading();

  } catch (error) {
    console.error('[BestellingSucces] Error loading order:', error);
    showError('Er is een fout opgetreden bij het laden van je bestelling. Neem contact op met support.');
  }
}

/**
 * Fetch order details by payment intent ID
 * @param {string} paymentIntentId
 * @returns {Promise<Object>}
 */
async function fetchOrderByPaymentIntent(paymentIntentId) {
  console.log('[BestellingSucces] Fetching order for payment intent:', paymentIntentId);

  try {
    // Call backend to get order details
    const response = await apiClient(`/routes/orders/by-payment-intent?payment_intent_id=${encodeURIComponent(paymentIntentId)}`);

    console.log('[BestellingSucces] Order data received:', response);
    return response;

  } catch (error) {
    console.error('[BestellingSucces] Error fetching order:', error);
    throw error;
  }
}

/**
 * Display order confirmation on the page
 * @param {Object} orderData
 */
function displayOrderConfirmation(orderData) {
  console.log('[BestellingSucces] Displaying order confirmation:', orderData);

  // Set payment details
  setPaymentDetail('order-number', orderData.bestel_nummer);
  setPaymentDetail('amount', formatCurrency(orderData.totaal_cents / 100));
  setPaymentDetail('status', orderData.betaal_status === 'paid' ? 'Betaald' : orderData.betaal_status);
  setPaymentDetail('payment-id', orderData.stripe_payment_intent_id);
  setPaymentDetail('order-date', formatDate(orderData.aangemaakt_op));

  // Set delivery address
  setPaymentDetail('delivery-name', orderData.bezorg_naam);
  setPaymentDetail('delivery-address', 
    `${orderData.bezorg_straat} ${orderData.bezorg_huisnummer}${orderData.bezorg_toevoeging ? ' ' + orderData.bezorg_toevoeging : ''}`
  );
  setPaymentDetail('delivery-postal', 
    `${orderData.bezorg_postcode} ${orderData.bezorg_plaats}`
  );

  // Display order items
  displayOrderItems(orderData.items || []);
}

/**
 * Set payment detail by name
 * @param {string} name
 * @param {string} value
 */
function setPaymentDetail(name, value) {
  const element = document.querySelector(`[data-payment-details="${name}"]`);
  if (element) {
    element.textContent = value;
  } else {
    console.warn(`[BestellingSucces] Element not found for: [data-payment-details="${name}"]`);
  }
}

/**
 * Display order items using template
 * @param {Array} items
 */
function displayOrderItems(items) {
  const container = document.querySelector('[data-order-items-container]');
  const template = document.querySelector('[data-order-item-template]');

  if (!container || !template) {
    console.warn('[BestellingSucces] Items container or template not found');
    return;
  }

  // Clear existing items (except template)
  const existingItems = container.querySelectorAll('[data-order-item-template]').length === 0 
    ? container.children 
    : Array.from(container.children).filter(child => !child.hasAttribute('data-order-item-template'));
  
  existingItems.forEach(item => {
    if (!item.hasAttribute('data-order-item-template')) {
      item.remove();
    }
  });

  // Clone and populate template for each item
  items.forEach(item => {
    const itemElement = template.cloneNode(true);
    itemElement.removeAttribute('data-order-item-template');
    itemElement.classList.remove('cart_product-item-template'); // Remove template class!
    itemElement.style.display = '';

    // Set product image
    const image = itemElement.querySelector('[data-order-item="image"]');
    if (image && item.product_afbeelding_url) {
      image.src = item.product_afbeelding_url;
      image.alt = item.product_naam;
    }

    // Set item details
    setOrderItemDetail(itemElement, 'name', item.product_naam);
    setOrderItemDetail(itemElement, 'quantity', item.aantal);
    setOrderItemDetail(itemElement, 'price', formatCurrency(item.prijs_per_stuk_cents / 100));

    container.appendChild(itemElement);
  });

  console.log(`[BestellingSucces] ✅ Displayed ${items.length} order items`);
}

/**
 * Set order item detail
 * @param {HTMLElement} itemElement
 * @param {string} name
 * @param {string} value
 */
function setOrderItemDetail(itemElement, name, value) {
  const element = itemElement.querySelector(`[data-order-item="${name}"]`);
  if (element) {
    element.textContent = value;
  }
}

/**
 * Format currency
 * @param {number} amount
 * @returns {string}
 */
function formatCurrency(amount) {
  return '€' + amount.toFixed(2).replace('.', ',');
}

/**
 * Format date to Dutch format
 * @param {string} dateString
 * @returns {string}
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  const options = { day: 'numeric', month: 'long', year: 'numeric' };
  return date.toLocaleDateString('nl-NL', options);
}

/**
 * Show loading state
 */
function showLoading() {
  const loader = document.querySelector('[data-loading]');
  const content = document.querySelector('[data-success-content]');
  
  if (loader) loader.style.display = 'flex';
  if (content) content.style.display = 'none';
}

/**
 * Hide loading state
 */
function hideLoading() {
  const loader = document.querySelector('[data-loading]');
  const content = document.querySelector('[data-success-content]');
  
  if (loader) loader.style.display = 'none';
  if (content) content.style.display = 'block';
}

/**
 * Show error message
 * @param {string} message
 */
function showError(message) {
  const loader = document.querySelector('[data-loading]');
  const content = document.querySelector('[data-success-content]');
  const errorContainer = document.querySelector('[data-error-message]');

  if (loader) loader.style.display = 'none';
  if (content) content.style.display = 'none';
  
  if (errorContainer) {
    errorContainer.textContent = message;
    errorContainer.style.display = 'block';
  } else {
    alert(message);
  }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname === '/shop/bestelling-succes') {
      initBestellingSuccesPage();
    }
  });
} else {
  if (window.location.pathname === '/shop/bestelling-succes') {
    initBestellingSuccesPage();
  }
}
