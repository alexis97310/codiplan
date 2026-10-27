# 9H5-CORRECTIFS-9G6 — passation

Repris sous **9H5A-REPRISE-9H5** après deux recalages de 9H5 (arrêté sans passation à la
limite de 90 min le 27/10 23:31, puis recalé deux fois de suite par la même épreuve
`liens-fiches.spec.ts:85`). Les quatre commits de 9H5 (garde `9H5-CORRECTIFS-9G6-garde`)
ont été reportés tels quels sur `origin/main` (cherry-pick propre, aucun conflit) ; seule
l'épreuve qui recalait a été corrigée ici.

## L'épreuve qui recalait

`tests/e2e/liens-fiches.spec.ts:85` lisait `ficheMachine` (le chemin de la fiche machine,
attendu par `?depuis=`) juste après `await ficheComplete.click()`, avant la fin de la
navigation `/parc` → `/parc/<id>` : `page.url()` pouvait encore porter l'ancienne adresse.
L'application renvoyait le bon chemin dans les deux vérifications indépendantes du pilote
(1647/1646 épreuves vertes, un seul échec identique aux deux passages) — c'est la mesure,
pas le correctif, qui était fausse. Correction : un `await page.waitForURL(/\/parc\/[^/?]+$/)`
avant de lire `page.url()` (commit `6846e7d77`). Rejoué `CI=1 --workers=1 --repeat-each=3` :
9/9 vert.

## Les trois points du contrat

| Point | Mesuré avant (régression sur `eb193dce0`) | Fait | Preuve |
|---|---|---|---|
| 1. Redirection ouverte (sécurité) | `cheminDeRetour` n'écartait que `//` et `://` ; `/\evil.com`, `%5C`, une tabulation ou un retour chariot après le premier `/`, `%2F%2F`, `https:` passaient intacts | Liste fermée `PREFIXES_RETOUR_INTERNES` (`/planning`, `/clients/`, `/sites/`, `/parc/`, `/interventions`) ; tout le reste retombe sur `/planning` | `tests/e2e/9g6-point2-retour.spec.ts` — 6 cas (`\`, `%5C`, tabulation, retour chariot, `%2F%2F`, `https:`) + `//` et URL externe (tests déjà présents), tous verts |
| 2. `?depuis=` inerte | Aucun appelant (`clients/[id]`, `sites/[id]` ×2, `parc/[id]`) n'émettait `depuis` ; « Annuler » et le fil d'ariane retombaient toujours sur `/planning` | Les quatre liens « + Intervention » portent `&depuis=<chemin de la fiche>` (encodé) ; le libellé du fil d'ariane suit l'origine (Client/Site/Machine) | `tests/e2e/9g6-point2-retour.spec.ts` (libellés), `creation-depuis-client-tpa1.spec.ts`, `fiche-360-1.spec.ts`, `liens-fiches.spec.ts` (ce dernier corrigé ci-dessus) |
| 3. Enrôlement, saisie automatique | `Champ` posait `new-password` par défaut sur tout champ password, y compris celui d'`/enrolement` qui demande le mot de passe EXISTANT (régression depuis `current-password` sur `25ec289c`) | `autoComplete="current-password"` posé explicitement sur ce champ dans `app/(sans-session)/enrolement/page.tsx` | `tests/e2e/enrolement-secrets-hors-url.spec.ts` |

## Captures — AVANT/APRÈS, 375 et 1280 px

```
-rw-r--r-- 55397  enrolement-apres-1280.png
-rw-r--r-- 28477  enrolement-apres-375.png
-rw-r--r-- 55397  enrolement-avant-1280.png
-rw-r--r-- 28477  enrolement-avant-375.png
-rw-r--r-- 119930 nouvelle-intervention-depuis-client-apres-1280.png
-rw-r--r-- 86257  nouvelle-intervention-depuis-client-apres-375.png
-rw-r--r-- 119883 nouvelle-intervention-depuis-client-avant-1280.png
-rw-r--r-- 86229  nouvelle-intervention-depuis-client-avant-375.png
```

- **Enrôlement** : AVANT et APRÈS ont une taille **identique** (octet pour octet attendu —
  `autoComplete` ne change aucun pixel rendu). L'écran reste le témoin demandé par le
  ticket, le défaut étant invisible à l'œil.
- **Nouvelle intervention depuis la fiche client** : AVANT et APRÈS diffèrent légèrement
  (119883→119930, 86229→86257), cohérent avec le changement attendu — le fil d'ariane
  affiche désormais « Client » (origine réelle) au lieu de « Planning », et « Annuler »
  pointe vers la fiche client plutôt que vers `/planning`.

## Vérification finale

Voir `verify-final.txt` dans ce même dossier pour la sortie complète de `pnpm verify:full`.
