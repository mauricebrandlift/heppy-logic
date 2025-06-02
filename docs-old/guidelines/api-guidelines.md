# api-guidelines.md

## 🌐 Doel

Dit document beschrijft de **richtlijnen voor API-wrappers** binnen het Heppy Schoonmaak-project. Het waarborgt consistente naamgeving, foutafhandeling, retries, time-outs en security voor alle interne en externe API-calls.

## 1️⃣ 1. Structuur & Naamgeving

* **Bestandslocatie**: `public/utils/api.js`.
* **Functienamen**:

  * Start met het werkwoord, bijv. `fetch`, `get`, `create`, `update`, `delete`.
  * Geef direct de resource en context, bijv. `fetchCoverage`, `createOrder`, `getAvailableCleaners`.
* **Import/export**:

  ```js
  // ✅
  export async function fetchCoverage(data) { }
  export async function createOrder(payload) { }

  // ❌
  export async function coverage() {}
  export async function order() {}
  ```

## 🔄 2. HTTP-methoden & endpoints

* **GET** voor ophalen van data.
* **POST** voor creëren van records.
* **PUT/PATCH** voor bijwerken.
* **DELETE** voor verwijderen.
* **URL-concat**: gebruik `URLSearchParams` voor querystrings.

  ```js
  const params = new URLSearchParams({ postcode: data.postcode, number: data.huisnummer });
  const url = `${BASE_URL}/coverage?${params.toString()}`;
  ```

## ⏲️ 3. Time-outs & Retries

* **Timeout**: wrap fetch in `AbortController` met standaard timeout (5s).
* **Retries**: voor idempotente calls (GET) maximaal 2 retries met exponential backoff.

  ```js
  async function fetchWithRetry(url, options, retries = 2) {
    try {
      return await fetchWithTimeout(url, options);
    } catch (err) {
      if (retries > 0) {
        await delay(1000 * Math.pow(2, retries));
        return fetchWithRetry(url, options, retries - 1);
      }
      throw err;
    }
  }
  ```

## ⚠️ 4. Error-handling

* **HTTP-errors**: bij `!res.ok` gooi een `ApiError(status, message)`.
* **Network-errors**: vang `TypeError` of timeout en gooi door met duidelijke boodschap.
* **Gebruik Custom Error-class**:

  ```js
  export class ApiError extends Error {
    constructor(status, message, data) {
      super(message);
      this.status = status;
      this.data = data;
    }
  }
  ```

## 🔒 5. Security & Headers

* **Auth**: stuur JWT of API-key in `Authorization` header: `Bearer <token>`.
* **Content-Type**: `application/json` bij POST/PUT.
* **CSRF**: voor browser-calls uit Wized/of Webflow: volg same-origin policies.
* **CORS**: stel in op de server kant in Vercel Functions of Supabase.

## 🔗 6. Logging & Metrics

* **Log** elke call bij `DEBUG`:

  ```js
  logDebug('API request', { url, options });
  ```
* **Log** fouten bij `ERROR`, inclusief status, endpoint en payload.
* **Metrics**: stuur latency en succesratio naar monitoring (Sentry/Datadog).

## 🛠️ 7. Voorbeelden

```js
import { getEnv } from './config.js';

const BASE_URL = getEnv('NEXT_PUBLIC_API_BASE_URL');

export async function fetchCoverage(data) {
  const params = new URLSearchParams({ postcode: data.postcode, number: data.huisnummer });
  const url = `${BASE_URL}/coverage?${params}`;
  const res = await fetchWithRetry(url, { headers: { Authorization: `Bearer ${getEnv('API_TOKEN')}` } });
  if (!res.ok) throw new ApiError(res.status, 'Coverage aanvraag mislukt');
  return res.json();
}
```

## ✅ 8. Best practices samenvatting

* 📛 Duidelijke functienamen (`verbResource`).
* 🔄 Gebruik time-outs & retries.
* ⚠️ Gooi altijd `ApiError` bij mislukte calls.
* 🔒 Voeg auth & content-type headers toe.
* 📝 Documenteer nieuwe endpoints in `api-guidelines.md`.

---

*Volg deze richtlijnen om alle API-interacties betrouwbaar, consistent en veilig te maken.*
