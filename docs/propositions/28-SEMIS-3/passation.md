# 28-SEMIS-3 — passation

## Ce que j'ai changé

`prisma/seed.ts`, section « 9. L'AFFECTATION DES INTERVENTIONS AUX TECHNICIENS
(R2-12) » : avant d'écrire `technicien_id` + `date_planifiee` sur une
intervention non terminale, la passe lit désormais les blocages d'agenda
(`tx.absence.findMany`, une fois par société, dans la même transaction
cloisonnée) et appelle `absenceCouvrant` (`lib/absences/periode.ts` — déjà
écrite, déjà testée, réutilisée telle quelle) pour savoir si le technicien
candidat est bloqué le jour visé. Si oui, la ligne est **sautée** (`continue`),
telle quelle, sans écriture — exactement comme le cas déjà existant « agence
sans équipe ». Le compte des lignes sautées est journalisé à côté du compte de
lignes replacées : `${societe.code} — interventions replacées : N — sautées
pour blocage d'agenda : M`.

**Pour l'exploitation** : le flux `DB migrate & seed` ne meurt plus à l'étape
« affectation des interventions aux techniciens » quand la démonstration porte
un blocage d'agenda réel (posé depuis l'écran entre deux exécutions). Ses deux
dernières étapes — « Inventaire à plat » et « Contrôle de cloisonnement (base
hébergée, rôle applicatif) » — s'exécutent donc de nouveau. Le contrôle de
cloisonnement de la base hébergée, qui n'avait plus tourné depuis l'exécution
#63, retrouve un chemin pour s'exécuter à la prochaine mise en ligne.

Aucune migration touchée : la contrainte `intervention_pas_sur_blocage_agenda`
n'a pas bougé, conformément à l'arbitrage déjà rendu.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

Mesuré à la main sur une base PostgreSQL 16 jetable (`codiplan_semis3_scratch`,
conteneur `codiplan-pg16`, détruite après mesure — I9), migrations appliquées
(`prisma migrate deploy`), semé avec `DATABASE_URL=…postgres…
pnpm exec tsx prisma/seed.ts`.

**Run 1 — base neuve, code NON corrigé (`git stash` du correctif), aucun
blocage** — vert :

```
[seed +   0.4 s] affectation des interventions aux techniciens
[seed +   0.4 s] CODIMA-NC — interventions replacées : 28
[seed +   0.4 s] CODIMA-EU — interventions replacées : 28
```

Puis un blocage posé à la main (hors semis, comme le ferait un écran) sur le
technicien et le jour que la passe avait précisément donnés à deux
interventions CODIMA-EU (`01a0cad5-482b-783c-a13b-727ce33ac84b`, le
2026-09-21) :

```sql
INSERT INTO absence (id, societe_id, utilisateur_id, du, au, modifie_le)
VALUES (gen_random_uuid(), '0192f0a0-0000-7000-8000-000000000002',
        '01a0cad5-482b-783c-a13b-727ce33ac84b',
        DATE '2026-09-21', DATE '2026-09-21', now());
```

**Run 2 — même base, code NON corrigé** — ROUGE, reproduit l'incident exact
des exécutions #64 à #68 du flux hébergé :

```
[seed +   0.3 s] CODIMA-NC — interventions replacées : 28
PrismaClientUnknownRequestError:
Invalid `tx.intervention.update()` invocation in prisma/seed.ts:1425:33
PostgresError { code: "23514", message: "intervention_pas_sur_blocage_agenda
  — L'agenda de ce technicien est bloqué ce jour-là. …" }
```

État après le rouge : la transaction cloisonnée de CODIMA-EU est retombée
entièrement — vérifié par requête, CODIMA-EU restait à 28/31 interventions
avec technicien (l'état du run 1, rien de perdu, rien de la moitié écrit).

**Run 3 — même base, correctif restauré (`git stash pop`)** — VERT :

```
[seed +   0.3 s] CODIMA-NC — interventions replacées : 28 — sautées pour blocage d'agenda : 0
[seed +   0.3 s] CODIMA-EU — interventions replacées : 26 — sautées pour blocage d'agenda : 2
```

**Run 4 — immédiatement après, même base bloquée, sans rien changer entre les
deux** — VERT, mêmes chiffres exactement :

```
[seed +   0.3 s] CODIMA-NC — interventions replacées : 28 — sautées pour blocage d'agenda : 0
[seed +   0.3 s] CODIMA-EU — interventions replacées : 26 — sautées pour blocage d'agenda : 2
```

Le semis est donc **rejouable** sur une base qui porte déjà la démonstration
ET un blocage — la propriété que le flux hébergé exige et qu'aucun test
automatisé ne vérifiait avant ce lot.

**Ce que le comptage démontre encore** : la ligne « non affectées » reste
visible (CODIMA-NC : 28/31, CODIMA-EU : 26/31 — jamais 31/31), et le nombre
d'interventions affectées ne s'effondre pas : sur CODIMA-EU, deux
interventions sur trente et une sont sautées, pas vingt-huit.

## Ce que j'ai tranché et pourquoi

**Option retenue : SAUTER l'intervention dont le jour visé est bloqué pour le
technicien choisi, et la laisser telle quelle** — plutôt que de chercher un
autre technicien dans la même équipe d'agence. Les deux options étaient
recevables (l'arbitrage du ticket le dit explicitement). J'ai choisi la plus
simple à mesurer et à garder juste dans le temps : elle ne demande qu'une
lecture des blocages et une fonction déjà écrite et déjà testée
(`absenceCouvrant`), sans introduire de logique de rotation d'équipe ni de
risque qu'un deuxième, un troisième technicien soit aussi bloqué le même jour
— cas que l'option « rotation » devrait alors, elle aussi, traiter par un
abandon. C'est le même geste que le cas déjà existant « agence sans équipe » :
*une intervention arrive parfois avant qu'on sache qui ira, ou reste sans
personne le temps qu'un blocage se lève.*

**Le comptage sauté est journalisé séparément** (`sautées pour blocage
d'agenda : M`) plutôt que fondu dans le compte « replacées » : un lecteur du
journal du flux hébergé doit pouvoir voir, sans requêter la base, si la
démonstration porte des blocages actifs.

## Ce que je n'ai PAS fait

- Je n'ai pas essayé l'option « rotation vers un autre technicien de la même
  équipe » — voir ci-dessus.
- Je n'ai pas rejoué `prisma/seed.ts` lui-même sous le rôle applicatif
  restreint (non-superutilisateur, `FORCE ROW LEVEL SECURITY` mordant même
  sur le propriétaire — la recette de la mémoire
  `rejouer-roles-heberges-en-local`). Tenté une fois : le semis échoue
  **avant même** d'atteindre l'affectation, sur `tx.utilisateur.upsert()`
  (étape « utilisateurs internes »), refusé en `42501` — « new row violates
  row-level security policy for table "utilisateur" ». C'est un défaut
  mesuré, mais **hors de ce ticket** (la ligne visée par CE lot est bien plus
  bas dans le fichier, à l'étape « affectation », jamais atteinte dans cette
  configuration) — je ne l'ai pas touché, conformément à « tu ne touches QUE
  cette passe ». Je l'ai donc mesuré sous le rôle `postgres` (superutilisateur,
  qui contourne RLS mais laisse les déclencheurs intacts — ce sont eux qui
  sont en cause ici, pas une politique RLS), ce qui atteint bien l'affectation
  et reproduit fidèlement l'incident `23514`.
- Je n'ai pas ajouté de scénario qui pose un blocage PAR le chemin applicatif
  (`declarerAbsence`) avant de rejouer le semis : mon blocage de mesure a été
  inséré par SQL brut, comme le fait `bloquer-agenda-verrous.test.ts` déjà en
  place. En production réelle, poser un blocage à l'écran déplanifie aussi les
  interventions déjà posées sur ces jours-là (RG-PLA-06) dans la même
  transaction — ce que mon insertion brute ne fait pas. Cela ne change rien à
  la mesure du 23514 ni à la réparation (la passe ne sait de toute façon rien
  faire d'une ligne bloquée, planifiée ou non), mais la case exacte
  « intervention déjà planifiée sur un jour qui devient bloqué entre deux
  semis » n'a pas été rejouée par le chemin applicatif complet.

## Les pièges pour la session suivante

- **`prisma/seed.ts` refuse en `42501` sous un rôle propriétaire non
  superutilisateur**, à l'étape « utilisateurs internes »
  (`tx.utilisateur.upsert()`, ligne ~1149), AVANT même d'atteindre
  l'affectation — mesuré à la main le 23/09/2026 avec la recette
  `rejouer-roles-heberges-en-local`. Le commentaire du fichier à cet endroit
  dit que l'écriture est déjà pensée pour tourner sous `FORCE ROW LEVEL
  SECURITY` (contexte société + rôle `admin_societe` posés par
  `avecSocieteEtRole`) — la politique d'insertion sur `utilisateur` exige
  peut-être davantage (une variable de désignation ?) que ce que cette section
  pose. Ce défaut est réel, mesuré, mais n'a pas été creusé : il est hors
  territoire de ce lot. **Est-ce que le flux hébergé `DB migrate & seed`
  tourne sous un rôle superutilisateur ou sous un propriétaire restreint ?**
  Si c'est ce dernier, ce défaut casserait aussi le flux réel — à vérifier
  avant de le classer comme un simple angle mort de la mesure locale.
- La base jetable `codiplan_semis3_scratch` et les rôles `semis3_owner` /
  `semis3_bypass` ont été détruits après la mesure — rien n'en reste.
- Ne pas confondre `codiplan_test` (utilisée par `pnpm test` /
  `pnpm test:isolation` / `pnpm test:e2e`, memory `poste-alexis-bases-de-test`)
  avec une base de mesure manuelle : j'ai délibérément créé une base à part
  pour ne pas perturber la scène e2e.

## Ce qui reste à faire

- Rien de bloquant sur le périmètre de ce ticket : le semis est rejouable sur
  une base qui porte démonstration + blocage, et l'épreuve d'isolation
  (`tests/isolation/semis-affectation-agenda-bloque.test.ts`) fixe la forme
  d'écriture de la passe comme contrat — les trois scénarios passent contre
  `codiplan_test`, tout comme `pnpm test:isolation` dans son ensemble
  (112 fichiers, 1143 tests). `pnpm verify:full` est lancé avant ce commit ;
  son verdict complet est celui que la porte de sortie du ticket a laissé
  passer.
- Le défaut `42501` sur `tx.utilisateur.upsert()` sous un propriétaire non
  superutilisateur (voir « pièges » ci-dessus) mérite son propre ticket : il
  touche une étape bien plus tôt dans le semis que celle de ce lot, et sa
  gravité dépend de la réponse à la question posée plus haut sur le rôle réel
  du flux hébergé.
