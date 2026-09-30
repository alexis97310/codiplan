# Captures AVANT/APRÈS — 9CC-DEPLANIFIEE-1

Prises par `tests/e2e/captures-9cc-deplanifiee.spec.ts`, jamais à la main.

| | |
|---|---|
| **Commit AVANT** | `798a86c` — le dernier commit de `9CB-TP-UX1-3-COMPOSANTS`, avant le premier commit de ce ticket |
| **Commit APRÈS** | `ef8b409` — le commit « puce Déplanifiée dans la file et sur la fiche » |
| **Date de la prise** | 2026-09-30, ~03:00–03:10 UTC |
| **Base** | un PostgreSQL local et jetable, rempli par `pnpm db:seed` — aucune donnée réelle (I9) |
| **Scène** | une intervention `DEPL1-CAPTURE`, forgée par le spec lui-même, effacée en `afterAll` |

## Comment la rejouer

AVANT (sur l'ancien code, le spec compile sur les deux) :

```bash
git worktree add /tmp/9cc-avant 798a86c
ln -s "$(pwd)/node_modules" /tmp/9cc-avant/node_modules
cp .env /tmp/9cc-avant/.env
cp tests/e2e/captures-9cc-deplanifiee.spec.ts /tmp/9cc-avant/tests/e2e/
cd /tmp/9cc-avant && pnpm exec prisma generate   # le client DOIT correspondre au schéma visé
E2E_DATABASE_URL=… CI=1 pnpm exec playwright test tests/e2e/captures-9cc-deplanifiee.spec.ts
cd - && git worktree remove /tmp/9cc-avant --force && pnpm db:generate  # revenir au schéma courant
```

APRÈS (sur `HEAD`) :

```bash
E2E_DATABASE_URL=… pnpm exec playwright test tests/e2e/captures-9cc-deplanifiee.spec.ts
```

**Piège mesuré en écrivant cette recette** : `node_modules` symlinké porte un
SEUL `@prisma/client` généré — celui du dernier `prisma generate` exécuté,
quel que soit le worktree. Sans régénérer dans `/tmp/9cc-avant` avant de
lancer le spec, le client (nouveau) référence des colonnes que la base
migrée par l'ancien code n'a pas encore : `P2022`, `the column
intervention.deplanifiee_date does not exist`. Toujours régénérer après
avoir changé de commit, dans les deux sens.

## Les images

| Fichier | Ce qu'on y voit |
|---|---|
| `planning-file-a-planifier-avant-1280.png` | La carte « À planifier » de l'intervention DEPL1-CAPTURE, **avant** ce ticket — rien ne dit qu'une absence l'a déplanifiée. |
| `planning-file-a-planifier-apres-1280.png` | La même carte, **après** — la puce « Déplanifiée — absence de … le JJ/MM » et l'ancien créneau. |
| `fiche-intervention-avant-1280.png` | La fiche de l'intervention, **avant** — « À planifier », sans plus. |
| `fiche-intervention-apres-1280.png` | La même fiche, **après** — la mention sous « Date planifiée », avec le nom résolu côté serveur et l'ancien créneau. |
| `absences-texte-levee-avant-1280.png` | `/absences`, **avant** — l'explication de la levée dit encore « elles ne savent plus où elles étaient ». |
| `absences-texte-levee-apres-1280.png` | La même page, **après** — « elles gardent la mention de leur ancien créneau ». |

## Mesure

Aucun outil de mesure automatique (`scripts/captures.mts`) n'a été employé
ici : ce spec est un scénario e2e dédié, pas une prise de vue générique de
tout l'écran. Vérifié visuellement sur les six images ci-dessus : aucun
texte sous 12 px nouveau (le jeton de 9BZ-TP-UX1-1-ECHELLE est repris tel
quel, `text-[12px]`), aucune couleur nouvelle (D124).
