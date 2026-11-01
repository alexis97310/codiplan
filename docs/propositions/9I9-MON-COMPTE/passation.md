# 9I9-MON-COMPTE — passation

*Constat M5, ticket T5 de l'audit en équipe du 28/10/2026 : aucun écran « Mon compte » pour un
rôle de bureau — quatre routes essayées, toutes introuvables ; le badge aux initiales de la barre
haute était décoratif. Seule voie pour changer son mot de passe : « Mot de passe oublié ? » depuis
l'écran de connexion.*

`main` était extrait dans un autre worktree (`/home/aplou/codiplan`) au début de cette session :
le travail a été fait sur une branche dédiée `9I9-MON-COMPTE`, partant d'`origin/main` (déjà à
jour avec `main`).

## Ce que j'ai mesuré (point 1)

- `app/(back-office)/**` ne portait aucune route `mon-compte` ni équivalente. Le badge aux
  initiales (`Avatar`, `components/navigation/barre.tsx`) était un `<span aria-hidden>` sans lien.
- `/terrain/profil` (`app/(mobile)/terrain/profil/page.tsx`, QE-11/D161) : nom, courriel, société,
  et le seul bouton de déconnexion — minimal par construction (son en-tête le dit : les
  habilitations et le second facteur sont hors de son périmètre, réservés à TP-ABS). Servi de
  modèle pour la structure, pas pour le contenu (le ticket en demande davantage).
- Le chemin serveur de changement de mot de passe : Better Auth expose `/change-password`
  (`instance.api.changePassword`), déjà disponible dès lors qu'`emailAndPassword` est activé —
  aucun greffon supplémentaire. Il relit QUI agit depuis la session (`sensitiveSessionMiddleware`),
  vérifie l'ancien mot de passe contre le hash stocké, et accepte un `revokeOtherSessions`
  optionnel (voir plus bas). Rien de ce chemin n'était câblé nulle part dans le dépôt avant ce lot.

## Ce que j'ai fait (points 2, 3, 4)

- **`app/(back-office)/mon-compte/page.tsx`** — accessible à tout rôle de bureau connecté avec une
  société active, sans capacité supplémentaire (`obtenirSession` + le même garde `societeId`/`role`
  non nuls que toutes les pages du segment). Quatre cartes : Identité (nom, courriel, société,
  rôle), Vos habilitations (la matrice `CAPACITES`/`niveau` du rôle courant, en lecture, « restreint »
  marqué quand le ○ s'applique), Second facteur (« Activé »/« Non activé », AUCUNE action — sa
  réinitialisation est le ticket 9IA, hors territoire), Changer de mot de passe.
- **`lib/auth/mon-compte.ts`** (`changerSonMotDePasse`) — appelle `instance.api.changePassword`
  avec les en-têtes de la requête ; l'identité qui change est donc TOUJOURS celle de la session,
  jamais un paramètre. Distingue quatre refus utiles à l'écran (`discordance`, `trop_court`,
  `actuel_incorrect`, `refuse`) d'un succès (`abouti`) — contrairement au premier accès (D35), ici
  l'identité est déjà connue : distinguer « ancien mot de passe faux » n'apprend rien à un tiers
  que la personne connectée ne sache déjà sur SON PROPRE compte.
- **`app/api/session/mon-compte/mot-de-passe/route.ts`** — porte `exigerSessionActive` (société et
  rôle actifs, aucune capacité), comme `/api/societe/logo` ; exemption nommée dans
  `tests/unit/auth/porte.test.ts` (D-12).
- **`lib/auth/presentation-capacites.ts`** — les libellés des capacités de la matrice, pour
  l'affichage. Trois capacités (`administrer_agences`, `gerer_client_site`,
  `consulter_clients_sites`) composent leur libellé AU RENDU avec `motDansUnePhrase` : le mot
  imposé « agence » ou « site » ne peut s'écrire qu'aux clés `vocabulaire.*` (CLAUDE.md §3, D5,
  D47). Gardien de complétude : `tests/unit/auth/presentation-capacites.test.ts`, fermé CONTRE
  `CAPACITES` — une capacité future sans libellé y rougit.
- **Le badge aux initiales mène à `/mon-compte`** (`components/navigation/barre.tsx`, `Avatar`
  seul — `AvatarClaire`, la forme du terrain et du portail, n'est jamais la cible de ce lot).
  `aria-label="Mon compte"` sur le lien : son contenu (`Avatar`) reste `aria-hidden`.
- `lib/i18n/fr.ts` : toutes les chaînes visibles de l'écran, dont les 30 libellés de capacités et
  les trois préfixes composés.

## Ce que j'ai mesuré et nommé plutôt qu'inventé (point 3)

- **Journalisation** : `journalAcces`/`EvenementAcces` est un ÉNUM FERMÉ (`prisma/schema.prisma`),
  scopé aux événements déjà arbitrés (bascule de société, ouverture d'identité, réémission de
  premier accès, déverrouillage du second facteur, requête de consolidation). Un changement de
  mot de passe n'y figure pas, et lui ajouter une valeur exige une migration — explicitement hors
  territoire de ce lot (« aucune migration »). **Aucune ligne n'est donc écrite** pour ce
  changement ; c'est une absence mesurée, pas un oubli silencieux.
- **Les autres sessions de la personne** : `changePassword` accepte un `revokeOtherSessions`
  optionnel — vrai, il détruit toutes les AUTRES sessions du compte et ouvre une session neuve
  pour celle-ci. Ce lot ne le passe pas (comportement par défaut, `false`) : changer son mot de
  passe ne révoque donc aucune autre session ouverte ailleurs. Ce n'était pas demandé par le
  ticket ; le point est nommé ici plutôt que décidé en silence, pour une prochaine session.

## Épreuves (point 5)

- `tests/isolation/mon-compte-mot-de-passe.test.ts` — 5 scénarios : mot de passe actuel correct,
  actuel faux, discordance, trop court, et une tentative de désigner un AUTRE compte (champ forgé)
  qui reste sans effet sur lui.
- `tests/unit/auth/presentation-capacites.test.ts` — complétude des libellés contre `CAPACITES`.
- `tests/e2e/9i9-mon-compte.spec.ts` — un compte ADV créé par ce fichier (jamais la scène
  partagée) change son mot de passe depuis l'écran, se déconnecte, l'ancien mot de passe n'ouvre
  plus rien, le nouveau ouvre la session suivante ; une seconde épreuve POST directement sur la
  route avec un champ `utilisateurId` forgé visant `COMPTE_RM_EPREUVE` (lu, jamais écrit) —
  seul le compte de la session change, l'autre reste inchangé.
- `tests/e2e/captures-9i9-mon-compte.spec.ts` — captures 375/1280 px de l'écran et du badge
  (`docs/propositions/9I9-MON-COMPTE/captures/`, 4 fichiers, 63 à 363 Ko).
- Deux gardiens existants touchés pour rester vrais : `tests/unit/auth/porte.test.ts` (exemption
  D-12 nommée pour la nouvelle route) et `tests/unit/navigation/atteignabilite-ecrans.test.ts`
  (voir ci-dessous).

## Un gardien élargi, pas affaibli

`tests/unit/navigation/atteignabilite-ecrans.test.ts` ne traçait que les liens de `ENTREES` (les
quatorze entrées de domaine) et ceux trouvés dans le source de chaque `page.tsx` et de ses imports
LOCAUX. Le pied de la colonne (société active, déconnexion, badge) vit dans
`app/(back-office)/layout.tsx`, rendu sur CHAQUE écran du segment mais jamais importé PAR un
`page.tsx` — le gardien ne le voyait donc jamais, et aurait déclaré `/mon-compte` orphelin malgré
le lien réel. `DEPARTS` inclut désormais aussi les chemins désignés par le source composé de
`layout.tsx` : un départ de PLUS (jamais un écran retiré de la vérification), qui generalise à
tout futur lien de chrome plutôt que d'ajouter une exemption ad hoc pour cette seule route.

## Ce que je n'ai PAS fait (hors territoire)

- `components/session/formulaire.tsx` n'a pas été modifié — `Champ` y est composé tel quel pour le
  champ « mot de passe actuel » (`autoComplete="current-password"`, déjà un paramètre existant).
- Aucune migration, aucune nouvelle dépendance.
- La réinitialisation du second facteur (ticket 9IA) : l'écran affiche seulement son état.

## Commandes jouées

- `CI=1 pnpm format && pnpm typecheck && pnpm lint` verts après chaque point.
- `CI=1 pnpm test` — 492 fichiers / 5422 tests, tous passés.
- `CI=1 pnpm test:isolation` — 200 fichiers / 1763 tests, tous passés.
- `tests/e2e/9i9-mon-compte.spec.ts` rejoué seul : vert (2 tests, ~1,6 min).
- `tests/e2e/captures-9i9-mon-compte.spec.ts` rejoué avec `CAPTURES_9I9` : vert, 4 captures
  produites.
- `CI=1 pnpm verify:full` en entier : voir `verify-final.txt`.

## Reprise 9I91 — changer son mot de passe ferme les AUTRES sessions

*Décision d'Alexis (02/11/2026, revue de 9I9, solde 621) : « Oui, avant le gel » — scénario du
téléphone volé. `main` était extrait ailleurs (`/home/aplou/codiplan`) : travail sur une branche
dédiée `9I91-REPRISE-9I9`, partant d'`origin/main` (déjà à jour avec `main`, commit `788046b94`).*

### Trois choses MESURÉES, pas devinées — et les trois corrigées

Le point de départ (`revokeOtherSessions: true` sur `changePassword`) a d'abord semblé trivial,
puis s'est révélé en trois défauts emboîtés, chacun mesuré avant d'être corrigé :

1. **Le greffon ne lève plus l'`APIError` d'un refus avec `asResponse: true`.** Il la rend en
   `Response` d'erreur — c'est le STATUT qui porte le refus, le corps ensuite. Le code d'origine
   catchait l'`APIError`, qui ne survenait plus : un mot de passe actuel faux rendait `abouti`.
   Mesuré par le test d'isolation existant, qui a rougi au premier essai.
2. **`revokeOtherSessions: true` ne fermait AUCUNE session.** `deleteUserSessions` (le greffon)
   écrit `DELETE FROM session WHERE utilisateur_id = …` à travers `avecDesignationAuth`
   (`lib/auth/lecture-identite.ts`), qui ne pose AUCUNE désignation pour un `where` sur
   `utilisateur_id` sur `session` — seul le JETON en est une, délibérément (son commentaire : un
   identifiant n'est pas un secret, l'ouvrir à la lecture par `utilisateur_id` laisserait lire les
   sessions de quiconque connaît cet identifiant). La politique `session_fermeture` refusait donc
   tout, silencieusement : zéro ligne supprimée, aucune erreur. **Mesuré par un script hors dépôt**
   contre la base réelle (deux sessions ouvertes, l'une et l'autre encore présentes après l'appel),
   PUIS confirmé par les deux nouvelles épreuves d'isolation.
3. **La session neuve que le greffon recrée est NUE.** Seul `databaseHooks.session.create.before`
   (`lib/auth/config.ts`) y ajoute `second_facteur_valide` ; société active et rôle restent `NULL`.
   **Mesuré au navigateur** (`tests/e2e/9i9-mon-compte.spec.ts`, qui a rougi : le message de
   confirmation n'était jamais vu, la personne atterrissant sur `/planning`).

### Ce qui a été corrigé, et où

Tout dans `lib/auth/mon-compte.ts` — rien dans `lib/auth/config.ts`, `lib/auth/lecture-identite.ts`
ni une migration, les trois explicitement hors territoire de ce lot (et (2) touche de toute façon
le cloisonnement des tables d'authentification, un point d'arrêt à part) :

- Le statut de la réponse (`asResponse`) est lu avant le corps ; le corps d'erreur est relu par un
  schéma (`code`), celui d'un succès par un autre (`token`, `user.id`) — jamais par une conversion
  de type.
- `fermerLesAutresSessions` (nouvelle fonction privée) ferme les autres sessions ELLE-MÊME, en
  posant `app.utilisateur_id` dans une transaction qu'elle contrôle entièrement, bornée à
  l'identifiant que `changePassword` vient de confirmer être celui de la session qui a réussi.
  C'est le chemin que la politique `session_fermeture` anticipait déjà depuis la migration L1-02d
  (« pour qu'un compte voie et révoque ses sessions sans avoir à présenter chaque jeton ») ; il
  manquait un appelant, et le greffon ne l'est pas.
- La même transaction reporte, sur la session neuve, la société et le rôle que la session D'AVANT
  portait — lus par `obtenirSession` AVANT l'appel à `changePassword`, jamais devinés.
- `changerSonMotDePasse` prend un quatrième paramètre `client: PrismaClient`, par défaut celui de
  production (`lib/db/client`) — même convention que `tenterConnexion`
  (`lib/auth/connexion.ts`). Les épreuves d'isolation lui passent `clientApp()`.

### Ce qui n'a PAS été ouvert, et pourquoi c'est resté fermé

Étendre `CLES_DESIGNATION.session` pour qu'un simple `utilisateur_id` suffise à atteindre la table
`session` à travers `avecDesignationAuth` aurait réglé (2) en une ligne — et aurait rouvert
exactement ce que son propre commentaire refuse pour la LECTURE depuis L1-02d. C'est une décision
de cloisonnement des tables d'authentification, hors territoire de ce ticket et à part de la
question posée (fermer les AUTRES sessions d'une personne déjà authentifiée, pas rendre un
identifiant suffisant pour les lire). La solution retenue (ci-dessus) atteint le même résultat sans
toucher ce fichier ni la politique.

### Épreuves

- `tests/isolation/mon-compte-mot-de-passe.test.ts` — deux scénarios ajoutés, base réelle : deux
  sessions ouvertes pour le même compte, changement depuis l'une → l'AUTRE n'existe plus en base,
  la courante est remplacée par sa neuve (jeton différent, toujours connectée via les `Set-Cookie`
  rendus) ; mot de passe actuel faux → aucune session touchée, les deux existent toujours.
- `tests/e2e/9i9-mon-compte.spec.ts` — inchangé, mais a servi de gardien pendant la correction : il
  a d'abord rougi (étape 4, message de confirmation introuvable — la personne était sur
  `/planning`), puis confirmé vert une fois (3) corrigé. Couvre déjà « rester connecté sur Mon
  compte après le changement » sans qu'il ait fallu écrire un fichier e2e supplémentaire pour ce
  point.
- `tests/e2e/captures-9i91-mot-de-passe.spec.ts` (nouveau) — capture l'écran après un changement
  abouti, message de confirmation visible, 375 et 1280 px
  (`docs/propositions/9I9-MON-COMPTE/captures/9i91-mot-de-passe-abouti-{375,1280}.png`, 66 et 114 Ko).

### Commandes jouées

- `pnpm format && pnpm typecheck && pnpm lint` verts après chaque commit.
- `pnpm test` — 493 fichiers / 5437 tests, tous passés.
- `pnpm test:isolation` (suite entière, pas seulement ce fichier) — 202 fichiers / 1793 tests, tous
  passés.
- `tests/e2e/9i9-mon-compte.spec.ts` rejoué seul : vert (2 tests).
- `tests/e2e/captures-9i91-mot-de-passe.spec.ts` rejoué avec `CAPTURES_9I9` : vert, 2 captures
  produites.
- `CI=1 pnpm verify:full` en entier : voir `verify-final.txt`.
