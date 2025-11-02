# Stap 3 Implementatie: Schoonmaker Selectie (Dieptereiniging)

**Status**: ✅ Code Complete - Pending Database Setup & Testing

## Overzicht

Stap 3 van de dieptereiniging aanvraag flow is geïmplementeerd. Deze stap laadt beschikbare schoonmakers op basis van:
- Plaats (uit stap 1)
- Datum (uit stap 2)
- Benodigde uren (uit stap 2)

**Verschil met abonnement flow:**
- ❌ **GEEN** dagdelen selectie
- ✅ Specifieke datum (niet recurring)
- ✅ Tijdvenster filter: 08:00-10:00 start tijd
- ✅ Consecutieve uren check vanaf start tijd

## Bestanden Aangemaakt/Aangepast

### 1. Backend API Endpoint
**Bestand**: `api/routes/cleaners-dieptereiniging.js` ✅ CREATED

**Wat doet het:**
- GET endpoint: `/api/routes/cleaners-dieptereiniging`
- Query params: `plaats`, `datum` (YYYY-MM-DD), `minUren`
- Converteert datum naar weekdag naam (`maandag`, `dinsdag`, etc.)
- Roept Supabase RPC aan: `get_beschikbare_schoonmakers_dieptereiniging`
- Retourneert: cleaners array met beschikbaarheid

**Response format:**
```json
{
  "correlationId": "xxx-xxx-xxx",
  "plaats": "Utrecht",
  "datum": "2024-06-15",
  "weekdag": "zaterdag",
  "minUren": 4,
  "cleaners": [
    {
      "schoonmaker_id": 123,
      "voornaam": "Anna",
      "achternaam": "Jansen",
      "rating": 4.8,
      "aantal_beoordelingen": 42,
      "profielfoto": "https://...",
      "plaats": "Utrecht",
      "latitude": 52.0907,
      "longitude": 5.1214,
      "beschikbaarheid": [
        {
          "dag": "zaterdag",
          "dagdeel": "ochtend",
          "start_tijd": "08:00:00",
          "eind_tijd": "12:00:00"
        }
      ]
    }
  ]
}
```

### 2. Database Functie
**Bestand**: `database/functions/get_beschikbare_schoonmakers_dieptereiniging.sql` ✅ CREATED

**⚠️ ACTIE VEREIST:**
Je moet deze SQL zelf uitvoeren in Supabase SQL Editor!

**Wat doet het:**
- PostgreSQL functie met complexe CTE structuur
- Filtert schoonmakers op:
  - Plaats (case-insensitive match)
  - Weekdag (uit datum afgeleid)
  - **Tijd venster: 08:00 - 10:00 start tijd** ⚠️ BELANGRIJK
  - Consecutieve uren beschikbaar vanaf start tijd
- Sorteert op: rating DESC, voornaam ASC

**Uitvoeren:**
1. Open Supabase Dashboard
2. Ga naar SQL Editor
3. Kopieer hele inhoud van `database/functions/get_beschikbare_schoonmakers_dieptereiniging.sql`
4. Plak en voer uit
5. Controleer "Success" bericht

### 3. Frontend Form Schema
**Bestand**: `public/forms/schemas/formSchemas.js` ✅ UPDATED

**Toegevoegd:**
```javascript
'dr_schoonmaker-form': {
  selector: '[data-form-name="dr_schoonmaker-form"]',
  fields: {
    schoonmakerKeuze: {
      label: 'Schoonmaker keuze',
      inputType: 'radio',
      sanitizers: ['trim'],
      validators: ['required'],
      persist: 'form',
      messages: { required: '...' }
    }
  },
  globalMessages: {
    NO_CLEANERS_FOUND: '...',
    CLEANER_SELECTION_REQUIRED: '...',
    CUSTOM_SUCCESS: '...'
  }
}
```

### 4. Frontend Form Logic
**Bestand**: `public/forms/dieptereiniging/drSchoonmakerForm.js` ✅ CREATED

**Functionaliteit:**
- `initDrSchoonmakerForm()`: Entry point
- `getFlowData()`: Haalt plaats, datum, uren uit sessionStorage
- `loadCleaners()`: Roept API aan, toont loading/empty states
- `renderCleaners()`: Cloned template, vult schoonmaker data
- `fillCleanerCard()`: Vult foto, naam, plaats, rating, beschikbaarheid
- `renderBeschikbaarheidGrid()`: Visuele grid (niet interactief)
- `handleSubmit()`: 
  - Verwerkt "Geen voorkeur" → kiest eerste schoonmaker
  - Slaat `schoonmaker_id` op in flow
  - Navigeert naar stap 4

**Opslag:**
- `formHandler.formData.schoonmakerKeuze`: radio value ('geenVoorkeur' of schoonmaker_id)
- `formHandler.formData.schoonmaker_id`: daadwerkelijke ID
- `sessionStorage['dieptereiniging-aanvraag'].schoonmaker_id`: flow storage

### 5. API Client Update
**Bestand**: `public/utils/api/cleaners.js` ✅ UPDATED

**Nieuwe functionaliteit:**
```javascript
fetchAvailableCleaners({
  plaats: 'Utrecht',
  datum: '2024-06-15',  // Alleen voor dieptereiniging
  minUren: 4,           // Of 'uren'
  type: 'dieptereiniging' // 'abonnement' of 'dieptereiniging'
})
```

**Routing logica:**
- `type: 'dieptereiniging'` → GET `/api/routes/cleaners-dieptereiniging?plaats=X&datum=Y&minUren=Z`
- `type: 'abonnement'` → POST `/api/routes/cleaners` (bestaande endpoint)

### 6. Page Orchestrator
**Bestand**: `public/pages/dieptereinigingAanvraagPage.js` ✅ UPDATED

**Toegevoegd:**
```javascript
const schoonmakerFormElement = document.querySelector('[data-form-name="dr_schoonmaker-form"]');

if (schoonmakerFormElement) {
  console.log('👷 Dieptereiniging schoonmaker formulier gevonden, initialiseren...');
  import('../forms/dieptereiniging/drSchoonmakerForm.js')
    .then((m) => {
      if (m && typeof m.initDrSchoonmakerForm === 'function') {
        m.initDrSchoonmakerForm();
      }
    })
    .catch((err) => {
      console.error('Kon schoonmaker formulier niet laden:', err);
    });
}
```

## Webflow HTML Vereisten

**⚠️ ACTIE VEREIST:**
Zorg dat je Webflow pagina (stap 3) de volgende elementen heeft:

### Form Container
```html
<form data-form-name="dr_schoonmaker-form">
```

### Geen Voorkeur Radio (Pre-selected)
```html
<input type="radio" name="schoonmakerKeuze" value="geenVoorkeur" checked>
<label>Geen voorkeur</label>
```

### Schoonmaker Template (Clonable)
```html
<div data-render-element="schoonmaker" style="display: none;">
  <!-- Foto -->
  <img data-schoonmaker="schoonmaker-foto" src="" alt="">
  
  <!-- Naam -->
  <div data-schoonmaker="naam"></div>
  
  <!-- Plaats -->
  <div data-schoonmaker="plaats"></div>
  
  <!-- Rating -->
  <div data-field-profile="stars"></div>
  
  <!-- Reviews -->
  <div data-schoonmaker="total-reviews"></div>
  
  <!-- Beschikbaarheid grid (optioneel) -->
  <div data-schoonmaker-dagdeel="maandag-ochtend"></div>
  <div data-schoonmaker-dagdeel="maandag-middag"></div>
  <!-- etc. -->
  
  <!-- Radio button -->
  <input type="radio" name="schoonmakerKeuze" value="">
</div>
```

### Loading Spinner
```html
<div data-loading-spinner="schoonmakers" style="display: none;">
  Laden...
</div>
```

### Empty State
```html
<div data-element="schoonmakers-empty" style="display: none;">
  Geen beschikbare schoonmakers gevonden voor de gekozen datum.
</div>
```

### List Container
```html
<div data-element="schoonmakers-list"></div>
```

### Totaal Display (Optioneel)
```html
<span data-element="schoonmakers-total">0</span> schoonmakers beschikbaar
```

### Error Display (Optioneel)
```html
<div data-error="schoonmaker-form" style="display: none;"></div>
```

## Flow Data Structuur

Na stap 3 zit dit in `sessionStorage['dieptereiniging-aanvraag']`:

```json
{
  // Stap 1
  "dr_plaats": "Utrecht",
  "dr_postcode": "3511AB",
  "dr_huisnummer": "123",
  "dr_toevoeging": "A",
  "dr_straat": "Oudegracht",
  
  // Stap 2
  "dr_m2": "120",
  "dr_toiletten": "2",
  "dr_badkamers": "1",
  "dr_datum": "2024-06-15",
  "dr_uren": 4.5,
  "dr_prijs": 135.00,
  
  // Stap 3 (nieuw)
  "schoonmaker_id": 123
}
```

En in `formHandler.formData`:
```json
{
  "schoonmakerKeuze": "geenVoorkeur",  // of "123"
  "schoonmaker_id": 123
}
```

## Testing Checklist

### 1. Database Setup
- [ ] SQL functie uitgevoerd in Supabase
- [ ] Test RPC call in Supabase SQL Editor:
```sql
SELECT * FROM get_beschikbare_schoonmakers_dieptereiniging(
  'utrecht',
  'zaterdag',
  4
);
```
- [ ] Controleer dat schoonmakers worden geretourneerd
- [ ] Controleer dat alleen 08:00-10:00 start tijden verschijnen

### 2. API Endpoint
- [ ] Deploy naar Vercel
- [ ] Test in browser: `/api/routes/cleaners-dieptereiniging?plaats=Utrecht&datum=2024-06-15&minUren=4`
- [ ] Controleer response format
- [ ] Controleer CORS headers
- [ ] Controleer error handling (foute datum, ontbrekende params)

### 3. Frontend Integration
- [ ] Navigeer naar stap 3 pagina
- [ ] Controleer dat form init logt in console: "👷 Dieptereiniging schoonmaker formulier gevonden"
- [ ] Controleer loading spinner verschijnt
- [ ] Controleer schoonmaker kaarten worden gerenderd
- [ ] Controleer foto's laden
- [ ] Controleer rating en reviews tonen
- [ ] Controleer beschikbaarheid grid (indien aanwezig)
- [ ] Test "Geen voorkeur" selectie
- [ ] Test specifieke schoonmaker selectie
- [ ] Submit form en controleer:
  - [ ] Console log: schoonmaker_id opgeslagen
  - [ ] SessionStorage bevat schoonmaker_id
  - [ ] Navigatie naar stap 4

### 4. Edge Cases
- [ ] Geen schoonmakers beschikbaar → empty state
- [ ] API error → error bericht
- [ ] Terugkomen naar stap 3 → prefill werkt
- [ ] Datum in verleden → server error handling
- [ ] Ongeldige plaats → empty state

## Bekende Issues / TODO

### Navigatie naar Stap 4
**In drSchoonmakerForm.js:**
```javascript
const nextPageUrl = '/aanvraag-dieptereiniging/stap-4-persoonsgegevens';
```

⚠️ **Pas aan naar jouw daadwerkelijke Webflow page slug!**

Als je een custom navigator hebt, gebruik die:
```javascript
if (window.flowNavigator) {
  window.flowNavigator.goToStep(4);
}
```

### Beschikbaarheid Grid Styling
De beschikbaarheid grid wordt visueel gerenderd maar is niet interactief (zoals bij abonnement flow).
Elementen krijgen class `.beschikbaar` toegevoegd.

**CSS toevoegen:**
```css
[data-schoonmaker-dagdeel] {
  opacity: 0.3;
}

[data-schoonmaker-dagdeel].beschikbaar {
  opacity: 1;
  background-color: var(--brand-green);
}
```

### Foto Fallback
Momenteel geen fallback voor ontbrekende foto's.

**Toevoegen aan fillCleanerCard():**
```javascript
if (foto && cleaner.profielfoto) {
  foto.src = cleaner.profielfoto;
} else if (foto) {
  foto.src = '/images/placeholder-avatar.png'; // Voeg placeholder toe
}
```

## Volgende Stappen

### Stap 4: Persoonsgegevens
Kan waarschijnlijk hergebruiken van abonnement flow met kleine aanpassingen:
- Copy `abbPersoonsgegevensForm.js` → `drPersoonsgegevensForm.js`
- Pas storage keys aan: `dieptereiniging-aanvraag`
- Pas navigatie aan naar stap 5 (payment)

### Stap 5: Payment
Dieptereiniging is **one-time payment** (geen subscription):
- Gebruik Stripe Payment Intent (niet Subscription)
- Bedrag uit stap 2: `dr_prijs`
- Na succesvolle betaling: maak aanvraag in database
- Bevestigingsmail versturen

### Database Schema
Zorg dat `aanvragen` tabel one-time services kan opslaan:
- `type`: 'dieptereiniging' (niet 'abonnement')
- `datum`: specifieke datum (niet recurring)
- `status`: 'ingepland', 'voltooid', 'geannuleerd'
- Geen `dagdelen` veld nodig

## Commands om uit te voeren

### Deploy naar Vercel
```powershell
git add .
git commit -m "feat: add dieptereiniging schoonmaker selection (stap 3)"
git push
```

### Test API Endpoint lokaal (optioneel)
```powershell
vercel dev
```

Navigeer naar:
http://localhost:3000/api/routes/cleaners-dieptereiniging?plaats=Utrecht&datum=2024-06-15&minUren=4

## Samenvatting

✅ **Compleet:**
- Backend API endpoint
- Database SQL functie (moet nog uitgevoerd)
- Frontend form logic
- Schema definitie
- API client integratie
- Page orchestrator update

⏳ **Pending:**
- Jij: SQL uitvoeren in Supabase
- Jij: Webflow HTML verifiëren/aanpassen
- Jij: Testen end-to-end
- Later: Stap 4 en 5 bouwen

🎯 **Wat gebeurt er:**
1. User komt van stap 2 met plaats, datum, uren
2. Form laadt automatisch via page orchestrator
3. API call haalt schoonmakers op gefilterd op 08:00-10:00 tijdvenster
4. Schoonmaker kaarten worden gerenderd
5. User selecteert schoonmaker of "Geen voorkeur"
6. Submit slaat schoonmaker_id op
7. Navigatie naar stap 4 (persoonsgegevens)

Klaar om te testen! 🚀
