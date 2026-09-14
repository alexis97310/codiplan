# L'écran client : deux chemins, et la barre ne bouge pas

*14 septembre 2026. Arbitrage rendu par l'exploitation, inscrit ici parce qu'il
pose une règle générale au-delà de l'écran qui l'a fait naître.*

## Contexte

`L1-01` — « Clients : CRUD, recherche » — était marqué `LIVRÉ` depuis le
08/09/2026 : la table `client`, sa politique de forme « parc », la saisie Zod et
les six fonctions du dépôt existaient. **Et aucun humain ne pouvait atteindre un
client** : zéro route, zéro écran, un seul appelant dans tout le dépôt —
`rechercherClients`, depuis le sélecteur de l'écran de création d'un site. C'est
ce cas qui a fait amender le critère de la file de nuit (`R3-12`) : *un module
qui existe prouve qu'une COUCHE a été écrite ; il ne prouve pas qu'un humain
l'atteigne.*

La question restée ouverte n'était pas de savoir s'il fallait un écran, mais
**par où l'on y entre**. Et elle butait sur une contrainte qui n'est pas
négociable : la barre de navigation est une **liste close de onze entrées**,
confrontée à `docs/maquette/CODIPLAN_Maquette.html` libellés et ordre compris
(D95). *Une douzième entrée la ferait rougir — à raison.*

## Options écartées

**Ouvrir une douzième entrée dans la barre.** C'était le réflexe, et il est
refusé : la maquette fait foi sur la disposition, et l'écart se mesurerait
contre elle. *Un gardien qu'on assouplit pour faire passer son propre ticket
cesse d'être un gardien.*

**N'ouvrir la fiche que depuis le parc et les sites.** Neuf fois sur dix, c'est
le chemin réel — on arrive à un client en partant d'une machine ou d'un lieu
qu'on regardait déjà. Mais **on ne peut pas créer un client depuis une machine
qui n'existe pas encore** : ce chemin-là, seul, ferme la porte au premier geste
de toute mise en service.

**N'ouvrir que la liste.** Elle suffirait à tout faire, et elle ferait faire
trois clics de plus neuf fois sur dix, pour revenir à un client qu'on avait déjà
sous les yeux.

## Décision

**Deux chemins, et ils ne font pas double emploi.**

1. **La LISTE** se rejoint depuis « Sociétés & tarifs », en cinquième carte à
   côté des lieux d'intervention. C'est de là que part la **création**.
2. **La FICHE** se rejoint aussi depuis les colonnes « Client » du parc et des
   sites, devenues des liens.

La raison est **un fait d'usage, pas une symétrie** : le second chemin sert le
cas courant, le premier sert le cas que le second ne peut pas servir.

**La règle générale que cela pose**, et c'est pour elle que ce document existe :
*la barre reste close à onze entrées, et un écran nouveau se rejoint par un
lien* — comme `/sites` depuis le lieu d'une intervention, comme `/clients`
depuis la section de paramétrage. Une porte de section n'est pas une entrée de
barre. Le gardien d'atteignabilité (`scripts/lib/atteignabilite-ecrans.ts`)
mesure qu'un chemin existe ; il annonce lui-même qu'il ne mesure pas qu'il soit
*trouvable*, et c'est ce jugement-là qui reste à l'arbitrage.

## Conséquences

**La maquette est muette sur cet écran, et l'écart s'écrit avec sa mesure.** D95
lui donne autorité sur la disposition et les couleurs — *pour ce qu'elle
montre*. Mesuré le 14/09/2026 : `grep -i client` sur le fichier rend trente
occurrences, **toutes des colonnes « Client » d'autres écrans** — planning, parc,
contrats, imports — et pas une liste ni une fiche. La disposition suivie est
donc celle des écrans voisins qu'elle gouverne.

**Un seul compteur survit sur quatre.** Celui des fiches sans code de
rapprochement, parce qu'il nomme un geste : ces fiches-là, un import ne saura pas
les reconnaître et les recréera (RG-IMP-05). Les trois autres — total, actifs,
inactifs — se lisent dans le tableau, coûtent chacun une requête, et *un
compteur qu'on regarde sans jamais agir dessus apprend à ne plus lire les
compteurs*. Son titre se compose depuis `societe.libelle_code_externe` (D29) et
n'écrit le mot « Winpro » nulle part.

**Le bloc « Contacts » nomme sa propre absence.** `contact` existe depuis L1-03
et aucun écran ne permet d'en saisir un. Le bloc n'affiche **ni un zéro ni un
blanc** — les deux se liraient comme des mesures —, mais *« aucun écran ne le
sert encore »*. C'est la distinction de D88, et la règle que le portail applique
déjà à ses emplacements tenus et dits vides.

**Aucune suppression n'est proposée.** `supprimerClient` existe et échouerait
presque toujours : tout ce qui référence la fiche la retient. *Proposer un bouton
qui échoue huit fois sur dix est pire que de ne pas le proposer.* Le geste réel
est de rendre la fiche inactive — et il se choisit dans une liste à **deux
valeurs explicites**, jamais dans une case à cocher : une case décochée est
absente du formulaire, une absence se lit « ne touche pas à cette colonne », et
la désactivation n'aurait jamais lieu **pendant que l'écran afficherait
"enregistré"**.

## Condition de réouverture

*Le jour où la maquette montrera un écran client*, elle fait foi sur sa
disposition et ce document s'efface devant elle. *Le jour où un arbitrage
ouvrira la barre à une douzième entrée*, la règle générale ci-dessus se relit —
elle n'interdit pas d'y ajouter une entrée, elle dit qu'on ne le fait pas en
passant, dans le ticket qui en aurait besoin.
