# 9CX-RETOUCHES-7 — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

1. `tests/e2e/captures-9cs-en-retard-vert-a-zero.spec.ts` (commentaire seul, aucun code) —
   le commentaire affirmait que le seed ne pose jamais d'intervention « en retard » et que
   la tuile s'y lit à 0. C'est faux (mesuré ci-dessous). Le commentaire dit maintenant le
   fait mesuré — le compte est RELATIF à aujourd'hui, jamais nul, et la tuile reste rouge
   dans ces captures — et nomme le test unitaire comme seule preuve du ton vert à zéro.
   Pour l'exploitation : personne ne sera surpris de voir la tuile rouge dans
   `docs/propositions/9CS-EN-RETARD-VERT-A-ZERO/captures/`, le commentaire du spec le dit
   désormais lui-même au lieu de le contredire.
2. `scripts/lib/donnees-hors-seed.ts` — `rapportHorsSeed` prend un second paramètre
   optionnel `flux: "migration" | "nettoyage"` (défaut `"migration"`, sortie inchangée à
   l'octet près). En `"nettoyage"`, la dernière phrase du verdict « seed seul » ne parle
   plus d'« exécution automatique ».
3. `scripts/nettoyer-doublons-machine-demo.mts` — appelle maintenant
   `rapportHorsSeed(verdictSeed, "nettoyage")`, et le message de refus dit « rien n'a été
   ÉCRIT sur « intervention_machine » » au lieu de « rien n'a été lu ni écrit » (elle AVAIT
   été lue, voir mesure ci-dessous). Pour l'exploitation : qui lit la sortie de ce script à
   la main ne confondra plus ce refus manuel avec le refus automatique de
   `refus-si-donnees-reelles.mts`, et ne croira plus que la lecture n'a pas eu lieu.
4. `.github/workflows/db-doublons-machine-demo.yml` — ajout d'un bloc `permissions:
   contents: read` au job `nettoyer` (checkout seul, aucune écriture GitHub). Pour
   l'exploitation : ce flux n'a plus de jeton à droits par défaut (lecture/écriture) tant
   qu'un bloc `permissions` ne les restreint pas explicitement.
5. `tests/unit/ci/doublons-machine-demo.test.ts` et `tests/unit/ci/donnees-hors-seed.test.ts`
   — tests neufs pour les points 2, 3 et 4 (voir ci-dessous).

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- **Point 1** : `pnpm playwright test tests/e2e/captures-9cs-en-retard-vert-a-zero.spec.ts`
  (seed + 2 épreuves, vert) puis, contre `codiplan_test` fraîchement semée, une requête SQL
  reproduisant exactement `enRetard` (`lib/interventions/retard.ts` : statut `planifiee` ou
  `affectee`, `date_planifiee` strictement avant aujourd'hui en Pacific/Noumea, aucun
  `segment_travail`) : **CODIMA-NC 18**, **CODIMA-EU 11**, mesuré le 03/10/2026. Le README
  du lot 9CS (mesuré sur un autre commit, un autre jour) disait 15 pour CODIMA-NC — les deux
  chiffres sont vrais chacun pour son jour, ce qui confirme que le compte est relatif à
  aujourd'hui et ne doit pas être figé dans un commentaire. `adv@codima.test` (compte de ce
  spec) est rattaché à CODIMA-NC.
- **Point 3** : relecture de `scripts/nettoyer-doublons-machine-demo.mts` — `lireEtatBase`
  lit `societe` ET `intervention_machine` (`SQL_RATTACHEMENTS`) dans LA MÊME transaction,
  AVANT le calcul de `verdictSeed`. Donc même dans la branche de refus (verdict ≠
  `seed_seul`), `intervention_machine` a déjà été lue — seule l'écriture ne s'est pas
  produite. D'où le texte corrigé, qui ne nie que l'écriture.
- Après corrections : `pnpm format:check` vert, `pnpm test` vert (365 fichiers, 3756 tests).

## Ce que j'ai tranché et pourquoi

- **Portée du paramètre `flux`** : je ne l'ai appliqué qu'à la dernière phrase du verdict
  « seed seul » (celle que le constat citait littéralement), pas à la branche
  `donnees_reelles` (qui parle de « la migration reste à jouer à la main » — une phrase
  pensée pour le flux de migration automatique, mais que le constat n'a pas signalée comme
  trompeuse pour le nettoyage, et que ce script recouvre déjà de son propre message
  « REFUSÉ »). Changer plus que ce que le constat nomme aurait dépassé le territoire du
  lot.
- **Texte du point 3** : j'ai écrit « elle a bien été lue, comme « societe » (verdict
  ci-dessus) » plutôt que de prétendre que le contenu d'`intervention_machine` est affiché
  ci-dessus — seul le verdict sur `societe` l'est. La phrase reste donc restreinte à ce qui
  est vrai et vérifiable depuis la sortie elle-même.

## Ce que je n'ai PAS fait

- Je n'ai pas touché `scripts/refus-si-donnees-reelles.mts` : son appel à `rapportHorsSeed`
  ne passe pas de second argument, donc reçoit le défaut `"migration"` et son texte est
  inchangé à l'octet près (testé : `rapportHorsSeed(verdict) === rapportHorsSeed(verdict,
  "migration")`).
- Je n'ai pas touché `db-migrate.yml` ni `db-resolve.yml` — hors territoire du lot, voir
  piège ci-dessous.
- Je n'ai pas changé la mise en scène ni l'assertion d'aucune épreuve e2e étrangère au lot ;
  aucune épreuve étrangère n'a rougi pendant ce travail.
- Je n'ai pas touché `prisma/seed.ts` : les commentaires de ses lignes 655 et 1107 restent
  tels quels (ils parlent de dates qui vieilliraient, pas de la tuile « en retard » — le
  rapprochement que faisait l'ancien commentaire du spec était une erreur du lot précédent,
  pas de ces lignes).

## Les pièges pour la session suivante

- **`db-migrate.yml` et `db-resolve.yml` n'ont PAS de bloc `permissions:` non plus** —
  mesuré par `grep -n "permissions:" .github/workflows/db-migrate.yml
  .github/workflows/db-resolve.yml` (aucune sortie). Le constat de ce lot les plaçait
  explicitement hors territoire ; ils restent donc à traiter par un lot dédié.
- **Le compte « en retard » de la démonstration bouge chaque jour** (dates replacées par
  rapport à aujourd'hui à chaque semis) : toute future capture ou tout futur commentaire qui
  cite un nombre pour cette tuile sera faux le jour suivant. N'écrire ce compte que comme
  « non nul », jamais comme une valeur figée.
- Le conteneur `codiplan-pg16` (port 5433) était déjà debout et `TEST_DATABASE_URL` /
  `E2E_DATABASE_URL` pointaient dessus — j'ai relancé le spec Playwright du lot 9CS pour
  réensemer avant de mesurer par SQL direct ; voir aussi la mémoire
  `poste-alexis-bases-de-test`.

## Ce qui reste à faire

- Rien dans le périmètre de ce lot. Hors périmètre : ajouter `permissions:` à
  `db-migrate.yml` et `db-resolve.yml` (signalé ci-dessus, pas ouvert ici).
