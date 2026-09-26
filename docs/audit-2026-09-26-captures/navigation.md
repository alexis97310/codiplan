# Audit d'ergonomie — Navigation

Méthode : lecture de `depot/docs/maquette/CODIPLAN_Maquette.html`, de `depot/docs/maquette/codiplan-maquette-complete.html` (qui fait foi, par D124/D125, sur la disposition des quatorze écrans qu'elle dessine — dont le menu, la barre latérale et son repli mobile) et de `depot/docs/captures/README.md`, puis lecture des **54 images** des 27 écrans capturés (`--clair--1280.png` et `--clair--390.png` pour chacun), en deux passes complètes. Aucune capture n'a été sautée ; les trois écrans refusés à la prise (`intervention-detail`, `portail`, `terrain-intervention`) et les quinze autres routes non photographiées sont traités en fin de rapport. Un contrôle `cmp` (comparaison octet à octet, hors mesure de l'application elle-même) a confirmé un doute visuel, cité au constat C2. Rien n'a été construit, migré ni exécuté dans `depot/` — seule la lecture des images et des fichiers HTML.

## Synthèse

| Gravité | Nombre |
|---|---|
| Bloquant | 2 |
| Gênant | 3 |
| Mineur | 3 |

| # | Section | Gravité | Résumé |
|---|---|---|---|
| C1 | Barre latérale sur téléphone | Bloquant | Le menu complet du poste de travail (272 px fixes — 70 % de la fenêtre de capture, 47 % de la page réellement rendue une fois qu'elle déborde) ne se replie pas à 390 px sur 18 des 19 écrans de back-office (seul `imports-rapport` est indemne) — **mais un correctif (`96dc74a`, postérieur aux captures) existe peut-être déjà sur `HEAD` ; non revérifié par capture** |
| C2 | Arrivée sans société | Bloquant | `arrivee-sans-societe` est **identique, à l'octet près**, à `arrivee` — cause établie : un témoin non discriminant (`"Choisir la société"`) a laissé passer une capture que le script aurait dû refuser (compte mono-société, promesse de `README.md:86` non tenue) ; l'état réel reste non photographié |
| C3 | Fil d'Ariane absent | Gênant | Aucun repère de chemin nulle part dans l'application capturée ; sur les pages à deux niveaux (paramétrage), seul le titre de page distingue où l'on est |
| C4 | Retours incohérents (paramétrage) | Gênant | Les 4 sous-pages de « Sociétés & tarifs » n'ont aucun lien de retour textuel, contrairement à toutes les autres sections de l'application capturée |
| C5 | Deux styles de lien retour | Mineur | Le lien retour s'écrit « ‹ Retour à X » à un endroit et « ← Retour à X » ailleurs |
| C6 | Sélecteur de société | Mineur | La pilule de société active n'a pas d'indice visuel de clic — conforme à la maquette qui fait foi, mais on ne peut pas savoir à l'image si elle est cliquable |
| C7 | Menus grisés sans le motif que prévoit la maquette | Gênant | Contrats / App technicien / Console éditeur apparaissent simplement grisés, sans le badge « Aperçu » ni la page explicative que `codiplan-maquette-complete.html` prévoit pour ce cas exact — et « App technicien » l'est alors qu'un écran `terrain` capturé et fonctionnel existe |
| C8 | Vue technicien sans navigation | Mineur | L'écran « Ma journée » ne montre aucun moyen d'atteindre une autre fonction terrain |

---

## 0. Une précision sur les sources — deux maquettes, deux autorités

`CLAUDE.md` §0 (et D124/D125) tranche : sur les quatorze écrans que dessine `codiplan-maquette-complete.html`, c'est **elle** qui fait foi sur la disposition — y compris la structure du menu — et non `CODIPLAN_Maquette.html`. Les deux maquettes dessinent en réalité la **même** structure de menu vertical, regroupée en trois blocs (Exploitation / Clients & parc / Paramètres), très proche de celle de l'application capturée — ce n'est donc pas `CODIPLAN_Maquette.html` (à barre horizontale, une seule page « Sociétés & tarifs ») qu'il faut comparer à l'application sur ce point, mais `codiplan-maquette-complete.html`. Les constats ci-dessous s'appuient sur cette dernière quand elle tranche, et le signalent.

Écart d'une ligne, sans plus : `codiplan-maquette-complete.html` affiche, dans sa barre du haut, un repère technique du chemin courant (`<span class="route">/tableau-de-bord</span>`, en police à chasse fixe, masqué en dessous de 900 px) — ce n'est pas un fil d'Ariane lisible par un utilisateur (pas de segments cliquables, pas de hiérarchie affichée), et il ne figure dans aucune capture de l'application réelle.

---

## 1. Écrans avant connexion — aucun repère, et c'est probablement voulu

**Gravité** : mineur
**Capture** : `connexion--clair--1280/390.png`, `connexion-code--clair--1280/390.png`, `enrolement--clair--1280/390.png`, `premier-acces--clair--1280/390.png`, `sante--clair--1280/390.png`, `accueil--clair--1280/390.png`
**Ce qui se passe** : ces six écrans n'affichent ni logo, ni barre de navigation, ni lien retour — un titre, un texte d'explication, un formulaire centré, rien d'autre.
**Pourquoi c'est un problème** : ce n'est pas gênant en soi pour un flux d'authentification à une seule étape (on avance ou on abandonne), mais rien ne permet de revenir en arrière dans un flux à plusieurs étapes (`connexion` → `connexion-code` → `enrolement`) si on s'est trompé — pas de « annuler » ni de lien vers `connexion`.
**Recommandation** : pas d'action nécessaire pour la navigation avant du flux ; envisager un lien discret « Annuler » sur `connexion-code` et `enrolement` pour permettre d'abandonner proprement — moins d'une journée.

---

## 2. `arrivee-sans-societe` — une capture fausse rangée sous un nom d'écran

**Gravité** : bloquant *(la cible change : ce n'est pas un défaut d'orientation de l'écran d'arrivée, mais le garde-fou du script de capture qui a échoué en silence — voir ci-dessous)*
**Capture** : `arrivee-sans-societe--clair--1280.png`, `arrivee-sans-societe--clair--390.png`, comparées à `arrivee--clair--1280.png`
**Ce qui se passe** : une comparaison `cmp` (octet à octet) montre que les deux fichiers `arrivee-sans-societe` sont **strictement identiques** à `arrivee`. Et `arrivee--clair--1280.png` elle-même montre **les deux états à la fois** : une carte bleue « Société active — CODIMA Nouvelle-Calédonie » avec le bouton « Ouvrir le planning », ET, juste en dessous, le titre « Choisir la société sur laquelle travailler » avec sa liste.

**C'est `arrivee-sans-societe` qui ment, pas `arrivee`.** L'image légendée « aucune société active » montre une société active. La cause est établie, en lecture seule de `depot/scripts/captures.mts` et `depot/docs/captures/README.md` :
- `scripts/captures.mts:228-260` : les deux écrans visitent le **même chemin** `/arrivee` et ne se distinguent que par leur témoin — `temoin: "société"` pour `arrivee` (`:233`), `temoin: "Choisir la société"` pour `arrivee-sans-societe` (`:253`). **Les deux témoins sont satisfaits par cette unique page** : le mot « société » y figure partout, et le titre « Choisir la société » y figure que le sélecteur soit vide ou non. Le second témoin n'est donc pas discriminant.
- `docs/captures/README.md:86` affirme pourtant la promesse inverse : une capture est refusée quand la page ne porte pas son témoin — « une capture d'un écran de connexion rangée sous le nom planning est pire qu'une capture absente : elle se relit comme une preuve ». Ici la promesse ne tient pas : un témoin trop faible a laissé passer la mauvaise page sans rougir.
- Détail aggravant : le sélecteur visible sur l'image ne liste qu'**une seule** société, alors que le `refusConnu` du script (`:256-260`) dit lui-même que cet écran exige un compte habilité sur **au moins deux** sociétés. La prise aurait dû être refusée pour cette raison seule — compte inadapté à la passe — et le témoin trop faible l'en a empêchée.
**Pourquoi c'est un problème** : au-delà de cette image précise, c'est le constat le plus lourd du lot — il conditionne la confiance qu'on peut accorder aux 53 autres images de ce dépôt. Un garde-fou documenté comme fiable (`README.md:86`) a échoué exactement dans le cas qu'il était censé empêcher, sans le signaler. Et l'état réel — un compte véritablement multi-société arrivant sans société active — reste **non photographié**, donc l'écran d'arrivée lui-même n'est ni disculpé ni mis en cause sur ce point précis.
**Recommandation** : doter la passe `sans-societe` d'un témoin réellement discriminant — par exemple l'**absence** du bouton « Ouvrir le planning », qui ne s'affiche que lorsqu'une société est active (visible sur `arrivee--clair--1280.png`) — puis rejouer la capture avec un compte réellement multi-société (`direction@codima.test` ou équivalent). Correctif d'outillage de moins d'une journée, et il conditionne la valeur de la prochaine prise de vue.

---

## 3. Fil d'Ariane — absent partout, gênant sur les pages à deux niveaux

**Gravité** : gênant
**Capture** : `parametres-agences--clair--1280.png`, `parametres-forfaits--clair--1280.png`, `parametres-prestations--clair--1280.png`, `parametres-trajets--clair--1280.png` (et leurs équivalents `--390.png`)
**Ce qui se passe** : ces quatre pages sont atteintes depuis « Sociétés & tarifs » (elle-même une porte à 8 cartes). Sur ces pages, seul le titre H1 (« Forfaits applicables », « Temps de trajet par zone »…) indique où l'on se trouve ; la barre latérale surligne uniquement l'entrée parente « Sociétés & tarifs », identique pour les quatre — elle ne dit pas laquelle des quatre sous-pages est ouverte. Ni l'une ni l'autre maquette ne montre de fil d'Ariane lisible non plus (voir §0) — ce n'est donc pas un écart de source, mais une lacune commune que l'application partage avec ses deux maquettes.
**Pourquoi c'est un problème** : sur un lien profond (favori, lien partagé, retour navigateur), rien à l'écran ne montre le chemin parcouru — seulement la destination. Ce n'est pas bloquant (le titre suffit à se repérer une fois la page chargée), mais l'application, contrairement à ses deux maquettes, a deux niveaux de profondeur sur cette section précise (aucune des deux maquettes ne modélise de sous-pages sous « Sociétés & tarifs » — voir C4).
**Recommandation** : ajouter un fil d'Ariane léger d'une ligne (« Sociétés & tarifs / Forfaits applicables ») au-dessus du titre sur les pages à deux niveaux (paramétrage, fiche client, fiche machine si elle existe). Sous une journée si un composant de mise en page commun porte déjà le titre de ces pages.

---

## 4. Retours incohérents entre sections — une incohérence interne, pas un écart à la maquette

**Gravité** : gênant
**Capture** : `parametres-agences--clair--1280/390.png`, `parametres-forfaits--clair--1280/390.png`, `parametres-prestations--clair--1280/390.png`, `parametres-trajets--clair--1280/390.png` — comparées à `intervention-creation--clair--1280.png` (« ← Retour au planning »), `client-detail--clair--1280.png` et `client-creation--clair--1280.png` (« ← Tous les clients »), `vgp--clair--1280.png` (« ‹ Retour au parc »), `vgp-a-determiner--clair--1280.png` (« ‹ Retour au registre »), `imports-rapport--clair--1280.png` (« ← Retour aux imports »)
**Ce qui se passe** : partout ailleurs dans l'application capturée, un écran atteint depuis une liste ou une porte de section porte, en haut du contenu, un lien textuel explicite de retour. Les quatre sous-pages de « Sociétés & tarifs » n'en portent **aucune** : seul le surlignage bleu, déjà actif, de « Sociétés & tarifs » dans la barre latérale signale la section. Précision : ni `CODIPLAN_Maquette.html` ni `codiplan-maquette-complete.html` ne modélisent ces quatre sous-pages (les deux ne montrent qu'un seul écran « Sociétés & tarifs », avec des cartes ou des boutons qui ne naviguent nulle part) — ce constat est donc une incohérence interne à l'application capturée, pas un écart mesuré contre une maquette. La maquette complète montre en revanche le patron attendu ailleurs dans l'application : sa fiche machine porte elle aussi un bouton « ← Retour au parc », du même type que ceux listés ci-dessus.
**Pourquoi c'est un problème** : le chemin pour revenir à la porte des 8 cartes de paramétrage n'est pas le même que pour revenir à n'importe quelle autre liste de l'application — l'utilisateur doit deviner qu'il faut recliquer une entrée de menu déjà surlignée, geste qu'aucun autre écran capturé ne lui demande.
**Recommandation** : ajouter le même lien « ← Retour à Sociétés & tarifs » en tête des quatre sous-pages, par cohérence avec le reste de l'application. Sous une journée : le composant de lien retour existe déjà et est réutilisé ailleurs.

---

## 5. Deux styles de lien retour

**Gravité** : mineur
**Capture** : `vgp--clair--1280.png`, `vgp-a-determiner--clair--1280.png` (chevron « ‹ ») contre `intervention-creation--clair--1280.png`, `client-detail--clair--1280.png`, `client-creation--clair--1280.png`, `imports-rapport--clair--1280.png` (flèche « ← »)
**Ce qui se passe** : le même patron de lien (« Retour à X ») est rendu avec deux glyphes différents selon l'écran.
**Pourquoi c'est un problème** : purement cosmétique — ça n'empêche personne de comprendre ou d'utiliser le lien — mais ça révèle que ce n'est pas un composant unique partagé partout, ce qui rend une future correction (comme C4) plus longue à propager uniformément.
**Recommandation** : unifier sur un seul glyphe (la maquette qui fait foi utilise « ← » sur sa fiche machine — s'aligner sur celui-ci est le choix le plus simple). Moins d'une journée.

---

## 6. Sélecteur de société — conforme à la maquette, mais son affordance reste incertaine

**Gravité** : mineur *(revu à la baisse : le premier rapprochement avait comparé l'application à `CODIPLAN_Maquette.html`, qui n'a pas autorité sur ce point — voir §0)*
**Capture** : `arrivee--clair--1280.png` et toute capture authentifiée (pilule « CODIMA Nouvelle-Calédonie » en bas de la barre latérale)
**Ce qui se passe** : dans l'application réelle, la société active est affichée dans un encart bleu plein, sans chevron ni icône de menu, en bas de la barre latérale. C'est exactement ce que montre `codiplan-maquette-complete.html` (pied de barre latérale : nom de la société, agence, avatar — aucun élément cliquable, aucune flèche) : sur ce point précis, l'application capturée **suit** sa maquette de référence.
**Pourquoi c'est un problème** : ni la maquette ni l'application ne signalent, à l'image, si cet encart peut être cliqué pour changer de société sans repasser par l'écran « Vous êtes connecté ». Le changement de société est un geste sensible (cloisonnement multi-société, I1) : si ce raccourci existe sans indice visuel, un utilisateur habilité sur plusieurs sociétés peut ne jamais le découvrir.
**Recommandation** : supposition à vérifier au clic (aucune capture ne montre l'état survolé ou cliqué). Si l'encart n'est pas cliquable, ce n'est pas un défaut — le changement passe par l'écran d'arrivée, chemin explicite. S'il est cliquable sans le signaler, ajouter un indice visuel. Quelques heures dans les deux cas, et ce n'est pas prioritaire puisque conforme à la source qui fait foi.

---

## 7. Menus grisés — la maquette qui fait foi prévoit un badge et une page explicative, l'application capturée n'a ni l'un ni l'autre

**Gravité** : gênant
**Capture** : toute capture authentifiée, p. ex. `arrivee--clair--1280.png`, `planning--clair--1280.png` (entrées « Contrats », « App technicien », « Console éditeur » en gris clair) ; à comparer à `terrain--clair--1280.png` et `terrain--clair--390.png`, qui montrent un écran « Ma journée » fonctionnel et daté (18/09/2026, avatar « TW »)
**Ce qui se passe** : `codiplan-maquette-complete.html` prévoit précisément ce cas — un module pas encore livré — et le traite ainsi : l'entrée de menu reste un lien normal, porte une petite pastille « Aperçu » (`.nav-link.preview:after{content:"Aperçu"}`), et mène à une page qui l'explique en toutes lettres (« Module futur · lot 3 », « Cette vue illustre la place du module ; elle n'existe pas encore dans Codiplan »). Dans l'application capturée, les trois entrées sont simplement grisées, sans pastille ni texte visible expliquant pourquoi. Plus troublant : « App technicien » est grisée comme les deux autres sur **tous** les écrans authentifiés capturés, alors qu'un écran `terrain` complet et manifestement fonctionnel (date du jour, initiales d'un technicien réel du jeu de données) a bien été capturé — ce qui contredit, à l'image, l'idée que cette fonction serait indisponible.
**Pourquoi c'est un problème** : une image ne permet pas de distinguer « fonctionnalité pas encore livrée » de « rôle insuffisant pour y accéder » — deux situations qui appellent des réactions différentes. Le cas « App technicien » est plus net : soit le grisé ment (la fonction existe, seul ce compte/rôle n'y a pas accès depuis cet écran — ce qui devrait se dire), soit `terrain` est atteint par un tout autre chemin (compte technicien dédié, hors barre latérale du poste de travail) — auquel cas ce n'est pas un défaut, mais rien ne le signale non plus depuis le back-office.
**Recommandation** : reprendre le patron déjà écrit dans `codiplan-maquette-complete.html` — badge court + page ou info-bulle d'explication — pour les entrées réellement indisponibles ; et clarifier, au moins par une note, pourquoi « App technicien » reste grisée dans le back-office alors qu'un écran technicien existe. Moins d'une journée pour le badge ; la clarification sur « App technicien » demande d'abord de savoir, côté produit, laquelle des deux situations s'applique — à vérifier avant de choisir la correction.

---

## 8. Barre latérale sur téléphone — ne se replie jamais, contrairement à ce que prescrit la maquette qui fait foi

**Gravité** : bloquant
**Capture** : décompte explicite, après relecture croisée (l'équipe a mesuré les en-têtes IHDR des 54 PNG, plus fiable que ma lecture à l'œil) — sur les **27 captures**, **19 écrans distincts** portent la barre latérale de back-office : `arrivee`, `planning`, `planning-jour`, `intervention-creation`, `clients`, `client-detail`, `client-creation`, `sites`, `parc`, `vgp`, `vgp-a-determiner`, `absences`, `imports`, `imports-rapport`, `parametres`, `parametres-agences`, `parametres-forfaits`, `parametres-prestations`, `parametres-trajets` (`arrivee-sans-societe` n'est pas un 20ᵉ écran distinct : c'est le même contenu qu'`arrivee` sous un autre nom de fichier, cf. C2). De ces 19, **18 débordent horizontalement à 390 px** ; `imports-rapport--clair--390.png` est seul indemne. Comptés au niveau des **fichiers** plutôt que des écrans, c'est 19 sur 27 qui débordent (le doublon `arrivee-sans-societe--clair--390.png` déborde aussi, sous son propre nom). Aucun écran ne déborde à 1280 px. `terrain` (authentifié, mais hors back-office, habillage différent) et les 6 écrans pré-connexion ne portent pas cette barre et ne débordent pas.
**Ce qui se passe** : à 390 px, la barre latérale garde sa largeur et son contenu complets — logo, les ~14 entrées de menu réparties en trois groupes, pilule de société, déconnexion, avatar — plutôt que de se replier en menu masqué. Elle est fixée à **272 px** (`codiplan-maquette-complete.html:12`, `grid-template-columns:272px`). **Ma première estimation à l'œil, « environ la moitié de l'écran », et le chiffre corrigé en relecture (« 272/390 ≈ 70 % ») sont tous les deux exacts, sous deux dénominateurs différents, et ce n'est pas une contradiction à trancher mais deux mesures légitimes** : rapportée à la largeur de la **fenêtre** capturée (390 px), la barre pèse 272/390 ≈ 70 % ; rapportée à la largeur de la **page réellement rendue** sur `arrivee` (573 px, parce que la page déborde horizontalement au lieu de se réajuster), elle pèse 272/573 ≈ 47 %, proche de mon « ~50 % » initial. Le débordement horizontal est lui-même une conséquence du même défaut : la colonne de contenu ne se rétrécit pas assez pour tenir dans 390 px, donc la page entière s'élargit au lieu de s'adapter — au pire sur `parametres-agences` (page rendue à 1093 px, 2,8 fois la fenêtre) et `parametres-trajets` (1009 px). La colonne de contenu qui reste force le texte à se rompre mot par mot ; le record de hauteur est `planning--clair--390.png`, qui atteint **4328 px** (mesuré sur l'en-tête IHDR du PNG — je citais ce chiffre par erreur sur `arrivee`, qui n'est pas la page la plus haute). **`codiplan-maquette-complete.html`, qui fait foi sur la disposition de ces écrans (D125), prescrit explicitement le comportement inverse** : sous 900 px de largeur, sa feuille de style masque la barre latérale hors-écran (`transform:translateX(-104%)`), affiche un bouton ☰ pour la faire glisser à la demande, et pose un voile derrière elle pendant qu'elle est ouverte — un script confirme que ce bouton l'ouvre et qu'un clic sur le voile la referme.
**Pourquoi c'est un problème** : la navigation, censée aider à se repérer, occupe l'essentiel de l'écran en permanence sur téléphone et pousse le contenu utile dans une colonne à peine lisible — l'exact inverse du comportement que sa propre source de référence décrit. Sur un contexte d'exploitation où le réseau mobile est absent par endroits et où le terrain travaille sur téléphone, c'est la première chose qu'un utilisateur rencontre en ouvrant le back-office depuis un mobile.
**Réserve importante, à vérifier avant tout ticket** : les captures de ce dépôt datent du commit `bbf7e3c` (18/09/2026). En lisant `git log` (lecture seule, rien exécuté) sur `depot`, j'ai confirmé que `HEAD` est `934da3e` et que le commit `96dc74a` — « COQUE-375 — le back-office et le portail tiennent sur un téléphone » (#272, fusionné le 21/09/2026), **postérieur** à la prise de vue — modifie exactement `app/(back-office)/layout.tsx` et ajoute `components/navigation/bandeau-mobile.tsx` pour faire sortir la colonne latérale sous 901 px, avec un bandeau mobile et un tiroir qui revient sur clic. Son propre message de commit dit régler « 63 px de contenu utile à 375 px » sur une colonne « 272px fixe, aucune classe responsive » — c'est la description exacte de ce constat. **Je ne sais pas si le résultat est satisfaisant** : je n'ai lu que le message et le `--stat` du commit, pas rejoué de capture dessus. Ce constat reste donc écrit tel qu'observé sur les images disponibles, mais une nouvelle prise de vue sur `HEAD` est nécessaire avant d'ouvrir un ticket, pour ne pas redemander un travail déjà fait.
**Recommandation** : vérifier d'abord si `96dc74a` répond déjà à ce constat (nouvelle capture requise) ; si un écart subsiste, implémenter le repli déjà spécifié dans `codiplan-maquette-complete.html` (bouton, panneau hors-écran, voile, point de rupture). Pas une correction d'une journée si elle reste à faire : changement de mise en page partagé par la quasi-totalité des écrans authentifiés, à traiter une fois dans le composant commun puis à vérifier sur les 19 écrans de back-office listés ci-dessus.

---

## 9. Vue technicien (« Ma journée ») — seul écran adapté au téléphone, mais sans navigation interne

**Gravité** : mineur
**Capture** : `terrain--clair--1280.png`, `terrain--clair--390.png`
**Ce qui se passe** : cet écran est le seul, sur les 27, qui n'utilise pas la barre latérale du poste de travail : à 390 px comme à 1280 px, il affiche une barre horizontale blanche (logo, pilule de société, déconnexion, avatar) et le contenu tient dans la largeur de l'écran sans rupture de texte. Aucun onglet ni lien n'apparaît pour atteindre d'autres fonctions terrain.
**Pourquoi c'est un problème** : si d'autres fonctions terrain existent (voir C7 — la maquette qui fait foi montre, pour ce module, un compteur de temps et un lien direct vers la fiche machine), rien sur cet écran ne permet de les atteindre depuis la seule vue « Ma journée » capturée.
**Recommandation** : supposition à vérifier — l'écran capturé montre un jour sans intervention (« Aucune intervention »), donc les actions liées à une intervention (compteur, fiche machine) n'ont peut-être simplement rien à afficher ce jour-là plutôt que d'être absentes du produit. À confirmer avant de l'inscrire comme correction.

---

## Comptage de clics — les quatre tâches courantes

Pour chaque tâche : le compte est marqué **complet** quand toutes les captures nécessaires existent, et **incomplet** quand il s'arrête faute d'image — jamais comblé par une hypothèse.

**1. Créer une demande / une intervention — incomplet**
Chemin confirmé par capture : Planning (`planning--clair--1280.png`) → bouton « Créer une intervention » (visible en haut à droite) = **1 clic** → formulaire `intervention-creation` → remplir les champs → bouton « Créer » = **2ᵉ clic**. → **2 clics depuis le Planning**, confirmé par capture. Depuis l'écran d'arrivée (`arrivee--clair--1280.png`) : + « Ouvrir le planning » = **3 clics**, confirmé par capture.
Un second chemin est probable mais **non vérifiable ici** : l'écran de liste « Interventions » (menu de la barre latérale) n'a **aucune capture** dans ce dépôt. `codiplan-maquette-complete.html` montre, sur son écran `interventions`, un bouton « + Nouvelle intervention » directement dans l'en-tête — ce qui suggérerait un chemin à 1 clic depuis cette liste — mais rien ne confirme que l'application réelle se comporte ainsi : aucune capture de `interventions` n'existe pour le vérifier. Le compte ci-dessus reste donc incomplet tant que cet écran n'est pas photographié.

**2. Planifier (poser une intervention en attente sur le planning) — incomplet**
Aucune capture (`planning--clair--1280/390.png`, `planning-jour--clair--1280/390.png`) ne montre de bouton « Planifier » sur les cartes du panneau « À planifier ». `CODIPLAN_Maquette.html` documente un glisser-déposer (« Glisser-déposer pour réaffecter ») comme mécanisme de pose ; `codiplan-maquette-complete.html` ne montre pas non plus de bouton sur ses cartes de file d'attente. **Aucun chemin cliquable n'est visible dans les captures — le compte s'arrête ici, faute d'image montrant un état intermédiaire ou une alternative cliquable.**

**3. Reporter (déplacer / replanifier une intervention existante) — incomplet**
Aucun bouton, icône ou menu contextuel n'est visible sur les blocs d'intervention déjà posés dans `planning--clair--1280.png` ou `planning-jour--clair--1280.png` (simples pavés colorés avec heure et libellé). `codiplan-maquette-complete.html` ouvre, au clic sur un bloc, un panneau latéral de détail (« tiroir ») qui ne propose lui-même qu'un test de retours d'enregistrement (confirmer / simuler un refus / couper la connexion) — pas d'action de report identifiable. **Le compte s'arrête faute d'image montrant le détail d'une intervention posée dans l'application réelle** (`intervention-detail` est un des trois écrans refusés à la prise).

**4. Valider un temps (saisie ou validation d'un temps passé) — incomplet**
Aucune capture ne montre d'écran de saisie ou de validation d'un temps passé, ni côté back-office ni côté terrain. `intervention-creation` ne propose qu'un choix de « Mode de valorisation : Temps passé » au moment de la **création** — pas une saisie de temps réalisé après coup. `codiplan-maquette-complete.html` montre, sur son écran terrain, un bouton « Démarrer le compteur » / « Mettre en pause » qui ferait office de suivi de temps côté technicien — mais l'écran `terrain` réellement capturé (`terrain--clair--1280/390.png`) ne montre aucune intervention en cours ce jour-là, donc aucun bouton de ce type n'y est visible. Les deux écrans qui porteraient vraisemblablement cette action (`intervention-detail` côté back-office, `terrain-intervention` côté terrain) sont **tous deux absents des captures** (refusés à la prise, cf. `depot/docs/captures/README.md:88-101`). **Aucun décompte de clics possible — le compte s'arrête entièrement faute d'image.**

---

## Ce que les captures ne permettent pas de trancher

- **La couverture des captures est partielle à l'échelle de l'application** : l'application compte 42 routes ; 27 seulement sont photographiées (les 3 refusées à la prise plus 12 autres jamais capturées). Notamment absentes : **`tableau-de-bord`** (page d'accueil du back-office après sélection de société) et **`interventions`** (liste) — deux écrans où vivent probablement « créer une demande » et une partie de « valider un temps », d'après leur rôle dans les deux maquettes. Toute conclusion de ce rapport sur ces deux tâches s'arrête donc faute d'image, comme indiqué tâche par tâche ci-dessus.
- **`intervention-detail`, `portail` et `terrain-intervention` n'ont aucune capture**, motifs détaillés en `depot/docs/captures/README.md:88-101`. Ce sont précisément les écrans qui porteraient le report d'une intervention, la validation d'un temps passé côté terrain, et l'accès client externe.
- **États intermédiaires et survol** : aucune capture ne montre un menu ouvert, un état de survol, un focus clavier, ou l'état cliqué de la pilule de société — le constat C6 en dépend et reste une supposition.
- **Écrans d'erreur** : aucune capture de page 404, de session expirée, ou d'erreur serveur — impossible de dire si un chemin de retour y est proposé.
- **Le glisser-déposer du planning** : les captures sont statiques ; impossible de confirmer si poser ou reporter une intervention dispose d'une alternative cliquable (menu contextuel, bouton au clic sur le bloc) en plus du glisser-déposer supposé.
- **Thème sombre** : absent des captures (et de l'application — `lib/theme/apparence.ts` ne déclare qu'un thème), donc rien à évaluer sur ce point pour la navigation.
- **Le constat C1 (barre latérale) est peut-être déjà corrigé sur `HEAD`** : le commit `96dc74a` (postérieur aux captures, message cité en C1) décrit un correctif qui ressemble exactement au défaut constaté. Établi par lecture de `git log`/`git show`, pas par une nouvelle capture — je ne peux pas dire si le résultat est satisfaisant, seulement qu'un changement dans ce sens existe. Une nouvelle prise de vue sur `HEAD` est le seul moyen de lever le doute.
- **La cause exacte du constat C2** (`arrivee-sans-societe` identique à `arrivee`) est établie côté script (voir C2, avec citations `chemin:ligne`) : la passe de capture réutilise le compte mono-société de démonstration et un témoin trop faible pour distinguer les deux états. Ce que les images ne disent toujours pas : si l'application, confrontée à un vrai compte multi-société sans société active, distingue correctement les deux états à l'écran — cet état précis reste non photographié.
- **La fiche machine** : les deux maquettes en montrent une (avec un lien « ← Retour au parc », un QR code, un historique), et les captures `parc` montrent des liens vers des fiches (`Local-000002`…), mais aucune capture ne montre la page de destination dans l'application réelle — impossible d'évaluer son retour ou son fil d'Ariane.
- **Pourquoi « App technicien » reste grisée alors que `terrain` est capturée et fonctionnelle** (C7) : impossible de trancher, depuis une image, entre fonctionnalité restreinte par rôle et chemin d'accès simplement non exposé depuis ce menu.
