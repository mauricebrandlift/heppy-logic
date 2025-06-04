// public/forms/schemas/formSchemas.js

import { commonFields } from './commonFields.js';

/**
 * Database van form schemas.
 * Elk schema beschrijft:
 *  - name: unieke naam
 *  - selector: CSS-selector van het form-element (data-form-name)
 *  - fields: definitie van elk veld incl. sanitizers, validators en messages
 *  - triggers (optioneel): globale triggers op veld-combinaties
 *  - globalMessages (optioneel): mapping van error codes naar user-friendly berichten
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
      // Globale foutberichten per error code
      globalMessages: {
        NETWORK_ERROR: 'Kan geen verbinding maken met de server. Controleer je internet.',
        DEFAULT: 'Er is iets misgegaan. Probeer het later opnieuw.',
      },
      // Geen submit-logica hier; wordt in addressCheckForm.js toegevoegd
      // Geen triggers in dit formulier; simpel postcodeschema
    },
      'abb_adres-form': {
      name: 'abb_adres-form',
      selector: '[data-form-name="abb_adres-form"]',
      fields: {
        postcode: commonFields.postcode,
        huisnummer: commonFields.huisnummer,
        toevoeging: commonFields.toevoeging,
        straatnaam: commonFields.straatnaam,
        plaats: commonFields.plaats,
      },
      submit: {
        // De submit logica wordt gedefinieerd in abbAdresForm.js
        // en daar aan het schema object toegevoegd.
      },
      globalMessages: {
        NETWORK_ERROR: 'Er is een netwerkfout opgetreden. Probeer het later opnieuw.',
        DEFAULT: 'Er is een onbekende fout opgetreden. Controleer de ingevoerde gegevens.',
      },
    },

    // Andere formulieren...
  };

  return schemas[name] || null;
}
