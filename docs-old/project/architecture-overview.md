---

title: "Architecture Overview"
description: "High-level systeemarchitectuur van het Heppy Schoonmaak-platform"
date: 2025-05-15
----------------

# Architecture Overview

## 🎛️ Systeemcomponenten

```mermaid
erDiagram
    WEBFLOW_FE ||--o{ SPLIDE_CAROUSEL : uses
    WEBFLOW_FE ||--o{ FORM_LOGIC : imports
    FORM_LOGIC ||--o{ API : calls
    API }|--|| SUPABASE_DB : connects
    API }|--|| STRIPE : processes
    API }|--|| POSTCODE_API : validates
    API }|--|| VERCEL_LOGS : logs
```

* **Frontend (Webflow)**

  * HTML & CSS gegenereerd door Webflow
  * Vanilla JavaScript modules voor formulierlogica, validatie, UI-updates en Splide multi-step carrousel
  * Gehost op Vercel, served via edge

* **API-laag (Vercel Functions)**

  * Alle endpoints in `/api`-map met Vanilla JS
  * Handlers voor:

    * Adresvalidatie (PostcodeAPI)
    * Coverage-check (Supabase)
    * Aanvraagverwerking (Supabase)
    * Betalingen (Stripe Webhooks & API)
  * Logging naar Vercel Logs

* **Database & Auth (Supabase)**

  * PostgreSQL voor opslag van gebruikers, aanvragen, dekkingstabellen, configuratie
  * Supabase Auth voor gebruikersbeheer en tokens

* **Externe Integraties**

  * **PostcodeAPI**: valideert NL-adres (GET requests)
  * **Stripe**: PaymentIntent flow voor eenmalige & abonnementen
  * **E-mail provider** (optioneel): notificaties via transactional e-mails

* **Monitoring & Logging**

  * **Frontend**: `console` logs voor fouten en states
  * **Backend**: Vercel Logs (JSON via logger-wrapper)
  * **Ops**: Alerts op ERROR/CRITICAL niveaus in Vercel Dashboard

## 🔄 Dataflows

### 1. Adrescheck & Coverage

1. Bezoeker vult formulier in → frontend validatie
2. Frontend `fetch('/api/coverage', { postcode, number })`
3. API-call: controle in Supabase (`coverage` tabel)
4. API retourneert `{ coverage: boolean }`
5. Frontend navigeert naar juiste slide of pagina

### 2. Aanvraag & Betaling

```mermaid
sequenceDiagram
  participant FE as Frontend
  participant API as Vercel API
  participant DB as Supabase
  participant STR as Stripe

  FE->>API: POST /api/orders (form data)
  API->>DB: INSERT order record
  API->>STR: Create PaymentIntent
  STR-->>API: PaymentIntent.created
  API-->>FE: { clientSecret }
  FE->>STR: confirmCardPayment(clientSecret)
  STR-->>FE: payment succeeded
  FE->>API: POST /api/orders/{id}/confirm
  API->>DB: update order status
```

---

*Dit overzicht geeft een beknopt beeld van hoe de componenten samenwerken. Voor details zie individuele documentatie in `/docs/project/` en `/docs/guidelines/`.*
