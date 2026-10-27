# 9H3-DEMO-DOUBLONS-HORS-SEMIS — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

`scripts/lib/doublons-machine.ts` (`planDeNettoyage`) : le refus « hors
semis » (aucune ligne du groupe ne porte `PREFIXE_RATTACHEMENT_SEED`) ne
s'applique plus dès que l'INTERVENTION et la SOCIÉTÉ du groupe appartiennent,
elles, au jeu de démonstration (`PREFIXE_INTERVENTION_SEED` et
`SOCIETES_DU_SEED`, importé de `./donnees-hors-seed`). Dans ce cas, le plan
garde désormais la PREMIÈRE MACHINE posée — la plus ancienne par `cree_le`
(nouveau champ de `LigneRattachement`, lu depuis la colonne du même nom,
mesurée existante sur `intervention_machine`), puis par `id` à égalité — et
retire les autres. Si l'intervention OU la société n'est pas du jeu de
démonstration, le refus d'origine reste entier, inchangé.

`scripts/nettoyer-doublons-machine-demo.mts` : la requête `SQL_RATTACHEMENTS`
sélectionne maintenant `"cree_le"` (sans cast, comme `SQL_TENTATIVES` de
`lib/db/sante.ts` — le driver rend un `Date` natif). Rien d'autre n'a changé
dans ce script : il affiche le même rapport et retire les mêmes lignes qu'il
retirait déjà, le plan qu'il reçoit porte juste un groupe de plus dans ce cas
précis.

Pour l'exploitation : le flux « DB doublons machine — démonstration » peut
désormais proposer puis appliquer un plan sur l'état réellement mesuré le
24/10/2026 (refus sur l'intervention `0192f0a0-6000-7000-8000-000000000001`)
— avant ce lot, il refusait (code 1) parce qu'aucune de ses deux lignes ne
porte le préfixe du semis. `docs/mise-en-ligne.md` §7 ter est mis à jour en
conséquence (décision du 24/10 ajoutée, phrase de refus corrigée).

## Ce que j'ai mesuré

- Le refus cité dans le ticket (texte exact, par Alexis le 24/10/2026, flux
  en lecture seule) : voir `docs/propositions/9H3-DEMO-DOUBLONS-HORS-SEMIS/README.md`.
- `intervention_machine.cree_le` EXISTE (`prisma/schema.prisma`, colonne de
  la table, `DateTime @default(now())`) : le tri s'appuie donc sur elle,
  jamais sur le repli « plus petit id » que le ticket proposait à défaut.
- Sortie APRÈS ce lot sur un état fabriqué (mêmes identifiants d'intervention
  et de société que le refus réel, dates de pose fabriquées) : voir le même
  README — produite par un script jetable (`npx tsx`), non conservé, aucune
  connexion à une base réelle.
- Les 18 migrations entre `20260923130000` et `20261023073000` (celle du
  jour), lues une à une pour tout `RAISE EXCEPTION` qui dépendrait de données
  déjà en base : deux en portent un (détail et risque résiduel dans
  `marche-a-suivre.md`, section « migrations postérieures »), les autres
  n'ont que des gardes de MÉCANISME (`FORCE ROW LEVEL SECURITY`) ou des
  corps de déclencheur qui ne s'exécutent que sur une écriture future.
- `pnpm format`, `pnpm typecheck`, `pnpm lint`, `pnpm test` verts avant ce
  commit ; `verify-final.txt` ci-joint pour `pnpm verify:full`.

## Ce que j'ai tranché et pourquoi

« Mesure si la colonne `cree_le` existe ; sinon le plus petit id, et dis-le »
(le ticket) : j'ai mesuré qu'elle existe, donc je n'ai PAS écrit le repli — un
repli pour un cas qui ne se produit jamais serait une branche morte, jamais
éprouvable, exactement ce que CLAUDE.md interdit (pas de code pour un
scénario qui ne peut pas arriver). Si un jour `cree_le` disparaissait de la
table, ce module ne compilerait plus (le type `LigneRattachement` l'exige) —
c'est le signal voulu, pas un silence.

Le discriminant entre les deux décisions (03/10 et 24/10) dans `rapportDoublons`
n'est PAS un nouveau champ sur `GroupeDoublon` : `g.gardee.id` porte déjà
l'information (il porte TOUJOURS `PREFIXE_RATTACHEMENT_SEED` dans le cas du
03/10 — c'est la définition même de ce cas — et JAMAIS dans le cas du 24/10).
Ajouter un champ aurait dupliqué une information déjà déductible.

Le docblock du module cite la décision par sa date et son origine (« Ticket
en fin de file », 24/10/2026) plutôt qu'un numéro dans `docs/arbitrages.md` —
même choix que 9CZA pour la décision du 03/10, pour la même raison : règle
d'exploitation de la seule démonstration.

## Ce que je n'ai PAS fait

Je n'ai touché ni `.github/workflows/db-doublons-machine-demo.yml` (toujours
manuel, `appliquer` décoché par défaut), ni `prisma/` (aucune migration,
aucune migration réécrite), ni `lib/`, ni `app/`. Je n'ai exécuté aucune
migration, je n'ai supprimé aucune machine, je n'ai levé `FORCE ROW LEVEL
SECURITY` nulle part, je n'ai touché à aucune base réelle ou de
démonstration — aucune connexion n'a eu lieu.

## Les pièges pour la session suivante

- Les géométries à surveiller une fois le flux rejoué pour de vrai figurent
  dans `marche-a-suivre.md`, section « migrations postérieures » : si « DB
  migrate & seed » échoue sur `20261003090000_tp_cy1_terminer_signature`
  (garde-fou sur des signatures sans image), c'est un NOUVEAU blocage, sans
  rapport avec celui de ce lot — ouvrir un ticket séparé, ne pas rouvrir
  celui-ci.
- Je n'ai PAS rejoué le flux contre la vraie base de démonstration bloquée
  (interdit par ce lot) : la prochaine exécution (lecture seule d'abord) est
  le premier test réel de ce changement sur l'état mesuré le 24/10. S'il
  diffère de ce qui est documenté ici — par exemple si la base porte encore
  d'autres lignes en doublon que celles nommées dans le refus — le rapport
  le dira, à lire avant d'appliquer.
- `interventionDeLaDemo` (nouvelle fonction) ne regarde QUE le préfixe de
  `intervention_id` et l'appartenance de `societe_id` à `SOCIETES_DU_SEED` —
  jamais l'id de la ligne `intervention_machine` elle-même, qui PAR
  DÉFINITION ne porte pas le préfixe du semis dans ce cas. Ne pas confondre
  les deux préfixes (`PREFIXE_RATTACHEMENT_SEED` pour une ligne,
  `PREFIXE_INTERVENTION_SEED` pour une intervention) dans une future lecture.

## Ce qui reste à faire

Rejouer le flux « DB doublons machine — démonstration » (`appliquer` décoché)
sur la vraie base de démonstration bloquée, lire le nouveau rapport, puis
suivre `marche-a-suivre.md` dans l'ordre — ce sont des gestes d'exploitation,
hors du territoire de ce lot (lecture seule imposée), et ils reviennent à
Alexis.
