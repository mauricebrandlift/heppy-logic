// public/forms/address/addressCheckForm.js

import { formHandler } from '../logic/formHandler.js';
import { getFormSchema } from '../schemas/formSchemas.js';
// Importeer de nieuwe API functie en eventueel de ApiError class voor type checking
import { fetchAddressDetails, ApiError as FrontendApiError } from '../../utils/api/index.js';

const FORM_NAME = 'postcode-form';

/**
 * Initialiseert het postcode-check formulier, inclusief custom submit-logic.
 */
export function initAddressCheckForm() {
  console.log(`🚀 [addressCheckForm] Initializing form: ${FORM_NAME}`);

  const schema = getFormSchema(FORM_NAME);
  if (!schema) {
    console.error(`❌ [addressCheckForm] Schema '${FORM_NAME}' not found`);
    return;
  }

  // Voeg per-form custom submit-logic toe
  schema.submit = {
    /**
     * Custom action die wordt uitgevoerd door formHandler.
     * De formHandler toont de loader VOOR deze actie en verbergt deze ERNA.
     */
    action: async (formData) => { // formData wordt meegegeven door formHandler
      console.log('✅ [addressCheckForm] Validatie succesvol, custom action gestart met formData:', formData);

      const { postcode, huisnummer } = formData;
      console.log(`[addressCheckForm] Attempting to fetch address for Postcode: ${postcode}, Huisnummer: ${huisnummer}`);

      try {
        // Roep de nieuwe API functie aan
        const addressDetails = await fetchAddressDetails(postcode, huisnummer);

        // addressDetails bevat nu het object zoals geretourneerd door /api/address
        // bijv. { straat, plaats, postcode, huisnummer, toevoeging, latitude, longitude }
        console.log('[addressCheckForm] Successfully fetched address details:', addressDetails);

        // TODO: Volgende stap - doe iets met addressDetails.
        // Bijvoorbeeld:
        // 1. Sla de gegevens op in een state management systeem.
        // 2. Roep een volgende API aan om de dekking te controleren op basis van addressDetails.plaats.
        //    const coverageStatus = await checkCoverage(addressDetails.plaats);
        //    console.log('[addressCheckForm] Coverage status:', coverageStatus);

        // Voor nu, loggen we het en navigeren we (zoals de oude code).
        const nextPage = '/aanvragen/opties'; // Haal dit eventueel uit een config of state
        console.log(`[addressCheckForm] Navigating to ${nextPage}...`);
        //window.location.href = nextPage;

      } catch (error) {
        console.error('[addressCheckForm] Error during submit action:', error);

        // Geef een duidelijke foutmelding aan de formHandler
        // De formHandler verwacht een error object met een .message property.
        let errorMessage = 'Er is een onbekende fout opgetreden bij het ophalen van het adres.';
        if (error instanceof FrontendApiError) {
          // Specifieke API fout van onze frontend client
          errorMessage = error.message || 'Fout bij het ophalen van adresgegevens van de server.';
        } else if (error.message) {
          // Andere JavaScript errors
          errorMessage = error.message;
        }

        // Gooi een nieuwe error die de formHandler kan tonen.
        // Het is belangrijk dat de formHandler een error.message kan lezen.
        const formDisplayError = new Error(errorMessage);
        // Je kunt de originele error bewaren voor debugging indien nodig
        // formDisplayError.originalError = error;
        throw formDisplayError;
      }
    },
    // successMessage: 'Adresgegevens succesvol opgehaald!', // Optioneel
    // navigateTo: '/volgende-stap' // Optioneel, als je niet handmatig navigeert in de action
  };

  formHandler.init(schema);
}
