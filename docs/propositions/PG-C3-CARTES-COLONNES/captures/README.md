# Captures — PG-C3-CARTES-COLONNES

Prises par `9BJA-REPRISE-9BJ` (29/09/2026) : 9BJ avait livré PG-C3-CARTES-COLONNES sans les prendre
(passation de 9BJ, « Ce que je n'ai PAS fait » — le temps du lot était consacré à l'implémentation,
aux gardiens rencontrés et à la couverture automatisée). Même recette que les autres captures
AVANT/APRÈS du dépôt (`tests/e2e/captures-pg-c3-cartes-colonnes.spec.ts`, env `CAPTURES_PG_C3`) :
rien n'est écrit sans une variable d'environnement qui nomme le dossier, et AVANT/APRÈS se prend
en rejouant ce même fichier deux fois — une fois sur le code d'avant le ticket (`git worktree`
sur le commit `940cc53`, le dernier avant la branche `9BJ-PG-G10-CARTES-CHARGE-garde`), une fois
sur le code livré (commit `cc806ac`, 29/09/2026).

Scène de DÉMONSTRATION seulement (consigne du ticket de reprise) : aucune donnée forgée, la
semaine courante du jeu de démonstration (`prisma/seed.ts`).

- `vue-semaine-avant-1280.png` / `vue-semaine-apres-1280.png` — la grille Semaine à 1280 px. AVANT :
  colonnes de ~80 px, cartes tronquées à quelques caractères (« Atelier... », « Prévent... »),
  les six jours tiennent sans défilement, aucun bouton « Plein écran ». APRÈS : colonnes ≥ 150 px,
  cartes normalisées (heure–fin, client, nature · machine, site ET commune entre parenthèses —
  point 4b de la reprise), la grille défile horizontalement au-delà de trois jours environ, une
  fine barre bleue apparaît au bas des cases qui portent une charge ce jour-là (point 4c).
- `vue-semaine-avant-375.png` / `vue-semaine-apres-375.png` — même écran à 375 px : la liste
  téléphone (`ListeSemaine`) remplace la grille sous `lg`, inchangée dans sa forme générale ; les
  cartes y portent déjà site + durée avant comme après, la différence est dans le contenu du site
  (commune ajoutée) et l'absence de bouton « Plein écran » (`hidden lg:block`, sans équivalent
  téléphone).
- `vue-semaine-plein-ecran-avant-1280.png` / `vue-semaine-plein-ecran-apres-1280.png` — l'URL
  `?pleinEcran=1` rejouée aux deux états. AVANT : le paramètre n'existe pas encore, l'écran est
  IDENTIQUE à `vue-semaine-avant-1280.png` (mesuré : les deux fichiers ont la même taille en
  octets). APRÈS : la colonne « À planifier » ET la barre de navigation globale (point 4a de la
  reprise) sont toutes deux repliées, bouton « Quitter le plein écran », les six jours de la
  semaine tiennent désormais sans défilement dans l'espace regagné.

**Colonnes défilantes, jamais rognées** (décision QG-1, 27/09/2026) : ce ticket REVIENT sur
82-PLANNING-6, qui avait retiré `min-w-[920px]` pour que les six colonnes tiennent sans défiler —
au prix d'une colonne à 79 px, une carte à 11 px de contenu utile (audit du 27/09/2026, I-2).
