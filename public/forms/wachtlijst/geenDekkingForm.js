// public/forms/wachtlijst/geenDekkingForm.js
// Formulierlogica voor de geen-dekking wachtlijst.

import { formHandler } from '../logic/formHandler.js';
import { getFormSchema } from '../schemas/formSchemas.js';
import { loadFlowData, loadGlobalFieldData } from '../logic/formStorage.js';
import { submitWaitlistEntry, ApiError } from '../../utils/api/index.js';

const FORM_NAME = 'geen-dekking_form';

function prefillReadOnlyField(formElement, fieldName, value) {
  if (!formElement || !value) return;
  const field = formElement.querySelector(`[data-field-name="${fieldName}"]`);
  if (!field) return;
  field.value = value;
  formHandler.formData[fieldName] = value;
}

export function initGeenDekkingForm() {
  console.log(`[GeenDekkingForm] Initialiseren van formulier: ${FORM_NAME}`);

  const schema = getFormSchema(FORM_NAME);
  if (!schema) {
    console.error(`[GeenDekkingForm] Schema '${FORM_NAME}' niet gevonden in formSchemas.js.`);
    return;
  }

  const flowData = loadFlowData('abonnement-aanvraag') || {};
  const defaultPlaats = flowData.plaats || loadGlobalFieldData('plaats') || '';
  const defaultStraat = flowData.straat || flowData.straatnaam || loadGlobalFieldData('straat') || loadGlobalFieldData('straatnaam') || '';

  schema.submit = {
    action: async (formData) => {
      console.log('[GeenDekkingForm] Submit action gestart met formData:', formData);
      try {
        await submitWaitlistEntry({
          naam: formData.naam,
          emailadres: formData.emailadres,
          plaats: formData.plaats,
          straat: formData.straat,
        });
      } catch (error) {
        console.error('[GeenDekkingForm] Fout tijdens submit action:', error);
        if (error instanceof ApiError) {
          if (!error.code) {
            if (error.status === 409 || error.data?.code === 'DUPLICATE_ENTRY') {
              error.code = 'DUPLICATE_ENTRY';
            } else if (error.data?.code) {
              error.code = error.data.code;
            } else if (error.status >= 500) {
              error.code = 'SERVER_ERROR';
            } else {
              error.code = 'DEFAULT';
            }
          }
        }
        throw error;
      }
    },
    onSuccess: () => {
      console.log('[GeenDekkingForm] Wachtlijst-aanvraag succesvol verwerkt.');
      formHandler.showSuccessState(FORM_NAME, {
        messageAttributeValue: FORM_NAME,
        successDisplay: 'flex',
        hideForm: true,
      });
    }
  };

  formHandler.init(schema);

  const formElement = document.querySelector(schema.selector);
  if (!formElement) {
    console.warn(`[GeenDekkingForm] Form element ${schema.selector} niet gevonden.`);
    return;
  }

  prefillReadOnlyField(formElement, 'plaats', defaultPlaats);
  prefillReadOnlyField(formElement, 'straat', defaultStraat);

  formHandler.updateSubmitState(FORM_NAME);

  console.log(`[GeenDekkingForm] Formulier '${FORM_NAME}' is succesvol geïnitialiseerd.`);
}
