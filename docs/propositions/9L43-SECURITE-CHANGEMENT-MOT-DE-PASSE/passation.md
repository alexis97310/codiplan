# 9L43-SECURITE-CHANGEMENT-MOT-DE-PASSE — passation

Réserve de revue (feuille de route, section « Réserves des revues, à regrouper ») : « Sécurité :
second facteur recopié dans la session neuve après un changement de mot de passe ; limite d'essais
sur l'ancien mot de passe ; trace du changement dans le journal. » Trois sujets, trois mesures,
deux complétées par du code neuf — le troisième tenait déjà.

## MIGRATION À JOUER PAR ALEXIS

`20261126003000_mot_de_passe_change_9l43` — une seule, neuve, appliquée par `pnpm db:deploy`
(staging, puis la cible visée). Elle ajoute une seule valeur à l'énumération `EvenementAcces`
(`mot_de_passe_change`) ; elle ne crée ni colonne, ni table, ni contrainte. Aucune requête de
contrôle n'est nécessaire : rien n'y est appliqué à des données existantes.

## Mesure (point 1 du ticket)

- **Chemin du changement de mot de passe** : `lib/auth/mon-compte.ts`
  (`changerSonMotDePasse`) → `instance.api.changePassword` (Better Auth), `revokeOtherSessions:
  true`. Le greffon détruit toutes les sessions du compte et en recrée une neuve, mais
  (mesuré par les lots 9I9/9I91) ne ferme RIEN lui-même (politique de désignation) et n'ouvre la
  session neuve ni sur une société, ni sur un rôle : `mon-compte.ts` répare les deux lui-même.
  Ce ticket n'y touche pas.
- **Second facteur de la session neuve** : posé par
  `databaseHooks.session.create.before` (`lib/auth/config.ts`), qui déduit `second_facteur_valide`
  de `utilisateur.mfa_actif` AU MOMENT de la création — jamais d'un paramètre reçu. C'est la MÊME
  déduction, sur le MÊME champ, qui avait posé la valeur de la session remplacée à SA création.
  `mfa_actif` ne change pas pendant un changement de mot de passe : la session neuve porte donc
  nécessairement le même second facteur que l'ancienne, sans qu'il y ait quoi que ce soit à
  reporter. Rien n'était cassé — mais rien ne le PINÇAIT non plus : un test isolé l'ajoute
  (voir ci-dessous) plutôt que de laisser ce fait tenir sur la seule lecture du code.
- **Limite d'essais sur la connexion (9L07/9L07A, D258)** : `lib/auth/limiteur-connexion.ts` —
  table `tentative_connexion`, `SEUIL_ECHECS_CONNEXION = 5`, `FENETRE_ECHECS_CONNEXION_SECONDES =
  900`, fenêtre glissante. Rien n'appelait ce module depuis « Mon compte » : le mot de passe actuel
  pouvait y être essayé sans aucune limite.
- **Journal d'audit** : `journal_audit` (I8) est écrit exclusivement par déclencheur PostgreSQL sur
  les tables métier cloisonnées — structurellement incapable de porter un événement applicatif qui
  n'est pas une écriture de ligne métier. `journal_acces` est la table faite pour ça (bascules,
  connexions temporisées, réinitialisations de second facteur, …) ; aucune valeur existante ne
  nommait « mot de passe changé ».

## Ce qui a été fait

1. **`prisma/schema.prisma`** — une valeur d'énumération, `EvenementAcces.mot_de_passe_change`,
   documentée comme les autres entrées de cette liste. Aucune autre colonne, aucune autre table :
   `journal_acces` porte déjà tout ce qu'il faut (`utilisateur_id`, `societe_id_cible`, `role`,
   `detail`).
2. **`lib/auth/limiteur-connexion.ts` (inchangé, RÉUTILISÉ)** — `lib/auth/mon-compte.ts` appelle
   directement `verrouille`, `enregistrerEchec`, `reinitialiserEchecs`, `identifiantConnexion` et
   `extraireAdresseIp` du même module que la connexion. `sujet.identifiant` vient du courriel de LA
   SESSION (`sessionAvant.identite.email`, lu par `obtenirSession`) — jamais d'une saisie. Les
   échecs côté connexion et ceux côté « Mon compte » partagent donc le MÊME budget pour un même
   compte : scinder les deux aurait ouvert une porte dérobée à qui, un budget épuisé d'un côté,
   tente l'autre. Verrouillé, le mot de passe actuel n'est même pas vérifié (même parti pris que
   `lib/auth/connexion.ts`, D258), et l'issue rendue est `actuel_incorrect` — IDENTIQUE à celle
   d'une saisie simplement fausse : aucun oracle ne distingue, côté appelant, un verrouillage d'une
   erreur de saisie. Un aboutissement rompt la série (`reinitialiserEchecs`), comme une connexion
   réussie.
3. **`lib/auth/mon-compte.ts`** — trois ajouts dans `changerSonMotDePasse` :
   - le verrou se vérifie avant tout appel à `changePassword` ;
   - un échec de `changePassword` lié au mot de passe (statut hors 200 `INVALID_PASSWORD`, ou
     `APIError` du même code) enregistre un échec ;
   - un aboutissement journalise (`journaliserChangementMotDePasse`, nouvelle fonction) une ligne
     `journal_acces` : `evenement: mot_de_passe_change`, `societe_id_cible` et `role` ceux de la
     session D'AVANT (informatifs, D34), `detail` purement descriptif — jamais le mot de passe ni
     un condensat.
4. **Pas de changement d'interface, pas de nouvelle chaîne** : l'issue `actuel_incorrect` existait
   déjà et porte déjà son libellé (`lib/i18n/fr.ts`) ; le verrouillage l'emprunte tel quel, ce qui
   EST la garantie « pas d'oracle ». Aucun écran n'a donc été touché — **aucune capture n'a été
   prise pour ce lot**, la consigne du 13/11 portant sur les écrans modifiés ou créés.

## Épreuves

- `tests/isolation/mon-compte-mot-de-passe.test.ts` (étendu) :
  - `SEUIL_ECHECS_CONNEXION` essais faux verrouillent, même avec le BON mot de passe ensuite, avec
    la MÊME issue (`actuel_incorrect`) ;
  - le verrou PARTAGE son budget avec la connexion : des échecs posés par `tenterConnexion`
    verrouillent aussi « Mon compte », sans qu'aucun essai n'y ait jamais été fait ;
  - un aboutissement rompt la série ;
  - un aboutissement journalise exactement une ligne `mot_de_passe_change`, et son `detail` ne
    contient ni l'ancien ni le nouveau mot de passe.
- `tests/isolation/mon-compte-second-facteur.test.ts` (créé) : un compte `admin_societe` (rôle qui
  EXIGE un second facteur) enrôlé et connecté avec son code validé change son mot de passe ; la
  session neuve (lue par les `Set-Cookie` rendus) porte `secondFacteurValide: true` — jamais
  renvoyée à un nouveau défi.
- `lib/db/migrations-attendues.ts` — la migration neuve ajoutée à la liste (gardien
  `tests/unit/db/migrations-attendues.test.ts`).

`pnpm test` : 540 fichiers, 6095 tests, vert. `pnpm test:isolation` : 267 fichiers, 2578 tests,
vert. `CI=1 pnpm verify` (format + typecheck + lint + test + test:isolation + build) : vert, joué
en entier après le rebase.

## Feuille de route

La ligne de réserve a migré de « Réserves des revues, à regrouper » vers « Livré depuis le 31/10 »
(`lib/feuille-de-route/contenu.ts`), référencée 9L43. `DATE_ETAT_FEUILLE_DE_ROUTE` mise à jour au
26/11/2026.

## Arbitrage

Aucun numéro `D-xxx` neuf : ce lot complète une exigence déjà écrite (la réserve de revue
elle-même), par réutilisation stricte de deux mécanismes déjà arbitrés (D258 pour le limiteur,
le patron déjà établi pour `journal_acces` — D32/D34/D65/9L03C). Aucune règle métier, aucun seuil,
aucun délai n'a été inventé ici.
