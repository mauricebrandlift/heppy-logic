-- Database functie voor het ophalen van beschikbare schoonmakers voor dieptereiniging
-- Deze functie zoekt schoonmakers die op een specifieke weekdag beschikbaar zijn
-- met aansluitende uren vanaf 08:00-10:00

CREATE OR REPLACE FUNCTION get_beschikbare_schoonmakers_dieptereiniging(
  plaats_input text,
  weekdag_input text,
  gewenste_uren integer
)
RETURNS TABLE (
  id uuid,
  voornaam text,
  achternaam text,
  rating numeric,
  profielfoto text,
  plaats text,
  latitude numeric,
  longitude numeric,
  beschikbaarheid jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH params AS (
    SELECT
      lower(coalesce(plaats_input, ''))           AS plaats_norm,
      lower(coalesce(weekdag_input, ''))          AS weekdag_norm,
      greatest(ceiling(coalesce(gewenste_uren, 0)), 1) AS uren_required
  ),
  target_cleaners AS (
    SELECT
      s.id                                           AS schoonmaker_id,
      up.voornaam,
      up.achternaam,
      coalesce(avg(b.beoordeling), null)             AS rating,
      up.profielfoto,
      coalesce(addr.plaats, pd.plaats)               AS plaats,
      addr.latitude,
      addr.longitude
    FROM schoonmakers s
    JOIN user_profiles up           ON up.id = s.id
    LEFT JOIN adressen addr         ON addr.id = up.adres_id
    LEFT JOIN schoonmaker_plaatsen sp ON sp.schoonmaker_id = s.id
    LEFT JOIN plaatsen_dekking pd   ON pd.id = sp.plaats_id
    LEFT JOIN beoordelingen b        ON b.schoonmaker_id = s.id
    CROSS JOIN params p
    WHERE s.status = 'actief'
      AND coalesce(addr.plaats, pd.plaats) IS NOT NULL
      AND lower(coalesce(addr.plaats, pd.plaats)) = p.plaats_norm
    GROUP BY
      s.id, up.voornaam, up.achternaam, up.profielfoto,
      coalesce(addr.plaats, pd.plaats), addr.latitude, addr.longitude
  ),
  beschikbare_slots AS (
    SELECT
      tc.schoonmaker_id,
      tc.voornaam,
      tc.achternaam,
      tc.rating,
      tc.profielfoto,
      tc.plaats,
      tc.latitude,
      tc.longitude,
      sb.dag,
      sb.uur,
      row_number() OVER (PARTITION BY tc.schoonmaker_id, sb.dag ORDER BY sb.uur) AS rn,
      extract(hour FROM sb.uur)::int AS hour_int
    FROM target_cleaners tc
    JOIN schoonmaker_beschikbaarheid sb ON sb.schoonmaker_id = tc.schoonmaker_id
    CROSS JOIN params p
    WHERE sb.status = 'beschikbaar'
      AND lower(sb.dag) = p.weekdag_norm
      -- Alle beschikbare uren op deze dag (niet filteren op tijd hier)
  ),
  slots_met_groep AS (
    SELECT
      bs.*,
      (bs.hour_int - bs.rn) AS groep_id
    FROM beschikbare_slots bs
  ),
  consecutieve_blokken AS (
    SELECT
      schoonmaker_id,
      dag,
      min(uur) AS start_tijd,
      count(*) AS blok_uren
    FROM slots_met_groep
    GROUP BY schoonmaker_id, dag, groep_id
  ),
  geschikte_schoonmakers AS (
    SELECT DISTINCT
      bs.schoonmaker_id,
      bs.voornaam,
      bs.achternaam,
      bs.rating,
      bs.profielfoto,
      bs.plaats,
      bs.latitude,
      bs.longitude
    FROM slots_met_groep bs
    JOIN consecutieve_blokken cb
      ON cb.schoonmaker_id = bs.schoonmaker_id
     AND cb.dag = bs.dag
    CROSS JOIN params p
    WHERE cb.blok_uren >= p.uren_required
      -- BELANGRIJK: Het blok moet STARTEN tussen 08:00 en 10:00
      -- (maar mag doorlopen tot na 10:00 voor langere klussen)
      AND cb.start_tijd >= time '08:00' 
      AND cb.start_tijd <= time '10:00'
  ),
  beschikbaarheid_json AS (
    SELECT
      sb.schoonmaker_id,
      jsonb_agg(
        jsonb_build_object(
          'dag', sb.dag,
          'uur', to_char(sb.uur, 'HH24:MI'),
          'status', sb.status
        )
        ORDER BY sb.dag, sb.uur
      ) AS beschikbaarheid
    FROM schoonmaker_beschikbaarheid sb
    JOIN geschikte_schoonmakers gs ON gs.schoonmaker_id = sb.schoonmaker_id
    GROUP BY sb.schoonmaker_id
  )
  SELECT
    g.schoonmaker_id AS id,
    g.voornaam,
    g.achternaam,
    g.rating,
    g.profielfoto,
    g.plaats,
    g.latitude,
    g.longitude,
    bj.beschikbaarheid
  FROM geschikte_schoonmakers g
  JOIN beschikbaarheid_json bj ON bj.schoonmaker_id = g.schoonmaker_id
  ORDER BY coalesce(g.rating, 0) DESC NULLS LAST, g.voornaam;
END;
$$;

-- Grant execute rechten
GRANT EXECUTE ON FUNCTION get_beschikbare_schoonmakers_dieptereiniging(text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_beschikbare_schoonmakers_dieptereiniging(text, text, integer) TO service_role;
