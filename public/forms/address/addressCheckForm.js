/**
 * Module: postcode-form
 *
 * Beheert de adrescheckstap: sanitizen, validatie, opslag en dispatch van het completion event.
 * Gebruik custom attributen voor selectie:
 *   - Formulier: <form data-form-name="postcode-form">
 *   - Velden:    <input data-field-name="...">
 *   - Knop:      <button data-form-button="postcode-form">
 *
 * Ondersteunt optioneel een `group` voor gedeelde data uit formSchema.
 *
 * @module public/forms/address/addressCheckForm
 * @version 1.0.0
 * @example
 * import { initAddressCheckForm } from './addressCheckForm.js';
 * document.addEventListener('DOMContentLoaded', () => initAddressCheckForm());
 */

import { formSchemas } from '../schemas/formSchema.js';
import { validateField, validateForm, validateFull } from '../validators/formValidator.js';
import { sanitize, collect } from '../logic/formInputSanitizer.js';
import { getPrefillData, setPrefillData, getFormData, setFormData } from '../logic/formStorage.js';
import * as ui from '../ui/formUi.js';
import { getAddressInfo } from '../../utils/api/index.js';

// Constanten en selectors
const FORM_NAME = 'postcode-form';
const formEl = document.querySelector(`[data-form-name="${FORM_NAME}"]`);
const submitBtn = document.querySelector(`[data-form-button="${FORM_NAME}"]`);
const { fields: schemaFields = {}, group: schemaGroup } = formSchemas[FORM_NAME] || {};

export function initAddressCheckForm() {
  console.log('[AddressCheckForm] initAddressCheckForm called');
  if (!formEl || !submitBtn) {
    console.warn('[AddressCheckForm] formEl or submitBtn not found');
    return;
  }

  // 1) Prefill: laad opgeslagen data voor group of form
  const storageKey = schemaGroup || FORM_NAME;
  const saved = getPrefillData(storageKey) || {};
  console.log('[AddressCheckForm] prefill data loaded for', storageKey, saved);
  if (Object.keys(saved).length) {
    ui.prefillFields(formEl, saved);
    const initialValid = validateForm(schemaFields, formEl);
    console.log('[AddressCheckForm] initial formValid after prefill:', initialValid);
    ui.toggleButton(submitBtn, initialValid);
  }

  // 2) Input events: sanitizen, veldvalidatie, knopstatus en opslag
  formEl.querySelectorAll('[data-field-name]').forEach((input) => {
    const fieldName = input.getAttribute('data-field-name');
    input.addEventListener('input', () => {
      console.log(`[AddressCheckForm] input event on field: ${fieldName}`, input.value);
      const clean = sanitize(input.value);
      console.log(`[AddressCheckForm] sanitized value for ${fieldName}:`, clean);
      input.value = clean;

      // veldvalidatie
      const fieldErrors = validateField(schemaFields, fieldName, clean);
      console.log(`[AddressCheckForm] validateField errors for ${fieldName}:`, fieldErrors);
      ui.showErrors(formEl, fieldName, fieldErrors);

      // hele formulier validatie
      const formValid = validateForm(schemaFields, formEl);
      console.log('[AddressCheckForm] validateForm result:', formValid);
      ui.toggleButton(submitBtn, formValid);

      // opslaan
      const existing = getPrefillData(storageKey) || {};
      const updated = { ...existing, [fieldName]: clean };
      console.log('[AddressCheckForm] saving prefillData for', storageKey, updated);
      setPrefillData(storageKey, updated);
    });
  });

  // 3) Submit handler: volledige validatie, opslag, API-call en event dispatch
  formEl.addEventListener('submit', async (event) => {
    event.preventDefault();
    console.log('[AddressCheckForm] submit handler fired');
    ui.showLoader(submitBtn);
    ui.toggleFields(formEl, false);

    const data = collect(formEl);
    console.log('[AddressCheckForm] collected data:', data);

    const errors = await validateFull(schemaFields, data, { fetchAddressValidation: getAddressInfo });
    console.log('[AddressCheckForm] validateFull errors:', errors);
    if (errors.length) {
      console.log('[AddressCheckForm] validation failed, showing errors');
      ui.showErrors(formEl, errors);
      ui.hideLoader(submitBtn);
      ui.toggleFields(formEl, true);
      return;
    }

    // sla formulierdata op
    const existing = getFormData(storageKey) || {};
    const savedData = { ...existing, ...data };
    console.log('[AddressCheckForm] saving formData for', storageKey, savedData);
    setFormData(storageKey, savedData);

    // externe adresvalidatie
    console.log('[AddressCheckForm] calling getAddressInfo');
    let result;
    try {
      const info = await getAddressInfo(data);
      console.log('[AddressCheckForm] getAddressInfo response:', info);
      result = { success: true, detail: { isCovered: info.isCovered } };
    } catch (err) {
      console.error('[AddressCheckForm] getAddressInfo error:', err);
      result = { success: false, message: err.message };
    }

    if (result.success) {
      console.log('[AddressCheckForm] validation succeeded, dispatching event', result.detail);
      document.dispatchEvent(new CustomEvent(`${FORM_NAME}:completed`, { detail: result.detail }));
    } else {
      console.log('[AddressCheckForm] validation failed or API error, showing global error', result.message);
      ui.showGlobalError(formEl, result.message || 'Er is iets misgegaan.');
      ui.hideLoader(submitBtn);
      ui.toggleFields(formEl, true);
    }
  });

  // 4) Initialiseer knopstatus
  const initialValid = validateForm(schemaFields, formEl);
  console.log('[AddressCheckForm] final initial toggle status:', initialValid);
  ui.toggleButton(submitBtn, initialValid);
}
