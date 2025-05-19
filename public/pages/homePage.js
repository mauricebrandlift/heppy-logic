// public/pages/homePage.js
import { initializeAddressCheckForm } from '../forms/address/addressCheckForm.js';

document.addEventListener('DOMContentLoaded', () => {
  // Try to find the address check form on the page
  const addressFormElement = document.querySelector('[data-form-name="postcode-form"]');

  if (addressFormElement) {
    console.log('Address check form found on homepage, initializing...');
    initializeAddressCheckForm();
  } else {
    console.log('Address check form not found on this page.');
  }
});
