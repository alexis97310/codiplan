-- ═══════════════════════════════════════════════════════════════════════════
-- 9L33-MAJORATION-REGLAGE-SOCIETE — bornes sur `societe.majoration_hors_ouverture_pct`
-- ═══════════════════════════════════════════════════════════════════════════
--
-- CONDITION DE RÉOUVERTURE DE D269 (docs/arbitrages.md) : « le jour où une
-- route de paramétrage écrit `societe.majoration_hors_ouverture_pct`, cette
-- décision se relit pour y ajouter la validation d'écriture (bornes,
-- contrainte `CHECK`) qu'elle ne pose pas aujourd'hui ». C'est ce jour : le
-- présent lot ajoute l'écran de réglage, donc la contrainte.
--
-- 0 à 200 inclus — même borne que la validation de saisie côté serveur
-- (`schemaMajorationHorsOuverturePct`, `lib/tarification/majoration.ts`) :
-- un pourcentage négatif n'aurait pas de sens (`tauxMajorationDepuisPourcentage`
-- le refusait déjà, en mémoire seulement) ; au-delà de 200 %, aucune demande
-- ne l'a formulée, et une valeur hors de cette plage est presque toujours
-- une faute de frappe (« 5000 » pour « 50 »).
--
-- REQUÊTE DE CONTRÔLE, à jouer AVANT cette migration sur la base réelle
-- (lecture seule, ne modifie rien) — si elle rend une ligne, la migration
-- échouera et la valeur concernée doit être corrigée à la main d'abord :
--
--   SELECT id, code FROM "societe"
--   WHERE "majoration_hors_ouverture_pct" NOT BETWEEN 0 AND 200;

ALTER TABLE "societe"
  ADD CONSTRAINT "societe_majoration_hors_ouverture_bornee" CHECK (
    "majoration_hors_ouverture_pct" BETWEEN 0 AND 200
  );

COMMENT ON COLUMN "societe"."majoration_hors_ouverture_pct" IS
  'LE POURCENTAGE DE MAJORATION HORS OUVERTURE, RÉGLÉ PAR LA SOCIÉTÉ (D269, 9L33-MAJORATION-REGLAGE-SOCIETE). Borné 0 à 200 par contrainte CHECK depuis cette migration ; lu par tauxMajorationDepuisPourcentage (lib/tarification/majoration.ts) et par le barème du portail (lireBaremePortail).';
