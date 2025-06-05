// public/forms/ui/templateRenderer.js
/**
 * 🔄 Template Renderer
 * =======================
 * Dit bestand bevat functies voor het klonen en invullen van Webflow templates.
 * Het maakt het eenvoudig om dynamische content in te vullen in vooraf ontworpen 
 * Webflow elementen op basis van data-attributen.
 */

/**
 * Kloont en vult een template met data op basis van mappings
 * 
 * @param {string} templateSelector - CSS selector voor het template element 
 * @param {Object} data - Data object met waarden om in te vullen
 * @param {Object} [mappings] - Optionele aangepaste mappings voor specifieke velden
 * @returns {HTMLElement} - De gevulde kloon van het template
 * 
 * @example
 * // Basis gebruik:
 * const userCard = renderTemplateClone('#user-card-template', {
 *   naam: 'Jan',
 *   profiel_foto: 'https://example.com/jan.jpg',
 *   bio: 'Frontend ontwikkelaar'
 * });
 * container.appendChild(userCard);
 * 
 * // Met aangepaste mappings:
 * const productCard = renderTemplateClone('#product-template', productData, {
 *   prijsFormatted: (el, waarde) => el.textContent = `€${waarde.toFixed(2)}`,
 *   uitverkocht: (el, isUitverkocht) => el.style.display = isUitverkocht ? 'block' : 'none'
 * });
 */
export function renderTemplateClone(templateSelector, data, mappings = {}) {
  // Vind het template
  const template = document.querySelector(templateSelector);
  if (!template) {
    console.error(`❌ [TemplateRenderer] Template niet gevonden: ${templateSelector}`);
    return null;
  }
  
  // Kloon het template
  const clone = template.cloneNode(true);
  clone.removeAttribute('id'); // Verwijder id om duplicatie te voorkomen
  clone.style.display = ''; // Maak het element zichtbaar
  
  // Vul het template met data
  fillTemplateWithData(clone, data, mappings);
  
  return clone;
}

/**
 * Vult een template element met data op basis van data-attributen
 * 
 * @param {HTMLElement} element - Het element om te vullen
 * @param {Object} data - Data object met waarden
 * @param {Object} mappings - Aangepaste mappings voor specifieke velden
 */
export function fillTemplateWithData(element, data, mappings = {}) {
  if (!element || !data) return;
  
  // Zoek alle elementen met data-attributen
  processElement(element, data, mappings);
  
  // Zoek in alle child elementen
  const allChildren = element.querySelectorAll('*');
  allChildren.forEach(child => {
    processElement(child, data, mappings);
  });
}

/**
 * Verwerkt een individueel element en vult het in met data
 * 
 * @param {HTMLElement} element - Het element om te vullen
 * @param {Object} data - De data om in te vullen
 * @param {Object} mappings - Aangepaste mappings voor specifieke velden
 */
function processElement(element, data, mappings) {
  // Vind alle attributes die met 'data-' beginnen
  const dataAttributes = [...element.attributes]
    .filter(attr => attr.name.startsWith('data-') && !attr.name.includes('field-name'))
    .map(attr => attr.name);
  
  dataAttributes.forEach(attrName => {
    // Haal de data key op uit het attribute (bijv. data-naam -> naam)
    const dataKey = attrName.replace('data-', '');
    
    // Als we een mapping hebben voor deze key, gebruik die
    if (mappings[dataKey] && typeof mappings[dataKey] === 'function') {
      mappings[dataKey](element, data[dataKey], data);
      return;
    }
    
    // Skip als de data ontbreekt
    if (data[dataKey] === undefined) return;
    
    // Default gedrag per element type
    applyDefaultMapping(element, dataKey, data[dataKey]);
  });
  
  // Verwerk elementen met data-bind attribuut (voor algemene binding)
  const bindAttr = element.getAttribute('data-bind');
  if (bindAttr && data[bindAttr] !== undefined) {
    if (mappings[bindAttr] && typeof mappings[bindAttr] === 'function') {
      mappings[bindAttr](element, data[bindAttr], data);
    } else {
      applyDefaultMapping(element, bindAttr, data[bindAttr]);
    }
  }
  
  // Verwerk elementen met data-template-items (voor lijsten)
  const itemsAttr = element.getAttribute('data-template-items');
  if (itemsAttr && Array.isArray(data[itemsAttr])) {
    processItemsList(element, data[itemsAttr], itemsAttr, mappings);
  }
}

/**
 * Past de standaard mapping toe op basis van element type
 * 
 * @param {HTMLElement} element - Het element om te vullen
 * @param {string} key - De data key
 * @param {*} value - De waarde om in te vullen
 */
function applyDefaultMapping(element, key, value) {
  const tagName = element.tagName.toLowerCase();
  
  switch (tagName) {
    case 'img':
      element.src = value;
      if (!element.alt) element.alt = key;
      break;
      
    case 'a':
      element.href = value;
      break;
      
    case 'input':
      if (element.type === 'checkbox' || element.type === 'radio') {
        element.checked = Boolean(value);
      } else {
        element.value = value;
      }
      break;
      
    case 'select':
      element.value = value;
      break;
      
    case 'textarea':
      element.value = value;
      break;
      
    default:
      // Voor alle andere elementen, gebruik textContent
      element.textContent = value;
      break;
  }
}

/**
 * Verwerkt een lijst van items in een container element
 * 
 * @param {HTMLElement} container - Het container element
 * @param {Array} items - De lijst met items
 * @param {string} itemsKey - De key waarmee de items zijn aangeduid
 * @param {Object} mappings - Aangepaste mappings
 */
function processItemsList(container, items, itemsKey, mappings) {
  // Bewaar de originele container inhoud als template
  const template = container.innerHTML;
  
  // Leeg de container
  container.innerHTML = '';
  
  // Voor elk item, voeg een nieuw element toe op basis van template
  items.forEach((item, index) => {
    // Maak een tijdelijk element om het template in te klonen
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = template;
    
    // Als het item een object is, vul de template met de object properties
    if (item && typeof item === 'object') {
      fillTemplateWithData(tempContainer, item, mappings);
    } else {
      // Anders gebruik het item zelf als waarde
      const valueElements = tempContainer.querySelectorAll('[data-value]');
      valueElements.forEach(el => el.textContent = item);
    }
    
    // Voeg index toe aan data voor eventueel gebruik
    const indexElements = tempContainer.querySelectorAll('[data-index]');
    indexElements.forEach(el => el.textContent = index + 1);
    
    // Voeg de inhoud toe aan de container
    while (tempContainer.firstChild) {
      container.appendChild(tempContainer.firstChild);
    }
  });
}

/**
 * Uitbreidbare functie voor het renderen van schoonmaker elementen
 * Maakt gebruik van renderTemplateClone intern
 * 
 * @param {Object} schoonmaker - Schoonmaker data
 * @param {string} templateSelector - CSS selector voor het template element
 * @returns {HTMLElement} - Het gevulde schoonmaker element
 */
export function renderSchoonmakerElement(schoonmaker, templateSelector = '[data-render-element="schoonmaker"]') {
  // Voorbewerking van data indien nodig
  const schoonmakerData = {
    ...schoonmaker,
    // Voeg eventuele afgeleide data toe
    voornaamKort: schoonmaker.voornaam ? schoonmaker.voornaam.split(' ')[0] : '',
    heeftFoto: !!schoonmaker.profielfoto
  };
  
  // Aangepaste mappings voor schoonmaker specifieke velden
  const mappings = {
    // Voorbeeld: formatteren van rating
    rating: (el, rating) => {
      el.textContent = rating ? rating.toFixed(1) : '0.0';
    },
    
    // Voorbeeld: conditoneel tonen van afstand
    afstand_tekst: (el, afstandTekst, data) => {
      if (afstandTekst) {
        el.textContent = afstandTekst;
        el.style.display = 'block';
      } else {
        el.style.display = 'none';
      }
    }
  };
  
  return renderTemplateClone(templateSelector, schoonmakerData, mappings);
}
