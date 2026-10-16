-- CODIPLAN — Le déverrouillage du second facteur (L7-04) n'atteint que la
-- personne visée (D90, décision n° 90 d'Alexis, 13/10/2026, accord §8 du
-- CLAUDE.md pour une politique RLS ; 9F0-DEVERROUILLAGE-2F).
--
-- ── LE DÉFAUT MESURÉ ────────────────────────────────────────────────────
--
-- `deverrouillerSecondFacteur` écrit un `UPDATE … SET <constantes>` SANS
-- `WHERE` (voir `lib/auth/deverrouillage.ts` et
-- `20260909110000_deverrouillage_escalade_l7_04`) : c'est la politique
-- `second_facteur_deverrouillage`, et elle SEULE, qui choisit la ligne. Mais
-- les politiques PERMISSIVES d'une même commande se combinent par OR, et
-- `second_facteur_modification` (`20260908090000_categorie3_cloisonnee_
-- l1_02d`) en est une AUTRE, sur le MÊME verbe : sa branche
-- `utilisateur_id = app.utilisateur_id` matche la PROPRE ligne de l'auteur,
-- quel que soit son état de verrouillage — `app.utilisateur_id` porte
-- l'auteur sur TOUT contexte RLS (`lib/db/rls.ts`), déverrouillage compris.
--
-- Pour tout auteur qui a lui-même une ligne `second_facteur` — c'est-à-dire
-- tout `admin_societe` ou `direction` en production, le MFA étant imposé sur
-- les rôles sensibles (§2) — l'`UPDATE` sans `WHERE` touche alors DEUX
-- lignes : celle du sujet (via `second_facteur_deverrouillage`) et celle de
-- l'auteur (via `second_facteur_modification`). Le garde-fou du geste
-- (`count > 1` → `RefusDeverrouillage`, transaction annulée) s'en trouve
-- déclenché à chaque fois, et le geste échoue SYSTÉMATIQUEMENT.
--
-- ── POURQUOI UNE POLITIQUE RESTRICTIVE SÉPARÉE, ET NON UN ALTER ────────
--
-- Modifier `second_facteur_modification` — par exemple y ajouter une
-- condition d'exclusion du contexte de déverrouillage — rendrait cette
-- politique responsable de deux choses sans rapport : le droit ORDINAIRE de
-- modifier son propre second facteur, et le comportement d'un geste
-- administratif qu'elle ne nomme pas. `tests/isolation/
-- plancher-second-facteur.test.ts` la DROP puis la RECRÉE en dur dans un
-- scénario de jumeau : un `ALTER` y serait écrasé silencieusement par cette
-- épreuve existante, et l'épreuve n'a pas à connaître L7-04.
--
-- Une politique RESTRICTIVE séparée, elle, s'AND-combine à toutes les
-- permissives sans en modifier aucune : hors contexte de déverrouillage, son
-- `USING`/`WITH CHECK` valent toujours vrai — rien ne change pour les
-- chemins ordinaires (enrôlement, vérification, plancher D62) ; sous un
-- contexte de déverrouillage, elle borne CE qu'une permissive aurait
-- autrement laissé passer à la seule ligne désignée par
-- `app.deverrouillage_sujet_id`, quelle que soit la permissive qui l'a fait
-- matcher.

CREATE POLICY "second_facteur_deverrouillage_exclusif" ON "second_facteur"
  AS RESTRICTIVE
  FOR UPDATE
  USING (
    NULLIF(current_setting('app.deverrouillage_sujet_id', true), '') IS NULL
    OR "utilisateur_id"
       = NULLIF(current_setting('app.deverrouillage_sujet_id', true), '')::uuid
  )
  WITH CHECK (
    NULLIF(current_setting('app.deverrouillage_sujet_id', true), '') IS NULL
    OR "utilisateur_id"
       = NULLIF(current_setting('app.deverrouillage_sujet_id', true), '')::uuid
  );

COMMENT ON POLICY "second_facteur_deverrouillage_exclusif" ON "second_facteur" IS
  'D90 (décision n° 90 d''Alexis, 13/10/2026) — RESTRICTIVE, et c''est ce qui compte : hors contexte de déverrouillage (app.deverrouillage_sujet_id vide), elle vaut toujours vrai et ne change rien aux politiques ordinaires. Sous un contexte de déverrouillage (L7-04), elle borne toute politique PERMISSIVE combinée par OR — dont second_facteur_modification — à la seule ligne du sujet désigné, pour qu''un auteur doté de son propre second facteur (tout admin_societe ou direction en production) ne voie plus sa propre ligne comptée par l''UPDATE sans WHERE du geste.';
