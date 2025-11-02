-- Test query voor get_beschikbare_schoonmakers_dieptereiniging
-- Voor dieptereiniging: specifieke datum en weekdag (niet recurring dagdelen)

-- ============================================================================
-- TEST 1: Basis test - Zoek schoonmakers in Amsterdam op maandag voor 4 uur
-- ============================================================================
SELECT 
  id,
  voornaam,
  achternaam,
  rating,
  plaats,
  beschikbaarheid
FROM get_beschikbare_schoonmakers_dieptereiniging(
  'Amsterdam',    -- plaats_input
  'maandag',      -- weekdag_input (maandag, dinsdag, woensdag, donderdag, vrijdag, zaterdag, zondag)
  4               -- gewenste_uren
);

-- ============================================================================
-- TEST 2: Weekend test - Zoek schoonmakers in Utrecht op zaterdag voor 3 uur
-- ============================================================================
SELECT 
  id,
  voornaam,
  achternaam,
  rating,
  plaats,
  beschikbaarheid
FROM get_beschikbare_schoonmakers_dieptereiniging(
  'Utrecht',      -- plaats_input
  'zaterdag',     -- weekdag_input
  3               -- gewenste_uren
);

-- ============================================================================
-- TEST 3: Lange klus - Zoek schoonmakers in Rotterdam op vrijdag voor 6 uur
-- ============================================================================
SELECT 
  id,
  voornaam,
  achternaam,
  rating,
  plaats,
  beschikbaarheid
FROM get_beschikbare_schoonmakers_dieptereiniging(
  'Rotterdam',    -- plaats_input
  'vrijdag',      -- weekdag_input
  6               -- gewenste_uren
);

-- ============================================================================
-- TEST 4: Detailed view - Bekijk beschikbaarheid in detail
-- ============================================================================
SELECT 
  id,
  voornaam || ' ' || achternaam as naam,
  rating,
  plaats,
  -- Unpack beschikbaarheid JSONB voor leesbare output
  jsonb_pretty(beschikbaarheid) as beschikbaarheid_detail
FROM get_beschikbare_schoonmakers_dieptereiniging(
  'Amsterdam',
  'dinsdag',
  4
);

-- ============================================================================
-- TEST 5: Check tijdvenster filtering (08:00-10:00 start)
-- Dit zou ALLEEN schoonmakers moeten tonen die tussen 08:00-10:00 kunnen starten
-- ============================================================================
SELECT 
  id,
  voornaam || ' ' || achternaam as naam,
  beschikbaarheid
FROM get_beschikbare_schoonmakers_dieptereiniging(
  'Amsterdam',
  'woensdag',
  4
)
-- Expand beschikbaarheid array om start tijden te verifiëren
CROSS JOIN jsonb_array_elements(beschikbaarheid) as slot
WHERE (slot->>'uur')::time >= '08:00' 
  AND (slot->>'uur')::time <= '10:00';

-- ============================================================================
-- TEST 6: Vergelijk met alle beschikbare uren (zonder tijd restrictie)
-- Dit toont het verschil tussen gefilterde (08:00-10:00) en ongefilterde data
-- ============================================================================

-- Eerst: schoonmakers met tijd restrictie (08:00-10:00)
SELECT 
  'MET tijdvenster filter (08:00-10:00)' as filter_type,
  COUNT(*) as aantal_schoonmakers
FROM get_beschikbare_schoonmakers_dieptereiniging(
  'Amsterdam',
  'maandag',
  4
);

-- Dan: check hoeveel schoonmakers beschikbaar zijn zonder tijd restrictie
-- (deze query toont conceptueel het verschil - de functie filtert altijd)
SELECT 
  'Conceptueel: ZONDER filter' as filter_type,
  COUNT(DISTINCT s.id) as aantal_schoonmakers
FROM schoonmakers s
JOIN user_profiles up ON s.user_id = up.id
JOIN adressen a ON up.adres_id = a.id
WHERE lower(a.plaats) = 'amsterdam'
  AND s.status = 'actief';

-- ============================================================================
-- TEST 7: Edge case - Vraag meer uren dan normaal beschikbaar
-- ============================================================================
SELECT 
  id,
  voornaam,
  achternaam,
  beschikbaarheid
FROM get_beschikbare_schoonmakers_dieptereiniging(
  'Amsterdam',
  'maandag',
  8  -- 8 uur (hele dag)
);

-- ============================================================================
-- TEST 8: Verschillende plaatsen (case-insensitive test)
-- ============================================================================
SELECT 
  'Test: amsterdam (lowercase)' as test_case,
  COUNT(*) as aantal
FROM get_beschikbare_schoonmakers_dieptereiniging('amsterdam', 'maandag', 4)
UNION ALL
SELECT 
  'Test: Amsterdam (capitalized)',
  COUNT(*)
FROM get_beschikbare_schoonmakers_dieptereiniging('Amsterdam', 'maandag', 4)
UNION ALL
SELECT 
  'Test: AMSTERDAM (uppercase)',
  COUNT(*)
FROM get_beschikbare_schoonmakers_dieptereiniging('AMSTERDAM', 'maandag', 4);

-- ============================================================================
-- HANDIGE QUERIES VOOR DEBUGGING
-- ============================================================================

-- Check welke dagen/uren een specifieke schoonmaker beschikbaar heeft
-- (vervang 123 met een echte schoonmaker_id uit je database)
/*
SELECT 
  s.id as schoonmaker_id,
  up.voornaam,
  up.achternaam,
  sb.dag,
  sb.uur,
  sb.status
FROM schoonmakers s
JOIN user_profiles up ON s.user_id = up.id
JOIN schoonmaker_beschikbaarheid sb ON s.id = sb.schoonmaker_id
WHERE s.id = 123  -- vervang met echte ID
  AND sb.dag = 'maandag'
  AND sb.uur >= '08:00'
  AND sb.uur <= '10:00'
ORDER BY sb.uur;
*/

-- Check of er überhaupt schoonmakers zijn in een plaats
/*
SELECT 
  a.plaats,
  COUNT(DISTINCT s.id) as aantal_schoonmakers
FROM schoonmakers s
JOIN user_profiles up ON s.user_id = up.id
JOIN adressen a ON up.adres_id = a.id
WHERE s.status = 'actief'
GROUP BY a.plaats
ORDER BY aantal_schoonmakers DESC;
*/

-- ============================================================================
-- VERWACHTE RESULTATEN
-- ============================================================================

/*
BELANGRIJKE KENMERKEN VAN DE RESULTATEN:

1. **Tijd Venster**: Alle beschikbaarheid start_tijd moet tussen 08:00-10:00 zijn
   
2. **Consecutieve Uren**: Als je 4 uur vraagt, moet de schoonmaker 4 aaneengesloten 
   uren beschikbaar hebben vanaf de start tijd
   
3. **Specifieke Weekdag**: Alleen beschikbaarheid op de opgegeven weekdag 
   (niet recurring zoals bij abonnementen)
   
4. **Sortering**: Resultaten zijn gesorteerd op:
   - rating DESC (hoogste rating eerst)
   - voornaam ASC (alfabetisch bij gelijke rating)
   
5. **Beschikbaarheid Format**: JSONB array met objecten:
   [
     {
       "dag": "maandag",
       "dagdeel": "ochtend",
       "start_tijd": "08:00:00",
       "eind_tijd": "12:00:00"
     }
   ]

6. **Case Insensitive**: Plaats matching is niet hoofdlettergevoelig

7. **Minimale Data**: Rating kan NULL zijn (sorteer dan als laatste)
*/
