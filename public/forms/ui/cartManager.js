/**
 * Cart Manager
 * Manages the shopping cart popup display and interactions
 */

import { cart, VERZENDKOSTEN } from '../../utils/cart.js';

/**
 * Initialize cart manager
 */
export function initCartManager() {
  console.log('🛒 Initializing cart manager...');

  // Render cart on page load
  renderCart();

  // Listen for cart updates (from other pages/tabs)
  window.addEventListener('storage', (e) => {
    if (e.key === 'heppy_cart') {
      renderCart();
    }
  });

  // Listen for custom cart update events
  window.addEventListener('cartUpdated', () => {
    renderCart();
  });

  console.log('✅ Cart manager initialized');
}

/**
 * Render cart items and totals
 */
export function renderCart() {
  const totals = cart.getTotals();
  const items = totals.items;

  console.log('🔄 Rendering cart:', { itemCount: totals.itemCount, items });

  // Toggle empty/has-products states
  toggleCartStates(items.length > 0);

  // Render items
  renderCartItems(items);

  // Update totals
  updateCartTotals(totals);

  // Update counter badge
  cart.updateCartCounter();
}

/**
 * Toggle between empty and has-products states
 * @param {boolean} hasProducts
 */
function toggleCartStates(hasProducts) {
  const emptyElements = document.querySelectorAll('[data-cart-empty]');
  const hasProductsElements = document.querySelectorAll('[data-cart-has-products]');

  emptyElements.forEach(el => {
    el.style.display = hasProducts ? 'none' : '';
  });

  hasProductsElements.forEach(el => {
    el.style.display = hasProducts ? '' : 'none';
  });
}

/**
 * Render cart items in the container
 * @param {Array} items
 */
function renderCartItems(items) {
  const container = document.querySelector('[data-cart-items-container]');
  if (!container) {
    console.warn('Cart items container not found');
    return;
  }

  // Find template (should be hidden)
  const template = container.querySelector('.cart_product-item-template[data-cart-item]');
  if (!template) {
    console.warn('Cart item template not found');
    return;
  }

  // Clear container (keep only template)
  const clones = container.querySelectorAll('[data-cart-item]:not(.cart_product-item-template)');
  clones.forEach(clone => clone.remove());

  // Render each item
  items.forEach(item => {
    const itemElement = createCartItemElement(template, item);
    container.appendChild(itemElement);
  });
}

/**
 * Create cart item element from template
 * @param {HTMLElement} template
 * @param {Object} item
 * @returns {HTMLElement}
 */
function createCartItemElement(template, item) {
  const clone = template.cloneNode(true);
  clone.style.display = ''; // Show clone
  clone.classList.remove('cart_product-item-template'); // Remove template class
  clone.setAttribute('data-product-id', item.id);

  // Set product image
  const image = clone.querySelector('[data-cart-item-image]');
  if (image) {
    // Image URL should come from Webflow CMS or be stored in cart
    // For now, we'll keep the placeholder from template
    // TODO: Add image URL to cart when adding product
  }

  // Set product name
  const nameElement = clone.querySelector('[data-cart-item-name]');
  if (nameElement) {
    nameElement.textContent = item.name;
  }

  // Set quantity
  const quantityElement = clone.querySelector('[data-cart-item-quantity]');
  if (quantityElement) {
    quantityElement.textContent = item.quantity;
  }

  // Set subtotal (price × quantity)
  const subtotalElement = clone.querySelector('[data-cart-item-subtotal]');
  if (subtotalElement) {
    const subtotal = (item.price * item.quantity).toFixed(2);
    subtotalElement.textContent = subtotal;
  }

  // Add event listeners
  setupCartItemListeners(clone, item);

  return clone;
}

/**
 * Setup event listeners for cart item
 * @param {HTMLElement} element
 * @param {Object} item
 */
function setupCartItemListeners(element, item) {
  // Decrease quantity button
  const decreaseBtn = element.querySelector('[data-decrease-quantity]');
  if (decreaseBtn) {
    decreaseBtn.addEventListener('click', () => {
      const newQuantity = item.quantity - 1;
      if (newQuantity <= 0) {
        // Remove item if quantity becomes 0
        cart.removeItem(item.id);
      } else {
        cart.updateQuantity(item.id, newQuantity);
      }
      renderCart();
      dispatchCartUpdateEvent();
    });
  }

  // Increase quantity button
  const increaseBtn = element.querySelector('[data-increase-quantity]');
  if (increaseBtn) {
    increaseBtn.addEventListener('click', () => {
      cart.updateQuantity(item.id, item.quantity + 1);
      renderCart();
      dispatchCartUpdateEvent();
    });
  }

  // Remove item button
  const removeBtn = element.querySelector('[data-remove-item]');
  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      cart.removeItem(item.id);
      renderCart();
      dispatchCartUpdateEvent();
    });
  }
}

/**
 * Update cart totals display
 * @param {Object} totals
 */
function updateCartTotals(totals) {
  // Item count
  const itemCountElement = document.querySelector('[data-cart-item-count]');
  if (itemCountElement) {
    itemCountElement.textContent = totals.itemCount;
  }

  // Subtotal
  const subtotalElement = document.querySelector('[data-cart-subtotal]');
  if (subtotalElement) {
    subtotalElement.textContent = totals.subtotal.toFixed(2);
  }

  // Shipping
  const shippingElement = document.querySelector('[data-cart-shipping]');
  if (shippingElement) {
    shippingElement.textContent = VERZENDKOSTEN.toFixed(2);
  }

  // Total
  const totalElement = document.querySelector('[data-cart-total]');
  if (totalElement) {
    totalElement.textContent = totals.total.toFixed(2);
  }
}

/**
 * Dispatch custom event when cart is updated
 */
function dispatchCartUpdateEvent() {
  window.dispatchEvent(new CustomEvent('cartUpdated'));
}

/**
 * Open cart popup (Webflow modal)
 */
export function openCartPopup() {
  // Render latest cart state
  renderCart();

  // Trigger Webflow popup
  const trigger = document.querySelector('[data-cart-trigger]');
  if (trigger) {
    trigger.click();
  } else {
    // Fallback: try to find and open the modal directly
    const modal = document.querySelector('.modal2_component');
    if (modal) {
      modal.style.display = 'flex';
    } else {
      console.warn('Cart popup trigger not found. Add data-cart-trigger attribute to cart icon in nav.');
    }
  }
}

// Auto-initialize if cart elements are present
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('[data-cart-items-container]')) {
      initCartManager();
    }
  });
} else {
  if (document.querySelector('[data-cart-items-container]')) {
    initCartManager();
  }
}
