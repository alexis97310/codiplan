# Captures — PG-A1-FERIES-GRILLE

Vue Semaine et vue Jour du planning (`/planning`), sur le jeu de démonstration (`pnpm db:seed`,
compte `adv@codima.test`, société CODIMA-NC) — aucune scène forgée : le férié qui manque à la
démonstration est déjà dans le semis, « Fête de la citoyenneté », le 24 septembre, territoire NC
(`prisma/seed-data.ts:364`).

Prises par `tests/e2e/captures-pg-a1-feries-grille.spec.ts` (env `CAPTURES_PG_A1`) :

- `semaine-*-avant-*.png` / `jour-*-avant-*.png` — rejoué sur le code d'AVANT ce ticket
  (`git worktree` sur le commit `1dcb16f`, PG-0-DOCS, le dernier avant PG-A1-FERIES-GRILLE) :
  - vue Semaine du 21/09/2026 : la colonne « JEU 24 » n'est ni tramée ni annotée — le férié
    chômé s'y lit comme un jour ordinairement ouvert.
  - vue Jour du 24/09/2026 : l'en-tête annonce « 4 techniciens · 64 créneaux libres » — la
    journée entière du férié se lit comme une journée normalement ouverte.
- `semaine-*-apres-*.png` / `jour-*-apres-*.png` — après le commit
  `PG-A1-FERIES-GRILLE` (empreinte `4496d00`) :
  - vue Semaine : la colonne « JEU 24 férié » est tramée comme les autres jours fermés.
  - vue Jour : l'écran affiche « Aucune intervention posée ce jour-là » — l'axe est vide,
    aucun créneau libre n'est compté sur un jour chômé.

À 1280 et 375 px.

**Non observé à 375 px sur la vue Semaine** (`semaine-21-09-2026-avant-375.png` et
`semaine-21-09-2026-apres-375.png` sont des fichiers IDENTIQUES, `md5sum` à l'appui) : sous
`lg`, c'est `ListeSemaine` qui prend le relais, et elle ne montre AUCUNE ligne pour un jour vide
— fermé compris (« un jour vide n'a pas de ligne — le jour fermé compris », `page.tsx`). Le
férié du 24/09 ne porte aucune intervention active dans le semis ; il n'y a donc rien à montrer
à cette largeur, avant comme après. Le défaut et sa correction ne sont visibles qu'à 1280 px, où
la grille garde une case par jour même vide.
