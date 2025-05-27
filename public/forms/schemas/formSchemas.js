// public/forms/schemas/formSchemas.js

import { commonFields } from './commonFields.js';

/**
 * Database van form schemas.
 * Elk schema beschrijft:
 *  - name: unieke naam
 *  - selector: CSS-selector van het form-element (meestal via data-form-name)
 *  - fields: definitie van elk veld incl. sanitizers, validators en messages
 *  - triggers (optioneel): globale triggers op veld-combinaties
 */
export function getFormSchema(name) {
  const schemas = {
    'postcode-form': {
      name: 'postcode-form',
      selector: '[data-form-name="postcode-form"]',
      fields: {
        postcode: commonFields.postcode,
        huisnummer: commonFields.huisnummer,
        toevoeging: commonFields.toevoeging,
      },
      globalMessages: {
        NETWORK_ERROR:    'Geen verbinding. Controleer je internet.',
        OUT_OF_AREA:      'Deze postcode valt niet binnen ons gebied.',
        DEFAULT:          'Er is iets misgegaan. Probeer het later opnieuw.',
      },
      // Geen submit-logica hier; wordt in addressCheckForm.js toegevoegd
      // Geen triggers in dit formulier; simpel postcodeschema
    },
  };

  return schemas[name] || null;
}