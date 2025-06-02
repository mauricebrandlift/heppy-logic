# style-guide.md

## 🎨 Doel

Dit document beschrijft de JavaScript-stijlconventies voor het Heppy Schoonmaak-project. Het waarborgt consistentie, leesbaarheid en onderhoudbaarheid van de codebase.

## 🖋️ 1. Formatteringsregels

* **Inspringen**: 2 spaties, geen tabs.
* **Maximale lijnlengte**: 100 tekens.
* **Achtervoegende puntkomma’s (semicolons)**: altijd plaatsen.
* **Aanhalingstekens**: gebruik enkele quotes (`'…'`), tenzij de string een enkele quote bevat.
* **Trailing commas**: gebruik in object- en array-literals.
* **Spatiëring**:

  * Eén spatie na `function`, sleutelwoord en voor haakjes: `if (condition) {`.
  * Geen spatie binnen haakjes: `fn(arg1, arg2)`.

## 🔤 2. Naamgevingsconventies

* **Variabelen & functies**: `camelCase` (bijv. `validateField`).
* **Constanten**: `UPPER_SNAKE_CASE` (bijv. `API_BASE_URL`).
* **Classes & Constructors**: `PascalCase` (bijv. `FormValidator`).
* **Bestandsnamen**: `camelCase.js` (bijv. `formInputSanitizer.js`).
* **HTML data-attributen**: `kebab-case` (bijv. `data-form-name`).

## 📦 3. Import- en exportvolgorde

1. **Externe dependencies** (npm-pakketten).
2. **Absolute imports** (project-brede modules).
3. **Relative imports** (bestands- en mapniveau).

```js
// ☑️ Correct
import React from 'react';
import { getEnv } from '@/utils/config.js';
import { sanitize } from '../logic/formInputSanitizer.js';
```

## 🧹 4. Code-organisatie & modules

* **Één concept per bestand**: een bestand bevat idealiter één klasse of functie-gerelateerde set.
* **Consistente mappenstructuur**: volg `/forms/logic`, `/forms/validators`, `/forms/ui`, `/forms/schemas`, `/pages`, `/utils`.
* **Index-bestanden**: gebruik `index.js` om exports uit een map te centraliseren.

## 💬 5. Commentaar & documentatie

* **JSDoc**: documenteer alle publieke functies, methoden en klassen volgens `docs/js-documentation-standards.md`.
* **Inline comments**: kort en to-the-point, leg **waarom** iets gebeurt uit, niet **wat**.
* **TODOs**: markeer onvoltooide items met `// TODO: korte omschrijving`.

## 🔗 6. DOM-manipulatie & selectors

* **Vermijd vaste ID’s**: gebruik `data-` attributen voor selectors.
* **Gebruik querySelector** met `[data-field-name="…"]` ipv `getElementById`.
* **Cache DOM-referenties** in variabelen vóór in event-loops te voorkomen.

## 🔒 7. Security & performantietips

* **Sanitize inputs**: trim en escapen via `formInputSanitizer.js`.
* **Debounce zware events** (bijv. `input` op grote forms).
* **Lazy-load modules** wanneer mogelijk (dynamische `import()`).

---

*Gebruik deze stijlregels bij het schrijven en reviewen van alle JavaScript-code.*
