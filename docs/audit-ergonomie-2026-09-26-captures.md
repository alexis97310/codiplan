# Audit d'ergonomie CODIPLAN — 26 septembre 2026

**Ce document ne modifie aucun fichier de produit.** Il mesure, il ne corrige pas. Trois équipiers ont relu les 54 captures de `depot/docs/captures/` sous un angle unique chacun — navigation, lisibilité, écran étroit —, puis se sont relus mutuellement. Leurs rapports intégraux : `docs/audit/navigation.md`, `docs/audit/lisibilite.md`, `docs/audit/mobile.md`.

---

## Résumé en dix lignes

1. Les captures ne décrivent plus l'application : elles datent du 18/09, et le code de `HEAD` a changé depuis sur au moins cinq familles de constats.
2. Le dispositif censé signaler ce vieillissement est cassé : le commit photographié `bbf7e3c` **n'existe dans aucune référence du dépôt**, donc `pnpm captures:etat` ne peut plus jamais répondre.
3. Deuxième défaut du même dispositif : le témoin de `arrivee-sans-societe` n'est pas discriminant, et une capture fausse est passée sans que le script rougisse.
4. Conséquence : une part importante de cet audit est **à confirmer par une nouvelle prise de vue**, et c'est son résultat le plus utile.
5. Ce qui survit à la relecture du code : la vue « Jour » du planning n'a aucun repli en liste contrairement à la vue « Semaine », et deux écrans de paramétrage ne peignent pas leurs colonnes.
6. Survit aussi : des cibles tactiles sous 44 px, l'absence totale de fil d'Ariane, et quatre sous-pages de paramétrage sans lien de retour.
7. Mesure objective et reproductible : **19 des 27 fichiers — 18 écrans distincts — débordent horizontalement à 390 px**, aucun à 1280 px, lu à l'en-tête des PNG et non à l'œil.
8. Le correctif `96dc74a` (COQUE-375) a replié la barre latérale sous 901 px : le constat le plus spectaculaire des trois rapports est périmé, mais son effet réel n'est pas photographié.
9. Trois écrans ont été refusés à la prise, et **17 routes sur 42 n'ont jamais été photographiées** — dont `tableau-de-bord` et `interventions`.
10. Trois des quatre tâches courantes à chiffrer — planifier, reporter, valider un temps — sont inchiffrables faute d'écrans capturés.

---

## Avertissement de méthode — contre quoi cet audit a été mesuré

**Deux maquettes, deux autorités, et la consigne désignait la mauvaise.** La commande d'audit nommait `CODIPLAN_Maquette.html` comme faisant foi « pour la disposition et les couleurs ». Or `CLAUDE.md:31` établit que, depuis D124/D125 (`docs/arbitrages.md`, rang 1), c'est `codiplan-maquette-complete.html` qui fait foi sur les jetons de couleur, la typographie, le rayon, l'ombre et **la disposition des quatorze écrans qu'elle dessine** ; `CODIPLAN_Maquette.html` ne garde autorité que sur le reste — c'est-à-dire précisément pas sur les deux points visés.

L'équipier lisibilité a signalé l'écart avant d'écrire, l'équipier navigation a relu les deux maquettes et **a dû requalifier un constat** (le sélecteur de société, de gênant à mineur : il comparait à la référence non autoritaire). Les constats de disposition de ce document sont donc rapportés à `codiplan-maquette-complete.html`. *Un écart mesuré contre la mauvaise maquette produit un ticket qui défait un arbitrage de rang 1.*

**Ce qui a été lu, et ce qui ne l'a pas été.** Les 54 images, les deux maquettes, le README des captures, et — en lecture seule — le code de `HEAD` quand un constat pouvait être périmé. Aucun build, aucun serveur, aucun test, aucune commande `pnpm` : `AGENTS.md` interdit de mesurer dans `depot/`, tenu pour un instantané gelé. Aucun fichier du dépôt n'a été écrit.

---

## L'appareil de mesure est en cause avant le produit

Trois défauts distincts, et ils précèdent tout le reste : tant qu'ils tiennent, aucun audit sur captures n'est fiable.

### A1 — Le commit photographié n'existe pas dans le dépôt · **bloquant**

`docs/captures/README.md` annonce `bbf7e3c43416311d6b572879e67dbac56c5521e3`. Ce hash est introuvable : `git cat-file -t` échoue, et il n'apparaît dans aucune des 460 références connues. Le clone n'est pourtant **ni tronqué ni partiel** (447 commits sur `HEAD`, pas de `.git/shallow`, aucun filtre promisor) — ce n'est donc pas le cas « clone tronqué » que `scripts/etat-des-captures.mts` sait nommer.

L'explication tient à l'historique : chaque commit de `main` est l'écrasement d'une pull request (`934da3e … (#273)`, `4050e43 … (#274)`, `96dc74a … (#272)`). **La fusion par écrasement détruit le commit sur lequel les captures ont été prises.** Le README enregistre donc fidèlement une empreinte qui cesse d'exister le jour où la branche est fusionnée.

*Pourquoi c'est un problème :* `pnpm captures:etat` compare `bbf7e3c` à `HEAD` et rend trois verdicts. Aucun n'est atteignable — la commande sort en 1 (« je ne sais pas ») indéfiniment. Le README promet un moyen de savoir si un écran a bougé ; ce moyen est mort-né, et personne ne l'a vu parce que le verdict d'ignorance ressemble à un incident passager.

**Recommandation :** ancrer la prise de vue sur quelque chose qui survit à l'écrasement — le commit de `main` sur lequel le serveur a été construit, lu après fusion, ou à défaut l'empreinte du contenu des fichiers de `SURFACE_DECRAN` plutôt que celle du commit. Moins d'une journée pour le script ; la décision d'ancrage est à trancher d'abord.

### A2 — Un témoin non discriminant a laissé passer une capture fausse · **bloquant**

`arrivee-sans-societe--clair--1280.png` et `--390.png` sont **identiques à l'octet près** à `arrivee--clair--*.png` (vérifié au `cmp` par l'équipier navigation). L'écran censé montrer « aucune société active » montre une société active.

La cause est établie. Dans `scripts/captures.mts:228-260`, les deux écrans visitent le même chemin `/arrivee` et ne se distinguent que par leur témoin : `temoin: "société"` pour l'un, `temoin: "Choisir la société"` pour l'autre. Or l'image montre **les deux blocs à la fois** — la carte « Société active — CODIMA Nouvelle-Calédonie » avec son bouton « Ouvrir le planning », et en dessous le titre « Choisir la société sur laquelle travailler ». Les deux témoins sont satisfaits par cette page unique. Détail aggravant : le sélecteur ne liste qu'**une** société, alors que le `refusConnu` de ce même écran déclare exiger un compte habilité sur au moins deux — la prise aurait dû être refusée, et le témoin l'en a empêchée.

*Pourquoi c'est un problème :* `docs/captures/README.md:86` promet l'inverse, mot pour mot — « la capture est refusée et l'absence est écrite ici », parce qu'« une capture d'un écran de connexion rangée sous le nom planning est pire qu'une capture absente : elle se relit comme une preuve ». La promesse ne tient pas, et elle échoue en silence. Une image fausse a circulé dans trois audits.

**Le compte est la seconde moitié de la cause.** `connexionSansSociete` (`scripts/captures.mts:1071-1073`) appelle `seConnecter`, qui emploie le `COURRIEL` global de la prise de vue (`:837-838`) : il n'existe **aucune variable d'identité dédiée** pour cette passe, contrairement à `COURRIEL_PORTAIL` (`:60`) et `COURRIEL_TERRAIN` (`:77`). Le compte employé ce jour-là — « Administration de démonstration » — n'est habilité que sur une société, et D35 l'active donc dès la connexion. L'état visé, *plusieurs habilitations et aucune active*, ne pouvait pas se produire.

**Recommandation, en deux gestes indissociables :** donner à `arrivee-sans-societe` un témoin que la page « société active » ne porte pas — l'**absence** du bouton « Ouvrir le planning » est le candidat évident —, et faire échouer la prise si le sélecteur liste moins de deux sociétés. Puis jouer la prise entière sous un `COURRIEL` habilité sur au moins deux sociétés, puisque c'est la même identité qui sert tous les écrans. Moins d'une journée. *Le témoin seul ne suffirait pas : il transformerait l'image fausse en refus, ce qui est déjà un progrès, mais l'état resterait non photographié.*

### A3 — Quarante pour cent des routes n'ont jamais été photographiées · **gênant**

L'application compte 42 routes ; 25 sont photographiées, produisant 27 écrans. **17 routes n'ont aucune capture**, dont `tableau-de-bord` — l'écran d'atterrissage du back-office — et `interventions`, la liste. Trois de ces écrans sont déclarés dans le script et ont été refusés à la prise avec un motif écrit (`portail`, `intervention-detail`, `terrain-intervention`) ; les quatorze autres ne sont pas même déclarés.

*Pourquoi c'est un problème :* le dossier se relit comme l'inventaire de ce que l'application affiche. Il ne dit nulle part qu'il en couvre trois cinquièmes.

---

## Constats par gravité

Les trois angles se recoupent : la barre latérale est comptée une fois par équipier. Le tableau ci-dessous dédoublonne.

### Bloquants

| # | Constat | Angle | État à `HEAD` |
|---|---|---|---|
| A1 | Le commit photographié n'existe pas dans le dépôt | appareil | **actuel** |
| A2 | Témoin non discriminant : `arrivee-sans-societe` est une capture fausse | appareil | **actuel** |
| B1 | `planning-jour` : la vue « Jour » n'a aucun repli en liste, contrairement à la vue « Semaine » — colonnes techniciens fusionnées, texte illisible à 390 px | mobile | **actuel, vérifié** |
| B3 | `parametres-trajets` et `parametres-agences` à 390 px : toutes les colonnes sauf la première sont **absentes de la page**, pas hors cadre — et 600 à 700 px de fond vide s'étendent à droite | mobile, lisibilité | à revérifier à `HEAD` |
| B2 | La barre latérale de bureau ne se replie pas à 390 px : 272 px fixes sur 390, **118 px de contenu visible**, pages jusqu'à 4328 px de haut | les trois | **périmé** — voir ci-dessous |

**B1 est le seul défaut de produit bloquant qui survive à la vérification.** Dans `app/(back-office)/planning/page.tsx`, la vue semaine bascule en liste sous `lg` (`ListeSemaine`, classes `lg:hidden` lignes 792, 815, 819) ; la vue jour (`VueJour`, à partir de la ligne 891) n'a ni classe équivalente ni composant liste — son `<table>` est seulement entouré d'`overflow-x-auto`. Le motif de réparation existe donc déjà dans le même fichier, à quelques centaines de lignes.

**B3 a été remonté de gênant à bloquant en fin d'audit, sur une mesure pixel, et le détour mérite d'être raconté.** La lecture du code à `HEAD` avait conclu que ces tableaux défilaient — `components/ui/tableau.tsx:57` enveloppe bien dans `overflow-x-auto` — et l'équipier mobile avait rétrogradé ses constats en conséquence. Un balayage pixel à pixel de la zone au-delà de 390 px a renversé la conclusion pour deux écrans : `vgp` et `client-detail` portent bien du contenu jusqu'au bord droit (défilement réel, mal signalé — ils restent gênants), mais `parametres-trajets` (1009 px) et `parametres-agences` (1093 px) **ne portent aucun pixel non-fond au-delà de x ≈ 400**. Vérifié à l'image : la table de `parametres-trajets` n'affiche que la colonne « ZONE », tronquée en plein mot (« Grand No », « Côte Oues »), et le champ de saisie et le bouton « Enregistrer » de la colonne « Régler » sont introuvables. Le code réserve pourtant la place (`minimum="1000px"` / `"1040px"`, cinq colonnes déclarées) : l'espace est réservé, rien ne s'y peint. *La cause n'est pas tranchée — l'hypothèse d'un conteneur flexible sans `min-width:0` demanderait d'exécuter, ce que cet audit s'interdit.*

**Conséquence pratique, et elle défait un gain rapide :** ajouter un indice de défilement à `components/ui/tableau.tsx` (gain rapide n°4) réparerait `vgp` et `client-detail`, et **ne changerait rien** à ces deux écrans-là. Un réglage de temps de trajet reste alors impossible depuis un téléphone.

**B2 est périmé, et c'est une bonne nouvelle à vérifier.** Le commit `96dc74a` (COQUE-375, « le back-office et le portail tiennent sur un téléphone »), ancêtre confirmé de `HEAD`, replie la colonne : dans `components/navigation/barre.tsx:178-181`, l'`<aside>` porte `min-[901px]:flex` et, tiroir fermé, la classe `hidden` — la colonne sort du flux, elle n'est pas rétrécie. `app/(back-office)/layout.tsx` monte le `BandeauMobile` et le fournisseur de tiroir. *Le commentaire du fichier décrit exactement le défaut relevé par l'audit — « une fenêtre de 375, ne laissant que 63 px de contenu utile ».* Ce qui n'est pas établi : que le remède soit satisfaisant. Personne ne l'a vu.

### Gênants

| # | Constat | Angle | État à `HEAD` |
|---|---|---|---|
| A3 | 17 routes sur 42 sans capture, dont `tableau-de-bord` et `interventions` | appareil | actuel |
| G1 | Aucun fil d'Ariane nulle part ; sur les pages à deux niveaux, seul le titre dit où l'on est | navigation | actuel |
| G2 | Les 4 sous-pages de « Sociétés & tarifs » n'ont aucun lien de retour, contrairement à toutes les autres sections | navigation | actuel |
| G3 | Menus grisés (Contrats, App technicien, Console éditeur) sans le badge « Aperçu » ni la page explicative que la maquette qui fait foi prévoit pour ce cas — et « App technicien » est grisée alors qu'un écran `terrain` complet et daté existe | navigation | actuel |
| G4 | `vgp` et `client-detail` défilent horizontalement sans qu'aucun indice visuel ne le signale — le contenu est là, la découverte du geste ne l'est pas | mobile, lisibilité | actuel *(rétrogradé de bloquant ; `parametres-trajets` et `parametres-agences` en sont sortis et sont remontés en B3)* |
| G5 | Segments de phrase colorés comme des liens sans l'être, quasi systématique dans les paragraphes explicatifs | lisibilité | actuel |
| G6 | La dernière colonne du registre VGP (« Dernière information ») est coupée **à 1280 px** | lisibilité | actuel |
| G7 | Chevauchement de texte entre deux colonnes du tableau des temps de trajet (ligne « Îles ») | lisibilité | actuel |
| G8 | Deux légendes différentes pour l'occupation selon la vue du planning (pastilles nommées / cases à cocher) | lisibilité | actuel |
| G9 | L'app technicien a un habillage entièrement différent du back-office, sans lien visuel | lisibilité | actuel |
| G10 | Cibles tactiles sous 44 px (cases à cocher des écrans de paramétrage) | mobile | actuel, vérifié |
| G11 | *Fusionné dans B3* — le débordement sur fond vide de `parametres-agences` et `parametres-trajets` et la disparition de leurs colonnes sont le même défaut, vu de deux angles | lisibilité | voir B3 |
| G12 | Les listes `clients`, `sites`, `parc` perdaient leurs colonnes à 390 px | mobile | **périmé** — cartes (D123) et maître-détail à `HEAD` |

**Sur G9, les deux angles ne se contredisent pas, et leur composition est la recommandation :** l'équipier mobile voit dans `terrain` la preuve qu'un bon motif d'écran étroit existe déjà et veut l'étendre ; l'équipier lisibilité voit un habillage incohérent avec le reste. Les deux tiennent ensemble — **reprendre la structure de `terrain` avec la palette du back-office**.

### Mineurs

| # | Constat | Angle |
|---|---|---|
| M1 | Deux styles de lien retour cohabitent : « ‹ Retour à X » et « ← Retour à X » | navigation |
| M2 | La pilule de société active n'a pas d'indice de clic — conforme à la maquette qui fait foi, affordance indécidable à l'image | navigation |
| M3 | L'écran « Ma journée » n'offre aucun moyen d'atteindre une autre fonction terrain | navigation |
| M4 | La vue « Jour » du planning perd l'heure affichée dans le bloc | lisibilité |
| M5 | L'écran d'accueil n'a presque aucun contenu | lisibilité |
| M6 | Deux façons de signaler une donnée manquante dans la même colonne | lisibilité |
| M7 | L'état « aucune société active » n'est visible dans aucune capture | lisibilité |

---

## La mesure qui tranche trois débats d'appréciation

Les trois rapports donnaient trois largeurs différentes pour la même barre latérale. Une mesure mécanique les réconcilie toutes.

Une capture pleine page prise dans une fenêtre de 390 px ne peut produire un fichier plus large que 390 px **que si la page déborde horizontalement**. Lecture de l'en-tête IHDR des 54 fichiers PNG :

| Écran (390 px) | Largeur réelle | Au-delà de la fenêtre |
|---|---|---|
| `parametres-agences` | 1093 px | +703 px — 2,8 fois la fenêtre |
| `parametres-trajets` | 1009 px | +619 px |
| `imports` | 598 px | +208 px |
| `arrivee`, `arrivee-sans-societe` | 573 px | +183 px |
| `parametres-prestations` | 565 px | +175 px |
| `parc` | 548 px | +158 px |
| `absences` | 517 px | +127 px |
| `clients`, `client-detail`, `client-creation`, `sites`, `parametres-forfaits` | 511 px | +121 px |
| `planning` | 462 px (et **4328 px de haut**) | +72 px |
| `planning-jour` | 457 px | +67 px |
| `parametres` | 431 px | +41 px |
| `vgp` 414 px · `intervention-creation` 411 px · `vgp-a-determiner` 400 px | — | +24, +21, +10 px |

**19 des 27 fichiers débordent à 390 px. Aucun ne déborde à 1280 px.** Les huit indemnes : `accueil`, `connexion`, `connexion-code`, `enrolement`, `premier-acces`, `sante`, `terrain`, et `imports-rapport`.

*Une précision de décompte, pour que personne ne se dispute le chiffre plus tard :* 19 **fichiers**, mais 18 **écrans distincts** — `arrivee-sans-societe` est le doublon à l'octet près d'`arrivee` établi en A2, et compte donc deux fois dans les fichiers, une seule dans les écrans. Côté routes, 20 des 27 captures relèvent de `app/(back-office)/` ; `terrain` vit sous `app/(mobile)/` et n'est structurellement pas concerné.

`imports-rapport` est décisif : **il est authentifié, au back-office, et tient exactement dans 390 px.** La coque n'est donc pas seule en cause — le contenu de chaque écran déborde aussi, et replier la barre latérale ne suffira pas.

La dispute des trois chiffres se dissout de la même façon : la barre latérale fait 272 px fixes (`codiplan-maquette-complete.html:12`, `grid-template-columns:272px` ; `w-[272px]` dans `components/navigation/barre.tsx:180`, et une mesure pixel à pixel de la transition de couleur à x=272 sur six captures). Rapportée à la fenêtre de 390 px, c'est 70 %, et il reste **118 px de contenu visible** — un nombre fixe, pas une fourchette. Rapportée à la page réellement rendue de 573 px, c'est 47 %. Deux dénominateurs, un seul fait — personne n'avait tort.

---

## Gains rapides — moins d'une journée chacun

1. **Un témoin discriminant pour `arrivee-sans-societe`, et un compte multi-société pour la prise** (A2) : exiger l'absence du bouton « Ouvrir le planning », refuser la prise si le sélecteur liste moins de deux sociétés, et jouer toute la prise sous une identité habilitée sur au moins deux sociétés — c'est le même `COURRIEL` qui sert tous les écrans. *C'est le premier de la liste : sans lui, la prochaine prise de vue reproduit la même image fausse, ou la refuse sans la remplacer.*
2. **Un lien de retour sur les quatre sous-pages de « Sociétés & tarifs »** (G2) — le motif existe déjà dans toutes les autres sections, il n'y a qu'à l'appliquer.
3. **Unifier les deux styles de chevron** « ‹ » et « ← » (M1).
4. **Un indice visuel de défilement horizontal** dans `components/ui/tableau.tsx` (G4) — un seul composant partagé, donc un seul correctif pour `vgp` et `client-detail`. *Attention : ce correctif ne répare pas `parametres-trajets` ni `parametres-agences`, dont les colonnes ne sont pas hors cadre mais absentes (B3). Les traiter ensemble ferait croire le problème réglé.*
5. **Retirer la coloration « lien » des segments non cliquables** (G5).
6. **Le badge « Aperçu » sur les trois entrées grisées** (G3, première moitié) — la maquette qui fait foi le dessine déjà ; la page explicative est un chantier séparé.
7. **Dégriser « App technicien »** ou dire pourquoi elle reste grise alors que `terrain` fonctionne (G3, seconde moitié).
8. **Réparer la colonne coupée du registre VGP** (G6) et **le chevauchement du tableau des trajets** (G7) — deux défauts de gabarit, visibles dès 1280 px.
9. **Unifier les deux légendes d'occupation** du planning (G8).
10. **Agrandir les cases à cocher sous 44 px** (G10).
11. **Ajouter `tableau-de-bord` et `interventions` au script de capture** (A3, première moitié) — deux entrées dans `scripts/captures.mts`, et l'angle mort le plus gênant se referme.

## Chantiers lourds

1. **Le repli en liste de la vue « Jour » du planning** (B1) — le bloquant de produit le mieux établi. Le motif de la vue « Semaine » (`ListeSemaine`, N-02) sert de modèle, mais la grille jour porte les colonnes techniciens et n'a pas la même structure.
2. **Les colonnes non peintes de `parametres-trajets` et `parametres-agences`** (B3) — la place est réservée, le contenu ne s'y rend pas. Le diagnostic demande d'exécuter l'écran à 390 px, ce que cet audit s'est interdit ; c'est donc un chantier qui commence par une reproduction, pas par un correctif. Tant qu'il tient, régler un temps de trajet depuis un téléphone est impossible.
2. **L'ancrage des captures contre la fusion par écrasement** (A1) — la décision d'ancrage précède le code : empreinte du `main` fusionné, ou empreinte de contenu de `SURFACE_DECRAN`. Tant qu'elle n'est pas prise, `pnpm captures:etat` reste muet.
3. **Le fil d'Ariane** (G1) — c'est un système de navigation, pas un composant : il touche toutes les pages à deux niveaux.
4. **L'unification `terrain` / back-office** (G9) — structure de `terrain`, palette du back-office. Touche la coque des deux univers.
5. **Rendre le portail photographiable** — le README établit (et c'est présenté comme un arbitrage, pas un ticket) qu'aucun compte portail ne peut recevoir de lien de premier accès : D10 le prive de ligne dans `utilisateur_societe`, et l'amorçage en exige une. Tant que cela tient, `portail` restera hors de tout audit sur captures.
6. **Les quatorze routes non déclarées au script** (A3, seconde moitié) — au-delà des deux gains rapides ci-dessus, chacune demande un état de base et un témoin.

---

## Ce qui n'a pas pu être évalué faute de captures

**Trois écrans déclarés, refusés à la prise** — les motifs sont écrits dans `docs/captures/README.md:88-101` et sont légitimes :

- `portail` — aucun compte portail n'est connectable aujourd'hui (voir chantier 5) ;
- `terrain-intervention` — la journée du technicien de démonstration était vide le jour de la prise ;
- `intervention-detail` — le planning ne portait aucun lien d'intervention.

**Quatorze routes jamais déclarées au script :** `tableau-de-bord`, `interventions`, `parametres/equipe`, `parametres/habilitations`, `parametres/materiel`, `parametres/societe`, `parametres/agences/[calendrier]`, `parametres/forfaits/[id]`, `parc/[id]`, `parc/[id]/modifier`, `parc/nouvelle`, `sites/[id]`, `sites/nouveau`, `vgp/enregistrer/[id]`.

**Trois des quatre tâches courantes sont inchiffrables.** Seule « créer une intervention » a pu être comptée : 2 clics depuis le planning, 3 depuis l'écran d'arrivée. Planifier, reporter et valider un temps s'arrêtent faute d'écran — `tableau-de-bord`, `interventions`, `intervention-detail` et `terrain-intervention` portent précisément ces actions. *L'audit ne dit donc rien du coût des trois gestes les plus répétés du métier.*

**Ce qu'une image fixe ne montre pas :** survol, focus clavier, états de chargement et d'erreur, menus ouverts, et le glisser-déposer du planning — dont dépend la question « existe-t-il une alternative cliquable pour poser ou reporter une intervention ».

**Le thème sombre n'est capturé nulle part, et c'est délibéré** : `docs/captures/README.md:107` retire la consigne jusqu'au jour où `lib/theme/apparence.ts` déclarera une seconde apparence. Ce n'est pas un angle mort, c'est une absence assumée.

**Aucune largeur entre 391 et 1279 px** — ni tablette, ni téléphone en paysage. Le seuil de repli de la coque est à 901 px (`components/navigation/barre.tsx`) et aucune capture ne l'encadre.

**Et l'effet de COQUE-375 sur les vingt écrans concernés** : le code dit que la barre latérale se replie, aucune image ne le montre. C'est la première chose que la prochaine prise de vue établira.

---

## Prompt proposé pour la session suivante

Le texte ci-dessous est à donner tel quel à une **nouvelle** session. Il applique les gains rapides et se termine par la reprise des captures.

```text
Applique les gains rapides de l'audit d'ergonomie du 26/09/2026. Lis d'abord
CODIPLAN/docs/audit-ergonomie-2026-09-26.md, puis les trois rapports d'angle
dans CODIPLAN/docs/audit/ pour le détail et les preuves.

AGENTS.md tient pour cette session AUSSI, à une exception près que je lève
explicitement ici : tu vas écrire dans depot/ et y lancer des commandes,
parce que c'est le seul moyen d'appliquer des correctifs et de reprendre les
captures. Tout le reste d'AGENTS.md tient — ne touche ni 11-FILE.sh ni
14-BOUCLE.sh, ne lis jamais journal-file.txt en entier.

Travaille sur une BRANCHE : le dépôt est en HEAD détaché sur origin/main.

Ordre imposé, parce que le premier conditionne la valeur du dernier :

1. A2 — le témoin de `arrivee-sans-societe` dans scripts/captures.mts.
   Aujourd'hui les deux écrans visitent /arrivee et se distinguent par
   temoin: "société" et temoin: "Choisir la société" — or la page porte les
   deux textes à la fois, donc la capture « sans société » photographie une
   société active. Donne-lui un témoin que la page « société active » ne
   porte pas (l'ABSENCE du bouton « Ouvrir le planning »), et fais échouer la
   prise si le sélecteur liste moins de deux sociétés.
   Sache que la passe « sans société » n'a PAS d'identité à elle :
   connexionSansSociete (captures.mts:1071-1073) appelle seConnecter, qui
   emploie le COURRIEL global (:837-838) — il n'existe pas d'équivalent de
   COURRIEL_PORTAIL ou COURRIEL_TERRAIN pour ce cas. C'est donc le compte de
   TOUTE la prise qui doit être habilité sur deux sociétés (voir le point 3),
   ou bien tu ajoutes une variable dédiée. Dis-moi laquelle des deux tu
   retiens plutôt que de choisir en silence.

2. Les correctifs d'interface, un commit atomique chacun, dans cet ordre :
   - lien de retour sur les 4 sous-pages de « Sociétés & tarifs » ;
   - un seul style de chevron de retour (‹ ou ←, pas les deux) ;
   - indice visuel de défilement horizontal dans components/ui/tableau.tsx ;
   - retirer la coloration « lien » des segments non cliquables ;
   - badge « Aperçu » sur Contrats / App technicien / Console éditeur, comme
     le dessine codiplan-maquette-complete.html — et tranche le cas « App
     technicien », grisée alors que /terrain fonctionne ;
   - colonne « Dernière information » du registre VGP, coupée dès 1280 px ;
   - chevauchement de colonnes du tableau des temps de trajet (ligne Îles) ;
   - une seule légende d'occupation entre vue Semaine et vue Jour ;
   - cases à cocher des écrans de paramétrage portées à 44 px ;
   - ajoute `tableau-de-bord` et `interventions` aux écrans de
     scripts/captures.mts : ils n'ont jamais été photographiés.

   Respecte §5 de CLAUDE.md : aucune chaîne en dur, tout par lib/i18n/fr.ts.
   `pnpm verify` doit passer avant chaque commit.

   N'attaque AUCUN chantier lourd : ni le repli en liste de la vue Jour, ni
   le fil d'Ariane, ni l'unification terrain/back-office, ni les colonnes non
   peintes de parametres-trajets / parametres-agences. Ils sont hors de cette
   session, et je les ouvrirai séparément.

   Sur ce dernier point, une mise en garde : l'indice de défilement que tu
   ajoutes à tableau.tsx répare vgp et client-detail, et NE répare PAS
   parametres-trajets ni parametres-agences, dont les colonnes ne sont pas
   hors cadre mais absentes de la page (constat B3). Ne les présente pas
   comme réglés.

3. Reprends les captures, en suivant docs/captures/README.md à la lettre —
   base jetable, semis, amorçage du mot de passe, AUCUN next dev vivant, et
   `rm -rf .next && pnpm build` avant la prise. Utilise un compte habilité
   sur DEUX sociétés, sans quoi le témoin corrigé au point 1 refusera
   `arrivee-sans-societe`, et ce refus sera juste.

     pnpm exec tsx scripts/captures.mts

   Le script réécrit docs/captures/README.md avec le commit photographié
   (lu dans git rev-parse HEAD) et l'horodatage lu à l'horloge. Vérifie que
   les deux y sont, et que la section « Refusées à cette prise » ne cache pas
   un écran que tu croyais avoir pris.

4. Signale-moi, sans le corriger, ce que la nouvelle prise établit sur les
   constats marqués « périmé » dans la synthèse — en particulier si la barre
   latérale se replie réellement à 390 px et ce qu'il reste du débordement
   horizontal sur les 19 écrans concernés. Mesure-le à l'en-tête des PNG :
   un fichier plus large que 390 px est une page qui déborde. Et dis-moi si
   les colonnes de parametres-trajets et parametres-agences se peignent
   enfin, ou si B3 tient toujours.

5. Commit des captures à jour dans docs/captures/, avec dans le message le
   commit photographié et la date de la prise.

Un point que tu rencontreras et qui n'est PAS de ton ressort : le hash
bbf7e3c annoncé par l'ancien README n'existe dans aucune référence du dépôt,
parce que la fusion par écrasement détruit le commit sur lequel les captures
ont été prises — donc `pnpm captures:etat` ne peut plus jamais répondre. Ne
répare pas l'ancrage dans cette session : signale-le, c'est une décision à
prendre, pas un correctif.
```
