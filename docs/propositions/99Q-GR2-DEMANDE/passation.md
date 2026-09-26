# 99Q-GR2-DEMANDE — passation

## Ce que j'ai changé

- `app/(back-office)/demandes/[id]/page.tsx` : « Créer une intervention depuis cette
  demande » quitte le lien souligné qui vivait AU-DESSUS du bouton « Transformer en
  intervention », dans la même carte, et devient un bouton PLEIN (`LienPrimaire`,
  `components/ui/action-primaire.tsx` — la même apparence que les autres boutons de
  création du dépôt), posé en tête du bloc d'actions (`data-bloc="demande-actions"`),
  sous la MÊME condition d'affichage qu'avant (`peutTransformer`, capacité
  `creer_demande`). Sans flèche : les autres boutons primaires n'en portent pas.
- Le bouton qui posait SEULEMENT le statut s'appelle désormais « Marquer comme
  transformée » (`demande.action.marquer_transformee`, nouvelle clé — l'ancienne
  `demande.action.transformer` a disparu, plus aucun appelant). Quand
  `interventionsIssues` est vide, il passe par `BoutonAvecConfirmation`
  (composant déjà employé pour « Annuler l'intervention » et « Lever un blocage
  d'agenda ») : une confirmation dit qu'aucune intervention n'existe encore et que
  l'action retire la demande de la file. Quand au moins une intervention est déjà
  issue de la demande, la soumission part directement, sans confirmation. Le geste
  serveur (`/api/demandes/[id]/transformer`, `marquerTransformee`) est INCHANGÉ :
  aucune règle de gestion n'a bougé, seule sa présentation à l'écran change.
- `Action` (composant interne à la page) gagne une prop optionnelle
  `boutonPersonnalise`, qui remplace le bouton de soumission par défaut — c'est ce
  qui permet à « Marquer comme transformée » de porter la confirmation sans dupliquer
  la carte.
- `lib/i18n/fr.ts` : clé renommée (`demande.action.marquer_transformee`), note
  réécrite pour dire « le bouton ci-dessus » plutôt que « le lien ci-dessous »,
  flèche retirée du libellé du bouton de création, trois clés neuves pour la
  confirmation (`demande.transformer.confirmation`, `.confirmer`, `.revenir`).
- **Ce que ça change pour l'exploitation** : un dépanneur ou un ADV qui qualifie un
  appel ne peut plus cliquer « Transformer en intervention » en croyant que ça crée
  l'intervention — c'est exactement le constat G4 de l'audit du 26/09. Le geste qui
  planifie réellement (le bouton bleu, en tête) est maintenant le plus visible des
  deux, et marquer une demande transformée sans avoir rien créé derrière demande
  désormais une confirmation explicite.

## Ce que j'ai mesuré

- **AVANT** (`docs/propositions/99Q-GR2-DEMANDE/captures/avant-{1280,375}.png`,
  prises en rejouant temporairement le code du commit précédent, 7fbeca4) :
  la fiche d'une demande qualifiée montre le lien souligné « Créer une intervention
  depuis cette demande → » AU-DESSUS d'un bouton plein « Transformer en
  intervention », dans la même carte — visuellement, le bouton l'emporte sur le
  lien. Confirme le constat G4.
- **APRÈS** (`captures/apres-{1280,375}.png` et `captures/apres-dialogue-1280.png`,
  même scène, code corrigé) : le bouton bleu « Créer une intervention depuis cette
  demande » est en tête de la colonne d'actions, avant même « Accuser réception » ;
  plus bas, « Marquer comme transformée » ouvre une confirmation qui explique ce
  qu'elle fait (capture avec dialogue ouvert).
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test` (2898 tests) :
  tous verts.
- `pnpm test:e2e` ciblé sur `demandes.spec.ts`, `demandes-2.spec.ts` et
  `demandes-marquer-transformee.spec.ts` (le fichier neuf) : 11 tests, tous verts.
- `CI=1 pnpm verify:full`, joué EN ENTIER, DEUX FOIS, après le commit et après la
  restauration du code suite aux captures (`git diff --stat HEAD` vide sur les
  quatre fichiers du lot) : les deux fois, 298-299 tests passés, ZÉRO échec côté
  `demandes*`, et un seul fichier étranger au lot en défaut à chaque fois —
  `tests/e2e/glisser-deposer.spec.ts` (planning, glisser-déposer, hors territoire
  de ce ticket). Les deux exécutions complètes ont chacune produit une combinaison
  différente de tests en défaut dans CE fichier (219+139 puis 249+139), toujours
  avec la même signature : un refus `chevauchement` réel s'affiche à la place du
  refus SIMULÉ que l'épreuve attend (route interceptée) — signe d'une VRAIE
  collision de créneau créée par une autre épreuve tournant en parallèle
  (`fullyParallel`), pas d'un défaut de ce lot. **Mesuré, pas supposé** :
  `pnpm exec playwright test tests/e2e/glisser-deposer.spec.ts` seul, sans le
  reste de la suite en parallèle, est vert (8/8) — deux fois rejoué. Ce fichier
  n'a pas été touché : il est hors du territoire de ce ticket
  (`app/(back-office)/demandes/[id]/page.tsx`, `lib/i18n/fr.ts`, les épreuves
  demandes), et sa mise en scène n'a pas de lien avec la mienne (aucun client,
  site ni technicien commun). **`pnpm verify:full` n'est donc jamais sorti
  intégralement vert sur ce poste au cours de ce lot** — la file de nuit le
  rejouera elle-même et ne publiera que si c'est vert ; si elle bute sur le même
  fichier, la cause est écrite ci-dessus plutôt qu'à découvrir.

## Ce que j'ai tranché, et pourquoi

- **« En tête du bloc » = en tête de `<aside data-bloc="demande-actions">`**,
  avant même « Accuser réception », plutôt qu'à l'intérieur de la carte
  « Marquer comme transformée ». Le constat de l'audit est que l'utilisateur
  clique le bouton qui porte le nom de sa tâche sans la faire — la réparation la
  plus directe est de rendre le geste qui crée réellement l'intervention le plus
  visible de tous, séparé de l'action qui ne fait que poser un statut.
- **`demande.action.transformer` est supprimée plutôt que conservée à côté d'une
  clé neuve** : plus aucun appelant ne la lisait une fois la page et l'épreuve
  mises à jour, et une clé orpheline n'est gardée nulle part ailleurs dans ce
  dépôt par convention.
- **Le texte de confirmation reprend mot pour mot celui du ticket** (« Aucune
  intervention n'est née de cette demande. La marquer transformée la retire de la
  liste. ») plutôt que d'en composer un autre : le ticket le donnait déjà, en
  inventer un autre aurait été une divergence gratuite.
- **`boutonConfirmer`/`boutonRevenir` valent « Confirmer » / « Revenir »**, non
  spécifiés par le ticket : les autres confirmations du dépôt (absences, annulation)
  portent un texte de confirmation propre à leur domaine («Confirmer la levée»,
  «Confirmer l'annulation») ; ici la phrase de confirmation dit déjà tout ce qu'il
  y a à confirmer, un texte de bouton plus spécifique n'aurait rien ajouté.
- **`Action` gagne une prop plutôt qu'un second composant** : la seule différence
  entre les deux formes est le bouton de soumission, tout le reste (formulaire,
  titre, note, refus) est identique — dupliquer la carte aurait été l'abstraction
  que rien ne demandait dans l'autre sens.

## Ce que je n'ai PAS fait

- Aucune migration, aucune ligne de semis, aucune règle de gestion touchée :
  `marquerTransformee` (`lib/demandes/depot.ts`) et le déclencheur
  `demande_cycle_de_vie` sont inchangés.
- Je n'ai pas touché `lib/demandes/` ni les routes API, hors territoire du ticket.
- Je n'ai pas touché `tests/e2e/glisser-deposer.spec.ts`, ni sa mise en scène : hors
  territoire de ce ticket, sans lien avec ma scène, et vert en isolation (voir
  « Ce que j'ai mesuré »).

## Les pièges pour la session suivante

- Les captures AVANT/APRÈS ont été prises avec un script Playwright TEMPORAIRE,
  jamais commité (`tests/e2e/zz-capture-99q.spec.ts`, supprimé après usage) : il
  désigne le bouton « Marquer comme transformée » par son FORMULAIRE
  (`form[action$="/transformer"] button`), jamais par son libellé, pour rester
  compilable que le code lu soit l'ancien ou le nouveau — `next build` type-vérifie
  tout `tests/` (tsconfig `**/*.ts`), et un script qui lirait
  `fr["demande.action.marquer_transformee"]` aurait cassé le build AVANT. Même
  piège que documenté dans la mémoire du poste pour VGP-2.
- Pour capturer l'AVANT, il a fallu `git checkout <commit précédent> --
  <les 3 fichiers modifiés>` ET déplacer temporairement
  `tests/e2e/demandes-marquer-transformee.spec.ts` HORS de `tests/e2e/` (il
  référence les clés neuves de `fr.ts`, absentes de l'ancien commit — sinon le
  build AVANT casse dessus aussi). Restauré ensuite par `git checkout HEAD --
  <mêmes fichiers>` et un simple déplacement retour ; `git diff --stat HEAD`
  vide sur les quatre fichiers du lot confirme qu'aucune trace n'est restée.
- Le compte de l'épreuve (`COMPTE_EPREUVE`, rôle `adv`) porte `creer_demande` :
  c'est ce qui rend le bouton primaire et les quatre actions visibles dans les
  captures et dans `demandes-marquer-transformee.spec.ts`.
- `tests/e2e/glisser-deposer.spec.ts` rougit sous `pnpm verify:full` (charge
  parallèle complète) mais passe seul (8/8) : une VRAIE collision de créneau
  créée par une autre épreuve du dépôt masque le refus SIMULÉ que ce fichier
  attend. Une session qui doit obtenir un `verify:full` intégralement vert sur
  ce poste devra d'abord régler CETTE contention-là — elle n'a aucun rapport
  avec 99Q-GR2-DEMANDE.

## Ce qui reste à faire

- Faire tourner `pnpm verify:full` un jour où `tests/e2e/glisser-deposer.spec.ts`
  ne subit pas la contention de créneau décrite ci-dessus, ou investiguer et
  corriger cette contention (hors territoire de ce ticket) — la file de nuit le
  rejouera de toute façon avant de publier.
