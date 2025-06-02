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
      submit: {
        // De `action` property wordt dynamisch toegevoegd door `initAddressCheckForm`
        // omdat het afhankelijk is van de `formHandler` instantie.
        // Voorbeeld van andere opties die hier geconfigureerd kunnen worden:
        // disableFieldsOnSuccess: true, 
        // disableButtonOnSuccess: true,
      },
      globalMessages: {
        success: 'Adresgegevens succesvol verwerkt.',
        /** 
         * Fallback foutmelding voor API errors als er geen specifiekere melding 
         * (via err.message of een gemapte err.code) beschikbaar is.
         */
        DEFAULT_API_ERROR: 'Er is een onbekende fout opgetreden tijdens het verwerken van uw aanvraag. Probeer het later opnieuw.',
        /**
         * Foutmelding indien verplichte velden niet zijn ingevuld bij een submit poging.
         */
        REQUIRED_FIELDS_MISSING: 'Niet alle verplichte velden zijn ingevuld.',
        /**
         * Algemene foutmelding voor een ongeldige submit poging (bijv. validatiefouten anders dan lege verplichte velden).
         */
        DEFAULT_INVALID_SUBMIT: 'Controleer de invoer en probeer het opnieuw.',
        // Voorbeeld van een specifieke code mapping (als de action een error met .code zou gooien):
        // 'ADDRESS_NOT_FOUND_CODE': 'Het opgegeven adres kon niet worden gevonden. Controleer uw invoer.',
      },
      resetFormOnSuccess: false,
    },

    // Andere formulieren...
  };

  return schemas[name] || null;
}
