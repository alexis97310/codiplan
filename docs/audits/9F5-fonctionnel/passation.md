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

`pnpm audit:fonctionnel` rejoué une dernière fois : <!-- complété ci-dessous après exécution -->

`CI=1 pnpm verify:full` : <!-- complété ci-dessous après exécution -->

`git rev-parse --short HEAD` : <!-- complété ci-dessous -->
