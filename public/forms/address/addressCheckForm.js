// public/forms/address/addressCheckForm.js

import { formHandler } from '../logic/formHandler.js';
import { getFormSchema } from '../schemas/formSchemas.js';
import { fetchAddressDetails, fetchCoverageStatus, ApiError as FrontendApiError } from '../../utils/api/index.js';

const FORM_NAME = 'postcode-form';

/**
 * Initialiseert het postcode-check formulier, inclusief custom submit-logic.
 * Dit formulier haalt adresgegevens op en controleert de dekkingsstatus.
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
        // Stap 1: Adresgegevens ophalen
        const addressDetails = await fetchAddressDetails(postcode, huisnummer);
        console.log('[addressCheckForm] Successfully fetched address details:', addressDetails);

        if (!addressDetails || !addressDetails.plaats) {
          console.error('[addressCheckForm] Geen plaatsnaam ontvangen van adres API:', addressDetails);
          // Gooi een specifieke error die de gebruiker kan begrijpen
          throw new Error('Kon de plaatsnaam niet ophalen. Controleer postcode en huisnummer.');
        }
        
        console.log(`[addressCheckForm] Attempting to check coverage for Plaats: ${addressDetails.plaats}`);
        // Stap 2: Dekking controleren op basis van de opgehaalde plaats
        const coverageStatus = await fetchCoverageStatus(addressDetails.plaats);
        console.log('[addressCheckForm] Successfully fetched coverage status:', coverageStatus);

        // Stap 3: Navigeren op basis van dekking
        // Zorg ervoor dat coverageStatus en coverageStatus.gedekt bestaan
        if (coverageStatus && typeof coverageStatus.gedekt === 'boolean') {
          if (coverageStatus.gedekt) {
            console.log(`[addressCheckForm] Plaats '${addressDetails.plaats}' is gedekt. Navigeren naar /aanvragen/opties...`);
            window.location.href = '/aanvragen/opties'; // Pas dit pad eventueel aan
          } else {
            console.log(`[addressCheckForm] Plaats '${addressDetails.plaats}' is NIET gedekt. Navigeren naar /aanvragen/geen-dekking...`);
            window.location.href = '/aanvragen/geen-dekking'; // Pas dit pad eventueel aan
          }
        } else {
          // Fallback als de response van coverage check onverwacht is
          console.error('[addressCheckForm] Ongeldige dekkingsstatus ontvangen:', coverageStatus);
          throw new Error('Kon de dekkingsstatus niet correct bepalen.');
        }

      } catch (error) {
        console.error('[addressCheckForm] Error during submit action:', error);

        let errorMessage = 'Er is een onbekende fout opgetreden.';
        if (error instanceof FrontendApiError) {
          // Specifieke API fout van onze frontend client (kan van fetchAddressDetails of fetchCoverageStatus zijn)
          errorMessage = error.message || 'Fout bij het communiceren met de server.';
        } else if (error.message) {
          // Andere JavaScript errors (bijv. van de 'throw new Error' hierboven)
          errorMessage = error.message;
        }

        const formDisplayError = new Error(errorMessage);
        throw formDisplayError;
      }
    },
    // successMessage: 'Adresgegevens succesvol opgehaald!', // Optioneel
    // navigateTo: '/volgende-stap' // Optioneel, als je niet handmatig navigeert in de action
  };

  formHandler.init(schema);
}
