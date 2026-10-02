# Captures — 9CT-RETOUCHES-5

Prises par `tests/e2e/captures-9ct-retouches-5.spec.ts` (env `CAPTURES_9CT`), sur une scène
forgée en `beforeAll`, effacée en `afterAll` — préfixe `9CTCAP-` (I9).

- `*-avant-*.png` — rejoué sur le code d'AVANT ce lot (`git worktree` sur le commit
  `d19a9d0`, 9CS-EN-RETARD-VERT-A-ZERO — passation, le dernier commit avant ce lot).
- `*-apres-*.png` — après le dernier commit de code de ce lot (`778fae9`,
  9CT-RETOUCHES-5 — Transmettre toutes les planifiées prêtes exclut les passées).

## Ce que les deux paires montrent (décision d'Alexis du 02/10/2026, point 7, D141)

`confirmation-transmettre-toutes-*` — le dialogue de confirmation de « Transmettre toutes
les planifiées prêtes », ouvert, **jamais confirmé**. Le nombre de prêtes baisse de
**28** (avant) à **13** (après) : les Planifiées déjà passées — présentes dans le jeu de
démonstration du seed, qui en pose beaucoup sur des dates antérieures à aujourd'hui — ne
comptent plus parmi les prêtes.

`laissees-date-passee-*` — la liste permanente des laissées, sous la rangée de commandes.
Avant ce lot, elle ne nommait que 3 lignes « Sans heure ». Après, elle nomme en plus
toutes les Planifiées complètes mais datées d'avant aujourd'hui, avec le motif fermé
neuf « Date passée — à clôturer, annuler ou replanifier » — dont les deux lignes forgées
par le spec de captures (`9CTCAP — client`).

## Piège connu — la scène partagée du seed porte beaucoup de dates passées

Le jeu de démonstration (`prisma/seed.ts`) pose des Planifiées sur des dates qui
s'éloignent chaque jour un peu plus du jour où l'épreuve tourne ; le nombre exact de
lignes « Date passée » et le compte du bouton « Transmettre toutes » (ici 28 → 13)
dérivent donc avec le temps et ne sont pas un invariant à figer dans un test — seul le
sens du changement (moins de prêtes, plus de laissées nommées) est garanti, et c'est ce
que les tests unitaires et d'isolation du lot vérifient sur des dates fixes.
