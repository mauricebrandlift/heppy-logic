# configuration.md

## ⚙️ Doel

Dit document beschrijft het beheer en gebruik van **environment-variabelen** en configuratie-instellingen in het Heppy Schoonmaak-project. Goede configuratie voorkomt hard-coded waarden, maakt deployments flexibel en veilig.

## 🗂️ 1. Bestanden en locaties

* **`.env.local`** (development): lokale instellingen, nooit committen.
* **`.env.production`** (productie): productiesleutels en -endpoints, beveiligd in Vercel/CI.
* **`config.js`**: wrapper in `src/utils/config.js` of `public/utils/config.js` om variabelen te lezen.

## 🔐 2. Environment-variabelen naming

* Gebruik **UPPER\_SNAKE\_CASE** voor namen.
* Prefix met project- of contextnaam indien relevant, bijv. `POSTCODE_API_KEY`, `NEXT_PUBLIC_API_URL`.
* Voor publieke variabelen in frontend: prefix met `NEXT_PUBLIC_`.

**Voorbeelden**:

```bash
# Extern (PostcodeAPI)
POSTCODE_API_URL=https://api.postcodeapi.nu/v2
POSTCODE_API_KEY=abcdef123456

# Eigen endpoints (Next.js of Vercel Functions)
NEXT_PUBLIC_API_BASE_URL=https://heppy.example.com/api

# Stripe
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
```

## ⚡ 3. Config-wrapper (`config.js`)

Maak één centrale helper om variabelen te lezen en automatisch errors te gooien bij ontbrekende keys.

```js
// src/utils/config.js

/**
 * Haal een environment-variabele op of gooi een fout als niet gezet.
 * @param {string} key - Naam van de variabele
 * @returns {string}
 */
export function getEnv(key) {
  const val = process.env[key];
  if (!val) {
    throw new Error(`Environment variable '${key}' is not defined`);
  }
  return val;
}

// Gebruik:
export const POSTCODE_API_URL = getEnv('POSTCODE_API_URL');
export const POSTCODE_API_KEY = getEnv('POSTCODE_API_KEY');
```

## 🚀 4. Deployment & Vercel Settings

* **Vercel Dashboard**: stel de variabelen in onder *Project Settings → Environment Variables*.
* **Scopes**:

  * **Development**: `Preview` & `Development`
  * **Production**: `Production`
* **Security**: zorg dat `STRIPE_SECRET_KEY` alleen in production zichtbaar is.

## 🔄 5. Best practices

* ❌ **Niet hard-coden**: geen API-URLs of sleutels in code.
* 💼 **Business-configuratie via database**: sla prijzen, tijdsregels en andere businessparameters op in de database en beheer deze via een admin-dashboard of CMS, niet als environment-variabelen.
* ⚡ **Env-variabelen**: gebruik uitsluitend voor secrets en build-time flags.
* ✏️ **Documenteer** elke variabele in `configuration.md` met beschrijving en voorbeeld.
* 🔄 **Regelmatige review**: controleer bij toevoeging van nieuwe keys of documentatie up-to-date is.
* 🔒 **Beperk scope**: gebruik `.env.local` uitsluitend voor development en commit een `.env.example` zonder secrets.

## 📋 6. `.env.example` `.env.example`

Commit een voorbeeldbestand zonder secrets:

```bash
# Voorbeeld van benodigde keys
POSTCODE_API_URL=
POSTCODE_API_KEY=
NEXT_PUBLIC_API_BASE_URL=
STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
```

---

*Gebruik deze richtlijnen om environment-variabelen consistent en veilig te beheren.*
