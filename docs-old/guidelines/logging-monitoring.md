# logging-monitoring.md

## 📊 Doel

Dit document beschrijft hoe je **logging** en **monitoring** opzet voor het Heppy Schoonmaak-project, met focus op Vercel Functions en externe monitoring tools. Het bouwt voort op `logging-standards.md` en geeft concrete voorbeelden en best practices.

## 🛠️ 1. Vercel Logconfiguratie

1. **Functie-logs**:

   * Logs uit serverless functies (api routes) gaan automatisch naar Vercel’s log-stream.
   * Gebruik `console.log`, `console.error` of een logger-wrapper (zie `logging-standards.md`).
2. **Log retention**:

   * Standaard bewaard Vercel logs 7 dagen voor `Development` en 30 dagen voor `Production`.
   * Pas retention niet handmatig aan – vertrouw op externe monitoring voor lange termijn.
3. **Log-level filter**:

   * Ga in Vercel Dashboard naar **Logs → Filters** en configureer op `level:ERROR` en `level:WARN` voor productie-alerts.

## 🔗 2. Externe Monitoring (Sentry / Datadog)

* **Integratie**:

  1. Installeer SDK (`@sentry/node` of `datadog-lambda-js`).
  2. Initialiseer in `src/utils/logger.js` of direct in `api/_middleware.js` (Next.js):

     ```js
     import * as Sentry from '@sentry/node';
     Sentry.init({ dsn: process.env.SENTRY_DSN });
     ```
* **Error Tracking**:

  * Automatisch exceptions en unhandled rejections vangen.
  * Voeg context toe: huidige `flow`, `userId`, `correlationId`.

  ```js
  Sentry.withScope(scope => {
    scope.setTag('flow', 'aanvraag');
    scope.setUser({ id: userId });
    scope.setExtra('payload', payload);
    Sentry.captureException(err);
  });
  ```
* **Performance Monitoring** (optioneel):

  * Meet lambda-duration en API-latency.
  * Stel transactie-tracing in (Sentry Traces of Datadog APM).

## 🔎 3. Correlation IDs & Tracing

* **Genereren**:

  * Bij binnenkomende HTTP-request, genereer `correlationId = UUIDv4()` als header (bijv. `x-correlation-id`).
* **Propageren**:

  * Stuur `correlationId` mee in alle downstream API-calls en log statements.
* **Logvoorbeeld**:

  ```js
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'INFO',
    correlationId,
    message: 'Coverage check uitgevoerd',
    data: { postcode, huisnummer }
  }));
  ```

## 📈 4. Dashboards & Alerts

* **Vercel Alerts**:

  * Stel in **Project Settings → Alerts** notificaties in op `ERROR` en `CRITICAL`.
  * Koppel aan Slack of e-mail.
* **Sentry/Datadog Dashboards**:

  * Maak overzicht: aantal exceptions per endpoint, gemiddelde responsetime.
  * Stel alerts in op spikes in error-rate of latency.

## ✅ 5. Best Practices

* 🗂️ **Consistente metadata**: logs bevatten altijd `timestamp`, `level`, `flow`, `correlationId`, en relevante `meta`.
* ♻️ **Geen gevoelige data**: verwijder of mask gevoelige velden (wachtwoorden, tokens) uit logs.
* 🔄 **Idempotente retries**: bij tijdelijk falen, retry mechanism met backoff; log iedere poging.
* 🧪 **Test logging**: simuleer errors lokaal via `VERCEL_ENV=development` en plaats test-logs.

---

*Gebruik dit document in combinatie met `logging-standards.md` om zowel in development als productie inzicht te krijgen in het gedrag en de performance van je applicatie.*
