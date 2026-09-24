# 61-FORMULAIRES-1-REPRISE — passation

## Ce que j'ai changé

- `app/(back-office)/interventions/nouvelle/bouton-creer.tsx` — le filet visuel du double
  clic ne se pose plus dans le `onClick` du bouton. Il écoute maintenant l'évènement `submit`
  DU FORMULAIRE (via une ref sur le bouton et `boutonRef.current.form`, posée en
  `useEffect`) : `formulaire.addEventListener("submit", () => setEnvoye(true))`. Le bouton
  reste `<Button type="submit" disabled={envoye}>`, mais plus rien ne le désactive avant que
  le navigateur ait pris sa décision de soumettre.
- `app/(back-office)/interventions/nouvelle/page.tsx` — fusion de `55-FORMULAIRES-1-garde`
  sur `main` à jour (qui portait déjà `56-FORMULAIRES-2`, mergé entre-temps). Conflit sur ce
  seul fichier : les deux blocs coexistent — le préremplissage du contact/type/priorité/panne
  de 56, PUIS le tirage de l'`id` au rendu de 55. Aucune autre ligne touchée.
- `tests/e2e/formulaires-1.spec.ts` — deux épreuves ajoutées, en plus de celle déjà écrite par
  55 (inchangée) : un clic RÉEL sur « Créer » qui vérifie la navigation vers la fiche, et un
  double clic RÉEL (`dispatchEvent("click")` deux fois) qui vérifie qu'une seule intervention
  naît malgré tout.

Ce que ça change pour l'exploitation : la création d'intervention repart. Avant ce lot, un
clic sur « Créer l'intervention » ne soumettait plus RIEN — `disabled` posé dans le `onClick`
annulait la soumission native du formulaire lui-même, pas seulement un second clic. Le geste
d'ouverture de tout le parcours (créer une demande) était cassé pour tout le monde, sur chaque
création.

## Ce que j'ai mesuré

AVANT (mesure du ticket, journal de la file du 25/09 01h45) : `pnpm test:e2e` sur la suite
complète — 12 épreuves en échec, toutes sur `expect(page).toHaveURL(/\/interventions\/[0-9a-f-]+$/)`
reçu `/interventions/nouvelle` (le formulaire ne partait pas).

Mesuré directement sur `55-FORMULAIRES-1-garde` avant correction : le code du filet visuel
était exactement celui décrit dans la passation de 55 — `disabled={envoye}` posé par
`onClick={() => setEnvoye(true)}`, sur un `<Button type="submit">`. C'est la cause : dans un
navigateur Chromium (celui de Playwright), désactiver l'ATTRIBUT `disabled` d'un bouton `submit`
DEPUIS son propre gestionnaire `onClick` — donc AVANT que le navigateur ait construit la liste
d'entrée du formulaire et planifié la navigation — annule la soumission native elle-même, pas
seulement un second clic. La correction déplace la désactivation sur l'évènement `submit` DU
FORMULAIRE : à ce moment-là, la liste d'entrée peut encore être modifiée depuis ce même
gestionnaire (comportement standard, documenté), ce qui signifie que la soumission est déjà
irrévocablement engagée — la désactiver alors ne l'annule jamais.

APRÈS :
- Les 12 épreuves listées par le ticket, lancées SEULES (`avertissements-1.spec.ts`,
  `captures-parcours-1.spec.ts`, `creation-jour-ferme.spec.ts`, `fiche-technicien-nomme.spec.ts`,
  `intervention-machine.spec.ts`, `intervention-technicien-select.spec.ts`,
  `interventions-2.spec.ts`, `parcours-creer-puis-planifier.spec.ts`, `selecteurs-1.spec.ts`,
  `formulaires-1.spec.ts`) : **toutes vertes** — voir « Le piège rencontré » ci-dessous pour les
  deux rougissements observés à ce stade, tous deux non reproductibles en isolation et sans
  lien avec ce lot.
- `pnpm verify:full`, EN ENTIER, en un seul appel au premier plan : **vert** — `format:check`,
  `typecheck` (0 erreur), `lint` (0 avertissement), `test`, `test:isolation`, `build`,
  `feries:horizon`, `audit:partitions`, puis `test:e2e` (234 tests, 231 passés, 3 ignorés,
  0 échec — dont les 12 épreuves du ticket et les 3 de `formulaires-1.spec.ts`, TOUTES vertes
  dans la vraie suite complète).

## Ce que j'ai tranché et pourquoi

- **La désactivation s'accroche au FORMULAIRE, pas au bouton**, via une ref + un écouteur natif
  posé en `useEffect` — et non un `onSubmit` React sur le `<form>` : cet élément est rendu par
  `page.tsx`, un composant SERVEUR (`async function`), qui ne peut pas recevoir de fonction en
  prop (frontière serveur/client de Next.js). `BoutonCreer`, lui, est déjà un composant client
  local à cet écran (décision de 55, inchangée) : c'est lui qui pose l'écouteur, sur le DOM du
  formulaire auquel son propre bouton appartient.
- **`dispatchEvent("click")` plutôt que `.click()` pour l'épreuve du double clic réel.** Mesuré :
  `Promise.all([bouton.click(), bouton.click({ force: true })])` fait tourner indéfiniment le
  pipeline d'actionabilité de Playwright — il attend qu'un élément soit « enabled » avant de le
  cliquer, puis qu'il redevienne stable après la navigation ; un bouton légitimement désactivé
  par ce lot ne redevient jamais actionnable, et l'épreuve expire à 30 s. `dispatchEvent` pose
  l'évènement DOM sans ce pipeline — exactement ce qu'un double clic physique produit à l'écran.
- **Le conflit de fusion sur `page.tsx` s'est réglé en gardant les DEUX blocs**, comme demandé
  par le ticket (« 56 modifie la même page : pars de SA version ») : le bloc de 56
  (préremplissage après refus de saisie) est resté intact, celui de 55 (tirage de l'`id`) a été
  rajouté à sa suite. Aucune ligne de l'un n'écrase l'autre.

## Ce que je n'ai PAS fait

- Aucune migration, aucune ligne de semis.
- Aucune assertion des 12 épreuves listées par le ticket n'a été modifiée — elles repassent
  toutes au vert par la seule correction du filet visuel.
- `lib/interventions/depot.ts` et `app/api/interventions/creer/route.ts` n'ont pas été
  retouchés au-delà de la fusion automatique (déjà propre) de `55-FORMULAIRES-1-garde` : la
  protection de fond (`interventionDejaCreee`, relecture sous contexte cloisonné) est celle
  écrite par 55, inchangée.
- Pas touché `depot/` ni `11-FILE.sh`.
- Pas de nouvelle clé de dictionnaire.

## Les pièges pour la session suivante

- **Lancer les épreuves d'un ticket en les regroupant à la main dans un seul appel
  `pnpm test:e2e a.spec.ts b.spec.ts ...` n'est PAS équivalent à les lancer chacune seule, ni à
  la vraie suite complète.** En regroupant les 12 épreuves du ticket avec `formulaires-1.spec.ts`
  (10 fichiers, 12 workers), deux rougissements sont apparus, tous deux ABSENTS et de la vraie
  exécution en isolation et de la vraie suite complète (`pnpm verify:full`) :
  - `avertissements-1.spec.ts:248` comptait `courrielsCaptures().length` — un fichier PARTAGÉ
    par TOUT le processus serveur (`tests/e2e/setup/double-courriel.cjs` intercepte `fetch`
    vers `api.resend.com` pour N'IMPORTE QUEL scénario qui envoie un courriel) : lancer ce
    fichier à côté d'autres qui planifient des interventions, dans un sous-ensemble arbitraire
    et avec un nombre de workers différent de celui de la vraie suite, a fait dériver le compte
    d'un run à l'autre. Reproductible UNIQUEMENT dans cette combinaison ad hoc ; vert en
    isolation ET vert dans `pnpm verify:full` complet (234 tests, 12 workers, la config réelle
    de `playwright.config.ts`). Je n'ai touché ni son assertion ni sa mise en scène — le défaut
    n'est pas dans ce fichier, il est dans la façon dont je l'ai combiné.
  - `parcours-creer-puis-planifier.spec.ts:241` (glisser-déposer) a échoué une fois dans le même
    lot combiné (« aucun point visible » pour le geste), vert en isolation et vert dans
    `verify:full` complet — même famille : géométrie perturbée par d'autres épreuves qui
    changent le viewport en parallèle, hors de la configuration réelle des workers.
  - **Conclusion pour la suite : pour vérifier un sous-ensemble d'épreuves avant `verify:full`,
    les lancer soit UNE PAR UN FICHIER, soit accepter qu'un rougissement dans un regroupement
    ad hoc n'est probant qu'après confirmation en isolation ET dans la vraie suite complète** —
    ne jamais conclure à une régression sur la seule foi d'un run combiné inventé pour l'occasion.
- La fusion de `55-FORMULAIRES-1-garde` était propre partout SAUF `page.tsx` (conflit attendu,
  annoncé par le ticket) — `route.ts` et `lib/interventions/depot.ts` se sont fusionnés sans
  intervention.
- `Button` (`components/ui/button.tsx`) n'utilise pas `forwardRef`, mais React 19 accepte `ref`
  comme une prop ordinaire pour les composants fonction : `<Button ref={...}>` fonctionne sans
  modification du composant partagé. Ne pas supposer l'inverse en touchant un composant
  `shadcn/ui` de ce dépôt.

## Ce qui reste à faire

- Rien d'identifié spécifiquement par ce lot. Les points déjà notés par la passation de 55
  restent ouverts et hors territoire ici : `creerIntervention` n'est pas elle-même idempotente
  sous une VRAIE course concurrente (fenêtre entre la lecture d'existence et l'écriture), et les
  valeurs du formulaire ne sont pas conservées après un refus de soumission autre que ceux déjà
  gérés par 56.
