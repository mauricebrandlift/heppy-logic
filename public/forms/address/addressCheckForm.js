// public/forms/address/addressCheckForm.js

import { formHandler } from '../logic/formHandler.js';
import { getFormSchema } from '../schemas/formSchemas.js';
import { saveGlobalFieldData, saveFlowData, loadFlowData } from '../logic/formStorage.js';
import {
  fetchAddressDetails,
  fetchCoverageStatus,
  ApiError as FrontendApiError,
} from '../../utils/api/index.js';
import { showError, hideError } from '../ui/formUi.js';

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

      const { postcode, huisnummer, toevoeging = '' } = formData;
      console.log(`[addressCheckForm] Attempting to fetch address for Postcode: ${postcode}, Huisnummer: ${huisnummer}`);

      try {
        // Stap 1: Adresgegevens ophalen
        const addressDetails = await fetchAddressDetails(postcode, huisnummer);
        console.log('[addressCheckForm] Successfully fetched address details:', addressDetails);        if (!addressDetails || !addressDetails.plaats) {
          console.error('[addressCheckForm] Geen plaatsnaam ontvangen van adres API:', addressDetails);
          // Gooi een error met specifieke code voor betere berichten uit commonMessages
          const error = new Error('Kon de plaatsnaam niet ophalen. Controleer postcode en huisnummer.');
          error.code = 'ADDRESS_NOT_FOUND';
          throw error;
        }

        // Deel gegevens op voor vervolgformulieren
        const normalizedToevoeging = toevoeging || '';
        saveGlobalFieldData('postcode', postcode);
        saveGlobalFieldData('huisnummer', huisnummer);
        saveGlobalFieldData('toevoeging', normalizedToevoeging);

        const flowData = loadFlowData('abonnement-aanvraag') || {};
        flowData.postcode = postcode;
        flowData.huisnummer = huisnummer;
        flowData.toevoeging = normalizedToevoeging;
        saveFlowData('abonnement-aanvraag', flowData);
        
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
          }        } else {
          // Fallback als de response van coverage check onverwacht is
          console.error('[addressCheckForm] Ongeldige dekkingsstatus ontvangen:', coverageStatus);
          const error = new Error('Kon de dekkingsstatus niet correct bepalen.');
          error.code = 'COVERAGE_ERROR';
          throw error;
        }      } catch (error) {
        console.error('[addressCheckForm] Error during submit action:', error);

        // Behoud de bestaande error code als die er al is
        if (!error.code) {
          if (error instanceof FrontendApiError) {
            // Specifieke API fout van onze frontend client
            if (error.status === 404) {
              error.code = 'ADDRESS_NOT_FOUND';
            } else if (error.status === 400) {
              error.code = 'INVALID_ADDRESS';
            } else if (error.status >= 500) {
              error.code = 'SERVER_ERROR';
            } else if (!navigator.onLine) {
              error.code = 'NETWORK_ERROR';
            } else {
              error.code = 'API_ERROR';
            }
          } else if (error.message && error.message.includes('dekking')) {
            error.code = 'COVERAGE_ERROR';
          } else if (error.message && (error.message.includes('plaatsnaam') || 
                    error.message.includes('adres') || 
                    error.message.includes('postcode'))) {
            error.code = 'ADDRESS_NOT_FOUND';
          } else {
            error.code = 'DEFAULT';
          }
        }

        // Gooi de originele error met toegewezen code
        throw error;
      }
    },
    // successMessage: 'Adresgegevens succesvol opgehaald!', // Optioneel
    // navigateTo: '/volgende-stap' // Optioneel, als je niet handmatig navigeert in de action
  };

  formHandler.init(schema);
}
