# Audit d'ergonomie CODIPLAN — Lisibilité

## Méthode

Angle unique : hiérarchie visuelle, densité, contrastes, libellés, cohérence entre écrans — rien d'autre (ni clics, ni parcours, ni zones tactiles). Référence de disposition et de palette : `docs/maquette/CODIPLAN_Maquette.html`, comme demandé. Un second fichier de maquette existe dans le même dossier, `codiplan-maquette-complete.html`, plus récent et — selon `CLAUDE.md` §0 (D124/D125) — seul à faire foi sur les jetons de couleur et la disposition de quatorze écrans. Il n'a pas servi de base de comparaison ligne à ligne ici puisque ce n'était pas la consigne, mais sa structure (barre latérale sombre) est celle que l'application suit réellement — voir la note méthodologique ci-dessous avant les constats de cohérence avec la maquette.

**54 images ouvertes : les 27 écrans listés dans `docs/captures/README.md`, chacun en 1280 px et en 390 px.** Deux passes, par lots de 5 à 7. Les quatre écrans refusés à la prise (`portail`, `terrain-intervention`, `intervention-detail`) n'existent pas en image et ne sont donc pas couverts — voir la dernière section.

### Note méthodologique — quelle maquette l'application suit

En une ligne : `CODIPLAN_Maquette.html` (référence assignée) dispose la navigation en bandeau horizontal, mais tous les écrans authentifiés de l'application suivent la barre latérale sombre de l'autre fichier du dossier, `codiplan-maquette-complete.html` — ce n'est donc pas traité comme un écart à chaque écran (ce serait trivial et répété 23 fois), sauf mention explicite. En revanche, sur ce que la référence assignée fixe malgré tout, la fidélité est bonne : badges de statut et cartes KPI à liseré coloré reproduisent fidèlement `--rouge:#E30613 / --bleu:#0053A1 / --vert:#0F9D58 / --orange:#F0A202` et les classes `.kpi::before`, `.b-ok`, `.b-att`, `.b-cours`, `.b-plan` de `CODIPLAN_Maquette.html`.

## Synthèse

| Gravité | Nombre | Constats |
|---|---|---|
| Bloquant | 2 | C1, C2 |
| Gênant | 6 | C3, C4, C5, C6, C7, C12 |
| Mineur | 4 | C8, C9, C10, C11 |

Les trois plus graves : C1 (barre latérale qui ne se réduit jamais à 390 px, texte réduit à un mot par ligne sur des pages qui atteignent 4300 px de haut), C2 (tous les tableaux de données perdent toutes leurs colonnes sauf la première à 390 px, sans aucun signe qu'il en manque), C3 (l'app technicien terrain a un habillage entièrement différent du reste, sans lien visuel).

---

## Hiérarchie visuelle et densité

### C1 — La barre latérale ne se réduit jamais à 390 px

- **Gravité** : bloquant
- **Capture** : `absences--clair--390`, `arrivee--clair--390`, `arrivee-sans-societe--clair--390`, `client-creation--clair--390`, `client-detail--clair--390`, `clients--clair--390`, `imports--clair--390`, `imports-rapport--clair--390`, `intervention-creation--clair--390`, `parametres--clair--390`, `parametres-agences--clair--390`, `parametres-forfaits--clair--390`, `parametres-prestations--clair--390`, `parametres-trajets--clair--390`, `parc--clair--390`, `planning--clair--390`, `planning-jour--clair--390`, `sites--clair--390`, `vgp--clair--390`, `vgp-a-determiner--clair--390` — soit tous les écrans authentifiés du back-office, sans exception.
- **Ce qui se passe** : sur les 390 écrans, la barre latérale sombre garde sa largeur de bureau — **272 px exactement**, valeur lue dans `codiplan-maquette-complete.html:12` (`grid-template-columns:272px minmax(0,1fr)`), que l'application suit à l'identique. **Correction après relecture croisée avec les audits navigation et mobile, mesure prise par métadonnées de fichier (dimensions PNG exactes, pas une estimation à l'œil) :** le fichier `arrivee--clair--390.png` fait réellement 573×1132 px, pas 462×4328 comme cité par erreur dans les deux autres rapports — cette dimension (462×4328) est celle de `planning--clair--390.png`, le vrai détenteur du record de hauteur. Ma propre première version attribuait aussi une hauteur erronée (« environ 4300 px ») à `parametres-prestations--clair--390`, qui ne fait en réalité que 565×2056 ; `parametres--clair--390` fait 431×3465 (proche de mon estimation initiale de 3500, donc correcte). Autre fait mesuré à cette occasion, qui n'est dans aucun des trois rapports initiaux : plusieurs pages ne se contentent pas de compresser leur contenu dans les 390 px du viewport déclaré, elles **débordent physiquement** au-delà — `arrivee--clair--390.png` fait 573 px de large, `parc--clair--390.png` 548 px, `parametres-agences--clair--390.png` 1093 px, `parametres-trajets--clair--390.png` 1009 px. Sur les deux derniers, l'espace au-delà de la colonne sidebar+première-colonne est un simple fond vide (vérifié à l'image) : les colonnes manquantes ne sont donc pas décalées hors champ, elles sont réellement absentes de la mise en page, pas seulement hors du cadre 390 px — ce point répond à une question laissée ouverte par les deux autres rapports. Team-lead a généralisé cette mesure aux 54 images : **19 des 27 écrans débordent au-delà de 390 px, aucun ne déborde à 1280 px** — donc le débordement n'est pas propre à la barre latérale seule, le contenu de chaque écran y contribue aussi. Fait notable : `imports-rapport--clair--390` est authentifié, back-office, et pourtant fait exactement 390 px — preuve qu'un écran authentifié peut respecter le viewport, ce qui rend d'autant moins excusable que les 19 autres ne le fassent pas.
- **Pourquoi c'est un problème** : un titre ou une phrase découpés en colonnes d'un mot ne se lisent plus comme une phrase — l'œil doit reconstruire le sens ligne par ligne au lieu de le saisir d'un balayage. Sur un téléphone, faire défiler plusieurs écrans de hauteur pour lire un paragraphe qui tenait en trois lignes sur bureau rend le contenu explicatif — déjà volontairement dense dans cette application — pratiquement inutilisable.
- **Recommandation** : replier la barre latérale en menu masqué (bouton hamburger) sous un seuil de largeur, comme le prévoit d'ailleurs `codiplan-maquette-complete.html` (`.menu-btn`, règle `@media(max-width:900px)`). Plus d'une journée : c'est un changement de comportement responsive transverse à toutes les pages authentifiées, pas une retouche locale.
- **Réserve signalée par l'audit mobile, reprise ici sans la vérifier moi-même** : le commit `96dc74a` (« COQUE-375 — le back-office et le portail tiennent sur un téléphone »), postérieur au commit photographié par les captures, décrit précisément ce défaut de colonne latérale fixe et un correctif (bandeau mobile + tiroir hors-écran sous 901 px). Ce constat bloquant est donc peut-être déjà réparé sur `HEAD` ; seule une nouvelle prise de vue peut le confirmer, et personne ne peut dire ici si le résultat est satisfaisant. Le constat reste inscrit tel quel, avec cette réserve.

### C2 — Les tableaux perdent toutes leurs colonnes sauf la première à 390 px

- **Gravité** : bloquant
- **Capture** : `parametres-agences--clair--390`, `parametres-trajets--clair--390`, `parc--clair--390`, `sites--clair--390`, `vgp--clair--390`, `clients--clair--390`, `client-detail--clair--390` — sept écrans. **Correction après relecture croisée : `clients` et `client-detail` sont bien pleinement concernés**, pas « partiellement » comme ma première version le disait — revérifié à l'image, leurs tableaux (liste des clients, « Lieux d'intervention », « Dernières interventions ») montrent le même repli à une seule colonne que les cinq autres. L'audit mobile avait ce compte juste (sept écrans) depuis le départ.
- **Ce qui se passe** : dans la zone de contenu réduite par C1, les tableaux (`<table>`) n'affichent que leur première colonne — le nom de l'agence, la zone, la référence machine, le libellé du site, l'identifiant de la machine VGP. Les autres colonnes (horaires, créneaux, statut, client, trajet, dernière information...) ne sont pas visibles, et chaque ligne du tableau laisse un grand espace blanc vide sous l'unique valeur affichée, sans barre de défilement visible ni mention du nombre de colonnes masquées.
- **Pourquoi c'est un problème** : sur `parametres-agences--clair--390` par exemple, on voit qu'il existe une agence « Dolbeau », mais plus aucune information sur ses horaires d'ouverture — la seule donnée que cet écran existe pour montrer. La personne qui consulte l'écran sur téléphone ne peut pas deviner qu'une information existe et reste hors champ : rien ne ressemble à une troncature, l'écran a simplement l'air d'un tableau à une seule colonne avec beaucoup d'espace perdu.
- **Recommandation** : au moins un indice visuel de défilement horizontal (ombre de bord, barre visible) sur ces tableaux en dessous d'un certain seuil de largeur, ou une bascule vers un rendu en cartes empilées comme celui déjà utilisé pour les cartes KPI. Plus d'une journée si on vise une refonte en cartes pour chaque tableau du produit ; une demi-journée si on se limite à rendre visible le défilement horizontal existant.

### C12 — Sur deux écrans, la page déborde de 600 à 700 px sur du vide, pendant que les colonnes ont disparu

- **Gravité** : gênant
- **Capture** : `parametres-agences--clair--390` (1093 px de large mesurés, soit 703 px au-delà du viewport de 390 px), `parametres-trajets--clair--390` (1009 px, soit 619 px au-delà)
- **Ce qui se passe** : sur ces deux écrans, la page rendue est physiquement plus large que le viewport de 390 px déclaré, mais tout ce qui dépasse la colonne barre latérale + première colonne du tableau (décrite en C2) est un fond uni sans aucun élément — ni texte, ni bordure, ni les colonnes « Jours travaillés », « Horaires », « Créneaux » (parametres-agences) ou « Valeur de référence », « Régler » (parametres-trajets) qu'on retrouve à 1280 px.
- **Pourquoi c'est un problème** : c'est un défaut distinct de la perte de colonnes elle-même (C2). Une personne qui, sur son téléphone, ferait défiler la page horizontalement en espérant y retrouver les colonnes manquantes tomberait sur 600 à 700 px de vide avant de comprendre qu'il n'y a rien à trouver — le geste normal pour compenser une troncature (glisser latéralement) est ici puni d'un défilement inutile plutôt que récompensé par le contenu attendu.
- **Recommandation** : contenir la largeur de la page à celle du viewport (le débordement ressemble à une largeur minimale du tableau qui fuit dans la mise en page générale plutôt qu'à un choix voulu). Plus facile à corriger que C2 : il s'agit probablement d'une seule propriété de contenant (`overflow-x`, largeur minimale d'un tableau non contraint) plutôt que d'une refonte de composant — vraisemblablement moins d'une journée, mais ne remplace pas la correction de C2, qui reste nécessaire pour rendre les colonnes disparues à nouveau accessibles.

### C9 — La vue « Jour » du planning perd l'heure affichée dans le bloc

- **Gravité** : mineur
- **Capture** : `planning-jour--clair--1280`
- **Ce qui se passe** : dans la vue Semaine, chaque bloc d'intervention porte son heure en tête (« 08:00 Garage Boulari »). Dans la vue Jour, le bloc « Local-000014 / Atelier Ducos » ne porte plus d'heure : il faut le mettre en relation avec l'axe des heures à gauche pour connaître son horaire.
- **Pourquoi c'est un problème** : un survol rapide de la colonne ne donne plus l'heure sans revenir croiser la ligne du tableau — supposition à vérifier sur la version réelle interactive, où un survol pourrait compenser ; l'image seule ne montre que l'état statique.
- **Recommandation** : reporter l'heure de début dans le bloc, comme en vue Semaine. Moins d'une journée.

### C11 — L'écran d'accueil n'a presque aucun contenu

- **Gravité** : mineur
- **Capture** : `accueil--clair--1280`, `accueil--clair--390`
- **Ce qui se passe** : titre, une phrase de sous-titre, une phrase d'état (« Socle technique en place. Aucune fonctionnalité métier. ») et un bouton « Consulter la documentation » — le reste de l'écran, à peu près 80 % de la hauteur visible à 1280 px, est vide.
- **Pourquoi c'est un problème** : en soi limité, puisque l'écran assume explicitement son état de chantier. Mais c'est le premier écran vu par une personne non connectée, sans aucun autre repère (pas de lien de connexion visible sur cette capture).
- **Recommandation** : à réévaluer une fois le contenu métier de la page d'accueil arrêté — pas d'action de lisibilité isolée à proposer tant que le contenu cible n'est pas connu.

---

## Contrastes

### C4 — La dernière colonne du registre VGP est coupée à 1280 px

- **Gravité** : gênant
- **Capture** : `vgp--clair--1280`
- **Ce qui se passe** : la colonne « Dernière information » est tronquée par le bord droit du cadre à plusieurs lignes : « Information reçue — 18/07/2... » sur les lignes `NUS-SPL-2022-0007` et `RAV-KPX-2019-0148`, et une phrase plus longue coupée en milieu de mot sur la ligne `SN-INCONNU-PONT-2`. Rien dans l'image n'indique qu'un défilement horizontal permettrait de lire la suite.
- **Pourquoi c'est un problème** : la date complète de réception d'une information de vérification périodique — donnée réglementaire — n'est pas lisible en entier sur un poste de travail standard à 1280 px, sans qu'aucun signe n'alerte qu'elle est incomplète.
- **Recommandation** : réduire la largeur de la colonne « Dernière information » ou permettre le retour à la ligne au lieu de la troncature silencieuse. Moins d'une journée.

### C5 — Chevauchement de texte entre deux colonnes du tableau des temps de trajet

- **Gravité** : gênant
- **Capture** : `parametres-trajets--clair--1280`
- **Ce qui se passe** : sur la ligne « Îles », la phrase « Déplacement par avion — estimation impossible, à saisir par intervention. » apparaît dans la colonne « Ce qui s'applique », puis se répète, coupée en plein mot (« impossibl… e à saisir… »), dans la colonne « Régler » qui normalement porte un champ de saisie et un bouton.
- **Pourquoi c'est un problème** : à première vue, cela ressemble à un texte dupliqué et tronqué par erreur plutôt qu'à un remplacement volontaire du contrôle de saisie par une explication — la lecture est confuse exactement sur la ligne qui a le plus besoin d'être comprise sans ambiguïté (celle où le réglage habituel est impossible).
- **Recommandation** : traiter explicitement ce cas (fond distinct, texte centré sur toute la largeur de la cellule « Régler » au lieu d'un débordement) pour qu'il se lise comme une explication et non comme un artefact. Moins d'une journée.

---

## Libellés

### C7 — Des segments de phrase colorés comme des liens, sans l'être

- **Gravité** : gênant
- **Capture** : `absences--clair--1280`, `client-creation--clair--1280`, `clients--clair--1280`, `imports--clair--1280`, `parametres-forfaits--clair--1280`, `parametres-prestations--clair--1280`, `parametres-trajets--clair--1280`, `parametres-agences--clair--1280` (le même motif reparaît sur les versions 390 des mêmes écrans).
- **Ce qui se passe** : dans les paragraphes explicatifs qui accompagnent presque chaque écran, certains segments de phrase sont colorés dans le même bleu que les vrais liens (« ← Tous les clients », « Ouvrir »), par exemple « un import ne saura pas la rapprocher et créera un doublon » sur `client-creation`, ou « change le taux d'occupation de cette semaine-là » sur `absences`. Rien à l'image ne montre s'il s'agit d'un lien ou d'une simple mise en emphase.
- **Pourquoi c'est un problème** : la couleur bleue est par ailleurs le seul signal de « ceci est cliquable » utilisé dans l'application (liens de retour, boutons « Ouvrir », libellés de machine). L'employer aussi pour de la simple emphase dans un paragraphe dilue ce signal : une personne qui a appris que le bleu veut dire « cliquable » essaiera de cliquer sur du texte qui ne fait rien, ou au contraire ignorera un vrai lien noyé dans des phrases où le bleu ne veut déjà plus rien dire.
- **Recommandation** : réserver la couleur de lien aux éléments réellement cliquables, et employer un autre moyen (gras, guillemets) pour l'emphase dans les paragraphes explicatifs. Plus d'une journée si le motif est aussi répandu dans le code qu'il l'est dans les captures — c'est un remplacement systématique, pas une retouche ponctuelle.

### C8 — L'état « aucune société active » n'est visible dans aucune capture

- **Gravité** : mineur
- **Capture** : `arrivee-sans-societe--clair--1280` / `arrivee--clair--1280` (identiques), et leurs versions `--390`
- **Ce qui se passe** : `docs/captures/README.md` annonce que `arrivee-sans-societe` montre « le sélecteur, et aucune société active ». L'image porte ce nom montre pourtant exactement le même contenu que `arrivee` : une société déjà active, mise en évidence en bleu, avec l'étiquette « Société active ».
- **Pourquoi c'est un problème** : supposition à vérifier — il est possible que ce compte de démonstration n'ait jamais qu'une seule société, auquel cas l'état visuel « aucune société active » n'existe simplement pas dans ce scénario de capture, sans que ce soit un défaut d'écran. Mais tel quel, l'angle lisibilité ne peut rien dire de la clarté de cet état particulier, faute d'image qui le montre.
- **Recommandation** : si l'état existe réellement dans l'application, refaire cette capture avec un compte habilité sur plusieurs sociétés sans société encore choisie, pour qu'elle puisse être auditée. Hors du périmètre de ce rapport de trancher si c'est un problème d'image ou de scénario.

### C10 — Deux façons de signaler une donnée manquante dans la même colonne

- **Gravité** : mineur
- **Capture** : `parc--clair--1280`
- **Ce qui se passe** : dans la colonne « N° de série » du tableau du parc, la plupart des lignes vides affichent un tiret « — », mais une ligne (`Local-000002`) affiche à la place une pastille orange « À compléter ».
- **Pourquoi c'est un problème** : supposition à vérifier — les deux pourraient recouvrir des états réellement différents (un tiret pour une donnée qui restera absente, la pastille pour une fiche officiellement signalée comme à finir), mais rien dans l'écran n'explique la différence à qui le découvre.
- **Recommandation** : une légende courte ou une info-bulle distinguant les deux, si la distinction est intentionnelle. Moins d'une journée.

---

## Cohérence entre écrans

### C3 — L'app technicien terrain a un habillage entièrement différent

- **Gravité** : gênant
- **Capture** : `terrain--clair--1280`, `terrain--clair--390` (à comparer à n'importe quel autre écran authentifié)
- **Ce qui se passe** : tous les écrans de back-office partagent une barre latérale sombre, le mot-symbole « CODIPLAN » en blanc sur fond marine avec le sous-titre « SAV ». L'écran `terrain` (« Ma journée », vu par un technicien) affiche à la place une barre horizontale blanche en haut de page, le mot-symbole « CODIPLAN » en noir et bleu sur fond blanc, un bouton pilule bleu nommant la société, et aucune navigation latérale.
- **Pourquoi c'est un problème** : une même personne peut avoir accès aux deux (un technicien peut aussi être amené à consulter le back-office, ou inversement) et retrouve deux langages visuels de marque différents sans transition ni indice qu'il s'agit du même produit. Cela peut être un choix assumé (application terrain distincte, pensée pour le mobile hors-ligne selon l'invariant I4) mais rien à l'écran ne le signale comme tel — l'écart se lit comme une incohérence plutôt que comme une distinction voulue.
- **Recommandation** : si la séparation est un choix produit délibéré, l'affirmer visuellement (même palette de marque a minima, même traitement du logo) plutôt que de laisser deux chartes distinctes coexister sans lien. Plus d'une journée si cela touche l'habillage complet de l'app terrain.
- **Précision après relecture croisée** : l'audit mobile cite `terrain` comme la preuve qu'un motif d'écran étroit existe déjà et propose de l'étendre au back-office pour corriger C1 — je ne le contredis pas : sa **structure** (pas de colonne latérale permanente) est un bon modèle responsive. Ce constat-ci porte sur un point différent, propre à mon angle : c'est l'**habillage** de cette structure (couleurs, rendu du logo) qui n'est pas repris du reste du produit. Les deux peuvent se corriger ensemble : reprendre le motif structurel de `terrain` pour C1, avec la palette et le logo du back-office plutôt que ceux, actuellement distincts, de `terrain`.

### C6 — Deux légendes différentes pour l'occupation selon la vue du planning

- **Gravité** : gênant
- **Capture** : `planning--clair--1280` (vue Semaine) contre `planning-jour--clair--1280` (vue Jour)
- **Ce qui se passe** : la vue Semaine porte en bas du tableau une légende de six pastilles de couleur nommées (Planifiée, En cours/P1, Terminée, Suspendue/absence, Atelier/interne, Jour non ouvert). La vue Jour, à un clic de la première par l'onglet « Semaine/Jour » en haut de la même page, porte à la place trois cases à cocher (Occupé, Libre, Hors ouverture) qui filtrent l'affichage plutôt que d'en expliquer les couleurs.
- **Pourquoi c'est un problème** : ce sont deux vues du même planning, accessibles par le même sélecteur, mais elles n'expliquent pas la même chose de la même façon — une personne qui vient d'apprendre le code couleur en vue Semaine doit en réapprendre un autre en passant en vue Jour.
- **Recommandation** : aligner le vocabulaire et, si possible, la forme des deux légendes. Moins d'une journée.

---

## Ce que les captures ne permettent pas de trancher

- **Le thème sombre n'est pas capturé du tout, et c'est délibéré.** `docs/captures/README.md:107` : la consigne de double capture (clair/sombre) est retirée jusqu'au jour où `lib/theme/apparence.ts` déclarera une seconde apparence — aucun contraste en thème sombre n'est donc auditable aujourd'hui, sans que ce soit un défaut de la prise de vue.
- **`intervention-detail`, `portail` et `terrain-intervention` n'ont aucune capture** (refusées à la prise, pour des raisons documentées et légitimes de données de démonstration). Aucun constat de lisibilité n'est possible sur ces trois écrans.
- **États de survol, de focus et de chargement** : aucune image ne montre un champ en focus, un bouton survolé, ni un indicateur de chargement — impossible de juger la lisibilité de ces états.
- **États d'erreur** : aucune capture ne montre un formulaire après une validation refusée (champ en erreur, message associé) — tous les formulaires sont vus vides et jamais soumis.
- **Textes longs réels** : les données de démonstration sont courtes (peu de clients, peu de machines). Rien ne montre comment le rendu se comporte avec une raison sociale très longue, un grand nombre de blocages d'agenda, ou un tableau de plusieurs centaines de lignes — en particulier pertinent après le constat C2, puisqu'un plus grand volume de données pourrait aggraver ou révéler différemment le problème de tableaux à 390 px.
- **Tableaux à gros volume** : le parc de démonstration ne compte que 8 machines, le référentiel client que 3 fiches — aucune image ne montre la pagination, le défilement ou la densité d'un tableau à l'échelle réelle annoncée par le tableau de bord de la maquette (1 847 machines, 268 clients).
