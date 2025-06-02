---

title: "Deployment Plan"
description: "Beschrijft het deploymentproces, branch-strategie en CI/CD voor het Heppy Schoonmaak-platform"
date: 2025-05-15
----------------

# Deployment Plan

## 🚀 1. Omgevingen & Vercel Settings

* **Development**:

  * Branch: `main` (codelive preview per PR).
  * Environment Variables: vanuit `.env.local` voor lokale builds.
  * Vercel Scope: `Preview` en `Development`-omgevingen.
* **Production**:

  * Branch: goedgekeurde `main`-merges of `release/*`-tags.
  * Environment Variables in Vercel Dashboard (Production scope).
  * Custom Domain: `app.heppy.nl` (HTTPS / HSTS ingeschakeld).

## 🗂️ 2. Branch & Release Strategie

* **Feature branches**: `feature/<short-desc>` afgeleid van `main`.
* **Release branches**: `release/x.y.z` voor voorbereidende checks.
* **Hotfix branches**: `hotfix/x.y.z` direct van `main`.
* **Merges**:

  * Feature → `main` via Pull Request + review + CI ✅.
  * `main` → Production via automatische deployment of manual promotion.

## 🔄 3. CI/CD Pipeline (Vercel)

1. **Build & Deploy**:

   * Iedere merge naar `main` of `release/*` triggert Vercel build.
   * Vercel runt `npm run build` (of de build command in projectinstellingen) en deployt automatisch.

**Preview Deployments & Staging** & Staging\*\*

* **Preview Deployments**: elke push naar een feature- of PR-branch creëert automatisch een Preview deployment op Vercel met een unieke URL (`https://<project>-<hash>.vercel.app`).
* **Staging Database**: configureer in Vercel onder **Preview** environment variables een aparte Supabase staging-instantie. Zo gebruiken alle preview builds een gescheiden database zonder impact op productie.
* **Webflow Script**: pas in Webflow Custom Code een klein script in om in de staging (Webflow-staging `.webflow.io`-host) de Preview deployment in te laden:

  ```html
  <script>
    (function() {
      const isStaging = location.hostname.endsWith('.webflow.io');
      const host = isStaging
        ? 'https://<YOUR-VERCEL-PROJECT>-preview.vercel.app'
        : 'https://<YOUR-VERCEL-PROJECT>.vercel.app';
      const s = document.createElement('script');
      s.src = `${host}/pages/homePage.js`;
      document.head.appendChild(s);
    })();
  </script>
  ```
* **Testen**: bezoek de Webflow-staging URL voor volledige end-to-end tests (forms, API, DB, payments) en gebruik testdata in de staging Supabase zonder extra Vercel-kosten.

## 📦 4. Versioning & Tagging

* **SemVer**: `MAJOR.MINOR.PATCH`.
* **Taggen**:

  * Na merge van `release/x.y.z`, maak Git-tag `vX.Y.Z` aan.
  * Changelog updaten (`changelog-standards.md`): move `Unreleased` → `[X.Y.Z] - YYYY-MM-DD`.
