// public/forms/schemas/formSchemas.js

import { commonFields } from './commonFields.js';
import { commonMessages, combineMessages } from './commonMessages.js';

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
  const schemas = {    'postcode-form': {
      name: 'postcode-form',
      selector: '[data-form-name="postcode-form"]',
      fields: {
        postcode: commonFields.postcode,
        huisnummer: commonFields.huisnummer,
        toevoeging: commonFields.toevoeging,
        straatnaam: {
          ...commonFields.straatnaam,
          requiresServerValidation: true,
          validationDependsOn: ['postcode', 'huisnummer']
        },
        plaats: {
          ...commonFields.plaats,
          requiresServerValidation: true,
          validationDependsOn: ['postcode', 'huisnummer']
        },
      },// Globale foutberichten per error code
      globalMessages: combineMessages(
        commonMessages.general,
        commonMessages.address,
        commonMessages.coverage,
        commonMessages.server
      ),
      // Geen submit-logica hier; wordt in addressCheckForm.js toegevoegd
      // Geen triggers in dit formulier; simpel postcodeschema
    },      'abb_adres-form': {
      name: 'abb_adres-form',
      selector: '[data-form-name="abb_adres-form"]',
      fields: {
        postcode: commonFields.postcode,
        huisnummer: commonFields.huisnummer,
        toevoeging: commonFields.toevoeging,
        straatnaam: {
          ...commonFields.straatnaam,
          requiresServerValidation: true,  // Deze velden vereisen server-validatie
          validationDependsOn: ['postcode', 'huisnummer'] // Validatie afhankelijk van deze velden
        },
        plaats: {
          ...commonFields.plaats,
          requiresServerValidation: true,
          validationDependsOn: ['postcode', 'huisnummer']
        },
      },
      submit: {
        // De submit logica wordt gedefinieerd in abbAdresForm.js
        // en daar aan het schema object toegevoegd.
      },
      triggers: [
        {
          type: 'addressLookup',
          // Optioneel: aangepaste configuratie als veldnamen anders zijn
          // config: {
          //   postcodeField: 'postcode',
          //   huisnummerField: 'huisnummer',
          //   straatField: 'straatnaam', 
          //   plaatsField: 'plaats'
          // }
        }
      ],      globalMessages: combineMessages(
        commonMessages.general,
        commonMessages.address,
        commonMessages.coverage,
        commonMessages.server,
        {
          // Formulier-specifieke berichten
          CUSTOM_SUCCESS: 'Je adresgegevens zijn succesvol gecontroleerd.',
          LOCAL_ONLY: 'Deze actie is alleen beschikbaar voor lokale adressen.'
        }
      ),
    },

    // Andere formulieren...
  };

  return schemas[name] || null;
}
