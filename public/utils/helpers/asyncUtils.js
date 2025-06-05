// public/utils/helpers/asyncUtils.js
/**
 * 🔄 Algemene asynchrone helpers en utilities
 * ==========================================
 * Functies voor het efficiënter werken met async/timers
 */

/**
 * Creëert een gedebounced versie van een functie die alleen wordt uitgevoerd
 * na een bepaalde wachttijd zonder nieuwe aanroepen.
 * 
 * @param {Function} func - De functie die gedebounced moet worden
 * @param {number} wachtTijd - Wachttijd in milliseconden
 * @returns {Function} - De gedebounced versie van de functie
 */
export function debounce(func, wachtTijd = 300) {
  let timerId;
  
  return function(...args) {
    // 'this' context opslaan
    const context = this;
    
    // Reset de timer bij elke aanroep
    clearTimeout(timerId);
    
    // Start een nieuwe timer
    timerId = setTimeout(() => {
      func.apply(context, args);
    }, wachtTijd);
  };
}

/**
 * Wacht een bepaalde tijd voordat een Promise wordt opgelost
 * 
 * @param {number} ms - Wachttijd in milliseconden 
 * @returns {Promise<void>} - Een Promise die na de opgegeven tijd wordt opgelost
 */
export function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Voert een functie uit met een automatische retry bij falen
 * 
 * @param {Function} fn - De functie om uit te voeren (moet een Promise teruggeven)
 * @param {Object} options - Configuratie-opties
 * @param {number} options.maxPogingen - Maximaal aantal pogingen (standaard 3)
 * @param {number} options.wachtTijdMs - Wachttijd tussen pogingen in ms (standaard 1000)
 * @param {Function} options.retryVoorwaarde - Functie die bepaalt of retry nodig is (krijgt error als parameter)
 * @returns {Promise<any>} - Het resultaat van de functie of een fout na alle pogingen
 */
export async function metRetry(fn, {
  maxPogingen = 3,
  wachtTijdMs = 1000,
  retryVoorwaarde = () => true
} = {}) {
  let laatsteFout;
  
  for (let poging = 1; poging <= maxPogingen; poging++) {
    try {
      return await fn();
    } catch (error) {
      laatsteFout = error;
      
      // Controleer of we moeten retrien
      if (poging < maxPogingen && retryVoorwaarde(error)) {
        console.log(`Poging ${poging} mislukt, nieuwe poging over ${wachtTijdMs}ms...`);
        await wait(wachtTijdMs);
        // Exponentiële backoff voor volgende poging
        wachtTijdMs *= 2; 
      } else {
        break;
      }
    }
  }
  
  throw laatsteFout;
}
