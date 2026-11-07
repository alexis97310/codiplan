-- ═══════════════════════════════════════════════════════════════════════════
-- 9J22-PORTAIL-BON-TECHNICIEN-TEMPS — LE NOM DU TECHNICIEN ET LES TEMPS
-- PASSÉS, SUR LE BON VU PAR LE CLIENT, POUR SES PROPRES INTERVENTIONS SEULES.
--
-- Décision d'Alexis (06/11/2026 ~21:35, verbatim « Oui, les deux ») : la
-- passation de 9J08A avait mesuré que `lireBonDuParc`
-- (`lib/interventions/bon.ts`) rend toujours `segments: []` et
-- `technicienAffecte: null` sous un contexte portail, parce que DEUX
-- politiques RLS existantes excluent structurellement tout `app.client_id` :
--   * `segment_travail.cloisonnement_interne_lecture` (D94, forme « interne ») ;
--   * `utilisateur.utilisateur_lecture`, branche « rattachement », fermée au
--     même discriminant (décision d'exploitation du 07/09/2026).
--
-- ## CE QUE CETTE MIGRATION FAIT — DEUX POLITIQUES AJOUTÉES, AUCUNE TOUCHÉE
--
-- Elle n'élargit NI NE RETIRE aucune des deux politiques ci-dessus (§8 du
-- ticket : « aucune autre politique RLS modifiée »). Elle AJOUTE, sur
-- `segment_travail` et sur `utilisateur`, une politique PERMISSIVE de plus,
-- scopée au SEUL contexte portail (`app.client_id` posé) — les politiques
-- permissives d'un même verbe s'OR-ent entre elles (PostgreSQL), et les deux
-- politiques existantes restent donc inchangées pour tout contexte interne.
--
-- Forme « FILIATION » (D103, précédent : `intervention_statut_historique`,
-- migration 20261104100000) : une fille est visible si son parent l'est.
-- Ici le parent est `intervention`, déjà gardée par `cloisonnement_parc`
-- (société + client_id + périmètre de sites, D84) — la nouvelle politique ne
-- RÉÉCRIT donc aucune de ces trois comparaisons, elle les emprunte par
-- `EXISTS`.
--
-- ## POURQUOI `utilisateur` RESTE SÛRE MALGRÉ LA RÈGLE DE COLONNES DU TICKET
--
-- Le ticket demande : « jamais l'adresse, le téléphone, le compte, les
-- habilitations ni les absences du technicien ». Aucune de ces colonnes ne
-- vit sur `utilisateur` (adresse, téléphone, habilitations et absences sont
-- sur `utilisateur_societe`/`technicien`/`absence`, chacune cloisonnée par SA
-- PROPRE politique, non touchée ici). La seule colonne supplémentaire que la
-- ligne ouvre est `email` — et le SEUL appelant qui lit `utilisateur` sous un
-- contexte portail, `annuaireDesPersonnes`/`nomsDesPersonnes`
-- (`lib/auth/annuaire.ts`), ne sélectionne JAMAIS que `id` et `nom` ; c'est
-- cette discipline de sélection, pas une politique RLS, qui tient la colonne
-- — exactement comme `segment_travail` (qui n'a d'ailleurs aucune colonne de
-- coût ou de taux : la question ne s'y pose même pas) et comme
-- `machinesIdentifiees` ailleurs dans ce même module. Aucune vue ni fonction
-- `SECURITY DEFINER` n'est introduite (D50 reste close et vide).
--
-- ## CE QUE CES DEUX POLITIQUES N'OUVRENT PAS
--
-- Un segment ou une identité de technicien d'une intervention HORS du
-- périmètre du client (autre site, autre client, autre société) reste fermé :
-- la politique « parc » d'`intervention` que `EXISTS` emprunte est la SEULE
-- porte, inchangée. Un compte interne ne gagne rien de nouveau : la condition
-- `app.client_id IS NOT NULL` exclut structurellement tout contexte interne.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1. `segment_travail` — une politique PORTAIL de plus, forme « filiation »
-- ───────────────────────────────────────────────────────────────────────────

CREATE POLICY "cloisonnement_filiation_lecture_portail" ON "segment_travail"
  FOR SELECT
  USING (
    NULLIF(current_setting('app.client_id', true), '') IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM "intervention" "i"
       WHERE "i"."id" = "segment_travail"."intervention_id"
    )
  );

COMMENT ON TABLE "segment_travail" IS
  'CE QUE LE COMPTEUR DU TECHNICIEN A MESURÉ (R5-02, D119). Des SEGMENTS, jamais un total : une pause est un fait, et un compteur qui ne garde que le total ne peut pas dire ce qui s''est passé entre-temps. Le compteur FAIT FOI pour le temps ; l''arrondi au quart d''heure supérieur et le plancher d''une heure restent dans la valorisation (RG-TAR-05, D83, D89) — arrondir à l''écriture ferait deux lectures d''un même critère. Table métier de la première catégorie de I1. Forme « INTERNE » (D94) pour tout contexte interne : société ET app.client_id absent — combien de temps une personne nommée a passé chez un client, minute par minute, est une information sur cette personne. DEPUIS 9J22 : une SECONDE politique, forme « filiation », ouvre en SUS les segments d''une intervention visible au client sous la politique « parc » d''intervention (D84) — ce que son propre bon a le droit de montrer, jamais plus.';

-- ───────────────────────────────────────────────────────────────────────────
-- 2. `utilisateur` — même forme, pour le nom affiché d'un technicien
-- ───────────────────────────────────────────────────────────────────────────
--
-- EXISTS sur `segment_travail` : soumis à SES PROPRES politiques, dont celle
-- posée ci-dessus — sous un contexte portail, seule `cloisonnement_filiation_
-- lecture_portail` peut la rendre vraie, et seulement pour un segment d'une
-- intervention déjà visible à CE client. EXISTS sur `intervention` : soumis à
-- `cloisonnement_parc`, même raisonnement pour le technicien AFFECTÉ (qui
-- peut n'avoir posé aucun segment).

CREATE POLICY "utilisateur_lecture_filiation_portail" ON "utilisateur"
  FOR SELECT
  USING (
    NULLIF(current_setting('app.client_id', true), '') IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM "segment_travail" "st"
         WHERE "st"."utilisateur_id" = "utilisateur"."id"
      )
      OR EXISTS (
        SELECT 1 FROM "intervention" "i"
         WHERE "i"."technicien_id" = "utilisateur"."id"
      )
    )
  );

COMMENT ON TABLE "utilisateur" IS
  'Identité de plateforme. Globale par construction : une même personne travaille légitimement pour deux sociétés (RG-SOC-03), et la table ne porte donc AUCUN societe_id. Cloisonnée en base depuis L1-02c par deux formes qui ne se recouvrent pas — « désignation » avant que la société soit connue (authentification), « rattachement » après, fermée à un compte portail (décision d''exploitation du 07/09/2026). AUCUNE DONNÉE MÉTIER ICI : fonction, agence de rattachement, habilitations et préférences vivent dans utilisateur_societe et utilisateur_client, qui sont cloisonnées. DEPUIS 9J22 : une TROISIÈME forme, « filiation », ouvre en SUS une identité de technicien à un compte portail — SEULEMENT si elle a posé un segment ou est affectée à une intervention déjà visible à CE client (politique « parc », D84). AUCUNE colonne autre que id/nom n''est destinée à franchir cette porte : c''est la sélection de lib/auth/annuaire.ts, jamais une politique, qui le garantit — la table ne porte d''ailleurs aucune des colonnes que le ticket interdit par ailleurs (adresse, téléphone, habilitations, absences vivent ailleurs, cloisonnées séparément).';
