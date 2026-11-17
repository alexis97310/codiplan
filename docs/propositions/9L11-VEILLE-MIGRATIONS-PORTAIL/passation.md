# 9L11-VEILLE-MIGRATIONS-PORTAIL — passation

Décision d'Alexis du 10/11/2026. Écrite en `docs/arbitrages.md` sous **D268**.

## Ce qui a été livré

1. **`scripts/lib/filiation-portail-technicien.ts`** (nouveau) — deux contrôles de veille, catalogue
   seul :
   - `ecartsPolitiquePortailFiliationRetiree` : la politique `utilisateur_lecture_filiation_portail`
     (retirée de `utilisateur` par 9J22A) ne doit pas exister. Lit `politiques`, déjà fourni par
     `SQL_POLITIQUES` — aucune requête de plus.
   - `ecartsNomTechnicienAfficheObligatoire` : `segment_travail.nom_technicien_affiche` doit rester
     `NOT NULL`. Nouvelle requête `SQL_COLONNE_NOM_TECHNICIEN_AFFICHE` (pg_attribute, même forme que
     `SQL_COLONNE_SOCIETE`).
2. **`scripts/veille-hebergee.mts`** — les deux contrôles sont câblés dans `observer()`. Le gardien
   `tests/unit/veille-hebergee.test.ts` les a réclamés automatiquement (périmètre inversé, D55) : aucune
   modification du gardien lui-même n'était nécessaire.
3. **Épreuves** : `tests/unit/db/filiation-portail-technicien.test.ts` (fonctions pures, lignes
   fabriquées) et `tests/isolation/9l11-filiation-portail-technicien.test.ts` (jumeau contre la vraie
   base de test, même protocole que `tests/isolation/politiques-rls.test.ts` — la faute est ÉCRITE dans
   une transaction ANNULÉE, le contrôle rougit, puis la transaction est défaite).

## Ce qui n'a PAS été livré, et pourquoi

Le ticket demandait un échec si « une ligne de `segment_travail` a `nom_technicien_affiche` vide ».
`pnpm veille` tourne sous le rôle applicatif, en lecture seule, **sans contexte société posé** (D55) :
une lecture directe de `segment_travail` y rend zéro ligne par construction (forme « interne » de I1,
D94), et ce zéro ne prouverait jamais qu'aucune ligne n'est vide. Aucune contrainte en base n'interdit
non plus la chaîne vide (`NOT NULL` empêche `NULL`, pas `''` ; aucun `CHECK … <> ''` n'a été posé sur
cette colonne, à la différence de `checklist_point_libelle_non_vide` sur une colonne comparable de
9K08).

Ce que la veille surveille à la place, et qui reste dans le même esprit — une dérive jouée à la main,
hors migration, sans que rien ne le dise — : que la colonne reste `NOT NULL`. Ajouter une contrainte
`CHECK` refusant la chaîne vide fermerait l'écart au niveau de l'écriture, mais c'est une migration, et
le ticket demande de s'arrêter plutôt que d'en poser une hors arbitrage. Consigné sous D268, avec sa
condition de réouverture.

## Vérifier la production (sans jamais afficher de chaîne de connexion)

```
pnpm veille
```

Lu les deux secrets GitHub Actions existants (`DATABASE_URL` du rôle applicatif, jamais celui de
migration) — aucune saisie manuelle de chaîne de connexion. Vert : les deux garanties tiennent encore.
Rouge « sécurité » (code 1) : la politique est revenue, ou la colonne n'est plus `NOT NULL` — le
rapport nomme laquelle. Rouge « liaison » (code 75) : la base n'a pas pu être jointe, rien n'est
constaté.

## Aucun écran touché

Aucune capture.

## Vérifications jouées en avant-plan pendant ce lot

`pnpm typecheck`, `pnpm test` (5960 tests), `pnpm test:isolation` (2291 tests), `CI=1 pnpm verify`
(format, typecheck, lint, test, test:isolation, build) — tous verts. `pnpm test:e2e` n'a pas été rejoué
(aucun écran touché) ; la file de nuit joue `verify:full` après ce lot.
