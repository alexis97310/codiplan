# 99P-GR1-NATURE — passation

## Ce que j'ai changé

- `app/(back-office)/interventions/nouvelle/page.tsx` : le `<select name="type">`
  porte désormais une première option vide, non sélectionnable
  (`intervention.creation.choisir_nature`, « Sélectionner une nature »),
  choisie par défaut tant qu'aucun `?type=` valide ne prime (reprise après
  refus, 56-FORMULAIRES-2), et l'attribut `required` du navigateur. Le
  composant `Choix` gagne un paramètre `optionVide` réutilisable par tout
  futur champ du même formulaire qui en aurait besoin. Le docblock de la prop
  `obligatoire` (l.~363) est réécrit : il disait que `obligatoire` n'ajoutait
  « aucune règle de validation » — c'est redevenu faux pour un champ qui porte
  aussi `optionVide`.
- `app/api/interventions/creer/route.ts` : une nature absente ou vide est
  désormais refusée avec un motif DÉDIÉ (`intervention.refus.nature_manquante`,
  « Choisissez la nature de l'intervention. ») plutôt que le motif générique
  « lieu inconnu », qui envoyait chercher au mauvais endroit.
- `lib/i18n/fr.ts` : les deux clés neuves ci-dessus.
- **Ce que ça change pour l'exploitation** : un dépanneur qui ouvre ce
  formulaire — depuis le planning ou depuis une demande — ne peut plus créer
  une intervention en « Préventif sous contrat » sans l'avoir choisi. Un appel
  curatif ne peut plus partir silencieusement en préventif (c'était le constat
  B1 de l'audit du 26/09).

## Ce que j'ai mesuré

- **AVANT** (captures `docs/propositions/99P-GR1-NATURE/captures/*-avant-*.png`,
  prises en rejouant temporairement le `page.tsx` du commit précédent) :
  `/interventions/nouvelle`, depuis le planning ET depuis une demande
  (`GR1CAP-Demande`), affiche « Préventif sous contrat » présélectionné dans
  « Nature (obligatoire) », sans qu'aucun choix n'ait été fait. Confirme le
  constat B1 de l'audit.
- **APRÈS** (captures `*-apres-*.png`, même scène, code corrigé) : le même
  champ affiche « Sélectionner une nature », vide, dans les deux cas.
- `pnpm typecheck`, `pnpm format:check`, `pnpm lint`, `pnpm test` (2897 tests),
  `pnpm test:isolation` (1239 tests) et `pnpm build` : tous verts.
- `CI=1 pnpm verify:full` joué EN ENTIER une fois à la fin : 301 passés, 3
  ignorés (préexistant, sans rapport avec ce lot), 0 échec.
- Les 12 épreuves e2e qui soumettaient la création sans nature (mesurées par
  grep, le nombre annoncé par le ticket était approximatif et confirmé exact) :
  toutes vertes après avoir choisi une nature dans leur mise en scène. Liste
  exacte ci-dessous.

## Ce que j'ai tranché, et pourquoi

- **Le motif du refus serveur est nommé `intervention.refus.nature_manquante`**,
  vérifié en testant `probleme.path.includes("type")` sur les erreurs Zod —
  même mécanisme que `panne_manquante`, priorité donnée à la nature sur la
  panne quand les deux manquent à la fois (ordre arbitraire, les deux cas ne
  se distinguent pas dans le ticket).
- **`optionVide` est un paramètre du composant `Choix` existant**, plutôt
  qu'un nouveau composant : `priorite` et `mode_valorisation` gardent leur
  valeur par défaut légitime (P3, temps passé) et n'ont pas besoin d'option
  vide — seul `type` en reçoit une.
- **Pas de fonction pure extraite pour un test unitaire du motif** : la
  ticket le proposait « si la route a une fonction pure testable » — elle
  n'en a pas (le choix du motif est un ternaire de trois lignes dans
  `traiter()`), et en extraire une seule pour ce test aurait été une
  abstraction que rien d'autre ne demande. Le comportement est couvert par
  l'épreuve e2e (`nature-obligatoire.spec.ts`, cas b).
- **Le refus serveur est atteint en retirant `required` en JS avant de
  soumettre** (comme `formulaires-2.spec.ts` le fait déjà pour la panne) :
  sans ce geste, le navigateur bloque la soumission avant qu'elle
  n'atteigne `/api/interventions/creer`, et l'épreuve ne prouverait alors
  que la validation HTML, pas le motif serveur.
- **Le spec de captures AVANT/APRÈS n'est pas gardé au dépôt** (recette du
  22/09/2026, lot VGP-2) : seules les images le sont, comme pour les autres
  paires AVANT/APRÈS déjà présentes dans `docs/propositions/`.

## Ce que je n'ai PAS fait

- Aucune migration, aucune ligne de semis, aucun prix — hors périmètre du
  ticket et non nécessaires ici.
- Je n'ai pas revérifié à la main que TOUTES les épreuves du dépôt hors de la
  liste ci-dessous soumettent bien une nature explicite : la revue s'est
  arrêtée aux fichiers qui référencent `interventions/nouvelle` (19 fichiers
  grep) et, parmi eux, à ceux qui cliquent réellement sur « Créer » ou
  postent directement `/api/interventions/creer`. Un fichier qui soumettrait
  ce formulaire par un mécanisme que je n'ai pas cherché (ex. un helper de
  `setup/` non détecté) resterait un risque non couvert par cette revue —
  non mesuré, seulement raisonné par grep.

## Pièges pour la session suivante

- **`required` sur un `<select>` bloque la soumission AVANT le réseau** : un
  scénario qui veut éprouver le refus SERVEUR sur la nature doit retirer
  l'attribut par `form.querySelector('[name="type"]')?.removeAttribute
  ("required")`, sinon `toHaveURL` ne voit jamais de `?motif=` et le test
  échoue en cherchant une redirection qui n'a jamais eu lieu (rouge mesuré
  une fois pendant ce lot, corrigé avant le second essai).
- **Un clic qui navigue doit être attendu avant une capture** : le premier
  essai de capture « depuis le planning » a photographié `/planning` au lieu
  du formulaire, faute d'un `page.waitForURL(...)` après le clic sur
  « Créer une intervention ». Le clic part bien, mais la navigation n'est pas
  instantanée.
- La revue des mises en scène s'est limitée aux fichiers où « Créer » est
  RÉELLEMENT cliqué ou où `/api/interventions/creer` est appelé directement
  (`formulaires-1.spec.ts` en fait deux, via `page.request.post`). Un futur
  helper partagé qui soumettrait ce formulaire ailleurs échapperait au même
  grep.

## Ce qui reste à faire

- Rien d'identifié dans le périmètre de ce ticket : les trois faces du
  correctif (formulaire vide, refus serveur dédié, demande sans nature) sont
  couvertes par une épreuve e2e neuve et par les captures. Rien n'a été laissé
  de côté volontairement au-delà de ce qui est nommé ci-dessus.

## Les épreuves e2e dont la MISE EN SCÈNE a changé (aucune assertion touchée)

Chacune choisit désormais explicitement `curatif` avant de cliquer sur
« Créer », ou lit une nature déjà choisie plutôt qu'une valeur implicite :

- `tests/e2e/avertissements-1.spec.ts` (deux scénarios)
- `tests/e2e/captures-parcours-1.spec.ts`
- `tests/e2e/creation-jour-ferme.spec.ts`
- `tests/e2e/demandes-2.spec.ts` (commentaire ajouté : la nature n'est plus
  préremplie depuis une demande, choisie explicitement dans la mise en scène)
- `tests/e2e/fiche-technicien-nomme.spec.ts`
- `tests/e2e/formulaires-1.spec.ts` (trois scénarios, dont un qui relit
  `select[name="type"]` avant de la reposter directement à l'API)
- `tests/e2e/intervention-machine.spec.ts` (deux scénarios)
- `tests/e2e/intervention-technicien-select.spec.ts`
- `tests/e2e/interventions-2.spec.ts`
- `tests/e2e/parcours-creer-puis-planifier.spec.ts` (trois scénarios)
- `tests/e2e/selecteurs-1.spec.ts`

`tests/e2e/formulaires-2.spec.ts` choisissait déjà `curatif` avant ce lot et
n'a pas eu besoin d'être touché — sa seconde soumission (après un refus sur la
panne) rejoue la même valeur, reprise par `valeurInitiale`.
