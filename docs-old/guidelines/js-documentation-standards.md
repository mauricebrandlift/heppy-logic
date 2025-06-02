# js-documentation-standards.md

## 🎯 Doel

Dit document beschrijft de richtlijnen voor JavaScript-documentatie in het Heppy Schoonmaak-project. Goede docs zorgen dat:

* 🤖 AI-assistenten (ChatGPT/Copilot) en nieuwe teamleden snel begrijpen wat een module of functie doet.
* 🔍 Consistentie in commentaar en structuur behouden blijft.
* 🖼️ **Gebruik passende iconen** voor elke sectie en belangrijke items om de leesbaarheid te verhogen (bijv. 🏷️ voor bestandsheader, 🔨 voor functies, 📦 voor klassen, 💬 voor inline commentaar, 🔗 voor links, ✅ voor best practices).

## 🏷️ 1. Bestandsheader## 🏷️ 1. Bestandsheader

Aan het begin van elk `.js`-bestand:

```js
/**
 * @file <relative/path/to/file.js>
 * @description Korte omschrijving van de module en zijn verantwoordelijkheden.
 * @module <moduleName>
 * @author <Naam>
 * @version 1.0.0
 */
```

## 🔨 2. Functie- en methode-documentatie

Gebruik JSDoc-stijl boven elke export:

```js
/**
 * @function <functionName>
 * @description Beschrijving van wat de functie doet.
 * @param {<type>} <name> - Omschrijving van de parameter.
 * @param {<type>=} [<name>=<default>] - Optionele parameter met default.
 * @returns {<type>} Beschrijving van de return-waarde.
 * @throws {<ErrorType>} Beschrijving van wanneer de functie een fout gooit.
 * @example
 * // Voorbeeld:
 * const result = <functionName>(arg1, arg2);
 */
export function <functionName>(<params>) {
  // ...
}
```

## 📦 3. Klassen en objecten

```js
/**
 * @class <ClassName>
 * @description Beschrijving van de klasse.
 */
export class <ClassName> {
  /**
   * @constructor
   * @param {<type>} <arg> - Beschrijving.
   */
  constructor(<arg>) {
    // ...
  }

  /**
   * @method <methodName>
   * @description Beschrijving van de methode.
   * @param {<type>} <name> - Beschrijving.
   * @returns {<type>}
   */
  <methodName>(<params>) {
    // ...
  }
}
```

## 💬 4. Inline commentaar

* Gebruik `//` voor korte toelichting in de code.
* Leg **waarom** iets gebeurt uit, niet wat.
* 📌 Plaats TODO’s met `// TODO:` en korte omschrijving.

## 🔗 5. Voorbeelden en links

* Voeg `@see`-tags toe voor doorverwijzingen:

  ```js
  /**
   * @see {@link module:utils/api.js}
   */
  ```
* 📚 Gebruik `@example` voor korte usage-snippets.

## ✅ 6. Best practices

* 🧩 Houd iedere docblok kort: max. 100 tekens per regel.
* ✍️ Schrijf in **Voltooide wijs** (“Validates…” i.p.v. “Valideer…”).
* 🏷️ Gebruik Engelse termen in code (`camelCase`, `function`), en Nederlands in omschrijvingen.
* 🔄 Werk de `@version` bij bij breaking changes.
* 🛡️ Gebruik `@throws` voor expliciete foutgevallen.

---

*Gebruik dit als template voor alle `.js`-bestanden binnen `/src` en `public`.*
