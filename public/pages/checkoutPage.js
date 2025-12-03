import { apiClient } from '../utils/api/client.js';
import { authClient } from '../utils/auth/authClient.js';
import { cart } from '../utils/cart.js';
import { showError, hideError, showLoader, hideLoader } from '../forms/ui/formUi.js';
import { initCheckoutAuthModal, openCheckoutAuthModal } from '../utils/auth/checkoutAuthModal.js';

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
    this.checkoutButton = null;
    this.stripeElements = null;
    this.paymentElement = null;
    this.stripe = null;
    this.clientSecret = null;
    this.isProcessing = false;
    this.paymentReady = false;
    
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
    
    // Display order summary immediately (cart is visible before login)
    this.displayOrderSummary();
    
    // Hide auth-required content initially
    this.hideAuthRequiredContent();
    
    // Initialize auth modal
    initCheckoutAuthModal();
    
    // Check auth state
    if (authClient.isAuthenticated()) {
      console.log('[CheckoutPage] User authenticated, proceeding to checkout');
      await this.initCheckout();
    } else {
      console.log('[CheckoutPage] User not authenticated, auth modal will handle login');
      // checkoutAuthModal.js will show the modal automatically if needed
    }
    
    // Setup event listeners
    this.setupEventListeners();
  }

  isCheckoutPage() {
    return window.location.pathname === '/shop/checkout';
  }

  initDOMReferences() {
    // Button should be placed OUTSIDE [data-auth-required] in Webflow
    this.checkoutButton = document.querySelector('[data-form-button="checkout-payment"]');
    if (this.checkoutButton) {
      this.checkoutButton.disabled = true;
      this.checkoutButton.classList.add('is-disabled');
      console.log('[CheckoutPage] Button found and disabled initially');
      
      // Add click listener immediately
      this.checkoutButton.addEventListener('click', async (e) => {
        e.preventDefault();
        console.log('[CheckoutPage] Payment button clicked');
        await this.handlePayment();
      });
      console.log('[CheckoutPage] Payment button click listener added');
    } else {
      console.warn('[CheckoutPage] Button not found with [data-form-button="checkout-payment"] - check HTML');
    }
    
    this.alternateAddressWrapper = document.querySelector('[data-address-form-wrapper]');
  }

  setupEventListeners() {
    // Alternate address toggle - matches HTML attribute data-toggle-address-form
    const alternateCheckbox = document.querySelector('[data-toggle-address-form]');
    alternateCheckbox?.addEventListener('change', (e) => {
      console.log('[CheckoutPage] Alternate address toggle:', e.target.checked);
      this.toggleAlternateAddress(e.target.checked);
    });

    // Payment button listener is added in initDOMReferences() after button is found

    // Switch account button - logout and reopen modal
    const switchAccountButton = document.querySelector('[data-action="checkout-switch-account"]');
    switchAccountButton?.addEventListener('click', async (e) => {
      e.preventDefault();
      console.log('[CheckoutPage] Switch account clicked - logging out');
      
      // Logout WITHOUT redirect (reason !== 'manual')
      await authClient.logout('switch-account');
      
      // Hide auth-required content
      this.hideAuthRequiredContent();
      
      // Open login modal using exported function
      openCheckoutAuthModal();
    });

    // Listen for auth success from modal
    document.addEventListener('auth:success', async () => {
      console.log('[CheckoutPage] Auth success event received');
      // Modal is auto-closed by checkoutAuthModal.js
      await this.initCheckout();
    });
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

  hideAuthRequiredContent() {
    const authRequiredElements = document.querySelectorAll('[data-auth-required]');
    authRequiredElements.forEach(el => {
      el.style.display = 'none';
    });
    console.log('[CheckoutPage] 🔒 Auth-required content hidden:', authRequiredElements.length);
  }

  showAuthRequiredContent() {
    const authRequiredElements = document.querySelectorAll('[data-auth-required]');
    authRequiredElements.forEach(el => {
      el.style.display = 'block';
    });
    console.log('[CheckoutPage] ✅ Auth-required content shown:', authRequiredElements.length);
  }

  async loadUserProfile() {
    try {
      if (!authClient.isAuthenticated()) return;

      // Show spinner, hide address block
      const adresBlock = document.querySelector('[data-adres]');
      const adresSpinner = document.querySelector('[data-adres-loading-spinner]');
      
      if (adresBlock) adresBlock.style.display = 'none';
      if (adresSpinner) adresSpinner.style.display = 'flex';

      // Get auth token for protected route
      const authState = authClient.getAuthState();
      if (!authState?.access_token) {
        console.warn('[CheckoutPage] No access token available');
        if (adresSpinner) adresSpinner.style.display = 'none';
        return;
      }

      const response = await apiClient('/routes/profile', {
        headers: {
          Authorization: `Bearer ${authState.access_token}`
        }
      });
      
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
          streetDisplay.textContent = `${response.adres.straat} ${response.adres.huisnummer}${toevoeging}`;
        }
        if (postalDisplay) {
          postalDisplay.textContent = response.adres.postcode;
        }
        if (cityDisplay) {
          cityDisplay.textContent = response.adres.plaats;
        }
        
        // Hide spinner, show address block
        if (adresSpinner) adresSpinner.style.display = 'none';
        if (adresBlock) adresBlock.style.display = 'block';
      } else {
        // No address found - hide spinner
        if (adresSpinner) adresSpinner.style.display = 'none';
      }
      
    } catch (error) {
      console.error('[CheckoutPage] Error loading user profile:', error);
      
      // Hide spinner on error
      const adresSpinner = document.querySelector('[data-adres-loading-spinner]');
      if (adresSpinner) adresSpinner.style.display = 'none';
    }
  }

  toggleAlternateAddress(useAlternate) {
    this.useAlternateAddress = useAlternate;
    
    if (this.alternateAddressWrapper) {
      this.alternateAddressWrapper.style.display = useAlternate ? 'block' : 'none';
    }
  }

  getFieldValue(fieldName) {
    const field = document.querySelector(`[data-field-name="${fieldName}"]`);
    return field ? field.value?.trim() || '' : '';
  }

  displayOrderSummary() {
    const cartItems = cart.getItems();
    const totals = cart.getTotals();
    
    console.log('[CheckoutPage] Displaying order summary:', { itemCount: cartItems.length, totals });
    
    // Display cart items using template clone
    const itemsContainer = document.querySelector('[data-cart-items-container]');
    const template = document.querySelector('[data-checkout-item]');
    
    if (itemsContainer && template) {
      // Clear existing items (except template)
      const existingItems = itemsContainer.querySelectorAll('[data-checkout-item]:not(.cart_product-item-template)');
      existingItems.forEach(item => item.remove());
      
      // Clone and populate template for each cart item
      cartItems.forEach(item => {
        const itemEl = template.cloneNode(true);
        itemEl.classList.remove('cart_product-item-template');
        itemEl.style.display = '';
        itemEl.setAttribute('data-product-id', item.id);
        
        const image = itemEl.querySelector('[data-checkout-item-image]');
        const name = itemEl.querySelector('[data-checkout-item-name]');
        const subtotal = itemEl.querySelector('[data-checkout-item-subtotal]');
        const quantity = itemEl.querySelector('[data-checkout-item-quantity]');
        
        if (image) image.src = item.image;
        if (name) name.textContent = item.name;
        if (subtotal) subtotal.textContent = (item.price * item.quantity).toFixed(2);
        if (quantity) quantity.textContent = item.quantity;
        
        itemsContainer.appendChild(itemEl);
      });
      
      console.log('[CheckoutPage] ✅ Cart items rendered:', cartItems.length);
    }
    
    // Display totals (HTML already has € symbols)
    const itemCountEl = document.querySelector('[data-cart-item-count]');
    const subtotalEl = document.querySelector('[data-checkout-subtotal]');
    const shippingEl = document.querySelector('[data-checkout-shipping]');
    const totalEl = document.querySelector('[data-checkout-total]');
    
    if (itemCountEl) itemCountEl.textContent = cartItems.length;
    if (subtotalEl) subtotalEl.textContent = totals.subtotal.toFixed(2);
    if (shippingEl) shippingEl.textContent = totals.shipping.toFixed(2);
    if (totalEl) totalEl.textContent = totals.total.toFixed(2);
  }

  async initStripeElements() {
    try {
      console.log('[CheckoutPage] Initializing Stripe Elements...');
      
      // Show spinner
      const spinner = document.querySelector('[data-stripe-loading-spinner]');
      if (spinner) spinner.style.display = 'flex';
      
      // Fetch Stripe public key - gebruik bestaande endpoint zoals abbBetalingForm
      const config = await apiClient('/routes/stripe/public-config');
      
      if (!config.publishableKey) {
        throw new Error('Stripe publishable key not configured');
      }
      
      // Initialize Stripe
      this.stripe = window.Stripe(config.publishableKey);
      
      // Create Payment Intent
      const totals = cart.getTotals();
      const cartItems = cart.getItems();
      const authState = authClient.getAuthState();
      
      // Get delivery address for metadata
      const deliveryAddress = await this.getDeliveryAddress();
      
      const intentResponse = await apiClient('/routes/stripe/create-payment-intent', {
        method: 'POST',
        body: JSON.stringify({
          amount: Math.round(totals.total * 100), // Amount in cents
          description: `Webshop bestelling (${cartItems.length} product${cartItems.length > 1 ? 'en' : ''})`,
          savePaymentMethod: true,
          flowContext: {
            flow: 'webshop'
          },
          metadata: {
            flow: 'webshop',
            email: authState.user?.email || '',
            
            // Cart items as JSON string
            items: JSON.stringify(cartItems.map(item => ({
              id: item.id,
              name: item.name,
              price: item.price,
              quantity: item.quantity
            }))),
            
            // Totals in cents
            subtotal_cents: Math.round(totals.subtotal * 100).toString(),
            shipping_cents: Math.round(totals.shipping * 100).toString(),
            btw_cents: Math.round((totals.total * 0.21 / 1.21) * 100).toString(),
            total_cents: Math.round(totals.total * 100).toString(),
            
            // Delivery address
            bezorg_naam: deliveryAddress.name,
            bezorg_straat: deliveryAddress.straatnaam,
            bezorg_huisnummer: deliveryAddress.huisnummer,
            bezorg_toevoeging: deliveryAddress.toevoeging || '',
            bezorg_postcode: deliveryAddress.postcode,
            bezorg_plaats: deliveryAddress.plaats
          }
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
        
        // Wait for Payment Element to be ready, then hide spinner
        this.paymentElement.on('ready', () => {
          console.log('[CheckoutPage] Stripe Payment Element ready');
          if (spinner) spinner.style.display = 'none';
          this.paymentReady = true;
        });
        
        // Listen for changes to enable/disable button based on completion
        this.paymentElement.on('change', (event) => {
          console.log('[CheckoutPage] Payment Element change:', event.complete);
          
          if (this.checkoutButton && this.paymentReady) {
            if (event.complete) {
              // Payment details are complete and valid
              this.checkoutButton.disabled = false;
              this.checkoutButton.classList.remove('is-disabled');
              console.log('[CheckoutPage] ✅ Payment button enabled - form complete');
            } else {
              // Payment details are incomplete
              this.checkoutButton.disabled = true;
              this.checkoutButton.classList.add('is-disabled');
              console.log('[CheckoutPage] ⏸️ Payment button disabled - form incomplete');
            }
          }
        });
        
        // Handle load errors
        this.paymentElement.on('loaderror', (e) => {
          console.error('[CheckoutPage] Payment Element loaderror:', e);
          if (spinner) spinner.style.display = 'none';
        });
      }
      
      console.log('[CheckoutPage] Stripe Elements initialized');
      
    } catch (error) {
      console.error('[CheckoutPage] Error initializing Stripe:', error);
      
      // Hide spinner on error
      const spinner = document.querySelector('[data-stripe-loading-spinner]');
      if (spinner) spinner.style.display = 'none';
      
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
    
    if (!this.paymentReady || !this.stripe || !this.stripeElements) {
      console.warn('[CheckoutPage] Payment blocked: element not ready', {
        paymentReady: this.paymentReady,
        stripe: !!this.stripe,
        elements: !!this.stripeElements
      });
      return;
    }

    console.log('[CheckoutPage] Handling payment...');
    
    const errorContainer = document.querySelector('[data-checkout-error]');
    if (errorContainer) hideError(errorContainer);
    
    this.isProcessing = true;
    
    try {
      showLoader(this.checkoutButton);
      
      // Get delivery address
      console.log('[CheckoutPage] Getting delivery address...');
      const deliveryAddress = await this.getDeliveryAddress();
      console.log('[CheckoutPage] Delivery address:', deliveryAddress);
      
      const authState = authClient.getAuthState();
      console.log('[CheckoutPage] User email:', authState.user?.email);
      
      // Confirm payment with Stripe
      console.log('[CheckoutPage] Confirming payment with Stripe...');
      const result = await this.stripe.confirmPayment({
        elements: this.stripeElements,
        confirmParams: {
          return_url: `${window.location.origin}/shop/bestelling-succes`,
          payment_method_data: {
            billing_details: {
              name: deliveryAddress.name,
              email: authState.user?.email,
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
      
      console.log('[CheckoutPage] Stripe confirmPayment result:', result);
      
      if (result.error) {
        console.error('[CheckoutPage] Payment error:', result.error);
        const errorContainer = document.querySelector('[data-checkout-error]');
        if (errorContainer) {
          showError(errorContainer, this.mapStripeError(result.error));
        }
        hideLoader(this.checkoutButton);
        this.isProcessing = false;
        return;
      }
      
      // If payment succeeded without redirect (e.g., credit card)
      if (result.paymentIntent && result.paymentIntent.status === 'succeeded') {
        console.log('[CheckoutPage] Payment succeeded without redirect');
        
        // Clear cart (webhook will create order in background)
        cart.clear();
        
        // Redirect to success page with payment intent ID
        window.location.href = `/shop/bestelling-succes?payment_intent=${result.paymentIntent.id}`;
      } else {
        console.log('[CheckoutPage] Payment requires redirect or further action');
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
      const authState = authClient.getAuthState();
      const profile = await apiClient('/routes/profile', {
        headers: {
          Authorization: `Bearer ${authState.access_token}`
        }
      });
      return {
        name: `${profile.voornaam} ${profile.achternaam}`,
        straatnaam: profile.adres.straat,
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
      
      // Get auth token
      const authState = authClient.getAuthState();
      
      // Create order in backend
      const order = await apiClient('/routes/orders/create', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authState.access_token}`
        },
        body: JSON.stringify({
          paymentIntentId,
          items: cartItems,
          totals,
          deliveryAddress
        })
      });
      
      console.log('[CheckoutPage] Order created:', order.order.id);
      
      // Clear cart
      cart.clear();
      
      // Redirect to success page
      window.location.href = `/shop/bestelling-succes?order=${order.order.bestelNummer}`;
      
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
