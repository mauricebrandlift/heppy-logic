# security-standards.md

## 🔐 Doel

Dit document beschrijft de **security-standaarden** voor zowel frontend (forms, scripts) als backend (Vercel Functions) in het Heppy Schoonmaak-project. Doel is om common vulnerabilities te voorkomen en best practices te volgen.

## 🛡️ 1. Input Sanitatie & Validatie

* **Sanitize alle user-input** via `formInputSanitizer.js`:

  * `trim()`, escape ongewenste tekens.
  * Valideer met `formValidator.js` (regex, length checks).
* **Server-side validatie**: dupliceer altijd de front-end checks in je API-routes.

## 🔒 2. Cross-Site Scripting (XSS)

* **InnerHTML** vermijden; gebruik `textContent` of veilige templating.
* **Content Security Policy (CSP)** instellen in HTTP-headers:

  ```http
  Content-Security-Policy: default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline';
  ```

## 🔐 3. HTTP Headers & CORS

* **CORS**: configureren in Vercel Functions of in `next.config.js`:

  ```js
  module.exports = {
    async headers() {
      return [{
        source: '/api/:path*',
        headers: [{ key: 'Access-Control-Allow-Origin', value: 'https://jouw-domein.nl' }]
      }];
    }
  };
  ```
* **Secure headers** met `helmet` (backend) of via Vercel:

  * `X-Frame-Options: DENY`
  * `X-Content-Type-Options: nosniff`
  * `Referrer-Policy: no-referrer`
  * `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`

## 🔑 4. Autenticatie & Autorisatie

* **JWT**: valideer tokens in middleware of elke function:

  ```js
  import jwt from 'jsonwebtoken';
  function authenticate(req) {
    const token = req.headers.authorization?.split(' ')[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return payload;
  }
  ```
* **User roles**: implementeer `role-based access control` (RBAC) in je handlers.
* **Wachtwoord-hashing**: gebruik `bcrypt` met salt rounds ≥ 10.

## 🔑 5. API Security

* **Rate limiting**: voorkom bruteforce door per IP of user max requests per minuut toe te staan.
* **Input size limits**: stel max body size in (bijv. 1MB) via `micro` of `bodyParser`.

## 🛠️ 6. Third-Party Integraties

* **Stripe**: initialiseer alleen in server-side code, expose geen secret keys in frontend.
* **CSP voor CDN**: limit scripts/styles tot bekende domeinen.

## 🧪 7. Security Testing

* **Dependency scanning**: gebruik `npm audit` of `snyk` in CI.
* **Penetration testing**: periodiek basis tests uitvoeren op kritieke flows.
* **Static Analysis**: configureer ESLint plugins zoals `eslint-plugin-security`.

## ✅ 8. Best Practices

* 🗂️ Houd geheimen in env-variabelen, nooit in code.
* 🧹 Verwijder ongebruikte dependencies.
* 🔄 Rotate credentials (API-keys, JWT secrets) regelmatig.
* 📝 Documenteer security-richtlijnen en -tools in dit bestand.

---

*Volg deze standaarden om de security in zowel frontend als backend van het project te waarborgen.*
