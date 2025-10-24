# Fixes Needed - Abonnement Aanvraag Flow

## ✅ OPGELOST:
1. **schoonmaak_match kolommen** - Fixed (match_status → status, match_datum → aangemaakt_op)

## 🔴 NOG TE FIXEN:

### 1. user_profiles.adres_id is leeg
**Probleem:** User wordt aangemaakt VOOR adres
**Oplossing:** Na adres aanmaken, update user_profile met adres_id

### 2. adressen.latitude en longitude is leeg  
**Probleem:** addressLookupService geeft lat/lon terug maar addressService slaat ze niet op
**Oplossing:** Check addressLookupService response en zorg dat create() ze meestuurt

### 3. betalingen.betaalmethode is leeg
**Probleem:** Stripe payment_method niet opgeslagen
**Oplossing:** Haal payment_method van paymentIntent.payment_method

### 4. aanvraag_intakes niet aangemaakt (404 error)
**Probleem:** Intake record bestaat niet voor deze payment intent
**Oplossing:** Maak intake record aan bij payment intent create (of skip update als niet gevonden)

### 5. voorkeurs_dagdelen niet aangemaakt
**Probleem:** metadata.dagdelen is leeg string "" 
**Log:** `"dagdelen": ""`
**Oplossing:** Frontend stuurt lege string i.p.v. JSON of weglaten

### 6. abonnementen.next_billing_date en last_billed_at leeg
**Probleem:** Niet berekend bij aanmaken
**Oplossing:** Bereken next_billing_date = startdatum + (sessions_per_4w / frequentie)

---

## Prioriteit:
1. **KRITIEK:** schoonmaak_match (FIXED ✅)
2. **HOOG:** voorkeurs_dagdelen (lege string)
3. **MEDIUM:** adres_id in user_profiles
4. **MEDIUM:** betaalmethode
5. **LOW:** next_billing_date
6. **LOW:** latitude/longitude
7. **SKIP:** aanvraag_intakes (404 = niet gevonden, not critical)
