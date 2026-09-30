# Captures — 9CF-PG-G11-JOUR-FRISE (QG-3/D142)

Prises par `tests/e2e/captures-pgd1-jour-frise.spec.ts`, jamais à la main.

| | |
|---|---|
| **Commit APRÈS** | dernier commit de code de ce ticket (voir `git log`) |
| **Commit AVANT** | NON REJOUÉ — voir « Ce qui manque » ci-dessous |
| **Base** | un PostgreSQL local et jetable, rempli par `pnpm db:seed` — aucune donnée réelle (I9) |
| **Scène** | deux interventions posées par le spec sur Koné/mardi (une avec créneau, une sans heure), retirées en `afterAll` |

## Fichiers

- `jour-frise-apres-1280.png`, `-1024.png`, `-375.png` — la frise : techniciens en lignes, heures en colonnes, la ligne « Journée — heure non fixée » en tête, le défilement horizontal contenu dans son propre cadre à 375 px.
- `jour-frise-agenda-bloque-apres-1280.png` — NON PRÉSENT cette exécution : le semis n'avait pas placé le blocage d'agenda de Weber sur le jeudi de la semaine réelle où le spec a tourné (la date dépend d'AUJOURD'HUI, comme `reperesDeLaScene`). Le scénario ne le traite pas comme une erreur — il photographie seulement quand la donnée existe.

## Ce qui manque, et pourquoi

**Les captures AVANT n'ont pas été prises**, faute de temps dans cette session. La recette (même modèle que `docs/propositions/9CC-DEPLANIFIEE-1/captures/README.md`) :

```bash
git worktree add /tmp/9cf-avant 6ad8e45a   # le commit mesuré en tête du ticket
ln -s "$(pwd)/node_modules" /tmp/9cf-avant/node_modules
cp .env /tmp/9cf-avant/.env
cp tests/e2e/captures-pgd1-jour-frise.spec.ts /tmp/9cf-avant/tests/e2e/
cp tests/e2e/setup/scene-glisser.ts /tmp/9cf-avant/tests/e2e/setup/ 2>/dev/null || true
cd /tmp/9cf-avant && pnpm exec prisma generate
E2E_DATABASE_URL=postgresql://postgres@127.0.0.1:5433/codiplan_test \
  pnpm exec playwright test tests/e2e/captures-pgd1-jour-frise.spec.ts
cd - && git worktree remove /tmp/9cf-avant --force && pnpm exec prisma generate
```

**Piège attendu** (mesuré sur 9CC, même famille) : régénérer le client Prisma
après CHAQUE changement de worktree — `node_modules` symlinké ne porte qu'un
seul client généré à la fois.

Une capture du GLISSER EN COURS (bouton de souris enfoncé, case survolée) n'a
pas non plus été prise — même raison.
