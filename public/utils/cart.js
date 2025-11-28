/**
 * Shopping Cart Utility
 * Manages cart in localStorage
 */

const CART_KEY = 'heppy_cart';
export const VERZENDKOSTEN = 5.95; // €5,95 vaste verzendkosten

export const cart = {
  /**
   * Get all cart items
   * @returns {Array} Cart items
   */
  getItems() {
    try {
      const cartData = localStorage.getItem(CART_KEY);
      return cartData ? JSON.parse(cartData) : [];
    } catch (error) {
      console.error('Error reading cart:', error);
      return [];
    }
  },

  /**
   * Add item to cart
   * @param {Object} product - Product to add
   * @param {string} product.id - Stripe product ID
   * @param {string} product.name - Product name
   * @param {number} product.price - Product price
   * @param {string} product.slug - Product slug
   * @param {number} quantity - Quantity to add (default: 1)
   * @returns {Object} Updated cart item
   */
  addItem(product, quantity = 1) {
    const items = this.getItems();
    const existingIndex = items.findIndex(item => item.id === product.id);

    if (existingIndex > -1) {
      // Product exists, increase quantity
      items[existingIndex].quantity += quantity;
    } else {
      // New product
      items.push({
        id: product.id,
        name: product.name,
        price: parseFloat(product.price),
        slug: product.slug,
        quantity: quantity,
        addedAt: new Date().toISOString()
      });
    }

    this.saveCart(items);
    this.updateCartCounter();
    return items.find(item => item.id === product.id);
  },

  /**
   * Update item quantity
   * @param {string} productId - Stripe product ID
   * @param {number} quantity - New quantity
   * @returns {Array} Updated cart items
   */
  updateQuantity(productId, quantity) {
    const items = this.getItems();
    const index = items.findIndex(item => item.id === productId);

    if (index > -1) {
      if (quantity <= 0) {
        // Remove item if quantity is 0 or less
        items.splice(index, 1);
      } else {
        items[index].quantity = quantity;
      }
    }

    this.saveCart(items);
    this.updateCartCounter();
    return items;
  },

  /**
   * Remove item from cart
   * @param {string} productId - Stripe product ID
   * @returns {Array} Updated cart items
   */
  removeItem(productId) {
    const items = this.getItems().filter(item => item.id !== productId);
    this.saveCart(items);
    this.updateCartCounter();
    return items;
  },

  /**
   * Clear entire cart
   */
  clear() {
    localStorage.removeItem(CART_KEY);
    this.updateCartCounter();
  },

  /**
   * Get cart totals
   * @returns {Object} Totals
   */
  getTotals() {
    const items = this.getItems();
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

    return {
      subtotal: subtotal,
      shipping: VERZENDKOSTEN,
      total: subtotal + VERZENDKOSTEN,
      itemCount: itemCount,
      items: items
    };
  },

  /**
   * Save cart to localStorage
   * @private
   */
  saveCart(items) {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(items));
    } catch (error) {
      console.error('Error saving cart:', error);
    }
  },

  /**
   * Update cart counter badge in navigation
   */
  updateCartCounter() {
    const totals = this.getTotals();
    const counterElements = document.querySelectorAll('[data-cart-count]');
    const counterWrappers = document.querySelectorAll('[data-cart-count-wrapper]');
    
    // Update count text
    counterElements.forEach(el => {
      el.textContent = totals.itemCount;
    });
    
    // Show/hide wrapper based on cart count
    counterWrappers.forEach(wrapper => {
      if (totals.itemCount === 0) {
        wrapper.style.display = 'none';
      } else {
        wrapper.style.display = 'flex'; // Of 'block' afhankelijk van jouw CSS
      }
    });
  }
};
