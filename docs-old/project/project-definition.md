---

title: "Project Definition"
description: "Overzicht van scope, doelgroep en belangrijkste features van het Heppy Schoonmaak-platform"
date: 2025-05-15
----------------

# Project Definitie

## 🎯 Doel

Het Heppy Schoonmaak-platform stelt particulieren en bedrijven in staat om snel en eenvoudig schoonmaakdiensten aan te vragen, beheren en betalen.

## 📦 Scope

### In Scope

* Aanvragen van abonnementen (wekelijks/tweewekelijks)
* Eenmalige schoonmaakdiensten (dieptereiniging, etc.)
* Adresvalidatie en dekkingcontrole via Postcode API en Supabase
* Multi-step aanvraagflow (adres → opdracht → dagdelen → overzicht → persoonsgegevens → betaling)
* Online betalingen via Stripe (incasso voor abonnementen, eenmalige betaling)
* Dashboard voor klanten, schoonmakers en beheerders
* E-mailnotificaties bij aanvraag, acceptatie, afwijzing en herinneringen
* Logging en monitoring (Vercel Logs, Sentry)

*Alle functies zijn gepland voor lancering; na livegang richten we ons alleen op SEO en onderhoud.*

## 👥 Doelgroepen

* Particuliere huishoudens
* Zakelijke klanten
* Schoonmakers
* Beheerders (admins)

## ✨ Belangrijkste Features

1. Adrescheck en dekkingcontrole
2. Multi-step aanvraagflow
3. Abonnementsmanagement
4. Eenmalige diensten (dieptereiniging, etc.)
5. Online betalingen & automatische uitbetaling
6. Klant-, schoonmaker- en admin-dashboard
7. E-mail- en notificatiesysteem
8. Duurzaamheids- en milieuvriendelijke initiatieven (ecologische producten, fietsenplan, boomplant)

## 🔧 Technische Stack

* **Frontend**: Webflow (HTML & CSS) en Vanilla JavaScript (gehost en gedeployd op Vercel)
* **Backend/API**: Vercel Functions in `/api`-map met Vanilla JavaScript, gehost en gedeployed op Vercel
* **Database & Auth**: Supabase (PostgreSQL, Supabase Auth)
* **Betalingen**: Stripe (incasso voor abonnementen, eenmalige betalingen)
* **Logging & Monitoring**: Vercel Logs (server-side) en `console` (frontend)

---

*Einde document*
