// public/forms/vloer/rvAdresForm.js
// Formulier handling voor stap 1 van de vloer reiniging aanvraag: adresgegevens

import { formHandler } from '../logic/formHandler.js';
import { getFormSchema } from '../schemas/formSchemas.js';
import { fetchAddressDetails, fetchCoverageStatus, ApiError as FrontendApiError } from '../../utils/api/index.js';
import { showError, hideError } from '../ui/formUi.js';
import { saveFlowData, loadFlowData, clearOtherFlows } from '../logic/formStorage.js';
import { logStepCompleted } from '../../utils/tracking/simpleFunnelTracker.js';

const FORM_NAME = 'rv_adres-form';
const NEXT_FORM_NAME = 'rv_opdracht-form';

function goToFormStep(nextFormName) {
  console.log('[rvAdresForm] goToFormStep →', nextFormName);
  if (window.navigateToFormStep) {
    const navigated = window.navigateToFormStep(FORM_NAME, nextFormName);
    if (navigated) {
      console.log('[rvAdresForm] navigateToFormStep succesvol', nextFormName);
      return true;
    }
    console.warn('[rvAdresForm] navigateToFormStep kon niet navigeren, probeer fallback.');
  }

  if (window.jumpToSlideByFormName) {
    console.log('[rvAdresForm] Fallback jumpToSlideByFormName', nextFormName);
    window.jumpToSlideByFormName(nextFormName);
    return true;
  }

  if (window.moveToNextSlide) {
    console.log('[rvAdresForm] Fallback moveToNextSlide (geen target match)');
    window.moveToNextSlide();
    return true;
  }

  console.error('[rvAdresForm] Geen slider navigatie functie gevonden.');
  return false;
}

/**
 * Initialiseert het adres formulier voor de vloer reiniging aanvraag.
 * Dit formulier haalt adresgegevens op en controleert de dekkingsstatus.
 */
export function initRvAdresForm() {
  console.log('[rvAdresForm] Initialiseren van formulier:', FORM_NAME);
  
  // ✨ Clear andere flow data om vervuiling te voorkomen
  clearOtherFlows('vloer-aanvraag');
  
  // Haal het schema op
  const schema = getFormSchema(FORM_NAME);
  
  // Controleer of schema bestaat
  if (!schema) {
    console.error(`[rvAdresForm] Schema '${FORM_NAME}' niet gevonden in formSchemas.js!`);
    return;
  }
  
  // Laad eventueel bestaande flow data
  const flowData = loadFlowData('vloer-aanvraag');
  console.log('[rvAdresForm] Bestaande flow data:', flowData);
  
  // Definieer de submit actie
  schema.submit = {
    action: async (formData) => {
      console.log('[rvAdresForm] Submit action gestart met formData:', formData);
      
      const postcode = formData.postcode?.toUpperCase().replace(/\s/g, '');
      const huisnummer = formData.huisnummer;
      const toevoeging = formData.toevoeging || '';

      console.log(`[rvAdresForm] Ophalen adresgegevens voor: ${postcode} ${huisnummer}${toevoeging ? toevoeging : ''}`);

      try {
        // Stap 1: Haal adresdetails op
        const addressDetails = await fetchAddressDetails(postcode, huisnummer, toevoeging);
        console.log('[rvAdresForm] Adres gevonden:', addressDetails);

        // Update readonly velden in het formulier
        formHandler.formData.straatnaam = addressDetails.straat;
        formHandler.formData.plaats = addressDetails.plaats;

        const formElement = document.querySelector(schema.selector);
        if (formElement) {
          const straatnaamField = formElement.querySelector('[data-field-name="straatnaam"]');
          const plaatsField = formElement.querySelector('[data-field-name="plaats"]');

          if (straatnaamField) straatnaamField.value = addressDetails.straat;
          if (plaatsField) plaatsField.value = addressDetails.plaats;

          console.log('[rvAdresForm] Readonly velden bijgewerkt');
        }

        // Stap 2: Check coverage status
        console.log('[rvAdresForm] Controleren dekkingsstatus...');
        const coverageData = await fetchCoverageStatus(addressDetails.plaats);
        console.log('[rvAdresForm] Coverage data ontvangen:', coverageData);

        if (coverageData && typeof coverageData.gedekt === 'boolean') {
          console.log(`[rvAdresForm] Dekking status: ${coverageData.gedekt}`);

          if (coverageData.gedekt) {
            console.log('[rvAdresForm] ✅ Adres heeft dekking, opslaan in flowData...');
            
            // Update formHandler data
            formHandler.formData.heeftDekking = true;
            
            // Bewaar alle adresgegevens in de flowData voor de hele aanvraagflow
            const flowData = loadFlowData('vloer-aanvraag') || {};
            flowData.postcode = postcode;
            flowData.huisnummer = huisnummer;
            flowData.toevoeging = toevoeging;
            flowData.straatnaam = addressDetails.straat;
            flowData.plaats = addressDetails.plaats;
            flowData.heeftDekking = true;
            saveFlowData('vloer-aanvraag', flowData);
            
            // 🎯 TRACK STEP COMPLETION
            logStepCompleted('vloerreinigen', 'adres', 1, {
              postcode,
              huisnummer,
              plaats: addressDetails.plaats,
              heeftDekking: true
            }).catch(err => console.warn('[rvAdresForm] Tracking failed:', err));
            
            console.log('[rvAdresForm] ✅ Adresgegevens succesvol opgeslagen in flowData');
          } else {
            console.warn('[rvAdresForm] ⚠️ Adres heeft GEEN dekking');
            formHandler.formData.heeftDekking = false;
            
            // Bewaar ook voor geen-dekking pagina
            const flowData = loadFlowData('vloer-aanvraag') || {};
            flowData.postcode = postcode;
            flowData.huisnummer = huisnummer;
            flowData.toevoeging = toevoeging;
            flowData.straatnaam = addressDetails.straat;
            flowData.plaats = addressDetails.plaats;
            flowData.heeftDekking = false;
            saveFlowData('vloer-aanvraag', flowData);
          }
        } else {
          // Gooi een error met een specifieke code voor dekkingsstatus problemen
          const error = new Error('Kon de dekkingsstatus niet correct bepalen.');
          error.code = 'COVERAGE_ERROR';
          throw error;
        }
      } catch (error) {
        console.error('[rvAdresForm] Fout tijdens submit action:', error);
        
        // Als de error geen code heeft, voeg er dan één toe op basis van het type error
        if (!error.code) {
          if (error instanceof FrontendApiError) {
            if (error.status === 404) {
              error.code = 'ADDRESS_NOT_FOUND';
            } else if (error.status === 400) {
              error.code = 'INVALID_INPUT';
            } else {
              error.code = 'API_ERROR';
            }
          } else {
            error.code = 'UNKNOWN_ERROR';
          }
        }
        
        // Gooi de error door naar formHandler, die zal de error message tonen
        throw error;
      }
    },
    
    onSuccess: () => {
      console.log('[rvAdresForm] Submit succesvol, controleer dekking...');
      
      // Check of adres dekking heeft
      const heeftDekking = formHandler.formData.heeftDekking;
      
      if (!heeftDekking) {
        console.log('[rvAdresForm] Adres heeft geen dekking, navigeren naar geen-dekking pagina...');
        window.location.href = '/aanvragen/geen-dekking';
      } else {
        console.log('[rvAdresForm] Adres heeft dekking, navigeren naar volgende stap...');
        
        // Import en initialiseer de volgende stap: opdracht formulier
        import('./rvOpdrachtForm.js').then(module => {
          console.log('[rvAdresForm] Stap 2 (rvOpdrachtForm) wordt geïnitialiseerd...');
          module.initRvOpdrachtForm();
          goToFormStep(NEXT_FORM_NAME);
        }).catch(err => {
          console.error('[rvAdresForm] Kon stap 2 niet laden:', err);
          goToFormStep(NEXT_FORM_NAME);
        });
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
      const toevoegingField = formElement.querySelector('[data-field-name="toevoeging"]');
      const straatnaamField = formElement.querySelector('[data-field-name="straatnaam"]');
      const plaatsField = formElement.querySelector('[data-field-name="plaats"]');
      
      if (postcodeField && flowData.postcode) {
        postcodeField.value = flowData.postcode;
        formHandler.formData.postcode = flowData.postcode;
      }
      if (huisnummerField && flowData.huisnummer) {
        huisnummerField.value = flowData.huisnummer;
        formHandler.formData.huisnummer = flowData.huisnummer;
      }
      if (toevoegingField && flowData.toevoeging) {
        toevoegingField.value = flowData.toevoeging;
        formHandler.formData.toevoeging = flowData.toevoeging;
      }
      if (straatnaamField && flowData.straatnaam) {
        straatnaamField.value = flowData.straatnaam;
        formHandler.formData.straatnaam = flowData.straatnaam;
      }
      if (plaatsField && flowData.plaats) {
        plaatsField.value = flowData.plaats;
        formHandler.formData.plaats = flowData.plaats;
      }
      
      console.log('[rvAdresForm] Formulier vooraf ingevuld met bestaande flowData');
    }
  }
  
  console.log(`✅ [rvAdresForm] Formulier '${FORM_NAME}' is succesvol geïnitialiseerd.`);
}
