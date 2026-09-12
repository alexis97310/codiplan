-- ═══════════════════════════════════════════════════════════════════════════
-- UNE BASE QUI A DÉJÀ VÉCU — le parc, avant que D6 pose son unicité
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Jouée AVANT `20260913200000_reference_interne_unique_d6`. Sans elle, `machine`
-- est VIDE au moment du resserrement : **l'index se construirait sur rien**, et
-- le rejeu serait vert sans avoir mesuré quoi que ce soit. *Une migration
-- éprouvée contre rien n'est pas éprouvée.*
--
-- ## CE QUE CES LIGNES DOIVENT ÊTRE, ET CE QU'ELLES NE DOIVENT PAS ÊTRE
--
-- **Ce qu'une base réelle portait**, jamais ce qui ferait échouer la migration.
-- Une amorce choisie pour casser inventerait une panne : le bloc de garde de la
-- migration existe pour refuser LISIBLEMENT un parc qui porte des doublons, et
-- ce n'est pas le rôle de ce rejeu de le déclencher — il éprouve que la
-- migration **passe** sur un parc sain, ce qui est le cas qu'on jouera.
--
-- ## LES TROIS FICHES COUVRENT LES TROIS CAS DE L'INDEX PARTIEL
--
-- Deux références **distinctes** — l'index doit les accepter toutes deux —, et
-- **deux fiches sans référence**, qui sont le cas que la clause
-- `WHERE … IS NOT NULL` existe pour laisser passer. *Sans ces deux-là, un index
-- NON partiel passerait aussi, et le rejeu ne dirait pas ce qu'on croit qu'il
-- dit.*
--
-- Aucune donnée de client réel (I9) : la société vieillie posée plus haut.

INSERT INTO "famille_materiel" ("id", "societe_id", "code", "libelle")
VALUES ('01920000-0000-7000-8000-00000000a010',
        '01920000-0000-7000-8000-00000000a001', 'AGEE-FAM', 'Famille vieillie');

INSERT INTO "modele_materiel" ("id", "societe_id", "famille_id", "marque",
                               "reference")
VALUES ('01920000-0000-7000-8000-00000000a011',
        '01920000-0000-7000-8000-00000000a001',
        '01920000-0000-7000-8000-00000000a010', 'Marque vieillie', 'REF-AGEE');

INSERT INTO "machine" ("id", "societe_id", "modele_id", "client_id", "site_id",
                       "qr_token", "numero_serie", "reference_interne",
                       "modifie_le")
VALUES
  -- Deux références DISTINCTES : l'index les accepte, et c'est ce qu'il doit
  -- faire — deux exemplaires ne partagent pas une référence, ils en ont deux.
  ('01920000-0000-7000-8000-00000000a012',
   '01920000-0000-7000-8000-00000000a001',
   '01920000-0000-7000-8000-00000000a011',
   '01920000-0000-7000-8000-00000000a004',
   '01920000-0000-7000-8000-00000000a005',
   'jeton-agee-001', 'SN-AGEE-001', 'AGEE-REF-001', now()),
  ('01920000-0000-7000-8000-00000000a013',
   '01920000-0000-7000-8000-00000000a001',
   '01920000-0000-7000-8000-00000000a011',
   '01920000-0000-7000-8000-00000000a004',
   '01920000-0000-7000-8000-00000000a005',
   'jeton-agee-002', 'SN-AGEE-002', 'AGEE-REF-002', now()),
  -- DEUX fiches SANS référence interne. C'est le cas majoritaire d'un parc
  -- réel, et c'est exactement ce que la clause partielle laisse passer : deux
  -- `NULL` ne sont pas la même machine.
  ('01920000-0000-7000-8000-00000000a014',
   '01920000-0000-7000-8000-00000000a001',
   '01920000-0000-7000-8000-00000000a011',
   '01920000-0000-7000-8000-00000000a004',
   '01920000-0000-7000-8000-00000000a005',
   'jeton-agee-003', 'SN-AGEE-003', NULL, now()),
  ('01920000-0000-7000-8000-00000000a015',
   '01920000-0000-7000-8000-00000000a001',
   '01920000-0000-7000-8000-00000000a011',
   '01920000-0000-7000-8000-00000000a004',
   '01920000-0000-7000-8000-00000000a005',
   'jeton-agee-004', 'SN-AGEE-004', NULL, now());
