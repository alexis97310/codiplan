# 9AN-GR17-BARRE-PLANNING-TON — passation

## Ce que j'ai changé

Aucune migration, aucune ligne de semis, aucun prix, aucune règle de gestion changée : mise en
page et ton d'un bandeau, comme demandé.

1. **M3 — les titres de domaine de la barre respirent.** `CLASSES_TITRE_DOMAINE`
   (`components/navigation/barre.tsx`) portait `mt-3 … first:mt-0` sur le TITRE lui-même. Un titre
   est TOUJOURS le premier enfant de sa propre enveloppe (`Domaine`, un `<div>` par domaine) :
   `first:mt-0` s'appliquait donc à chaque titre, sans exception, et `mt-3` ne s'appliquait
   jamais. « Absences » (dernier lien d'« EXPLOITATION ») collait au titre suivant,
   « CLIENTS & PARC ». La marge vit désormais sur l'enveloppe du domaine, qui n'est première que
   pour le tout premier domaine de la colonne.
   **Ce que ça change pour l'exploitation** : la colonne de navigation, lue en permanence sur
   chaque écran du back-office, distingue enfin visuellement ses trois groupes.

2. **M6 — « Créer une intervention » remonte en haut à droite du planning.** `actions`
   (`app/(back-office)/planning/page.tsx`) regroupait `Onglets`, `Deplacement` ET le bouton
   primaire. Le gabarit partagé `Page` (`components/mise-en-page/page.tsx`, hors territoire) ne
   pose qu'UN SEUL bloc d'actions à côté du titre : dès que ce bloc ne tenait plus à côté du titre,
   il passait ENTIER sous celui-ci, bouton primaire compris. Seul le bouton reste dans `actions` ;
   `Onglets` et `Deplacement` forment leur propre rangée, en tête des `children`, sous l'en-tête.
   **Ce que ça change pour l'exploitation** : le geste le plus fréquent de l'écran (créer une
   intervention) reste à un endroit stable, prévisible, au lieu de se déplacer selon la largeur de
   fenêtre ou la longueur du sous-titre.

3. **M13 — « prévenu par courriel » passe au ton de confirmation.** Les trois clés `…_parti` du
   compte-rendu de planification (client/technicien/ancien technicien prévenus) annoncent un
   SUCCÈS et portaient pourtant le même orange que les cinq clés qui disent l'inverse
   (`…_non_parti`, `…_sans_destinataire`, `habilitation`). `tonDeLAvertissement`
   (`lib/avertissements/ton.ts`, fichier neuf) distingue les deux familles par un seul critère : la
   clé se termine par `_parti` sans être un `_non_parti`. Les deux écrans qui affichent ce
   compte-rendu (`/planning`, `/interventions/[id]`) en tirent désormais leurs classes via
   `CLASSES_TON` (déjà existant, `lib/theme/statuts.ts`) au lieu d'un orange écrit en dur.
   **Ce que ça change pour l'exploitation** : un utilisateur qui planifie une intervention voit
   désormais un bandeau vert quand tout s'est bien passé, orange seulement quand quelque chose n'a
   PAS pu être fait (même si la planification, elle, a quand même eu lieu).

**Bogue trouvé et corrigé en marge du point 3, dans le même territoire** : le bandeau
d'avertissement de `/planning` ne s'affichait en réalité JAMAIS, quelle que soit l'URL — voir
« Ce que j'ai tranché et pourquoi ».

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

`pnpm format:check` et `pnpm test` verts avant chaque commit ; `pnpm typecheck` et `pnpm lint`
verts. `CI=1 pnpm verify:full` rejoué en entier après le dernier commit : format, typecheck, lint,
3008 tests unitaires, isolation, build, puis 395 tests e2e passés / 3 ignorés — vert.

Captures AVANT/APRÈS dans `captures/`, à 1280 et 375 px, prises par
`tests/e2e/captures-9an-gr17-planning-barre.spec.ts` (committé, gardé par la variable
d'environnement `CAPTURES_9AN` — silencieux sous `pnpm test:e2e` ordinaire) : une fois sur le
commit `347e0bf` (avant le lot, dans un `git worktree` séparé pour ne pas toucher `main`), une
fois sur `c563be2` (le code livré, trois commits de ce lot) :

- `planning-semaine-{avant,apres}-{1280,375}.png` — `/planning?vue=semaine`
- `planning-jour-{avant,apres}-{1280,375}.png` — `/planning?vue=jour`
- `fiche-bandeau-parti-{avant,apres}-{1280,375}.png` — la fiche d'une intervention de scène
  `ERGO13-`, bandeau déclenché par l'URL (`?avertissement=intervention.avertissement.courriel_client_parti`)

Vérifié visuellement : APRÈS, le bandeau de la fiche est vert (`border-app-vert-*`) au lieu
d'orange ; AVANT, « CLIENTS & PARC » colle au dernier lien d'« EXPLOITATION », APRÈS un espace net
les sépare. À 1280 px, la position du bouton « Créer une intervention » ne se distingue pas
franchement à l'œil entre AVANT et APRÈS dans CES captures précises — la fenêtre de démonstration
est assez large pour que les trois éléments de l'ancien bloc `actions` y tiennent côte à côte sans
jamais passer à la ligne. Le défaut de M6 (bloc entier rejeté sous le titre) est bien réel mais se
déclenche à une largeur ou une longueur de sous-titre que ces deux captures précises ne
reproduisent pas ; c'est `tests/e2e/planning-creer-en-haut.spec.ts` qui mesure le vrai invariant
(voir plus bas), pas la capture.

## Ce que j'ai tranché et pourquoi

**M6 — l'assertion de l'épreuve compare au bas du SOUS-TITRE, pas à celui du `<h1>`.** Mesuré au
navigateur : `header` (`components/mise-en-page/page.tsx`, HORS TERRITOIRE) porte `items-end`, et
son sous-titre porte une marge basse fixe de 20 px. Le bouton — même SEUL dans `actions` — reste
donc aligné sur le bas du bloc titre ENTIER (`<h1>` + sous-titre), quelques pixels sous le bas du
seul `<h1>` : c'est une contrainte du gabarit partagé, que ce lot n'a pas le droit de toucher, et
qui ne bouge pas quel que soit le contenu d'`actions`. Une assertion littérale « le haut du bouton
est au-dessus du bas du `<h1>` » est donc structurellement impossible à satisfaire sans modifier
`mise-en-page/page.tsx`. Ce que ce lot RÉPARE, et que l'épreuve vérifie à la place, c'est que le
bouton reste DANS la même ligne d'en-tête — chevauchant verticalement le sous-titre — au lieu
d'être rejeté entièrement dessous, dans une ligne séparée par le `gap-4` du gabarit.

**M13 — bogue trouvé en écrivant l'épreuve du planning : `PARAMETRE_AVERTISSEMENT` valait
`undefined` côté serveur.** En construisant `tests/e2e/avertissement-ton.spec.ts`, mesuré (par un
attribut de debug temporaire dans le DOM, retiré avant commit) que
`parametres[PARAMETRE_AVERTISSEMENT]` ne trouvait JAMAIS la clé, quelle que soit l'URL : le
bandeau de `/planning` était du code mort depuis son origine (N+1, 17/09/2026). Cause : cette
constante est exportée par `components/planning/pose.tsx`, marqué `"use client"` — la frontière
client/serveur de Next.js ne transmet à un composant SERVEUR que les références de composant à
travers un tel import, pas une constante ordinaire, qui redevient `undefined`. La fiche
d'intervention (`interventions/[id]/page.tsx`) n'avait jamais ce problème : elle lisait déjà la
clé en toutes lettres (`parametres.avertissement`), sans passer par cet import. `planning/page.tsx`
fait désormais pareil — même clé, en toutes lettres, avec un commentaire qui nomme le piège pour
que personne ne réintroduise l'import cru correct. C'est un correctif, pas un changement de règle
de gestion : le comportement VOULU (afficher le compte-rendu après un dépôt accepté) existait déjà
en intention, il ne s'exécutait simplement jamais.

## Ce que je n'ai PAS fait

- Je n'ai pas touché `components/mise-en-page/page.tsx` (le gabarit `Page`, explicitement hors
  territoire) ni `components/planning/pose.tsx` au-delà de ne plus y importer sa constante depuis
  `planning/page.tsx` — son usage interne, côté client, reste intact et correct.
- Je n'ai pas ajouté de test qui capture le cas où le bloc `actions` du planning WRAP réellement
  sous le titre (largeur très étroite, ou sous-titre très long) : `planning-creer-en-haut.spec.ts`
  prouve que le bouton ne quitte plus la ligne d'en-tête à 1280/1440, pas qu'aucune largeur ne peut
  plus jamais le faire wrapper.
- Aucune capture en société EUR (CODIMA-EU) : le ticket ne le demandait pas, la société de
  démonstration XPF suffit pour montrer les trois changements.
- M7 (taux de charge) reste explicitement hors lot, comme demandé.

## Les pièges pour la session suivante

- **N'importez jamais une constante ou une fonction ordinaire (non-composant) depuis un module
  `"use client"` pour la lire dans un composant SERVEUR** : elle vaut `undefined` à l'exécution,
  silencieusement, sans erreur de build ni de lint. Si une valeur doit être partagée entre les deux
  côtés (le nom d'une clé de paramètre d'URL, par exemple), soit elle vit dans un module SANS
  directive `"use client"`, soit elle est recopiée en toutes lettres des deux côtés avec un
  commentaire qui nomme l'autre lecture (comme le faisait déjà, par chance, la fiche
  d'intervention).
- **Un `first:` posé sur un élément qui est TOUJOURS premier dans son enveloppe ne fait jamais rien
  d'utile** : le sélecteur doit viser l'élément qui varie de position selon son contexte
  (l'enveloppe elle-même, ici), pas un enfant qui est structurellement toujours au même rang.
- **`items-end` sur un `<header>` aligne les blocs par leur BAS, pas par leur premier élément** :
  un bloc d'actions plus court qu'un bloc de titre (avec sous-titre) ne remonte jamais au niveau du
  `<h1>` seul, quel que soit son contenu — c'est une propriété du conteneur, pas du contenu.
- Recette des captures AVANT/APRÈS quand le code AVANT est déjà committé (mémoire
  `captures-avant-apres-e2e`, confirmée une nouvelle fois ici) : `git worktree add <chemin>
  <commit-avant>`, `node_modules` symlinké depuis le dépôt principal, `.env` copié — deux runs
  complets (migrate + seed + build) coûtent chacun ~45-55 s une fois le worktree prêt. Penser à
  `git worktree remove --force` et à vérifier `pgrep -fa next-server` après coup.

## Ce qui reste à faire

Rien d'identifié dans le périmètre de ce lot. Les trois points du constat GR (M3, M6, M13) sont
couverts, testés, capturés et commités ; le bogue latent du bandeau de `/planning` est corrigé et
couvert par une épreuve qui n'existait pas avant ce lot.
