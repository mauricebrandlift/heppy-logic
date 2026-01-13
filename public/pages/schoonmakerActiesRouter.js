/**
 * Schoonmaker Acties Router
 * 
 * Detecteert de huidige URL en laadt de gecombineerde schoonmaak actie pagina voor:
 * - Aanvraag/Opdracht goedkeuren of afkeuren (via mail)
 * 
 * URL format: /schoonmaak-actie?match_id=xxx&action=approve
 * 
 * Wordt automatisch geladen op elke pagina via sitePage.js
 */

import { initSchoonmaakActiePage } from './schoonmaakActiePage.js';

document.addEventListener('DOMContentLoaded', () => {
  const pathname = window.location.pathname;

  // Check voor schoonmaak actie page (universeel voor approve/decline)
  if (pathname.includes('/schoonmaak-actie') || document.querySelector('[data-page="schoonmaak-actie"]')) {
    console.log('[schoonmakerActiesRouter] Loading schoonmaak actie page...');
    initSchoonmaakActiePage();
  }
});
