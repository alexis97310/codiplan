# 9F5-AUDIT-FONCTIONNEL-PARCOURS — Passation

## Ce qui est construit, sur `main`

- **Point 1 — Harnais** : `playwright.audit-fonctionnel.config.ts`, `tests/audit-fonctionnel/mesures.ts`.
  Script `pnpm audit:fonctionnel`. Aucune dépendance neuve.
- **Point 2 — Balayage par rôle** : `tests/audit-fonctionnel/comptes.ts`, `balayage.spec.ts`.
  153 pages visitées (6 rôles), résultat dans `docs/audits/9F5-fonctionnel/balayage.json` /
  `balayage.md`.
- **Point 3(a) — Parcours P1 de bout en bout** : `tests/audit-fonctionnel/parcours-p1.spec.ts`,
  cinq étapes chaînées (créer → planifier → transmettre → terrain complet → clôturer → bon).
- **Point 3(c, d, e, f, i) — Parcours limites** : `tests/audit-fonctionnel/parcours-edge.spec.ts`,
  huit scénarios (date passée, pause méridienne × 2, deux onglets, rechargement, caractères
  spéciaux × 2, hors réseau).
- **Point 4 — Rapport** : `docs/audits/9F5-fonctionnel/rapport.md`, onze constats (2 GÊNANT,
  3 MINEUR, 1 conforme-à-une-décision, 5 conformes-vérifiés), cinq captures JPEG en viewport.
- **Point 5 — cette passation.**

## Points ouverts

1. **Arbitrage à ouvrir** (constat 2 du rapport) : planifier/transmettre sur une date déjà passée
   n'est jamais refusé ni averti — à trancher (avertissement informatif, ou décision volontaire à
   écrire dans `docs/arbitrages.md`).
2. **Trois correctifs mineurs proposés**, chacun sous 30 minutes (constats 1, 3, 4, 5 du rapport) —
   aucun n'a été appliqué (interdiction du lot).
3. **Non audité par manque de temps** : (b) demande→intervention (déjà couvert par trois fichiers
   e2e existants, non rejoué), (g) import avec rejets/réimport, (h) parc/VGP nouvelle machine.
4. **La note « CE QUI EXISTE » de ce ticket est partiellement périmée** : le hors réseau terrain
   (L3-07) n'est plus « bloqué au backlog » — voir constat 10 du rapport, et vérifier au prochain
   ticket qui citerait cette même note avant de la recopier.

## Fin de lot

`pnpm audit:fonctionnel` rejoué une dernière fois (après le correctif des deux gardiens) :
**19/19 verts**, mesuré à 22:43 (TZ Pacifique/Nouméa).

`CI=1 pnpm verify:full` en un appel : **n'a pas pu aller jusqu'au bout dans le budget de ce
lot** (§11 du protocole de session : « si `verify:full` n'a pas pu tourner, on l'écrit »). Deux
tentatives :
1. Lancée à 22:46, tuée après 55 min (12:33 UTC dans le journal) sans avoir fini
   `pnpm test:e2e` (1462 scénarios, un seul worker sous `CI=1`) — `pnpm format:check`,
   `pnpm typecheck`, `pnpm lint`, `pnpm test` (4862/4862) avaient déjà passé avant la coupure ;
   `pnpm test:isolation` et `pnpm build` n'ont pas pu être observés séparément dans cette tentative
   (noyés dans le flux). Journal : `/tmp/verify-full-9f5-run2.log` (hors dépôt).
2. Relancée en arrière-plan à 23:42 (PID du shell, journal `/tmp/verify-full-9f5-run3.log`, hors
   dépôt) pour ne pas bloquer la fin du lot — **toujours en cours au moment de rendre la main**,
   la limite de 150 minutes de cette session étant atteinte avant que `test:e2e` seul (qui, mesuré
   isolément via `pnpm audit:fonctionnel`, un harnais Playwright comparable, ne prend que
   quelques minutes — la différence vient du NOMBRE de scénarios : 1462 contre 19) n'ait eu le
   temps de tourner.

**Ce qui EST vérifié, séparément, sur ce commit** : `pnpm format:check`, `pnpm typecheck`,
`pnpm lint`, `pnpm test` (4862/4862), `pnpm audit:fonctionnel` (19/19). **Ce qui N'est PAS
vérifié depuis le dernier commit de ce lot** : `pnpm test:isolation`, `pnpm build`,
`pnpm test:e2e`, `pnpm feries:horizon`, `pnpm audit:partitions` — aucune raison de les croire
cassés (rien de ce lot ne touche `app/`, `components/`, `lib/`, `prisma/` — interdiction du
ticket, respectée), mais ils n'ont pas été REGARDÉS jusqu'au bout par cette session.

**Prochaine session : rejouer `CI=1 pnpm verify:full` en un appel, avec une marge d'au moins
90 minutes plutôt que les ≈50 minutes estimées par ce ticket — mesuré trop court sur cette
machine, probablement partagée avec d'autres sessions du dépôt (plusieurs ports PostgreSQL
jetables actifs en parallèle, voir `docker ps`).**

`git rev-parse --short HEAD` : `c1c1b8ba` (`9F5-AUDIT-FONCTIONNEL-PARCOURS — correctif : deux
gardiens du dépôt rougissaient sur mes propres fichiers`). `git status --porcelain` vide à cet
instant. Travail sur `HEAD` détaché, synchronisé avec `origin/main` au départ de la session
(voir note ci-dessous) — jamais poussé.

## Note sur `main` local et le détachement de `HEAD`

Cette session a commencé avec `HEAD` détaché, à l'identique d'`origin/main`, et la branche locale
`main` verrouillée par le worktree voisin (`/home/aplou/codiplan`) — impossible d'y basculer ici.
Convention déjà en usage dans ce worktree (visible dans l'historique des branches
`voie1-reste-<horodatage>`) : travailler sur `HEAD` détaché et laisser la file le récupérer,
plutôt que d'essayer de checkouter `main`. Les neuf commits de ce lot sont donc sur `HEAD`
détaché, atteignables depuis `a576f175` (le point de départ) — jamais perdus, mais pas non plus
sur une branche nommée tant que la file ne les a pas repris.
