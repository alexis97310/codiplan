-- ═══════════════════════════════════════════════════════════════════════════
-- LE TEMPS DE TRAJET PAR ZONE — le défaut de D23, réglable par société (R3-03)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- RG-PLA-05, amendée par D107 : *« le temps de trajet est mesuré depuis
-- l'agence de rattachement du site ; la valeur saisie fait foi, l'estimation
-- par zone n'est qu'un défaut appliqué en son absence. »*
--
-- Les six durées de cette estimation n'étaient **écrites nulle part** — mesuré
-- au ticket L3-05, et c'est le §8 du CLAUDE.md : *un délai non spécifié ne
-- s'invente pas.* D107 les a arrêtées : `grand_noumea` 30, `sud` 90,
-- `cote_ouest` 150, `cote_est` 240, `nord` 240, et `iles` AUCUNE.
--
-- ## POURQUOI UNE TABLE, ET NON SIX CONSTANTES
--
-- *« C'est l'ADV qui remplit les données, elle ne doit pas dépendre d'un
-- déploiement. »* Une constante du dépôt ferait d'une correction de terrain une
-- demande de fusion. Les valeurs de D107 restent au code — ce sont les valeurs
-- de RÉFÉRENCE, celles qu'un déploiement neuf propose — et cette table porte ce
-- qu'une société en CORRIGE.
--
-- **Elle ne remplace donc pas le défaut : elle le surcharge.** Une société sans
-- aucune ligne reçoit D107 ; retirer une ligne rend la main au défaut. C'est
-- pourquoi aucune ligne n'est semée et aucune colonne n'a de valeur par défaut :
-- *« non réglé » doit rester un état représentable*, comme « société sans
-- charte » l'est depuis L0-09. **Et zéro est refusé** : zéro se lirait
-- « l'agence est sur place » là où il faut lire « je ne sais pas encore » —
-- c'est la faute que `valorisation.ts` évite déjà sur un total inconnu.
--
-- ## LA ZONE EST DU TEXTE, ET C'EST UNE DÉCISION DÉJÀ PRISE
--
-- `lib/sites/zones.ts` l'écrit depuis D23, et `site.zone_geo` la suit : ces six
-- valeurs sont la géographie d'UN territoire. *`grand_noumea` n'a aucun sens
-- pour une société vendue en métropole*, et le jeu de démonstration en compte
-- déjà une. Un type énuméré ou un `CHECK` ferait de la carte de la
-- Nouvelle-Calédonie une contrainte du produit — la forme exacte de l'erreur du
-- 19/08 (`code_winpro`) et de celle du 20/08 (fermer une énumération avant
-- d'avoir tranché à qui l'on vend). La liste reste close à l'entrée serveur ;
-- l'ouvrir par société est l'objet de R3-04.
--
-- **Conséquence assumée, écrite ici plutôt que découverte :** la base accepterait
-- `koumac`, et rien ne l'appliquerait — la résolution part de l'énumération, pas
-- du catalogue. Une ligne orpheline est inerte, elle n'est jamais un défaut
-- silencieux.
--
-- **`iles` NE S'ÉCRIT PAS, et le refus est au niveau SERVEUR.** D107 :
-- *« déplacement par avion — estimation impossible, à saisir par
-- intervention ».* Un `CHECK "zone" <> 'iles'` aurait écrit un nom de zone
-- calédonien dans le schéma, ce que le paragraphe ci-dessus refuse ; la règle
-- vit donc dans `lib/sites/trajet-zone.ts`, d'où le schéma de saisie ET la
-- résolution la lisent — *une seule lecture du critère* (§9, 01/09). La
-- résolution rend `null` même si une ligne existait : la garantie ne vit pas
-- seulement dans la validation d'entrée.

CREATE TABLE "temps_trajet_zone" (
  "id"         uuid NOT NULL DEFAULT gen_random_uuid(),
  "societe_id" uuid NOT NULL,

  -- Voir l'entête : du TEXTE, et l'énumération n'est pas fermée en base.
  "zone"       text NOT NULL,

  -- Minutes de trajet ALLER depuis l'agence dont le site dépend.
  "minutes"    integer NOT NULL,

  "cree_le"    timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "modifie_le" timestamptz(3) NOT NULL,

  CONSTRAINT "temps_trajet_zone_pkey" PRIMARY KEY ("id"),

  -- Une zone vide n'est pas une zone.
  CONSTRAINT "temps_trajet_zone_zone_non_vide" CHECK (length(btrim("zone")) > 0),

  -- **Strictement positif, et borné à une journée.** Ce n'est pas une règle de
  -- gestion mais la longueur d'un jour — même nature que les bornes de
  -- `site.latitude`, qui sont celles de la mesure. Zéro est refusé pour la
  -- raison écrite en entête ; le plafond arrête la faute de frappe — un zéro de
  -- trop — avant qu'elle n'entre dans le dénominateur d'un taux d'occupation.
  CONSTRAINT "temps_trajet_zone_minutes_plausibles" CHECK ("minutes" > 0 AND "minutes" <= 1440)
);

-- UNE valeur par zone et par société : deux lignes pour la même zone rendraient
-- indécidable celle qui s'applique, et le choix se ferait alors sur l'ordre de
-- lecture — c'est-à-dire au hasard, rendu stable (L1-08g).
CREATE UNIQUE INDEX "temps_trajet_zone_societe_id_zone_key"
  ON "temps_trajet_zone" ("societe_id", "zone");
CREATE UNIQUE INDEX "temps_trajet_zone_societe_id_id_key"
  ON "temps_trajet_zone" ("societe_id", "id");

-- Les DEUX actions référentielles sont dites et justifiées (§9, 24/08).
-- `RESTRICT` en suppression : une société ne s'efface pas en laissant son
-- paramétrage orphelin. `RESTRICT` en mise à jour : `societe.id` est un UUID v7
-- technique (I10) qui ne change jamais, et le `CASCADE` par défaut de Prisma est
-- une décision prise par personne.
ALTER TABLE "temps_trajet_zone"
  ADD CONSTRAINT "temps_trajet_zone_societe_id_fkey"
    FOREIGN KEY ("societe_id") REFERENCES "societe"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ───────────────────────────────────────────────────────────────────────────
-- LE CLOISONNEMENT — forme « société »
-- ───────────────────────────────────────────────────────────────────────────
--
-- **Et le choix de la forme est écrit, parce qu'une table qui naît le doit.**
-- D94 a créé la forme « interne » pour les tables qu'aucun compte de portail ne
-- doit lire, et il a écrit ce qu'il laissait ouvert : *le jour où un écran ou une
-- route de portail lit une table de forme « société », la question vise la
-- CLASSE et non une table.*
--
-- Celle-ci prend la forme « société », et voici pourquoi elle n'est pas
-- « interne » : *le motif d'une entrée « interne » est ce que son retrait
-- ROUVRIRAIT*, et ici il n'y a rien. « Le trajet depuis l'agence vers la zone
-- Sud vaut 90 minutes » ne nomme ni client, ni site, ni personne, et n'apprend
-- rien du parc d'un tiers — au contraire des noms de fichiers du bac (D94), des
-- lignes d'un import (D100) ou d'une absence (L3-04), qui désignent tous
-- quelqu'un. *Écrire un motif faible aurait été inventer une cause que le
-- contrôle ne mesure pas* (§9, 10/09) ; cette table rejoint donc la classe que
-- D94 laisse ouverte, et sa condition de réouverture est celle de D94 — un écran
-- de portail qui lirait une table de forme « société ».
--
-- Le `WITH CHECK` est ÉCRIT même s'il répète le `USING` (L1-02c) : une politique
-- qui n'énonce qu'un `USING` légifère en silence sur les écritures.

ALTER TABLE "temps_trajet_zone" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "temps_trajet_zone" FORCE ROW LEVEL SECURITY;

CREATE POLICY "cloisonnement_societe" ON "temps_trajet_zone"
  USING ("societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid)
  WITH CHECK ("societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON "temps_trajet_zone" TO "codiplan_app";

-- ───────────────────────────────────────────────────────────────────────────
-- L'AUDIT (I8, D55)
-- ───────────────────────────────────────────────────────────────────────────
--
-- Le périmètre est INVERSÉ depuis D55 : toute table métier cloisonnée est
-- auditée, et le gardien la réclame le jour où elle apparaît. Elle le mérite
-- sans qu'on plaide : *une durée de trajet est le dénominateur d'un taux
-- d'occupation*, et qui l'a changée, quand, et depuis quelle valeur est
-- exactement ce qu'on cherchera le jour où un taux paraîtra faux.

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "temps_trajet_zone"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

COMMENT ON TABLE "temps_trajet_zone" IS
  'Le temps de trajet ALLER depuis l''agence, par zone géographique, tel qu''une société le corrige (R3-03, D107, RG-PLA-05). Table métier de la première catégorie de I1, forme « société ». Elle SURCHARGE les valeurs de référence de D107 qui vivent au code : une société sans ligne reçoit le défaut, et retirer une ligne rend la main au défaut — jamais à zéro. DONNÉE DE PLANIFICATION et rien d''autre (D74) : elle ne s''ajoute jamais aux heures facturées, le déplacement se facturant par forfait de zone (RG-INT-07).';

COMMENT ON COLUMN "temps_trajet_zone"."zone" IS
  'Du TEXTE, et l''énumération de D23 n''est pas fermée en base : ces six valeurs sont la géographie d''UN territoire, et les figer ferait de la carte de la Nouvelle-Calédonie une contrainte du produit. La liste est close à l''entrée serveur (lib/sites/zones.ts) ; l''ouvrir par société est l''objet de R3-04. La zone « iles » ne s''écrit PAS — « déplacement par avion, estimation impossible » (D107) —, et ce refus vit au serveur pour ne pas écrire un nom de zone calédonien dans le schéma.';

COMMENT ON COLUMN "temps_trajet_zone"."minutes" IS
  'Minutes de trajet ALLER depuis l''agence dont le site dépend (D56). Ce nombre ne veut rien dire seul : son référentiel est l''agence, jamais un autre site. Strictement positif — zéro se lirait « l''agence est sur place » là où il faut lire « je ne sais pas encore » — et borné à une journée, ce qui est la longueur d''un jour et non une règle de gestion.';
