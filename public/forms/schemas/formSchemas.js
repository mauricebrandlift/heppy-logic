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
          // Formulier voor stap 5: persoonsgegevens
          'abb_persoonsgegevens-form': {
            name: 'abb_persoonsgegevens-form',
            selector: '[data-form-name="abb_persoonsgegevens-form"]',
            fields: {
              // Gebruik herbruikbare commonFields waar mogelijk, met minimale overrides
              voornaam: {
                ...commonFields.voornaam,
              },
              achternaam: {
                ...commonFields.achternaam,
              },
              telefoonnummer: {
                ...commonFields.telefoon,
                label: 'Telefoonnummer',
                validators: ['required', 'numeric', 'minLength'],
                minLength: 8,
                inputFilter: 'digitsOnly',
                messages: {
                  // behoud bestaande numeric-message, voeg required/minLength toe waar nuttig
                  ...(commonFields.telefoon.messages || {}),
                  required: 'Telefoonnummer is verplicht',
                  minLength: 'Voer een geldig telefoonnummer in'
                }
              },
              emailadres: {
                ...commonFields.email,
                label: 'E-mailadres'
              },
              wachtwoord: {
                ...commonFields.wachtwoord,
              }
            },
            globalMessages: combineMessages(
              commonMessages.general,
              commonMessages.server,
              {
                CUSTOM_SUCCESS: 'Persoonsgegevens zijn opgeslagen.'
              }
            ),
            // Submit logica wordt toegevoegd in abbPersoonsgegevensForm.js
          },
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

    // Formulier voor stap 5: persoonsgegevens
    'abb_persoonsgegevens-form': {
      name: 'abb_persoonsgegevens-form',
      selector: '[data-form-name="abb_persoonsgegevens-form"]',
      fields: {
        voornaam: {
          label: 'Voornaam',
          inputType: 'text',
          sanitizers: ['trim'],
          validators: ['required', 'minLength'],
          minLength: 2,
          persist: 'form',
          messages: {
            required: 'Voornaam is verplicht',
            minLength: 'Voornaam is te kort'
          }
        },
        achternaam: {
          label: 'Achternaam',
          inputType: 'text',
          sanitizers: ['trim'],
          validators: ['required', 'minLength'],
          minLength: 2,
          persist: 'form',
          messages: {
            required: 'Achternaam is verplicht',
            minLength: 'Achternaam is te kort'
          }
        },
        telefoonnummer: {
          label: 'Telefoonnummer',
          inputType: 'text',
          sanitizers: ['trim'],
          validators: ['required', 'numeric', 'minLength'],
          minLength: 8,
          inputFilter: 'digitsOnly',
          persist: 'form',
          messages: {
            required: 'Telefoonnummer is verplicht',
            numeric: 'Gebruik alleen cijfers',
            minLength: 'Voer een geldig telefoonnummer in'
          }
        },
        emailadres: {
          label: 'E-mailadres',
          inputType: 'email',
          sanitizers: ['trim'],
          validators: ['required', 'email'],
          persist: 'form',
          messages: {
            required: 'E-mailadres is verplicht',
            email: 'Voer een geldig e-mailadres in'
          }
        },
        wachtwoord: {
          label: 'Wachtwoord',
          inputType: 'password',
          sanitizers: ['trim'],
          validators: ['required', 'minLength'],
          minLength: 8,
          persist: 'none',
          messages: {
            required: 'Wachtwoord is verplicht',
            minLength: 'Minimaal 8 tekens'
          }
        }
      },
      globalMessages: combineMessages(
        commonMessages.general,
        commonMessages.server,
        {
          CUSTOM_SUCCESS: 'Persoonsgegevens zijn opgeslagen.'
        }
      ),
      // Submit logica wordt toegevoegd in abbPersoonsgegevensForm.js
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
