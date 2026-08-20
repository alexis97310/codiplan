# Second facteur sur `admin_societe` : une contrainte qui n'est plus la nôtre

*Ticket L0-06b. Arbitrage D40, prolongeant D37. Règle de gestion RG-DRO-05.
Invariant I1.*

## Contexte

D37 a créé `admin_societe`, dixième rôle, pour qu'un client puisse ouvrir les
comptes de ses collègues sans passer par l'éditeur. Elle n'a rien dit de son
second facteur, et la liste de L0-06 — `admin_plateforme`, `direction` — est
restée fermée : l'étendre de sa propre initiative aurait été inventer une règle
de sécurité, ce que le §8 du CLAUDE.md interdit.

Le point revient par la porte du risque. `admin_societe` administre les
**comptes** et les **habilitations** de sa société. Compromettre ce seul compte
ne donne pas accès à des données : il donne le droit de **s'en fabriquer**. On
crée un compte, on lui pose l'habilitation qu'on veut, sous le rôle qu'on veut —
`direction` comprise —, et l'on entre par la porte principale. La trace laissée
est une ligne d'administration d'apparence banale, au milieu de celles que ce
rôle produit tous les jours. C'est, chez un client, le compte dont la
compromission coûte le plus cher.

D40 tranche : la liste devient `admin_plateforme`, `admin_societe`, `direction`.

## Ce que D37 n'avait pas vu

**La contrainte change de nature en changeant de rôle**, et c'est le vrai objet
de cette note.

Sur `admin_plateforme` et `direction`, le second facteur est **notre** exigence,
imposée à **nos propres salariés**. Elle se décide en interne, s'applique le jour
où on la décide, et son coût — expliquer, accompagner, débloquer — se paie entre
collègues.

Sur `admin_societe`, elle est imposée à **l'utilisateur d'un client payant**, qui
ne l'a pas choisie. Concrètement : quelqu'un vient d'acheter CODIPLAN, se
connecte pour la première fois pour créer les comptes de son équipe, et découvre
à cet instant qu'il lui faut installer une application d'authentification sur un
téléphone qu'il n'a peut-être pas sous la main. Une exigence de sécurité juste,
révélée au pire moment, se vit comme un défaut du produit.

C'est pourquoi D40 en fait une **règle produit et pas seulement une règle
technique**. `RG-DRO-05` (chapitre 10) l'écrit : le second facteur est obligatoire
sur ces trois rôles, et **pour `admin_societe` il est annoncé à l'ouverture de
toute nouvelle société, avant que le premier compte ne soit créé**. Aucune
société n'est ouverte sans que son administrateur ait été averti.

Le chapitre 10 est le bon endroit, et le seul : une règle métier ne s'écrit
qu'une fois (D1). `lib/auth/roles.ts` la tient côté code, la matrice §5.2 y
renvoie, et cette note dit pourquoi elle existe.

## Options écartées

**Laisser `admin_societe` hors de la liste, comme D37.** C'était le statu quo, et
il tenait tant que le rôle n'existait pas. Il ne tient plus : le seul rôle
capable d'ouvrir des comptes chez un client serait aussi le seul rôle sensible
sans second facteur. Écarté.

**Rendre le second facteur optionnel, activable par le client.** La demi-mesure
commerciale : on l'annonce, on le recommande, on laisse choisir. Elle déplace la
responsabilité sur celui qui a le moins d'éléments pour décider, et l'expérience
dit ce qu'il choisira sous la pression du démarrage. Écartée — mais elle éclaire
la vraie contrepartie, ci-dessous.

**Imposer le second facteur à tous les rôles.** Défendable, et sans doute juste à
terme. Écartée ici parce qu'elle dépasse D40 : imposer une application
d'authentification à un technicien qui travaille hors réseau (I4) est une
décision de produit à part entière, pas un corollaire de celle-ci.

## Conséquences

**Un scénario de plus, et une règle plutôt qu'une liste.** `roles.test.ts`
vérifie désormais que **tout rôle capable d'`administrer_utilisateurs` exige un
second facteur** — la règle derrière la liste, et non la liste elle-même. Un
futur rôle qui saurait ouvrir des comptes sans second facteur fera tomber ce
scénario avant d'exister. Côté base, `bascule-societe.test.ts` éprouve
`admin_societe` refusé sans second facteur et accepté avec, sous le rôle
applicatif réel.

**Une contrainte sans porte de sortie se fait contourner.** Un administrateur de
société qui perd son téléphone perd l'accès à l'administration de sa société — et
personne chez lui ne peut le lui rendre, puisqu'il est le seul à pouvoir
administrer les comptes. Sans procédure, cela se réglera par un appel au support,
puis par un second compte `admin_societe` créé « au cas où », c'est-à-dire par le
contournement de la mesure. Le **lot 7** livrera donc une procédure de déblocage,
exécutable par `admin_plateforme` seul et journalisée dans `journal_acces` — la
seule table qui puisse la porter, puisqu'elle enjambe les sociétés par
construction (D34). Elle est inscrite au backlog et **n'est pas construite
maintenant**.

**Le mécanisme, lui, existe déjà.** Rien n'est à écrire côté exécution : Better
Auth n'ouvre pas de session sur le seul mot de passe quand le second facteur est
actif sur le compte, et `motifRefusContexte` refuse d'ouvrir la moindre
transaction cloisonnée pour un rôle qui l'exige si la session ne le porte pas —
ce qui couvre le cas d'un `admin_societe` qui ne l'aurait pas encore activé. D40
n'ajoute qu'une valeur à une liste ; c'est la double tenue héritée de L0-06 qui
la rend effective.
