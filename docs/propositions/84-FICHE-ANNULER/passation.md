# 84-FICHE-ANNULER — passation

## Ce que j'ai changé

Le bouton « Annuler l'intervention » de `app/(back-office)/interventions/[id]/page.tsx`
(les deux formulaires — intervention figée et non figée — pointent tous les deux vers
`/api/interventions/[id]/annuler`) :

- passe en `variant="destructive"` (le style « danger » déjà présent dans
  `components/ui/button.tsx`, réutilisé tel quel — aucun nouveau composant de bouton) ;
- reste le **dernier** bloc de la colonne « Actions » (position inchangée dans les deux
  branches `figee`/non `figee`) ;
- est **désactivé tant que le champ motif est vide** (une fois rogné) ;
- au clic, ouvre une **confirmation explicite** — « Annuler `<référence>` ? L'intervention
  restera tracée comme annulée. » — avec deux boutons, « Revenir » et « Confirmer
  l'annulation ». Refuser n'envoie rien ; confirmer soumet le formulaire natif existant.

Pour l'exploitation : un clic sur le bouton rouge n'annule plus rien tant que le motif
n'est pas écrit, et n'annule jamais sans un second geste explicite. Le filet serveur
(`schemaAnnulation`, refus si le motif fait moins de 3 caractères) est inchangé — cet écran
ne fait qu'éviter l'aller-retour qui aurait renvoyé sur la fiche avec un refus.

**Comment c'est construit**, pour la session suivante :

- `Action` (le composant partagé par les sept actions de la fiche, dans le même fichier)
  gagne une prop optionnelle `bouton?: React.ReactNode`. Si elle est fournie, elle
  remplace le `<Button type="submit" variant="outline">` par défaut — **rien d'autre ne
  change** dans `Action` (le `<form>`, sa route, sa méthode, la note, les champs). Les six
  autres actions (affecter, déplacer, planifier, clôturer, suspendre, reprendre) ne passent
  pas cette prop et gardent leur bouton d'origine à l'identique.
- `components/interventions/bouton-annuler.tsx` (nouveau, `"use client"`) est le seul
  fichier qui porte la logique : il lit le champ `motif` du `<form>` englobant par
  `boutonRef.current?.form`, écoute son évènement `input` pour activer/désactiver un
  bouton `type="button"` (jamais `type="submit"` — voir plus bas), et n'appelle
  `form.requestSubmit()` qu'après confirmation dans un `<dialog>` natif (`showModal()` /
  `close()`), jamais `window.confirm`.

## Ce que j'ai mesuré (AVANT/APRÈS)

- **AVANT** (mesuré sur `main` avant ce lot, commit `311d573`) : les deux blocs
  `Action` de l'annulation rendaient un bouton `variant="outline"` — même style que les
  six autres actions —, `type="submit"` nu, sans écoute du champ motif ni confirmation. Un
  clic soumettait directement, et un motif vide revenait sur la fiche avec
  `intervention.annulation.obligatoire` en texte.
- **APRÈS** : `pnpm test:e2e tests/e2e/fiche-annuler.spec.ts` — 3/3 verts (bouton
  désactivé sans motif ; motif saisi + confirmation refusée → toujours `planifiee`, motif
  en base resté `null` ; confirmation acceptée → `annulee`, motif en base égal à ce qui a
  été saisi).
- `pnpm test:e2e` complet (264 épreuves) : 261 vertes, 3 sautées (skips nommés et
  préexistants dans `tous-les-ecrans-rendent.spec.ts`, sans rapport avec ce ticket — routes
  dynamiques sans exemple d'identifiant disponible). Aucune régression sur
  `fiche-intervention.spec.ts` (les deux épreuves qui ciblent
  `form[action$="/annuler"]`) ni sur `porte-capacites.spec.ts` (le refus opposé au
  technicien) : les deux étaient déjà vertes SANS adaptation, parce qu'elles ne cliquent
  jamais le bouton et que le `<form>` (action, méthode) n'a pas changé.
- `pnpm verify` (format:check, typecheck, lint, test, test:isolation, build) et
  `pnpm verify:full` (+ feries:horizon, audit:partitions, test:e2e) : verts.

## Ce que j'ai tranché, et pourquoi

- **Le bouton devient `type="button"`, jamais `type="submit"`.** Le piège nommé par le
  ticket (55-FORMULAIRES-1/61-FORMULAIRES-1-REPRISE : désactiver un bouton `submit` dans
  son propre `onClick` annule la soumission qu'il porte) ne s'applique qu'à un bouton qui
  soumet lui-même. En le rendant `type="button"`, la soumission ne part JAMAIS de son
  `onClick` : elle part du bouton « Confirmer l'annulation » du dialogue, par
  `form.requestSubmit()`. Ce choix évite le piège plutôt que de le contourner.
- **Aucun composant de dialogue accessible n'existe dans `components/ui/`, et aucune
  dépendance Radix Dialog/AlertDialog n'est installée** (vérifié : ni le fichier, ni le
  paquet). Le ticket l'anticipait (« sinon `<dialog>` natif ») : `<dialog>` avec
  `showModal()`/`close()` est la voie retenue, sans ajouter de dépendance (§2 : ajouter une
  dépendance est une décision, pas un réflexe).
- **`Action` gagne une prop `bouton` plutôt qu'être dupliqué.** L'alternative — sortir
  l'annulation de `Action` et écrire un second composant de formulaire complet — aurait
  recopié le `<form>`, sa route, sa note, pour ne changer QUE le bouton. Une prop
  optionnelle, ignorée par les six autres appels, limite le diff à ce qui change vraiment
  et ne touche à aucun comportement des « autres actions de la fiche » que le ticket
  protège explicitement.
- **`m-auto` sur le `<dialog>`.** Mesuré à la première capture : le preflight de Tailwind
  met `margin: 0` sur tous les éléments, ce qui casse le centrage natif que
  `dialog:modal { margin: auto }` de la feuille de style du navigateur fournirait sinon —
  le dialogue apparaissait collé en haut à gauche de l'écran. `m-auto` restaure le
  centrage sans toucher au reste du preflight.
- **Couleur du fond du dialogue (`backdrop:bg-app-encre/40`), pas `bg-black/40`.** Le
  gardien `tests/unit/theme/sans-couleur-en-dur.test.ts` (L0-09) a rougi sur `black` : la
  charte est une donnée de société, jamais une constante de compilation. `app-encre` (le
  jeton d'encre déjà enregistré comme couleur Tailwind) donne le même effet visuel sans
  écrire de littéral.
- **« Revenir », pas « Annuler », pour fermer la confirmation.** Réutiliser le mot
  « Annuler » pour le bouton qui NE déclenche PAS l'annulation aurait été ambigu
  précisément dans CE dialogue-là (contrairement à `taux_horaire.confirmer.annuler`, où
  aucune annulation d'intervention n'est en jeu).
- **La scène de l'épreuve (`ANN1-`) crée son propre client ET son propre site**, comme
  `tests/e2e/bon-5.spec.ts` (le ticket précédent le plus récent à suivre ce modèle),
  plutôt que de réutiliser le site partagé de `fiche-intervention.spec.ts` : la fiche
  affiche le nom du client et du site à l'écran (L0-11), et une intervention qui finit
  `annulee` ne doit pas laisser une trace visible sur une fixture partagée par d'autres
  fichiers.

## Ce que je n'ai PAS fait

- Je n'ai touché ni `app/api/`, ni `lib/` : la route `/api/interventions/[id]/annuler` et
  `schemaAnnulation` sont inchangées, comme demandé.
- Je n'ai pas touché aux six autres actions de la fiche (affecter, déplacer, planifier,
  clôturer, suspendre, reprendre) : leur bouton, leur style, leur comportement au clic
  restent exactement ceux d'avant ce lot — aucune n'utilise la nouvelle prop `bouton`.
  L'accordéon des actions mentionné par le ticket comme « un autre ticket » n'a pas été
  commencé.
- Je n'ai pas ajouté de composant de dialogue réutilisable dans `components/ui/` : le
  `<dialog>` vit uniquement dans `bouton-annuler.tsx`, propre à cet usage. Si un futur
  ticket a besoin d'une confirmation similaire ailleurs, une extraction serait à envisager
  à ce moment-là plutôt qu'anticipée ici sans un second appelant.
- Je n'ai pas vérifié le rendu sur un lecteur d'écran réel (uniquement
  `aria-labelledby` posé sur le `<dialog>`, et la sémantique native de `<dialog
  open>`/`showModal()` pour le focus trap et Échap) — non mesuré, à vérifier si un audit
  d'accessibilité suit.
- Je n'ai pas rejoué `pnpm veille` ni `pnpm deploiement:verifier` (portée hébergée, hors
  sujet d'un ticket qui ne touche ni migration ni politique RLS).

## Pièges pour la session suivante

- **`Action` (dans `page.tsx`) porte maintenant une prop `bouton` optionnelle.** Si un
  futur ticket ajoute une action de plus, il n'a PAS à la fournir — l'oublier revient au
  comportement actuel des six autres (bouton `outline` par défaut). Ne pas la rendre
  obligatoire sans revoir les sept appels.
- **Le `<dialog>` a besoin de `m-auto` sous ce thème.** Si un autre écran ajoute un
  `<dialog>` natif, le même défaut de centrage se reproduira sans cette classe — ce n'est
  pas spécifique à ce composant, c'est le preflight Tailwind du projet entier.
- **Toute couleur passée à un `<dialog>` (fond, `::backdrop`) doit passer par un jeton
  `app-*` déjà enregistré dans `app/globals.css`**, jamais une palette Tailwind nommée ni
  `black`/`white` — le gardien L0-09 le refuse, y compris dans un sélecteur `backdrop:`.
- La scène `ANN1-` (client, site, intervention) est supprimée en `afterAll` : si une
  épreuve future a besoin d'une intervention `planifiee` déjà annulable par le rôle `adv`,
  le modèle de `tests/e2e/bon-5.spec.ts` (scène complète, propre, avec `uuidv7()`) est plus
  simple à copier que celui, plus ancien, à identifiants hexadécimaux « parlants ».

## Ce qui reste à faire

- Rien d'identifié dans le périmètre de ce ticket : les trois critères d'acceptation
  (bouton désactivé sans motif, confirmation refusée sans effet, confirmation acceptée qui
  annule avec le motif tracé) sont couverts par `tests/e2e/fiche-annuler.spec.ts`, et
  `pnpm verify:full` est vert.
- Hors périmètre, nommé par le ticket lui-même : l'accordéon des actions de la fiche (les
  six autres actions restent affichées en blocs empilés, inchangé par ce lot).
