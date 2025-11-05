// public/forms/verhuis/vhAdresForm.js
// Formulier handling voor stap 1 van de verhuis/opleverschoonmaak aanvraag: adresgegevens

import { formHandler } from '../logic/formHandler.js';
import { getFormSchema } from '../schemas/formSchemas.js';
import { fetchAddressDetails, fetchCoverageStatus, ApiError as FrontendApiError } from '../../utils/api/index.js';
import { showError, hideError } from '../ui/formUi.js';
import { saveFlowData, loadFlowData } from '../logic/formStorage.js';
import { logStepCompleted } from '../../utils/tracking/simpleFunnelTracker.js';

const FORM_NAME = 'vh_adres-form';
const NEXT_FORM_NAME = 'vh_opdracht-form';

function goToFormStep(nextFormName) {
  console.log('[vhAdresForm] goToFormStep →', nextFormName);
  if (window.navigateToFormStep) {
    const navigated = window.navigateToFormStep(FORM_NAME, nextFormName);
    if (navigated) {
      console.log('[vhAdresForm] navigateToFormStep succesvol', nextFormName);
      return true;
    }
    console.warn('[vhAdresForm] navigateToFormStep kon niet navigeren, probeer fallback.');
  }

  if (window.jumpToSlideByFormName) {
    console.log('[vhAdresForm] Fallback jumpToSlideByFormName', nextFormName);
    window.jumpToSlideByFormName(nextFormName);
    return true;
  }

  if (window.moveToNextSlide) {
    console.log('[vhAdresForm] Fallback moveToNextSlide (geen target match)');
    window.moveToNextSlide();
    return true;
  }

  console.error('[vhAdresForm] Geen slider navigatie functie gevonden.');
  return false;
}

/**
 * Initialiseert het adres formulier voor de verhuis/opleverschoonmaak aanvraag.
 * Dit formulier haalt adresgegevens op en controleert de dekkingsstatus.
 */
export function initVhAdresForm() {
  console.log('[vhAdresForm] Initialiseren van formulier:', FORM_NAME);
  
  // Haal het schema op
  const schema = getFormSchema(FORM_NAME);
  
  // Controleer of schema bestaat
  if (!schema) {
    console.error(`[vhAdresForm] Schema '${FORM_NAME}' niet gevonden in formSchemas.js!`);
    return;
  }
  
  // Laad eventueel bestaande flow data
  const flowData = loadFlowData('verhuis-aanvraag');
  console.log('[vhAdresForm] Bestaande flow data:', flowData);
  
  // Definieer de submit actie
  schema.submit = {
    action: async (formData) => {
      // formData wordt door formHandler meegegeven
      console.log('[vhAdresForm] Submit action gestart met formData:', formData);
      const { postcode, huisnummer } = formData;

      try {
        // Stap 1: Adresgegevens ophalen
        const addressDetails = await fetchAddressDetails(postcode, huisnummer);
        console.log('[vhAdresForm] Adresdetails opgehaald:', addressDetails);

        if (!addressDetails || !addressDetails.straat || !addressDetails.plaats) {
          // Gooi een error met een specifieke code die in commonMessages.js is gedefinieerd
          const error = new Error('Kon adresgegevens niet volledig ophalen.');
          error.code = 'ADDRESS_NOT_FOUND'; 
          throw error;
        }

        // Stap 2: Readonly velden vullen in DOM & formHandler.formData
        const formElement = formHandler.formElement;
        const straatElement = formElement.querySelector('[data-field-name="straatnaam"]');
        const plaatsElement = formElement.querySelector('[data-field-name="plaats"]');

        if (straatElement) straatElement.value = addressDetails.straat;
        if (plaatsElement) plaatsElement.value = addressDetails.plaats;

        // Update formHandler.formData zodat deze waarden ook intern bekend zijn
        formHandler.formData.straatnaam = addressDetails.straat;
        formHandler.formData.plaats = addressDetails.plaats;
        
        console.log('[vhAdresForm] Straat en plaats ingevuld. Straat:', addressDetails.straat, 'Plaats:', addressDetails.plaats);

        // Stap 3: Dekking controleren
        const coverageStatus = await fetchCoverageStatus(addressDetails.plaats);
        console.log('[vhAdresForm] Dekkingsstatus:', coverageStatus);

        if (coverageStatus && typeof coverageStatus.gedekt === 'boolean') {
          if (coverageStatus.gedekt) {
            console.log(`[vhAdresForm] Plaats '${addressDetails.plaats}' is gedekt. Kan doorgaan naar volgende stap.`);
            // Sla op dat het adres in een gebied met dekking is
            formHandler.formData.heeftDekking = true;
            
            // Bewaar alle adresgegevens in de flowData voor de hele aanvraagflow
            const flowData = loadFlowData('verhuis-aanvraag') || {};
            flowData.postcode = postcode;
            flowData.huisnummer = huisnummer;
            flowData.straatnaam = addressDetails.straat;
            flowData.plaats = addressDetails.plaats;
            flowData.heeftDekking = true;
            saveFlowData('verhuis-aanvraag', flowData);
            
            // 🎯 TRACK STEP COMPLETION
            logStepCompleted('verhuis_opleverschoonmaak', 'adres', 1, {
              postcode,
              huisnummer,
              straat: addressDetails.straat,
              plaats: addressDetails.plaats,
              gedekt: true
            }).catch(err => console.warn('[vhAdresForm] Tracking failed:', err));
          } else {
            console.log(`[vhAdresForm] Plaats '${addressDetails.plaats}' is NIET gedekt. Zal navigeren naar geen-dekking pagina.`);
            // Sla op dat het adres in een gebied zonder dekking is
            formHandler.formData.heeftDekking = false;
            
            // Bewaar dekking status in flow data
            const flowData = loadFlowData('verhuis-aanvraag') || {};
            flowData.heeftDekking = false;
            saveFlowData('verhuis-aanvraag', flowData);
          }
        } else {
          // Gooi een error met een specifieke code voor dekkingsstatus problemen
          const error = new Error('Kon de dekkingsstatus niet correct bepalen.');
          error.code = 'COVERAGE_ERROR';
          throw error;
        }
      } catch (error) {
        console.error('[vhAdresForm] Fout tijdens submit action:', error);
        
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
      console.log('[vhAdresForm] Submit action succesvol afgehandeld, nu navigatie uitvoeren');
      
      // Bepaal waar we heen navigeren op basis van de dekkingsstatus
      if (formHandler.formData.heeftDekking) {
        console.log('[vhAdresForm] Adres heeft dekking, naar volgende slide...');
        
        // Initialiseer het opdracht formulier vóór de navigatie
        import('./verhuisOpdrachtForm.js').then(module => {
          console.log('[vhAdresForm] Stap 2 (verhuisOpdrachtForm) wordt geïnitialiseerd...');
          module.initVerhuisOpdrachtForm();
          
          // Na initialisatie, navigeer naar de volgende slide
          goToFormStep(NEXT_FORM_NAME);
        }).catch(err => {
          console.error('[vhAdresForm] Kon stap 2 (verhuisOpdrachtForm) niet laden:', err);
          // Alsnog doorgaan naar volgende slide, ook al is er een probleem met het laden
          goToFormStep(NEXT_FORM_NAME);
        });
      } else {
        console.log('[vhAdresForm] Adres heeft geen dekking, navigeren naar geen-dekking pagina...');
        window.location.href = '/aanvragen/geen-dekking';
      }
    }
  };

  // Initialiseer de formHandler met het bijgewerkte schema
  formHandler.init(schema);
  
  // Pre-fill formuliervelden als er flowData beschikbaar is
  if (flowData) {
    const formElement = document.querySelector(schema.selector);
    
    // Adresvelden vooraf invullen als ze beschikbaar zijn in flowData
    if (formElement) {
      const postcodeField = formElement.querySelector('[data-field-name="postcode"]');
      const huisnummerField = formElement.querySelector('[data-field-name="huisnummer"]');
      const toeoeingField = formElement.querySelector('[data-field-name="toevoeging"]');
      const straatField = formElement.querySelector('[data-field-name="straatnaam"]');
      const plaatsField = formElement.querySelector('[data-field-name="plaats"]');
      
      if (flowData.postcode && postcodeField) postcodeField.value = flowData.postcode;
      if (flowData.huisnummer && huisnummerField) huisnummerField.value = flowData.huisnummer;
      if (flowData.toevoeging && toeoeingField) toeoeingField.value = flowData.toevoeging;
      if (flowData.straatnaam && straatField) straatField.value = flowData.straatnaam;
      if (flowData.plaats && plaatsField) plaatsField.value = flowData.plaats;
      
      // Update ook de formData in de formHandler
      if (flowData.postcode) formHandler.formData.postcode = flowData.postcode;
      if (flowData.huisnummer) formHandler.formData.huisnummer = flowData.huisnummer;
      if (flowData.toevoeging) formHandler.formData.toevoeging = flowData.toevoeging;
      if (flowData.straatnaam) formHandler.formData.straatnaam = flowData.straatnaam;
      if (flowData.plaats) formHandler.formData.plaats = flowData.plaats;
      if (typeof flowData.heeftDekking === 'boolean') formHandler.formData.heeftDekking = flowData.heeftDekking;
    }
  }
  
  console.log(`[vhAdresForm] Formulier '${FORM_NAME}' is succesvol geïnitialiseerd.`);
}
