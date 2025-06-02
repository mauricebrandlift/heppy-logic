# API Mappenstructuur

Dit document beschrijft de voorgestelde structuur voor alle backend- of serverless-API-code. Hierdoor is de code overzichtelijk, goed testbaar en blijft de public-map vrij van gevoelige logica en keys.

```
/api
├── checks
│   └── addressCheck.js        # Logica voor adresvalidatie
│   └── coverageCheck.js       # Eventuele andere checks
├── config
│   └── index.js               # Inladen van env-variabelen, setup
├── intents
│   └── bookingIntent.js       # Business logica voor boekingen
│   └── cancellationIntent.js  # Cancel-logic, etc.
├── routes
│   └── address.js             # HTTP endpoint voor /api/address
│   └── options.js             # Endpoint voor /api/options
├── utils
│   └── apiClient.js           # Genereieke fetch-wrapper, timeout, retries
│   └── errorHandler.js        # Uniforme error-formatting
└── webhooks
    └── handlers
        ├── stripe.js          # Handler voor Stripe-webhook
        └── supabase.js        # Handler voor Supabase-webhook
```

## Toelichting

* **checks/**

  * Functies die domain-specifieke controles uitvoeren (zoals adresvalidatie), zonder HTTP-layer.
  * Worden aangeroepen door routes/endpoints.

* **config/**

  * `index.js` laadt alle omgevingsvariabelen (via `process.env`), validatie en default values.

* **intents/**

  * Business logica gegroepeerd op use case (aanvragen, annuleren, betalingen, etc.).

* **routes/**

  * HTTP-endpoints (serverless functions of Express routes) die requests ontvangen, input valideren en de juiste `checks` en `intents` aanroepen.

* **utils/**

  * Generieke helpers (HTTP-client, error formatting, logging wrappers).
  * Deze worden door zowel `checks` als `routes` gebruikt.

* **webhooks/**

  * Een `handlers/` map met alle webhook handlers voor externe services (bijv. Stripe, Supabase), zonder verdere submappen.

## Verplaatsing van addressAPI.js

De huidige `public/utils/addressAPI.js` is een client-side wrapper. Omdat deze API-sleutel niet in de frontend hoort, verplaatsen we de daadwerkelijke API-call naar:

```
/api/config/index.js             # bevat ADDRESS_API_BASE_URL en ADDRESS_API_KEY
/api/utils/apiClient.js          # generieke fetch met AUTH header
/api/checks/addressCheck.js      # export async function addressCheck(data)
/api/routes/address.js           # HTTP-post endpoint '/api/address'
```
