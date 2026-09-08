-- CODIPLAN — Taux horaire historisé (ticket L1-07 ; RG-TAR-01, RG-TAR-03,
-- RG-TAR-04 ; invariants I1, I2, I3 ; décision d'exploitation du 08/09/2026).
--
-- ── LA RÈGLE, ET POURQUOI ELLE EST UNE TABLE ET NON UNE COLONNE ────────────
--
-- RG-TAR-04 : *« Le taux horaire est historisé. Un changement de taux ne modifie
-- pas les interventions déjà valorisées. »* Et la décision d'exploitation le dit
-- dans les termes de l'usage : **une intervention se facture au taux en vigueur
-- à SA date, pas au taux d'aujourd'hui. Une facture qui change quand le tarif
-- change est une facture fausse.**
--
-- Une colonne ne peut pas porter cela : elle porte UNE valeur, celle de
-- maintenant. Il faut une ligne par **date d'effet**, et la lecture choisit la
-- plus récente qui ne soit pas postérieure à la date cherchée.
--
-- ── LE MONTANT EST UN ENTIER, ET IL NE VOYAGE JAMAIS SANS SA DEVISE ────────
--
-- `montant_mineur BIGINT` — la valeur dans l'unité la plus fine de la devise,
-- exactement la forme de `Montant` dans `lib/money` : 7 000 pour 7 000 XPF (zéro
-- décimale), 6 500 pour 65,00 EUR (deux décimales). **Jamais un flottant** : I3
-- fait des décimales une propriété de la DEVISE, et un `numeric` obligerait
-- chaque lecture à se rappeler laquelle.
--
-- `devise_code` l'accompagne, et c'est I2 : *jamais un montant sans son code.*
-- Il est chaîné à `devise`, et il est **redondant** avec `societe.devise_code` —
-- redondance ASSUMÉE et contrainte, pas subie : un taux lu sans sa devise est un
-- nombre, et un nombre n'est pas un montant. Un déclencheur refuse qu'il
-- s'écarte de celui de sa société ; la redondance est donc un CONSTAT, pas une
-- seconde source (§9, 01/09).
--
-- ── CE QUE CETTE MIGRATION NE FAIT PAS, ET QUI EST INSCRIT AU REGISTRE ─────
--
-- **Elle ne touche pas à `societe.taux_horaire_defaut`**, et elle n'y touche pas
-- par prudence mesurée. Cette colonne est un `DECIMAL(18,4)` : elle porte
-- `7000.0000` pour CODIMA-NC et **`65.0000`** pour CODIMA-EU. Dans la forme
-- entière ci-dessous, le second vaut **6500**. *Ce ne sont pas les mêmes
-- nombres*, et faire passer l'un pour l'autre serait très exactement la faute
-- que I2 et I3 interdisent. Déplacer cette valeur est une **migration de donnée
-- monétaire** : elle appartient à l'exploitation, et la question est au registre.
--
-- **Et la table naît VIDE.** Le taux de CODIMA est connu — 7 000 XPF, au
-- chapitre 1 du cahier des charges et dans le seed — mais **sa DATE D'EFFET ne
-- l'est pas**, et c'est elle que la table exige. L'inventer serait inventer une
-- donnée métier (CLAUDE.md §8). Ce que ce vide empêche est écrit au registre :
-- tant qu'aucune ligne n'existe, RG-TAR-04 n'a rien à appliquer.

CREATE TABLE "taux_horaire" (
  "id" UUID NOT NULL,
  "societe_id" UUID NOT NULL,

  -- Le jour à partir duquel ce taux s'applique. Une DATE et non un instant : un
  -- tarif change un jour, pas à une heure — et le fuseau de l'agence n'a rien à
  -- dire ici.
  "date_effet" DATE NOT NULL,

  -- La valeur, en unités les plus fines de la devise. Voir l'en-tête.
  "montant_mineur" BIGINT NOT NULL,
  "devise_code" TEXT NOT NULL,

  CONSTRAINT "taux_horaire_pkey" PRIMARY KEY ("id")
);

-- Un taux négatif n'est pas un tarif. Zéro non plus — une prestation gratuite se
-- dit par un forfait à zéro, pas par un taux horaire nul qui rendrait toute
-- heure excédentaire invisible.
ALTER TABLE "taux_horaire"
  ADD CONSTRAINT "taux_horaire_montant_positif"
  CHECK ("montant_mineur" > 0);

-- UNE ligne par date d'effet et par société : deux taux le même jour ne
-- décideraient rien, et la lecture devrait choisir.
CREATE UNIQUE INDEX "taux_horaire_societe_id_date_effet_key"
  ON "taux_horaire" ("societe_id", "date_effet");

-- L'index de LECTURE, et il porte la requête réelle : « le dernier taux dont la
-- date d'effet ne dépasse pas celle de l'intervention ».
CREATE INDEX "taux_horaire_societe_id_date_effet_desc_idx"
  ON "taux_horaire" ("societe_id", "date_effet" DESC);

ALTER TABLE "taux_horaire"
  ADD CONSTRAINT "taux_horaire_societe_id_fkey"
  FOREIGN KEY ("societe_id") REFERENCES "societe"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Les DEUX actions sont dites (D49). `RESTRICT` en suppression : une devise dont
-- des taux dépendent ne s'efface pas. `RESTRICT` en mise à jour : `devise.code`
-- est un code ISO, il ne change pas — et le défaut `CASCADE` de Prisma
-- répondrait tout seul à une question que personne n'a posée.
ALTER TABLE "taux_horaire"
  ADD CONSTRAINT "taux_horaire_devise_code_fkey"
  FOREIGN KEY ("devise_code") REFERENCES "devise"("code")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ── LA DEVISE DU TAUX EST CELLE DE SA SOCIÉTÉ, ET LA BASE LE TIENT ────────
--
-- RG-TAR-01 : *chaque société porte une devise de référence, et les montants
-- sont stockés dans cette devise.* Une clé étrangère composite l'aurait dit
-- déclarativement — mais elle aurait exigé `UNIQUE (id, devise_code)` sur
-- `societe`, c'est-à-dire de faire entrer la devise dans une clé, et **changer
-- la devise d'une société deviendrait alors une propagation** : très exactement
-- ce que D49 refuse ailleurs.
--
-- Le déclencheur dit la même chose sans figer la devise dans une clé, et son
-- message donne la marche à suivre plutôt qu'un code d'erreur.
CREATE OR REPLACE FUNCTION "taux_horaire_devise_de_la_societe"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  attendue TEXT;
BEGIN
  SELECT "devise_code" INTO attendue FROM "societe" WHERE "id" = NEW."societe_id";

  -- La société est-elle seulement lisible ? Sous RLS, un contexte qui ne la voit
  -- pas rendrait NULL — et la comparaison serait vraie de rien. On refuse
  -- plutôt que de laisser passer : un décompte nul ressemble à un sans-faute.
  IF attendue IS NULL THEN
    RAISE EXCEPTION
      'Impossible de lire la devise de la société de ce taux horaire. Écrire un taux exige un contexte qui voit sa société.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW."devise_code" IS DISTINCT FROM attendue THEN
    RAISE EXCEPTION
      'Un taux horaire porte la devise de sa société. Corriger la devise du taux, ou celle de la société — jamais les deux séparément.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "taux_horaire_devise_de_la_societe"
  BEFORE INSERT OR UPDATE ON "taux_horaire"
  FOR EACH ROW
  EXECUTE FUNCTION "taux_horaire_devise_de_la_societe"();

ALTER TABLE "taux_horaire" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "taux_horaire" FORCE ROW LEVEL SECURITY;

-- Forme « SOCIÉTÉ » — DÉDUITE, non recopiée. Un taux horaire n'est la donnée
-- d'aucun client : rien ne le rattache à `app.client_id` ni à un périmètre de
-- sites, et la forme « parc » le cacherait à un compte portail qui a pourtant le
-- droit de comprendre sa propre facture. Ce n'est pas non plus un référentiel de
-- plateforme : un tarif est **commercial**, donc propre à chaque société — D4 le
-- dit déjà de `prestation` et `forfait`.
CREATE POLICY "cloisonnement_societe" ON "taux_horaire"
  USING (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
  )
  WITH CHECK (
    "societe_id" = NULLIF(current_setting('app.societe_id', true), '')::uuid
  );

CREATE TRIGGER "journal_audit" AFTER INSERT OR UPDATE OR DELETE ON "taux_horaire"
  FOR EACH ROW EXECUTE FUNCTION "journal_audit_tracer"();

COMMENT ON TABLE "taux_horaire" IS
  'Taux horaire d''une société, HISTORISÉ par date d''effet (RG-TAR-04). Une intervention se facture au taux en vigueur à SA date : une facture qui change quand le tarif change est une facture fausse. Le montant est un ENTIER en unités les plus fines de la devise — la forme de lib/money — et il ne voyage jamais sans son code de devise (I2, I3).';

COMMENT ON COLUMN "taux_horaire"."montant_mineur" IS
  'Valeur entière dans l''unité la plus fine de la devise : 7000 pour 7 000 XPF (zéro décimale), 6500 pour 65,00 EUR (deux décimales). Jamais un flottant — les décimales sont une propriété de la devise (I3), et un numeric obligerait chaque lecture à se rappeler laquelle.';
