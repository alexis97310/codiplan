# 9CJ-PG-G13-TELEPHONE-CREER-ICI — passation

## Ce que j'ai changé, et ce que ça change pour l'exploitation

**Partie 1 — PG-D4-TELEPHONE-ONGLETS (D146).** Sous 900 px, trois onglets
(« Aujourd'hui », « À traiter », « Semaine ») remplacent le sélecteur de vue
et l'ancien repli en liste de la vue Jour (C-B1) : un planificateur au
téléphone bascule d'un toucher entre la file et le planning, au lieu de
défiler une colonne empilée. La vue Jour gagne une liste lecture seule
(`ListeJour`) sous 900 px, à la place de la frise (illisible à cette
largeur). La fenêtre de pose devient plein écran sous 900 px. À partir de
901 px, rien ne change — la disposition à deux colonnes de D125/D145 reste
entière.

**Partie 2 — PG-D5-CREER-ICI.** Un clic sur le fond d'une case vide, ouverte,
non bloquée, d'un technicien (vue Semaine, 2 semaines, et vue Jour) fait
apparaître un lien « + Créer ici ». Il mène à `/interventions/nouvelle`,
préremplie par le technicien, le jour et (vue Jour) l'heure de la case — en
champs CACHÉS seulement, PARCOURS-1 intacte (aucun champ visible de plus).
Après création, le bandeau « Intervention créée » ouvre la fenêtre de pose
D'EMBLÉE, technicien et jour déjà choisis, sans aucune écriture avant que
« Planifier » ne soit cliqué. Un planificateur peut donc poser une
intervention en un geste continu (clic sur la case → formulaire minimal →
fenêtre pré-remplie → Planifier), sans retaper ni technicien ni date.

## Ce que j'ai mesuré

- **Position de la première carte de la file et hauteur de la page, à
  375 px** (mesure refaite, celle de l'audit du 27/09 datait d'avant PG-C6) :

  | | AVANT (vue Semaine, une colonne) | APRÈS (onglet « À traiter ») |
  |---|---|---|
  | `y` de la première carte | 2012 px | 1365 px |
  | Hauteur totale de la page | 3089 px | 2055 px |

  La carte remonte de 647 px, la page perd 1034 px — mais elle ne tient
  toujours pas dans les 812 px d'un téléphone sans défiler (CA-9 au sens
  strict). Voir « ce que je n'ai pas fait » et la question n°3 plus bas.
- **La fenêtre de pose plein écran** : mesurée à 375 × 812 px exactement
  (`docs/propositions/PG-D4-TELEPHONE-ONGLETS/captures/mesure-fenetre-pose.json`).
- **`pnpm verify` complet** (format:check, typecheck, lint, test unitaire,
  test:isolation, build) : vert, sur `main` avant le dernier commit de ce
  ticket.
- **`pnpm test:e2e` complet, une fois** (733 épreuves, ~30 min) : 4 rougies
  au premier passage — toutes des captures d'anciens lots (9CF, PG-A1,
  PG-B2, PG-C5) dont les attentes à 375 px visaient directement la frise ou
  la colonne « À traiter », désormais derrière l'onglet téléphone. Adaptées
  (commit dédié, `&volet=a_traiter` ajouté à leur URL ou `liste-jour-telephone`
  vérifiée à la place de `vue-jour` sous 900 px), rejouées : vertes. Le
  reste de la suite (729 épreuves) n'a pas été rejoué en entier une seconde
  fois par manque de temps — chaque fichier directement concerné par ce
  lot (planning, pose, création, tiroir, largeur, glisser-déposer, blocage
  d'agenda, trouver-créneau) l'a été individuellement, plusieurs fois,
  toujours vert.

## Ce que j'ai tranché et pourquoi

- **D146** couvre la partie 1 seule (numéro suivant libre confirmé : D141 à
  D145 étaient déjà réservés, D145 était le dernier écrit). La partie 2 ne
  modifie aucune disposition d'écran couverte par D125 : elle ajoute un
  geste (un lien dans une case déjà existante), rien de plus — aucune
  inscription n'était due.
- **`captures-pg-c2-file-onglets.spec.ts`** : adapté comme prescrit,
  `&volet=a_traiter` ajouté à l'URL de départ à 375 px, aucune attente
  retirée ni élargie.
- **Quatre AUTRES specs de captures adaptées**, non prévues par le ticket
  mais de la même famille : `captures-pg-a1-feries-grille.spec.ts`,
  `captures-pg-b2-fenetre-pose.spec.ts`, `captures-pg-c5-tiroir.spec.ts`,
  `captures-pgd1-jour-frise.spec.ts`. Toutes visaient à 375 px un bloc que
  ce ticket masque désormais sous 900 px par construction (la frise, la
  colonne « À traiter » sans onglet) — un huitième déplacement du même
  défaut que celui nommé pour `captures-pg-c2`. Traitées à l'identique :
  jamais l'assertion assouplie, seule l'URL ou le locator ajusté à ce que
  la nouvelle disposition rend réellement visible à cette largeur.
- **« Sans défiler » (CA-9) non tenu au sens strict** : la rangée de filtres
  (PG-C6), la bannière des calendriers et le lien `absences.titre` restent
  visibles au-dessus de la colonne « À traiter » sous 900 px, comme le
  prescrivait le ticket (« ne changent pas, question en passation »). Les
  masquer aurait réduit CA-9 à zéro défilement mais dépassé le territoire
  tranché ici — laissé à la question n°3.
- **`peutCreerIci` exige `creer_demande` ET `modifier_planning`** — les deux
  capacités que la route de création et la route de pose exigent déjà
  séparément ; un rôle qui n'en détient qu'une ne verrait pas un geste que
  l'autre moitié du parcours refuserait en silence (D-06, même famille).
- **La vue 2 semaines hérite de « + Créer ici »** (elle réemploie
  `VueSemaine`) : nommé comme prévu, question n°7 plus bas.
- **La liste Semaine (N-02) garde son ordre technicien-puis-jour** — la
  question 4 de la spécification (réordonner en jour-puis-technicien)
  n'était pas dans le territoire de ce ticket : aucune retouche.

## Ce que je n'ai PAS fait

- **CA-9 au sens strict** (« sans défiler ») — voir ci-dessus : non tenu,
  la mesure le dit noir sur blanc.
- **Aucune absence (pastille violette) ni carte « heure non fixée »** dans
  les captures de `ListeJour` : la scène de capture ne pose qu'une
  intervention `a_planifier` et une `planifiee`. Le rendu de ces deux cas
  est couvert par la lecture du code (`ListeJour`, `page.tsx`), jamais par
  une capture d'écran ni par une épreuve e2e dédiée.
- **`pnpm test:e2e` rejoué en entier une seconde fois** après les quatre
  correctifs de captures — chaque fichier touché l'a été individuellement,
  jamais la suite complète une deuxième fois (faute de temps : ~30 min par
  passage).
- **Aucune retouche à `tests/unit/ui/plancher-12-pages.test.ts`** : aucun
  fichier `.tsx` neuf n'a été créé par ce lot (seuls des fichiers existants
  modifiés), la liste n'avait donc rien à recevoir.
- **PG-G11b n'est pas publié** (vérifié au départ : aucune branche
  `PG-G11b` ni commit dans `git log`) : la partie 2 n'ajoute donc aucune
  heure de départ à `FenetrePose` — l'heure de la case voyage dans l'URL
  (`poser_heure`), est lue par `caseDepuisParametres`, et sert à
  `hrefCreerIci` dans la vue Jour ; elle n'atteint PAS encore `FenetrePose`
  elle-même (qui n'a pas de prop pour la recevoir). Une fois PG-G11b publié
  et cette prop ajoutée, `TrouverCreneau`/`FenetrePose` pourront la
  recevoir — code prêt côté case, pas encore côté fenêtre.

## Les pièges pour la session suivante

- **Toute nouvelle épreuve e2e qui vise directement la frise
  (`data-maquette-bloc="vue-jour"`) ou la colonne « À traiter »
  (`data-tiroir-declencheur` d'une carte de la file) à une largeur ≤ 900 px
  doit ajouter `&volet=a_traiter` (pour la file) ou lire
  `liste-jour-telephone` plutôt que `vue-jour` (pour le jour) — sinon elle
  rougira exactement comme les quatre corrigées ici.
- **`CasePosable` porte maintenant DEUX props facultatives issues de deux
  lots différents** (celle de 9CF/PG-G11b pour la frise, `hrefCreerIci` pour
  ce lot) : elles coexistent sans se disputer (vérifié), mais toute
  session future qui y retouche doit relire les DEUX docblocks avant
  d'ajouter une troisième.
- **`hrefCreerIci` est à la fois le nom d'une fonction importée
  (`lib/interventions/creer-ici.ts`) et le nom d'une prop JSX sur
  `CasePosable`** — volontaire (même mot, pas de collision réelle en JS/JSX,
  les deux espaces de noms sont distincts), mais lisible seulement une fois
  qu'on le sait ; ne pas le renommer par réflexe de nettoyage sans relire
  pourquoi.
- **La liste Semaine (`ListeSemaine`, N-02) et la vue Mois n'ont PAS de
  case posable** : « + Créer ici » n'y existe donc jamais, par construction
  (pas de `CasePosable` à cet endroit) — ce n'est pas un oubli.
- **Le worktree de capture** (`git worktree add /tmp/xxx <commit>`) doit
  être retiré (`git worktree remove --force`) avant de rendre la main : fait
  ici pour les deux (`pgd4-avant`, `pgd5-avant`), `git worktree list` ne
  montre plus que `/home/aplou/codiplan`.

## Ce qui reste à faire

1. **Les dix questions ci-dessous, à confirmer par Alexis** (comportement
   minimal et réversible livré en attendant) :
   1. Onglet par défaut au téléphone : `/planning` sans `vue` ouvre
      « Semaine » (défaut du bureau) ; spécification et maquette du 28/09
      mettent « Aujourd'hui » en premier. Garder « Semaine », ou basculer ?
   2. Le sélecteur de vue (Jour/Semaine/2 semaines/Mois) est masqué sous
      900 px ; 2 semaines et Mois n'y sont atteignables que par l'URL.
      Garder, ou les offrir au téléphone ?
   3. La rangée de filtres (PG-C6) et la bannière des calendriers restent
      visibles au téléphone (la maquette du 28/09 les masque) — c'est ce
      qui empêche CA-9 (« sans défiler ») d'être tenu au sens strict.
      Garder ou masquer ?
   4. « Semaine » au téléphone reste la liste actuelle (technicien puis
      jour) ; la spécification (§4) dit « jour puis technicien ». Réordonner ?
   5. « À traiter » garde sa rangée d'onglets internes (la spécification
      dit « liste déroulante ») ; le compte de l'onglet du téléphone est
      celui de « À planifier » seul, sans marque P1 (la maquette du 28/09
      en a une). Garder tel quel ?
   6. De 901 à 1023 px (tablette), rien ne change : une colonne, la file
      sous le planning, sans les trois onglets. Les y ajouter aussi ?
   7. « + Créer ici » n'est proposé que sur une case vide, ouverte, sans
      absence, d'un technicien ; il existe aussi en vue 2 semaines (même
      composant que Semaine). Élargir ou restreindre ?
   8. Après « Planifier » depuis « Créer ici », on reste sur la fiche
      (comportement de PG-B6) — revenir directement au planning ?
   9. Le formulaire de création ne dit pas la case d'où l'on vient (trois
      champs cachés seulement, PARCOURS-1 intacte) — afficher une ligne
      « depuis la case … » ?
   10. Les libellés neufs (« Aujourd'hui »/« À traiter »/« Semaine » du
       téléphone, « Aucune intervention » de `ListeJour`, « + Créer ici »).
2. **Brancher l'heure de la case dans `FenetrePose`** une fois PG-G11b
   publié (voir « ce que je n'ai pas fait »).
3. **Rejouer `pnpm test:e2e` en entier une fois de plus** avant la mise en
   ligne, pour confirmer qu'aucune cinquième capture n'a été manquée.
