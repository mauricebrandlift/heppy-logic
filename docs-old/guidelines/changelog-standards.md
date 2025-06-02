# changelog-standards.md

## 📝 Doel

Dit document beschrijft de standaarden voor het bijhouden van een **CHANGELOG** in het Heppy Schoonmaak-project. Een goede changelog:

* 📅 Maakt nieuwe versies traceerbaar voor developers en stakeholders.
* 🔍 Geeft in één oogopslag inzicht in wat er is **toegevoegd**, **gewijzigd**, **gerepareerd** of **verwijderd**.
* 🤖 Maakt automatisering in CI/CD mogelijk (release-check).

## 📐 1. Formaat & structuur

Volg het **Keep a Changelog**-formaat ([http://keepachangelog.com](http://keepachangelog.com)):

```markdown
# Changelog

Alle significante veranderingen in dit project worden hier bijgehouden.

## [Unreleased]
- 🆕 Feature X toegevoegd
- 🐞 Bug Y opgelost

## [1.2.0] - 2025-05-15
### Added
- Ondersteuning voor multi-step formulieren (forms-flow.md)  
- `validateFull` async-validatie toegevoegd in formValidator.js

### Changed
- Naamgeving van API-wrappers veranderd naar `verbResource` pattern  
- Style-guide geüpdatet voor quote usage

### Fixed
- Race-condition bij prefill in form modules  
- Foutmelding `addressCheckError` in validator

### Security
- JWT-validatie uitgebreid met rol-checks

## [1.1.0] - 2025-04-01
### Added
- `accessibility-standards.md` toegevoegd
### Fixed
- Spellingsfout in logging-standards.md
```

### Richtlijnen

* **Versienummers**: semver (MAJOR.MINOR.PATCH).
* **\[Unreleased]**: voor alle wijzigingen die nog niet in een release zijn uitgekomen.
* **Datum**: `YYYY-MM-DD` van de release.
* **Categorieën**:

  * `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.
* **Bullet points**: korte omschrijvingen, verwijzingen naar bestanden of issues.

## 🔄 2. Workflow & Automatisering

* **Commit messages**: gebruik `[changelog]` scope bij wijzigingen in de changelog.
* **CI-check**: valideer vóór merge dat:

  * `Unreleased`-sectie niet leeg is.
  * Nieuw versienummer in `## [X.Y.Z]` volgt op de laatste release.
* **Release proces**:

  1. Update `## [Unreleased]` → `## [X.Y.Z] - YYYY-MM-DD`.
  2. Voeg nieuwe `## [Unreleased]` sectie bovenaan toe.
  3. Tag commit met `vX.Y.Z`.

---

*Gebruik deze changelog-standaarden om het release-proces transparant en gestructureerd te houden.*
