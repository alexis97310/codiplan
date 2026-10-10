# 9E0-E2E-DIMANCHE-PG-G16 — passation

## Ce que j'ai changé

`tests/e2e/pg-g16-statut-ressource.spec.ts` ouvrait `/planning?vue=jour` **sans**
`jour=`. Dimanche, l'agence Ducos est fermée, la vue Jour n'affiche aucun
technicien, et l'assertion sur la ligne du technicien patenté échoue — la
suite e2e rougit chaque dimanche, heure de Nouméa.

Le spec ouvre désormais `/planning?vue=jour&jour=<clé du prochain lundi>` et
`/planning?vue=semaine&semaine=<même clé>`, par le même calcul que
`cleDuProchainLundi()` dans `tests/e2e/absences-ecourter-etat.spec.ts`. Aucun
utilitaire partagé n'existe dans `tests/e2e/setup/` pour cette fonction : copie
locale commentée, comme autorisé par le ticket. Aucune assertion retirée,
élargie ni affaiblie.

## Avant / après (mesuré CE dimanche, 11/10/2026, Pacific/Noumea)

**AVANT** (02:16) — `pnpm exec playwright test tests/e2e/pg-g16-statut-ressource.spec.ts` :

```
✘  1 … › créer un technicien PATENTÉ, et le voir avec son badge dans la liste et sur le planning (9.0s)
Error: expect(locator).toBeVisible() failed
Locator:  locator('td, th, p, li').filter({ hasText: 'Technicien patenté de l\'épreuve' }).first()
Expected: visible
Received: hidden
    at .../pg-g16-statut-ressource.spec.ts:182:39
  1 failed
  1 did not run
```

**APRÈS** — rejoué 3 fois de suite, même dimanche : 2 passed chaque fois
(02:19, 02:20, 02:21).

Puis `CI=1 pnpm verify:full` rejoué en entier, le même dimanche (02:26 → 03:12,
e2e seul 46.6 min) : `format:check`, `typecheck`, `lint`, `test` (4597 tests),
`test:isolation` (1524 tests), `build`, `feries:horizon`, `audit:partitions`
et `test:e2e` (1197 passed, 48 skipped, **0 failed**) tous verts. **Aucun
autre spec e2e du dépôt n'est tombé pour cause de dimanche** : `pg-g16` était
le seul.

## Ce que j'ai tranché et pourquoi

- **Copie locale plutôt qu'utilitaire partagé** : un seul autre fichier
  (`absences-ecourter-etat.spec.ts`) porte aujourd'hui `cleDuProchainLundi` ;
  le ticket autorise explicitement la copie locale commentée quand aucun
  utilitaire n'existe déjà dans `tests/e2e/setup/`. Factoriser pour deux
  occurrences aurait été une abstraction non demandée — si un troisième spec
  venait à en avoir besoin, ce serait le moment de la monter dans
  `tests/e2e/setup/`.
- **La vue Semaine aussi corrigée**, bien qu'elle passait déjà ce dimanche-là
  (la semaine ISO courante d'un dimanche contient encore les jours ouvrés
  qui le précèdent) : la laisser sur l'implicite aurait réintroduit le même
  défaut un dimanche où la semaine affichée serait entièrement fermée (aucun
  cas de ce genre dans la scène actuelle, mais rien ne le garantit demain).

## Ce que je n'ai PAS fait

- Aucun code applicatif, aucune migration, aucune décision D — conforme aux
  interdits du ticket.
- Aucun nouveau fichier de capture : `CAPTURES_PG_G16` n'était pas positionné,
  le spec ne capture donc rien dans cette passation.
- Aucun fichier étranger au lot committé : `CI=1 pnpm verify:full` a modifié ou
  créé 187 fichiers de captures PNG/PDF dans des dizaines de dossiers
  `docs/propositions/*/captures/` étrangers à ce ticket (effet de bord connu,
  déjà documenté par `9DW-E2E-DIMANCHE/passation.md`) — tous restaurés
  (`git checkout --` sur les fichiers modifiés, `rm` sur les fichiers
  nouveaux) avant ce commit, fichier par fichier, aucun répertoire entier.

## Ce qui reste à faire

Rien d'identifié : le seul spec fautif est corrigé, vérifié 3 fois à l'unité
puis par une suite e2e complète, le même dimanche réel, sans y introduire de
dimanche artificiel.
