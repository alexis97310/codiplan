# Captures — 9BL-TP-A1-HISTORIQUES-CLIENT-SITE

Prises le 29/09/2026 (NC), sur le commit `77f2eae` (« 9BL-TP-A1-HISTORIQUES-CLIENT-SITE — spec de captures AVANT/APRES »).

Scène de démonstration dédiée (`CAP9BL-`), jamais une donnée de production (I9) : un client à un site, quatre interventions — deux ouvertes sans date (p1, p4), deux datées (2026, 2020). Créée et supprimée par `tests/e2e/captures-9bl-tp-a1-historiques.spec.ts`.

AVANT = commit `cb9daf8` (parent du lot, dans un worktree jetable), APRÈS = ce lot. Même spec rejouée deux fois, jamais deux fichiers distincts.

## Fichiers

- `fiche-site-avant/apres-{1280,375}.png` — fiche `/sites/[id]` : l'historique (ordre inversé, CS29/CS9), les tuiles « Équipements »/« Interventions ouvertes » devenues des liens.
- `fiche-client-avant/apres-{1280,375}.png` — fiche `/clients/[id]` : même chose.
- `nouvelle-intervention-client-avant/apres-{1280,375}.png` — `/interventions/nouvelle?client=<id>` : le site unique du client, présélectionné (vide sur l'AVANT, où le paramètre n'existait pas).

## Ce que les captures montrent

Sur la fiche site/client, l'AVANT range les interventions par date décroissante, la file d'attente (sans date) en bas. L'APRÈS range les deux ouvertes sans date en tête — la plus urgente (p1) avant la moins urgente (p4) — puis les datées par récence. Le texte sous le tableau (fiche site) est passé de « la plus récente en tête ; celles qui restent à planifier en bas » à « celles qui restent à planifier en tête ; la plus récente ensuite ».
