# Captures — PG-D4-TELEPHONE-ONGLETS (D146)

Prises le 30/09/2026. AVANT = `2c312db` (dernier commit avant le code de ce
ticket). APRÈS = `5d7aa61`, complété par la mesure de la case
`position_carte_file_y`/`hauteur_page` de cette même commande. Scène de
démonstration créée et effacée par
`tests/e2e/captures-pgd4-telephone-onglets.spec.ts` (client/site `PGD4CAP`,
préfixe I9) — jamais une fixture `SCENE.*`, jamais de donnée réelle. Script :
`scripts/lib/mesure-captures.ts` n'a pas été branché sur ce spec (délai) ;
les mesures ci-dessous viennent de `page.evaluate`/`boundingBox()` directement,
écrites dans `mesure-*.json` à côté des PNG.

## Écrans

| Fichier | Ce qu'il montre |
|---|---|
| `semaine-avant-375.png` | Avant ce ticket, à 375 px : la file, la grille (liste) et les statistiques empilées sur une seule colonne. |
| `semaine-apres-375.png` | Après : l'onglet « Semaine » actif — la file et les statistiques masquées, seule la liste de la semaine reste. |
| `a-traiter-avant-375.png` | Avant, `?volet=a_traiter` ignoré (le paramètre n'existait pas) : identique à `semaine-avant`. |
| `a-traiter-apres-375.png` | Après, l'onglet « À traiter » actif : la file seule, planning et statistiques masqués. |
| `fenetre-pose-apres-375.png` | La fenêtre de pose ouverte depuis « Poser… », plein écran (375 × 812, mesuré). |
| `jour-avant-375.png` | Avant, vue Jour à 375 px : le tableau (ancienne orientation, hérité d'avant 9CF, ou la frise si 9CF est déjà là). |
| `jour-apres-375.png` | Après, vue Jour à 375 px : `ListeJour`, jamais la frise. |
| `temoin-1024.png` / `temoin-1280.png` | Témoins avec `&volet=a_traiter` dans l'URL : aucun onglet de téléphone, la colonne « À traiter » ET la grille visibles ensemble — rien ne change à partir de 901 px. |

## La mesure refaite (position de la première carte de la file, hauteur de la page, à 375 px)

*Recomposée le 30/09/2026 — le chiffre de l'audit du 27/09 (« commence à
1652 px sur 2461 ») datait d'avant la rangée de filtres (PG-C6) : il fallait
la refaire, pas la citer.*

| | AVANT (vue Semaine, une seule colonne) | APRÈS (onglet « À traiter ») |
|---|---|---|
| Position verticale de la première carte de la file (`y`, px) | **2012** | **1365** |
| Hauteur totale de la page (px) | **3089** | **2055** |

La carte remonte de 647 px et la page perd 1034 px de hauteur — mais elle ne
tient toujours pas dans les 812 px de la fenêtre sans défiler (CA-9 au sens
strict). Le reliquat est nommé dans la passation, point « à confirmer par
Alexis » n° 3 : la rangée de filtres (PG-C6), la bannière des calendriers et
le lien `absences.titre` restent visibles au-dessus de la colonne « À
traiter » sous 900 px, comme le prescrivait le lot — les masquer irait
au-delà de ce que ce ticket a tranché.

## Ce qui n'a pas été capturé, faute de temps

Aucune absence (pastille violette) ni carte « heure non fixée » dans la
liste du jour (`ListeJour`) : la scène de capture ne pose qu'une intervention
`a_planifier` et une `planifiee`. Le rendu de ces deux cas est couvert par la
lecture du code (`ListeJour`, `page.tsx`), pas par une capture d'écran.
