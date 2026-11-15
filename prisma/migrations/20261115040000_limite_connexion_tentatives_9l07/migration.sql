-- ═══════════════════════════════════════════════════════════════════════════
-- 9L07-CONNEXION-TENTATIVES-LIMITEES — CINQ ÉCHECS SUR UN COMPTE, REFUS
-- TEMPORISÉ DE QUINZE MINUTES (décision d'Alexis du 10/11/2026 ; D258)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ## Ce que cette migration ajoute, et pourquoi une table plutôt qu'un compteur
--
-- Le refus doit se comporter EXACTEMENT de la même façon pour un compte
-- inexistant que pour un compte réel (D35) : la table ne peut donc pas être
-- une colonne de `utilisateur`, qui n'a pas de ligne pour un courriel inconnu.
-- `identifiant` porte le courriel TEL QUE SAISI (normalisé), que ce courriel
-- corresponde ou non à un compte — c'est ce qui rend les deux cas identiques
-- à ce niveau déjà, avant même la réponse HTTP.
--
-- Une ligne PAR ÉCHEC, et la fenêtre glissante de quinze minutes se calcule en
-- comptant les lignes dont `survenue_le` est récent — jamais en relisant un
-- compteur qu'il faudrait remettre à zéro à la bonne date, ce qui exigerait une
-- tâche planifiée que ce ticket n'ouvre pas.
--
-- ## Catégorie et forme (I1, D34)
--
-- Sixième table de la TROISIÈME catégorie de I1 — pas de `societe_id` du tout,
-- purgeable, l'authentification devant pouvoir s'exercer avant qu'aucune
-- société ne soit active. Liste close amendée par D258 : voir
-- `docs/arbitrages.md` et `docs/constitution/invariants.md` §3.
--
-- Forme « désignation », et elle RÉUTILISE deux variables EXISTANTES plutôt
-- que d'en ouvrir deux de plus :
--
--   * `app.authentification_email` — DÉJÀ posée pour désigner `utilisateur`
--     par le courriel que l'appelant vient de saisir (L1-02c). C'est très
--     exactement notre cas : « le courriel qu'il vient de saisir » est l'un
--     des trois exemples écrits de la forme (invariants.md §3, L1-02e).
--   * `app.adresse_ip` — déjà posée par `lib/db/rls.ts`, chapitre 11.2. Une
--     adresse n'est pas un secret, elle n'a donc pas besoin de l'être pour
--     servir de désignation : seul compte le fait qu'elle ne rend jamais plus
--     que ce que l'appelant savait déjà.
--
-- Les deux variables sont posées par `lib/auth/limiteur-connexion.ts`, à
-- travers l'enveloppe DÉJÀ existante de `lib/auth/lecture-identite.ts`
-- (`avecDesignationAuth`) — une entrée de plus dans `CLES_DESIGNATION`, pas un
-- mécanisme de plus.
--
-- ## Pourquoi aucune politique d'UPDATE
--
-- Une ligne de cette table est un ÉVÉNEMENT daté : elle ne se corrige jamais,
-- elle se COMPTE ou se SUPPRIME (la remise à zéro après succès). Sous `FORCE
-- ROW LEVEL SECURITY`, l'absence de politique refuse `UPDATE` pour tout le
-- monde — même refus que `GRANT` n'accorde pas ce verbe.

CREATE TABLE "tentative_connexion" (
  "id"          uuid PRIMARY KEY,
  "identifiant" text NOT NULL,
  "adresse_ip"  text,
  "survenue_le" timestamptz NOT NULL DEFAULT now()
);

-- Deux index, un par clé de désignation : l'un compte par compte, l'autre par
-- adresse — jamais les deux à la fois dans une même requête applicative.
CREATE INDEX "tentative_connexion_identifiant_idx"
  ON "tentative_connexion" ("identifiant", "survenue_le");
CREATE INDEX "tentative_connexion_adresse_ip_idx"
  ON "tentative_connexion" ("adresse_ip", "survenue_le")
  WHERE "adresse_ip" IS NOT NULL;

ALTER TABLE "tentative_connexion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tentative_connexion" FORCE ROW LEVEL SECURITY;

-- LECTURE — par identifiant (le compte dont on vérifie le mot de passe) OU
-- par adresse (les échecs d'une même adresse, tous comptes confondus). Les
-- deux branches sont indépendantes : chaque appel ne pose que la variable
-- dont il a besoin, l'autre valant alors NULL et ne satisfaisant jamais une
-- comparaison d'égalité.
CREATE POLICY "tentative_connexion_lecture" ON "tentative_connexion"
  FOR SELECT
  USING (
    "identifiant" = NULLIF(current_setting('app.authentification_email', true), '')
    OR (
      "adresse_ip" IS NOT NULL
      AND "adresse_ip" = NULLIF(current_setting('app.adresse_ip', true), '')
    )
  );

-- AJOUT — un échec, posé par le seul identifiant : l'adresse accompagne la
-- ligne mais ne gouverne pas le droit de l'écrire.
CREATE POLICY "tentative_connexion_ajout" ON "tentative_connexion"
  FOR INSERT
  WITH CHECK (
    "identifiant" = NULLIF(current_setting('app.authentification_email', true), '')
  );

-- PURGE — la remise à zéro après une connexion réussie, par le seul
-- identifiant : succès ou échec, cette table ne les distingue qu'en dateur
-- qui en ajoute une et qui en retire plusieurs.
CREATE POLICY "tentative_connexion_purge" ON "tentative_connexion"
  FOR DELETE
  USING (
    "identifiant" = NULLIF(current_setting('app.authentification_email', true), '')
  );

-- Les privilèges par défaut (`ALTER DEFAULT PRIVILEGES`) accordent les QUATRE
-- verbes à `codiplan_app` sur toute table neuve : `UPDATE` doit donc être
-- RETIRÉ explicitement, comme `journal_acces` le fait déjà pour `UPDATE` et
-- `DELETE` — sans quoi l'absence de politique d'`UPDATE` ne serait qu'une
-- intention, pas une garantie.
REVOKE UPDATE ON "tentative_connexion" FROM "codiplan_app";

COMMENT ON TABLE "tentative_connexion" IS
  'Échecs de connexion par mot de passe (D258). Troisième catégorie de I1. identifiant porte le courriel TEL QUE SAISI, compte réel ou non — c''est ce qui rend le refus identique dans les deux cas (D35). Cloisonnée par la forme « désignation », en réutilisant app.authentification_email et app.adresse_ip plutôt que d''ouvrir deux variables de plus. Aucune politique d''UPDATE : une ligne est un événement daté, elle se compte ou se supprime, elle ne se corrige jamais.';

-- ═══════════════════════════════════════════════════════════════════════════
-- L'ÉVÉNEMENT DE JOURNAL — REFUS TEMPORISÉ
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Journalisé seulement quand le courriel présenté correspond à un compte réel
-- (journal_acces.utilisateur_id est NOT NULL) — jamais pour un courriel qui ne
-- correspond à rien. Cette asymétrie, invisible à l'appelant puisque la
-- réponse HTTP est identique dans les deux cas, ne fuite rien (D35) : elle vit
-- entièrement du côté du journal, jamais du côté de la réponse.
ALTER TYPE "EvenementAcces" ADD VALUE 'connexion_temporisee';
