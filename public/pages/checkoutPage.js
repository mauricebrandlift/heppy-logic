import { apiClient } from '../utils/api/client.js';
import { authClient } from '../utils/auth/authClient.js';
import { cart } from '../utils/cart.js';
import { showLoader, hideLoader, showError, hideError } from '../forms/ui/formUi.js';
import { initCheckoutLoginForm } from '../forms/checkout/checkoutLoginForm.js';
import { initCheckoutRegisterForm } from '../forms/checkout/checkoutRegisterForm.js';

/**
 * Checkout Page Handler
 * 
 * Manages the checkout flow:
 * 1. Auth gate - requires login/register before checkout
 * 2. Address pre-fill from user_profiles
 * 3. Stripe Elements payment integration
 * 4. Order creation and confirmation
 */

class CheckoutPage {
  constructor() {
    this.modal = null;
    this.loginState = null;
    this.registerState = null;
    this.loginFormButton = null;
    this.registerFormButton = null;
    this.checkoutButton = null;
    this.stripeElements = null;
    this.paymentElement = null;
    this.stripe = null;
    this.clientSecret = null;
    this.isProcessing = false;
    
    // Address form state
    this.useAlternateAddress = false;
    this.alternateAddressWrapper = null;
  }

  async init() {
    console.log('[CheckoutPage] Initializing...');
    
    // Check if we're on the checkout page
    if (!this.isCheckoutPage()) {
      console.log('[CheckoutPage] Not on checkout page, skipping init');
      return;
    }

    // Initialize DOM references
    this.initDOMReferences();
    
    // Initialize auth forms
    this.initAuthForms();
    
    // Check auth state
    if (authClient.isAuthenticated()) {
      console.log('[CheckoutPage] User authenticated, proceeding to checkout');
      await this.initCheckout();
    } else {
      console.log('[CheckoutPage] User not authenticated, showing auth modal');
      this.showAuthModal();
    }
    
    // Setup event listeners
    this.setupEventListeners();
  }

  isCheckoutPage() {
    return window.location.pathname === '/shop/checkout';
  }

  initDOMReferences() {
    // Modal
    this.modal = document.querySelector('[data-checkout-auth-modal]');
    this.loginState = document.querySelector('[data-auth-login-state]');
    this.registerState = document.querySelector('[data-auth-register-state]');
    
    // Auth form buttons - using data-form-button pattern from HTML
    this.loginFormButton = document.querySelector('[data-form-button="checkout-login"]');
    this.registerFormButton = document.querySelector('[data-form-button="checkout-register"]');
    
    // Toggle buttons between login and register
    this.showRegisterBtn = document.querySelector('[data-switch-to-register]');
    this.showLoginBtn = document.querySelector('[data-switch-to-login]');
    
    // Checkout button
    this.checkoutButton = document.querySelector('[data-form-button="checkout-betaling"]');
    
    // Address wrapper
    this.alternateAddressWrapper = document.querySelector('[data-address-form-wrapper]');
    
    // Debug logging
    console.log('[CheckoutPage] DOM References:', {
      modal: !!this.modal,
      loginState: !!this.loginState,
      registerState: !!this.registerState,
      loginFormButton: !!this.loginFormButton,
      registerFormButton: !!this.registerFormButton,
      checkoutButton: !!this.checkoutButton
    });
    
    if (!this.modal) {
      console.error('[CheckoutPage] Auth modal not found');
    }
    if (!this.loginFormButton) {
      console.error('[CheckoutPage] Login button not found');
    }
    if (!this.registerFormButton) {
      console.error('[CheckoutPage] Register button not found');
    }
  }

  initAuthForms() {
    console.log('[CheckoutPage] Initializing auth forms...');
    
    // Check if forms exist in DOM
    const loginForm = document.querySelector('[data-form-name="checkout-login"]');
    const registerForm = document.querySelector('[data-form-name="checkout-register"]');
    
    if (loginForm) {
      initCheckoutLoginForm();
      console.log('[CheckoutPage] ✅ Login form initialized');
    } else {
      console.warn('[CheckoutPage] ⚠️ Login form not found');
    }
    
    if (registerForm) {
      initCheckoutRegisterForm();
      console.log('[CheckoutPage] ✅ Register form initialized');
    } else {
      console.warn('[CheckoutPage] ⚠️ Register form not found');
    }
  }

  setupEventListeners() {
    console.log('[CheckoutPage] Setting up event listeners...');
    
    // Backdrop click prevention - prevent modal close on backdrop click
    const backdrop = document.querySelector('[data-modal-backdrop]');
    const backgroundOverlay = this.modal?.querySelector('.contact-modal1_background-overlay');
    
    if (backdrop) {
      backdrop.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
      }, true);
      console.log('[CheckoutPage] ✅ Backdrop click prevented');
    }
    
    if (backgroundOverlay) {
      backgroundOverlay.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
      }, true);
      console.log('[CheckoutPage] ✅ Background overlay click prevented');
    }

    // Close buttons (X)
    const closeButtons = this.modal?.querySelectorAll('[data-modal-close]');
    closeButtons?.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleModalClose();
      });
    });
    console.log('[CheckoutPage] ✅ Close buttons:', closeButtons?.length || 0);

    // Toggle between login and register
    if (this.showRegisterBtn) {
      this.showRegisterBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('[CheckoutPage] Show register clicked');
        this.showRegisterState();
      });
      console.log('[CheckoutPage] ✅ Show register button listener added');
    } else {
      console.error('[CheckoutPage] ❌ Show register button not found');
    }
    
    if (this.showLoginBtn) {
      this.showLoginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('[CheckoutPage] Show login clicked');
        this.showLoginState();
      });
      console.log('[CheckoutPage] ✅ Show login button listener added');
    } else {
      console.error('[CheckoutPage] ❌ Show login button not found');
    }

    // Address lookup trigger (postcode + huisnummer) - now handled by checkoutRegisterForm

    // Alternate address toggle
    const alternateCheckbox = document.querySelector('[data-field-name="use-alternate-address"]');
    alternateCheckbox?.addEventListener('change', (e) => {
      this.toggleAlternateAddress(e.target.checked);
    });

    // Checkout/payment button
    this.checkoutButton?.addEventListener('click', async (e) => {
      e.preventDefault();
      await this.handlePayment();
    });

    // Listen for auth success from modal
    document.addEventListener('auth:success', async () => {
      console.log('[CheckoutPage] Auth success event received');
      this.hideAuthModal();
      await this.initCheckout();
    });
  }

  showAuthModal() {
    if (!this.modal) return;
    
    this.modal.style.display = 'flex';
    this.showLoginState();
  }

  hideAuthModal() {
    if (!this.modal) return;
    
    this.modal.style.display = 'none';
    this.clearAuthErrors();
  }

  handleModalClose() {
    // Only allow close if not processing payment
    if (this.isProcessing) {
      console.log('[CheckoutPage] Cannot close modal during processing');
      return;
    }

    // Check if user is authenticated - if not, they can't proceed
    if (!authClient.isAuthenticated()) {
      console.log('[CheckoutPage] User must login to checkout');
      this.showModalError('general', 'Je moet inloggen om een bestelling te plaatsen');
      return;
    }

    this.hideAuthModal();
  }

  showLoginState() {
    if (this.loginState) this.loginState.style.display = 'block';
    if (this.registerState) this.registerState.style.display = 'none';
    // Clear all modal errors
    const errorContainers = this.modal?.querySelectorAll('[data-modal-error]');
    errorContainers?.forEach(container => hideError(container));
  }

  showRegisterState() {
    if (this.loginState) this.loginState.style.display = 'none';
    if (this.registerState) this.registerState.style.display = 'block';
    // Clear all modal errors
    const errorContainers = this.modal?.querySelectorAll('[data-modal-error]');
    errorContainers?.forEach(container => hideError(container));
  }

  showModalError(field, message) {
    const errorContainer = this.modal?.querySelector(`[data-modal-error="${field}"]`);
    if (errorContainer) {
      showError(errorContainer, message);
    }
  }

  getFieldValue(fieldName) {
    const field = document.querySelector(`[data-field-name="${fieldName}"]`);
    if (!field) return '';
    
    if (field.type === 'checkbox') {
      return field.checked;
    }
    return field.value?.trim() || '';
  }

  setFieldValue(fieldName, value) {
    const field = document.querySelector(`[data-field-name="${fieldName}"]`);
    if (field) {
      field.value = value;
    }
  }

  async initCheckout() {
    console.log('[CheckoutPage] Initializing checkout...');
    
    // Show auth-required content
    this.showAuthRequiredContent();
    
    // Load user profile and pre-fill delivery address
    await this.loadUserProfile();
    
    // Initialize Stripe Elements
    await this.initStripeElements();
    
    // Display order summary
    this.displayOrderSummary();
  }

  showAuthRequiredContent() {
    const authRequiredElements = document.querySelectorAll('[data-auth-required]');
    authRequiredElements.forEach(el => {
      el.style.display = '';
    });
    console.log('[CheckoutPage] ✅ Auth-required content shown:', authRequiredElements.length);
  }

  async loadUserProfile() {
    try {
      if (!authClient.isAuthenticated()) return;

      const response = await apiClient('/profile');
      
      if (response.adres) {
        // Pre-fill delivery address display
        const nameDisplay = document.querySelector('[data-delivery-name]');
        const streetDisplay = document.querySelector('[data-delivery-street]');
        const postalDisplay = document.querySelector('[data-delivery-postal]');
        const cityDisplay = document.querySelector('[data-delivery-city]');
        
        if (nameDisplay) {
          nameDisplay.textContent = `${response.voornaam} ${response.achternaam}`;
        }
        if (streetDisplay) {
          const toevoeging = response.adres.toevoeging ? ` ${response.adres.toevoeging}` : '';
          streetDisplay.textContent = `${response.adres.straatnaam} ${response.adres.huisnummer}${toevoeging}`;
        }
        if (postalDisplay) {
          postalDisplay.textContent = response.adres.postcode;
        }
        if (cityDisplay) {
          cityDisplay.textContent = response.adres.plaats;
        }
      }
      
    } catch (error) {
      console.error('[CheckoutPage] Error loading user profile:', error);
    }
  }

  toggleAlternateAddress(useAlternate) {
    this.useAlternateAddress = useAlternate;
    
    if (this.alternateAddressWrapper) {
      this.alternateAddressWrapper.style.display = useAlternate ? 'block' : 'none';
    }
  }

  displayOrderSummary() {
    const cartItems = cart.getItems();
    const totals = cart.getTotals();
    
    // Display cart items
    const itemsList = document.querySelector('[data-checkout-items]');
    if (itemsList) {
      itemsList.innerHTML = '';
      
      cartItems.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'checkout-item';
        itemEl.innerHTML = `
          <div class="checkout-item_image">
            <img src="${item.image}" alt="${item.name}" />
          </div>
          <div class="checkout-item_details">
            <div class="checkout-item_name">${item.name}</div>
            <div class="checkout-item_quantity">Aantal: ${item.quantity}</div>
          </div>
          <div class="checkout-item_price">€${(item.price * item.quantity).toFixed(2)}</div>
        `;
        itemsList.appendChild(itemEl);
      });
    }
    
    // Display totals
    const subtotalEl = document.querySelector('[data-checkout-subtotal]');
    const shippingEl = document.querySelector('[data-checkout-shipping]');
    const totalEl = document.querySelector('[data-checkout-total]');
    
    if (subtotalEl) subtotalEl.textContent = `€${totals.subtotal.toFixed(2)}`;
    if (shippingEl) shippingEl.textContent = `€${totals.shipping.toFixed(2)}`;
    if (totalEl) totalEl.textContent = `€${totals.total.toFixed(2)}`;
  }

  async initStripeElements() {
    try {
      console.log('[CheckoutPage] Initializing Stripe Elements...');
      
      // Fetch Stripe public key
      const config = await apiClient('/config/public');
      
      if (!config.stripePublicKey) {
        throw new Error('Stripe public key not configured');
      }
      
      // Initialize Stripe
      this.stripe = window.Stripe(config.stripePublicKey);
      
      // Create Payment Intent
      const totals = cart.getTotals();
      const intentResponse = await apiClient('/stripe/create-payment-intent', {
        method: 'POST',
        body: JSON.stringify({
          amount: Math.round(totals.total * 100), // Amount in cents
          description: 'Webshop bestelling',
          savePaymentMethod: true
        })
      });
      
      this.clientSecret = intentResponse.clientSecret;
      
      // Initialize Stripe Elements
      this.stripeElements = this.stripe.elements({
        clientSecret: this.clientSecret,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#0066cc'
          }
        }
      });
      
      // Create and mount Payment Element
      this.paymentElement = this.stripeElements.create('payment');
      
      const paymentElementContainer = document.querySelector('[data-stripe-payment-element]');
      if (paymentElementContainer) {
        this.paymentElement.mount(paymentElementContainer);
      }
      
      console.log('[CheckoutPage] Stripe Elements initialized');
      
    } catch (error) {
      console.error('[CheckoutPage] Error initializing Stripe:', error);
      const errorContainer = document.querySelector('[data-checkout-error]');
      if (errorContainer) {
        showError(errorContainer, 'Er is een probleem met het laden van de betaalmethodes. Probeer het later opnieuw.');
      }
    }
  }

  async handlePayment() {
    if (this.isProcessing) {
      console.log('[CheckoutPage] Payment already processing');
      return;
    }

    console.log('[CheckoutPage] Handling payment...');
    
    const errorContainer = document.querySelector('[data-checkout-error]');
    if (errorContainer) hideError(errorContainer);
    
    this.isProcessing = true;
    
    try {
      showLoader(this.checkoutButton);
      
      // Get delivery address
      const deliveryAddress = await this.getDeliveryAddress();
      
      // Confirm payment with Stripe
      const { error, paymentIntent } = await this.stripe.confirmPayment({
        elements: this.stripeElements,
        confirmParams: {
          return_url: `${window.location.origin}/shop/checkout/success`,
          payment_method_data: {
            billing_details: {
              name: deliveryAddress.name,
              email: authClient.getAuthState().user?.email,
              address: {
                line1: `${deliveryAddress.straatnaam} ${deliveryAddress.huisnummer}`,
                postal_code: deliveryAddress.postcode,
                city: deliveryAddress.plaats,
                country: 'NL'
              }
            }
          }
        },
        redirect: 'if_required'
      });
      
      if (error) {
        console.error('[CheckoutPage] Payment error:', error);
        const errorContainer = document.querySelector('[data-checkout-error]');
        if (errorContainer) {
          showError(errorContainer, this.mapStripeError(error));
        }
        this.isProcessing = false;
        return;
      }
      
      // If payment succeeded without redirect
      if (paymentIntent && paymentIntent.status === 'succeeded') {
        await this.handlePaymentSuccess(paymentIntent.id);
      }
      
      // If redirect happened, success page will handle it
      
    } catch (error) {
      console.error('[CheckoutPage] Payment error:', error);
      const errorContainer = document.querySelector('[data-checkout-error]');
      if (errorContainer) {
        showError(errorContainer, 'Er is iets misgegaan bij het verwerken van je betaling. Probeer het opnieuw.');
      }
      this.isProcessing = false;
    } finally {
      hideLoader(this.checkoutButton);
    }
  }

  async getDeliveryAddress() {
    if (this.useAlternateAddress) {
      // Get alternate address from form
      return {
        name: `${this.getFieldValue('alternate-voornaam')} ${this.getFieldValue('alternate-achternaam')}`,
        straatnaam: this.getFieldValue('alternate-straatnaam'),
        huisnummer: this.getFieldValue('alternate-huisnummer'),
        toevoeging: this.getFieldValue('alternate-toevoeging'),
        postcode: this.getFieldValue('alternate-postcode'),
        plaats: this.getFieldValue('alternate-plaats')
      };
    } else {
      // Get primary address from user profile
      const profile = await apiClient('/profile');
      return {
        name: `${profile.voornaam} ${profile.achternaam}`,
        straatnaam: profile.adres.straatnaam,
        huisnummer: profile.adres.huisnummer,
        toevoeging: profile.adres.toevoeging,
        postcode: profile.adres.postcode,
        plaats: profile.adres.plaats
      };
    }
  }

  async handlePaymentSuccess(paymentIntentId) {
    try {
      console.log('[CheckoutPage] Payment successful, creating order...');
      
      const cartItems = cart.getItems();
      const totals = cart.getTotals();
      const deliveryAddress = await this.getDeliveryAddress();
      
      // Create order in backend
      const order = await apiClient('/orders/create', {
        method: 'POST',
        body: JSON.stringify({
          paymentIntentId,
          items: cartItems,
          totals,
          deliveryAddress
        })
      });
      
      console.log('[CheckoutPage] Order created:', order.id);
      
      // Clear cart
      cart.clear();
      
      // Redirect to success page
      window.location.href = `/shop/checkout/success?order=${order.id}`;
      
    } catch (error) {
      console.error('[CheckoutPage] Error creating order:', error);
      const errorContainer = document.querySelector('[data-checkout-error]');
      if (errorContainer) {
        showError(errorContainer, 'Betaling geslaagd, maar er ging iets mis bij het aanmaken van je bestelling. Neem contact op met klantenservice.');
      }
    }
  }

  mapStripeError(error) {
    const errorMessages = {
      'card_declined': 'Je betaling is geweigerd. Probeer een andere betaalmethode.',
      'insufficient_funds': 'Onvoldoende saldo. Probeer een andere betaalmethode.',
      'incorrect_cvc': 'Onjuiste CVC-code. Controleer je gegevens.',
      'expired_card': 'Je kaart is verlopen. Gebruik een andere kaart.',
      'processing_error': 'Er ging iets mis bij het verwerken. Probeer het opnieuw.',
      'incorrect_number': 'Onjuist kaartnummer. Controleer je gegevens.'
    };
    
    return errorMessages[error.code] || error.message || 'Er is iets misgegaan bij de betaling';
  }
}

// Initialize on page load
const checkoutPage = new CheckoutPage();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => checkoutPage.init());
} else {
  checkoutPage.init();
}

export default checkoutPage;
