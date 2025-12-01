import { apiClient } from '../utils/api/client.js';
import { authClient } from '../utils/auth/authClient.js';
import { cart } from '../utils/cart.js';
import { showLoader, hideLoader } from '../forms/ui/formUi.js';

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

    // Login form submit
    if (this.loginFormButton) {
      this.loginFormButton.addEventListener('click', async (e) => {
        e.preventDefault();
        console.log('[CheckoutPage] Login button clicked');
        await this.handleLogin();
      });
      console.log('[CheckoutPage] ✅ Login form button listener added');
    } else {
      console.error('[CheckoutPage] ❌ Login form button not found');
    }

    // Register form submit
    if (this.registerFormButton) {
      this.registerFormButton.addEventListener('click', async (e) => {
        e.preventDefault();
        console.log('[CheckoutPage] Register button clicked');
        await this.handleRegister();
      });
      console.log('[CheckoutPage] ✅ Register form button listener added');
    } else {
      console.error('[CheckoutPage] ❌ Register form button not found');
    }

    // Real-time button state management for login form
    const loginEmailField = document.querySelector('[data-field-name="login-email"]');
    const loginPasswordField = document.querySelector('[data-field-name="login-password"]');
    
    [loginEmailField, loginPasswordField].forEach(field => {
      if (field) {
        field.addEventListener('input', () => this.updateLoginButtonState());
      }
    });

    // Real-time button state management for register form
    const registerFields = [
      'register-voornaam', 'register-achternaam', 'register-email',
      'register-password', 'register-postcode', 'register-huisnummer',
      'register-straatnaam', 'register-plaats'
    ];
    
    registerFields.forEach(fieldName => {
      const field = document.querySelector(`[data-field-name="${fieldName}"]`);
      if (field) {
        field.addEventListener('input', () => this.updateRegisterButtonState());
      }
    });

    // Address lookup trigger (postcode + huisnummer)
    this.initAddressLookupTrigger();

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
    this.clearAuthErrors();
  }

  showRegisterState() {
    if (this.loginState) this.loginState.style.display = 'none';
    if (this.registerState) this.registerState.style.display = 'block';
    this.clearAuthErrors();
  }

  clearAuthErrors() {
    const errorContainers = this.modal?.querySelectorAll('[data-modal-error]');
    errorContainers?.forEach(container => {
      container.textContent = '';
      container.classList.add('hide');
    });
  }

  showModalError(field, message) {
    const errorContainer = this.modal?.querySelector(`[data-modal-error="${field}"]`);
    if (errorContainer) {
      errorContainer.innerHTML = `<div>${message}</div>`;
      errorContainer.classList.remove('hide');
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

  async handleLogin() {
    console.log('[CheckoutPage] Handling login...');
    this.clearAuthErrors();
    
    const email = this.getFieldValue('login-email');
    const password = this.getFieldValue('login-password');
    
    // Client-side validation
    if (!email || !password) {
      this.showModalError('general', 'Vul alle velden in');
      return;
    }

    if (!this.isValidEmail(email)) {
      this.showModalError('login-email', 'Voer een geldig e-mailadres in');
      return;
    }

    try {
      showLoader(this.loginFormButton);
      
      const result = await authClient.login(email, password);
      
      console.log('[CheckoutPage] Login successful');
      
      // Dispatch auth success event
      document.dispatchEvent(new Event('auth:success'));
      
    } catch (error) {
      console.error('[CheckoutPage] Login error:', error);
      
      if (error.message?.includes('Invalid credentials')) {
        this.showModalError('general', 'Onjuist e-mailadres of wachtwoord');
      } else {
        this.showModalError('general', error.message || 'Er is iets misgegaan bij het inloggen');
      }
    } finally {
      hideLoader(this.loginFormButton);
    }
  }

  async handleRegister() {
    console.log('[CheckoutPage] Handling registration...');
    this.clearAuthErrors();
    
    const voornaam = this.getFieldValue('register-voornaam');
    const achternaam = this.getFieldValue('register-achternaam');
    const email = this.getFieldValue('register-email');
    const password = this.getFieldValue('register-password');
    const postcode = this.getFieldValue('register-postcode');
    const huisnummer = this.getFieldValue('register-huisnummer');
    const toevoeging = this.getFieldValue('register-toevoeging');
    const straatnaam = this.getFieldValue('register-straatnaam');
    const plaats = this.getFieldValue('register-plaats');
    
    // Client-side validation
    if (!voornaam) {
      this.showModalError('register-voornaam', 'Voer je voornaam in');
      return;
    }
    if (!achternaam) {
      this.showModalError('register-achternaam', 'Voer je achternaam in');
      return;
    }
    if (!email) {
      this.showModalError('register-email', 'Voer je e-mailadres in');
      return;
    }
    if (!this.isValidEmail(email)) {
      this.showModalError('register-email', 'Voer een geldig e-mailadres in');
      return;
    }
    if (!password || password.length < 6) {
      this.showModalError('register-password', 'Wachtwoord moet minimaal 6 tekens bevatten');
      return;
    }
    if (!postcode || !huisnummer || !straatnaam || !plaats) {
      this.showModalError('general', 'Vul een geldig adres in');
      return;
    }

    try {
      showLoader(this.registerFormButton);
      
      const response = await apiClient('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          voornaam,
          achternaam,
          email,
          password,
          adres: {
            postcode,
            huisnummer,
            toevoeging: toevoeging || null,
            straatnaam,
            plaats
          }
        })
      });
      
      console.log('[CheckoutPage] Registration successful');
      
      // Auto-login after registration
      await authClient.login(email, password);
      
      // Dispatch auth success event
      document.dispatchEvent(new Event('auth:success'));
      
    } catch (error) {
      console.error('[CheckoutPage] Registration error:', error);
      
      if (error.message?.includes('already exists')) {
        this.showModalError('register-email', 'Dit e-mailadres is al in gebruik');
      } else {
        this.showModalError('general', error.message || 'Er is iets misgegaan bij het registreren');
      }
    } finally {
      hideLoader(this.registerFormButton);
    }
  }

  initAddressLookupTrigger() {
    const postcodeField = document.querySelector('[data-field-name="register-postcode"]');
    const huisnummerField = document.querySelector('[data-field-name="register-huisnummer"]');
    
    if (!postcodeField || !huisnummerField) return;

    const lookupAddress = async () => {
      const postcode = this.getFieldValue('register-postcode');
      const huisnummer = this.getFieldValue('register-huisnummer');
      
      if (!postcode || !huisnummer) return;

      try {
        const response = await apiClient(`/address?postcode=${encodeURIComponent(postcode)}&huisnummer=${encodeURIComponent(huisnummer)}`);
        
        if (response.straat && response.plaats) {
          this.setFieldValue('register-straatnaam', response.straat);
          this.setFieldValue('register-plaats', response.plaats);
          this.clearAuthErrors();
        }
      } catch (error) {
        console.error('[CheckoutPage] Address lookup error:', error);
        this.showModalError('general', 'Adres niet gevonden. Controleer postcode en huisnummer.');
      }
    };

    postcodeField.addEventListener('blur', lookupAddress);
    huisnummerField.addEventListener('blur', lookupAddress);
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
      this.showCheckoutError('Er is een probleem met het laden van de betaalmethodes. Probeer het later opnieuw.');
    }
  }

  async handlePayment() {
    if (this.isProcessing) {
      console.log('[CheckoutPage] Payment already processing');
      return;
    }

    console.log('[CheckoutPage] Handling payment...');
    this.clearCheckoutErrors();
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
        this.showCheckoutError(this.mapStripeError(error));
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
      this.showCheckoutError('Er is iets misgegaan bij het verwerken van je betaling. Probeer het opnieuw.');
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
      this.showCheckoutError('Betaling geslaagd, maar er ging iets mis bij het aanmaken van je bestelling. Neem contact op met klantenservice.');
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

  showCheckoutError(message) {
    const errorContainer = document.querySelector('[data-checkout-error]');
    if (errorContainer) {
      errorContainer.innerHTML = `<div>${message}</div>`;
      errorContainer.classList.remove('hide');
    }
  }

  clearCheckoutErrors() {
    const errorContainer = document.querySelector('[data-checkout-error]');
    if (errorContainer) {
      errorContainer.textContent = '';
      errorContainer.classList.add('hide');
    }
  }

  isValidEmail(email) {
    return /^[\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  updateLoginButtonState() {
    if (!this.loginFormButton) return;
    
    const email = this.getFieldValue('login-email');
    const password = this.getFieldValue('login-password');
    
    const isValid = this.isValidEmail(email) && password.length >= 8;
    
    if (isValid) {
      this.loginFormButton.disabled = false;
      this.loginFormButton.classList.remove('is-disabled');
    } else {
      this.loginFormButton.disabled = true;
      this.loginFormButton.classList.add('is-disabled');
    }
  }

  updateRegisterButtonState() {
    if (!this.registerFormButton) return;
    
    const voornaam = this.getFieldValue('register-voornaam');
    const achternaam = this.getFieldValue('register-achternaam');
    const email = this.getFieldValue('register-email');
    const password = this.getFieldValue('register-password');
    const postcode = this.getFieldValue('register-postcode');
    const huisnummer = this.getFieldValue('register-huisnummer');
    const straatnaam = this.getFieldValue('register-straatnaam');
    const plaats = this.getFieldValue('register-plaats');
    
    const isValid = voornaam && achternaam && this.isValidEmail(email) && 
                    password.length >= 8 && postcode && huisnummer && 
                    straatnaam && plaats;
    
    if (isValid) {
      this.registerFormButton.disabled = false;
      this.registerFormButton.classList.remove('is-disabled');
    } else {
      this.registerFormButton.disabled = true;
      this.registerFormButton.classList.add('is-disabled');
    }
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
