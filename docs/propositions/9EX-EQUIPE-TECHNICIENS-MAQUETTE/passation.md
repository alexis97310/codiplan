# 9EX-EQUIPE-TECHNICIENS-MAQUETTE — passation

## Arrêt immédiat à l'ouverture (T0 = 22:30, Pacific/Noumea, 2026-10-15)

Le ticket impose : « ARRÊT IMMÉDIAT SI `git log origin/main --oneline -80` ne contient PAS de
commit `9ET-COMPTES-BUREAU-2` ». Mesuré tel quel : absent des 80 derniers commits d'`origin/main`
(tête `40bd7000`, suite de lots `9EWE`/`9EWD2`/`9EWD1`/`9EWB3`/`9EWB2`/`9EWD`/`9EWC`/`9EWB1`/
`9EWB`/`9EWA1`/`9EWA`/`9EW` entre-temps).

En creusant au-delà de la fenêtre de 80 : le commit final du lot, `79b59e9c` (« 9ET-COMPTES-BUREAU-2
— correctif : format (prettier) sur le solde du correctif exact: true »), EST ancêtre d'`origin/main`
(`git merge-base --is-ancestor 79b59e9c origin/main` → oui), mais à 87 commits en arrière
(`git rev-list --count 79b59e9c..origin/main` → 87). Le lot est donc bien intégré à `main` ; c'est
seulement la fenêtre « -80 » choisie par le pilote qui ne l'atteint plus, du fait du volume de lots
livrés depuis la mesure du pilote (qui datait d'« origin/main 79b59e9c, 13/10 15:20 »).

Je n'ai pas tranché moi-même que la condition d'arrêt ne s'appliquait pas : le ticket l'écrit comme
une instruction mécanique, sans clause d'exception, et la culture du dépôt (§7, « la file se LIT,
elle ne s'interprète pas ») pousse à l'honorer à la lettre plutôt qu'à la réinterpréter sous
pression. Aucun point du lot n'a été commencé : aucun fichier touché, arbre propre.

**Pour la suite** : si le pilote confirme que `9ET-COMPTES-BUREAU-2` (`79b59e9c`) est bien le
prérequis recherché et que la fenêtre de 80 commits était simplement trop courte compte tenu du
volume de lots livrés depuis sa mesure, ce lot peut être relancé tel quel — rien à changer dans son
contenu, seulement dans la garde d'ouverture.

État : `git status --porcelain` vide, `HEAD` = `40bd7000` (origin/main), aucun commit créé pour ce
lot.
