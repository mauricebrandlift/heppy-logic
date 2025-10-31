// public/forms/dieptereiniging/drPersoonsgegevensForm.js
// Formulier handling voor persoonsgegevens stap van de dieptereiniging aanvraag

import { formHandler } from '../logic/formHandler.js';
import { getFormSchema } from '../schemas/formSchemas.js';

const FORM_NAME = 'dr_persoonsgegevens-form';

/**
 * Initialiseert het persoonsgegevens formulier voor de dieptereiniging aanvraag.
 * Dit formulier verzamelt naam, email, telefoon en geboorte datum.
 */
export function initDrPersoonsgegevensForm() {
  console.log('[drPersoonsgegevensForm] Initialiseren van formulier:', FORM_NAME);
  
  // Haal het schema op
  const schema = getFormSchema(FORM_NAME);
  
  // Controleer of schema bestaat
  if (!schema) {
    console.error(`[drPersoonsgegevensForm] Schema '${FORM_NAME}' niet gevonden in formSchemas.js!`);
    return;
  }
  
  // TODO: Implementeren in latere stap (kan waarschijnlijk hergebruiken van abonnement flow)
  console.log(`[drPersoonsgegevensForm] Formulier '${FORM_NAME}' - nog te implementeren`);
}
