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
    },
    'geen-dekking_form': {
      name: 'geen-dekking_form',
      selector: '[data-form-name="geen-dekking_form"]',
      fields: {
        plaats: {
          label: 'Plaats',
          inputType: 'text',
          sanitizers: ['trim'],
          validators: ['required'],
          persist: 'global',
          messages: {
            required: 'Plaats is verplicht'
          }
        },
        straat: {
          label: 'Straat',
          inputType: 'text',
          sanitizers: ['trim'],
          validators: ['required'],
          persist: 'global',
          messages: {
            required: 'Straat is verplicht'
          }
        },
        naam: {
          label: 'Naam',
          inputType: 'text',
          sanitizers: ['trim'],
          validators: ['required'],
          persist: 'none',
          messages: {
            required: 'Vul je naam in'
          }
        },
        emailadres: {
          ...commonFields.email,
          persist: 'none'
        }
      },
      // Submit logica wordt toegevoegd in geenDekkingForm.js
      globalMessages: combineMessages(
        commonMessages.general,
        commonMessages.server,
        {
          CUSTOM_SUCCESS: 'Bedankt! We laten het je weten zodra we actief zijn in jouw regio.',
          DUPLICATE_ENTRY: 'Je staat al op onze wachtlijst.'
        }
      )
    },
    'schoonmaak-frequentie-form': {
      name: 'schoonmaak-frequentie-form',
      selector: '[data-form-name="schoonmaak-frequentie-form"]',
      fields: {
        frequentie: {
          label: 'Schoonmaak frequentie',
          inputType: 'radio',
          sanitizers: ['trim'],
          validators: ['required'],
          persist: 'none',
          messages: {
            required: 'Kies een schoonmaakoptie om verder te gaan.'
          }
        }
      },
      globalMessages: combineMessages(
        commonMessages.general,
        commonMessages.server,
        {
          INVALID_SELECTION: 'Kies een geldige schoonmaakoptie.',
          DEFAULT: 'Er ging iets mis bij het verwerken van je keuze. Probeer het opnieuw.'
        }
      )
    },
    'abb_adres-form': {
      name: 'abb_adres-form',
      selector: '[data-form-name="abb_adres-form"]',
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
      },
      submit: {
        // De submit logica wordt gedefinieerd in abbAdresForm.js
      },
      triggers: [
        {
          type: 'addressLookup',
        }
      ],
      globalMessages: combineMessages(
        commonMessages.general,
        commonMessages.address,
        commonMessages.coverage,
        commonMessages.server,
        {
          // Formulier-specifieke berichten voor adres
          CUSTOM_SUCCESS: 'Je adresgegevens zijn succesvol gecontroleerd.',
          LOCAL_ONLY: 'Deze actie is alleen beschikbaar voor lokale adressen.'
        }
      ),
    },

    // Formulier voor stap 2 van abonnement aanvraag - schoonmaak opdracht details
    'abb_opdracht-form': {
      name: 'abb_opdracht-form',
      selector: '[data-form-name="abb_opdracht-form"]',
      fields: {
        frequentie: {
          label: 'Frequentie schoonmaak',
          inputType: 'radio',
          sanitizers: ['trim'],
          validators: ['required'],
          persist: 'form',
          messages: {
            required: 'Kies een frequentie (per week of per twee weken)'
          }
        },
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
          validators: ['required', 'integer', 'weeknrAllowed'],
          inputFilter: 'digitsOnly',
          persist: 'form',
          placeholder: '',
          allowedWeeks: [],
          messages: {
            required: 'Selecteer het begin weeknummer',
            integer: 'Voer een heel weeknummer in',
            weeknrAllowed: 'Week buiten toegestane startperiode'
          }
        }
      },
      globalMessages: combineMessages(
        commonMessages.general,
        commonMessages.server,
        {
          CALCULATION_ERROR: 'Er is een fout opgetreden bij het berekenen van de prijs.',
          MIN_HOURS_NOTICE: 'Het minimum aantal uren voor een schoonmaak sessie is 3 uur.',
          CUSTOM_SUCCESS: 'De schoonmaakgegevens zijn succesvol verwerkt.'
        }
      ),
      // Submit logica wordt later toegevoegd in een specifiek bestand voor dit formulier
    },

    // Formulier voor stap 3 van abonnement aanvraag - dagdelen en schoonmaker keuze
    'abb_dagdelen-schoonmaker-form': {
      name: 'abb_dagdelen-schoonmaker-form',
      selector: '[data-form-name="abb_dagdelen-schoonmaker-form"]',
      fields: {
        schoonmakerKeuze: {
          label: 'Schoonmaker voorkeur',
          inputType: 'radio',
          sanitizers: ['trim'],
          validators: ['required'],
          persist: 'none',
          messages: {
            required: 'Selecteer een schoonmaker of "geen voorkeur"'
          }
        },
        // Dagdelen zijn optioneel en worden apart afgehandeld
        dagdeel: {
          label: 'Voorkeursdagdelen',
          inputType: 'checkbox',
          validators: ['optional'],
          persist: 'none'
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
        // Hergebruik commonFields met minimale overrides waar nodig
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

    // Formulier voor stap 5: persoonsgegevens (DIEPTEREINIGING)
    'dr_persoonsgegevens-form': {
      name: 'dr_persoonsgegevens-form',
      selector: '[data-form-name="dr_persoonsgegevens-form"]',
      fields: {
        // Hergebruik commonFields met minimale overrides waar nodig
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
      // Submit logica wordt toegevoegd in drPersoonsgegevensForm.js
    },

    // Formulier voor stap 6: betaling
    'abb_betaling-form': {
      name: 'abb_betaling-form',
      selector: '[data-form-name="abb_betaling-form"]',
      fields: {
        akkoord_voorwaarden: {
          ...commonFields.akkoordVoorwaarden,
        },
      },
      globalMessages: combineMessages(
        commonMessages.general,
        commonMessages.server,
        {
          CUSTOM_SUCCESS: 'Betaling gestart.',
        }
      ),
      // Submit logica in abbBetalingForm.js
    },

    // Formulier voor stap 6: betaling (DIEPTEREINIGING)
    'dr_betaling-form': {
      name: 'dr_betaling-form',
      selector: '[data-form-name="dr_betaling-form"]',
      fields: {
        akkoord_voorwaarden: {
          ...commonFields.akkoordVoorwaarden,
        },
      },
      globalMessages: combineMessages(
        commonMessages.general,
        commonMessages.server,
        {
          CUSTOM_SUCCESS: 'Betaling gestart.',
        }
      ),
      // Submit logica in drBetalingForm.js
    },

  // Login formulier
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

    // ============================================================
    // DIEPTEREINIGING FLOW
    // ============================================================
    
    // Formulier voor stap 1 van dieptereiniging aanvraag - adresgegevens
    'dr_adres-form': {
      name: 'dr_adres-form',
      selector: '[data-form-name="dr_adres-form"]',
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
      },
      submit: {
        // De submit logica wordt gedefinieerd in drAdresForm.js
      },
      triggers: [
        {
          type: 'addressLookup',
        }
      ],
      globalMessages: combineMessages(
        commonMessages.general,
        commonMessages.address,
        commonMessages.coverage,
        commonMessages.server,
        {
          // Formulier-specifieke berichten voor adres
          CUSTOM_SUCCESS: 'Je adresgegevens zijn succesvol gecontroleerd.',
          LOCAL_ONLY: 'Deze actie is alleen beschikbaar voor lokale adressen.'
        }
      ),
    },

    // Formulier voor stap 2 van dieptereiniging aanvraag - opdracht details
    'dr_opdracht-form': {
      name: 'dr_opdracht-form',
      selector: '[data-form-name="dr_opdracht-form"]',
      fields: {
        dr_m2: {
          label: 'Aantal vierkante meters',
          inputType: 'number',
          sanitizers: ['trim'],
          validators: ['required', 'integer', 'min:20', 'max:500'],
          persist: 'form',
          messages: {
            required: 'Vul het aantal vierkante meters in',
            integer: 'Vul een geldig getal in',
            min: 'Minimaal 20m² voor dieptereiniging',
            max: 'Maximaal 500m² per opdracht'
          }
        },
        dr_toiletten: {
          label: 'Aantal toiletten',
          inputType: 'number',
          sanitizers: ['trim'],
          validators: ['required', 'integer', 'min:0', 'max:10'],
          persist: 'form',
          messages: {
            required: 'Vul het aantal toiletten in',
            integer: 'Vul een geldig getal in',
            min: 'Minimaal 0 toiletten',
            max: 'Maximaal 10 toiletten'
          }
        },
        dr_badkamers: {
          label: 'Aantal badkamers',
          inputType: 'number',
          sanitizers: ['trim'],
          validators: ['required', 'integer', 'min:0', 'max:10'],
          persist: 'form',
          messages: {
            required: 'Vul het aantal badkamers in',
            integer: 'Vul een geldig getal in',
            min: 'Minimaal 0 badkamers',
            max: 'Maximaal 10 badkamers'
          }
        },
        dr_datum: {
          label: 'Gewenste datum',
          inputType: 'date',
          sanitizers: ['trim'],
          validators: ['required'],
          persist: 'form',
          messages: {
            required: 'Kies een datum voor de dieptereiniging',
            INVALID_DATE: 'Deze datum is niet beschikbaar'
          }
        }
      },
      submit: {
        // De submit logica wordt gedefinieerd in drOpdrachtForm.js
      },
      globalMessages: combineMessages(
        commonMessages.general,
        commonMessages.server,
        {
          INVALID_DATE: 'Kies een geldige datum binnen het toegestane bereik',
          INCOMPLETE_FORM: 'Vul alle velden in om door te gaan',
          CUSTOM_SUCCESS: 'Opdracht details succesvol opgeslagen'
        }
      ),
    },

    // Dieptereiniging stap 3: Schoonmaker keuze
    'dr_schoonmaker-form': {
      selector: '[data-form-name="dr_schoonmaker-form"]',
      fields: {
        schoonmakerKeuze: {
          label: 'Schoonmaker keuze',
          inputType: 'radio',
          sanitizers: ['trim'],
          validators: ['required'],
          persist: 'form',
          messages: {
            required: 'Kies een schoonmaker of selecteer "Geen voorkeur"'
          }
        }
      },
      submit: {
        // Submit action wordt toegevoegd in drSchoonmakerForm.js via schema.submit.action = ...
      },
      globalMessages: combineMessages(
        commonMessages.general,
        commonMessages.server,
        {
          NO_CLEANERS_FOUND: 'Geen beschikbare schoonmakers gevonden voor de gekozen datum',
          CLEANER_SELECTION_REQUIRED: 'Selecteer een schoonmaker om door te gaan',
          CUSTOM_SUCCESS: 'Schoonmaker gekozen, ga door naar de volgende stap'
        }
      ),
    },

    // ============================================================
    // VERHUIS/OPLEVERSCHOONMAAK FLOW
    // ============================================================
    
    // Formulier voor stap 1 van verhuis/opleverschoonmaak aanvraag - adresgegevens
    'vh_adres-form': {
      name: 'vh_adres-form',
      selector: '[data-form-name="vh_adres-form"]',
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
      },
      submit: {
        // De submit logica wordt gedefinieerd in vhAdresForm.js
      },
      triggers: [
        {
          type: 'addressLookup',
        }
      ],
      globalMessages: combineMessages(
        commonMessages.general,
        commonMessages.address,
        commonMessages.coverage,
        commonMessages.server,
        {
          // Formulier-specifieke berichten voor adres
          CUSTOM_SUCCESS: 'Je adresgegevens zijn succesvol gecontroleerd.',
          LOCAL_ONLY: 'Deze actie is alleen beschikbaar voor lokale adressen.'
        }
      ),
    },

    // Formulier voor stap 2 van verhuis/opleverschoonmaak aanvraag - opdracht details
    'vh_opdracht-form': {
      name: 'vh_opdracht-form',
      selector: '[data-form-name="vh_opdracht-form"]',
      fields: {
        vh_m2: {
          label: 'Aantal vierkante meters',
          inputType: 'number',
          sanitizers: ['trim'],
          validators: ['required', 'integer', 'min:20', 'max:500'],
          persist: 'form',
          messages: {
            required: 'Vul het aantal vierkante meters in',
            integer: 'Vul een geldig getal in',
            min: 'Minimaal 20m² voor verhuis/opleverschoonmaak',
            max: 'Maximaal 500m² per opdracht'
          }
        },
        vh_toiletten: {
          label: 'Aantal toiletten',
          inputType: 'number',
          sanitizers: ['trim'],
          validators: ['required', 'integer', 'min:0', 'max:10'],
          persist: 'form',
          messages: {
            required: 'Vul het aantal toiletten in',
            integer: 'Vul een geldig getal in',
            min: 'Minimaal 0 toiletten',
            max: 'Maximaal 10 toiletten'
          }
        },
        vh_badkamers: {
          label: 'Aantal badkamers',
          inputType: 'number',
          sanitizers: ['trim'],
          validators: ['required', 'integer', 'min:0', 'max:10'],
          persist: 'form',
          messages: {
            required: 'Vul het aantal badkamers in',
            integer: 'Vul een geldig getal in',
            min: 'Minimaal 0 badkamers',
            max: 'Maximaal 10 badkamers'
          }
        },
        vh_datum: {
          label: 'Gewenste datum',
          inputType: 'date',
          sanitizers: ['trim'],
          validators: ['required'],
          persist: 'form',
          messages: {
            required: 'Kies een datum voor de verhuis/opleverschoonmaak',
            INVALID_DATE: 'Deze datum is niet beschikbaar'
          }
        }
      },
      submit: {
        // De submit logica wordt gedefinieerd in verhuisOpdrachtForm.js
      },
      globalMessages: combineMessages(
        commonMessages.general,
        commonMessages.server,
        {
          INVALID_DATE: 'Kies een geldige datum binnen het toegestane bereik',
          INCOMPLETE_FORM: 'Vul alle velden in om door te gaan',
          CUSTOM_SUCCESS: 'Opdracht details succesvol opgeslagen'
        }
      ),
    },

    // Verhuis/opleverschoonmaak stap 3: Schoonmaker keuze
    'vh_schoonmaker-form': {
      name: 'vh_schoonmaker-form',
      selector: '[data-form-name="vh_schoonmaker-form"]',
      fields: {
        schoonmakerKeuze: {
          label: 'Schoonmaker keuze',
          inputType: 'radio',
          sanitizers: ['trim'],
          validators: ['required'],
          persist: 'form',
          messages: {
            required: 'Kies een schoonmaker of selecteer "Geen voorkeur"'
          }
        }
      },
      submit: {
        // Submit action wordt toegevoegd in verhuisSchoonmakerForm.js via schema.submit.action = ...
      },
      globalMessages: combineMessages(
        commonMessages.general,
        commonMessages.server,
        {
          NO_CLEANERS_FOUND: 'Geen beschikbare schoonmakers gevonden voor de gekozen datum',
          CLEANER_SELECTION_REQUIRED: 'Selecteer een schoonmaker om door te gaan',
          CUSTOM_SUCCESS: 'Schoonmaker gekozen, ga door naar de volgende stap'
        }
      ),
    },

    // Verhuis/opleverschoonmaak stap 4: Overzicht
    'vh_overzicht-form': {
      name: 'vh_overzicht-form',
      selector: '[data-form-name="vh_overzicht-form"]',
      fields: {
        // Overzicht heeft geen input velden, alleen weergave en bevestiging
        // Submit button triggert navigatie naar volgende stap
      },
      submit: {
        // Submit action wordt toegevoegd in verhuisOverzichtForm.js
      },
      globalMessages: combineMessages(
        commonMessages.general,
        commonMessages.server,
        {
          CUSTOM_SUCCESS: 'Overzicht gecontroleerd, ga door naar persoonsgegevens'
        }
      ),
    },

    // Formulier voor stap 5: persoonsgegevens (VERHUIS/OPLEVERSCHOONMAAK)
    'vh_persoonsgegevens-form': {
      name: 'vh_persoonsgegevens-form',
      selector: '[data-form-name="vh_persoonsgegevens-form"]',
      fields: {
        // Hergebruik commonFields met minimale overrides waar nodig
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
      // Submit logica wordt toegevoegd in vhPersoonsgegevensForm.js
    },

    // Formulier voor stap 6: betaling (VERHUIS/OPLEVERSCHOONMAAK)
    'vh_betaling-form': {
      name: 'vh_betaling-form',
      selector: '[data-form-name="vh_betaling-form"]',
      fields: {
        akkoord_voorwaarden: {
          ...commonFields.akkoordVoorwaarden,
        },
      },
      globalMessages: combineMessages(
        commonMessages.general,
        commonMessages.server,
        {
          CUSTOM_SUCCESS: 'Betaling gestart.',
        }
      ),
      // Submit logica in verhuisBetalingForm.js
    },

    // ========================================
    // REINIGING BANK EN STOELEN FLOW (OFFERTE)
    // ========================================

    // Stap 1: Adresgegevens (hergebruik adres logica)
    'rbs_adres-form': {
      name: 'rbs_adres-form',
      selector: '[data-form-name="rbs_adres-form"]',
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
      },
      submit: {
        // De submit logica wordt gedefinieerd in rbsAdresForm.js
      },
      triggers: [
        {
          type: 'addressLookup',
        }
      ],
      globalMessages: combineMessages(
        commonMessages.general,
        commonMessages.address,
        commonMessages.coverage,
        commonMessages.server,
        {
          CUSTOM_SUCCESS: 'Je adresgegevens zijn succesvol gecontroleerd.',
        }
      ),
    },

    // Stap 2: Meubel details
    'rbs_opdracht-form': {
      name: 'rbs_opdracht-form',
      selector: '[data-form-name="rbs_opdracht-form"]',
      fields: {
        rbs_banken: {
          label: 'Aantal banken',
          inputType: 'number',
          sanitizers: ['trim'],
          validators: ['integer', 'min:0', 'max:20'],
          persist: 'form',
          messages: {
            integer: 'Vul een geldig getal in',
            min: 'Minimaal 0 banken',
            max: 'Maximaal 20 banken'
          }
        },
        rbs_stoelen: {
          label: 'Aantal stoelen',
          inputType: 'number',
          sanitizers: ['trim'],
          validators: ['integer', 'min:0', 'max:50'],
          persist: 'form',
          messages: {
            integer: 'Vul een geldig getal in',
            min: 'Minimaal 0 stoelen',
            max: 'Maximaal 50 stoelen'
          }
        },
        rbs_zitvlakken: {
          label: 'Totaal aantal zitvlakken',
          inputType: 'number',
          sanitizers: ['trim'],
          validators: ['required', 'integer', 'min:1', 'max:100'],
          persist: 'form',
          messages: {
            required: 'Vul het totaal aantal zitvlakken in',
            integer: 'Vul een geldig getal in',
            min: 'Minimaal 1 zitvlak',
            max: 'Maximaal 100 zitvlakken'
          }
        },
        rbs_kussens: {
          label: 'Aantal kussens',
          inputType: 'number',
          sanitizers: ['trim'],
          validators: ['integer', 'min:0', 'max:200'],
          persist: 'form',
          messages: {
            integer: 'Vul een geldig getal in',
            min: 'Minimaal 0 kussens',
            max: 'Maximaal 200 kussens'
          }
        },
        materiaal_stof: {
          label: 'Materiaal: Stof',
          inputType: 'checkbox',
          sanitizers: [],
          validators: [],
          persist: 'form',
        },
        materiaal_leer: {
          label: 'Materiaal: Leer',
          inputType: 'checkbox',
          sanitizers: [],
          validators: [],
          persist: 'form',
        },
        materiaal_kunstleer: {
          label: 'Materiaal: Kunstleer',
          inputType: 'checkbox',
          sanitizers: [],
          validators: [],
          persist: 'form',
        },
        materiaal_fluweel: {
          label: 'Materiaal: Fluweel',
          inputType: 'checkbox',
          sanitizers: [],
          validators: [],
          persist: 'form',
        },
        materiaal_suede: {
          label: 'Materiaal: Suede',
          inputType: 'checkbox',
          sanitizers: [],
          validators: [],
          persist: 'form',
        },
        materiaal_anders: {
          label: 'Materiaal: Weet ik niet / Anders',
          inputType: 'checkbox',
          sanitizers: [],
          validators: [],
          persist: 'form',
        },
        rbs_specificaties: {
          label: 'Specificaties',
          inputType: 'textarea',
          sanitizers: ['trim'],
          validators: ['minLength', 'maxLength'],
          minLength: 20,
          maxLength: 1000,
          persist: 'form',
          messages: {
            minLength: 'Geef minimaal 20 tekens aan informatie',
            maxLength: 'Maximaal 1000 tekens'
          }
        }
      },
      triggers: [
        {
          type: 'atLeastOneCheckbox',
          fields: ['materiaal_stof', 'materiaal_leer', 'materiaal_kunstleer', 'materiaal_fluweel', 'materiaal_suede', 'materiaal_anders'],
          message: 'Selecteer minimaal één materiaal'
        }
      ],
      submit: {
        // Submit logica wordt toegevoegd in bankReinigingOpdrachtForm.js
      },
      globalMessages: combineMessages(
        commonMessages.general,
        commonMessages.server,
        {
          CUSTOM_SUCCESS: 'Meubel details opgeslagen',
          INCOMPLETE_FORM: 'Vul alle verplichte velden in'
        }
      ),
    },

    // Stap 3: Dagdelen voorkeur (hergebruik dagdelen component)
    'rbs_dagdelen-form': {
      name: 'rbs_dagdelen-form',
      selector: '[data-form-name="rbs_dagdelen-form"]',
      fields: {
        // Dagdelen checkboxes - worden dynamisch verwerkt door dagdelen component
        dagdeel: {
          label: 'Voorkeur dagdelen',
          inputType: 'checkbox',
          sanitizers: [],
          validators: [],
          persist: 'form',
        }
      },
      triggers: [
        {
          type: 'atLeastOneCheckbox',
          fields: [], // Wordt dynamisch gevuld door dagdelen form
          message: 'Selecteer minimaal één dagdeel'
        }
      ],
      submit: {
        // Submit logica wordt toegevoegd in rbsDagdelenForm.js
      },
      globalMessages: combineMessages(
        commonMessages.general,
        commonMessages.server,
        {
          CUSTOM_SUCCESS: 'Voorkeur dagdelen opgeslagen',
          NO_DAGDELEN_SELECTED: 'Selecteer minimaal één dagdeel om door te gaan'
        }
      ),
    },

    // Stap 4: Overzicht
    'rbs_overzicht-form': {
      name: 'rbs_overzicht-form',
      selector: '[data-form-name="rbs_overzicht-form"]',
      fields: {
        // Geen input velden, alleen weergave
      },
      submit: {
        // Submit action wordt toegevoegd in bankReinigingOverzichtForm.js
      },
      globalMessages: combineMessages(
        commonMessages.general,
        commonMessages.server,
        {
          CUSTOM_SUCCESS: 'Overzicht gecontroleerd, ga door naar persoonsgegevens'
        }
      ),
    },

    // Stap 5: Persoonsgegevens (met offerte aanvraag knop)
    'rbs_persoonsgegevens-form': {
      name: 'rbs_persoonsgegevens-form',
      selector: '[data-form-name="rbs_persoonsgegevens-form"]',
      fields: {
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
          validators: [], // Wachtwoord is OPTIONEEL voor offerte flow
          messages: {
            ...commonFields.wachtwoord.messages,
            required: '' // Geen required message want optioneel
          }
        },
        akkoord_voorwaarden: {
          ...commonFields.akkoordVoorwaarden,
        }
      },
      globalMessages: combineMessages(
        commonMessages.general,
        commonMessages.server,
        {
          CUSTOM_SUCCESS: 'Offerte aanvraag verzonden! U ontvangt binnen 24 uur een offerte per email.'
        }
      ),
      // Submit logica wordt toegevoegd in rbsPersoonsgegevensForm.js
    },

    // Andere formulieren...
  };

  return schemas[name] || null;
}
