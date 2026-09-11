# Registre — file de nuit du 11 septembre 2026

*Une entrée par unité de travail, écrite à chaud. La mesure d'abord, la prose
ensuite. Chaque unité est fusionnée avant que la suivante commence : un arrêt
faute de budget ne doit rien coûter.*

*Horloge du conteneur au départ : `2026-09-11 06:38 UTC` (`date -u`).*
*Point de départ : `main` = `a5c63f6`, arbre propre.*

---

## 0 — Les deux règles au protocole de session

`docs/protocole-session.md` gagne deux sections. Elles ne sont pas de moi : ce
sont deux consignes d'exploitation, chacune adossée à un coût de la journée.

**§11 — la porte de MAIN est `verify:full`, pas `verify`.** Un vert mesuré à un
endroit et annoncé pour un autre est un vert inventé. Le rapport nomme donc la
commande réellement jouée ; si la porte forte n'a pas pu tourner, il l'écrit
avec ce qui a empêché.

**§12 — le code se déploie seul, les données non.** Vercel reconstruit à chaque
fusion sur `main` ; rien ne reporte un semis ni une migration sur la base
hébergée. Tout travail touchant `prisma/seed.ts` ou `prisma/migrations/`
termine son compte rendu par un **geste nommé** — quel flux, quelle cible,
quelles cases —, dans une liste d'actions et non dans une note.

*Ce qu'aucun gardien ne tient, et qui est écrit dans les deux sections : un
compte rendu n'est pas un artefact du dépôt, rien ne peut le relire.*

Commit `3bdf1a0`.

---

## 1 — R2-16 : la barre de navigation ne coiffe plus les écrans sans session

**Ce qui était mesuré :** la barre était du chrome de mise en page RACINE, donc
elle s'affichait sur `/connexion`, `/premier-acces`, `/enrolement`, `/sante` et
`/` — onze entrées dont dix inertes au-dessus d'un formulaire de connexion,
avec une pastille d'identité vide par construction.

**Ce qui a été fait.** La barre est rendue par le SEGMENT. Trois groupes de
routes, et chaque page en habite exactement un :

| Groupe | Pages | Barre |
|---|---|---|
| `(sans-session)` | `/`, `/sante`, `/connexion`, `/connexion/code`, `/enrolement`, `/premier-acces` | non |
| `(back-office)` | `/arrivee`, `/planning*`, `/parametres/*` | oui |
| `(portail)` | `/portail` | oui |

*Ce qui décide n'est pas une liste de chemins, c'est le RÉPERTOIRE où le fichier
est écrit.* Une liste oublierait le prochain écran d'authentification ; un
répertoire se choisit au moment où l'on crée le fichier.

**Trois effets de bord, tous mesurés en chemin.**

1. La largeur utile était posée par la racine — une barre pleine largeur ne se
   rend pas dans un conteneur centré. Elle est passée dans
   `components/mise-en-page/largeur-utile.tsx`, rendu par les trois mises en
   page : une seule écriture des valeurs, comme avant.
2. Deux mises en page ont maintenant besoin d'une même session — la racine pour
   la charte, le segment pour la pastille — et une mise en page ne transmet
   rien à celles qu'elle englobe. `lib/navigation/chrome.ts` porte la lecture,
   mémoïsée par `cache()` de React : **une lecture par rendu**, comme avant.
3. Le gardien de « la mise en page racine ne lève jamais » regardait UN fichier.
   Il y a désormais quatre mises en page et trois lisent une session : sa
   population vient du répertoire `app/`. *C'est le §9 du 09/09 en acte — la
   garantie était énoncée pour un fichier, un second appelant l'aurait
   traversée sans la rencontrer.*

**Les gardiens, et leurs mises en échec sur des fautes RÉELLES.**

`tests/unit/app/barre-par-segment.test.ts` remonte, pour chaque `page.tsx` de
`app/`, la chaîne de ses mises en page — ce que Next empile à l'exécution — et
constate si l'une rend la barre.

| Faute réellement écrite puis retirée | Verdict |
|---|---|
| barre remise dans `app/layout.tsx` | rouge — 3 assertions, dont les 6 pages en écart nommées |
| `app/orpheline/page.tsx`, hors des trois groupes | rouge — la page est nommée |
| `(back-office)/layout.tsx` appelant `obtenirSession` | rouge sur le gardien de chrome |
| état sain | vert, 6 tests |

Et la **paire des deux directions** (§9, 11/09) : `/connexion` ne porte pas la
barre **et** `/arrivee` la porte. Sans la seconde moitié, une remontée de chaîne
qui rendrait toujours « pas de barre » passerait tout le reste.

`tests/e2e/barre-sans-session.spec.ts` regarde le HTML réellement servi par une
compilation de production, sur les cinq écrans. Il porte son témoin : le corps
a bien un `data-apparence`, sans quoi une 404 passerait pour une absence de
barre.

**Ce qui n'a PAS été fait, et pourquoi.** Le portail continue d'afficher les
onze entrées d'une barre de back-office. Ce n'est pas une fuite — aucune entrée
ne mène à une route servie —, mais cela touche **ce qu'un client voit**, donc
c'est un arbitrage d'Alexis (§1 du protocole). Porté en **R2-17**, marqué
`BLOQUÉ` avec trois issues chiffrées.

### 1 bis — ce que le témoin du scénario a trouvé, et qui n'était pas cherché

Le scénario Playwright de R2-16 porte un témoin : *le corps de la page a bien
un `data-apparence`*, sans quoi une page non servie passerait pour une page sans
barre. **Il a rougi sur deux écrans**, et ce n'était pas un défaut de R2-16.

*Mesuré le 11/09/2026 par `pnpm verify:full`, sur une compilation de
production : `/connexion` et `/enrolement` rendent **500** quand
`BETTER_AUTH_SECRET` est absent. `/`, `/sante` et `/premier-acces` passent.*
La trace du serveur le nomme : `BetterAuthError: You are using the default
secret`.

**C'est le TROISIÈME appelant du même incident.** Le 11/09,
`lib/auth/chrome.ts` a été écrit parce que la mise en page racine levait et
faisait rendre 500 à toutes les pages ; il y notait déjà la forme du défaut —
*« la garantie était énoncée pour le THÈME, et un second appelant a traversé
l'énoncé sans le rencontrer »*. La racine réparée, les PAGES lisaient toujours
la session par `etatArrivee`, qui lève.

**Réparation :** `etatArriveeOuAnonyme`, du même bois que `identiteDeChrome` —
toute impossibilité rend `anonyme`, c'est-à-dire « montre le formulaire ».
`etatArrivee` garde sa forme qui lève, et `/arrivee` continue de l'appeler :
c'est un écran d'APRÈS-session, où une impossibilité doit se voir.

**Le coût, nommé :** une personne déjà connectée dont la session devient
illisible revoit la page de connexion au lieu d'une erreur. Dégradation, jamais
un droit accordé — aucune donnée cloisonnée ne transite par `anonyme`.

**Le gardien tient la CLASSE et pas les deux fichiers** : sa population est
`app/(sans-session)/**/page.tsx`, dérivée du répertoire, et il refuse qu'un de
ces écrans nomme `obtenirSession` ou `etatArrivee`. Éprouvé en remettant
réellement `etatArrivee` dans la page de connexion : rouge, le fichier nommé.
Et la paire des deux directions : l'enveloppe rend `anonyme` sur une lecture qui
lève **et** ne travestit rien sur une lecture qui aboutit — sans la seconde
moitié, une enveloppe qui rendrait toujours `anonyme` passerait.

*Une page de connexion qui rend 500 quand la configuration manque est le pire
mode de défaillance du produit : personne ne peut même lire le formulaire pour
comprendre.*

---

## 2 — R2-18 : les scénarios de bout en bout ont enfin une base

**Mesuré avant de commencer :** `pnpm test:e2e` tournait **sans aucune base et
sans secret de session**. Trois scénarios y vivaient — l'accueil, le thème, le
gardien hors-ligne — et **aucun ne franchissait un écran authentifié** : le
premier `goto("/planning")` aurait été redirigé vers `/connexion`. *Tout ce qui
se passe APRÈS la connexion était donc hors de portée d'un scénario de bout en
bout, c'est-à-dire tout le produit.*

C'est le §9 du 08/09 un étage plus haut : *une suite qui éprouve tous les
maillons n'éprouve pas la chaîne.* Le dépôt s'était donné un appelant de la
chaîne de SESSION (`tests/isolation/chaine-session.test.ts`) ; il n'avait aucun
appelant de la chaîne ÉCRAN.

**Ce qui a été construit, et ce qu'il refuse.** `E2E_DATABASE_URL` pilote une
base locale **détruite et recréée à chaque exécution**. Trois refus
garantissent qu'elle n'est jamais l'hébergée : une URL Neon, une URL identique à
`DATABASE_URL`, et **l'absence de la variable** — celui-là est le refus qu'on
oublie, il empêche le serveur de test de retomber en silence sur la base de
développement de qui l'exécute.

**Tout passe par le chemin de production** : `prisma migrate deploy` — la
commande de mise en ligne, donc éprouvée ici comme là-bas —, puis le semis.
Aucune table fabriquée pour le test, aucune politique posée à la main. Le
serveur voit la base sous le rôle **applicatif restreint**, jamais sous le
propriétaire : *un scénario joué sous le propriétaire ne mesurerait rien du
cloisonnement, il verrait tout.*

**Le mot de passe ne s'écrit pas en base.** Le semis n'en attribue aucun — règle
du dépôt, pas oubli. Le harnais réémet un jeton de premier accès (D65,
complément du 10/09) puis le consomme par la même fonction que le formulaire.
*Un harnais qui écrirait une empreinte en base éprouverait un chemin qui
n'existe pas.*

**Le secret de session est tiré au sort à chaque exécution** et passé par
l'environnement : jamais dans le dépôt, jamais dans un fichier (I9).

**La scène est écrite exprès, jamais devinée du semis.** Le semis répartit ses
seize interventions par `sitesEcrits[index % sitesEcrits.length]` : un scénario
qui viserait « l'intervention du mardi de Guérin » dépendrait du NOMBRE de sites
de démonstration, qu'un ticket peut changer sans savoir qu'il casse une épreuve.
*Une épreuve dont la cible se déplace au prochain ticket est une alarme qui
apprendra à ne plus être lue* (§9, 11/09).

---

## 3 — R2-19 : le glisser-déposer du planning

**Ce n'était pas un choix, c'était un manquement.** La maquette le prescrit
depuis le premier jour — « Glisser-déposer pour réaffecter », `cursor: grab` sur
`.ev` — et D95 en fait une source qui fait foi.

**Les quatre scénarios Playwright ont été écrits AVANT l'implémentation**, comme
la consigne le demande. Écrits après, ils auraient décrit le code au lieu de le
contraindre.

### Ce qui a été construit

| | |
|---|---|
| vue semaine | le dépôt change de **technicien** et de **jour** |
| vue jour | le dépôt change de **technicien** et d'**heure de début** ; la durée est conservée |
| file d'attente | le glissé vers un technicien vaut **AFFECTATION** — l'usage principal |
| voie sans souris | le formulaire « Déplacer » de la fiche : même route, même décision |

### Les deux refus sont CÔTÉ SERVEUR

Dans le dépôt cloisonné, et pas seulement à l'écran : *une action refusée à
l'écran mais acceptée par la base est un trou.* Les règles vivent dans
`lib/interventions/pose.ts`, qui ne lit rien et ne connaît aucune société.

1. **Hors du calendrier de l'agence VISÉE** — celle de l'intervention, déduite
   du site et inchangée par le déplacement. *L'union affichée en vue semaine est
   un repère, jamais un droit de poser*, et `grille.ts` l'avait écrit avant que
   le contrôle existe. Une agence **sans calendrier** refuse aussi : « inconnu »
   n'est pas « ouvert » (I7).
2. **Chevauchement d'une autre intervention du même technicien.** Deux créneaux
   qui se TOUCHENT ne se chevauchent pas — 08:00–10:00 puis 10:00–11:00
   s'enchaînent, et refuser cela rendrait une journée impossible à remplir. Une
   intervention **annulée** n'occupe plus rien ; une **clôturée**, si — elle a eu
   lieu, et poser par-dessus écrirait une journée de 26 heures.

### Trois décisions qui ne se voient pas dans le résultat

**Le bloc ne revient pas à sa place : il n'en part jamais.** L'écran n'anticipe
rien et se relit du serveur quand la base a accepté. *La façon la plus sûre de ne
jamais montrer un état que la base n'a pas accepté est de ne jamais l'anticiper*
— il n'y a alors aucun chemin de code qui puisse laisser l'écran en avance.

**L'heure voyage en MINUTES LOCALES, jamais en instant.** L'instant demande le
fuseau de l'agence, que ni un formulaire ni un navigateur ne connaissent. Le
dépôt le résout **une seule fois**, et ce que les contrôles ont jugé est
exactement ce qui est écrit — pas un second calcul au moment de l'écriture.

**Une seule route, deux formes de réponse.** Le formulaire attend une
redirection, le glissé une réponse lisible sans quitter l'écran ; les deux
passent par le même appel. *Une seconde route aurait été une seconde lecture
d'un même critère, et celle sans formulaire pour la rappeler à l'ordre aurait
dérivé la première.*

**Aucune dépendance ajoutée.** Le glisser-déposer natif fait ce que la maquette
décrit. Schedule-X vient au lot 3 avec le redimensionnement, qui lui n'est pas
natif.

### Quatre mesures qui ont coûté, et qui sont écrites dans le code

1. **`locator.dragTo` n'engage RIEN.** Mesuré, trois façons de glisser le même
   bloc sur la même case dans la même exécution : `dragTo` → **0 requête** ;
   souris réelle avec mouvements intermédiaires → **1** ; `dispatchEvent` forgés
   → 1. Le scénario serait passé à côté de tout. La souris a été retenue, pas
   les événements forgés : *une épreuve qui contourne le mécanisme qu'elle
   mesure ne mesure que soi-même.*
2. **Un point hors fenêtre n'est pas une erreur : c'est un geste qui n'a pas
   lieu.** La case visée faisait 336 px de haut à 609 px dans une fenêtre de
   720 : son centre tombait dehors. Puis, la source une fois amenée à l'écran,
   c'est le haut de la case qui passait au-dessus du bord. Le helper vise
   désormais le milieu de la partie **visible**, et **échoue bruyamment** s'il
   n'y en a pas — sans quoi le scénario accuserait la règle métier de ne pas
   avoir refusé.
3. **La charge du glissé ne peut pas vivre dans un état React.** `dragstart` et
   `drop` peuvent tomber dans le même lot de rendu, et l'état posé au premier
   n'est pas encore lu au second. Elle voyage dans le `dataTransfer` — ce à quoi
   il sert — et elle est **contrôlée à la lecture** : un contenu illisible
   n'écrit rien.
4. **La scène entrait en collision avec le semis.** Le semis posait déjà une
   intervention de 13:00 à 15:00 pour le technicien de Ducos le mardi, et la vue
   jour ne montre qu'une occupation par créneau : la ligne de la scène était
   **rendue invisible**, et le scénario accusait le sélecteur. La scène libère
   donc ses deux jours pour ses deux techniciens — en rendant les interventions
   à la file, jamais en les supprimant.

*Et une décision de forme :* les quatre scénarios s'exécutent **en série**. Ils
partagent une base et un serveur, et le premier écrit. Mesuré en parallèle : deux
échecs sur quatre, dont un délai d'attente de 30 s — un symptôme de contention,
pas de règle. La CI n'emploie déjà qu'un travailleur ; le dire ici rend
l'exécution locale identique à la sienne.

---

## 4 — R2-05 et R2-06 : les deux écrans de réglage, en tableau dense

**Pourquoi ceux-là et pas `L1-08b`, que `pnpm file` nommait.** Mesuré :
`import_lot` et `import_lot_ligne` **n'existent pas au schéma**, et ce qui reste
de L1-08b — l'application, l'annulation partielle, le rapprochement assisté —
les exige toutes deux. Le ticket se termine donc sur une **migration**, c'est-à-
dire sur un geste d'Alexis ; et une migration non appliquée fait **rougir la
veille nocturne** — c'est l'incident du 10/09, écrit au §9. La consigne
d'exploitation de cette nuit est explicite : *entre deux travaux libres,
préférer celui qui n'exige aucun geste.* R2-05 et R2-06 n'exigent rien : ni
migration, ni semis.

### Ce qui a été mesuré, à travers un navigateur

C'est le harnais de R2-18 qui le rend possible ; l'acceptation de R2-05
l'exigeait depuis le début, et personne ne pouvait y répondre.

| Fenêtre 1700 × 1000, trois établissements | avant | après |
|---|---|---|
| `/parametres/agences` — largeur du contenu | 896 px | **1360 px** |
| `/parametres/agences` — hauteur du document | 1428 px | **1000 px** |
| établissements entièrement visibles | **2 sur 3** | **3 sur 3** |
| `/parametres/forfaits` — largeur du contenu | 896 px | **1360 px** |
| `/parametres/forfaits` — hauteur du document | 1146 px | **1000 px** |

### Trois décisions

**La forme du tableau est PARTAGÉE, pas recopiée.** `components/ui/tableau.tsx`,
une seule fois, valeurs **lues** dans la maquette — en-tête 10,5 px capitales,
interlettrage 0,6 px, cellules à 11 px de padding. *Une forme visuelle est un
critère comme un autre — c'est même celui dont la divergence se voit le plus et
se mesure le moins.* Un scénario compare la forme d'en-tête des deux écrans.

**Le réglage du pas reste DANS la ligne**, et un scénario le vérifie : on règle
un pas en regardant celui des autres établissements.

**Un écart avec la maquette, écrit avec sa raison.** Elle intitule son tableau
« par site », et ses lignes sont Ducos, Koné, Dolbeau — des **établissements**.
Le vocabulaire imposé prime (D5, D47) : la colonne vient de `mot("agence")`.
*La maquette fait foi sur la disposition et sur les couleurs, jamais sur le
vocabulaire.*

**Ce qui n'a PAS été touché :** la grille du planning garde sa propre structure
de tableau. *Ses cellules portent les cases de dépôt du glisser-déposer*, et
l'unifier casserait un mécanisme pour gagner une ressemblance. L'écart est écrit
dans l'entête du composant plutôt que tu.

### Une découverte en chemin, qui n'était pas cherchée

**Le catalogue de forfaits n'a AUCUN chemin d'écriture.** L1-06 a construit la
règle (`forfaitRetenu`, les trois axes, le rang), la base (contraintes, unicité
composite) et l'écran de lecture — *mais rien qui crée un forfait.* Le catalogue
naît vide par décision, et il le reste : l'exploitation n'a aujourd'hui aucun
moyen d'y mettre une ligne autrement qu'en SQL.

*Conséquence immédiate pour R2-06 : sur une base semée, `/parametres/forfaits`
n'affiche AUCUN tableau, et sa reprise d'apparence serait restée « écrite mais
jamais vue ».* La scène de bout en bout pose donc deux forfaits — une FIXTURE
d'épreuve, jamais de la donnée de démonstration, sur une base détruite à chaque
exécution.

**Et une mesure qui corrige une phrase de la constitution par sa moitié.** Le §6
écrit que « aucune condition » a deux écritures — `null` à la saisie, **le
tableau VIDE en base**. *Mesuré : la base REFUSE le tableau vide* — code 23514,
`forfait_types_intervention_non_vides`, dont la fonction exige `IS NULL OR
cardinality > 0`. Ce qui est vide, c'est ce que **Prisma REND à la lecture**
d'une colonne nulle. La règle ne bouge pas ; c'est le mot « en base » qui
désigne la lecture et non l'écriture, et cela mérite d'être su avant d'écrire le
premier formulaire de forfait. Porté en R2-20.
