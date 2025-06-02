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
 * Filtert input voor een postcodeveld (Nederlands formaat NNNNLL).
 * Staat alleen cijfers toe op de eerste 4 posities en letters op de laatste 2.
 * @param {KeyboardEvent} event - Het keydown event object.
 */
function handlePostcodeKeyDown(event) {
  const target = event.target;
  const key = event.key;
  const value = target.value;
  const selectionStart = target.selectionStart;
  const selectionEnd = target.selectionEnd;

  // Toestaan: speciale toetsen en Ctrl/Cmd shortcuts.
  if (event.metaKey || event.ctrlKey || ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key)) {
    return; // Toets toestaan
  }

  // Voorkom invoer als de maximale lengte (6) is bereikt en er geen tekst is geselecteerd
  // (d.w.z. de gebruiker probeert een karakter toe te voegen aan een volle input).
  // De maxlength wordt ook op het element zelf gezet via formHandler.js voor extra robuustheid.
  if (value.length >= 6 && selectionStart === selectionEnd && key.length === 1) {
    event.preventDefault();
    return;
  }

  // Alleen reageren op enkelvoudige karakterinvoer (geen functietoetsen die als 'key' een langere string hebben).
  if (key.length === 1) {
    const nextCharPosition = selectionStart; // Positie waar het nieuwe karakter zou komen te staan.

    if (nextCharPosition < 4) { // Eerste 4 posities: alleen cijfers.
      if (!/^\d$/.test(key)) {
        event.preventDefault(); // Voorkom invoer als het geen cijfer is.
      }
    } else if (nextCharPosition < 6) { // Positie 5 en 6: alleen letters.
      if (!/^[a-zA-Z]$/.test(key)) {
        event.preventDefault(); // Voorkom invoer als het geen letter is.
      }
    } else { 
      // Meer dan 6 tekens proberen in te voeren.
      // Dit zou al door de check hierboven en/of maxlength attribuut geblokkeerd moeten zijn,
      // maar als extra veiligheid: voorkom invoer na de 6e positie.
      event.preventDefault();
    }
  }
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
