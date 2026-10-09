# Passation — 9EN-BON-CLIENT-SANS-MONTANT

## Ce que j'ai changé

Le bon d'intervention (`/interventions/:id/bon`) a désormais deux versions,
jamais les deux à la fois (QT-8 (a), arbitrage 3.8, décision n° 39
d'Alexis du 09/10/2026 — consignée en `docs/arbitrages.md` sous **D186**) :

- **Version CLIENT, par défaut** (tous les rôles) : la section
  « Valorisation » — taux, forfait, total — ne s'affiche PAS DU TOUT, ni
  montant, ni motif de refus. Avant ce lot, un rôle ADV/RM/RS/direction
  imprimait toujours le montant ; un rôle sans droit (`admin_societe`)
  voyait au moins le motif « Votre rôle ne donne pas accès aux montants de
  vente » à l'écran.
- **Version INTERNE**, `?version=interne`, réservée aux rôles qui voient
  les montants de vente (`accesAuxMontants`) : le bloc de valorisation
  d'avant ce lot, inchangé, plus un badge « Version interne » dans l'en-tête
  et une mention « VERSION INTERNE — ne pas remettre au client » en pied,
  visibles à l'écran ET à l'impression. Un rôle sans droit qui force ce
  paramètre retombe silencieusement sur la version client.

**Ce que ça change pour l'exploitation** : un ADV, RM, RS ou la direction ne
peut plus imprimer par accident un bon qui dévoile le prix au client — il
faut désormais un geste explicite (« Version interne »). Le document remis
sur site, lui, n'a jamais rien montré d'autre à retirer.

Fichiers touchés : `app/(back-office)/interventions/[id]/bon/page.tsx`
(barre d'outils, en-tête, section Valorisation, pied) ; nouveau
`lib/interventions/version-bon.ts` (fonction pure `versionDuBon`) ; trois
clés neuves dans `lib/i18n/fr.ts` ; `docs/arbitrages.md` (D186).

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- `pnpm typecheck`, `pnpm lint`, `pnpm format:check` : verts après chaque
  étape.
- `pnpm test` (unitaires) : **4499 tests passés / 422 fichiers**, dont les
  48 cas neufs de `tests/unit/interventions/version-bon.test.ts` (8 rôles ×
  6 formes de `?version=`) et le témoin séparé qui confirme que la matrice
  utilisée est bien celle d'`accesAuxMontants`.
- `pnpm test:isolation` : **1514 tests / 170 fichiers**, tous verts —
  `tests/isolation/bon-intervention.test.ts` n'a pas été modifié et reste
  vert sans changement : cette décision ne touche que ce qu'un ÉCRAN
  affiche, jamais ce qu'une requête lit.
- e2e ciblés (`CI=1 pnpm playwright test`) : `bon-intervention.spec.ts` (3
  scénarios A/B/C, remplaçant l'unique test d'avant), `bon-3`, `bon-4`,
  `bon-5`, `rapport-terrain`, `affichage-materiel`, `montants-par-role`,
  `tous-les-ecrans-rendent`, `captures-gr14-duree-unique`,
  `9en-captures` — **au total 75 passés + 3 ignorés** (les 3 ignorés le
  sont déjà avant ce lot, sans rapport avec lui) sur le premier groupe, et
  4/4 sur le fichier de captures neuf, deux fois (avant et après).
- Captures AVANT/APRÈS : voir `captures/README.md` — AVANT rejoué depuis un
  worktree au commit `8e9b760a` (le tip de `main` au début de cette
  session), APRÈS depuis le code livré. Les images confirment visuellement
  la bascule : voir en particulier `bon-admin-societe-ecran.png` (motif
  présent avant, absent après) et `bon-adv-interne-ecran.png` (badge +
  mention + bloc complet, apparus avec `?version=interne`).
- `CI=1 pnpm verify:full` (en entier, suite e2e complète) : voir dernière
  section de cette passation.

## Ce que j'ai tranché et pourquoi

- **Le bloc de valorisation en version interne est repris À L'IDENTIQUE**
  de l'ancien code (y compris sa branche `!montants.montre`, aujourd'hui
  inatteignable puisque `interne` implique `montants.montre`) plutôt que
  simplifié : U6 de l'addendum demandait « reprise à l'identique », et
  simplifier aurait été une réécriture non demandée par ce lot minimal.
- **Le titre reste « Valorisation »**, pas « Valorisation (interne) » comme
  le dessine la maquette du 28/09 : la clé existante n'a pas été dédoublée
  (écart nommé dans D186).
- **La mention de pied est une seconde ligne, sous les mentions légales**
  quand elles existent, chacune avec son propre filet — lecture la plus
  proche de la maquette (2ᵉ ligne du pied) sans dupliquer la structure.
- **Le témoin de `tests/unit/interventions/version-bon.test.ts` évite les
  chaînes libres de noms de rôle** (`"direction"`, `"responsable_materiel"`,
  etc.) : le gardien `roles-sans-chaine-libre.test.ts` les interdit même
  dans un commentaire entre guillemets droits — j'ai dû retirer un exemple
  en commentaire qui les citait entre guillemets, et composer les titres de
  test via `$role` (interpolation de la valeur de l'enum) plutôt que par un
  champ `nom` écrit à la main.
- **La fixture de `bon-intervention.spec.ts` porte désormais un forfait**
  (`FORFAITS_SCENE[0]`) — sans lui, impossible de distinguer dans le test
  (B) une ligne forfait réellement affichée d'une absence qui ne prouverait
  rien.
- **Capture AVANT rejouée après coup**, via un worktree séparé au commit
  parent, plutôt que prise avant la première modification de code : le
  travail d'implémentation a démarré avant que je ne mesure qu'il fallait
  des captures AVANT dédiées. La recette (`docs/propositions/.../captures/
  README.md`) suit exactement celle déjà éprouvée par d'autres lots
  (mémoire de session : « captures-avant-apres-e2e »).

## Ce que je n'ai PAS fait

- Aucune migration, aucune ligne de semis, aucun prix, aucun calcul de
  montant modifié — `lib/interventions/bon.ts`, `lib/interventions/
  montants-visibles.ts`, `lib/auth/habilitations.ts` : zéro ligne de diff.
- Aucune priorité ajoutée au bloc interne (maquette l.3497) — hors lot.
- Aucun détail main-d'œuvre/déplacement PAR ZONE — hors lot.
- Aucune touche à `[id]/page.tsx` (fiche, territoire 9EE-2) : le lien vers
  le bon reste sans paramètre, vers la version client.
- Aucune touche à `[id]/presentation.ts`, `components/interventions/*`
  (dont `actions-bon.tsx`), ni au territoire 9EK-2 (création de machine).
- `package.json` n'a pas bougé — aucune dépendance ajoutée.

## Les pièges pour la session suivante

- Le gardien `tests/unit/auth/roles-sans-chaine-libre.test.ts` scanne TOUT
  le texte source d'un fichier, commentaires compris, pour des guillemets
  droits autour d'un nom de rôle — même un exemple illustratif en
  commentaire s'y fait prendre. Citer un rôle dans la prose : guillemets
  français ou accent grave, jamais `"` ou `'`.
- Prettier reformate `app/(back-office)/interventions/[id]/bon/page.tsx`
  après une édition manuelle des classes conditionnelles (`className={...}`
  multi-lignes) — lancer `pnpm format` avant `pnpm lint`/`pnpm typecheck`
  pour éviter un diagnostic sur du code qui va de toute façon bouger.
- Les specs `tests/e2e/69-BON-3`, `76-BON-4` et `83-BON-5` écrivent leurs
  captures SANS condition dans `docs/propositions/.../captures/` : les
  relancer (même indirectement, via un run ciblé incluant ces fichiers)
  modifie des PNG/PDF hors territoire. `git checkout --` dessus après coup,
  ne jamais les committer.
- Le worktree `/tmp/9en-avant` a bien été retiré
  (`git worktree remove /tmp/9en-avant --force`) — si une session future le
  retrouve, c'est qu'une précédente a été interrompue avant ce nettoyage.

## Ce qui reste à faire

- Rien d'identifié dans le périmètre de ce ticket. Les écarts nommés dans
  D186 (titre « Valorisation (interne) », priorité en interne, détail par
  zone) restent ouverts pour une décision future d'Alexis, pas une dette de
  ce lot.
