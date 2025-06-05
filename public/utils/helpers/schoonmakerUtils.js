// public/utils/helpers/schoonmakerUtils.js
/**
 * 🧰 Helper functies voor het werken met schoonmakers
 * ==================================================
 * Deze module bevat utilities voor:
 * - Berekening van afstand tussen coördinaten
 * - Sorteren van schoonmakers op basis van rating en afstand
 */

/**
 * 📍 Berekent de afstand in kilometers tussen twee coördinaten met de Haversine-formule.
 * 
 * @param {number} lat1 - Latitude van punt 1 (gebruiker)
 * @param {number} lon1 - Longitude van punt 1 (gebruiker)
 * @param {number} lat2 - Latitude van punt 2 (schoonmaker)
 * @param {number} lon2 - Longitude van punt 2 (schoonmaker)
 * @returns {number} De afstand in kilometers
 */
export function berekenAfstandKm(lat1, lon1, lat2, lon2) {
  // Valideer de input parameters
  if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
    console.warn('⚠️ Ongeldige coördinaten voor afstandsberekening:', { lat1, lon1, lat2, lon2 });
    return Infinity; // Retourneer Infinity om deze punten achteraan in de sortering te plaatsen
  }

  // Converteer graden naar radialen
  const toRad = (x) => x * Math.PI / 180;
  
  // Aardradius in kilometers
  const R = 6371;
  
  // Bereken verschillen in radialen
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  // Haversine formule
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const afstand = R * c;
  
  return afstand;
}

/**
 * 🔄 Verrijkt schoonmaker objecten met afstandsinformatie
 * 
 * @param {Array} schoonmakers - Array van schoonmaker objecten
 * @param {number} userLat - Gebruiker latitude
 * @param {number} userLon - Gebruiker longitude
 * @returns {Array} Schoonmakers met afstandsinformatie
 */
export function verrijkMetAfstand(schoonmakers, userLat, userLon) {
  if (!Array.isArray(schoonmakers)) {
    console.warn('⚠️ verrijkMetAfstand: schoonmakers is geen array');
    return [];
  }
  
  if (isNaN(userLat) || isNaN(userLon)) {
    console.warn('⚠️ verrijkMetAfstand: ongeldige gebruiker coördinaten', { userLat, userLon });
    return schoonmakers;
  }

  return schoonmakers.map(schoonmaker => {
    // Bereken afstand
    const afstand = berekenAfstandKm(
      userLat, userLon,
      schoonmaker.latitude, schoonmaker.longitude
    );
    
    // Voeg leesbare afstand toe
    let afstandTekst;
    if (afstand < 1) {
      afstandTekst = `${Math.round(afstand * 1000)} meter`;
    } else if (afstand < 10) {
      afstandTekst = `${afstand.toFixed(1)} km`;
    } else {
      afstandTekst = `${Math.round(afstand)} km`;
    }
    
    // Retourneer verrijkt object
    return {
      ...schoonmaker,
      afstand_km: afstand,
      afstand_tekst: afstandTekst
    };
  });
}

/**
 * 📊 Sorteert schoonmakers op basis van rating en afstand met de volgende prioriteit:
 * 1. Tot 5 schoonmakers met rating >= 4.0 (gesorteerd op afstand)
 * 2. Aangevuld met schoonmakers met rating >= 3.0 (gesorteerd op afstand)
 * 3. De rest (gesorteerd op rating, bij gelijke rating op afstand)
 * 
 * @param {Array} schoonmakers - Array van verrijkte schoonmaker objecten met afstand_km
 * @returns {Array} Gesorteerde array van schoonmakers
 */
export function sorteerSchoonmakers(schoonmakers) {
  if (!Array.isArray(schoonmakers) || schoonmakers.length === 0) {
    return [];
  }
  
  // Verdeel in groepen op basis van rating
  const groepA = schoonmakers.filter(s => s.rating >= 4);
  const groepB = schoonmakers.filter(s => s.rating >= 3 && s.rating < 4);
  const groepC = schoonmakers.filter(s => s.rating < 3 || s.rating === null);
  
  // Sorteer elke groep op afstand
  const sorteerOpAfstand = (a, b) => a.afstand_km - b.afstand_km;
  
  // Sorteer groep C primair op rating (als aanwezig) en secundair op afstand
  const sorteerOpRatingEnAfstand = (a, b) => {
    // Als ratings gelijk zijn of een van beide null, sorteer op afstand
    if (a.rating === b.rating || a.rating === null || b.rating === null) {
      return a.afstand_km - b.afstand_km;
    }
    // Anders sorteer op rating (hoog naar laag)
    return b.rating - a.rating;
  };
  
  // Sorteer groepen
  const sortedA = groepA.sort(sorteerOpAfstand);
  const sortedB = groepB.sort(sorteerOpAfstand);
  const sortedC = groepC.sort(sorteerOpRatingEnAfstand);
  
  // Neem maximaal 5 van groep A
  const topA = sortedA.slice(0, 5);
  
  // Combineer resultaten in de gewenste volgorde
  return [...topA, ...sortedB, ...sortedC];
}

/**
 * 🔍 Hoofdfunctie: Verrijkt en sorteert schoonmakers in één operatie
 * 
 * @param {Array} schoonmakers - Ruwe array van schoonmakers van de API
 * @param {number} userLat - Gebruiker latitude
 * @param {number} userLon - Gebruiker longitude
 * @returns {Array} Verrijkte en gesorteerde schoonmakers
 */
export function verwerkSchoonmakers(schoonmakers, userLat, userLon) {
  // Voeg afstand toe
  const verrijkt = verrijkMetAfstand(schoonmakers, userLat, userLon);
  
  // Sorteer volgens criteria
  return sorteerSchoonmakers(verrijkt);
}
