/**
 * @file Bevat herbruikbare keydown event handlers voor input filtering.
 * Deze functies worden gebruikt om de invoer van gebruikers in formuliervelden direct te beperken
 * tot toegestane tekens, nog voordat de `change` of `input` events afgaan.
 */

/**
 * Staat alleen cijfers toe en basis control/navigatie toetsen.
 * @param {KeyboardEvent} event - Het keydown event object.
 */
function handleDigitsOnlyKeyDown(event) {
  const key = event.key;
  // Toestaan: speciale toetsen (Backspace, Delete, Tab, Escape, Enter), pijltjestoetsen, Home, End.
  // Toestaan: Ctrl/Cmd + A, C, V, X, Z (standaard browsergedrag voor selecteren, kopiëren, plakken, etc.).
  if (event.metaKey || event.ctrlKey || ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key)) {
    return; // Toets toestaan
  }
  // Alleen cijfers toestaan voor enkelvoudige karakterinvoer.
  if (key.length === 1 && !/^\d$/.test(key)) {
    event.preventDefault(); // Voorkom invoer als het geen cijfer is.
  }
}

/**
 * Filtert input voor een postcodeveld (NNNNLL) tijdens de 'keydown' gebeurtenis.
 * Deze functie probeert ongeldige tekens te voorkomen voordat ze daadwerkelijk
 * in het inputveld verschijnen.
 * @param {KeyboardEvent} event - Het keydown event object.
 */
function handlePostcodeKeyDown(event) {
  const target = event.target;
  /** @type {string | undefined} */
  const key = event.key; // De ingedrukte toets. Kan undefined zijn, bijv. bij browser autofill.
  const value = target.value; // De huidige waarde van het inputveld.
  const selectionStart = target.selectionStart; // Startpositie van de selectie.
  const selectionEnd = target.selectionEnd; // Eindpositie van de selectie.

  // Toegestane speciale toetsen en combinaties (bijv. Backspace, Delete, Ctrl+A).
  // Deze moeten altijd werken, ongeacht de input of cursorpositie.
  // De .includes(key) check is veilig, zelfs als 'key' undefined is (resulteert dan in false).
  if (
    event.metaKey || // Cmd-toets op Mac
    event.ctrlKey || // Ctrl-toets op Windows/Linux
    [
      'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
      'Home', 'End'
    ].includes(key)
  ) {
    return; // Toets toestaan, geen preventDefault().
  }

  // Voorkom verdere invoer van een enkel karakter als de maximale lengte (6) is bereikt
  // en er geen tekst is geselecteerd (d.w.z. de gebruiker probeert een karakter toe te voegen).
  // Belangrijk: controleer eerst of 'key' gedefinieerd is en een lengte van 1 heeft.
  if (key && key.length === 1 && value.length >= 6 && selectionStart === selectionEnd) {
    // console.log(`[InputFilter] Postcode: Maximale lengte bereikt voor enkele toetsaanslag '${key}'. Actie voorkomen.`);
    event.preventDefault();
    return;
  }

  // Verwerk alleen enkelvoudige karakterinvoer.
  // Als 'key' undefined is (bijv. bij autofill), of als het een speciale toets is
  // die niet hierboven is afgehandeld (bijv. "Shift", "AltGraph"), slaan we deze logica over.
  // De 'change' event en sanitizeField in formHandler.js zullen de uiteindelijke waarde afhandelen.
  if (key && key.length === 1) {
    const nextCharPosition = selectionStart; // De positie waar het nieuwe karakter zou komen.

    if (nextCharPosition < 4) { // Eerste vier posities (index 0-3): moeten cijfers zijn.
      if (!/^\d$/.test(key)) {
        // console.log(`[InputFilter] Postcode: Ongeldig karakter '${key}' op numerieke positie ${nextCharPosition}. Actie voorkomen.`);
        event.preventDefault();
      }
    } else if (nextCharPosition < 6) { // Laatste twee posities (index 4-5): moeten letters zijn.
      if (!/^[a-zA-Z]$/.test(key)) {
        // console.log(`[InputFilter] Postcode: Ongeldig karakter '${key}' op letterpositie ${nextCharPosition}. Actie voorkomen.`);
        event.preventDefault();
      }
    } else {
      // Poging om een karakter in te voeren na de maximale lengte van 6.
      // Dit zou al door de eerdere check (value.length >= 6) moeten zijn afgevangen,
      // maar als extra veiligheidsmaatregel.
      // console.log(`[InputFilter] Postcode: Poging om karakter '${key}' buiten maximale lengte in te voeren. Actie voorkomen.`);
      event.preventDefault();
    }
  } else if (key === undefined) {
    // 'key' is undefined. Dit kan een browser autofill zijn of een andere programmatische wijziging.
    // We doen hier expliciet niets en roepen event.preventDefault() NIET aan.
    // Dit staat de browser toe om de autofill-actie uit te voeren.
    // De 'change' event handler (formHandler.js -> handleInput) zal de volledige,
    // mogelijk automatisch ingevulde, waarde later valideren en sanitizen.
    // console.log(`[InputFilter] Postcode: 'key' is undefined tijdens keydown. Waarschijnlijk autofill/programmatische wijziging. Huidige waarde: '${value}'`);
  }
  // Als 'key' wel gedefinieerd is, maar geen lengte van 1 heeft (bijv. "Shift", "Control", "AltGraph"),
  // wordt hier ook niets gedaan, wat correct is. Deze toetsen wijzigen de inputwaarde niet direct.
}

/**
 * Object dat de beschikbare input filter functies exporteert.
 * De sleutels in dit object moeten overeenkomen met de `inputFilter` waardes
 * die in de formulier schema's (commonFields.js of specifieke formSchemas.js) worden gebruikt.
 */
export const inputFilters = {
  digitsOnly: handleDigitsOnlyKeyDown,
  postcode: handlePostcodeKeyDown,
  // Voeg hier eventueel meer filters toe, bijvoorbeeld:
  // textOnly: handleTextOnlyKeyDown,
  // alphaNumeric: handleAlphaNumericKeyDown,
};
