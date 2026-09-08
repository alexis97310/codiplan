-- ═══════════════════════════════════════════════════════════════════════════
-- Q3 — `societe.taux_horaire_defaut` EST RETIRÉE
-- Arbitrage d'exploitation du 09/09/2026. Ferme la divergence ouverte par L1-07.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ## La divergence, et elle était DÉJÀ EN VALEUR
--
-- Depuis L1-07, deux sources disent le même fait : la colonne
-- `societe.taux_horaire_defaut` (`DECIMAL(18,4)`) et la table `taux_horaire`
-- (entier + code de devise, par date d'effet). Elles ne disent pas le même
-- nombre — la colonne porte `65.0000` pour CODIMA-EU là où la forme entière
-- vaut `6500`. *Deux lectures d'un même critère divergent en silence, parce
-- qu'aucune des deux ne prétend être l'autre* (§9, 01/09) : ici elles
-- divergeaient avant même d'avoir été lues.
--
-- **La colonne part. La table `taux_horaire` est la seule source.**
--
-- ## LA PRÉMISSE A ÉTÉ MESURÉE, PAS CRUE
--
-- L'arbitrage disait « la base hébergée est une base de DÉMONSTRATION —
-- mesurez-le, ne me croyez pas ». Mesuré le 09/09/2026 sur la base hébergée, par
-- l'inventaire du workflow « DB migrate & seed » (run #31) :
--
--     Total toutes sociétés — societe: 2, client: 4, site: 0, contact: 0,
--     agence: 4, taux_horaire: 0, forfait: 0
--     CODIMA-EU, CODIMA-NC — les deux sociétés du seed, identifiants fixes
--
-- **Aucune donnée réelle** : deux sociétés de démonstration, aucun site, aucun
-- contact, aucune intervention. `7000.0000` et `65.0000` sont des valeurs
-- d'amorçage écrites par `prisma/seed-data.ts`, pas des tarifs de clients.
--
-- ## LE BLOC DE GARDE, ET CE QU'IL SURVEILLE RÉELLEMENT
--
-- La mesure ci-dessus date du jour où cette migration a été écrite ; elle
-- s'appliquera plus tard. Le bloc refuse donc si une société porte une valeur
-- **autre que celles du seed** — signe qu'une main l'a modifiée, donc qu'elle
-- porte peut-être une donnée réelle.
--
-- **`societe` est sous `FORCE ROW LEVEL SECURITY`, et le rôle de migration en
-- est le propriétaire** : sans contexte de société, il verrait **zéro ligne** et
-- le bloc ne refuserait rien tout en paraissant vérifier (§9, 07/09). Le drapeau
-- est donc levé pour la durée du diagnostic, rendu dans la même transaction, et
-- **le bloc refuse de compter tant que la levée n'est pas CONSTATÉE** — le
-- témoin porte sur le MÉCANISME, jamais sur un décompte, qu'un zéro légitime
-- rendrait muet.

ALTER TABLE "societe" NO FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  levee boolean;
  hors_amorcage integer;
BEGIN
  SELECT NOT relforcerowsecurity INTO levee
    FROM pg_class WHERE relname = 'societe';
  IF NOT COALESCE(levee, false) THEN
    RAISE EXCEPTION
      'Le diagnostic de Q3 ne peut pas s''exécuter : FORCE ROW LEVEL SECURITY est toujours actif sur « societe », si bien que cette lecture verrait zéro ligne et ne refuserait rien. Le contrôle s''arrête plutôt que de passer à l''aveugle.';
  END IF;

  SELECT count(*) INTO hors_amorcage
    FROM "societe"
   WHERE "taux_horaire_defaut" NOT IN (7000, 65);

  IF hors_amorcage > 0 THEN
    RAISE EXCEPTION
      'Q3 refuse de retirer « societe.taux_horaire_defaut » : % société(s) y portent une valeur autre que celles du seed (7000 et 65). La colonne porte donc peut-être une donnée réelle, et la retirer la perdrait. Reprendre ces valeurs dans « taux_horaire » — avec leur date d''effet — avant de rejouer.',
      hors_amorcage;
  END IF;
END
$$;

ALTER TABLE "societe" FORCE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════════
-- LE RETRAIT
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "societe" DROP COLUMN "taux_horaire_defaut";

-- ═══════════════════════════════════════════════════════════════════════════
-- ET LA TABLE `taux_horaire` RESTE VIDE — c'est la DATE D'EFFET qui bloque
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Le montant est connu et arrêté au rang 1 le 09/09/2026 : **7 000 XPF HORS
-- TAXES** pour CODIMA NC. **Sa date d'effet ne l'est pas**, et c'est elle que
-- `taux_horaire` exige — une intervention se facture au taux en vigueur à SA
-- date (RG-TAR-04), et inventer une date d'effet écrirait une histoire fausse
-- plutôt qu'une histoire absente.
--
-- Le seed n'écrit donc **aucune** ligne de taux. `tauxEnVigueur` rend `null`, et
-- *un taux manquant ne se lit jamais « gratuit »*.

COMMENT ON TABLE "taux_horaire" IS
  'Taux horaire de main-d''œuvre, HISTORISÉ par date d''effet (RG-TAR-04). SEULE source du taux depuis Q3 : societe.taux_horaire_defaut a été retirée le 09/09/2026, deux sources d''un même fait divergeant déjà en valeur (65.0000 contre 6500). La table naît VIDE, et ce n''est pas le montant qui manque — 7 000 XPF hors taxes est arrêté au rang 1 — c''est sa DATE D''EFFET.';
