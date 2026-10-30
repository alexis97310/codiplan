# 9I8-AFFICHAGE-DES-MONTANTS — passation

## Point 1 — l'inventaire mesuré

Grep sur `accesAuxMontants`, `formatMoney`, `montant_ht`, `valorisation` sous `app/` et `lib/` (hors tests).
Deux écrans — et seulement deux — affichent un montant d'INTERVENTION :

| Écran | Fichier | État avant ce lot |
|---|---|---|
| Onglet Valorisation de la fiche | `app/(back-office)/interventions/[id]/page.tsx` (`Valorisation`, ~l.1700/1887) | **Bogue M1** : `fiche.valorisation !== null && fiche.devise !== null` masque TOUT le composant — titre et motif compris — tant que l'intervention n'est pas clôturée, ou si clôturée sans taux en vigueur à sa date. |
| Bon d'intervention (version interne) | `app/(back-office)/interventions/[id]/bon/page.tsx` (`valorisationTuile`, ~l.471) | Déjà correct : la tuile se monte dès que `interne` est vrai, et affiche `sans_droit` / `taux_absent` / le détail — jamais masquée entièrement. Non touché par ce lot (seulement par le point 5, réglage société). |

Écrans explicitement HORS primètre (pas un montant d'INTERVENTION, ou paramétrage des prix — reste visible, décision confirmée 29/10) :
`app/(back-office)/parametres/tarifs/page.tsx` (paramétrage des prix), `app/(back-office)/interventions/nouvelle/page.tsx` et
`app/(back-office)/demandes/[id]/page.tsx` (sélection de `mode_valorisation`, pas un montant affiché), `app/(back-office)/interventions/presentation.ts`
(nom de l'onglet, pas un montant), tout `lib/tarification/**`, `lib/money/**`, `lib/interventions/depot.ts`, `lib/reporting/**` (calcul, lecture seule).

Point central des droits : `lib/interventions/montants-visibles.ts` (`accesAuxMontants`, D37) — déjà juste, mais inatteignable depuis la fiche
tant que le bloc entier était masqué en amont par la condition de montage.

## Point 2 — Option A

`Valorisation` se monte désormais dès que `fiche.devise !== null` (quel que soit `fiche.valorisation`). Le composant distingue, dans l'ordre :
1. `!montants.montre` → motif `intervention.valorisation.sans_droit` (inchangé, D37/D88).
2. `montants.montre && valorisation !== null` → détail inchangé.
3. `montants.montre && valorisation === null && clotureeLe === null` → `intervention.valorisation.pas_encore` (« Pas encore valorisée : le montant sera calculé à la clôture. »).
4. `montants.montre && valorisation === null && clotureeLe !== null` → `intervention.valorisation.total_inconnu` (une clôturée dont le taux historique n'est plus lisible à sa date — `depot.ts` ne renvoie `valorisation` à `null`, après clôture, que dans ce seul cas : `temps_valide_min` n'est écrit qu'à la clôture, et au-delà `tauxEnVigueur` est l'unique branche qui laisse `valorisation` à `null`).

## Point 3 — migration

**`20261031060000_afficher_montants_societe_9i8`** — colonne `societe.afficher_montants BOOLEAN NOT NULL DEFAULT true`. Aucune donnée
modifiée, aucune politique RLS touchée, aucune autre colonne. **Alexis : à jouer avec `pnpm db:deploy` sur le site de test ET en
production** — c'est la commande de mise en ligne habituelle, elle applique celle-ci (et elle seule, si les précédentes l'ont déjà été)
sans jamais réécrire une migration déjà appliquée.

## Point 4 — le réglage

Case « Afficher les montants » dans `/parametres/societe` (`lireAfficherMontants`/`enregistrerAfficherMontants`,
`lib/societes/identite.ts`), gardée par la capacité `parametrer_societe`. **Mesuré plutôt que supposé** : cette capacité est DÉJÀ, dans
la matrice (`lib/auth/habilitations.ts:205`), exactement `{ complet: [ADMS, DIR] }` — admin_societe et direction, aucun autre rôle,
aucun ○ — donc exactement ce que la demande d'Alexis vise. Aucune garde supplémentaire n'a été ajoutée ; `enregistrerAfficherMontants`
revérifie quand même la capacité EN INTERNE (même doctrine que `enregistrerMentionsLegales`), pour rester correcte si un jour elle est
appelée hors de cette route. `POST /api/parametres/societe/afficher-montants`, enregistré dans les gardiens de porte
(`PORTE_COMPLETE`/`ROUTE_CAPACITE`, `tests/unit/auth/porte.test.ts`).

## Point 5 — le masquage

`accesAuxMontants(role, afficherMontants)` : le réglage de société, désactivé, l'emporte sur TOUT droit de rôle — motif
`intervention.valorisation.desactive_par_societe`, distinct de `sans_droit`. Câblé sur les deux écrans du point 1 via
`lireAfficherMontants(contexte)` (nouvelle lecture, `lib/societes/identite.ts`).

**Un sous-piège trouvé en construisant ce point, propre au bon d'intervention** : le commutateur « Version client / Version interne »
du bon (et la possibilité même d'atteindre la version interne, `versionDuBon`) suivait le même booléen `montants.montre` que le contenu
du bloc. Avec le réglage dans ce booléen, « désactivé » aurait fait disparaître le commutateur AVEC les montants — et le motif qui doit
justement s'afficher en version interne ne s'y serait plus jamais affiché (même défaut que M1, à un étage différent). Corrigé par une
seconde fonction exportée, `aDroitRoleAuxMontants(role)` (rôle SEUL, sans le réglage), qui gouverne désormais le commutateur et
l'atteignabilité de la version interne ; `accesAuxMontants` (rôle + réglage) continue de gouverner le CONTENU du bloc, une fois atteint.

## Point 6 — captures

Dix captures **APRÈS seulement** (375 et 1280 px) dans `captures/` : onglet Valorisation avant clôture (ADV « pas encore valorisée »,
admin_societe « sans droit »), fiche et bon avec le réglage désactivé, page Paramètres société avec la case. **L'AVANT (bloc
ENTIÈREMENT absent, bogue M1) n'a pas été recapturé en image** — budget de temps épuisé avant d'y revenir une fois le reste fait — mais
il est mesuré et committé ailleurs : le rouge réel de `tests/e2e/9i8-affichage-des-montants.spec.ts` (commit du point 1, joué contre le
code d'alors) EST la preuve AVANT, plus fiable qu'une capture puisqu'elle a fait échouer une assertion plutôt que d'illustrer un dire.
Pareil pour « réglage désactivé » et « case dans les paramètres » : ces écrans n'existaient tout simplement pas avant ce lot, un AVANT
n'a donc pas de sens pour eux au-delà de « la case n'y est pas » / « rien ne masque rien ».

## Ce qui reste à faire, si on y revient

- Les captures AVANT du point 6 (optionnel, la preuve existe déjà sous forme de test).
- Le point 1 mentionne que le bon était DÉJÀ correct avant ce lot (jamais de disparition totale) — vérifié par lecture de code, pas par
  un test e2e dédié au cas « jamais clôturée » sur le bon (hors scope strict du ticket, qui vise la fiche pour ce bogue-là).

## Mesure du budget

T0 = 05:45 (Pacific/Noumea), limite 150 min. Travail sur la branche dédiée `9I8-AFFICHAGE-DES-MONTANTS`, partant d'`origin/main` (HEAD
était détaché sur `origin/main` au démarrage de la session — aucun autre worktree n'y était extrait). Six commits, un par point,
chacun vert (`pnpm format`/`typecheck`/`lint`/`test`, `test:isolation` après la migration) avant d'être posé.

## `verify-final.txt` — coupé à 50 min, en plein `test:e2e`

`CI=1 pnpm verify:full` a été lancé EN UN SEUL appel, au premier plan, à 06:48. `format:check`, `typecheck`, `lint`, `test`,
`test:isolation` et `build` sont passés (visibles dans la trace). `feries:horizon` et `audit:partitions` ont dû passer aussi (le fichier
montre `test:e2e` démarré). `test:e2e` — la suite COMPLÈTE, bien plus longue que les specs ciblés joués pendant ce lot — n'a pas fini
avant que l'appel ne soit arrêté (50 min, limite de l'outil), en plein milieu (mesures d'écrans d'autres lots visibles dans la trace, la
dernière vers 20:34 UTC). **Ce lot n'a donc PAS vu `pnpm verify:full` vert dans son intégralité.**

Ce que ça ne remet PAS en cause : chaque point de ce lot a été vérifié un par un et individuellement vert — `pnpm format`/`typecheck`/
`lint`/`test` avant chaque commit, `pnpm test:isolation` après la migration (point 3), et les specs e2e ciblés de ce lot
(`9i8-affichage-des-montants`, `9i8-afficher-montants-desactive`, `captures-9i8-affichage-des-montants`, plus
`montants-par-role`/`9i7-bon-en-tuiles`/`bon-intervention`/`9eq-fiche-intervention`/`9i6-fiche-intervention-tuiles` pour la régression)
tous verts, joués explicitement pendant le lot — voir les commits des points 1, 2 et 5.

**Effet de bord constaté et corrigé** : le `test:e2e` complet a régénéré, en écrasant sur place, près de 280 captures PNG d'AUTRES
lots (effet de bord documenté ailleurs dans ce dépôt) ainsi qu'une dizaine de captures neuves non suivies pour deux autres lots —
toutes restaurées/supprimées avant de rendre la main (`git checkout --` sur les fichiers modifiés hors de ce lot, `rm` sur les fichiers
neufs non suivis hors de ce lot). Aucune n'a été commitée. Les captures DE CE lot (point 6) ont aussi été réécrites par ce même run (une
donnée affichée à l'écran — l'horodatage « Créée le » — change d'une exécution à l'autre) ; elles ont été restaurées à leur version
committée pour ne pas introduire une différence non voulue.

**Pour reprendre** : rejouer `CI=1 pnpm verify:full` en entier (un budget de temps plus large que 50 min lui est nécessaire sur ce
poste — la seule suite `test:e2e` complète dépasse largement cette durée), puis `git fetch origin && git rebase origin/main &&
CI=1 pnpm verify` et vérifier l'arbre propre, comme demandé par le brief de ce lot.
