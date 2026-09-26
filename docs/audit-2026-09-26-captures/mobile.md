# Audit d'ergonomie — usage sur écran étroit (390 px)

## Méthode

54 images ouvertes une à une avec l'outil de lecture d'image : les 27 captures
`--clair--390.png` (téléphone, 390×844) en première passe, puis les 27
`--clair--1280.png` (poste de travail) en seconde passe pour établir ce qui
disparaît sans remplacement entre les deux largeurs. `docs/maquette/CODIPLAN_Maquette.html`
a été lue pour ses règles de disposition (`@media`, classes `.plan`, `.mach`,
`.phone`/`.pscreen`) et sert de référence sur ce qui est *prévu* pour un écran
étroit. Des fichiers de code ont été lus pour étayer, et non deviner, deux
choses : la taille de certaines cibles tactiles (`components/ui/button.tsx`,
un `grep` sur `type="checkbox"`) et, après une relecture croisée demandée en
cours d'audit, l'écart entre ce que les captures montrent et l'état réel du
code à `HEAD` (`git log`, `git show`, et la lecture des composants de mise en
page et de tableau — détail dans « Ce que le code dit de l'écart entre les
captures et HEAD »). Une relecture croisée a ensuite montré qu'une partie de
cette lecture de code était trop confiante : les 54 fichiers PNG ont donc
été mesurés à leur en-tête IHDR (largeur/hauteur réelles, `System.Drawing`,
aucune exécution), et certaines zones d'image ont été scannées pixel par
pixel pour distinguer un contenu réellement présent d'un vide — toujours
sans ouvrir de navigateur ni lancer l'application. Aucune commande `pnpm`,
aucun build, aucun serveur, aucun test n'a été lancé ; aucun fichier du
dépôt n'a été modifié.

Les quatre écrans absents de `docs/captures/` (`portail`, `intervention-detail`,
`terrain-intervention` en 1280 et 390) n'ont pas pu être audités : voir la
dernière section.

## Avertissement — les captures sont antérieures à HEAD, et plusieurs constats sont déjà périmés

Le README des captures dit avoir photographié le commit `bbf7e3c`. `HEAD` du
dépôt lu pour cet audit est `934da3e`. **Ce hash `bbf7e3c` n'existe dans
aucune forme dans ce clone** (`git cat-file -t` et `git log --all` le
disent introuvable) : l'ordre exact ne peut donc pas être établi par
ascendance Git, seulement par lecture directe du code à `HEAD` comparée à ce
que les captures montrent. Cette lecture, détaillée dans la section
« Ce que le code dit de l'écart entre les captures et HEAD » ci-dessous,
établit que **trois écrans / familles de constats sont périmés** — la barre
latérale (constat transversal 1, et le constat « arrivée »), et les listes
`clients`, `sites` et `parc` (une partie du constat transversal 2) — et que
trois ne le sont **pas** : `planning-jour`, les cibles tactiles sous 44 px
(constat transversal 3), et — confirmé après coup par un scan pixel plutôt
que par le code — `parametres-trajets` et `parametres-agences`, dont le
constat 2 remonte même à « bloquant » au lieu de descendre. Les constats
concernés sont marqués « **PÉRIMÉ** » en tête, sans être supprimés : ce
qu'ils décrivaient a réellement été observé sur les captures, seul son état
à `HEAD` a changé. **Mesure complémentaire, sur les 54 images** : 19 des 27
captures à 390 px débordent réellement ce viewport (mesuré à l'en-tête IHDR
des PNG, aucune exécution), aucune des 27 à 1280 px — un défaut strictement
d'écran étroit ; détail dans « Ce que le code dit… », point 4bis.

## Tableau de synthèse

| Écran | Gravité dominante | En une ligne |
|---|---|---|
| enrolement | mineur | Formulaire centré, une colonne : rien à reprocher à 390 px |
| arrivee-sans-societe | **PÉRIMÉ** | Barre latérale non repliée sur la capture — corrigée à HEAD (voir plus bas) |
| terrain | — | Le seul écran authentifié pensé pour l'écran étroit (pas de barre latérale) |
| connexion-code | mineur | Formulaire centré, une colonne : correct |
| accueil | mineur | Page publique, une colonne : correct |
| connexion | mineur | Formulaire centré, une colonne : correct |
| premier-acces | mineur | Formulaire centré, une colonne : correct |
| sante | mineur | Cartes empilées lisibles : correct |
| arrivee | **PÉRIMÉ** | Même défaut de barre latérale qu'`arrivee-sans-societe` — corrigé à HEAD |
| planning | gênant | Grille hebdomadaire repliée en liste très longue (4328 px), mais lisible |
| planning-jour | bloquant | Grille jour illégale : en-têtes techniciens fusionnés, colonnes de quelques pixels |
| imports-rapport | gênant | Barre latérale + texte explicatif éclaté mot par mot sur 2600 px de haut |
| imports | gênant | Idem, formulaire d'import lisible mais noyé dans du texte vertical |
| intervention-creation | gênant | Formulaire une colonne correct, seule la barre latérale pénalise |
| parc | **PÉRIMÉ** | Tableau tronqué sur la capture — HEAD rend cet écran en liste maître-détail, plus de `<table>` du tout |
| clients | **PÉRIMÉ** | Idem sur la capture — HEAD rend cet écran en grille de cartes, plus de `<table>` du tout |
| client-creation | gênant | Formulaire une colonne correct, barre latérale seule en cause (périmée elle aussi) |
| client-detail | gênant *(révisé, scan pixel)* | Tableaux réduits à une colonne sur la capture ; scan pixel confirme du contenu réel jusqu'au bord de l'image — défilement réel, mais rien ne le signale |
| absences | gênant | En-têtes de tableau tronqués (« PERSONNE » seul lisible) |
| sites | **PÉRIMÉ** | Colonnes perdues sur la capture — HEAD rend cet écran en grille de cartes, plus de `<table>` du tout |
| parametres-trajets | **bloquant** *(confirmé par scan pixel)* | Colonne « Régler » hors champ ; scan pixel de la page entière (1009 px) : zéro contenu au-delà de x≈400 malgré `minimum="1000px"` dans le code — pas seulement mal signalée, absente de la capture |
| parametres | gênant | Cartes lisibles mais très hautes (texte éclaté mot par mot) |
| vgp | gênant *(révisé, scan pixel)* | Colonnes hors champ sur la capture ; scan pixel confirme du contenu réel jusqu'au bord de l'image (414 px) — défilement réel, mais rien ne le signale |
| vgp-a-determiner | gênant | Une seule ligne de démonstration, mais même repli à une colonne |
| parametres-agences | **bloquant** *(confirmé par scan pixel)* | Horaires hors champ ; scan pixel de la page entière (1093 px) : contenu non-fond seulement de x=380 à x=406, rien au-delà — vide, pas hors-cadre |
| parametres-forfaits | gênant | Formulaire utilisable, cases à cocher très petites |
| parametres-prestations | gênant | Formulaire utilisable, case à cocher très petite |

## Constat transversal 1 — la barre latérale de bureau ne se replie pas

**PÉRIMÉ — confirmé corrigé à `HEAD` par lecture du code, voir la section « Ce que le code dit de l'écart entre les captures et HEAD ».** Le constat qui suit décrit fidèlement ce que les 20 captures montrent ; il ne décrit plus l'application telle qu'elle se comporte aujourd'hui.

**Gravité** : bloquant *(sur les captures ; périmé à `HEAD`)*
**Capture** : `arrivee--clair--390.png`, `arrivee-sans-societe--clair--390.png`, `planning--clair--390.png`, `planning-jour--clair--390.png`, `imports--clair--390.png`, `imports-rapport--clair--390.png`, `parc--clair--390.png`, `clients--clair--390.png`, `client-creation--clair--390.png`, `client-detail--clair--390.png`, `absences--clair--390.png`, `sites--clair--390.png`, `parametres-trajets--clair--390.png`, `parametres--clair--390.png`, `vgp--clair--390.png`, `vgp-a-determiner--clair--390.png`, `parametres-agences--clair--390.png`, `parametres-forfaits--clair--390.png`, `parametres-prestations--clair--390.png`, `intervention-creation--clair--390.png` — exactement 20 des 27 écrans capturés : ceux dont la route vit sous `app/(back-office)/` (vérifié en listant ce répertoire — 11 sous-dossiers de premier niveau, dont les sous-routes couvrent ces 20 noms d'écran). `terrain` n'est pas un cas particulier de ce même groupe : il vit sous un groupe de routes distinct, `app/(mobile)/`, avec son propre `layout.tsx` qui ne rend jamais `BarreDeNavigation` en colonne. Les 6 écrans restants (`enrolement`, `connexion-code`, `accueil`, `connexion`, `premier-acces`, `sante`) sont hors session, sous un autre groupe encore.
**Ce qui se passe** *(corrigé après relecture croisée — mesure au pixel, pas à l'œil)* : le menu bleu marine occupe **exactement 272 px, une valeur fixe et constante sur les 20 captures**, confirmée à la fois par le code (`w-[272px]` dans `components/navigation/barre.tsx`) et par une mesure directe de la transition de couleur sur les pixels des images (`arrivee-sans-societe--clair--390.png`, `clients--clair--390.png`, `parametres-agences--clair--390.png`, `parc--clair--390.png`, `planning--clair--390.png`, `absences--clair--390.png` : transition à x=272 dans chacune, quelle que soit la largeur totale du fichier). Rapportée au viewport de 390 px qu'un téléphone affiche réellement, cela laisse **118 px de contenu visible avant tout défilement — un nombre fixe, pas une fourchette** (390 − 272 = 118, la même arithmétique qu'un commentaire du code lui-même, `components/navigation/barre.tsx`). **Fait supplémentaire découvert en mesurant les fichiers** : les captures elles-mêmes ne sont PAS des images de 390 px de large — leurs dimensions réelles vont de 462 px (`planning`) à 1093 px (`parametres-agences`), la seule exception étant `terrain--clair--390.png`, pile 390 px. La prise de vue capture donc la page entière, y compris ce qui dépasse le viewport ; sur un vrai téléphone, ce surplus (jusqu'à 703 px sur `parametres-agences`) ne serait visible qu'après un défilement horizontal qui ferait aussi sortir le menu de l'écran. Dans ce contenu résiduel, chaque titre se scinde en une échelle verticale de mots isolés (« Vous / êtes / connecté », « Planning / des / interventions »). Les pages atteignent des hauteurs de 2000 à plus de 4300 px là où l'équivalent à 1280 px tient en 550 à 950 px.
**Pourquoi c'est un problème** : sur un téléphone, cette colonne fixe capte l'espace qui devrait revenir au contenu utile — la seule chose que la personne est venue chercher. Le premier contenu métier n'apparaît souvent qu'après plusieurs longueurs d'écran de défilement vertical, et une fois atteint il tient dans une largeur de texte proche de celle d'un post-it. La maquette de référence (`docs/maquette/CODIPLAN_Maquette.html`) ne prévoit d'ailleurs aucune règle `@media` sur `.topbar`/`.nav` pour un menu de bureau : la disposition mobile qu'elle propose est un écran de téléphone entièrement différent (`#mobile`, avec sa propre barre `.phead` sans liste de rubriques), jamais une barre latérale rétrécie. L'écran `terrain--clair--390.png` le confirme en creux : c'est le seul écran authentifié à afficher une barre du haut minimale (logo, société, déconnexion, avatar) sans liste de rubriques — la preuve qu'un motif mobile existe déjà dans l'application, mais qu'il n'a pas été étendu au reste du back-office.
**Recommandation** : replier la barre latérale derrière un bouton menu en dessous d'un seuil de largeur (par exemple les breakpoints déjà présents dans la maquette, 640/1000 px), sur le modèle du motif déjà en place pour `terrain`. — **Recommandation caduque : n'ouvrir aucun ticket là-dessus**, c'est déjà fait. Voir la section dédiée pour la preuve.

## Constat transversal 2 — les tableaux perdent leurs colonnes sans repli en cartes

**RÉVISÉ DEUX FOIS, la seconde fois par une mesure pixel et non par le code (voir la section dédiée pour le détail complet).** `parc`, `clients` et `sites` sont **PÉRIMÉS** : ces trois écrans ne sont plus des tableaux à `HEAD`, ils sont déjà rendus en cartes ou en liste maître-détail. Pour les quatre écrans restants, une première lecture du code seul (`overflow-x-auto`) m'avait fait conclure, à tort, qu'aucun ne perdait rien. **Un scan pixel par pixel de la zone au-delà de 390 px sépare en fait deux groupes** : `parametres-trajets` et `parametres-agences` sont **CONFIRMÉS BLOQUANTS**, en pire que ma lecture initiale — la zone qui devrait porter les colonnes manquantes est un vide pixel-parfait, pas un contenu simplement hors-cadre ; `vgp` et `client-detail` restent **gênants** — du contenu réel existe bien dans la zone capturée, jusqu'au bord de l'image.

**Gravité** : bloquant pour `parametres-trajets` et `parametres-agences` (confirmé par scan pixel — voir section dédiée) ; gênant pour `vgp` et `client-detail` (contenu réel détecté par le même scan) *(`parc`, `clients`, `sites` sont périmés, voir plus haut)*
**Capture** : `vgp--clair--390.png` (vs `1280`), `client-detail--clair--390.png` (vs `1280`), `parametres-agences--clair--390.png` (vs `1280`), `parametres-trajets--clair--390.png` (vs `1280`)
**Ce qui se passe** : à 1280 px, ces quatre tableaux affichent chacun de 4 à 6 colonnes de données (exemple `parametres-trajets` : Zone, Valeur de référence, Réglage de la société, Ce qui s'applique, **Régler** avec un champ et un bouton). À 390 px, la même table n'affiche plus qu'une seule colonne — la première, souvent tronquée en fin de mot (« RÉFÉRENC[E] », « Local-00[0002]») — sans qu'aucune capture ne montre d'indice visuel (flèche, ombre de bord, curseur) qu'un défilement horizontal existe. Le cas le plus net est `parametres-trajets` : à 390 px, seule la colonne « Zone » (Grand Nord, Sud, Côte Est…) reste visible dans le cadrage de l'image.
**Pourquoi c'est un problème** *(révisé une seconde fois — voir « Ce que le code dit », point 4)* : pour `vgp` et `client-detail`, un scan pixel de la zone au-delà de 390 px trouve du contenu réel jusqu'au bord de l'image — le problème est un défaut de **repérage** (rien ne signale qu'il y a plus à voir), pas une perte. Pour `parametres-trajets` et `parametres-agences`, le même scan ne trouve **aucun pixel** au-delà d'environ x=400, alors que le code réserve l'espace (`minimum="1000px"`/`"1040px"`) et décrit cinq colonnes : la colonne « Régler » n'est donc pas seulement mal signalée, elle n'apparaît nulle part dans la capture. Sur `parametres-trajets` en particulier, cela rend le seul geste de l'écran — modifier un temps de trajet par défaut — introuvable tel que capturé, ce que je pensais à tort avoir été trop affirmatif à écrire au premier passage.
**Recommandation** *(révisée)* : pour `vgp` et `client-detail`, ajouter un indice visuel de défilement (ombre sur le bord droit) suffit — correctif ciblé, une journée ou moins. Pour `parametres-trajets` et `parametres-agences`, avant tout indice visuel, il faut d'abord comprendre pourquoi le contenu ne peint pas dans l'espace réservé — un correctif visuel serait prématuré tant que la cause (probablement dans l'ascendance flexbox/grid de `Tableau`, à vérifier en exécutant l'application, ce que cet audit n'a pas fait) n'est pas identifiée.

## Constat transversal 3 — cibles tactiles sous la référence de 44 px

**Vérifié non périmé** : `components/ui/button.tsx` n'a plus été touché depuis des commits fondateurs, bien avant la fenêtre `bbf7e3c`–`HEAD` (`git log` sur ce fichier), et les deux fichiers cités pour les cases à cocher n'ont été retouchés que par les commits N-08/N-09 (jetons de couleur et cartes, sans rapport avec la taille des cases). Ce constat reste entier.

**Gravité** : gênant
**Capture** : `connexion--clair--390.png`, `parametres-forfaits--clair--390.png`, `parametres-prestations--clair--390.png`, `clients--clair--390.png`
**Ce qui se passe** : les boutons pleine largeur des écrans de connexion et de formulaire (« Se connecter », « Rechercher », « Enregistrer », « Ajouter ») utilisent la taille par défaut du composant de bouton, `h-9` (36 px de hauteur), lu dans `components/ui/button.tsx:24` — donc une mesure de code, pas une estimation sur l'image. Les cases à cocher visibles sur `clients` (« Masquer les fiches inactives »), `parametres-forfaits` (« Cumulable avec le temps passé », « Actif ») et `parametres-prestations` (« Active ») sont des `<input type="checkbox">` natifs sans classe de taille (confirmé par un `grep` sur le code : `app/(back-office)/parametres/prestations/page.tsx:281`, `components/forfaits/formulaire.tsx:132`), donc rendues à la taille par défaut du navigateur — de l'ordre de 13 à 16 px selon la plateforme, **supposition à vérifier** sur la plateforme mobile réellement ciblée.
**Pourquoi c'est un problème** : un bouton de 36 px de haut est sous la référence usuelle d'environ 44 px pour une cible pressée du doigt, et l'écart se paie en ratés de frappe, plus sensibles pour un technicien debout ou ganté. Une case à cocher deux à trois fois plus petite que le bout d'un doigt oblige à viser, ou pousse la personne à taper au hasard autour d'elle en espérant toucher la bonne zone — avec le risque, sur un formulaire de réglage (forfait, prestation), de cocher ou décocher la mauvaise ligne sans s'en rendre compte.
**Recommandation** : relever la hauteur par défaut des boutons pour les usages tactiles (une variante de taille existe déjà dans le composant, `lg` à 40 px — encore insuffisant, une nouvelle variante ≥44 px est à ajouter) et remplacer les cases à cocher nues par un composant stylé avec une zone de frappe élargie (le carré visuel peut rester petit si la zone cliquable, via un `label` englobant ou un `padding`, atteint 44 px). Correctif localisé au composant de bouton et à un composant case à cocher à créer — réalisable en moins d'une journée pour la mesure elle-même, sans compter la revue visuelle de tous les écrans qui en dépendent.

## Constat par écran — planning-jour

**CONFIRMÉ NON PÉRIMÉ par lecture du code à `HEAD`** (voir la section dédiée) : `VueJour` (`app/(back-office)/planning/page.tsx`, à partir de la ligne 891) rend toujours un `<table>` sous un simple `overflow-x-auto`, sans le repli en liste (`lg:hidden` + composant liste) que sa voisine `ListeSemaine` reçoit pour la vue semaine juste au-dessus dans le même fichier. Ce constat reste entier.

**Gravité** : bloquant
**Capture** : `planning-jour--clair--390.png`
**Ce qui se passe** : à 1280 px, la grille jour affiche une colonne « Heure » et quatre colonnes techniciens larges (D. Guérin, T. Wamytan, M. Poigoune, J. Lefèvre), chacune avec son nom et son agence en en-tête. À 390 px, les quatre colonnes techniciens sont compressées côte à côte dans le même espace, sans passer en liste ni en onglets : les initiales se chevauchent (« D. T. M. J. ») et les noms complets fusionnent en une seule chaîne illisible (« GuerinWamytanPoigoune »), de même que leurs agences (« Agence Agence Agence Agence » puis « DucoDolbKoauDc »). Les cases horaires qui en résultent font quelques pixels de large.
**Pourquoi c'est un problème** : cet écran sert justement à repérer les trous dans le planning du jour (c'est sa description au README) ; à 390 px, il devient impossible de savoir quelle case appartient à quel technicien, donc impossible d'accomplir la tâche que l'écran est censé permettre.
**Recommandation** : sous un seuil de largeur, remplacer la grille à colonnes multiples par une vue à un technicien à la fois (onglets ou sélecteur), reprenant le motif déjà appliqué à `planning` en vue semaine (qui empile ses cartes correctement) plutôt qu'en vue jour. Plus d'une journée : cela suppose une bascule de layout conditionnelle propre à cet écran.

## Constat par écran — arrivée (barre latérale, cas aggravé)

**PÉRIMÉ — même correctif que le constat transversal 1**, confirmé par lecture du code (voir la section dédiée) : ce constat n'était qu'un cas aggravé du même défaut, déjà réparé à `HEAD`.

**Gravité** : bloquant *(sur les captures ; périmé à `HEAD`)*
**Capture** : `arrivee--clair--390.png`, `arrivee-sans-societe--clair--390.png`
**Ce qui se passe** : ces deux écrans subissent le même défaut transversal de barre latérale (272 px fixes, 118 px de viewport restants — voir constat 1, mesure au pixel confirmée). Le titre « Vous êtes connecté » s'affiche sur trois lignes, un mot par ligne, et le bloc « Société active / CODIMA Nouvelle-Calédonie / Rôle / admin_societe » suit le même sort.
**Pourquoi c'est un problème** : c'est l'écran qui accueille toute personne venant de se connecter — le premier jugement porté sur l'application se forme ici, sur un écran où le nom de la société qu'on s'apprête à ouvrir tient à peine dans sa colonne.
**Recommandation** : caduque, aucune action à mener — voir plus haut.

## Ce que le code dit de l'écart entre les captures et HEAD

Lecture seule (`git log`, `git show`, `grep`, lecture de fichiers) — aucun build, aucun test, aucun serveur, aucune commande `pnpm`.

**Le hash cité par le README (`bbf7e3c`) n'existe dans aucune forme dans ce clone.** `git cat-file -t bbf7e3c43416311d6b572879e67dbac56c5521e3` et `git log --all` le disent introuvable — l'ascendance exacte ne peut donc pas être vérifiée par `git merge-base`. Ce qui suit s'appuie sur la date des commits (le commit `96dc74a` est daté du 21/09/2026, le commit `fa978fd` du 18/09/2026 10:51 +1100, soit environ 1 h 30 avant l'horodatage de prise de vue donné par le README, 2026-09-18 01:22 UTC — l'ordre entre ce dernier et les captures reste donc incertain) et, surtout, sur une comparaison directe : **le code à `HEAD` ne correspond plus à ce que plusieurs captures montrent**, quel que soit l'ordre exact.

**1. La barre latérale se replie aujourd'hui sous 901 px — confirmé, chemin et ligne à l'appui.**
`app/(back-office)/layout.tsx` enrobe la mise en page dans `FournisseurNavigationMobile` et pose un `BandeauMobile` à côté de `BarreDeNavigation`. Dans `components/navigation/barre.tsx`, la colonne (`<aside>`) porte :
```
className={`... min-[901px]:sticky min-[901px]:top-0 min-[901px]:left-auto min-[901px]:flex ${
  ouvert ? "fixed top-0 left-0 z-40 flex" : "hidden"
}`}
```
Sous 901 px et tant que le tiroir n'est pas ouvert (`ouvert === false`, l'état par défaut), la classe appliquée est `hidden` : la colonne est retirée du flux, pas seulement rétrécie. Un clic sur `BandeauMobile` la fait réapparaître en recouvrement (`fixed`, `z-40`) par-dessus un voile. Le commentaire du fichier cite le seuil comme repris de `components/ui/maitre-detail.tsx`, « tenu jusqu'à 390 px par `tests/e2e/parc.spec.ts` » — une affirmation lue dans un commentaire de code, pas un test que j'ai exécuté. **Verdict : constat transversal 1 et constat « arrivée » PÉRIMÉS.**

**2. `clients` et `sites` ne sont plus des tableaux — confirmé.**
`app/(back-office)/clients/page.tsx` et `app/(back-office)/sites/page.tsx` importent `CarteEntite, GrilleCartesEntites` depuis `components/ui/carte-entite.tsx`, jamais `Tableau`. `GrilleCartesEntites` (`components/ui/carte-entite.tsx`, fin de fichier) :
```
<div className="grid grid-cols-3 gap-[14px] max-[1180px]:grid-cols-2 max-[900px]:grid-cols-1">
```
— une seule colonne de cartes sous 900 px, aucun `<table>` nulle part dans ces deux écrans. Le commentaire du fichier cite la décision D123 : « les référentiels se montrent en cartes, pas en tableaux », par opposition à « transactionnel (interventions, VGP, paramètres…) reste un `<table>` » (commentaire dans `clients/page.tsx:71`). **Verdict : les lignes « clients » et « sites » du constat transversal 2 sont PÉRIMÉES.**

**3. `parc` (liste) n'est plus un tableau non plus — confirmé.**
`app/(back-office)/parc/page.tsx` (vers la ligne 290) rend une `CarteListe` de `RangeeMaitreDetail` — le motif maître-détail (`components/ui/maitre-detail.tsx`), pas un tableau. **Verdict : la ligne « parc » du constat transversal 2 est PÉRIMÉE.**

**4. RÉVISÉ UNE SECONDE FOIS — le code seul trompait : deux de ces quatre écrans sont bien plus graves, deux le sont moins.**
Première lecture (code seul, `components/ui/tableau.tsx:57`, `overflow-x-auto`) : j'en avais conclu que les quatre écrans (`vgp`, `client-detail`, `parametres-trajets`, `parametres-agences`) défilent sans rien perdre. **C'était trop confiant.** Une mesure des dimensions PNG (en-tête IHDR, méthode reprise de lisibilite et vérifiée en la rejouant moi-même sur les 27 captures 390 px, aucune exécution) montre que ces fichiers ne font pas 390 px : `parametres-trajets`=1009 px, `parametres-agences`=1093 px, `vgp`=414 px, `client-detail`=511 px — la prise de vue capture la page entière, preuve qu'il y a bien un surplus de largeur. **Mais un scan pixel par pixel de ce surplus (`System.Drawing.Bitmap.GetPixel`, comparaison à la couleur de fond, aucune exécution de l'application) sépare deux groupes :**
- `parametres-trajets` et `parametres-agences` : au-delà de x≈380-406 px, **zéro pixel ne diffère du fond** jusqu'au bord droit de l'image (1009 et 1093 px) — vérifié à la fois par balayage systématique et par un recadrage visuel de la zone. Le code déclare pourtant `minimum="1000px"` / `"1040px"` (`app/(back-office)/parametres/trajets/page.tsx:125`, `.../agences/page.tsx:137`) et cinq colonnes avec largeurs explicites (`components/ui/tableau.tsx:71-75`) — **la réservation d'espace existe, le contenu qui devrait la remplir n'apparaît nulle part dans la capture.** Ce n'est donc pas un défilement discret, c'est un vide. Le code seul aurait fait conclure au défilement ; l'image dit le contraire. **Verdict : ces deux constats reviennent à « bloquant », et légèrement en pire que ma lecture initiale** — je ne peux pas dire si la colonne « Régler » est perdue par un défaut de rendu ou par autre chose, seulement qu'elle n'est visible nulle part sur la capture entière.
- `vgp` et `client-detail` : le surplus contient de vrais pixels de contenu jusqu'au bord (`vgp` : pixels non-fond de x=380 à x=413, soit jusqu'au bord ; `client-detail` : de x=380 à x=510, soit jusqu'au bord). **Verdict : ces deux constats restent « gênant » — le contenu existe bien dans la largeur capturée, probablement atteignable par défilement, même si rien ne le signale visuellement.**
**Ce que ni le code ni l'image ne tranchent** : pourquoi les deux premiers sont vides. Une hypothèse plausible et non vérifiée (une ancêtre flexbox sans `min-width:0` qui laisserait la page grandir jusqu'au `minimum` de la table SANS que le contenu suive) n'a pas été confirmée en exécutant quoi que ce soit — elle reste une hypothèse, pas un fait établi.

**4bis. Mesure complète sur les 54 images — la largeur de chaque fichier PNG, lue à l'en-tête IHDR (`System.Drawing.Bitmap.Width`, aucune exécution du dépôt).** Méthode reprise de lisibilite. **19 des 27 captures à 390 px débordent réellement ce viewport ; aucune des 27 captures à 1280 px ne déborde** — c'est donc strictement un défaut d'écran étroit, jamais un défaut de poste de travail.

| Largeur réelle | Écrans |
|---|---|
| 390 px (aucun débordement) | `accueil`, `connexion`, `connexion-code`, `enrolement`, `imports-rapport`, `premier-acces`, `sante`, `terrain` |
| 400-431 px (débordement léger, quelques px) | `vgp-a-determiner` (400), `intervention-creation` (411), `vgp` (414), `parametres` (431) |
| 457-598 px | `planning-jour` (457), `planning` (462), `absences` (517), `sites`/`clients`/`client-detail`/`client-creation`/`parametres-forfaits` (511), `parametres-prestations` (565), `arrivee`/`arrivee-sans-societe` (573), `parc` (548), `imports` (598) |
| 1000 px et plus | `parametres-trajets` (1009), `parametres-agences` (1093) |

**5. `planning-jour` n'a reçu aucun traitement équivalent — confirmé, constat maintenu.**
Dans `app/(back-office)/planning/page.tsx`, la vue semaine bascule sa grille en liste sous `lg` (`ListeSemaine`, commentée « N-02, 17/09/2026 »), avec des classes `lg:hidden` explicites (lignes 792, 815, 819). La vue jour (`VueJour`, à partir de la ligne 891) ne porte aucune classe `lg:hidden` ni composant liste équivalent : son `<table>` (vers la ligne 925) n'est qu'entouré d'`overflow-x-auto`, sans alternative empilée. **Verdict : constat `planning-jour` maintenu tel quel.**

**6. Cibles tactiles (constat transversal 3) : rien ne bouge.**
`components/ui/button.tsx` et les fichiers de cases à cocher cités n'ont pas été retouchés dans une fenêtre pertinente pour ce sujet (voir la note dans ce constat). **Verdict : constat maintenu.**

## Ce que les captures ne permettent pas de trancher

- **Le rendu visuel réel des correctifs déjà identifiés dans le code** (barre latérale repliable, `clients`/`sites`/`parc` en cartes, tableaux restants en défilement) n'a été vérifié que par lecture de fichiers `.tsx` et de classes Tailwind — jamais par une capture, jamais par un navigateur ouvert. Le code dit ce qui doit se produire ; il ne garantit pas qu'aucune régression visuelle ne s'y soit glissée (un `overflow-x-auto` mal borné, un tiroir qui se rouvre sur la mauvaise entrée, un espacement de grille cassé). Une nouvelle prise de vue sur `HEAD` reste le seul moyen de le confirmer à l'œil.
- **Le geste de défilement horizontal lui-même**, pour `vgp` et `client-detail` seulement (le scan pixel y confirme du contenu réel au-delà de 390 px) : rien ne dit si un indice visuel signale ce contenu, ni si le geste est facile à trouver sur un vrai doigt sans formation préalable. Pour `parametres-trajets` et `parametres-agences`, ce n'est plus la question : le scan pixel n'y trouve aucun contenu du tout au-delà d'environ x=400, donc rien à défiler jusqu'à — la question qui reste ouverte pour ces deux-là est la CAUSE du vide (hypothèse non vérifiée : une ascendance flexbox/grid sans `min-width:0`), qui exigerait d'exécuter l'application pour être confirmée.
- **Atteignabilité réelle des cibles tactiles** : la taille d'un bouton ou d'une case à cocher, lue sur l'image ou dans le code CSS, ne dit rien de la zone effectivement cliquable une fois posée sur un vrai écran tactile (une zone de frappe peut dépasser l'élément visible). Les tailles citées (36 px pour les boutons, la taille native du navigateur pour les cases à cocher) sont des mesures de code, pas des mesures d'usage.
- **Largeurs intermédiaires** : seule la largeur 390 px est capturée. Rien entre 391 et 1279 px — ni les tablettes, ni un téléphone en orientation paysage — n'est documenté. Un correctif qui « marche » à 390 px pourrait rester cassé à 600 ou 800 px.
- **Écrans non capturés** : `intervention-detail`, `portail` et `terrain-intervention` n'ont aucune capture (390 comme 1280) — voir `docs/captures/README.md`, qui documente des refus légitimes (aucune intervention à détailler, aucun compte portail connectable). Ces trois écrans échappent entièrement à cet audit, alors que `terrain-intervention` en particulier — l'écran de détail qu'un technicien ouvrirait sur le terrain — est précisément celui que l'angle « écran étroit, une main, parfois ganté » demanderait à examiner en priorité.
- **Thème sombre** : aucune apparence sombre n'est capturée. `docs/captures/README.md` explique que `lib/theme/apparence.ts` ne déclare aujourd'hui aucune apparence sombre — la question ne se pose donc pas encore, mais se posera le jour où une seconde entrée y sera ajoutée.
- **Contenu réel des écrans terrain** : `terrain--clair--390.png` montre une journée vide (« Aucune intervention »). La maquette (`#mobile` dans `CODIPLAN_Maquette.html`) dessine des cartes d'intervention, des checklists à cases de 17×17 px et des boutons pleine largeur pour ce contexte, mais aucune capture réelle ne montre ces éléments remplis de données à 390 px : impossible de vérifier si le motif de la maquette (déjà en dessous de la référence de 44 px pour ses propres cases à cocher) a été repris tel quel ou corrigé à l'implémentation.
