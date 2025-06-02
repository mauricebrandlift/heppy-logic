---

title: "Integration Overview"
description: "Overzicht van alle externe integraties en hun dataflows in het Heppy Schoonmaak-platform"
date: 2025-05-15
----------------

# Integration Overview

Dit document beschrijft de **externe integraties** van het Heppy Schoonmaak-platform, inclusief gebruikte API’s, authenticatie, endpoints en voorbeeld-implementaties.

## 1. PostcodeAPI

* **Doel**: Valideren of een Nederlands adres bestaat.
* **Base URL**: `https://api.postcodeapi.nu/v2`
* **Authenticatie**: API-key via header `X-Api-Key` (env: `POSTCODE_API_KEY`).

### Endpoint

```http
GET /addresses/?postcode={postcode}&number={huisnummer}
Host: api.postcodeapi.nu
X-Api-Key: <POSTCODE_API_KEY>
```

### Voorbeeldcode

```js
import { POSTCODE_API_URL, POSTCODE_API_KEY } from '../utils/config.js';

export async function checkAdres(data) {
  const url = `${POSTCODE_API_URL}/addresses/?postcode=${encodeURIComponent(data.postcode)}&number=${encodeURIComponent(data.huisnummer)}`;
  const res = await fetch(url, { headers: { 'X-Api-Key': POSTCODE_API_KEY } });
  if (res.status === 404) return { exists: false };
  if (!res.ok) throw new Error(`PostcodeAPI error: ${res.status}`);
  const json = await res.json();
  return { exists: true, payload: json };
}
```

## 2. Supabase (Database & Auth)

* **Doel**: Opslag en ophalen van aanvragen, dekkingstabellen, gebruikers en configuratie.
* **API**: Restful endpoints via Supabase REST of JavaScript SDK.
* **Authenticatie**: JWT via Supabase Auth.

### Voorbeeld REST-call (Coverage-check)

```http
GET https://<project>.supabase.co/rest/v1/coverage?postcode=1234AB&number=10
apikey: <SUPABASE_ANON_KEY>
Authorization: Bearer <SUPABASE_JWT>
```

### Voorbeeldcode met SDK

```js
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function coverageCheck({ postcode, number }) {
  const { data, error } = await supabase
    .from('coverage')
    .select('coverage')
    .eq('postcode', postcode)
    .eq('huisnummer', number)
    .single();
  if (error) throw error;
  return { coverage: data.coverage };
}
```

## 3. Stripe

* **Doel**: Verwerken van eenmalige betalingen en automatische incasso voor abonnementen.
* **Library**: `@stripe/stripe-js` (frontend) & `stripe` (backend).
* **Authenticatie**: Secret key in env `STRIPE_SECRET_KEY` (server); publishable key `STRIPE_PUBLISHABLE_KEY` (client).

### Voorbeeld flow (PaymentIntent)

```js
// Backend: create PaymentIntent\export async function createPaymentIntent({ amount }) {
  const stripe = new Stripe(STRIPE_SECRET_KEY);
  const intent = await stripe.paymentIntents.create({
    amount,
    currency: 'eur',
    automatic_payment_methods: { enabled: true }
  });
  return { clientSecret: intent.client_secret };
}
```

```js
// Frontend: bevestig betaling
await stripe.confirmCardPayment(clientSecret, {
  payment_method: {
    card: cardElement,
    billing_details: { name: userName }
  }
});
```

## 4. E-mail Provider (optioneel)

* **Doel**: Verzenden van transactionele e-mails (bevestigingen, herinneringen).
* **Integratie**: SMTP of third-party API (SendGrid, Mailgun).
* **Voorbeeld**:

```js
import sgMail from '@sendgrid/mail';
sgMail.setApiKey(SENDGRID_API_KEY);

export function sendConfirmationEmail(to, orderId) {
  return sgMail.send({
    to,
    from: 'no-reply@heppy.nl',
    subject: 'Bevestiging schoonmaak aanvraag',
    text: `Uw aanvraag ${orderId} is ontvangen.`
  });
}
```

---

*Zie individuele integratie-documentatie (`api-guidelines.md`, Supabase docs, Stripe docs) voor meer details.*
