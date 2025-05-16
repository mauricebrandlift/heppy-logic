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
 * @module public/forms/adress/adressCheckForm
 * @version 1.0.0
 * @example
 * import { initAddressCheckForm } from './addressCheckForm.js';
 * document.addEventListener('DOMContentLoaded', () => initAdresCheckForm());
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

export function initAdresCheckForm() {
  if (!formEl || !submitBtn) return;

  // 1) Prefill: laad opgeslagen data voor group of form
  const storageKey = schemaGroup || FORM_NAME;
  const saved = getPrefillData(storageKey) || {};
  if (Object.keys(saved).length) {
    ui.prefillFields(formEl, saved);
    ui.toggleButton(submitBtn, validateForm(schemaFields, formEl));
  }

  // 2) Input events: sanitizen, veldvalidatie, knopstatus en opslag
  formEl.querySelectorAll('[data-field-name]').forEach((input) => {
    const fieldName = input.getAttribute('data-field-name');
    input.addEventListener('input', () => {
      const clean = sanitize(input.value);
      input.value = clean;

      // veldvalidatie
      const fieldErrors = validateField(schemaFields, fieldName, clean);
      ui.showErrors(formEl, fieldName, fieldErrors);

      // hele formulier validatie
      const formValid = validateForm(schemaFields, formEl);
      ui.toggleButton(submitBtn, formValid);

      // opslaan
      const existing = getPrefillData(storageKey) || {};
      setPrefillData(storageKey, { ...existing, [fieldName]: clean });
    });
  });

  // 3) Submit handler: volledige validatie, opslag, API-call en event dispatch
  formEl.addEventListener('submit', async (event) => {
    event.preventDefault();
    ui.showLoader(submitBtn);
    ui.toggleFields(formEl, false);

    const data = collect(formEl);
    const errors = await validateFull(schemaFields, data, { fetchAddressValidation: getAddressInfo });
    if (errors.length) {
      ui.showErrors(formEl, errors);
      ui.hideLoader(submitBtn);
      ui.toggleFields(formEl, true);
      return;
    }

    // sla formulierdata op
    const existing = getFormData(storageKey) || {};
    setFormData(storageKey, { ...existing, ...data });

    // externe adresvalidatie\ n    let result;
    try {
      const info = await getAddressInfo(data);
      result = { success: true, detail: { isCovered: info.isCovered } };
    } catch (err) {
      result = { success: false, message: err.message };
    }

    if (result.success) {
      document.dispatchEvent(new CustomEvent(`${FORM_NAME}:completed`, { detail: result.detail }));
    } else {
      ui.showGlobalError(formEl, result.message || 'Er is iets misgegaan.');
      ui.hideLoader(submitBtn);
      ui.toggleFields(formEl, true);
    }
  });

  // 4) Initialiseer knopstatus
  ui.toggleButton(submitBtn, validateForm(schemaFields, formEl));
}
