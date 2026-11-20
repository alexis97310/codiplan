# 9L29-RELECTURE-REPRENDRE-P2025 — passation

T0 = 13:26 (Pacific/Noumea, 20/11/2026). Limite 150 min, code neuf arrêté à T0+110
(15:16).

## Point 1 — le défaut existe-t-il toujours sur `origin/main` actuel ?

Les six commits de `9L08C-TERRAIN-REPRENDRE-SUSPENSION-garde` (bouton terrain
« Reprendre ») ont été reportés À LA MAIN sur cette branche (pas un cherry-pick
littéral : `tests/unit/auth/porte.test.ts` a depuis été restructuré — la table
`ROUTE_CAPACITE` a migré vers `tests/unit/auth/route-capacite.ts` — et
`app/(mobile)/terrain/[id]/page.tsx`, `lib/i18n/fr.ts`,
`components/terrain/consultation-hors-reseau.tsx` ont divergé ; les quatre ont été
fusionnés à la main ou par `git apply --3way`, sans changer le contenu fonctionnel
du bouton). `pnpm typecheck` propre après report.

**Rejoué 3 fois, foreground, `CI=1 --workers=1 --retries=0`, base jetable recréée
à chaque lancement (`tests/e2e/setup/base.ts`) : 3 essais, 3 échecs.** Toujours le
même P2025 au même endroit — `tx.intervention.update(...)` dans
`reprendreIntervention`, appelé par `POST /api/terrain/[id]/reprendre` — après
« suspendre » en ligne. Le second scénario (reprise hors réseau puis rejouée par
« Envoyer ») échoue en cascade (timeout) parce que le premier scénario a laissé la
page sur l'état d'erreur sans que ce soit la cause propre du second — à vérifier
scénario par scénario si besoin, mais le signal utile est déjà là.

**Ceci est PLUS systématique que la mesure de 9L08CA** (qui notait 2 échecs sur 4
sur ce poste). Deux lectures possibles : D270 (9L13, suspension ferme le segment de
compteur dans la même transaction) a changé la fenêtre de course et l'a rendue plus
large/plus fréquente ; ou la variance observée en 9L08CA tenait à la charge de la
machine à ce moment-là, pas à une vraie probabilité différente. À garder en tête
pendant la relecture : **D270 a touché `suspendreIntervention`**, directement en
amont de l'état que `reprendreIntervention` doit retrouver.

## Point 2 — relecture ligne à ligne

Lu intégralement : `lib/db/rls.ts` (`avecContexteRls`, `poserContexte`, `instructionContexte`),
`lib/db/client.ts` (`avecContexteApplicatif`), `suspendreIntervention` et
`reprendreIntervention` (`lib/interventions/depot.ts`), le déclencheur
`intervention_cycle_de_vie` dans sa dernière version
(`prisma/migrations/20261022210000_rapport_valide_avant_cloture/migration.sql`,
seule redéfinition postérieure à D120), les quatre politiques RLS sur `intervention`
(`cloisonnement_parc` + les trois `verrou_ecriture_portail_*` posées par la boucle
`DO $$` de `20261110120000_portail_securite_base_9k16`), la route terrain et la
route bureau de reprise, `app/(mobile)/terrain/[id]/page.tsx` (tout ce que le rendu
lit ET écrit — une seule écriture, `marquerVuParTechnicien`, protégée par
`vue_technicien_le IS NULL` donc sans second effet après le premier affichage), et
le geste hors réseau (`lib/terrain/file-saisies.ts`, `lib/terrain/envoi-file.ts`).

### a) Deux transactions parallèles du rendu de `/terrain/<id>` — ÉCARTÉE PAR LA MESURE

Le rendu de la fiche fait effectivement une dizaine de transactions PARALLÈLES
(`Promise.all`), mesuré directement (voir § Mesure ci-dessous : jusqu'à 9 branches
simultanées, pids distincts). **Aucune n'écrit sur `intervention`** — relu une par
une (`lireRapportTexte`, `listerLesPrestations`, `prestationsRealisees`,
`photosDeLIntervention`, `derniereSignature`, `lireSite`, `piecesRemplacees`,
`lignesConditionsFacturation`, `checklistDeLIntervention` : neuf lectures, zéro
écriture). La seule écriture du rendu (`marquerVuParTechnicien`, ligne 236) est
gardée par `vue_technicien_le IS NULL` : sur la scène rejouée (suspendre PUIS
reprendre), la première ouverture de la fiche a déjà posé cette date avant la
suspension, donc ce second rendu NE réécrit rien (confirmé : aucune seconde
`UPDATE ... vue_technicien_le` dans le journal de requêtes capturé). Cette piste
est ÉCARTÉE : pas de second écrivain visible venant du rendu.

### b) `SET LOCAL` posé sur une connexion puis requête servie par une AUTRE — ÉCARTÉE PAR LA MESURE, AUTREMENT QUE PRÉVU

Mesuré directement (journal `log: [{level:"query", emit:"event"}]` sur le client
Prisma + `pg_backend_pid()` à l'ouverture de CHAQUE transaction, voir § Mesure) :
le `pid` relevé à l'ouverture de la transaction de `reprendreIntervention` reste
IDENTIQUE à celui de la lecture suivante dans le même run. Pas de bascule de
connexion visible. **Mais la mesure a quand même designé un symptôme nouveau,
jamais relevé par 9L08C/9L08CA** : voir § Mesure, point 3.

### c) La suspension n'ouvre pas toujours la pause — ÉCARTÉE, inchangée depuis 9L08C

`suspendreIntervention` crée la `interventionPause` dans LA MÊME transaction que
l'`UPDATE` du statut, sans condition — l'ouverture de pause n'est jamais
conditionnelle, donc ne peut pas être « parfois oubliée ». Le message d'erreur
« suspendue sans pause ouverte » que 9L08CA avait vu sur D'AUTRES scènes (9k13,
9l04g) n'est PAS apparu dans aucune de mes mesures sur CE scénario : il est donc
une CONSÉQUENCE du P2025 d'un AUTRE test (si la ligne reste bloquée sur un état
intermédiaire par un run précédent qui n'a pas nettoyé), pas une cause distincte.
Non réexaminé plus loin par manque de budget après le point 3 ci-dessous ; à
rouvrir si le point 3 est un jour expliqué.

### d) Un déclencheur qui réécrit la ligne — ÉCARTÉE, confirmée par lecture complète

`intervention_cycle_de_vie` (dernière version, ci-dessus) ne fait QUE `RETURN NEW`
ou `RAISE EXCEPTION` — aucune branche `RETURN NULL`, aucune écriture annexe. Une
`RAISE EXCEPTION` aurait donné une erreur Postgres explicite dans les journaux, pas
un P2025 (0 ligne, sans exception) : la signature elle-même exclut ce déclencheur.
`intervention_sortie_de_suspension` ne vide que des colonnes, même régime. Les
politiques RLS pour `UPDATE` (`cloisonnement_parc` + `verrou_ecriture_portail_
modification`) et pour `SELECT` (`cloisonnement_parc` seule) se réduisent, pour un
compte TECHNICIEN (`app.client_id` vide), à EXACTEMENT LA MÊME clause :
`societe_id = app.societe_id`. Vérifié dans la base vivante
(`SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename=
'intervention'`) : aucune asymétrie SELECT/UPDATE à ce niveau.

## Point e / Mesure — ce qui N'AVAIT PAS ENCORE été mesuré par 9L08C/9L08CA

Une instrumentation temporaire (journal de requêtes Prisma complet, lecture de
`pg_backend_pid()`/`current_setting`/`count(*)` avant et après l'`UPDATE`, une
transaction toute neuve ouverte APRÈS l'échec) a été ajoutée, exercée, puis
INTÉGRALEMENT RETIRÉE avant de rendre la main (`git diff` contre le commit du
point 1 est vide — confirmé). Trois faits nouveaux, chacun mesuré plusieurs fois :

1. **Le journal COMPLET de toutes les requêtes SQL émises par le serveur pendant
   tout le scénario ne montre AUCUNE autre écriture sur `intervention`** que les
   trois attendues (`marquerVuParTechnicien`, `suspendreIntervention`, puis
   l'`UPDATE` de `reprendreIntervention` qui échoue). Aucun autre `UPDATE`/`DELETE`
   sur cette table, à aucun moment, sur aucune connexion visible de ce processus.
   **Le « second acteur » que 9L08CA n'avait pas pu nommer n'apparaît tout
   simplement PAS comme une écriture SQL concurrente visible depuis le serveur.**

2. **Une transaction TOUTE NEUVE, ouverte APRÈS que l'erreur a été attrapée** (donc
   après le `ROLLBACK` de la transaction qui a échoué, avec un nouveau `BEGIN`, un
   nouveau `set_config` des six variables, sur une connexion réutilisée du pool) **ne
   retrouve PAS non plus la ligne**, alors que `count(*) FROM intervention` sous ce
   même contexte reste cohérent (41, le même nombre que lorsque la ligne EST
   retrouvée) : ce n'est donc pas tout le contexte qui s'effondre (pas une société
   ou un rôle mal posés), c'est SPÉCIFIQUEMENT cette ligne qui reste introuvable
   l'instant d'après, par N'IMPORTE QUELLE transaction, pas seulement celle qui a
   écrit. Je n'ai pas pu mesurer, dans le budget, si elle redevient visible après un
   délai (une tentative à 500 ms n'a pas réussi à reproduire le défaut avant la
   limite de temps — voir ci-dessous).

3. **LE FAIT LE PLUS UTILE POUR LA SUITE** : insérer UNE SEULE requête SQL
   supplémentaire (un simple `SELECT ... WHERE id = $1`, en brut, sur LA MÊME
   transaction) ENTRE le `findFirst` et l'`UPDATE` de `reprendreIntervention` **a
   fait disparaître le défaut** — zéro échec sur treize essais consécutifs avec
   cette requête en place, puis reproduction IMMÉDIATE (3 essais, 3 échecs) dès
   qu'elle est retirée. **Un délai PUREMENT JavaScript, SANS requête base, posé au
   même endroit (`await new Promise(r => setImmediate(r))`) N'A PAS empêché la
   reproduction** (3 essais, 3 échecs) : ce n'est donc pas une question de temps
   d'horloge écoulé côté Node, c'est spécifiquement le fait d'émettre une requête
   SQL de plus sur la connexion avant l'`UPDATE` qui change l'issue. Ceci exclut,
   en plus de ce que 9L08C/9L08CA avaient déjà écarté : la variance de charge de la
   machine (écartée séparément — j'ai aussi vérifié qu'aucun processus de test
   trainant d'une exécution précédente n'explique la différence, en nettoyant tous
   les processus `next`/`playwright` restants puis en rejouant : le code AVEC la
   requête en plus reste systématiquement vert, le code SANS reste systématiquement
   rouge, sur la MÊME machine, dans le MÊME état).

**Je n'ai pas pu, dans le budget qui restait après cette mesure, nommer le
mécanisme PRÉCIS qui fait qu'une requête SQL de plus — et seulement une requête,
jamais un délai — change l'issue.** Ce n'est ni une histoire de connexion
différente (pid identique, mesuré), ni une histoire de politique RLS asymétrique
(clauses identiques SELECT/UPDATE, vérifié en base), ni un second écrivain SQL
visible (journal complet, aucun autre `UPDATE`/`DELETE`). La seule chose nommée
avec certitude est la CONDITION qui fait basculer le défaut, pas sa CAUSE.

### Hypothèse la plus probable qui reste, et l'épreuve qui la trancherait

La fenêtre de course est donc très étroite (de l'ordre de la microseconde à la
milliseconde basse : le temps d'un aller-retour TCP local) et semble liée
spécifiquement au PREMIER `UPDATE` exécuté sur la toute première requête SQL
envoyée après l'ouverture de la transaction interactive Prisma
(`prisma.$transaction(async tx => {...})`) sur une connexion qui vient d'être
reprise du pool — jamais reproduite par un script Node direct appelant les deux
fonctions à la suite (9L08C/9L08CA), jamais évitée par un simple délai, mais
évitée par une requête de plus avant le premier `UPDATE` de la transaction. C'est
la signature d'un problème dans la plomberie PRISMA/node-postgres autour du
TOUT PREMIER `UPDATE` d'une transaction interactive sur une connexion fraîchement
réattribuée par le pool — pas dans le code applicatif de ce dépôt, qui pose
le contexte et lit/écrit de façon strictement séquentielle et correcte.

**L'épreuve qui permettrait de trancher** (non jouée, faute de budget) : un script
Node autonome, SANS Next.js ni route HTTP, qui ouvre RÉPÉTÉMENT (boucle serrée) une
transaction Prisma `$transaction` sur UNE CONNEXION FRAÎCHEMENT PRISE DU POOL
(forcer `connection_limit=1` pour empêcher toute réutilisation favorable), pose le
contexte RLS, et enchaîne un SEUL `UPDATE` comme PREMIÈRE requête de la
transaction — pour voir si le défaut se reproduit SANS AUCUN Next.js, serveur HTTP
ni navigateur. S'il se reproduit ainsi : c'est un défaut de Prisma/node-postgres
(signalable en amont, ticket Prisma). S'il ne se reproduit PAS ainsi : il faut
revenir au couple Next.js + Playwright spécifiquement (peut-être React Server
Components qui ouvre réellement la MÊME page en deux passes, ou le pipelining de
requêtes HTTP de Playwright) pour continuer à chercher.

## Conclusion de ce lot

**La cause n'est PAS nommée ni prouvée** au sens où le ticket l'exige : je sais
QUAND le défaut apparaît (jamais si une requête de plus est insérée avant l'
`UPDATE`, ni par un script direct) mais pas POURQUOI. Conformément au point 4 du
ticket : **aucune correction n'est appliquée**. Le bouton terrain « Reprendre »
NE REVIENT PAS. `tests/e2e/9l08c-terrain-reprendre-suspension.spec.ts` n'a pas été
réintégré au dépôt (il a servi, depuis la copie manuelle du point 1, uniquement à
mesurer ; il n'est dans aucun commit de cette branche après le point 1 — voir le
commit suivant qui retire le report).

Toute l'instrumentation de mesure a été retirée (`git diff` contre le dernier
commit de ce lot est vide avant le commit de passation ; confirmé par `git status
--porcelain`).

## Ce qui reste dû, pour qui reprend

1. Jouer l'épreuve nommée ci-dessus (script Node isolé, `connection_limit=1`,
   boucle serrée d'`UPDATE` en première requête d'une transaction interactive).
2. Si elle confirme un défaut Prisma/node-postgres : chercher la version installée
   (`@prisma/client` 6.19.3 ici) dans les tickets connus du projet Prisma avant
   d'envisager une mise à jour de dépendance — **jamais sans l'accord d'Alexis**
   (CLAUDE.md §2, « ajouter une dépendance est une décision »; une mise à jour de
   version majeure/mineure touchant un comportement de transaction est du même
   ordre).
3. Le « Reprendre » du bureau (`app/api/interventions/[id]/reprendre/route.ts`)
   appelle la MÊME fonction `reprendreIntervention` et porte donc LE MÊME RISQUE
   en théorie — non mesuré spécifiquement dans ce lot (aucun scénario e2e dédié
   écrit, faute de budget après l'enquête).
4. Les captures et le report du bouton restent dus, dépendants de la réparation.
