// public/forms/sollicitatie/sollAlgemeenForm.js
/**
 * Sollicitatie formulier handler
 * Integreert met het formHandler systeem, UI helpers, validators, en sollicitatie API
 * Volgt dezelfde structuur als andere formulieren in het systeem
 */
import { formHandler } from '../logic/formHandler.js';
import { getFormSchema } from '../schemas/formSchemas.js';
import { submitSollicitatie } from '../../utils/api/sollicitatie.js';
import { showError, hideError } from '../ui/formUi.js';
import { saveFlowData, loadFlowData, saveGlobalFieldData, loadGlobalFieldData } from '../logic/formStorage.js';

const FORM_NAME = 'soll_algemeen';

/**
 * Initialiseert het sollicitatie formulier.
 * Dit formulier handelt de volledige sollicitatie flow af inclusief account aanmaken.
 */
export function initSollicitatieForm() {
  console.log('[sollAlgemeenForm] Initialiseren van formulier:', FORM_NAME);
  
  // Haal het schema op
  const schema = getFormSchema(FORM_NAME);
  
  // Controleer of schema bestaat
  if (!schema) {
    console.error(`[sollAlgemeenForm] Schema '${FORM_NAME}' niet gevonden in formSchemas.js!`);
    return;
  }
  
  // Laad eventueel bestaande flow data
  const flowData = loadFlowData('sollicitatie');
  console.log('[sollAlgemeenForm] Bestaande flow data:', flowData);
  
  // Laad ook global field data voor herbruikbare velden
  const globalData = {
    emailadres: loadGlobalFieldData('emailadres'),
    voornaam: loadGlobalFieldData('voornaam'),
    achternaam: loadGlobalFieldData('achternaam'),
    telefoon: loadGlobalFieldData('telefoon')
    // Woonplaats wordt niet automatisch ingevuld - elke sollicitant vult eigen woonplaats in
  };
  console.log('[sollAlgemeenForm] Global field data:', globalData);

  // Definieer de submit actie
  schema.submit = {
    action: async (formData) => {
      // formData wordt door formHandler meegegeven
      console.log('[sollAlgemeenForm] Submit action gestart met formData:', formData);
      
      try {
        // Map Webflow veldnamen naar API veldnamen
        const sollicitatieData = {
          geslacht: formData.sollalg_geslacht,
          geboortedatum: formData.sollalg_geboortedatum,
          voornaam: formData.sollalg_voornaam,
          achternaam: formData.sollalg_achternaam,
          woonplaats: formData.sollalg_woonplaats,
          telefoon: formData.sollalg_telefoon,
          ervaringmotivatie: formData.sollalg_ervaringmotivatie,
          emailadres: formData.sollalg_emailadres,
          wachtwoord: formData.sollalg_wachtwoord,
          akkoordVoorwaarden: formData.sollalg_akkoordVoorwaarden
        };

        console.log('[sollAlgemeenForm] Sollicitatie data voorbereid:', {
          ...sollicitatieData,
          wachtwoord: '[HIDDEN]' // Log wachtwoord nooit
        });
        
        // Verstuur sollicitatie via API
        const result = await submitSollicitatie(sollicitatieData);
        
        console.log('[sollAlgemeenForm] Sollicitatie succesvol verstuurd:', result);
        
        // Sla belangrijke velden op in global field data voor hergebruik
        saveGlobalFieldData('emailadres', sollicitatieData.emailadres);
        saveGlobalFieldData('voornaam', sollicitatieData.voornaam);
        saveGlobalFieldData('achternaam', sollicitatieData.achternaam);
        saveGlobalFieldData('telefoon', sollicitatieData.telefoon);
        // Woonplaats wordt niet als global data opgeslagen - dit is specifiek per sollicitatie
        
        // Sla flow data op voor eventuele vervolgstappen
        saveFlowData('sollicitatie', {
          sollicitatieId: result.data?.sollicitatieId,
          status: result.data?.status || 'nieuw',
          emailadres: sollicitatieData.emailadres,
          voornaam: sollicitatieData.voornaam,
          achternaam: sollicitatieData.achternaam,
          telefoon: sollicitatieData.telefoon,
          woonplaats: sollicitatieData.woonplaats,
          geslacht: sollicitatieData.geslacht,
          geboortedatum: sollicitatieData.geboortedatum,
          ervaringmotivatie: sollicitatieData.ervaringmotivatie,
          timestamp: new Date().toISOString()
        });
        
        return result; // Geef result terug aan formHandler
        
      } catch (error) {
        console.error('[sollAlgemeenForm] Sollicitatie fout:', error);
        
        // Gebruik de formUi helpers voor error display
        const formElement = formHandler.formElement;
        if (formElement) {
          showError(formElement, error.message || 'Er is een fout opgetreden bij het versturen van je sollicitatie.');
        }
        
        // Bepaal error code op basis van API response
        let errorCode = 'INTERNAL_ERROR';
        if (error.code) {
          errorCode = error.code;
        } else if (error.statusCode === 409) {
          errorCode = 'EMAIL_EXISTS';
        } else if (error.statusCode === 400) {
          errorCode = 'VALIDATION_ERROR';
        }
        
        // Gooi error met code voor formHandler
        const formError = new Error(error.message || 'Er is een fout opgetreden');
        formError.code = errorCode;
        throw formError;
      }
    },
    
    onSuccess: (result) => {
      console.log('[sollAlgemeenForm] Submit succesvol voltooid:', result);
      
      // Gebruik formUi helper om success te tonen
      const formElement = formHandler.formElement;
      if (formElement) {
        hideError(formElement); // Verberg eventuele eerdere errors
      }
      
      // Scroll naar top van pagina voor zichtbaarheid van success message
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      // Optioneel: Reset formulier na korte delay
      setTimeout(() => {
        if (formElement) {
          formElement.reset();
          console.log('[sollAlgemeenForm] Formulier gereset');
        }
      }, 3000); // Reset na 3 seconden
      
      // Optioneel: Redirect naar bedankpagina
      // setTimeout(() => {
      //   window.location.href = '/bedankt-sollicitatie';
      // }, 2000);
    },
    
    onError: (error) => {
      console.error('[sollAlgemeenForm] Submit error:', error);
      
      // Scroll naar top voor zichtbaarheid van error message
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      // FormHandler toont automatisch de foutmelding op basis van globalMessages in het schema
      // Aanvullende error handling kan hier toegevoegd worden indien nodig
    }
  };

  // Initialiseer form handler met schema
  formHandler.init(schema);
  
  // Formulier velden vooraf invullen als ze beschikbaar zijn in flowData of globalData
  const formElement = formHandler.formElement;
  if (formElement && (flowData || globalData)) {
    console.log('[sollAlgemeenForm] Vooraf invullen van formulier velden met flow data en global data...');
    
    // Vind alle relevante velden in het formulier
    const fields = {
      sollalg_geslacht: formElement.querySelector('[data-field-name="sollalg_geslacht"]'),
      sollalg_geboortedatum: formElement.querySelector('[data-field-name="sollalg_geboortedatum"]'),
      sollalg_voornaam: formElement.querySelector('[data-field-name="sollalg_voornaam"]'),
      sollalg_achternaam: formElement.querySelector('[data-field-name="sollalg_achternaam"]'),
      sollalg_woonplaats: formElement.querySelector('[data-field-name="sollalg_woonplaats"]'),
      sollalg_telefoon: formElement.querySelector('[data-field-name="sollalg_telefoon"]'),
      sollalg_ervaringmotivatie: formElement.querySelector('[data-field-name="sollalg_ervaringmotivatie"]'),
      sollalg_emailadres: formElement.querySelector('[data-field-name="sollalg_emailadres"]'),
      // Wachtwoord en akkoord worden bewust NIET vooraf ingevuld voor security
    };
    
    // Vul velden in met flow data of global data als ze bestaan (flow data heeft voorrang)
    Object.keys(fields).forEach(fieldName => {
      const fieldElement = fields[fieldName];
      let flowValue = flowData?.[fieldName];
      
      // Als er geen flow data is, gebruik global data voor specifieke velden
      if (!flowValue) {
        const globalFieldMap = {
          'sollalg_emailadres': 'emailadres',
          'sollalg_voornaam': 'voornaam', 
          'sollalg_achternaam': 'achternaam',
          'sollalg_telefoon': 'telefoon'
          // Woonplaats wordt bewust NIET automatisch ingevuld
        };
        const globalKey = globalFieldMap[fieldName];
        if (globalKey && globalData[globalKey]) {
          flowValue = globalData[globalKey];
        }
      }
      
      if (fieldElement && flowValue) {
        // Check het type element voor juiste behandeling
        if (fieldElement.type === 'radio') {
          // Voor radio buttons, zoek de juiste option
          const radioOption = formElement.querySelector(`input[name="${fieldName}"][value="${flowValue}"]`);
          if (radioOption) {
            radioOption.checked = true;
            console.log(`[sollAlgemeenForm] Radio veld '${fieldName}' ingevuld met waarde '${flowValue}'`);
          }
        } else if (fieldElement.type === 'checkbox') {
          // Voor checkboxes
          fieldElement.checked = Boolean(flowValue);
          console.log(`[sollAlgemeenForm] Checkbox veld '${fieldName}' ingevuld met waarde '${flowValue}'`);
        } else {
          // Voor text, email, date, textarea velden
          fieldElement.value = flowValue;
          console.log(`[sollAlgemeenForm] Tekst veld '${fieldName}' ingevuld met waarde '${flowValue}'`);
        }
        
        // Update ook de formData in de formHandler
        formHandler.formData[fieldName] = flowValue;
      }
    });
    
    console.log('[sollAlgemeenForm] Formulier velden succesvol vooraf ingevuld');
  }
  
  console.log('[sollAlgemeenForm] Formulier initialisatie voltooid');
}

// Automatische initialisatie wanneer pagina geladen is
document.addEventListener('DOMContentLoaded', () => {
  // Check of we op de sollicitatie pagina zijn
  const sollicitatieForm = document.querySelector(`[data-form-name="${FORM_NAME}"]`);
  if (sollicitatieForm) {
    console.log('[sollAlgemeenForm] Sollicitatie formulier gevonden, initialiseren...');
    initSollicitatieForm();
  }
});

// Export voor handmatige initialisatie indien nodig
export default initSollicitatieForm;
