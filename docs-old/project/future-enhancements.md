# Future Enhancements & Nice‑to‑Have’s

Onderstaand vind je een overzicht van potentieel waardevolle uitbreidingen en verbeteringen die we nu nog niet direct implementeren, maar die in de toekomst een meer robuuste, schaalbare en gebruiksvriendelijke oplossing opleveren.

## 1. Geavanceerde error‑handling

* Gestandaardiseerde `Error`-objecten met `code`, `message` en optionele `details`
* Automatische retry- en back‑off-logica in `public/utils/api/client.js`
* Client‑side fout‑reporting naar backend (`/api/logs`) via `sendBeacon` of `fetch`

## 2. Async‑validatie factory

* Centrale wrapper die automatisch alle async-checks (address, krediet, beschikbaarheid) injecteert in `validateFull`
* Modules hoeven dan enkel nog `await validate(data)` te noemen

## 3. Unit‑ en integratietests

* **Front‑end**: tests voor `validateField`, `validateForm`, form‑modules (Jest of vergelijkbaar)
* **Back‑end**: tests voor `addressCheck`‑logic (mock Supabase REST) en route‑handlers

## 4. Type‑veiligheid

* Introduceer TypeScript of PropTypes in formulieren en API‑modules
* Heldere interface‑beschrijvingen voor `getAddressInfo` response object

## 5. Monitoring & dashboarding

* Backend: integratie met Sentry/LogRocket voor uitzonderingen (optioneel zonder npm via custom logs)
* Front‑end: performance metrics (TTFB, TTI) via Web Vitals

## 6. Documentatie en voorbeeldapps

* Markdown voorbeelden in Storybook of embed‑componenten voor formulieren
* Live API‑schema (OpenAPI) voor backend endpoints

## 7. Feature flags en A/B tests

* `appConfig.js` uitbreiden met feature‑flags
* Server‑side toggles in `/api/config` om nieuwe flows gefaseerd in te zetten

---

*Plaatsing:* dit document staat in `docs/project/future-enhancements.md`, zodat de roadmap en projectdefinitie makkelijk te vinden zijn en onderhouden worden naast bestaande project‑documentatie.
