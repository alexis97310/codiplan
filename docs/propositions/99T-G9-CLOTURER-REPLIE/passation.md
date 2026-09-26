# 99T-G9-CLOTURER-REPLIE — passation

## Ce que j'ai changé

- `lib/interventions/action-principale.ts` : `blocCloturerReplie({ statut, verdict })`,
  fonction PURE neuve. Elle répond `true` quand le statut n'est PAS `terminee` **et**
  que le verdict de « Clôturer » est exactement le refus `intervention.refus.temps_manquant`
  — aucun autre refus, aucun autre statut ne la fait répondre `true`.
- `app/(back-office)/interventions/[id]/page.tsx` :
  - le composant `Action` gagne un prop optionnel `replie` (défaut `false`). Quand le
    verdict est un refus ET `replie` est vrai, il rend un `<details>` fermé, ton
    NEUTRE (`bg-app-surface border-app-bord`, mêmes classes que « Suspendre » replié),
    dont le `<summary>` porte le titre ; la raison du refus (`text-app-rouge-encre`,
    comme avant) n'apparaît que déplié. Sans `replie`, le régime oxyde d'origine
    (`<section>` toujours visible) est inchangé — c'est la SEULE branche neuve, tout
    le reste du composant est intact.
  - le bloc « Clôturer » passe `replie={blocCloturerReplie({ statut, verdict: peutCloturer(...) })}`.
    Aucun autre bloc (Planifier, Affecter, Suspendre, Annuler) n'appelle cette prop.
  - les deux commentaires cités par le ticket (docstring d'`Action`, et le commentaire
    sur `principale`) sont réécrits pour nommer cette exception, sans rien effacer de
    la règle qu'ils énoncent par ailleurs.
- `docs/arbitrages.md` : un paragraphe « AMENDEMENT 26/09/2026 (décision d'Alexis,
  audit G9) » ajouté SOUS la section D120 existante (rien n'a été retiré ni réécrit
  ailleurs dans D120).
- `lib/i18n/fr.ts` : deux clés de fixture d'épreuve neuves (`bloccloturereplie.e2e.client`,
  `bloccloturereplie.e2e.site`), même discipline que `ergo3.e2e.*` et `actionprincipale.e2e.*`.
  Aucune clé de production ajoutée ou modifiée — le texte du refus lui-même
  (`intervention.refus.temps_manquant`) est inchangé.
- **Ce que ça change pour l'exploitation** : sur une fiche `a_planifier`, `planifiee`,
  `affectee`, `en_cours` ou `suspendue` sans temps mesuré, le bloc rouge « Clôturer »
  qui s'affichait déplié sur CHAQUE fiche non terminée (et qu'on ne remarquait donc
  plus, constat G9) se replie désormais comme une action secondaire — un clic sur le
  titre reste possible pour lire la raison. Sur une fiche `terminee`, rien ne change :
  c'est la seule où « Clôturer » est l'action attendue, et le refus reste visible
  d'emblée. Aucune règle de gestion, aucun verdict de `cycle-de-vie.ts` n'a bougé —
  seul l'AFFICHAGE d'un refus déjà existant change.

## Ce que j'ai mesuré

- **AVANT** (`captures/cloturer-avant-{1280,375}.png`, rejoué contre le code du
  commit précédent ce lot, 049e741 — `git checkout 049e741 -- "app/(back-office)/
  interventions/[id]/page.tsx"`, `pnpm build`, `next start` sur le port 3200 avec un
  rôle applicatif dédié, scène TMP-CAPTURE créée par un script jetable puis
  supprimée, fichier restauré ensuite avec `git checkout HEAD --`, `git diff --stat
  HEAD` vide vérifié après coup) : sur une fiche `a_planifier`, le bloc « Clôturer »
  s'affiche déplié, en oxyde, juste sous « Planifier » — visible d'emblée, comme le
  décrit le constat G9.
- **APRÈS** (`captures/cloturer-apres-{1280,375}.png`, même scène, même script,
  code de ce chantier reconstruit) : le bloc « Clôturer » a disparu de la vue
  immédiate, remplacé par une ligne repliée « ▸ Clôturer » au ton neutre, à la
  même place que « Suspendre » et « Annuler l'intervention ».
- Les épreuves de bout en bout `tests/e2e/fiche-cloturer-replie.spec.ts` capturent
  aussi, sur leur PROPRE scène `G9-` : `cloturer-a-planifier-replie-{1280,375}.png`
  (fermé, raison masquée), `cloturer-a-planifier-ouvert-1280.png` (après clic sur le
  résumé, raison visible), `cloturer-terminee-deplie-{1280,375}.png` (intervention
  `terminee` : bloc toujours en oxyde, déplié, comme avant ce lot).
- `pnpm format:check`, `pnpm typecheck`, `pnpm lint` : verts.
- `pnpm test` (unitaires) : 270 fichiers, 2908 tests, verts — dont les six épreuves
  neuves de `blocCloturerReplie` dans `tests/unit/interventions/action-principale.test.ts`.
- `tests/e2e/fiche-cloturer-replie.spec.ts` seul, joué deux fois de suite (une fois
  dans le `verify:full` complet, une fois isolé après correction du sélecteur) :
  2/2 verts les deux fois, aucun flake mesuré sur ce fichier.
- `CI=1 pnpm verify:full`, joué TROIS FOIS EN ENTIER :
  - 1er passage (avant la correction du sélecteur ci-dessous) : mon épreuve
    « terminée » échouait (violation de mode strict, voir « ce que j'ai tranché »),
    plus deux échecs sur `tests/e2e/glisser-deposer.spec.ts`, étranger à ce lot.
  - 2e passage (après correction) : **311 passés, 3 ignorés, 0 échec** — entièrement
    vert, `glisser-deposer.spec.ts` y compris.
  - 3e passage (rejoué pour confirmation) : mon fichier toujours 2/2 vert, mais
    `glisser-deposer.spec.ts` a de nouveau échoué (1 échec + 1 test signalé
    « flaky ») — détaillé sous « les pièges » : confirmé comme un flake
    intermittent, préexistant, sans rapport avec ce lot.

## Ce que j'ai tranché, et pourquoi

- **`blocCloturerReplie` vit dans `action-principale.ts`, pas dans `cycle-de-vie.ts`.**
  Ce dernier ne juge que si une action est PERMISE ; `action-principale.ts` déjà
  répond à « comment l'afficher » (constat 19, 93-FICHE-ACTIONS) — cette décision
  est de la même famille : un choix d'AFFICHAGE d'un refus déjà tranché ailleurs,
  jamais une nouvelle règle de gestion.
- **Un prop `replie` sur `Action`, plutôt qu'un second composant.** Le rendu replié
  reprend exactement le même `<details>`/`<summary>` que la branche « non principale »
  existante quelques lignes plus bas — dupliquer le composant aurait fait diverger
  deux rendus qui doivent rester identiques en apparence (même classes, même
  structure).
- **Correction en cours de route, nommée honnêtement** : ma première épreuve
  « terminée » utilisait `page.locator("section", { has: heading Clôturer })`, qui
  matchait AUSSI le `<section>` englobant du panneau « Actions » (lui aussi contient
  ce `<h2>` en descendant) — violation de mode strict Playwright, détectée au premier
  `verify:full`. Corrigé en scopant sur la classe `border-app-rouge-bord`, propre au
  bloc refusé oxyde. Second `verify:full` complet vert après ce correctif.
- **Les captures AVANT/APRÈS rejouent un script jetable plutôt que l'épreuve e2e
  elle-même**, parce que l'épreuve neuve affirme le comportement APRÈS (elle
  échouerait avant même d'atteindre l'instruction de capture si on la rejouait sur
  l'ancien code — le sélecteur `details` n'existe pas du tout dans le rendu oxyde
  d'origine). Le script (`scripts/tmp-captures-cloturer.mts`, supprimé après usage,
  jamais commité) reprend la même scène minimale, connexion par le même chemin
  écran que `ouvrirUneSession`.

## Ce que je n'ai PAS fait

- Je n'ai touché AUCUN autre bloc du panneau « Actions » (Planifier, Affecter,
  Suspendre, Annuler) : `replie` n'est appelé qu'au seul appel de « Clôturer ».
- Je n'ai pas modifié `tests/e2e/glisser-deposer.spec.ts`, qui a rougi deux fois sur
  trois passages de `verify:full` — voir « les pièges » ci-dessous. C'est hors du
  territoire de ce ticket, et je ne l'ai pas mesuré comme causé par ce lot (il rougit
  identiquement seul, sans mon fichier, sur une base fraîchement semée).
- Je n'ai pas rejoué `pnpm test:isolation` séparément : `verify:full` l'inclut déjà
  et il est passé dans les deux passages verts.
- Je n'ai pas touché la garde de base (`intervention_cycle_de_vie` ou tout autre
  trigger) : `peutCloturer` (`lib/interventions/cycle-de-vie.ts`) est strictement
  inchangé, seul son AFFICHAGE change de forme.

## Les pièges pour la session suivante

- **`tests/e2e/glisser-deposer.spec.ts` est un flake préexistant, confirmé
  intermittent et étranger à ce lot** : rejoué seul, sur une base fraîchement migrée
  et semée, sans aucun autre fichier de test présent, il échoue une fois sur deux
  environ (`[data-depot-jour="2026-09-22"]` introuvable, ou `data-refus` attendu
  absent). Il ne s'agit pas d'un partage de scène avec un autre fichier (testé en
  isolation totale) — l'hypothèse la plus probable, NON VÉRIFIÉE, est une scène
  calculée par rapport à « aujourd'hui » (`lundiDeLaSemaine`) qui dérive par rapport
  à des dates fixes du fichier (`2026-09-22`, un mardi de la semaine visée). Si la
  file de nuit rougit sur ce fichier, ce n'est probablement pas ce lot — mais je n'ai
  ni creusé la cause exacte ni touché au fichier (hors territoire).
- **`kill <pid>` ciblé, jamais `pkill -f "next start"` en aveugle** — un `pkill -f`
  large a échoué de façon inattendue (code de sortie 144) sans tuer le bon
  processus dans ce poste ; j'ai dû retrouver le PID exact via `ss -ltnp` pour
  arrêter proprement les deux serveurs de capture temporaires. Cohérent avec la
  mémoire déjà posée sur ce poste : un `pkill -f` peut viser le shell appelant.
- Le composant `Action` (`page.tsx`) contient maintenant DEUX rendus de refus
  (oxyde déplié, et repliable) : toute future modification du rendu du refus
  (couleur, structure) doit toucher les deux branches, ou vérifier explicitement
  si l'exception doit s'appliquer aussi.

## Ce qui reste à faire

- Rien dans le territoire de ce ticket. Le flake de `glisser-deposer.spec.ts`
  mériterait un ticket dédié pour en établir la cause exacte (scène liée à
  « aujourd'hui » contre dates fixes, à confirmer) — je ne l'ai pas ouvert moi-même,
  n'ayant pas le mandat de trancher hors du périmètre G9.
