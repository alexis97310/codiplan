# Captures — 9CO-PG-G14A-TRANSMETTRE (D141, QG-5)

Prises par `tests/e2e/captures-9co-pg-g14a-transmettre.spec.ts` (env `CAPTURES_PGG14A`), sur sa
propre scène (préfixe `PGG14ACAP-`), 30 semaines dans le futur pour éviter toute collision avec le
semis ou avec une autre épreuve e2e.

| | |
|---|---|
| **Commit** | `ffa3b92` — le dernier commit de code de ce ticket avant les captures |
| **Date de la prise** | 2026-10-02, ~10h10 UTC |
| **Base** | PostgreSQL 16 local et jetable (`E2E_DATABASE_URL`), rempli par `prisma migrate deploy` + `pnpm db:seed` — aucune donnée réelle (I9) |

## Comment elles ont été prises — AVANT/APRÈS LE GESTE, PAS UNE COMPARAISON DE COMMIT

Ce ticket **ajoute** un geste (« Transmettre au technicien ») sans en modifier aucun autre à
l'écran — contrairement aux tickets de retouche qui comparent `git worktree` avant/après un
commit, la paire AVANT/APRÈS la plus honnête ici est celle de la **même fiche, avant et après avoir
cliqué le bouton**, sur le code livré. Le tiroir n'a qu'un seul écran demandé par le ticket (« sur
une Planifiée ») : il est capturé **avant** le clic — après, le bouton disparaît puisque la ligne
n'est plus Planifiée, ce que la fiche prouve déjà par sa propre paire avant/après.

## Les écrans

- `fiche-planifiee-actions-avant-{1280,375}.png` — la fiche d'une intervention **Planifiée**, bloc
  Actions : « Transmettre au technicien » est l'action PRINCIPALE (ouverte), « Affecter un
  technicien » secondaire et repliée dans un `<details>`.
- `fiche-affectee-apres-{1280,375}.png` — la MÊME fiche après un clic sur « Transmettre au
  technicien » : statut **Affectée**, bandeau « Le technicien a été prévenu par courriel. »,
  aucune action principale (93-FICHE-ACTIONS, inchangé).
- `tiroir-planifiee-transmettre-{1280,375}.png` — le tiroir du planning (PG-C5) ouvert sur cette
  même intervention, encore Planifiée : le bouton « Transmettre au technicien » apparaît au-dessus
  de « Poser… » et « Remettre dans la file ».
