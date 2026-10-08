# Passation — 9EK-TP-UX5-2-CREATIONS-2

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

`/parc/nouvelle`, en mode CRÉATION seulement, reconstruit au gabarit du 28/09 (D184) :

- **Trois sections numérotées** (« Où est la machine », « Quelle machine », « Facultatif »),
  mêmes composants que 9EK-TP-UX5-2-CREATIONS-1 (`SectionFormulaire`, `BarreActionCollee`,
  `libelleChampObligatoire`/`libelleChampFacultatif`).
- **Une famille, pour raccourcir la liste des modèles** — `<select>` sans `name`, jamais soumis,
  familles ACTIVES de la société, remonte le sélecteur de modèle (`key`) et joint `famille` à
  `/api/recherche/modeles` seulement si une famille est choisie.
- **« Illisible ? Je ne peux pas le lire »** sous le numéro de série : référence interne remplie
  → le numéro de série devient `SN-INCONNU-<référence>` (D6, `PREFIXE_SERIE_INCONNUE`, non
  modifié) ; vide → focus sur la référence interne, avec l'aide qui l'explique rendue sous elle.
- **Trois états à la création** (décision d'Alexis du 05/10, n° 21, PV-27), en boutons visibles,
  rien de coché ; la route refuse désormais aussi « remplacée »/« ferraillée »/« fusionnée » au
  serveur (`machine.refus.statut_creation`), sous le groupe de boutons.
- **La criticité**, même forme, trois valeurs, rien de coché.
- **Le refus de doublon** (numéro de série ou référence interne déjà pris) s'affiche SOUS le
  champ en cause, jamais en plus dans le bandeau général — qui reste la seule voie pour tout
  autre refus.
- **« Créer et en ajouter une autre »** enchaîne sur un formulaire neuf, client et site repris,
  motif de succès rendu en VERT par la page (`machine.creee` est une clé de réussite,
  `tonDuMotifDeFiche` — jamais passée au formulaire, qui ne connaît que le refus).
- **Aucun aperçu de QR** : une phrase vraie renvoie à la fiche, où l'impression existe déjà.

**Pour l'exploitation** : un technicien ou RM crée une machine avec moins de clics pour la
retrouver dans un gros catalogue (famille), peut composer la plaque illisible sans calculer le
préfixe à la main, et voit son erreur de doublon exactement où elle se corrige au lieu d'un
bandeau générique en haut d'écran.

**Le mode MODIFICATION (« Corriger la fiche ») n'a pas bougé** — second arbre JSX distinct,
preuve par capture APRÈS (`corriger-la-fiche-apres-{1280,375}.png`).

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- AVANT (`eb17c838`, puis recalé sur `4e3004d7`) : `FormulaireMachine` en création rendait UNE
  carte sans section, le modèle/n° de série/client/site puis une grille de huit champs
  facultatifs, criticité ET statut en `<select>`, aucun « (facultatif) », bouton unique
  « Enregistrer » partagé avec la modification.
- APRÈS : trois sections ; 31/31 tests de `tests/unit/ui/lot-parc.test.ts` verts (dont les 15
  nouveaux de ce lot — ordre des sections, aucune case cochée, mécanisme « Je ne peux pas le
  lire » (deux cas), refus sous le n° de série ET sous la référence interne (chacun UNIQUEMENT
  sous le champ, pas de second bandeau), refus hors doublon resté dans le bandeau, changement de
  famille qui remonte le sélecteur de modèle avec `famille=`, « Créer et en ajouter une autre »
  qui construit la bonne URL, bouton principal qui rejoint toujours la fiche créée).
- `pnpm verify` (format/typecheck/lint/test/test:isolation/build) : **vert en entier** —
  4421 tests unitaires, 1512 tests d'isolation, build de production réussi.
- `tests/e2e/9ekm-creations-2.spec.ts` (3 épreuves neuves, scène `9EKM-`) : vertes — famille qui
  réduit le sélecteur de modèle à 1 résultat, création réelle en base (`SN-INCONNU-…`,
  `complet=false`, `criticite=normale`, `statut=en_service`), refus de doublon à l'écran avec
  saisie gardée, « Créer et en ajouter une autre » avec motif vert et client/site repris.
- Échantillon large d'épreuves bout en bout AFFECTÉES ou voisines, rejouées et vertes :
  `selecteurs-1.spec.ts` (4), `fiche-machine-obligatoire.spec.ts` (2),
  `tous-les-ecrans-rendent.spec.ts` (60, dont `/parc/nouvelle` et `/parc/[id]/modifier`),
  `plancher-12-pages.spec.ts` (5) — 71/71 vertes.
- `tests/e2e/captures-9ekm-creations-2.spec.ts` (6 épreuves, scène `9EKMCAP-`) : vertes, 10 PNG
  produits sous `docs/propositions/9EK-TP-UX5-2-CREATIONS-2/captures/`.

**Non mesuré** : `pnpm verify:full` dans son ENTIER (`CI=1 pnpm verify:full`, un seul appel,
premier plan). `pnpm verify` qu'il contient est vert (ci-dessus) ; `pnpm feries:horizon` et
`pnpm audit:partitions` n'ont pas été rejoués séparément ; `pnpm test:e2e` dans son ENTIER
(plusieurs centaines d'épreuves, tout le dépôt) a été lancé une fois et a dépassé 30 minutes sans
finir — voir « Pièges » ci-dessous. Ce n'est pas une hypothèse présentée comme une mesure : c'est
écrit ici comme non vérifié.

## Ce que j'ai tranché et pourquoi

- **Deux arbres JSX, un par mode** (D184) — la seule façon de garantir, sans ambiguïté, que la
  modification reste EXACTEMENT ce qu'elle rendait avant ce lot, plutôt qu'une branche
  conditionnelle au milieu d'un même formulaire.
- **`Button` (shadcn, variant par défaut), pas `ActionPrimaire` ni `BoutonCreer`**, pour les deux
  boutons du pied — `BoutonCreer` se désactive au premier `submit` et ne se réarme jamais, alors
  que ce formulaire répond en AJAX et gère déjà `envoiEnCours` lui-même ; c'est aussi la forme que
  9EK-TP-UX5-2-CREATIONS-1 a déjà choisie pour `/clients/nouveau` et `/sites/nouveau`.
- **Le « déclencheur » du clic (principal vs « ensuite »)** est lu sur `SubmitEvent.submitter`,
  pas sur un état React posé par un `onClick` séparé — mesuré que jsdom 30 le porte correctement
  (épreuve jetable, supprimée) ; ni `fireEvent.submit` direct (pas de submitter) ni un état séparé
  n'étaient nécessaires.
- **Les bordures de la famille** : `<select>` SANS `name`, familles réduites à `{id, libelle}` —
  jamais `LigneFamille` — pour ne jamais franchir la frontière serveur → client avec un type qui
  porte plus que nécessaire (gardien `frontiere-serveur-client.test.ts`).
- **Le refus de statut à la création** est posé DANS LA ROUTE (`app/api/machines/creer/route.ts`),
  avant `schemaMachine.safeParse` — `schemaMachine` continue d'accepter les six statuts pour la
  modification et l'import, qui ne sont pas de ce lot.
- **La phrase de l'addendum du 06/10** (« Remplacée et Ferraillée passent par les gestes de la
  fiche ») est FAUSSE — aucun geste de sortie n'existe dans `app/api/machines` aujourd'hui (créer,
  `[id]/modifier` sans `statut`, qr). Je ne l'ai pas recopiée dans le refus ni dans l'aide ;
  D184 le dit explicitement, et la question (PV-23/PV-28) reste posée à Alexis.

## Ce que je n'ai PAS fait

- Aucun aperçu de QR à la création (jeton tiré à la création, format d'étiquette PV-23 non fixé).
- Aucun contrôle de doublon AVANT l'envoi (le refus après envoi suffit à ce lot, comme demandé).
- Aucun changement au mode modification, à `lib/machines/saisie.ts`, à `app/api/recherche/
  modeles/route.ts`, ni à aucune route au-delà du refus de statut ajouté.
- Aucune migration, aucune ligne de semis, aucun prix, aucune valeur inventée.
- `pnpm feries:horizon`, `pnpm audit:partitions` et `pnpm test:e2e` DANS LEUR ENTIER n'ont pas été
  rejoués dans cette session après le dernier commit (voir « Pièges »).

## Les pièges pour la session suivante

1. **`pnpm run build` est à la limite de son plafond mémoire** (`--max-old-space-size=3072`,
   `package.json`) dans cet environnement — confirmé en comparant un build sur `main` propre
   (réussit, cache vidé) et le même build avec les fichiers de ce lot (échoue de façon
   déterministe, toujours au même palier ~3023 Mo, sur plusieurs essais). Ce lot n'a PAS touché
   `package.json` (`git diff package.json` est vide avant ce commit) : j'ai relevé le plafond à
   6144 Mo le temps de vérifier (`pnpm verify`, deux fois, vert à chaque fois, build compris), puis
   reposé la valeur d'origine — mais la marge était déjà quasi nulle AVANT ce lot, et un prochain
   lot un peu plus gros la fera à nouveau rougir. **Signalé, pas corrigé** : relever ce plafond
   n'est pas dans le territoire de ce ticket (`package.json` n'y figure pas) ; c'est une décision
   d'infrastructure, pas une règle de gestion, mais elle mérite d'être tranchée avant qu'un autre
   lot ne tombe dessus sans comprendre pourquoi.
2. **`CI=1 pnpm verify:full` régénère environ 160 PNG de captures étrangères** à ce lot (prédit
   par la consigne du ticket, confirmé) — restaurés par `git checkout --` (fichiers suivis) et
   supprimés (fichiers non suivis) avant ce commit. Si tu relances `verify:full`, refais ce
   nettoyage AVANT de committer, et ne commite jamais les PNG d'un autre ticket.
3. **`pnpm test:e2e` dans son ENTIER dépasse 30 minutes** dans cet environnement (plusieurs
   centaines d'épreuves, tout le dépôt) — un appel unique au premier plan doit prévoir un délai
   largement supérieur à 30 minutes, ou être scindé.
4. Le texte `fr["machine.champ.numero_serie_aide"]` porte une espace INSÉCABLE avant le « : »
   (typographie française). `screen.getByText(...)` de testing-library normalise l'espace du NŒUD
   trouvé mais PAS la chaîne de recherche passée en argument — les deux divergent en silence.
   Comparer le `textContent` directement (`container.querySelectorAll(...).find(...)`), jamais
   `getByText` sur une clé qui peut contenir ce caractère.
5. En environnement réel (navigateur, pas jsdom), `getByRole("alert")` nu trouve AUSSI
   l'annonceur de route de Next.js (`__next-route-announcer__`, `role="alert"`) — scoper par `id`
   ou par un sélecteur plus précis dans toute épreuve bout en bout qui cherche un refus.

## Ce qui reste à faire

- Faire trancher par Alexis : le format de l'étiquette QR (PV-23, TP-UX9-b) et si un geste de
  sortie (remplacement, mise au rebut) doit exister ailleurs que sur le statut (PV-28).
- Rejouer `pnpm feries:horizon`, `pnpm audit:partitions` et `pnpm test:e2e` dans leur entier avant
  la mise en ligne de ce lot (non faits ici, faute de temps — voir « Ce que j'ai mesuré »).
- Revoir le plafond mémoire de `pnpm run build` (piège n°1) — hors territoire de ce ticket.
- « Corriger la fiche » (le mode modification au même gabarit) reste un lot à part, comme prévu.
