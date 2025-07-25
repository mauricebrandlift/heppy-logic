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
    },    // Login formulier
    'inloggen-form': {
      name: 'inloggen-form',
      selector: '[data-form-name="inloggen-form"]',
      fields: {
        emailadres: commonFields.email,
        wachtwoord: {
          label: 'Wachtwoord',
          inputType: 'password',
          sanitizers: ['trim'],
          validators: ['required'],
          persist: 'none', // Wachtwoorden nooit persistent opslaan
          messages: {
            required: 'Wachtwoord is verplicht'
          }
        }
      },
      globalMessages: combineMessages(
        commonMessages.general,
        commonMessages.server,
        {
          // Aanmeld-specifieke berichten
          AUTH_FAILED: 'E-mailadres of wachtwoord is onjuist.',
          AUTH_ERROR: 'Er is een probleem opgetreden bij het inloggen. Probeer het later opnieuw.',
          AUTH_SUCCESS: 'Je bent succesvol ingelogd.'
        }
      )
      // Submit logica wordt later toegevoegd in loginForm.js
    },

    // Sollicitatie formulier
    'soll_algemeen': {
      name: 'soll_algemeen',
      selector: '[data-form-name="soll_algemeen"]',
      fields: {
        // Persoonlijke gegevens
        sollalg_geslacht: {
          ...commonFields.geslacht,
          label: 'Geslacht'
        },
        sollalg_geboortedatum: {
          ...commonFields.geboortedatum,
          label: 'Geboortedatum'
        },
        sollalg_voornaam: {
          ...commonFields.voornaam,
          label: 'Voornaam'
        },
        sollalg_achternaam: {
          ...commonFields.achternaam,
          label: 'Achternaam'
        },
        sollalg_woonplaats: {
          ...commonFields.woonplaats,
          label: 'Woonplaats'
        },
        sollalg_telefoon: {
          ...commonFields.telefoon,
          validators: ['required', 'numeric'], // Telefoon verplicht voor sollicitaties
          messages: {
            required: 'Telefoonnummer is verplicht',
            numeric: 'Gebruik alleen cijfers voor telefoonnummer'
          }
        },
        
        // Sollicitatie specifiek
        sollalg_ervaringmotivatie: {
          ...commonFields.ervaringmotivatie,
          label: 'Ervaring & Motivatie'
        },
        sollalg_emailadres: {
          ...commonFields.email,
          label: 'E-mailadres'
        },
        sollalg_wachtwoord: {
          ...commonFields.wachtwoord,
          label: 'Gewenst wachtwoord'
        },
        sollalg_akkoordVoorwaarden: {
          ...commonFields.akkoordVoorwaarden,
          label: 'Ik ga akkoord met de voorwaarden'
        }
      },
      
      // Globale foutberichten
      globalMessages: combineMessages(
        commonMessages.general,
        commonMessages.server,
        {
          // Sollicitatie-specifieke berichten
          EMAIL_EXISTS: 'Er bestaat al een account met dit e-mailadres.',
          SOLLICITATIE_SUCCESS: 'Je sollicitatie is succesvol verstuurd! We nemen zo snel mogelijk contact met je op.',
          DUPLICATE_APPLICATION: 'Je hebt al eerder gesolliciteerd. We nemen contact met je op zodra we je sollicitatie hebben beoordeeld.',
          INVALID_AGE: 'Je moet minimaal 18 jaar oud zijn om te solliciteren.',
          WEAK_PASSWORD: 'Kies een sterker wachtwoord met minimaal 8 karakters.'
        }
      )
      // Submit logica wordt later toegevoegd in sollAlgemeenForm.js
    },

    // Andere formulieren...
  };

  return schemas[name] || null;
}
