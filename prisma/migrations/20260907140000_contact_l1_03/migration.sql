-- CODIPLAN — Les contacts d'un client (ticket L1-03 ; invariants I1 et I8 ;
-- arbitrages D10, D22 ; règles RG-DRO-01, RG-INT-04, RG-INT-05 ; chapitre 3,
-- M1 ; décisions d'exploitation du 07/09/2026).
--
-- ── CE QUE LE BACKLOG DISAIT, ET CE QU'IL NE DISAIT PAS ────────────────────
--
-- « Contacts — rôles, préférences de notification. » Rien de plus : ni entrée
-- au chapitre 11, ni règle au chapitre 10. La session précédente s'est ARRÊTÉE
-- plutôt que de promouvoir le narratif du chapitre 3 au rang de modèle de
-- données. Les quatre décisions manquantes ont été prises par l'exploitation le
-- 07/09/2026 ; elles sont reprises ici, à l'endroit où elles s'appliquent.
--
-- ── 1. LE RATTACHEMENT ────────────────────────────────────────────────────
--
-- **Un contact appartient au CLIENT, avec un rattachement de site FACULTATIF.**
-- Le donneur d'ordre et le comptable sont ceux du client ; chez un client à
-- plusieurs sites, certains interlocuteurs ne concernent qu'un site. Les deux
-- lectures du chapitre 3 — « Contacts » au niveau client, « contact sur site »
-- au niveau site — étaient vraies : elles ne parlaient pas du même contact.
--
-- `client_id` est donc `NOT NULL`, `site_id` est `NULL`able, et cette nullité
-- porte du SENS : elle dit « ce contact est du client, pas d'un site ».
--
-- ── 2. LA FORME DE POLITIQUE : DÉDUITE, ET CE N'EST PAS UNE HUITIÈME ───────
--
-- Le réflexe serait de nommer une forme nouvelle, la clause étant
-- CONDITIONNELLE — le filtre de sites ne s'applique que si le contact porte un
-- site. La déduction dit non : **c'est la forme « parc », avec une
-- DISJONCTION**, et les trois axes sont exactement les mêmes.
--
--     société  ET  client  ET  ( pas de périmètre  OU  pas de site  OU  site du périmètre )
--
-- La branche `site_id IS NULL` n'ajoute pas un axe : elle dit qu'une ligne SANS
-- valeur sur l'axe du périmètre n'est pas filtrée par cet axe. `site` et
-- `machine` ne posaient pas la question parce que leur colonne de périmètre est
-- `NOT NULL` — l'occasion ne s'était jamais présentée.
--
-- **Et cette branche est le piège de ce ticket, nommé par l'exploitation avant
-- qu'il ne se produise :** *un contact sans site est un contact du client, il ne
-- doit pas disparaître pour un compte portail restreint à certains sites —
-- sinon on perd le comptable en restreignant un atelier.* L'oublier ne casse
-- rien de visible : la liste se raccourcit, et personne ne sait ce qui manque.
-- Un scénario l'éprouve nommément, et le gardien des formes exige désormais la
-- branche dès que la colonne de périmètre est nullable.
--
-- ── 3. LES RÔLES : UN ENSEMBLE, ET PAS UNE ÉNUMÉRATION EN BASE ─────────────
--
-- Un contact en porte PLUSIEURS : le donneur d'ordre est souvent aussi le
-- signataire. C'est donc un ensemble, jamais un scalaire.
--
-- **`text[]` et non un type énuméré**, pour la raison des zones inversée : une
-- société tierce aura d'autres rôles, et une énumération en base ferait de leur
-- ajout une MIGRATION. La liste connue est close à l'entrée serveur, dans
-- `lib/contacts/saisie.ts` — un ajout y est un changement de code, pas un
-- changement de schéma.
--
-- **RG-INT-04 a besoin de savoir qui signe, et c'est un RÔLE parmi l'ensemble,
-- pas une colonne à part.** Une colonne `est_signataire` aurait été une seconde
-- source du même fait, et deux sources d'un même fait divergent en silence
-- (§9, 01/09).
--
-- Ce que la base tient quand même, parce que c'est une propriété de l'ensemble
-- et non de son contenu : pas de doublon, pas d'entrée vide, au moins un rôle.
--
-- ── 4. LES CANAUX : E-MAIL SEULEMENT, SANS EN FAIRE UNE MIGRATION ──────────
--
-- Aucune passerelle SMS n'est en service et aucune n'est décidée. Le modèle ne
-- doit pas pour autant faire du SMS une migration : les préférences sont un
-- ENSEMBLE de canaux dont un seul est implémenté aujourd'hui.
--
-- **Le critère de bascule est enregistré et NON DATÉ** : le jour où une
-- passerelle SMS est en service. C'est une borne qui porte sa condition plutôt
-- qu'une date (§9, 01/09).
--
-- **Aucun envoi n'est écrit par ce ticket** : il pose la DONNÉE, pas la
-- notification. RG-INT-05 la consommera.

-- ═══════════════════════════════════════════════════════════════════════════
-- LA TABLE
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Table métier de la PREMIÈRE catégorie de I1 : `societe_id NOT NULL`, RLS
-- activée ET forcée, déclencheur d'audit (D55 — auditée à sa naissance, sans
-- qu'aucune liste soit à compléter).

CREATE TABLE "contact" (
    "id"          UUID    NOT NULL,
    "societe_id"  UUID    NOT NULL,
    "client_id"   UUID    NOT NULL,
    -- NULL = contact du CLIENT, et c'est un état signifiant, jamais un oubli.
    "site_id"     UUID,
    "nom"         TEXT    NOT NULL,
    "fonction"    TEXT,
    "telephone"   TEXT,
    "mobile"      TEXT,
    "email"       TEXT,
    "roles"       TEXT[]  NOT NULL DEFAULT ARRAY[]::TEXT[],
    "canaux"      TEXT[]  NOT NULL DEFAULT ARRAY['email']::TEXT[],
    "actif"       BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "contact_pkey" PRIMARY KEY ("id")
);

-- Ce que la base tient sur les ENSEMBLES : des PROPRIÉTÉS, jamais un contenu.
-- Le contenu est clos à l'entrée serveur, où l'étendre ne coûte pas une
-- migration.
--
-- **Une contrainte `CHECK` ne peut pas porter de sous-requête** — mesuré :
-- PostgreSQL refuse « cannot use subquery in check constraint ». La propriété
-- « pas de doublon » passe donc par une fonction IMMUTABLE, dont le corps a le
-- droit d'en contenir une. `SECURITY INVOKER`, le défaut : on ne demande pas ce
-- qu'on ne veut pas (D50, close et vide).
CREATE FUNCTION "app_tableau_sans_doublon"("valeurs" TEXT[]) RETURNS boolean
  LANGUAGE sql
  IMMUTABLE
  SET search_path = pg_catalog, public
  AS $$
    SELECT cardinality("valeurs")
         = (SELECT count(DISTINCT "v") FROM unnest("valeurs") AS "v")
  $$;

COMMENT ON FUNCTION "app_tableau_sans_doublon"(TEXT[]) IS
  'Vrai si le tableau ne contient aucun doublon. Passe par une fonction parce qu''une contrainte CHECK ne peut pas porter de sous-requête (mesuré). IMMUTABLE : PostgreSQL l''exige dans un CHECK.';

ALTER TABLE "contact"
  ADD CONSTRAINT "contact_nom_non_vide"
  CHECK (length(btrim("nom")) > 0);

-- Au moins un rôle, aucune entrée nulle ou vide, aucun doublon. La casse et
-- l'espacement sont normalisés à l'entrée serveur : la base refuse la chaîne
-- vide, elle ne fait pas de toilettage.
ALTER TABLE "contact"
  ADD CONSTRAINT "contact_roles_non_vides"
  CHECK (
    cardinality("roles") > 0
    AND array_position("roles", NULL) IS NULL
    AND NOT ('' = ANY("roles"))
    AND "app_tableau_sans_doublon"("roles")
  );

ALTER TABLE "contact"
  ADD CONSTRAINT "contact_canaux_non_vides"
  CHECK (
    cardinality("canaux") > 0
    AND array_position("canaux", NULL) IS NULL
    AND NOT ('' = ANY("canaux"))
    AND "app_tableau_sans_doublon"("canaux")
  );

-- Un contact joignable par courriel doit AVOIR un courriel. La contrainte dit
-- la dépendance entre deux colonnes plutôt que de la laisser à la relecture
-- (D56 : un nombre dont le sens dépend d'une autre colonne ne voyage jamais
-- seul — ici c'est une PRÉFÉRENCE dont le sens dépend d'une autre colonne).
ALTER TABLE "contact"
  ADD CONSTRAINT "contact_courriel_si_canal_email"
  CHECK (
    NOT ('email' = ANY("canaux"))
    OR ("email" IS NOT NULL AND length(btrim("email")) > 0)
  );

CREATE INDEX "contact_societe_id_client_id_idx" ON "contact" ("societe_id", "client_id");
CREATE INDEX "contact_societe_id_site_id_idx" ON "contact" ("societe_id", "site_id");

-- ═══════════════════════════════════════════════════════════════════════════
-- LES CLÉS, ET LEURS DEUX ACTIONS — chacune dite et justifiée (§9, 24/08)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "contact"
  ADD CONSTRAINT "contact_societe_id_fkey"
  FOREIGN KEY ("societe_id") REFERENCES "societe"("id")
  ON UPDATE RESTRICT ON DELETE RESTRICT;

-- Vers le CLIENT, société comprise : sans la société DANS la clé, un contact
-- pourrait désigner le client d'une AUTRE société, les contrôles d'intégrité
-- référentielle contournant les politiques RLS par construction.
--
-- `ON DELETE RESTRICT` : effacer un client dont des contacts dépendent est
-- refusé — `CASCADE` effacerait des interlocuteurs sans que personne l'ait
-- demandé, et RG-INT-04 s'appuie sur eux. `ON UPDATE RESTRICT` : `client.id`
-- est un UUID v7 technique (I10) et un client ne déménage pas d'une société à
-- l'autre (RG-SOC-04).
ALTER TABLE "contact"
  ADD CONSTRAINT "contact_client_fkey"
  FOREIGN KEY ("societe_id", "client_id")
  REFERENCES "client"("societe_id", "id")
  ON UPDATE RESTRICT ON DELETE RESTRICT;

-- Vers le SITE — et la clé porte le CLIENT, pas seulement la société.
--
-- Un contact rattaché à un site doit l'être à un site DE SON CLIENT. Une clé
-- `(societe_id, site_id)` ne le dirait pas : un contact du client A pourrait
-- porter le site du client B de la même société, et apparaître ou disparaître
-- selon le périmètre du mauvais compte. Le triplet le tient déclarativement —
-- aucun déclencheur, aucune vérification à la main.
--
-- FACULTATIVE, et c'est le `MATCH SIMPLE` de PostgreSQL — le défaut — qui la
-- rend telle : une clé étrangère dont une colonne vaut NULL n'est pas
-- contrôlée. C'est ici VOULU, `site_id` nul signifiant « contact du client ».
-- La leçon du 23/08 s'applique en sens inverse : la colonne est nullable parce
-- que sa nullité PORTE DU SENS, et non faute de valeur par défaut.
--
-- `ON DELETE RESTRICT` : supprimer un site dont un contact dépend est refusé.
-- **`SET NULL` aurait été le piège** — il transformerait EN SILENCE un contact
-- de site en contact de client, c'est-à-dire l'ÉLARGIRAIT à tous les comptes
-- portail du client. Retirer une restriction sans que personne l'ait demandé
-- est le pire sens dans lequel une action référentielle puisse se tromper
-- (§9, 24/08). `ON UPDATE RESTRICT` : `site.id` est un UUID v7 technique (I10).
CREATE UNIQUE INDEX "site_societe_id_client_id_id_key"
  ON "site" ("societe_id", "client_id", "id");

ALTER TABLE "contact"
  ADD CONSTRAINT "contact_site_du_client_fkey"
  FOREIGN KEY ("societe_id", "client_id", "site_id")
  REFERENCES "site"("societe_id", "client_id", "id")
  ON UPDATE RESTRICT ON DELETE RESTRICT;

-- ═══════════════════════════════════════════════════════════════════════════
-- LA POLITIQUE — forme « PARC », avec la disjonction qui sauve le comptable
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "contact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contact" FORCE ROW LEVEL SECURITY;

CREATE POLICY "cloisonnement_parc" ON "contact"
  USING (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    AND (
      NULLIF(current_setting('app.client_id', true), '') IS NULL
      OR "client_id" = NULLIF(current_setting('app.client_id', true), '')::uuid
    )
    AND (
      NULLIF(current_setting('app.perimetre_sites', true), '') IS NULL
      -- LA BRANCHE QUI SAUVE LE COMPTABLE : un contact sans site est un contact
      -- du CLIENT, il ne disparaît pas quand on restreint un atelier.
      OR "site_id" IS NULL
      OR "site_id" = ANY (
        string_to_array(NULLIF(current_setting('app.perimetre_sites', true), ''), ',')::uuid[]
      )
    )
  )
  WITH CHECK (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
    AND (
      NULLIF(current_setting('app.client_id', true), '') IS NULL
      OR "client_id" = NULLIF(current_setting('app.client_id', true), '')::uuid
    )
    AND (
      NULLIF(current_setting('app.perimetre_sites', true), '') IS NULL
      OR "site_id" IS NULL
      OR "site_id" = ANY (
        string_to_array(NULLIF(current_setting('app.perimetre_sites', true), ''), ',')::uuid[]
      )
    )
  );

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "contact"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

COMMENT ON COLUMN "contact"."site_id" IS
  'Rattachement de site FACULTATIF. NULL = contact du CLIENT — le donneur d''ordre, le comptable —, et cette nullité porte du sens : un tel contact ne disparaît PAS pour un compte portail restreint à certains sites. Non nul = contact d''un site, filtré par le périmètre. Le site doit appartenir au même client, et la clé composite (societe_id, client_id, site_id) le tient.';

COMMENT ON COLUMN "contact"."roles" IS
  'Ensemble, jamais un scalaire : le donneur d''ordre est souvent aussi le signataire. `text[]` et non un type énuméré — une société tierce aura d''autres rôles, et une énumération en base ferait de leur ajout une migration. La liste connue est close à l''entrée serveur (lib/contacts/saisie.ts). RG-INT-04 lit « signataire » ICI, il n''y a pas de colonne à part.';

COMMENT ON COLUMN "contact"."canaux" IS
  'Ensemble de canaux de notification. Un seul est implémenté — `email` —, et aucune passerelle SMS n''est en service ni décidée. Le modèle ne fait pas du SMS une migration : le jour où une passerelle SMS est en service, `sms` s''ajoute à la liste close de l''entrée serveur. Critère de bascule NON DATÉ, inscrit au registre.';
