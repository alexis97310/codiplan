# Captures — 9CP-PG-G14B-TRANSMETTRE-GROUPE (D141, paragraphe 14B)

Prises par `tests/e2e/captures-9cp-pg-g14b-transmettre-groupe.spec.ts` (env `CAPTURES_PGG14B`),
sur sa propre scène (préfixe `PGG14BCAP-`), datée du prochain jour ouvert calculé en direct
(`prochainJourOuvert`) pour que « demain » corresponde toujours à ce que l'écran affiche, quel
que soit le jour où l'épreuve tourne.

| | |
|---|---|
| **Commit** | `8d259e7` — le dernier commit de code de ce ticket avant les captures |
| **Date de la prise** | 2026-10-02, ~01h41 UTC |
| **Base** | PostgreSQL 16 local et jetable (`E2E_DATABASE_URL`), rempli par `prisma migrate deploy` + `pnpm db:seed` — aucune donnée réelle (I9) |

## Les écrans

- `en-tete-semaine-{1280,375}.png` — l'en-tête du planning, vue Semaine, avec les deux boutons
  « Transmettre demain (n) » et « Transmettre toutes les planifiées prêtes (n) » dans la rangée de
  commandes, jamais dans `actions`. Le bloc « Laissées, à compléter » apparaît en permanence
  au-dessus de la grille dès qu'il y a au moins une ligne à nommer (données de démonstration du
  semis, visibles même sans la scène forgée par ce spec).
- `en-tete-jour-{1280,375}.png` — même en-tête, vue Jour, sur le jour « demain » calculé par
  l'oracle.
- `dialogue-transmettre-demain-{1280,375}.png` — le dialogue ouvert : les Planifiées prêtes
  groupées par technicien (ici D. Garnier et J. Lemaître/M. Perrin de la démonstration, puis le
  groupe `PGG14BCAP-`), **aucune case cochée d'avance**, « Tout cocher » par groupe, et la liste
  « Laissées, à compléter » du jour, chacune avec son motif et un lien vers sa fiche — non
  cochables.
- `compte-rendu-transmission-{1280,375}.png` — LA MÊME page, après avoir coché la seule
  intervention forgée par ce spec et cliqué « Transmettre la sélection » : le compte « Transmettre
  demain » descend de 1, et le bandeau affiche « 1 intervention transmise. 1 technicien prévenu par
  courriel. ». **« Transmettre toutes les planifiées prêtes » rend exactement le même bandeau**,
  avec ses propres nombres (`texteCompteRenduTransmission`, composition partagée) — il n'est pas
  capturé une seconde fois pour cette raison.
- `confirmation-transmettre-toutes-{1280,375}.png` — le dialogue de confirmation de « Transmettre
  toutes les planifiées prêtes », ouvert, nommant le nombre de prêtes et de laissées de TOUTE la
  société. **Jamais confirmé** : ce bouton transmettrait aussi les données de démonstration du
  semis, ce qu'aucun scénario de ce dépôt ne doit faire. Le spec clique « Revenir » juste après la
  capture.
