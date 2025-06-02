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

    adresCheck: {
      name: 'adresCheck',
      selector: '#adres-check-form', // Zorg ervoor dat dit overeenkomt met je HTML
      fields: {
        postcode: { ...commonFields.postcode, persist: 'global' },
        huisnummer: { ...commonFields.huisnummer, persist: 'global' },
        toevoeging: { ...commonFields.toevoeging, persist: 'global', validators: ['huisnummerToevoeging'] }, // Toevoeging is optioneel
      },
      submitButtonText: 'Check adres',
      api: adresCheckApi, // Gebruik de geïmporteerde API handler
      globalMessages: {
        success: 'Adres succesvol gecontroleerd en automatisch ingevuld!',
        apiError: 'Er is een technische storing opgetreden. Probeer het later opnieuw.', // Generieke fallback
        validationError: 'Niet alle velden zijn correct ingevuld. Controleer de rood gemarkeerde velden.',
        requiredFieldsEmpty: 'Vul alstublieft alle verplichte velden in.',
        // NIEUW: Mappings voor specifieke error codes van de API
        'ADDRESS_NOT_FOUND_API': 'Adres niet gevonden. Controleer de ingevoerde postcode en huisnummer.',
        'API_UNAUTHORIZED': 'De adrescontrole kan momenteel niet worden uitgevoerd (authenticatieprobleem). Probeer het later opnieuw.',
        // Voeg hier eventueel andere API-specifieke error code mappings toe
      },
      resetFormOnSuccess: false, // Stel in op true als het formulier gereset moet worden na succes
      // disableButtonOnSuccess: true, // Stel in op true als de knop gedisabled moet worden na succes
      // disableFieldsOnSuccess: ['postcode', 'huisnummer', 'toevoeging'], // Velden om te disablen na succes
      // hideFieldsOnSuccess: [], // Velden om te verbergen na succes
    },

    // Andere formulieren...
  };

  return schemas[name] || null;
}
