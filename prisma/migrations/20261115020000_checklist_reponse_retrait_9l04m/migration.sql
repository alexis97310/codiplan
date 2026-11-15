-- ═══════════════════════════════════════════════════════════════════════════
-- 9L04M-CHECKLIST-RETRAIT-REPONSE — LE VRAI RETRAIT D'UNE RÉPONSE (D257)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Mesuré par 9L04D (passation, § « Le retrait d'une réponse déjà écrite côté
-- serveur N'EXISTE PAS ») : la migration `20261109080000_checklists_socle_
-- 9k08` n'accorde que `GRANT SELECT, INSERT, UPDATE ON "checklist_reponse"`
-- au rôle applicatif — aucun `DELETE`. Un second appui sur une pastille déjà
-- choisie retirait la réponse localement, jamais côté serveur : elle
-- revenait après rechargement.
--
-- La politique `cloisonnement_filiation` (9K08) ne porte AUCUNE clause `FOR` :
-- elle s'applique déjà à TOUTE commande, `DELETE` compris — même forme que
-- `intervention_piece_remplacee` (`20261030040000_pieces_remplacees_saisie_
-- libre_9i7b`), qui accorde `DELETE` sans ajouter de politique neuve, pour
-- la même raison. Rien à créer ici que le privilège lui-même : la base
-- refusera toujours le DELETE d'une ligne dont l'intervention n'est pas
-- visible, exactement comme elle refuse déjà le SELECT/UPDATE.
--
-- Le verrou d'écriture portail sur `checklist_reponse`
-- (`verrou_ecriture_portail_suppression`, posé par
-- `20261110120000_portail_securite_base_9k16`) couvre déjà `FOR DELETE` —
-- un compte portail ne pouvait pas supprimer cette ligne avant ce lot, et ne
-- le peut toujours pas après : seul le rôle applicatif, hors contexte
-- portail, gagne un privilège qu'il n'avait pas.
--
-- `checklist_reponse_photo` reste IMMUABLE (I6, inchangée) : c'est
-- `lib/checklists/depot.ts` (`enregistrerReponses`), jamais la base, qui
-- refuse le retrait d'une réponse qui porte au moins une photo — la base
-- n'a aucune règle à poser pour ça, une réponse SANS photo n'ayant aucune
-- ligne dans `checklist_reponse_photo` à protéger.

GRANT DELETE ON "checklist_reponse" TO "codiplan_app";

COMMENT ON TABLE "checklist_reponse" IS
  'LA RÉPONSE, FIGÉE PAR INTERVENTION (9K08-CHECKLIST-SCHEMA, D235). Forme « filiation » (D103) sur intervention : la SEULE des quatre tables de ce lot qu''un compte portail peut lire. RECOPIE libellé/section/unité/obligatoire du point (patron segment_travail.nom_technicien_affiche, 9J22A) — jamais besoin d''ouvrir checklist_point. DELETE accordé depuis 9L04M-CHECKLIST-RETRAIT-REPONSE (D257) : un VRAI retrait, refusé nommément par lib/checklists/depot.ts (jamais par la base seule) sur une réponse qui porte des photos (checklist_reponse_photo, I6) ou sur une intervention figée.';
