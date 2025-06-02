# error-handling-standards.md

## 🚨 Doel

Dit document beschrijft de **standaarden voor foutafhandeling** in het Heppy Schoonmaak-project, zowel in frontend (forms, page-scripts) als backend (Vercel Functions). Consistente error handling zorgt voor:

* 🐞 Betrouwbare debugging en logging
* 🙌 Betere gebruikerservaring met duidelijke foutmeldingen
* 🔄 Eenduidige retry- en fallbackstrategieën

## 🔑 1. Principes

* **Fail fast**: detecteer en log fouten zo vroeg mogelijk.
* **Separation of concerns**: modules vangen alleen hun eigen fouten op en geven generieke errors door.
* **User-friendly**: nooit stacktraces of interne foutcodes in de UI tonen.
* **Consistente structuur**: gebruik overal dezelfde error-objecten en properties.

## 🛠️ 2. Frontend (Form-modules & Page-scripts)

### 2.1 Form-modules (`<stepName>Form.js`)

* Wrap `submit`-handler in `try/catch`:

  ```js
  formEl.addEventListener('submit', async event => {
    try {
      event.preventDefault();
      ui.showLoader(submitBtn);
      // ...validatie, storage, api-call
    } catch (err) {
      console.error('❌ [form] Fout tijdens submit', err);
      ui.showGlobalError(formEl, 'Er is iets misgegaan. Probeer het later opnieuw.');
    } finally {
      ui.hideLoader(submitBtn);
      ui.toggleFields(formEl, true);
    }
  });
  ```
* **Validation errors**: return array met foutcodes (`['validatePostcode']`), toon inline via `showErrors()`.
* **System errors**: gooi een CustomEvent `error:critical` of gebruik `ui.showGlobalError()`.

### 2.2 Page-scripts (`<flowName>Page.js`)

* Luister op `error:critical` events:

  ```js
  document.addEventListener('error:critical', event => {
    const { message } = event.detail;
    alert(message);
  });
  ```
* Zorg dat `moveToNextSlide()` niet wordt aangeroepen als er een critical error is.

## ☁️ 3. API-wrappers (`utils/api.js`)

* **HTTP-errors**: check `res.ok`, gooi een `ApiError` met status en message.

  ```js
  export class ApiError extends Error {
    constructor(status, message) {
      super(message);
      this.status = status;
    }
  }

  export async function coverageCheck(data) {
    const res = await fetch(endpoint);
    if (!res.ok) throw new ApiError(res.status, 'Coverage check mislukt');
    return res.json();
  }
  ```
* **Timeouts & retries**: gebruik `AbortController` voor timeouts en externe retry-logica.
* **Axios** of `fetch` wrapper? Houd één uniforme fetch-helper aan.

## ⚙️ 4. Backend (Vercel Functions / Next.js API Routes)

* Gebruik `try/catch` in elke handler:

  ```js
  export default async function handler(req, res) {
    try {
      // ...business logic
      res.status(200).json(data);
    } catch (err) {
      console.error('❌ [api/coverage] Error', err);
      res.status(err.status || 500).json({ error: err.message });
    }
  }
  ```
* **Structure error responses**:

  ```json
  {
    "error": {
      "code": "CoverageNotFound",
      "message": "Dit adres valt niet binnen ons servicegebied"
    }
  }
  ```
* **Validation**: gebruik schema-validation (z.B. Zod, Yup) en return `400 Bad Request` bij invalid payload.

## 🎛️ 5. Retry & Fallback

* **Idempotentie**: zorg dat retries veilig zijn (GET vs POST).
* **Externe services**: retry 2x met backoff bij timeouts of 500-status.
* **Fallback**: toon offline- of retry-melding als alle pogingen falen.

## ✅ 6. Best Practices

* 🗃️ **Consistente error-objecten**: altijd `{ code, message, details? }`.
* 🔍 **Logging**: log volledige `error.stack` bij `ERROR`.
* 🚫 **Geen sensitive data**: mask persoonlijke of gevoelige velden in logs.
* 🧪 **Testen**: simuleer netwerk- en systeemfouten in unit- en integratietests.
* 📜 **Documentatie**: update deze file bij elke wijziging in error-flow.

---

*Volg deze standaarden om foutafhandeling in de volledige stack uniform en robuust te maken.*
