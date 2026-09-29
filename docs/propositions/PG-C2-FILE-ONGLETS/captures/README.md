# Captures — PG-C2-FILE-ONGLETS

Audit du 27/09/2026 (constat I-4/I-5) ; spécification §3.4 ; décision QG-2 d'Alexis (ajouts
acceptés). La colonne « À planifier » ne montrait que la file sans date : les retards (PG-C1a),
les interventions sans durée et les suspendues n'y remontaient jamais, et l'ancienneté d'un
dossier n'était pas visible.

Prises par `tests/e2e/captures-pg-c2-file-onglets.spec.ts` (env `CAPTURES_PG_C2`), sur sa propre
scène (préfixe `PGC2CAP-`) : un client à un site, quatre interventions — une par population
(« à planifier », « en retard », « sans durée », « suspendue »).

- `colonne-a-planifier-avant-*.png` — rejoué sur le code d'AVANT ce ticket (`git worktree` sur le
  commit `35cf6ab`, le dernier avant ce ticket) : une seule colonne « À planifier », aucun onglet,
  aucun filtre de zone, aucune recherche, aucune ancienneté affichée.
- `colonne-<onglet>-apres-*.png` — après le commit `599c25c` (PG-C2-FILE-ONGLETS) : la colonne
  « À traiter » à quatre onglets à compteurs (À planifier, En retard, Sans durée, Suspendues), le
  filtre « Zone », la recherche (client, référence), et l'ancienneté de chaque carte
  (« Créée aujourd'hui »).

À 1280 et 375 px. L'onglet « En retard » à 375 px montre la colonne renvoyée SOUS la grille
(`order-2 lg:order-1`, comportement inchangé par ce ticket).
