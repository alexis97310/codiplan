# 9EJ-CORRECTIFS-AUDIT-TUILES-ID — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

**Partie A — la tuile cliquable en bloc.** `components/ui/kpi.tsx` posait, dès
qu'un `href` existait, un `<Link>` (donc un `<a>`) sans jamais lui donner
`display: block`. Un `<a>` est `inline` par défaut : sur une tuile dont le
libellé ou le détail passe sur plus d'une ligne, le filet de couleur et le
bord se redessinaient par ligne de texte, le libellé était rogné à gauche et
le chevron sortait de la carte. Pour l'exploitation : les trois tuiles
cliquables de `/vgp` (« Échéances à venir », « Échéances dépassées », « Sans
information ») et les deux tuiles de `/tableau-de-bord` et `/interventions`
redeviennent des cartes pleines, cliquables sur toute leur surface, identiques
à leurs voisines inertes.

**Partie B — un identifiant mal formé rend « introuvable », jamais une
panne.** Sept fiches `[id]` du back-office (clients, demandes, interventions,
parametres/forfaits, parc, sites, vgp/enregistrer) transmettaient l'identifiant
de l'URL tel quel à Postgres, qui refuse un uuid mal formé par une exception
(500, « Une erreur est survenue ») plutôt que par l'absence attendue.
`estUuid` (déplacée de `app/api/contacts/saisie-recue.ts` vers
`lib/identifiant.ts`, qui la réexporte — aucun doublon) est désormais posée
devant chaque lecture : un identifiant mal formé rend `notFound()`, la MÊME
page que toute fiche hors périmètre ou inexistante (D35, D50). Pour
l'exploitation : un lien forgé, un favori périmé ou une faute de frappe dans
l'adresse ne casse plus l'écran — le cas réel qui a ouvert le constat,
`/interventions/a-facturer` (un segment de la maquette, pas encore sur
`main`), rend désormais « Page introuvable » au lieu de « Une erreur est
survenue ».

Aucune règle de gestion n'a changé, aucun droit n'a changé, aucune migration.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- `pnpm vitest run tests/unit/identifiant.test.ts tests/unit/ui/composants-base.test.tsx`
  — 34 passées.
- `pnpm test` (suite unitaire complète) — 381 fichiers, 4054 épreuves, toutes
  vertes, avant et après chaque partie.
- `pnpm typecheck` / `pnpm lint` / `pnpm format:check` — zéro erreur, zéro
  avertissement, à chaque commit.
- `tests/e2e/9ej-kpi-tuile-cliquable-bloc.spec.ts` — rejoué contre un build
  réel (`CI=1 pnpm exec playwright test`) : les cinq tuiles de `/vgp` rendent
  chacune UN SEUL rectangle (`getClientRects().length === 1`), les trois
  cliquables comme les deux inertes. **La comparaison par hauteur en pixels
  s'est révélée fausse** (voir « ce que j'ai tranché »).
- `tests/e2e/tous-les-ecrans-rendent.spec.ts` (étendu) — les sept routes
  listées rendent 404 sur un identifiant mal formé, jamais 500 ;
  `/interventions/a-facturer` idem ; `/parametres/forfaits/[id]` s'ouvre
  désormais avec une fiche réelle de la scène (`FORFAITS_SCENE`, fixture déjà
  écrite par `prisma/seed-data.ts`, lue seulement) — ce dernier cas n'avait
  **aucune** couverture e2e avant ce ticket (la boucle `ROUTES` le sautait,
  faute de semis).
- **Captures AVANT/APRÈS**, worktree détaché sur `eb17c838` pour l'AVANT
  (`git worktree add --detach`), code livré pour l'APRÈS — voir
  `captures/README.md`. `/interventions/abc` : « Une erreur est survenue »
  avant, « Page introuvable » après. `/vgp` : le défaut est VISIBLE (libellés
  assez longs pour wrapper à 1280 et 375 px). `/tableau-de-bord` et
  `/interventions` : captures AVANT et APRÈS **identiques au hash** — leurs
  tuiles portent des libellés trop courts pour jamais passer à la ligne à ces
  deux largeurs, donc le défaut CSS (bien réel, prouvé par le DOM) n'y est
  jamais visible à l'écran.
- `CI=1 pnpm verify:full`, joué EN ENTIER au premier plan, un seul appel :
  format + typecheck + lint + 4054 épreuves unitaires + isolation + build +
  fériés + partitions + **940 épreuves e2e (933 passées, 7 sautées
  préexistantes, 0 échec)**, ~50 minutes.

## Ce que j'ai tranché et pourquoi

- **Comparer les hauteurs en pixels des cinq tuiles de `/vgp` est une
  mauvaise épreuve.** Première version : `/vgp` rougissait sur
  « kpi-sans-information mesure 148px contre 182px » — les cinq libellés
  n'ont pas la même longueur, et une tuile dont le texte tient sur une ligne
  de plus mesure légitimement plus haut, sans rapport avec `display`.
  Remplacée par `getClientRects().length === 1` : un élément `inline` dont le
  contenu wrappe se fragmente en un rectangle par ligne — c'est très
  exactement ce qui dessinait le filet et le bord par ligne de texte — alors
  qu'un élément `block` n'en rend jamais qu'un seul. Signal robuste au
  contenu, jamais aux dimensions.
- **`imports/[id]` n'est pas touché, et c'est vérifié, pas supposé.** Il porte
  déjà son propre contrôle (`estUnIdentifiant`, une regex locale au fichier)
  qui rend « introuvable » sur un identifiant mal formé — mesuré en relisant
  le fichier, confirmé par la ligne `/imports/abc → 200` du constat du
  ticket. Aucun doublon créé : `estUuid` (Zod) et `estUnIdentifiant` (regex)
  cohabitent, chacune dans son fichier.
- **`parametres/agences/[id]` n'est pas touché**, conformément au territoire :
  c'est le lot 9DQ (hub des paramètres), pas encore rejoué sur `main`. La
  route `.../modifier` de la même famille porte déjà sa propre garde
  (AGENCE-1) et continue d'être éprouvée telle quelle.
- **Les captures de `/tableau-de-bord` et `/interventions` sont fournies
  malgré l'absence de différence visuelle** — demandées explicitement par le
  ticket, et la non-différence est elle-même une information utile (le défaut
  CSS existait partout, mais ne se voyait qu'où le texte wrappe).

## Ce que je n'ai PAS fait

- Aucune règle de gestion, aucun droit, aucune migration, aucune valeur
  inventée.
- La page « À facturer » (9EA-1/FACTURE-1) n'a pas été créée — hors
  territoire, point d'arrêt ARGENT.
- La refonte des tuiles, du tableau de bord, du registre ou de la VGP (9EA,
  9EG) n'a pas été entamée.
- `app/(back-office)/parametres/agences/**` n'a pas été touché.
- `app/(mobile)/terrain/[id]/page.tsx` n'a pas été touché : le constat du
  ticket (point 5) ne liste que les pages `[id]` « du bureau », et le
  territoire ne le nomme pas.
- Aucune des 112 captures d'autres tickets régénérées par effet de bord de
  `pnpm verify:full` (rendu non déterministe de certains fichiers
  `captures-*.spec.ts` qui écrivent sans variable d'environnement de garde)
  n'a été committée — restaurées avec `git restore`, les fichiers neufs
  supprimés. Aucune n'a été modifiée intentionnellement par ce ticket.

## Les pièges pour la session suivante

- **Ce worktree était en `HEAD détachée` sur `origin/main` (`eb17c838`) dès le
  début de la session** — pas une branche nommée `main` (elle est occupée par
  un autre worktree, `/home/aplou/codiplan`, resté loin derrière). Les deux
  commits de ce ticket (`partie A`, `partie B`) sont donc sur une HEAD
  détachée ; c'est la file (`11-FILE.sh`) qui les intègre, pas cette session.
- **`pnpm verify:full` réécrit des captures d'autres tickets en effet de
  bord** : certains `tests/e2e/captures-*.spec.ts` (ex. `avertissements-1.spec.ts`)
  écrivent leurs PNG SANS variable d'environnement de garde, directement dans
  `docs/propositions/<AUTRE-TICKET>/captures/`, à chaque exécution. Après tout
  `verify:full`, vérifier `git status` AVANT de `git add` quoi que ce soit, et
  restaurer ce qui n'appartient pas au ticket courant (`git restore` sur les
  fichiers modifiés, suppression des fichiers neufs non trackés).
- **Comparer des tuiles par hauteur en pixels est fragile** dès que leurs
  libellés diffèrent en longueur — préférer `getClientRects().length` pour
  détecter un `inline` fragmenté.
- La recette « AVANT/APRÈS par worktree détaché » (`git worktree add --detach
  <commit>`, lien symbolique vers `node_modules`, copie de `.env`, port et
  base de données distincts) fonctionne bien quand le code AVANT est déjà
  committé — c'était le cas ici dès que les deux parties ont été commitées.

## Ce qui reste à faire

- Rien dans le territoire de ce ticket. `parametres/agences/[id]` reste sans
  garde d'identifiant — territoire du lot 9DQ, à traiter quand ce lot sera
  rejoué sur `main`.
- `demandes/[id]` reste sans aucune épreuve e2e ouvrant une fiche RÉELLE (la
  boucle `ROUTES` de `tests/e2e/tous-les-ecrans-rendent.spec.ts` la saute,
  faute de ligne au semis) — gap préexistant, non aggravé ni corrigé par ce
  ticket (le semis n'écrit aucune `demande`, voir l'en-tête de ce fichier).
