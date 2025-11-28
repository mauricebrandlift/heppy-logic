/**
 * Shop Page JavaScript
 * Handles product listing and add to cart functionality
 */

import { cart } from '../utils/cart.js';
import { openCartPopup } from '../forms/ui/cartManager.js';

/**
 * Initialize shop page
 */
export function initShopPage() {
  console.log('🛍️ Initializing shop page...');

  // Update cart counter on page load
  cart.updateCartCounter();

  // Add event listeners to all "Add to Cart" buttons
  setupAddToCartButtons();
}

/**
 * Setup event listeners for add to cart buttons
 */
function setupAddToCartButtons() {
  const addToCartButtons = document.querySelectorAll('[data-add-to-cart]');

  addToCartButtons.forEach(button => {
    button.addEventListener('click', handleAddToCart);
  });

  console.log(`✅ Found ${addToCartButtons.length} add to cart buttons`);
}

/**
 * Handle add to cart button click
 * @param {Event} event
 */
function handleAddToCart(event) {
  event.preventDefault();

  const button = event.currentTarget;
  const productItem = button.closest('.product_item');

  if (!productItem) {
    console.error('Product item not found');
    return;
  }

  // Get product data from data attributes
  const productData = {
    id: productItem.dataset.productId,
    name: productItem.dataset.productName,
    price: productItem.dataset.productPrice,
    slug: productItem.dataset.productSlug,
    image: productItem.dataset.productImage || '' // Image URL from Webflow
  };

  // Validate product data
  if (!productData.id || !productData.name || !productData.price) {
    console.error('Missing product data:', productData);
    return;
  }

  // Add to cart
  try {
    const addedItem = cart.addItem(productData, 1);
    console.log('✅ Added to cart:', addedItem);

    // Open cart popup to show updated cart
    openCartPopup();

    // Visual feedback on button
    const originalText = button.textContent;
    button.textContent = 'Toegevoegd! ✓';
    button.disabled = true;

    setTimeout(() => {
      button.textContent = originalText;
      button.disabled = false;
    }, 2000);

  } catch (error) {
    console.error('Error adding to cart:', error);
    alert('Er ging iets mis bij het toevoegen aan je winkelwagen. Probeer het opnieuw.');
  }
}

// Auto-initialize if we're on the shop page
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Check if we're on a page with products
    if (document.querySelector('[data-add-to-cart]')) {
      initShopPage();
    }
  });
} else {
  // DOM already loaded
  if (document.querySelector('[data-add-to-cart]')) {
    initShopPage();
  }
}
