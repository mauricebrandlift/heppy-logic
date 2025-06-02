---

title: "Tech Stack"
description: "Overzicht en motivatie van de technologieën die gebruikt worden in het Heppy Schoonmaak-platform"
date: 2025-05-15
----------------

# Tech Stack

## 🌐 Frontend

* **Webflow**

  * Genereren van HTML & CSS via drag-and-drop editor.
  * Responsive design baked in.
* **Vanilla JavaScript**

  * Formulierlogica, validatie, localStorage, UI updates.
  * Gehost als statische assets op Vercel.
* **Splide.js**

  * Multi-step carrousel voor aanvraagflows.

## 🛠️ Backend / API

* **Vercel Functions**

  * Serverless endpoints in `/api`-map.
  * Vanilla JavaScript, automatisch schalen.
  * Deploy via Vercel (Preview & Production).

## 🗄️ Database & Auth

* **Supabase (PostgreSQL + Auth)**

  * Relationele database voor users, orders, coverage, etc.
  * Supabase Auth voor JWT-based login & roles.
  * Realtime subscriptions voor live updates.

## 💳 Payments

* **Stripe**

  * PaymentIntent API voor eenmalige en abonnementenbetalingen.
  * Webhooks voor status-sync tussen Stripe en Supabase.

## 📈 Logging & Monitoring

* **Vercel Logs**

  * Server-side logging (JSON via wrapper).
* **Console**

  * Frontend logs voor debugging.

## 📦 Development Tools

* **GitHub**

  * Repository, code reviews via Pull Requests.
* **Vercel**

  * CI/CD, Preview Deployments, custom domains.

---

*Dit bestand geeft in één oogopslag inzicht in de technologieën en waarom ze zijn gekozen.*
