-- ═══════════════════════════════════════════════════════════════════════════
-- D92 — LA DIXIÈME FORME DE POLITIQUE : « RATTACHEMENT »
--
-- Ticket L2-12. Ce que cette migration abat, et il a été MESURÉ avant d'être
-- contourné.
--
-- Un compte portail n'a AUCUNE ligne dans `utilisateur_societe` : D10 le veut
-- ainsi — « les deux tables sont exclusives ». Et `utilisateur_client` portait
-- la forme « habilitation », dont la première clause est
-- `societe_id = app.societe_id`. Rien ne pouvait donc donner une société à un
-- compte portail, et sans société il ne lisait pas son propre rattachement.
--
-- MESURÉ le 11/09/2026 sous `codiplan_app` (rôle non privilégié, `rolbypassrls`
-- = f), avec témoin préalable — zéro société lisible sans contexte :
--
--   A. `app.utilisateur_id` seul .................. 0 ligne de utilisateur_client
--   B. `app.utilisateur_id` + `app.societe_id` .... 3 lignes
--   C. `utilisateur_societe` du compte portail .... 0 ligne
--
-- A = 0 et C = 0 ensemble : AUCUN COMPTE PORTAIL N'ATTEIGNAIT AUCUN ÉCRAN. Le
-- mur est celui de D61, rencontré une seconde fois de l'autre côté — D61 rend à
-- un compte INTERNE la liste de ses sociétés ; ceci rend à un compte PORTAIL la
-- liste de ses rattachements.
--
-- CE QUE LA POLITIQUE AJOUTE, ET SON COÛT NOMMÉ. Une personne apprend la liste
-- des clients auxquels elle est déjà rattachée. Elle n'apprend ni leur NOM —
-- `client` reste de forme « parc » —, ni aucune de leurs données, ni
-- l'existence d'aucun autre client, ni le rattachement de quiconque d'autre.
--
-- CE QUI LA BORNE EST LA COMMANDE, PAS LA CLAUSE. `FOR SELECT`, et rien
-- d'autre : la même branche sur une écriture laisserait un compte SE RATTACHER
-- au client de son choix, c'est-à-dire s'ouvrir le parc d'un tiers — la fuite
-- exacte que la forme « parc » existe pour empêcher. L'écriture reste
-- entièrement gouvernée par `cloisonnement_habilitation`, qui n'est pas touchée.
--
-- AUCUN `WITH CHECK` N'EST ÉNONCÉ, ET C'EST UNE DÉCISION. Une politique de
-- `SELECT` n'en accepte pas : PostgreSQL la refuserait. C'est précisément ce
-- qui rend la borne structurelle plutôt que déclarative — on ne peut pas
-- écrire par cette politique, quoi qu'on veuille.
--
-- POURQUOI AUCUN BLOC DE GARDE : cette migration ne LIT aucune table. Le §9 du
-- 07/09 vise les blocs qui comptent des lignes sous `FORCE ROW LEVEL SECURITY`
-- — ici il n'y en a pas, donc rien à aveugler.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE POLICY "utilisateur_client_mes_rattachements" ON "utilisateur_client"
  FOR SELECT
  USING (
    "utilisateur_id" = NULLIF(current_setting('app.utilisateur_id', true), '')::uuid
  );

COMMENT ON POLICY "utilisateur_client_mes_rattachements" ON "utilisateur_client" IS
  'D92 — un compte lit SES rattachements, toutes sociétés confondues, et jamais ceux d''autrui. SELECT seul : la même branche en écriture laisserait un compte se rattacher au client de son choix.';

-- ═══════════════════════════════════════════════════════════════════════════
-- ET LA NEUVIÈME FORME S'ÉTEND AU MÊME COMPTE, SANS CHANGER DE RÈGLE
--
-- D67 dit : « un compte lit les lignes des sociétés OÙ IL EST HABILITÉ ». La
-- politique ne traversait que `utilisateur_societe` — la seule table
-- d'habilitation qui existât quand elle a été écrite. **Un compte portail EST
-- habilité, par `utilisateur_client` (D10) ; la règle ne bouge pas d'un mot,
-- c'est son énumération qui devient exacte.**
--
-- Sans cette moitié, D92 rend au compte portail la LISTE de ses sociétés et lui
-- refuse leur NOM : très exactement l'impasse que D67 a levée pour les comptes
-- internes — *un sélecteur ne pourrait proposer que des UUID.*
--
-- LA SOUS-REQUÊTE EST ELLE-MÊME SOUMISE AUX POLITIQUES, et c'est ce qui la
-- borne : elle lit `utilisateur_client` sous la politique que la première
-- moitié de cette migration vient de poser, laquelle ne rend que les lignes du
-- compte courant. La règle est écrite UNE fois et se recompose — jamais deux
-- clauses jumelles qui divergeront (§9, 01/09).
--
-- LE COÛT EST LE MÊME QUE CELUI DE D67, et il ne s'élargit pas : une personne
-- apprend le nom des sociétés dont elle connaît déjà la liste.
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY "societe_mes_societes" ON "societe";

CREATE POLICY "societe_mes_societes" ON "societe"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "utilisateur_societe" "us"
       WHERE "us"."societe_id" = "societe"."id"
         AND "us"."utilisateur_id"
             = NULLIF(current_setting('app.utilisateur_id', true), '')::uuid
    )
    OR EXISTS (
      SELECT 1 FROM "utilisateur_client" "uc"
       WHERE "uc"."societe_id" = "societe"."id"
         AND "uc"."utilisateur_id"
             = NULLIF(current_setting('app.utilisateur_id', true), '')::uuid
         AND "uc"."actif"
    )
  );

COMMENT ON POLICY "societe_mes_societes" ON "societe" IS
  'Q8 / D67, étendue par D92 — neuvième forme, « adhésion ». Un compte lit les lignes des sociétés où il est habilité, par utilisateur_societe (compte interne) OU par utilisateur_client (compte portail, D10) : c''est ce qui permet à un sélecteur d''afficher un NOM plutôt qu''un UUID. SELECT SEUL — la même branche sur une écriture laisserait un compte renommer une société ou s''en attacher une. Le coût est nommé : une personne apprend le nom des sociétés dont elle connaît déjà la liste ; ni leurs données, ni leurs habilitations, ni l''existence d''aucune autre.';
