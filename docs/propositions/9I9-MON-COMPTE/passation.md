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
