# Captures — 9CK-PG-G11B-JOUR-SUITE (D147)

Décisions d'Alexis du 30/09/2026 (« Planning », points 3 à 5) : le libellé « Heure à fixer », le
dépôt d'une carte de la file pré-remplissant technicien/date/heure dans la fenêtre de pose, et les
cartes « Heure à fixer » glissables directement sur la frise.

Prises par `tests/e2e/captures-pgd1b-jour-suite.spec.ts` (env `CAPTURES_PGD1B`), sur sa propre
scène (préfixe `PGD1B-`), un mardi très éloigné (420 et 434 semaines selon le fichier, pour éviter
toute collision avec le semis ou avec `planning-jour-suite.spec.ts`).

| | |
|---|---|
| **Commit AVANT** | `791f927` — D147 (documentaire seul), le dernier avant le premier commit de code de ce ticket |
| **Commit APRÈS** | `ddb6b93` — le dernier commit de code de ce ticket avant les captures |
| **Date de la prise** | 2026-10-01, ~02h20 UTC |
| **Base** | PostgreSQL 16 local et jetable (`E2E_DATABASE_URL`), rempli par `prisma migrate deploy` + `pnpm db:seed` — aucune donnée réelle (I9) |

## Comment elles ont été prises

AVANT a été rejoué sur un `git worktree` isolé au commit `791f927` (le spec de ce ticket n'existe
pas encore sur ce commit : il y a été copié pour l'occasion, sans autre changement). APRÈS a été
joué sur le dépôt courant, au commit ci-dessus. Les deux exécutions pointent vers la même base
jetable locale, jamais l'hébergée.

## Les écrans

- `ligne-sans-heure-{1280,1024}-{avant,apres}.png` — la ligne « Heure à fixer » en tête de la
  frise (au-dessus de 900 px). **AVANT** : « Journée — heure non fixée » ; **APRÈS** : « Heure à
  fixer » (décision, point 3).
- `ligne-sans-heure-375-{avant,apres}.png` — la même donnée, sous 900 px : la frise cède la place à
  `ListeJour` (PG-D4-TELEPHONE-ONGLETS, D146), qui ne porte pas de titre de section — la différence
  entre AVANT et APRÈS n'y est donc pas visible (elle est dans `ligne-sans-heure-*-1280/1024`).
- `depot-fenetre-pose-{1280,1024,375}-{avant,apres}.png` — la fenêtre de pose ouverte depuis une
  carte de la file « À planifier » (PGD1B- capture carte de la file). Au-dessus de 900 px, la carte
  est glissée sur la case 10:00 de M. Perrin (Koné) ; sous 900 px, aucun glisser-déposer tactile —
  le bouton « Poser… » (PG-B2, inchangé) ouvre la même fenêtre, sans case donc sans heure. **AVANT**
  : aucune puce d'heure n'est sélectionnée, le champ « Autre heure » est vide, les contrôles disent
  « Choisissez une durée et une heure pour voir les contrôles. » (même à 1280/1024, où le dépôt
  s'est fait sur une case d'heure : la case ne donnait alors qu'un jour et un technicien).
  **APRÈS**, à 1280 et 1024 px (le dépôt sur une case) : la puce « 10:00 » est sélectionnée, le
  champ « Autre heure » affiche « 10:00 AM », les contrôles disent « Aucun blocage — vous pouvez
  planifier. » (décision, point 4). À 375 px, APRÈS ne diffère pas d'AVANT (le bouton « Poser » ne
  connaît pas la case) — attendu, voir la mesure ci-dessous.
- `glisser-en-cours-1280-apres.png` — une carte « Heure à fixer » à durée connue (PGD1B- capture
  ligne sans heure) en cours de glissement au-dessus de la case 14:00 de sa propre ligne (M.
  Perrin) : le contour vert de survol « possible » (`etatDeLaCase`, PG-B4, inchangé) s'affiche.
  **N'existe pas AVANT** : cette carte n'était pas glissable (§ « ce qui n'existe pas AVANT »).
- `bandeau-deplacement-differe-1280-apres.png` — juste après le relâcher : le bandeau « Déplacée…
  · Annuler » (PG-B5, inchangé) posé sur la case 14:00, le déplacement DIFFÉRÉ de 10,5 s avant que
  la base ne l'enregistre. **N'existe pas AVANT**, même raison.

## Ce qui n'existe pas AVANT

La carte « Heure à fixer » n'est glissable QUE depuis ce ticket (décision, point 5) : sur le code
d'AVANT, `SansHeureVide` rend un simple `<li><Link>…</Link></li>`, sans `[data-bloc]`. Le scénario
de capture (c) le mesure lui-même — `source.count() === 0` — et rend la main sans rien écrire :
c'est la même précaution que la passation de 9CF-PG-G11-JOUR-FRISE pour son propre cas (c).

## La mesure du script de captures

`tests/e2e/captures-pgd1b-jour-suite.spec.ts` reprend la collecte et les seuils de
`scripts/lib/mesure-captures.ts` (D138 : texte < 12 px ; spécification §10 :963 : cible < 32×32 px
au bureau, hors lien dans le texte ; §10 :965 : débordement horizontal) et les affiche par
`console.warn` à chaque capture. **Identique AVANT et APRÈS**, sur les six écrans communs aux deux
passes :

| Écran | Largeur | Textes < 12 px | Cibles < 32 px (téléphone seul) | Débordement |
|---|---|---|---|---|
| `ligne-sans-heure` | 1280 | 0 | — | 0 |
| `ligne-sans-heure` | 1024 | 0 | — | 0 |
| `ligne-sans-heure` | 375 | 0 | 7 | 0 |
| `depot-fenetre-pose` | 1280 | 0 | — | 0 |
| `depot-fenetre-pose` | 1024 | 0 | — | 0 |
| `depot-fenetre-pose` | 375 | 0 | 10 | 0 |
| `glisser-en-cours` (APRÈS seul) | 1280 | 0 | — | 0 |
| `bandeau-deplacement-differe` (APRÈS seul) | 1280 | 0 | — | 0 |

Les sept, puis dix, cibles sous 32 px à 375 px sont la barre de filtres (six `<select>` + un
`<input>`/`<button>` « Filtrer ») et le lien d'évitement « Aller au contenu » — présentes à
l'identique AVANT ce ticket, sur un écran que ce ticket ne touche pas (barre de filtres,
PG-C6-FILTRES-AUJOURDHUI). **Aucune régression introduite par ce ticket** : ni nouveau texte sous
12 px, ni nouvelle cible sous 32 px, ni débordement, sur aucun des huit écrans mesurés.
