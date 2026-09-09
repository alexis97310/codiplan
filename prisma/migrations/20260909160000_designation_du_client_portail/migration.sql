-- ═══════════════════════════════════════════════════════════════════════════
-- L'APPELANT DÉSIGNE, LA BASE DISPOSE — la pose de `app.client_id` (D70)
-- Invariant I1 ; arbitrages D10, D22 ; ticket L1-02b ; registre du 09/09 §13.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ## Le trou que cette migration ferme, et il a été MESURÉ
--
-- La forme « parc » lit `app.client_id` et traite une valeur VIDE comme
-- « utilisateur interne » : le filtre de client DISPARAÎT. C'est voulu pour un
-- technicien. Mais aucun chemin de production ne savait renseigner cette
-- variable — `ContexteSession` ne portait aucun champ de client —, si bien
-- qu'un compte portail qui aurait atteint ce chemin aurait lu le parc ENTIER de
-- sa société. *Mesuré le 09/09 sous `codiplan_app`, après deux témoins : un
-- compte portail du client `c2` lisait 2 machines du client `c1` ; le même
-- contexte, `app.client_id` posé, rendait 0.*
--
-- ## POURQUOI NI « L'APPELANT SEUL » NI « LA BASE SEULE »
--
-- Le registre du 09/09 posait la question comme un couple — l'appelant fournit,
-- ou la base dérive. **C'en était un faux, et la mesure le dit :**
--
--   - **pas la base seule**, parce que la dérivation N'EST PAS UNIQUE.
--     `utilisateur_client` porte `UNIQUE (utilisateur_id, client_id)` et non
--     `(utilisateur_id, societe_id)` : un même compte tient légitimement
--     plusieurs clients d'une même société. *Éprouvé en base : une seconde
--     habilitation insérée pour le compte `…d3` dans la société A est ACCEPTÉE,
--     et il en porte alors deux.* La base ne peut donc pas choisir sans
--     inventer une règle que personne n'a décidée ;
--   - **pas l'appelant seul**, parce que c'est l'invariant que L1-02c et L1-02e
--     ont passé deux jours à protéger : *une valeur qui désigne ne vient jamais
--     de l'extérieur sans être validée.*
--
-- **Donc : l'appelant DÉSIGNE, la base DISPOSE.** Le compte dit pour quel
-- client il agit ; la pose n'aboutit que si ce client figure parmi SES PROPRES
-- habilitations, vérifiées dans la MÊME transaction que la pose. C'est
-- exactement la forme de `app.societe_id`, et la seule qui compose les deux
-- contraintes au lieu d'en sacrifier une.
--
-- ## L'ORDRE DES DEUX GESTES EST UNE DÉCISION, PAS UNE COMMODITÉ
--
-- `app.client_id` est posée AVANT d'être validée, et c'est délibéré. La
-- politique « habilitation » de `utilisateur_client` s'écrit *société ET
-- (`app.client_id` absent OU `utilisateur_id` = le mien)*. Valider AVANT de
-- poser la ferait donc lire sous la branche « absent » — c'est-à-dire sous le
-- régime de l'utilisateur INTERNE, qui voit TOUTES les habilitations de la
-- société. *Poser d'abord RESSERRE la lecture de validation à ses propres
-- lignes ; valider d'abord l'élargirait.*
--
-- Ce que cette inversion coûte est nommé : entre la pose et la validation, la
-- variable porte une valeur non vérifiée. **Aucune lecture n'a lieu dans cette
-- fenêtre** — `poserContexte` n'émet que ces deux instructions, et le refus
-- ci-dessous lève une exception qui ANNULE LA TRANSACTION ENTIÈRE (mesuré :
-- toute commande suivante reçoit « current transaction is aborted »). Un
-- scénario d'isolation l'éprouve en tentant de lire après le refus.
--
-- ## POURQUOI UN REFUS ET NON UNE VALEUR VIDE
--
-- Rendre silencieusement un contexte vide rouvrirait la branche « utilisateur
-- interne » et ouvrirait tout le parc — le défaut même qu'on ferme. La fonction
-- LÈVE. *Une garantie manquante se signale par un refus, jamais par une lecture
-- réussie.*
--
-- ## `SECURITY INVOKER`, ET C'EST LE CŒUR
--
-- Cette fonction n'est PAS `SECURITY DEFINER` — un gardien statique le refuse
-- (D50), et ce serait ici une faute de fond : sa lecture de
-- `utilisateur_client` doit être soumise aux politiques de l'APPELANT. C'est ce
-- qui garantit qu'elle ne peut confirmer qu'une habilitation que l'appelant a
-- lui-même le droit de voir. Une fonction `DEFINER` aurait validé contre la
-- table entière, et la désignation serait redevenue une parole sur l'honneur.
--
-- ## Ce qu'elle remplace, et le coût en allers-retours : ZÉRO
--
-- Elle prend la place de l'instruction qui posait déjà `app.perimetre_sites`
-- pour un compte portail (L1-02b) : un appel là où il y avait une instruction.
-- Le chemin d'un utilisateur interne n'en émet toujours aucune.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION "app_poser_perimetre_client"(
  "p_utilisateur" uuid,
  "p_client" uuid
) RETURNS void
LANGUAGE plpgsql
-- `search_path` figé : la fonction ne doit pas résoudre `utilisateur_client`
-- vers un schéma que l'appelant aurait glissé devant `public`.
SET search_path = pg_catalog, public
AS $fonction$
BEGIN
  -- LA DISPOSITION. Lue SOUS LES POLITIQUES DE L'APPELANT (`SECURITY INVOKER`),
  -- et donc bornée à ses propres lignes puisque `app.client_id` est déjà posée.
  IF NOT EXISTS (
    SELECT 1
      FROM "utilisateur_client" "uc"
     WHERE "uc"."utilisateur_id" = "p_utilisateur"
       AND "uc"."client_id" = "p_client"
       AND "uc"."actif"
  ) THEN
    -- Un refus a le droit d'être LISIBLE, jamais d'être INFORMATIF (D50) : il
    -- ne dit ni si ce client existe, ni pour qui il est habilité, ni combien de
    -- comptes en dépendent. Il dit ce qui bloque et la marche à suivre.
    RAISE EXCEPTION
      'Client designe hors des habilitations de ce compte : la pose de '
      'app.client_id est refusee.'
      USING ERRCODE = '42501',
            HINT = 'Le compte doit porter une habilitation active sur le '
                   'client designe (utilisateur_client). Verifier la '
                   'designation, ou accorder l''habilitation.';
  END IF;

  -- LE PÉRIMÈTRE. Inchangé depuis L1-02b, y compris la FORME de la valeur —
  -- liste d'UUID jointe par des virgules —, que les politiques lisent telle
  -- quelle. Un périmètre VIDE reste légitime : il signifie « tous les sites de
  -- ce client », et c'est pour cela qu'il ne peut pas servir de signal
  -- d'habilitation — d'où le `EXISTS` séparé ci-dessus.
  PERFORM set_config('app.perimetre_sites', coalesce((
    SELECT string_agg("ucs"."site_id"::text, ',' ORDER BY "ucs"."site_id")
      FROM "utilisateur_client_site" "ucs"
      JOIN "utilisateur_client" "uc" ON "uc"."id" = "ucs"."utilisateur_client_id"
     WHERE "uc"."utilisateur_id" = "p_utilisateur"
       AND "uc"."client_id" = "p_client"
       AND "uc"."actif"
  ), ''), true);
END;
$fonction$;

COMMENT ON FUNCTION "app_poser_perimetre_client"(uuid, uuid) IS
  'Valide la designation d''un client par un compte portail, puis pose '
  'app.perimetre_sites. SECURITY INVOKER : la validation est soumise aux '
  'politiques de l''appelant. Leve si le client n''est pas habilite — jamais '
  'de contexte vide, qui rouvrirait la branche « utilisateur interne » de la '
  'forme parc. Voir D70 et le registre du 09/09.';

-- Le rôle applicatif est le SEUL à l'appeler. `PUBLIC` est retiré : une
-- fonction laissée exécutable par tous est un privilège que personne n'a
-- décidé — même famille que l'`ON UPDATE CASCADE` par défaut (§9, 24/08).
REVOKE ALL ON FUNCTION "app_poser_perimetre_client"(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "app_poser_perimetre_client"(uuid, uuid) TO "codiplan_app";
