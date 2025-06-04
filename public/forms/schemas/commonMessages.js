// public/forms/schemas/commonMessages.js

/**
 * Herbruikbare foutmeldingen voor formulieren.
 * Georganiseerd per categorie voor duidelijke structuur en gemakkelijk hergebruik.
 */
export const commonMessages = {
  // Algemene foutmeldingen
  general: {
    NETWORK_ERROR: 'Kan geen verbinding maken met de server. Controleer je internet.',
    DEFAULT: 'Er is iets misgegaan. Probeer het later opnieuw.',
    DEFAULT_INVALID_SUBMIT: 'Niet alle velden zijn correct ingevuld.',
    REQUIRED_FIELDS_MISSING: 'Niet alle verplichte velden zijn ingevuld.',
  },

  // Adres-gerelateerde foutmeldingen
  address: {
    ADDRESS_NOT_FOUND: 'Dit adres bestaat niet. Controleer je postcode en huisnummer.',
    INVALID_ADDRESS: 'De ingevoerde postcode en/of huisnummer is ongeldig. Controleer uw invoer.',
    API_TIMEOUT: 'Het ophalen van adresgegevens duurt te lang. Probeer het later nog eens.',
    API_ERROR: 'Er is een probleem bij het ophalen van adresgegevens. Probeer het later opnieuw.',
  },
  
  // Dekking-gerelateerde foutmeldingen
  coverage: {
    COVERAGE_ERROR: 'Kon niet controleren of er dekking is op jouw locatie. Probeer het later nog eens.',
    NO_COVERAGE: 'Op dit adres kunnen we helaas geen diensten leveren.',
  },

  // Server-gerelateerde foutmeldingen
  server: {
    SERVER_ERROR: 'Onze service is momenteel niet beschikbaar. Probeer het later opnieuw.',
    VALIDATION_ERROR: 'De ingevoerde gegevens zijn niet geldig. Controleer je invoer.',
  }
};

/**
 * Helper functie om meerdere message sets te combineren.
 * Hiermee kun je algemene berichten en specifieke berichten samenvoegen.
 * 
 * @param {...Object} messageSets - Eén of meer objecten met foutmeldingen
 * @returns {Object} - Een gecombineerd object met alle foutmeldingen
 */
export function combineMessages(...messageSets) {
  return Object.assign({}, ...messageSets);
}
