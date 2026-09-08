-- ═══════════════════════════════════════════════════════════════════════════
-- Q8 — LA NEUVIÈME FORME DE POLITIQUE : « ADHÉSION », SUR `societe`
-- Arbitrage d'exploitation du 09/09/2026 (D67). Ticket L2-11, première moitié.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ## Le mur, mesuré avant d'être abattu
--
-- D61 a rendu à un compte la LISTE des sociétés où il est habilité. Il lui
-- manquait de quoi en NOMMER une : `societe` est de forme « identité »
-- (`id = app.societe_id`, D42), si bien que sans société active la lecture rend
-- **zéro ligne — pas même en nommant l'identifiant qu'on possède déjà**. Mesuré
-- le 08/09/2026 sous le rôle applicatif, avec témoin : 0 à l'aveugle, 0 en
-- nommant les deux, **2 lignes réellement en base**.
--
-- **Un sélecteur de société ne pouvait donc proposer que des UUID.** C'est
-- inutilisable, et le livrer aurait fermé le ticket sans lever l'impasse —
-- elle aurait seulement changé de forme.
--
-- ## LA FORME, ET SON COÛT NOMMÉ
--
-- Une politique de `SELECT` **et de `SELECT` seul** : un compte lit les lignes
-- des sociétés où il est habilité, et rien d'autre. C'est la symétrique de celle
-- que D61 a posée sur `utilisateur_societe`.
--
-- **Le coût se nomme, comme D61 a nommé le sien** : *une personne apprend le NOM
-- des sociétés dont elle connaît déjà la liste.* C'est un libellé de plus sur un
-- ensemble qu'elle possède — ni les données de ces sociétés, ni leurs
-- habilitations, ni l'existence d'aucune autre société.
--
-- **Ce qui a été écarté, et pourquoi :** un libellé recopié dans
-- `utilisateur_societe` aurait évité la politique, et serait devenu faux au
-- premier renommage **sans rougir** — c'est la divergence silencieuse du §9
-- (01/09), la maladie que ce dépôt a déjà soignée cinq fois.
--
-- ## CE QUI LA BORNE EST LA COMMANDE, PAS LA CLAUSE
--
-- La même branche sur une écriture laisserait un compte **renommer** une
-- société, ou pire — en créer une et s'y attacher. Elle est donc en `SELECT` et
-- en `SELECT` seul ; l'écriture reste entièrement gouvernée par la forme
-- « identité ». C'est exactement la borne de D61, et le gardien la vérifie
-- commande par commande.
--
-- **Et elle n'énonce pas de `WITH CHECK`** — non par oubli : PostgreSQL n'en
-- accepte pas sur une politique `FOR SELECT`. C'est le seul cas où la règle de
-- L1-02c ne s'applique pas, et c'est parce qu'elle ne couvre aucune écriture.
--
-- ## La sous-requête est bornée par la politique de `utilisateur_societe`
--
-- Elle est soumise à la forme « appartenance » (D61) : sous un contexte
-- d'identité seule, elle ne rend que les lignes du compte courant. La règle est
-- donc écrite UNE fois et se recompose, plutôt que deux clauses jumelles qui
-- divergeront (§9, 01/09).

CREATE POLICY "societe_mes_societes" ON "societe"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "utilisateur_societe" "us"
       WHERE "us"."societe_id" = "societe"."id"
         AND "us"."utilisateur_id"
             = NULLIF(current_setting('app.utilisateur_id', true), '')::uuid
    )
  );

COMMENT ON POLICY "societe_mes_societes" ON "societe" IS
  'Q8 / D67 — neuvième forme, « adhésion ». Un compte lit les lignes des sociétés où il est habilité, et rien d''autre : c''est ce qui permet à un sélecteur d''afficher un NOM plutôt qu''un UUID. SELECT SEUL — la même branche sur une écriture laisserait un compte renommer une société ou s''en attacher une. Le coût est nommé : une personne apprend le nom des sociétés dont D61 lui donne déjà la liste ; ni leurs données, ni leurs habilitations, ni l''existence d''aucune autre.';

COMMENT ON TABLE "societe" IS
  'Table racine du cloisonnement. Cloisonnée par son IDENTITÉ (id = app.societe_id, D42) : elle est la table que societe_id désigne. Depuis Q8 / D67 elle porte EN PLUS une politique de SELECT seul ancrée sur app.utilisateur_id, qui rend à un compte les sociétés où il est habilité — sans quoi aucun sélecteur ne pourrait afficher autre chose que des UUID. Les écritures restent entièrement gouvernées par la forme « identité ».';
