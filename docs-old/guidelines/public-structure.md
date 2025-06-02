# Public Mappenstructuur

Dit document beschrijft de structuur van de **public/**-map in de frontend, met toelichting per submap:

```
/public
├── pages
│   ├── homePage.js           # Orchestrator voor de homepage, initieert form-modules en flow-events
│   ├── aanvraagPage.js       # Orchestrator voor multi-step aanvraagflow
│   └── ...                   # Overige paginamodules
├── forms
│   ├── adres
│   │   └── adresCheckForm.js # Form-module voor adrescheck op homepage
│   ├── schemas
│   │   └── formSchema.js     # JSON-schema definities voor formulieren
│   ├── validators
│   │   └── formValidator.js  # Veld- en formulier-validatie engine
│   ├── logic
│   │   ├── formInputSanitizer.js # Sanitization en data-collectie utilities
│   │   └── formStorage.js        # Opslag van prefill- en flowdata
│   └── ui
│       └── formUi.js             # UI-helpers: fouten, toggles, loaders
├── utils
│   └── api.js                # Generieke frontend API-wrapper voor /api routes
└── config
    ├── env.js                # Laden van environment-variabelen (ENDPOINTS, KEYS)
    └── appConfig.js          # Application-specific settings: prijzen, timeouts, feature flags
```

## Toelichting

* **pages/**: Pagina-specifieke entrypoints. Initialisatie van flows en eventlisteners.
* **forms/**: Alle code gerelateerd aan formulieren, met:

  * **<formName>/**: per formulier een eigen module.
  * **schemas/**: declaratiedata voor JSON-schema’s (velden, patronen, berichten).
  * **validators/**: validatiefuncties (`validateField`, `validateForm`, `validateFull`).
  * **logic/**: sanitization, collect, opslag.
  * **ui/**: error rendering, knop- en field-toggles, loaders.
* **utils/**: Generieke utilities; voorkom dat keys of gevoelige logica in de frontend staan.
* **config/**: Afzonderlijke bestanden voor:

  * **env.js**: laden van environment-variabelen (via `process.env`).
  * **appConfig.js**: application-specific settings zoals prijzen, timeouts en feature flags.

*Opmerkingen of aanvullingen?*
