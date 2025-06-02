# logging-standards.md

## 📜 Doel

Beschrijf hier de vereisten en conventies voor logging in het Heppy Schoonmaak-project, zowel in development (console) als in productie (Vercel Functions). Consistente en gedetailleerde logs maken debugging, support en monitoring een stuk eenvoudiger.

## 🏷️ 1. Logniveaus

Gebruik de volgende standaard niveaus met emojis voor snelle herkenning:

| Niveau   | Emoji | Beschrijving                                                              |
| -------- | ----- | ------------------------------------------------------------------------- |
| DEBUG    | 🐛    | Gedetailleerde informatie voor troubleshooting. Alleen in development.    |
| INFO     | ℹ️    | Belangrijke gebeurtenissen (startup, config geladen, user action).        |
| WARN     | ⚠️    | Onverwachte situaties die (nog) geen error zijn.                          |
| ERROR    | ❌     | Foutgevallen waarbij een actie is mislukt of een exception is opgetreden. |
| CRITICAL | 🔥    | Zeer ernstige fouten die onmiddellijke aandacht vereisen.                 |

## 🔧 2. Formaat & Structuur

* **Timestamp** in ISO 8601 (`new Date().toISOString()`).
* **Loglevel** altijd in hoofdletters en emoji.
* **Contextual data**: altijd een object met relevante metadata, bijv. `{ userId: 123, flow: "aanvraag", ... }`.
* **Bericht**: korte duidelijke zin.

**Voorbeeld:**

```js
console.log(`${new Date().toISOString()} ℹ️ [checkAdres] Adresvalidatie gestart`, { postcode, huisnummer });
console.error(`${new Date().toISOString()} ❌ [checkAdres] Externe API-fout`, { error, payload });
```

## 🔄 3. Development vs. Productie

* **Development:** gebruik `console.debug`, `console.info`, `console.warn`, `console.error`.
* **Productie (Vercel Functions):** gebruik een logger-wrapper die:

  * Logs stuurt naar stdout/stderr.
  * Correlation ID / request ID meestuurt in metadata.
  * (Optioneel) Seriële JSON-output voor makkelijker parsable logs.

```js
// logger.js
export function logInfo(message, meta = {}) {
  console.log(JSON.stringify({
    level: 'INFO',
    emoji: 'ℹ️',
    timestamp: new Date().toISOString(),
    message,
    ...meta
  }));
}
```

## 🔎 4. Conventies

* **Taggen**: gebruik altijd een tag in `[]` (bijv. `[auth]`, `[checkout]`, `[page:home]`) om module of flow te identificeren.
* **Correlation ID**: als onderdeel van HTTP-requests, genereer en log een `correlationId` en stuur hetzelfde ID mee in downstream calls.
* **Stack traces**: bij `ERROR`-logs altijd `error.stack` loggen.

## 🛠️ 5. Voorbeelden

```js
// DEBUG: alleen lokaal
console.debug(`${new Date().toISOString()} 🐛 [formValidator] validateField`, { fieldName, value });

// WARN
console.warn(`${new Date().toISOString()} ⚠️ [api] fallback gebruikt voor time-out`, { endpoint, timeout });

// CRITICAL
logCritical('🔒 [security] JWT invalid signature', { userId, token });
```

## 📈 6. Automatisering & Monitoring

* **Correlation in Sentry/Datadog**: configureer uniforme `context` tags.
* **Alerting**: stel alerts in op `ERROR` en `CRITICAL` niveaus.
* **Log retention**: bewaar logs ten minste 30 dagen.

---

*Gebruik deze standaarden bij het plaatsen van alle `console`- of logger-calls in front-end en serverless functies.*
