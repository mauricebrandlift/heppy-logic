// public/forms/schemas/commonFields.js

/**
 * Centraal overzicht van herbruikbare veld-definities voor formulieren.
 * Elk veld bevat:
 *  - label: weergavenaam
 *  - inputType: type attribuut voor het input-element
 *  - sanitizers: lijst van sanitizing functies (in volgorde)
 *  - validators: lijst van validator-namen (in volgorde)
 *  - messages (optioneel): override van foutmeldingen per validator
 */
export const commonFields = {
  postcode: {
    label: 'Postcode',
    inputType: 'text',
    sanitizers: ['trim', 'uppercase', 'postcodeStructure'],
    validators: ['required', 'postcode'],
    inputFilter: 'postcode', // Filter voor real-time input (NNNNLL)
    persist: 'global', // options are global, form or none
    autocomplete: 'postal-code',
    placeholder: '1234AB',
    errorMessage: 'Voer een geldige postcode in (bijv. 1234AB).',
    // maxLength: 6, // Wordt nu dynamisch gezet in formHandler.js bij toepassen filter
  },
  huisnummer: {
    label: 'Huisnummer',
    inputType: 'text',
    sanitizers: ['trim', 'numericOnly'],
    validators: ['required', 'numeric'],
    inputFilter: 'digitsOnly', // Filter voor real-time input (alleen cijfers)
    persist: 'global',
    autocomplete: 'address-line2',
    placeholder: '10 of 10A',
    messages: {
      numeric: 'Gebruik alleen cijfers.'
    }
  },
  toevoeging: {
    label: 'Toevoeging',
    inputType: 'text',
    sanitizers: ['trim', 'uppercase'],
    validators: ['optional', 'alphaNumeric'],
    persist: 'global',
    messages: {
      alphaNumeric: 'Gebruik alleen letters en cijfers.'
    }
  },
  voornaam: {
    label: 'Voornaam',
    inputType: 'text',
    sanitizers: ['trim', 'uppercase'],
    validators: ['required', 'alphaNumeric'],
    persist: 'global',
    messages: {
      required: 'Voornaam is verplicht.',
      alphaNumeric: 'Voornaam mag alleen letters en cijfers bevatten.'
    }
  },
  achternaam: {
    label: 'Achternaam',
    inputType: 'text',
    sanitizers: ['trim', 'uppercase'],
    validators: ['required', 'alphaNumeric'],
    persist: 'global',
    messages: {
      required: 'Achternaam is verplicht.',
      alphaNumeric: 'Achternaam mag alleen letters en cijfers bevatten.'
    }
  },
  email: {
    label: 'E-mail',
    inputType: 'email',
    sanitizers: ['trim', 'lowercase'],
    validators: ['required', 'email'],
    persist: 'global',
    messages: {
      email: 'Voer een geldig e-mailadres in.'
    }
  },  telefoon: {
    label: 'Telefoonnummer',
    inputType: 'tel',
    sanitizers: ['trim', 'numericOnly'],
    validators: ['optional', 'numeric'],
    persist: 'global',
    messages: {
      numeric: 'Gebruik alleen cijfers voor telefoonnummer.'
    }
  },
  straatnaam: {
    label: 'Straatnaam',
    inputType: 'text',
    readonly: true,
    sanitizers: ['trim'],
    validators: ['optional'],
    persist: 'global'
  },
  plaats: {
    label: 'Plaats',
    inputType: 'text',
    readonly: true,
    sanitizers: ['trim'],
    validators: ['optional'],
    persist: 'global'
  },
  
  // Sollicitatie specifieke velden
  geslacht: {
    label: 'Geslacht',
    inputType: 'radio',
    sanitizers: ['trim'],
    validators: ['required'],
    persist: 'form',
    messages: {
      required: 'Selecteer je geslacht'
    }
  },
  geboortedatum: {
    label: 'Geboortedatum',
    inputType: 'date',
    sanitizers: ['trim'],
    validators: ['required', 'date'],
    persist: 'form',
    messages: {
      required: 'Geboortedatum is verplicht',
      date: 'Voer een geldige datum in'
    }
  },
  woonplaats: {
    label: 'Woonplaats',
    inputType: 'text',
    sanitizers: ['trim', 'capitalizeFirst'],
    validators: ['required', 'alphaNumeric'],
    persist: 'form',
    messages: {
      required: 'Woonplaats is verplicht',
      alphaNumeric: 'Woonplaats mag alleen letters bevatten'
    }
  },
  ervaringmotivatie: {
    label: 'Ervaring & Motivatie',
    inputType: 'textarea',
    sanitizers: ['trim'],
    validators: ['required', 'minLength'],
    persist: 'form',
    minLength: 50,
    messages: {
      required: 'Vertel ons over je ervaring en motivatie',
      minLength: 'Schrijf minimaal 50 karakters over je ervaring en motivatie'
    }
  },
  wachtwoord: {
    label: 'Wachtwoord',
    inputType: 'password',
    sanitizers: ['trim'],
    validators: ['required', 'minLength'],
    persist: 'none', // Wachtwoorden nooit persistent opslaan
    minLength: 8,
    messages: {
      required: 'Wachtwoord is verplicht',
      minLength: 'Wachtwoord moet minimaal 8 karakters zijn'
    }
  },
  akkoordVoorwaarden: {
    label: 'Akkoord met voorwaarden',
    inputType: 'checkbox',
    sanitizers: [],
    validators: ['required'],
    persist: 'none',
    messages: {
      required: 'Je moet akkoord gaan met de voorwaarden'
    }
  },
  
  // Voeg hier meer herbruikbare veld-definities toe
};
