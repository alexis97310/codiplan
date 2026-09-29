# 9BZ-TP-UX1-1-ECHELLE — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

**UX1-d — la mesure (`scripts/captures.mts`, `scripts/lib/mesure-captures.ts`).**
`LARGEURS` porte désormais quatre largeurs (1280, 1024 px « poste de travail » ;
390, 375 px « téléphone »), et deux variables d'environnement
(`SORTIE_CAPTURES`, `LARGEURS_CAPTURES`) permettent de diriger une prise vers
`docs/propositions/<ticket>/captures/` sans jamais toucher `docs/captures/`
(comportement par défaut inchangé sans elles). Chaque capture mesure
désormais, dans le navigateur, les textes sous 12 px (D138), les cibles sous
le seuil au bureau/terrain (mobile seulement, spec §10 :963-964), le
débordement horizontal (:965) et les erreurs de console (:966) — une
observation ÉCRITE dans le README de la prise, jamais une porte : le code de
sortie du script est inchangé. Pour l'exploitation : une prise de vue future
dit désormais, sans travail supplémentaire, si un écran a régressé sous le
plancher de 12 px ou cassé une cible tactile — avant, il fallait le
redécouvrir à l'œil.

**Jetons, focus, chiffres tabulaires (`app/globals.css`, `Kpi`, `CarteEntite`,
`Pagination`).** Huit tailles nommées (`--text-12` … `--text-28`, classes
`text-12` … `text-28`) portent l'échelle typographique de la spec §3.2 sans
toucher l'échelle Tailwind par défaut ni ajouter de jeton de couleur. Une
règle `:focus-visible` unique (anneau de 3 px, `--ring` à 50 %) remplace ce
qui aurait dû être recopié sur chaque élément actif du territoire. Les
compteurs et décomptes numériques du territoire (`Kpi`, `CarteEntite`,
`Pagination`) alignent leurs chiffres (`tabular-nums`). Pour l'exploitation :
tout élément actif du produit (lien, bouton, entrée de menu) porte désormais
un anneau visible au clavier, condition d'accessibilité de la spec §3.9 qui
n'était tenue nulle part avant ce ticket.

**Le plancher de 12 px (`components/ui/*.tsx`, `barre.tsx`, `marque.tsx`,
D138).** Les 13 classes sous 12 px du territoire (badge, action de carte,
compteur de carte-entité, libellé de champ, KPI ×2, libellé de fiche,
pagination, aide de sélecteur, en-tête de tableau, sous-titre de marque ×2,
groupe de menu) passent à 12 px. Pour l'exploitation : le texte le plus petit
du back-office (pastilles, en-têtes de tableau, groupes de menu) redevient
lisible sur un petit écran — c'était la question posée par QE-1 et tranchée
par D138.

**L'e2e (`tests/e2e/focus-visible-et-plancher-typographique.spec.ts`).**
Éprouve au navigateur, sur un écran réel, ce que les gardiens statiques
affirment : l'anneau de focus porte réellement (style calculé) sur une
entrée du menu et sur un lien de contenu, et un en-tête de tableau mesure
réellement 12 px.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

**Grep statique** (`text-\[(9|1[01])(\.[0-9])?px\]`), territoire :
13 classes / 11 fichiers → **0 / 0**. Global (`components` + `app`) :
215 / 53 (mesure du 29/09, a85ad3e6) → **202 / 42** après ce ticket — la
différence (13 classes, 11 fichiers) est exactement le territoire de ce
ticket ; rien d'autre n'a bougé.

**Mesure du script, AVANT (commit `8fcc37d`) → APRÈS (commit `5f284f0`)**,
sur les 28 écrans capturés à chacune des trois largeurs
(`docs/propositions/9BZ-TP-UX1-1-ECHELLE/captures/README.md`) :

| Largeur | Textes < 12 px | Cibles sous le seuil | Débordement (somme) | Erreurs |
|---|---|---|---|---|
| 1280 px | 534 → **300** | 0 → 0 | 0 → 0 | 0 → 0 |
| 1024 px | 534 → **300** | 0 → 0 | 74 px → 74 px | 0 → 0 |
| 375 px | 461 → **307** | 102 → 102 | 52 px → 52 px | 0 → 0 |

Les colonnes « cibles », « débordement » et « erreurs » ne bougent pas : ce
ticket ne touche aucune taille de cible ni aucune mise en page, seulement des
tailles de texte. Ce qui reste sous 12 px à 375 px (307 occurrences) vient de
`app/` — hors territoire, confirmé à la fois par le grep statique (174
classes / 36 fichiers dans `app/`, inchangé) et par la mesure du script sur
des écrans réels.

**Les huit attentes modifiées**, chacune ROUGE avant le commit 3 (vérifié en
écrivant les tests avant le code, cf. `tests/unit/ui/composants-maquette.test.ts`
git log) :

| Fichier | Ligne | Avant | Après |
|---|---|---|---|
| `tests/unit/ui/composants-maquette.test.ts` | Carte, « .more » | `text-[11px]` | `text-12 font-semibold` |
| `tests/unit/ui/composants-maquette.test.ts` | Badge, « .b » | `text-[11px]` | `text-12 font-bold whitespace-nowrap` |
| `tests/unit/ui/composants-maquette.test.ts` | Kpi, « .l » | `text-[11px]` | `text-12 font-bold tracking-[0.6px] uppercase` |
| `tests/unit/ui/composants-maquette.test.ts` | Kpi, « .d » | `text-[11px]` | `text-app-encre-faible text-12">` |
| `tests/unit/ui/composants-maquette.test.ts` | Tableau, « th » | `text-[10.5px]` | `text-12 font-bold tracking-[0.6px] uppercase` |
| `tests/unit/ui/composants-maquette.test.ts` | MaitreDetail, « .kv dt » | `text-[11px]` | `text-app-encre-faible text-12 font-extrabold uppercase` |
| `tests/unit/ui/carte-entite.test.ts` | CarteEntite, « .entity-meta span » | `text-[11px]` | `text-app-encre-faible text-12` |
| `tests/e2e/ecrans-largeur-utile.spec.ts` | `/parametres/forfaits`, `thead th` | `toHaveCSS("font-size", "10.5px")` | `toHaveCSS("font-size", "12px")` |

Chacune cite D138 en commentaire. La ligne qui lit la maquette (`regle`,
`regleComplete`, `toHaveCSS` côté maquette n'existe pas ici — seule la partie
composant a changé) reste inchangée dans les six premières : c'est l'écart
que D138 assume, pas une correction de lecture.

## Ce que j'ai tranché et pourquoi

- **Le jeton `text-12` plutôt que le littéral `text-[12px]`** pour les 13
  classes du plancher : `text-[12px]` existe déjà ailleurs dans plusieurs de
  ces fichiers (tableau.tsx, maitre-detail.tsx, carte-entite.tsx) — un
  `toContain("text-[12px]")` aurait été vacuement vert AVANT le changement de
  code (piège nommé par le ticket). `text-12` n'existait nulle part avant ce
  ticket : chaque attente modifiée est réellement rouge avant, verte après.
- **`--ring-focus` comme variable dédiée plutôt que `color-mix()` inline**
  dans la règle `:focus-visible` : le gardien `sans-couleur-en-dur`
  (L0-09) n'autorise `color-mix()` que dans une déclaration de variable
  (`--x: …`), jamais dans une propriété. Rouge sans cette variable, mesuré en
  écrivant la règle.
- **La restriction de largeurs (`LARGEURS_CAPTURES`) plutôt qu'une seconde
  commande** : une seule fonction de mesure, un seul point d'entrée ;
  `docs/captures/` continue de tourner à 1280/390 sans qu'aucune ligne n'y
  change.
- **Les captures AVANT/APRÈS sur une base RESEMÉE deux fois** (une fois pour
  AVANT, une fois pour APRÈS) plutôt que sur la même base : le second facteur
  s'active à la première connexion authentifiée et n'est pas rejouable sans
  le secret — reseeder garantit que les deux prises voient exactement le même
  ensemble d'écrans réussis/refusés, condition d'une comparaison honnête.
- **Le compte `direction@codima.test` pour `COURRIEL`/`COURRIEL_MULTI` et
  `garnier@codima.test` pour `COURRIEL_TERRAIN`**, sans compte portail :
  `docs/captures/README.md` documente déjà qu'aucun compte portail ne peut
  recevoir de mot de passe aujourd'hui (arbitrage, pas un ticket) — les 6
  refus « portail » et « arrivee-sans-societe » (quand le compte multi-société
  porte déjà un second facteur d'une passe précédente de la même prise) sont
  donc identiques AVANT et APRÈS, structurels, hors du périmètre de ce
  ticket.

## Ce que je n'ai PAS fait

- Aucune icône, aucune tuile cliquable, aucun chevron (D139, D140 — TP-UX1-3).
- Aucune page de `app/` modifiée (174 classes / 36 fichiers restent sous
  12 px, TP-UX1-2) ; aucun composant métier hors `components/ui/` et
  `components/navigation/{barre,marque}.tsx`.
- Aucun chiffre tabulaire sur les montants/heures de `app/` (`tabular-nums`
  n'a touché que `Kpi`, `CarteEntite`, `Pagination`).
- `docs/captures/` (commit `ad4feee`) n'a **pas** été repris : `pnpm
  captures:etat` le confirme (dix-sept fichiers de restitution ont changé
  depuis, dont neuf de ce ticket). Cette prise reste la référence de
  `docs/captures/README.md` jusqu'à ce qu'un ticket la rejoue.
- Aucune migration, aucune ligne de semis, aucun prix, aucune règle de
  gestion.

## Les pièges pour la session suivante

- **`tsx`/esbuild instrumente les fonctions nommées passées à
  `page.evaluate`** avec un appel `__name(fn, "…")` que le navigateur ne
  connaît pas (`ReferenceError: __name is not defined`), et Playwright
  sérialise la fonction par son propre texte. Un script de capture ou de
  mesure qui exécute du code dans la page doit passer une **chaîne**, jamais
  une fonction TypeScript nommée — `scripts/captures.mts`, la mesure, le fait
  déjà ; tout code futur qui ajoute un `page.evaluate(fonction)` dans ce
  dépôt (compilé par `tsx`) doit vérifier qu'il ne réintroduit pas le défaut.
- **L'anneau de focus est peu visible sur un bouton déjà bleu**
  (`ActionPrimaire`, `bg-app-bleu-plein`) : le focus et le fond du bouton
  partagent une teinte proche. La mesure programmatique (e2e, `boxShadow`
  contient « 3px ») confirme que la règle s'applique ; à l'œil, sur une
  capture, la différence est ténue. Pas un défaut de ce ticket — une
  observation pour qui refera cette capture plus tard.
- **Le second facteur d'un compte de démonstration n'est pas rejouable**
  sans son secret : la première connexion authentifiée de `scripts/captures.mts`
  l'active et l'imprime UNE fois (`cleActivee`). Une prise de vue interrompue
  après cette activation, relancée sur la MÊME base sans `SECRET_TOTP`, fait
  échouer TOUTES les captures authentifiées suivantes — mesuré deux fois
  pendant ce ticket (une base a dû être resemée). Toujours repartir d'une
  base fraîche, ou conserver le secret imprimé en fin de prise.
- **`git status` après un `DROP DATABASE`/`CREATE DATABASE` mérite d'être
  vérifié directement** (`psql -l`) : une connexion active (le serveur Next
  encore vivant) peut faire échouer silencieusement le `DROP` dans une chaîne
  de commandes `&&`, laissant la commande suivante (`CREATE DATABASE`)
  réussir sur une base DÉJÀ existante sans qu'aucune erreur ne remonte —
  mesuré une fois pendant ce ticket (la base « fraîche » ne l'était pas).

## Ce qui reste à faire

**Territoire TP-UX1-2** (`app/`, composants métier hors `components/ui/` et
navigation) : 174 classes sous 12 px dans 36 fichiers de `app/` ; 28 classes
dans 6 composants métier (`planning/fenetre-pose.tsx` 16,
`planning/pose.tsx` 3, `planning/tiroir.tsx` 3 — nouveau depuis la mesure du
29/09 —, `parc/formulaire-machine.tsx` 2, `interventions/trouver-creneau.tsx`
2, `interventions/site-et-machines.tsx` 2) ; les chiffres tabulaires des
montants et heures de `app/parametres/forfaits`, `app/parametres/taux-horaire`,
`app/(mobile)/terrain`.

**Valeurs à fixer par Alexis** (rien n'a été tranché ici, comme demandé) :

- `text-[12.5px]`, hors échelle §3.2 : 12 ou 13 px ? 8 occurrences dans le
  territoire (`maitre-detail.tsx:163`, `champ.tsx:52`,
  `selecteur-recherche.tsx:200,234,249,264`, `bandeau-motif.tsx:46`,
  `barre.tsx:321`), 210 dans le dépôt entier. Laissées telles quelles.
- Valeur de tuile : la spec §3.2 (:222) dit 28 px / graisse 860, le produit
  affiche 27 px / extrabold (`kpi.tsx`), figé par deux gardiens
  (`composants-maquette.test.ts`, `tableau-non-calcule.spec.ts`). Laissée
  telle quelle.
- 26 px (`maitre-detail.tsx:202`) et 20 px (`barre-de-filtres.tsx:85`), hors
  échelle, figés par gardien. Laissées telles quelles.
- Graisse du « plus petit texte » : la spec (:227) demande 700 à 850 ;
  restent en dessous `carte.tsx` (600, confrontée à la maquette),
  `champ.tsx`, `selecteur-recherche.tsx`, `carte-entite.tsx`, `kpi.tsx`
  (détail), `pagination.tsx` (400). Laissées telles quelles — changer une
  graisse déjà confrontée à la maquette sans arbitrage romprait cette
  confrontation.
- Contraste de l'anneau de focus sur la barre latérale sombre
  (`--app-chrome-fond`) : non mesuré, `--ring` (`#0053a1`) y est utilisé tel
  quel. Observé dans les captures `focus-menu--clair--1280.png` — lisible,
  mais non chiffré (pas de mesure de contraste WCAG faite ici).
  Tout décalage (offset) éventuel de l'anneau : non posé, la spec n'en donne
  aucun.
- 1 440 px, largeur incluse par la spec (§10 :965) pour le débordement, n'a
  pas été ajoutée à `LARGEURS` : seuls les trois formats demandés par ce
  ticket (1280, 1024, 375, plus 390 déjà présent) y figurent.
- Les jetons de la maquette du 28/09 (22 et 26 px, ni 15 ni 24 ni 28) restent
  différents de ceux de la spec §3.2, suivie ici (:217, « les tickets suivent
  la maquette complète »).
