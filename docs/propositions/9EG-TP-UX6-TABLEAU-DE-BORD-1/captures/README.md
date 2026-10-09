# Captures — 9EG-TP-UX6-TABLEAU-DE-BORD-1

Commit photographié : `5e8180a3` (sur `0095483b`, le commit de code de ce lot).
Date : 09/10/2026.

Scène de **démonstration** (le semis, `pnpm db:seed`), jamais une donnée de
production — comptes ADV, responsable matériel (`rm@codima.test`) et
responsable SAV (`rs@codima.test`) de `tests/e2e/setup/scene.ts`.

## Ce qui manque, et pourquoi

**Les captures AVANT n'ont pas été prises avant de commencer** — un oubli de
cette session, à son tout début, avant la première modification de code. Le
dossier ne porte donc que les captures APRÈS (`apres-*`). L'écran d'avant ce
lot reste décrit par le constat du corps du ticket (quatre tuiles fixes,
« Non calculé », aucune composition par rôle) et par `git show
8e9b760a:app/\(back-office\)/tableau-de-bord/page.tsx`.

## Fichiers

- `apres-adv-1280.png` / `apres-adv-375.png` — vue ADV.
- `apres-responsable-materiel-1280.png` / `apres-responsable-materiel-375.png` — vue responsable matériel.
- `apres-responsable-sav-1280.png` / `apres-responsable-sav-375.png` — vue responsable SAV.

Prises par `tests/e2e/captures-9eg1-tableau-de-bord.spec.ts`
(`CAPTURES_9EG1=<dossier> pnpm exec playwright test
tests/e2e/captures-9eg1-tableau-de-bord.spec.ts`).
