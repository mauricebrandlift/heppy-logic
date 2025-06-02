# docs-documentation-standards.md

## 📚 Doel

Dit document beschrijft de **Markdown-conventies** en de **map- en bestandsstructuur** voor alle documentatie in het Heppy Schoonmaak-project. Hiermee garanderen we:

* 📑 Eenduidige opmaak en navigatie in `docs/`.
* 🕵️‍♂️ Snelle vindbaarheid voor AI-assistenten en ontwikkelaars.
* 🔄 Eenvoudig onderhoud en consistente versiegeschiedenis.

## 🗂️ 1. Map- & bestandsstructuur

```plaintext
/docs
 ├─ project/
 │    ├─ project-definition.md
 │    └─ database-schema.md
 ├─ js-file-templates/
 │    ├─ formJS.js
 │    ├─ pageJS.js
 │    ├─ apiJS.js
 │    ├─ formSchemaJS.js
 │    └─ formInputSanitizerJS.js
 ├─ user-stories/
 │    ├─ aanvraag/
 │    ├─ dashboard-klant/
 │    └─ ...
 ├─ guidelines/
 │    ├─ js-documentation-standards.md
 │    ├─ style-guide.md
 │    ├─ logging-standards.md
 │    ├─ logging-monitoring.md
 │    ├─ configuration.md
 │    ├─ docs-documentation-standards.md
 │    ├─ api-guidelines.md
 │    ├─ error-handling-standards.md
 │    ├─ security-standards.md
 │    ├─ testing-standards.md
 │    ├─ performance-guidelines.md
 │    └─ accessibility-standards.md
 └─ flows/
      ├─ forms-flow.md
      └─ ...
```

## 🖋️ 2. Markdown-opmaak

* **YAML frontmatter**: elk `*.md`-bestand begint met:

  ```yaml
  ---
  title: "<Bestandsnaam zonder extensie>"
  description: "Korte omschrijving"
  date: YYYY-MM-DD
  ---
  ```
* **Hoofdstructuur**:

  1. Doel
  2. Map-/bestandsoverzicht
  3. Secties met H2 (`##`) en H3 (`###`)
  4. Voorbeelden en codeblokken (`code`).
* **TOC**: automatisch via markdown-processor of handmatig:

  ```md
  ## Inhoudsopgave
  - [Doel](#doel)
  - [Map- & bestandsstructuur](#map--bestandsstructuur)
  - [...]
  ```

## 🔗 3. Cross-referencing

* Verwijs naar andere docs met relatieve paden:

  ```md
  Zie ook [Style Guide](./guidelines/style-guide.md)
  ```
* Gebruik `@see` in JSDoc om naar docs te linken:

  ```js
  /** @see module:docs/guidelines/logging-standards.md */
  ```

## 📐 4. Bestandsnamen & casing

* Gebruik `kebab-case` voor alle `.md`-bestanden (geen spaties):

  ```text
  form-input-sanitizer.md
  user-stories-anvraag.md
  ```

## 🛠️ 5. Bijwerken & versiebeheer

* **Changelog**: documenteer grote wijzigingen in `guidelines/changelog-standards.md`.
* **Commit messages**: `<docs>: <korte omschrijving>`.
* **Pull Requests**: koppel to docs-bestanden en update `date` in frontmatter.

## ✅ 6. Linting & CI

* **Markdownlint**: configureer regels voor line-length, header-style, etc.
* **CI-check**: validatie van frontmatter en broken links in docs.

---

*Volg deze standaarden om alle project-documentatie helder, uniform en future-proof te houden.*
