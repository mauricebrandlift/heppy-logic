# Heppy Logic

Frontend en backend logica voor de Heppy applicatie.

## Recent Updates

### Error Handling & Message Display Improvements

We hebben het foutmeldingssysteem verbeterd door een consistente aanpak voor het tonen/verbergen van fouten te implementeren:

- Alle foutmeldingen worden nu beheerd met de `hide` CSS class in plaats van directe `style.display` manipulaties
- Nieuwe utility functies in `formUi.js` zorgen voor consistente error handling:
  - `showError()`, `hideError()`, `isErrorVisible()`
- Gecentraliseerde foutberichten in `commonMessages.js` voor herbruikbaarheid
- Documentatie toegevoegd: `docs/04-guidelines/04-error-display-standards.md`

Dit zorgt voor een betere gebruikerservaring en eenvoudiger onderhoud van de code.

## Documentatie

Voor meer informatie over de architectuur, implementatie, en guidelines, zie de documentatie in de `docs` folder.

## Project Structuur

- `api/`: Backend API endpoints
- `docs/`: Projectdocumentatie
- `public/`: Frontend code
  - `public/forms/`: Formulier componenten en systeem
  - `public/utils/`: Utility functies en helpers