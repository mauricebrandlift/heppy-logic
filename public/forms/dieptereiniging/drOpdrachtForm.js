// public/forms/dieptereiniging/drOpdrachtForm.js
// Formulier handling voor stap 2 van de dieptereiniging aanvraag: opdracht details

import { formHandler } from '../logic/formHandler.js';
import { getFormSchema } from '../schemas/formSchemas.js';

const FORM_NAME = 'dr_opdracht-form';

/**
 * Initialiseert het opdracht formulier voor de dieptereiniging aanvraag.
 * Dit formulier verzamelt gewenste datum, aantal uren, en berekent de prijs.
 */
export function initDrOpdrachtForm() {
  console.log('[drOpdrachtForm] Initialiseren van formulier:', FORM_NAME);
  
  // Haal het schema op
  const schema = getFormSchema(FORM_NAME);
  
  // Controleer of schema bestaat
  if (!schema) {
    console.error(`[drOpdrachtForm] Schema '${FORM_NAME}' niet gevonden in formSchemas.js!`);
    return;
  }
  
  // TODO: Implementeren in volgende stap
  console.log(`[drOpdrachtForm] Formulier '${FORM_NAME}' - nog te implementeren`);
}
