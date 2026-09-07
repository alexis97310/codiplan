-- CODIPLAN — Les identités sont cloisonnées PAR LA BASE (ticket L1-02c ;
-- invariant I1 ; arbitrages D34, D35, D39 ; règles RG-DRO-01, RG-SOC-03 ;
-- matrice §5.2 ; décision d'exploitation du 07/09/2026).
--
-- ── LA DÉCISION, ET LA REFORMULATION QUI L'A RENDUE POSSIBLE ───────────────
--
-- « Une garantie qui ne vit que dans la couche applicative n'en est pas une. »
-- `utilisateur` quitte donc la QUATRIÈME catégorie de I1.
--
-- La première formulation — « cloisonner les identités PAR LA SOCIÉTÉ » —
-- était intenable, et la mesure l'a montrée : **l'authentification PRÉCÈDE la
-- société.** Chercher « existe-t-il un compte pour ce courriel » se fait à un
-- moment où aucune société n'est connue et ne peut l'être ; sous une politique
-- de société, la lecture rendait ZÉRO et personne ne pouvait plus se connecter.
--
-- La bonne décomposition sépare DEUX LECTURES qu'on avait confondues :
--
--   * la VÉRIFICATION D'IDENTIFIANTS — à partir d'un courriel, trouver une
--     ligne et comparer une empreinte. Elle ne rend jamais d'identité à
--     personne, et elle porte DÉJÀ EN ENTRÉE la seule ligne qu'elle a le droit
--     de voir ;
--   * la LECTURE D'IDENTITÉS — nom, courriel, rôle d'autrui. Opération de
--     locataire, cloisonnée comme le reste.
--
-- ── LA FORME « DÉSIGNATION », ET SA BORNE ─────────────────────────────────
--
-- *La borne s'écrit avant le nom, parce que nommer cette forme sans la borner
-- serait pire que de ne pas la nommer : elle ressemble à une porte de service.*
--
-- Elle ne vaut QUE pour les opérations qui PRÉCÈDENT le contexte de locataire
-- — c'est-à-dire l'authentification, et rien d'autre. Le motif d'addition
-- recevable est unique et étroit : *l'opération se produit avant qu'une société
-- soit connue, et par construction ne peut pas l'être.* Sa liste de tables est
-- close à UNE entrée, gardée dans les deux sens comme les autres
-- (`TABLES_DESIGNATION` dans `scripts/lib/politiques-rls.ts`).
--
-- Ce qu'elle autorise : lire la ligne que l'appelant NOMMAIT DÉJÀ. Elle ne rend
-- donc jamais plus que ce que l'appelant savait avant d'interroger. Mesuré le
-- 07/09/2026 : variable nommant un courriel → 1 ligne, exactement celle-là ;
-- une AUTRE ligne nommément demandée → 0 ; par identifiant → 0 ; balayage
-- `LIKE '%'` → 1 ; `OR` sur deux courriels → 1 ; variable vide → 0 ; aucun
-- contexte → 0.
--
-- ── ET L'ÉCRITURE A SON EXPRESSION À ELLE ─────────────────────────────────
--
-- **Une politique qui n'énonce qu'un `USING` légifère en silence sur les
-- écritures** : PostgreSQL fait alors valoir la même expression en
-- `WITH CHECK`. Mesuré, et c'est ce qui a fait la règle — sous une politique
-- de lecture seule, la création de compte était REFUSÉE, parce qu'au moment où
-- l'identité est insérée son habilitation n'existe pas encore. Une expression
-- d'écriture dérivée de la lecture échoue pour cette seule raison.
--
-- Les politiques sont donc SÉPARÉES, et chaque écriture énonce son `WITH CHECK`
-- explicitement. Un gardien l'exige désormais de toute politique couvrant une
-- écriture, même quand elle répète le `USING` : pour que ce soit une DÉCISION
-- et non une conséquence.
--
-- ── QUI CRÉE UNE IDENTITÉ ──────────────────────────────────────────────────
--
-- **PERSONNE ne crée son propre compte.** Il n'y a pas d'inscription en
-- libre-service dans ce produit, et il ne doit pas y en avoir : ce n'est pas
-- une restriction, c'est le métier. Un compte de portail est délivré par CODIMA
-- à un client ; un compte interne est ouvert par l'administrateur de la
-- société.
--
-- Le rôle n'est pas inventé ici : la matrice du §5.2 porte la ligne
-- « Administrer les utilisateurs », et une seule colonne y est cochée —
-- `admin_societe` (D37, qui a scindé la colonne « Admin » précisément pour
-- cela). `lib/auth/habilitations.ts` la transcrit déjà ; un test compare les
-- deux, sur le modèle de `app_peut_consulter_journal_audit`.
--
-- **Ce que cette migration NE fait pas, et qui est borné :** l'ouverture par la
-- CONSOLE ÉDITEUR de la première identité d'une société cliente (lot 7). Elle
-- exigera sa propre branche — un rôle éditeur n'a aucune société active. Rien
-- ici ne l'empêche ; rien ici ne la construit.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. QUI PEUT ADMINISTRER LES IDENTITÉS
-- ═══════════════════════════════════════════════════════════════════════════
--
-- `SECURITY INVOKER` — le défaut, et il n'est pas écrit parce qu'on ne demande
-- pas ce qu'on ne veut pas (D50 reste close et vide).

CREATE FUNCTION "app_peut_administrer_identites"() RETURNS boolean
  LANGUAGE sql
  STABLE
  SET search_path = pg_catalog, public
  AS $$
    SELECT COALESCE("app_role"() = 'admin_societe', false)
  $$;

COMMENT ON FUNCTION "app_peut_administrer_identites"() IS
  'Vrai si le rôle courant peut ouvrir ou modifier une identité — matrice §5.2, ligne « Administrer les utilisateurs » : admin_societe SEUL (D37 a scindé la colonne « Admin » pour cela, et admin_plateforme n''y détient aucune ligne). Transcrite aussi dans lib/auth/habilitations.ts ; un test compare les deux.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. LA SÉCURITÉ AU NIVEAU DES LIGNES
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Les DEUX drapeaux : `ENABLE` ne concerne pas le propriétaire, et le seed
-- comme les migrations passent par lui. Ce qui ne se prouve pas par la lecture
-- se prouve par l'attribut (§9, 31/08).

ALTER TABLE "utilisateur" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "utilisateur" FORCE ROW LEVEL SECURITY;

-- ── LECTURE ────────────────────────────────────────────────────────────────
--
-- Deux branches, et elles ne se recouvrent pas : « désignation » vaut avant que
-- la société soit connue, « rattachement » vaut après.
--
-- La branche de rattachement se ferme pour un compte portail sur le MÊME
-- discriminant que le reste — `app.client_id` : **un compte portail n'a rien à
-- connaître du personnel de la société** (décision d'exploitation du
-- 07/09/2026). Aucune notion nouvelle, le même raisonnement que la forme
-- « habilitation ».
--
-- Les deux sous-requêtes sont elles-mêmes soumises aux politiques : la règle
-- est écrite UNE fois et se recompose, plutôt que deux clauses jumelles qui
-- divergeront (§9, 01/09).

CREATE POLICY "utilisateur_lecture" ON "utilisateur"
  FOR SELECT
  USING (
    -- Forme « DÉSIGNATION » — la ligne que l'appelant nommait déjà.
    "email" = NULLIF(current_setting('app.authentification_email', true), '')
    OR "id" = NULLIF(current_setting('app.authentification_utilisateur_id', true), '')::uuid
    -- Forme « RATTACHEMENT » — une identité de la société active.
    OR (
      NULLIF(current_setting('app.societe_id', true), '') IS NOT NULL
      AND (
        (
          NULLIF(current_setting('app.client_id', true), '') IS NULL
          AND EXISTS (
            SELECT 1 FROM "utilisateur_societe" "us"
             WHERE "us"."utilisateur_id" = "utilisateur"."id"
          )
        )
        OR EXISTS (
          SELECT 1 FROM "utilisateur_client" "uc"
           WHERE "uc"."utilisateur_id" = "utilisateur"."id"
        )
      )
    )
  );

-- ── OUVERTURE D'UNE IDENTITÉ ───────────────────────────────────────────────
--
-- `WITH CHECK` ÉCRIT, et volontairement SANS aucune condition sur la ligne
-- elle-même : au moment de l'insertion, l'identité n'a ni habilitation ni
-- société — c'est l'ORDRE des opérations, et une expression dérivée de la
-- lecture échouerait pour cette seule raison. Ce qui est vérifié est donc ce
-- qui peut l'être : QUI écrit, et sous quel contexte de société.

CREATE POLICY "utilisateur_ouverture" ON "utilisateur"
  FOR INSERT
  WITH CHECK (
    NULLIF(current_setting('app.societe_id', true), '') IS NOT NULL
    AND "app_peut_administrer_identites"()
  );

-- ── MODIFICATION D'UNE IDENTITÉ ────────────────────────────────────────────
--
-- `USING` dit QUELLES lignes sont modifiables — celles que le contexte voit
-- déjà, et jamais par « désignation » : la branche d'authentification lit, elle
-- n'écrit pas. `WITH CHECK` dit CE QU'ON A LE DROIT D'ÉCRIRE, et il est écrit
-- même s'il répète le `USING` en partie.

CREATE POLICY "utilisateur_modification" ON "utilisateur"
  FOR UPDATE
  USING (
    NULLIF(current_setting('app.societe_id', true), '') IS NOT NULL
    AND "app_peut_administrer_identites"()
    AND EXISTS (
      SELECT 1 FROM "utilisateur_societe" "us"
       WHERE "us"."utilisateur_id" = "utilisateur"."id"
    )
  )
  WITH CHECK (
    NULLIF(current_setting('app.societe_id', true), '') IS NOT NULL
    AND "app_peut_administrer_identites"()
  );

-- ── AUCUNE POLITIQUE DE SUPPRESSION, ET C'EST UNE DÉCISION ─────────────────
--
-- Sous `FORCE ROW LEVEL SECURITY`, un verbe sans politique est REFUSÉ pour
-- tout le monde. Supprimer une identité n'est pas une opération du produit :
-- le chapitre 22 parle de **conservation** (« comptes portail : suppression 12
-- mois après la fin de la relation »), qui est une purge de rétention à
-- construire au lot 7 avec sa propre décision, et non un geste d'écran.
-- L'absence est donc écrite ici plutôt que subie.

COMMENT ON TABLE "utilisateur" IS
  'Identité de plateforme. Globale par construction : une même personne travaille légitimement pour deux sociétés (RG-SOC-03), et la table ne porte donc AUCUN societe_id. Cloisonnée en base depuis L1-02c par deux formes qui ne se recouvrent pas — « désignation » avant que la société soit connue (authentification), « rattachement » après. AUCUNE donnée métier ici : fonction, agence, habilitations et préférences vivent dans utilisateur_societe et utilisateur_client, qui sont cloisonnées.';
