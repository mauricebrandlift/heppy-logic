/**
 * Email Template Registry
 * 
 * Centrale export voor alle email templates.
 * Importeer templates via deze file voor consistentie.
 * 
 * Gebruik:
 * import { templates } from './api/templates/emails/index.js';
 * const html = templates.nieuweAanvraagAdmin(data);
 */

// Payment Flow Templates - Abonnement
export { nieuweAanvraagAdmin } from './nieuweAanvraagAdmin.js';
export { betalingBevestigingKlant } from './betalingBevestigingKlant.js';
export { matchToegewezenSchoonmaker } from './matchToegewezenSchoonmaker.js';

// Payment Flow Templates - Dieptereiniging
export { nieuweDieptereinigingAdmin } from './nieuweDieptereinigingAdmin.js';
export { dieptereinigingBevestigingKlant } from './dieptereinigingBevestigingKlant.js';
export { dieptereinigingToegewezenSchoonmaker } from './dieptereinigingToegewezenSchoonmaker.js';

// Payment Flow Templates - Verhuis-/Opleverschoonmaak
export { nieuweVerhuisAdmin } from './nieuweVerhuisAdmin.js';
export { verhuisBevestigingKlant } from './verhuisBevestigingKlant.js';
export { verhuisToegewezenSchoonmaker } from './verhuisToegewezenSchoonmaker.js';

// Approve/Reject Flow Templates
export { matchGoedgekeurdKlant } from './matchGoedgekeurdKlant.js';
export { matchAfgewezenAdmin } from './matchAfgewezenAdmin.js';
export { geenSchoonmakerBeschikbaarKlant } from './geenSchoonmakerBeschikbaarKlant.js';

// Helper functions
export { 
  baseLayout, 
  formatDatum, 
  formatBedrag, 
  formatDagdelen 
} from './baseLayout.js';

/**
 * Template registry object voor dynamische template selectie
 */
export const templates = {
  // Payment Flow - Abonnement
  nieuweAanvraagAdmin: (await import('./nieuweAanvraagAdmin.js')).nieuweAanvraagAdmin,
  betalingBevestigingKlant: (await import('./betalingBevestigingKlant.js')).betalingBevestigingKlant,
  matchToegewezenSchoonmaker: (await import('./matchToegewezenSchoonmaker.js')).matchToegewezenSchoonmaker,
  
  // Payment Flow - Dieptereiniging
  nieuweDieptereinigingAdmin: (await import('./nieuweDieptereinigingAdmin.js')).nieuweDieptereinigingAdmin,
  dieptereinigingBevestigingKlant: (await import('./dieptereinigingBevestigingKlant.js')).dieptereinigingBevestigingKlant,
  dieptereinigingToegewezenSchoonmaker: (await import('./dieptereinigingToegewezenSchoonmaker.js')).dieptereinigingToegewezenSchoonmaker,
  
  // Payment Flow - Verhuis-/Opleverschoonmaak
  nieuweVerhuisAdmin: (await import('./nieuweVerhuisAdmin.js')).nieuweVerhuisAdmin,
  verhuisBevestigingKlant: (await import('./verhuisBevestigingKlant.js')).verhuisBevestigingKlant,
  verhuisToegewezenSchoonmaker: (await import('./verhuisToegewezenSchoonmaker.js')).verhuisToegewezenSchoonmaker,
  
  // Approve/Reject Flow
  matchGoedgekeurdKlant: (await import('./matchGoedgekeurdKlant.js')).matchGoedgekeurdKlant,
  matchAfgewezenAdmin: (await import('./matchAfgewezenAdmin.js')).matchAfgewezenAdmin,
  geenSchoonmakerBeschikbaarKlant: (await import('./geenSchoonmakerBeschikbaarKlant.js')).geenSchoonmakerBeschikbaarKlant,
};

/**
 * Render een template met data
 * 
 * @param {string} templateName - Naam van de template
 * @param {Object} data - Template data
 * @returns {string} HTML string
 * @throws {Error} Als template niet bestaat
 * 
 * @example
 * const html = renderTemplate('nieuweAanvraagAdmin', { 
 *   klantNaam: 'Jan',
 *   plaats: 'Amsterdam',
 *   ...
 * });
 */
export function renderTemplate(templateName, data) {
  const template = templates[templateName];
  
  if (!template) {
    throw new Error(`Template "${templateName}" niet gevonden. Beschikbare templates: ${Object.keys(templates).join(', ')}`);
  }
  
  return template(data);
}
