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
      ),    },

    // Formulier voor stap 2 van abonnement aanvraag - schoonmaak opdracht details
    'abb_opdracht-form': {
      name: 'abb_opdracht-form',
      selector: '[data-form-name="abb_opdracht-form"]',
      fields: {
        abb_m2: {
          label: 'Oppervlakte in m²',
          inputType: 'number',
          sanitizers: ['trim', 'numericOnly'],
          validators: ['required', 'numeric', 'positiveNumber'],
          inputFilter: 'digitsOnly',
          persist: 'form',
          placeholder: '80',
          messages: {
            required: 'Voer het aantal vierkante meters in',
            numeric: 'Gebruik alleen cijfers',
            positiveNumber: 'Het oppervlak moet groter dan 0 zijn'
          }
        },
        abb_toiletten: {
          label: 'Aantal toiletten',
          inputType: 'number',
          sanitizers: ['trim', 'numericOnly'],
          validators: ['required', 'numeric', 'nonNegativeNumber'],
          inputFilter: 'digitsOnly',
          persist: 'form',
          placeholder: '1',
          messages: {
            required: 'Voer het aantal toiletten in',
            numeric: 'Gebruik alleen cijfers',
            nonNegativeNumber: 'Aantal toiletten kan niet negatief zijn'
          }
        },
        abb_badkamers: {
          label: 'Aantal badkamers',
          inputType: 'number',
          sanitizers: ['trim', 'numericOnly'],
          validators: ['required', 'numeric', 'nonNegativeNumber'],
          inputFilter: 'digitsOnly',
          persist: 'form',
          placeholder: '1',
          messages: {
            required: 'Voer het aantal badkamers in',
            numeric: 'Gebruik alleen cijfers',
            nonNegativeNumber: 'Aantal badkamers kan niet negatief zijn'
          }
        },
        weeknr: {
          label: 'Begin weeknummer',
          inputType: 'number',
          sanitizers: ['trim', 'numericOnly'],
          validators: ['required', 'numeric', 'integer'],
          inputFilter: 'digitsOnly',
          persist: 'form',
          placeholder: '',
          messages: {
            required: 'Selecteer het begin weeknummer',
            numeric: 'Gebruik alleen cijfers',
            integer: 'Voer een heel weeknummer in'
          }
        }
      },
      // Custom berichten voor dit formulier
      globalMessages: combineMessages(
        commonMessages.general,
        commonMessages.server,
        {
          // Formulier-specifieke berichten
          CALCULATION_ERROR: 'Er is een fout opgetreden bij het berekenen van de prijs.',
          MIN_HOURS_NOTICE: 'Het minimum aantal uren voor een schoonmaak sessie is 3 uur.',
          CUSTOM_SUCCESS: 'De schoonmaakgegevens zijn succesvol verwerkt.'
        }
      ),
      // Submit logica wordt later toegevoegd in een specifiek bestand voor dit formulier
    },    // Formulier voor stap 3 van abonnement aanvraag - dagdelen en schoonmaker keuze
    'abb_dagdelen-schoonmaker-form': {
      name: 'abb_dagdelen-schoonmaker-form',
      selector: '[data-form-name="abb_dagdelen-schoonmaker-form"]',
      fields: {
        schoonmakerKeuze: {
          label: 'Schoonmaker voorkeur',
          inputType: 'radio',
          sanitizers: ['trim'],
          validators: ['required'],
          persist: 'form',
          messages: {
            required: 'Selecteer een schoonmaker of "geen voorkeur"'
          }
        },
        // Dagdelen zijn optioneel en worden apart afgehandeld
        dagdeel: {
          label: 'Voorkeursdagdelen',
          inputType: 'checkbox',
          validators: ['optional'],
          persist: 'form'
        }
      },
      globalMessages: combineMessages(
        commonMessages.general,
        commonMessages.server,
        {
          // Formulier-specifieke berichten
          NO_CLEANERS_AVAILABLE: 'Er zijn momenteel geen schoonmakers beschikbaar in jouw regio.',
          NO_CLEANERS_MATCH: 'Er zijn geen schoonmakers beschikbaar die aan je criteria voldoen.',
          API_ERROR: 'Er is een probleem bij het ophalen van beschikbare schoonmakers.',
          CUSTOM_SUCCESS: 'Je schoonmakervoorkeur is succesvol opgeslagen.'
        }
      ),
      // Submit logica wordt later toegevoegd in abbDagdelenSchoonmakerForm.js
    },

    // Andere formulieren...
  };

  return schemas[name] || null;
}
