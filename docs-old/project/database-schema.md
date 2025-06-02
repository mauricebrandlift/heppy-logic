# Database Schema

**Locatie:** `docs/project/database-schema.md`

## 1. Tabellen & Kolommen
| table_name                | column_name       | data_type                   | is_nullable | column_default                                |
| ------------------------- | ----------------- | --------------------------- | ----------- | --------------------------------------------- |
| abonnement_extra_diensten | id                | uuid                        | NO          | null                                          |
| abonnement_extra_diensten | abonnement_id     | uuid                        | YES         | null                                          |
| abonnement_extra_diensten | extra_dienst_id   | uuid                        | YES         | null                                          |
| abonnement_extra_diensten | actief            | boolean                     | YES         | null                                          |
| abonnement_extra_diensten | aangemaakt_op     | timestamp without time zone | YES         | null                                          |
| abonnement_pauzes         | id                | uuid                        | NO          | gen_random_uuid()                             |
| abonnement_pauzes         | abonnement_id     | uuid                        | YES         | null                                          |
| abonnement_pauzes         | startdatum        | date                        | NO          | null                                          |
| abonnement_pauzes         | einddatum         | date                        | YES         | null                                          |
| abonnement_pauzes         | reden             | text                        | YES         | null                                          |
| abonnement_pauzes         | aangemaakt_op     | timestamp without time zone | YES         | now()                                         |
| abonnement_wijzigingen    | id                | uuid                        | NO          | gen_random_uuid()                             |
| abonnement_wijzigingen    | abonnement_id     | uuid                        | YES         | null                                          |
| abonnement_wijzigingen    | wijziging_type    | text                        | YES         | null                                          |
| abonnement_wijzigingen    | oude_waarde       | text                        | YES         | null                                          |
| abonnement_wijzigingen    | nieuwe_waarde     | text                        | YES         | null                                          |
| abonnement_wijzigingen    | gewijzigd_door    | uuid                        | YES         | null                                          |
| abonnement_wijzigingen    | aangemaakt_op     | timestamp without time zone | YES         | now()                                         |
| abonnementen              | id                | uuid                        | NO          | gen_random_uuid()                             |
| abonnementen              | gebruiker_id      | uuid                        | YES         | null                                          |
| abonnementen              | schoonmaker_id    | uuid                        | YES         | null                                          |
| abonnementen              | uren              | numeric                     | YES         | null                                          |
| abonnementen              | startdatum        | date                        | YES         | null                                          |
| abonnementen              | status            | text                        | YES         | null                                          |
| abonnementen              | aangemaakt_op     | timestamp without time zone | YES         | now()                                         |
| adressen                  | id                | uuid                        | NO          | gen_random_uuid()                             |
| adressen                  | straat            | text                        | YES         | null                                          |
| adressen                  | huisnummer        | text                        | YES         | null                                          |
| adressen                  | toevoeging        | text                        | YES         | null                                          |
| adressen                  | postcode          | text                        | YES         | null                                          |
| adressen                  | plaats            | text                        | YES         | null                                          |
| adressen                  | aangemaakt_op     | timestamp with time zone    | YES         | now()                                         |
| adressen                  | latitude          | numeric                     | YES         | null                                          |
| adressen                  | longitude         | numeric                     | YES         | null                                          |
| audit_logs                | id                | uuid                        | NO          | gen_random_uuid()                             |
| audit_logs                | module            | text                        | YES         | null                                          |
| audit_logs                | entity_id         | uuid                        | YES         | null                                          |
| audit_logs                | action            | text                        | YES         | null                                          |
| audit_logs                | performed_by      | uuid                        | YES         | null                                          |
| audit_logs                | details           | jsonb                       | YES         | null                                          |
| audit_logs                | aangemaakt_op     | timestamp with time zone    | YES         | now()                                         |
| beoordelingen             | id                | uuid                        | NO          | gen_random_uuid()                             |
| beoordelingen             | gebruiker_id      | uuid                        | YES         | null                                          |
| beoordelingen             | schoonmaker_id    | uuid                        | YES         | null                                          |
| beoordelingen             | beoordeling       | numeric                     | NO          | null                                          |
| beoordelingen             | bericht           | text                        | YES         | null                                          |
| beoordelingen             | aangemaakt_op     | timestamp without time zone | YES         | now()                                         |
| berichten                 | id                | uuid                        | NO          | gen_random_uuid()                             |
| berichten                 | verzender_id      | uuid                        | YES         | null                                          |
| berichten                 | ontvanger_id      | uuid                        | YES         | null                                          |
| berichten                 | inhoud            | text                        | NO          | null                                          |
| berichten                 | gelezen           | boolean                     | YES         | false                                         |
| berichten                 | aangemaakt_op     | timestamp without time zone | YES         | now()                                         |
| betaling_correcties       | id                | uuid                        | NO          | null                                          |
| betaling_correcties       | betaling_id       | uuid                        | YES         | null                                          |
| betaling_correcties       | type              | text                        | YES         | null                                          |
| betaling_correcties       | reden             | text                        | YES         | null                                          |
| betaling_correcties       | bedrag            | numeric                     | YES         | null                                          |
| betaling_correcties       | aangemaakt_op     | timestamp without time zone | YES         | null                                          |
| betaling_entiteiten       | id                | uuid                        | NO          | gen_random_uuid()                             |
| betaling_entiteiten       | betaling_id       | uuid                        | NO          | null                                          |
| betaling_entiteiten       | entiteit_id       | uuid                        | NO          | null                                          |
| betaling_entiteiten       | entiteit_type     | text                        | YES         | null                                          |
| betalingen                | id                | uuid                        | NO          | gen_random_uuid()                             |
| betalingen                | gebruiker_id      | uuid                        | YES         | null                                          |
| betalingen                | bedrag            | numeric                     | YES         | null                                          |
| betalingen                | betaalmethode     | text                        | YES         | null                                          |
| betalingen                | status            | text                        | YES         | null                                          |
| betalingen                | stripe_payment_id | text                        | YES         | null                                          |
| betalingen                | aangemaakt_op     | timestamp without time zone | YES         | now()                                         |
| betalingen                | stripe_status     | text                        | YES         | null                                          |
| extra_diensten            | id                | uuid                        | NO          | gen_random_uuid()                             |
| extra_diensten            | naam              | text                        | NO          | null                                          |
| extra_diensten            | tijd              | integer                     | NO          | null                                          |
| extra_diensten            | aangemaakt_op     | timestamp with time zone    | YES         | (now() AT TIME ZONE 'Europe/Amsterdam'::text) |
| opdrachten                | id                | uuid                        | NO          | gen_random_uuid()                             |
| opdrachten                | gebruiker_id      | uuid                        | NO          | null                                          |
| opdrachten                | schoonmaker_id    | uuid                        | YES         | null                                          |
| opdrachten                | totaalbedrag      | numeric                     | YES         | null                                          |
| opdrachten                | status            | text                        | YES         | 'aangevraagd'::text                           |
| opdrachten                | aangemaakt_op     | timestamp with time zone    | YES         | now()                                         |
| opdrachten                | type              | text                        | NO          | 'onbekend'::text                              |
| opdrachten                | gegevens          | jsonb                       | YES         | '{}'::jsonb                                   |
| opdrachten                | betaalstatus      | text                        | YES         | 'n.v.t.'::text                                |
| opdrachten                | offerte_status    | text                        | YES         | 'nog_niet_verstuurd'::text                    |
| opdrachten                | offerte_bedrag    | numeric                     | YES         | null                                          |
| opdrachten                | offerte_datum     | date                        | YES         | null                                          |
| opdrachten                | opmerking         | text                        | YES         | null                                          |
| plaatsen_dekking          | id                | uuid                        | NO          | gen_random_uuid()                             |
| plaatsen_dekking          | plaats            | text                        | NO          | null                                          |
| plaatsen_dekking          | aangemaakt_op     | timestamp with time zone    | YES         | (now() AT TIME ZONE 'Europe/Amsterdam'::text) |
| prijs_configuratie        | id                | uuid                        | NO          | gen_random_uuid()                             |
| prijs_configuratie        | flow              | text                        | NO          | null                                          |
| prijs_configuratie        | config_key        | text                        | NO          | null                                          |
| prijs_configuratie        | config_value      | numeric                     | YES         | null                                          |
| prijs_configuratie        | config_json       | jsonb                       | YES         | null                                          |
| prijs_configuratie        | unit              | text                        | YES         | null                                          |
| prijs_configuratie        | active            | boolean                     | NO          | true                                          |
| prijs_configuratie        | created_at        | timestamp with time zone    | NO          | now()                                         |
| prijs_configuratie        | updated_at        | timestamp with time zone    | NO          | now()                                         |



## 2. Constraints
| constraint_name                                  | table_name                   | definition                                                                                                                            |
| ------------------------------------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| abonnement_extra_diensten_abonnement_id_fkey     | abonnement_extra_diensten    | FOREIGN KEY (abonnement_id) REFERENCES abonnementen(id)                                                                               |
| abonnement_extra_diensten_pkey                   | abonnement_extra_diensten    | PRIMARY KEY (id)                                                                                                                      |
| abonnement_pauzes_abonnement_id_fkey             | abonnement_pauzes            | FOREIGN KEY (abonnement_id) REFERENCES abonnementen(id) ON DELETE CASCADE                                                             |
| abonnement_pauzes_pkey                           | abonnement_pauzes            | PRIMARY KEY (id)                                                                                                                      |
| abonnement_wijzigingen_abonnement_id_fkey        | abonnement_wijzigingen       | FOREIGN KEY (abonnement_id) REFERENCES abonnementen(id) ON DELETE CASCADE                                                             |
| abonnement_wijzigingen_gewijzigd_door_fkey       | abonnement_wijzigingen       | FOREIGN KEY (gewijzigd_door) REFERENCES user_profiles(id)                                                                             |
| abonnement_wijzigingen_pkey                      | abonnement_wijzigingen       | PRIMARY KEY (id)                                                                                                                      |
| abonnement_wijzigingen_wijziging_type_check      | abonnement_wijzigingen       | CHECK ((wijziging_type = ANY (ARRAY['pauze'::text, 'opzegging'::text, 'extra_uren'::text, 'extra_diensten'::text])))                  |
| abonnementen_gebruiker_id_fkey                   | abonnementen                 | FOREIGN KEY (gebruiker_id) REFERENCES user_profiles(id)                                                                               |
| abonnementen_pkey                                | abonnementen                 | PRIMARY KEY (id)                                                                                                                      |
| abonnementen_schoonmaker_id_fkey                 | abonnementen                 | FOREIGN KEY (schoonmaker_id) REFERENCES schoonmakers(id)                                                                              |
| abonnementen_status_check                        | abonnementen                 | CHECK ((status = ANY (ARRAY['wachtrij'::text, 'actief'::text, 'gepauzeerd'::text, 'gestopt'::text])))                                 |
| adressen_pkey                                    | adressen                     | PRIMARY KEY (id)                                                                                                                      |
| audit_logs_performed_by_fkey                     | audit_logs                   | FOREIGN KEY (performed_by) REFERENCES user_profiles(id)                                                                               |
| audit_logs_pkey                                  | audit_logs                   | PRIMARY KEY (id)                                                                                                                      |
| beoordelingen_beoordeling_check                  | beoordelingen                | CHECK (((beoordeling >= (1)::numeric) AND (beoordeling <= (5)::numeric)))                                                             |
| beoordelingen_pkey                               | beoordelingen                | PRIMARY KEY (id)                                                                                                                      |
| berichten_pkey                                   | berichten                    | PRIMARY KEY (id)                                                                                                                      |
| betaling_correcties_betaling_id_fkey             | betaling_correcties          | FOREIGN KEY (betaling_id) REFERENCES betalingen(id)                                                                                   |
| betaling_correcties_pkey                         | betaling_correcties          | PRIMARY KEY (id)                                                                                                                      |
| betaling_correcties_type_check                   | betaling_correcties          | CHECK ((type = ANY (ARRAY['terugbetaling'::text, 'extra_kosten'::text])))                                                             |
| betaling_entiteiten_entiteit_type_check          | betaling_entiteiten          | CHECK ((entiteit_type = ANY (ARRAY['abonnement'::text, 'product'::text, 'opdracht'::text])))                                          |
| betaling_entiteiten_pkey                         | betaling_entiteiten          | PRIMARY KEY (id)                                                                                                                      |
| betalingen_gebruiker_id_fkey                     | betalingen                   | FOREIGN KEY (gebruiker_id) REFERENCES user_profiles(id)                                                                               |
| betalingen_pkey                                  | betalingen                   | PRIMARY KEY (id)                                                                                                                      |
| betalingen_status_check                          | betalingen                   | CHECK ((status = ANY (ARRAY['openstaand'::text, 'betaald'::text, 'mislukt'::text])))                                                  |
| betalingen_stripe_payment_id_key                 | betalingen                   | UNIQUE (stripe_payment_id)                                                                                                            |
| extra_diensten_pkey                              | extra_diensten               | PRIMARY KEY (id)                                                                                                                      |
| opdrachten_pkey                                  | opdrachten                   | PRIMARY KEY (id)                                                                                                                      |
| opdrachten_status_check                          | opdrachten                   | CHECK ((status = ANY (ARRAY['aangevraagd'::text, 'gepland'::text, 'voltooid'::text, 'geannuleerd'::text])))                           |
| plaatsen_dekking_pkey                            | plaatsen_dekking             | PRIMARY KEY (id)                                                                                                                      |
| plaatsen_dekking_plaats_key                      | plaatsen_dekking             | UNIQUE (plaats)                                                                                                                       |
| prijs_configuratie_flow_config_key_key           | prijs_configuratie           | UNIQUE (flow, config_key)                                                                                                             |
| prijs_configuratie_pkey                          | prijs_configuratie           | PRIMARY KEY (id)                                                                                                                      |
| schoonmaak_aanvragen_adres_id_fkey               | schoonmaak_aanvragen         | FOREIGN KEY (adres_id) REFERENCES adressen(id)                                                                                        |
| schoonmaak_aanvragen_pkey                        | schoonmaak_aanvragen         | PRIMARY KEY (id)                                                                                                                      |
| schoonmaak_aanvragen_schoonmaak_optie_check      | schoonmaak_aanvragen         | CHECK ((schoonmaak_optie = ANY (ARRAY['perweek'::text, 'pertweeweek'::text, 'eenmalig'::text])))                                      |
| schoonmaak_aanvragen_status_check                | schoonmaak_aanvragen         | CHECK ((status = ANY (ARRAY['open'::text, 'betaald'::text, 'geaccepteerd'::text, 'afgewezen'::text])))                                |
| schoonmaker_afwezigheid_pkey                     | schoonmaker_afwezigheid      | PRIMARY KEY (id)                                                                                                                      |
| schoonmaker_afwezigheid_schoonmaker_id_fkey      | schoonmaker_afwezigheid      | FOREIGN KEY (schoonmaker_id) REFERENCES schoonmakers(id)                                                                              |
| schoonmaker_beschikbaarheid_pkey                 | schoonmaker_beschikbaarheid  | PRIMARY KEY (id)                                                                                                                      |
| schoonmaker_beschikbaarheid_schoonmaker_id_fkey  | schoonmaker_beschikbaarheid  | FOREIGN KEY (schoonmaker_id) REFERENCES schoonmakers(id)                                                                              |
| schoonmaker_beschikbaarheid_status_check         | schoonmaker_beschikbaarheid  | CHECK ((status = ANY (ARRAY['beschikbaar'::text, 'bezet'::text, 'niet_beschikbaar'::text])))                                          |
| schoonmaker_match_abonnement_id_fkey             | schoonmaker_match            | FOREIGN KEY (abonnement_id) REFERENCES abonnementen(id)                                                                               |
| schoonmaker_match_pkey                           | schoonmaker_match            | PRIMARY KEY (id)                                                                                                                      |
| schoonmaker_match_schoonmaker_id_fkey            | schoonmaker_match            | FOREIGN KEY (schoonmaker_id) REFERENCES schoonmakers(id)                                                                              |
| schoonmaker_match_status_check                   | schoonmaker_match            | CHECK ((status = ANY (ARRAY['open'::text, 'geaccepteerd'::text, 'geweigerd'::text, 'verlopen'::text])))                               |
| schoonmakers_plaatsen_pkey                       | schoonmaker_plaatsen         | PRIMARY KEY (id)                                                                                                                      |
| schoonmakers_plaatsen_plaats_id_fkey             | schoonmaker_plaatsen         | FOREIGN KEY (plaats_id) REFERENCES plaatsen_dekking(id) ON DELETE CASCADE                                                             |
| schoonmaker_stopgeschiedenis_pkey                | schoonmaker_stopgeschiedenis | PRIMARY KEY (id)                                                                                                                      |
| schoonmakers_pkey                                | schoonmakers                 | PRIMARY KEY (id)                                                                                                                      |
| schoonmakers_status_check                        | schoonmakers                 | CHECK ((status = ANY (ARRAY['wachtend'::text, 'actief'::text, 'inactief'::text, 'verbannen'::text])))                                 |
| uitbetaling_transacties_betaling_id_fkey         | uitbetaling_transacties      | FOREIGN KEY (betaling_id) REFERENCES betalingen(id) ON DELETE CASCADE                                                                 |
| uitbetaling_transacties_pkey                     | uitbetaling_transacties      | PRIMARY KEY (id)                                                                                                                      |
| uitbetaling_transacties_uitbetaling_id_fkey      | uitbetaling_transacties      | FOREIGN KEY (uitbetaling_id) REFERENCES uitbetalingen(id) ON DELETE CASCADE                                                           |
| uitbetalingen_pkey                               | uitbetalingen                | PRIMARY KEY (id)                                                                                                                      |
| uitbetalingen_schoonmaker_id_fkey                | uitbetalingen                | FOREIGN KEY (schoonmaker_id) REFERENCES schoonmakers(id)                                                                              |
| uitbetalingen_status_check                       | uitbetalingen                | CHECK ((status = ANY (ARRAY['in afwachting'::text, 'uitbetaald'::text, 'geannuleerd'::text])))                                        |
| user_profiles_adres_id_fkey                      | user_profiles                | FOREIGN KEY (adres_id) REFERENCES adressen(id)                                                                                        |
| user_profiles_pkey                               | user_profiles                | PRIMARY KEY (id)                                                                                                                      |
| user_profiles_rol_check                          | user_profiles                | CHECK ((rol = ANY (ARRAY['klant'::text, 'schoonmaker'::text, 'admin'::text])))                                                        |
| voorkeurs_dagdelen_abonnement_id_dag_tijdvak_key | voorkeurs_dagdelen           | UNIQUE (abonnement_id, dag, tijdvak)                                                                                                  |
| voorkeurs_dagdelen_dag_check                     | voorkeurs_dagdelen           | CHECK ((dag = ANY (ARRAY['maandag'::text, 'dinsdag'::text, 'woensdag'::text, 'donderdag'::text, 'vrijdag'::text, 'zaterdag'::text]))) |
| voorkeurs_dagdelen_pkey                          | voorkeurs_dagdelen           | PRIMARY KEY (id)                                                                                                                      |
| voorkeurs_dagdelen_tijdvak_check                 | voorkeurs_dagdelen           | CHECK ((tijdvak = ANY (ARRAY['ochtend'::text, 'middag'::text, 'avond'::text])))                                                       |
| wachtlijst_aanvragen_pkey                        | wachtlijst_aanvragen         | PRIMARY KEY (id)                                                                                                                      |
| webhooks_pkey                                    | webhooks                     | PRIMARY KEY (id)                                                                                                                      |
| webhooks_status_check                            | webhooks                     | CHECK ((status = ANY (ARRAY['ontvangen'::text, 'verwerkt'::text, 'fout'::text])))                                                     |


## 3. Indexes
| table_name                   | index_name                                       | definition                                                                                                                                  |
| ---------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| abonnement_extra_diensten    | abonnement_extra_diensten_pkey                   | CREATE UNIQUE INDEX abonnement_extra_diensten_pkey ON public.abonnement_extra_diensten USING btree (id)                                     |
| abonnement_pauzes            | abonnement_pauzes_pkey                           | CREATE UNIQUE INDEX abonnement_pauzes_pkey ON public.abonnement_pauzes USING btree (id)                                                     |
| abonnement_wijzigingen       | abonnement_wijzigingen_pkey                      | CREATE UNIQUE INDEX abonnement_wijzigingen_pkey ON public.abonnement_wijzigingen USING btree (id)                                           |
| abonnementen                 | abonnementen_pkey                                | CREATE UNIQUE INDEX abonnementen_pkey ON public.abonnementen USING btree (id)                                                               |
| adressen                     | adressen_pkey                                    | CREATE UNIQUE INDEX adressen_pkey ON public.adressen USING btree (id)                                                                       |
| audit_logs                   | audit_logs_pkey                                  | CREATE UNIQUE INDEX audit_logs_pkey ON public.audit_logs USING btree (id)                                                                   |
| beoordelingen                | beoordelingen_pkey                               | CREATE UNIQUE INDEX beoordelingen_pkey ON public.beoordelingen USING btree (id)                                                             |
| berichten                    | berichten_pkey                                   | CREATE UNIQUE INDEX berichten_pkey ON public.berichten USING btree (id)                                                                     |
| betaling_correcties          | betaling_correcties_pkey                         | CREATE UNIQUE INDEX betaling_correcties_pkey ON public.betaling_correcties USING btree (id)                                                 |
| betaling_entiteiten          | betaling_entiteiten_pkey                         | CREATE UNIQUE INDEX betaling_entiteiten_pkey ON public.betaling_entiteiten USING btree (id)                                                 |
| betalingen                   | betalingen_pkey                                  | CREATE UNIQUE INDEX betalingen_pkey ON public.betalingen USING btree (id)                                                                   |
| betalingen                   | betalingen_stripe_payment_id_key                 | CREATE UNIQUE INDEX betalingen_stripe_payment_id_key ON public.betalingen USING btree (stripe_payment_id)                                   |
| extra_diensten               | extra_diensten_pkey                              | CREATE UNIQUE INDEX extra_diensten_pkey ON public.extra_diensten USING btree (id)                                                           |
| opdrachten                   | opdrachten_pkey                                  | CREATE UNIQUE INDEX opdrachten_pkey ON public.opdrachten USING btree (id)                                                                   |
| plaatsen_dekking             | plaatsen_dekking_pkey                            | CREATE UNIQUE INDEX plaatsen_dekking_pkey ON public.plaatsen_dekking USING btree (id)                                                       |
| plaatsen_dekking             | plaatsen_dekking_plaats_key                      | CREATE UNIQUE INDEX plaatsen_dekking_plaats_key ON public.plaatsen_dekking USING btree (plaats)                                             |
| prijs_configuratie           | prijs_configuratie_flow_config_key_key           | CREATE UNIQUE INDEX prijs_configuratie_flow_config_key_key ON public.prijs_configuratie USING btree (flow, config_key)                      |
| prijs_configuratie           | prijs_configuratie_pkey                          | CREATE UNIQUE INDEX prijs_configuratie_pkey ON public.prijs_configuratie USING btree (id)                                                   |
| schoonmaak_aanvragen         | schoonmaak_aanvragen_pkey                        | CREATE UNIQUE INDEX schoonmaak_aanvragen_pkey ON public.schoonmaak_aanvragen USING btree (id)                                               |
| schoonmaker_afwezigheid      | schoonmaker_afwezigheid_pkey                     | CREATE UNIQUE INDEX schoonmaker_afwezigheid_pkey ON public.schoonmaker_afwezigheid USING btree (id)                                         |
| schoonmaker_beschikbaarheid  | schoonmaker_beschikbaarheid_pkey                 | CREATE UNIQUE INDEX schoonmaker_beschikbaarheid_pkey ON public.schoonmaker_beschikbaarheid USING btree (id)                                 |
| schoonmaker_match            | schoonmaker_match_pkey                           | CREATE UNIQUE INDEX schoonmaker_match_pkey ON public.schoonmaker_match USING btree (id)                                                     |
| schoonmaker_plaatsen         | schoonmakers_plaatsen_pkey                       | CREATE UNIQUE INDEX schoonmakers_plaatsen_pkey ON public.schoonmaker_plaatsen USING btree (id)                                              |
| schoonmaker_stopgeschiedenis | schoonmaker_stopgeschiedenis_pkey                | CREATE UNIQUE INDEX schoonmaker_stopgeschiedenis_pkey ON public.schoonmaker_stopgeschiedenis USING btree (id)                               |
| schoonmakers                 | schoonmakers_pkey                                | CREATE UNIQUE INDEX schoonmakers_pkey ON public.schoonmakers USING btree (id)                                                               |
| uitbetaling_transacties      | uitbetaling_transacties_pkey                     | CREATE UNIQUE INDEX uitbetaling_transacties_pkey ON public.uitbetaling_transacties USING btree (id)                                         |
| uitbetalingen                | uitbetalingen_pkey                               | CREATE UNIQUE INDEX uitbetalingen_pkey ON public.uitbetalingen USING btree (id)                                                             |
| user_profiles                | user_profiles_pkey                               | CREATE UNIQUE INDEX user_profiles_pkey ON public.user_profiles USING btree (id)                                                             |
| voorkeurs_dagdelen           | voorkeurs_dagdelen_abonnement_id_dag_tijdvak_key | CREATE UNIQUE INDEX voorkeurs_dagdelen_abonnement_id_dag_tijdvak_key ON public.voorkeurs_dagdelen USING btree (abonnement_id, dag, tijdvak) |
| voorkeurs_dagdelen           | voorkeurs_dagdelen_pkey                          | CREATE UNIQUE INDEX voorkeurs_dagdelen_pkey ON public.voorkeurs_dagdelen USING btree (id)                                                   |
| wachtlijst_aanvragen         | wachtlijst_aanvragen_pkey                        | CREATE UNIQUE INDEX wachtlijst_aanvragen_pkey ON public.wachtlijst_aanvragen USING btree (id)                                               |
| webhooks                     | webhooks_pkey                                    | CREATE UNIQUE INDEX webhooks_pkey ON public.webhooks USING btree (id)                                                                       |