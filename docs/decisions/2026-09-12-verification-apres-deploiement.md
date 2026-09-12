# La vérification après déploiement, et le commit qui la rend non vacuous (R3-01)

_12/09/2026._

## Contexte

Trois pannes de production en deux jours, **la même cause chaque fois** : du code
arrivé sur `main` lit une colonne qu'une migration non appliquée devait créer.
La première a duré **4 h 03 min** et personne ne l'a su. La deuxième a été
trouvée en réparant la sonde. La troisième — `/planning`, digest `2309581374` —
a été découverte **par un écran blanc**, alors que `/sante` nommait la cause en
une ligne : _« Une migration n'est pas appliquée :
20260913190000_trajet_par_zone_r3_03 »_. La sonde, réparée la veille,
fonctionnait. Elle n'avait pas de lecteur.

Le compte exact se mesure, il ne se raconte pas : la migration absente vient de
**#156**, non de #157 — `git diff --name-only 1d87d6e^ 1d87d6e --
prisma/migrations/` la nomme, et le même calcul sur #157 ne rend rien. Le geste
a donc manqué à une fusion, puis une seconde est passée par-dessus.

`pnpm verify:full` était vert à chaque fois, et sincèrement : il tourne contre
une base **fraîchement migrée**, la production contre une base migrée à un autre
moment. Les commandes sont les mêmes, **l'état du monde diffère**, et rien ne
confrontait les deux.

## Options écartées

**(a) Appliquer les migrations automatiquement à la fusion.** C'est la réponse
évidente, et elle est refusée par une décision antérieure : `db-migrate.yml` n'a
qu'un seul déclencheur, `workflow_dispatch`, parce qu'_une migration jouée sans
qu'on la regarde est la panne suivante_. Une migration peut verrouiller une
table, échouer à mi-chemin, ou demander un rattrapage ; elle se joue devant
quelqu'un. Le contrôle **nomme** donc le geste et ne le joue jamais — un gardien
refuse que son job porte `migrate deploy`.

**(b) Se contenter d'un rappel au moment de la fusion.** Un avertissement écrit
dans le résumé de l'exécution est gratuit et arrive tout de suite. Il a
exactement le défaut de la règle qu'il remplace : **il se lit ou ne se lit pas.**
Il est livré, mais comme rappel, à côté d'une mesure — jamais à sa place.

**(c) Faire échouer la route `/api/sante` en HTTP quand quelque chose va mal.**
Plus propre en apparence, et cela confondrait deux choses que le contrôle doit
distinguer : _« l'application ne répond pas »_ est un incident d'exploitation,
_« l'application répond et dit que sa base est en retard »_ appelle une
migration. Un `503` indistinct enverrait chercher le mauvais.

**(d) Lancer le contrôle au moment de la poussée.** Le déploiement n'est pas
terminé ; le contrôle passerait deux minutes à réessayer, soit **trois minutes
facturées** là où une suffit — _un job est facturé à la minute supérieure_.
Placé après `verify:full`, huit minutes plus tard, la première tentative
aboutit.

## Ce qui a été décidé

**Trois pièces, et elles ne se recouvrent pas.**

1. **`/api/sante`** rend la **même lecture** que la page `/sante`, à une machine,
   avec en plus le **commit déployé**. Une lecture, deux rendus : une seconde
   lecture écrite « pour la machine » serait deux implémentations d'un même
   critère, chacune verte, divergeant en silence — et dans le pire sens, puisque
   c'est la machine qui décide si quelqu'un est prévenu. Un scénario les fait
   répondre l'une à côté de l'autre sur des états réels.
2. **`scripts/lib/verdict-deploiement.ts`** rend le verdict **sans réseau**, ce
   qui le rend éprouvable sur la réponse exacte qu'a rendue la production. Neuf
   natures, parce que chacune se corrige ailleurs, et les codes de `pnpm
   veille` : **75 quand on n'a rien pu constater, 1 quand on a constaté un
   écart.**
3. **Le job `deploiement`** ouvre la sonde à chaque fusion, chaque nuit et à la
   demande ; **l'alarme d'É12 ouvre une issue dans le dépôt** quand il rougit,
   avec un fil par nature — jamais un courriel, _deux échecs de « DB migrate &
   seed » sont restés non lus dans une boîte le 20 août_.

**Le témoin est la pièce qui décide de tout le reste.** Un contrôle lancé après
une fusion interroge, par défaut, **l'ancienne version** — qui répond « tout va
bien » en toute sincérité, sa base lui suffisant. Il aurait donc été **vert
précisément dans la fenêtre où la panne naît**, et personne n'aurait pu le
savoir : _un décompte nul ressemble toujours à un sans-faute._ La réponse porte
donc le commit déployé, et le contrôle **refuse de conclure** tant qu'il n'a pas
reconnu celui qu'il visait. `deploiement_en_retard` et `commit_inconnu` valent
**75**, jamais 0.

## Conséquences

**Ce que cela coûte : une minute facturée par fusion**, et la dépendance
`needs: [verify-full]` est ce qui la rend d'une minute plutôt que de trois.

**Ce qui n'est pas livré, et c'est nommé plutôt que raboté en silence.** La pièce
(2) du ticket — _ouvrir un écran authentifié_ — exige un compte de production et
son mot de passe dans un secret de CI, c'est-à-dire **une accréditation
utilisable sur la base réelle dans un chemin que toute branche peut faire
tourner**. Cela se décide, pas se glisse dans un ticket : porté à **R3-06**, avec
ses trois issues et le coût de chacune. _Ce qui est livré couvre la cause des
trois pannes ; ce qui manque couvrirait un écran cassé pour une autre raison._

**Une variable à poser, et le contrôle rougira jusque-là.** `URL_PRODUCTION`
(Settings → Variables) est l'adresse publique du déploiement. Sans elle, le
contrôle ne rend pas la main en vert : il rougit en nommant où la poser — _un
contrôle qui se tait quand il n'est pas configuré est le contrôle qu'on croit
avoir._

**Et le verrou qu'on aurait retiré sans le savoir.** L'avertissement de fusion
compare `HEAD^` à `HEAD` ; avec la profondeur 1 de `checkout`, `HEAD^` n'existe
pas, et un `|| true` rendrait alors la liste **vide** — « aucune migration », en
silence. Deux verrous qui ne se recouvrent pas : `fetch-depth: 2` demandé, et le
pas qui **refuse de conclure** s'il n'a pas pu comparer. Un gardien éprouve les
deux sur la faute telle qu'elle se commettrait.
