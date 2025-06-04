// public/forms/aanvraag/abbAdresForm.js
// Formulier handling voor stap 1 van de abonnementsaanvraag: adresgegevens

import { formHandler } from '../logic/formHandler.js';
import { getFormSchema } from '../schemas/formSchemas.js';
import { fetchAddressDetails, fetchCoverageStatus, ApiError as FrontendApiError } from '../../utils/api/index.js';
import { showError, hideError } from '../ui/formUi.js';


const FORM_NAME = 'abb_adres-form';

/**
 * Initialiseert het adres formulier voor de abonnementsaanvraag.
 * Dit formulier haalt adresgegevens op en controleert de dekkingsstatus.
 */
export function initAbbAdresForm() {
  console.log('[abbAdresForm] Initialiseren van formulier:', FORM_NAME);
  
  // Haal het schema op
  const schema = getFormSchema(FORM_NAME);
  
  // Controleer of schema bestaat
  if (!schema) {
    console.error(`[abbAdresForm] Schema '${FORM_NAME}' niet gevonden in formSchemas.js!`);
    return;
  }
  
  // Definieer de submit actie
  schema.submit = {
    action: async (formData) => {
      // formData wordt door formHandler meegegeven
      console.log('[abbAdresForm] Submit action gestart met formData:', formData);
      const { postcode, huisnummer } = formData;

      try {
        // Stap 1: Adresgegevens ophalen
        const addressDetails = await fetchAddressDetails(postcode, huisnummer);
        console.log('[abbAdresForm] Adresdetails opgehaald:', addressDetails);        if (!addressDetails || !addressDetails.straat || !addressDetails.plaats) {
          // Gooi een error met een specifieke code die in commonMessages.js is gedefinieerd
          const error = new Error('Kon adresgegevens niet volledig ophalen.');
          error.code = 'ADDRESS_NOT_FOUND'; 
          throw error;
        }

        // Stap 2: Readonly velden vullen in DOM & formHandler.formData
        const formElement = formHandler.formElement; // Krijg toegang tot het formulier element via formHandler
        const straatElement = formElement.querySelector('[data-field-name="straatnaam"]');
        const plaatsElement = formElement.querySelector('[data-field-name="plaats"]');

        if (straatElement) straatElement.value = addressDetails.straat;
        if (plaatsElement) plaatsElement.value = addressDetails.plaats;

        // Update formHandler.formData zodat deze waarden ook intern bekend zijn
        formHandler.formData.straatnaam = addressDetails.straat;
        formHandler.formData.plaats = addressDetails.plaats;
        
        console.log('[abbAdresForm] Straat en plaats ingevuld. Straat:', addressDetails.straat, 'Plaats:', addressDetails.plaats);

        // Stap 3: Dekking controleren
        const coverageStatus = await fetchCoverageStatus(addressDetails.plaats);
        console.log('[abbAdresForm] Dekkingsstatus:', coverageStatus);

        if (coverageStatus && typeof coverageStatus.gedekt === 'boolean') {          if (coverageStatus.gedekt) {
            console.log(`[abbAdresForm] Plaats '${addressDetails.plaats}' is gedekt. Naar volgende slide...`);
            // Roep de moveToNextSlide functie aan die door Webflow wordt geleverd
            moveToNextSlide();
          } else {
            console.log(`[abbAdresForm] Plaats '${addressDetails.plaats}' is NIET gedekt. Navigeren naar /aanvragen/geen-dekking...`);
            window.location.href = '/aanvragen/geen-dekking';
          }        } else {
          // Gooi een error met een specifieke code voor dekkingsstatus problemen
          const error = new Error('Kon de dekkingsstatus niet correct bepalen.');
          error.code = 'COVERAGE_ERROR';
          throw error;
        }      } catch (error) {
        console.error('[abbAdresForm] Fout tijdens submit action:', error);
        
        // Als de error geen code heeft, voeg er dan één toe op basis van het type error
        if (!error.code) {
          if (error instanceof FrontendApiError) {
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
          } else if (error.message && error.message.includes('adres')) {
            error.code = 'ADDRESS_NOT_FOUND';
          } else {
            error.code = 'DEFAULT';
          }
        }
        
        // Gebruik het error object zoals het is, met de code die we hebben toegevoegd
        throw error;
      }
    },
    onSuccess: () => {
      console.log('[abbAdresForm] Submit action succesvol afgehandeld (geen navigatie of verdere actie hier).');
      // Navigatie gebeurt in de 'action' of wordt afgehandeld door moveToNextSlide
    }
  };
  
  // Initialiseer de formHandler met het bijgewerkte schema
  formHandler.init(schema);
  console.log(`[abbAdresForm] Formulier '${FORM_NAME}' is succesvol geïnitialiseerd.`);
}
