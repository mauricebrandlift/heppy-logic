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

export { nieuweAanvraagAdmin } from './nieuweAanvraagAdmin.js';
export { betalingBevestigingKlant } from './betalingBevestigingKlant.js';
export { matchToegewezenSchoonmaker } from './matchToegewezenSchoonmaker.js';

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
  nieuweAanvraagAdmin: (await import('./nieuweAanvraagAdmin.js')).nieuweAanvraagAdmin,
  betalingBevestigingKlant: (await import('./betalingBevestigingKlant.js')).betalingBevestigingKlant,
  matchToegewezenSchoonmaker: (await import('./matchToegewezenSchoonmaker.js')).matchToegewezenSchoonmaker,
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
