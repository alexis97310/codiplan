# Captures — PG-D5-CREER-ICI

Prises le 30/09/2026. AVANT = `e36ef2d` (fonctions pures posées, rien encore
branché — dernier commit avant le code de ce ticket). APRÈS = `5f1a4ae`.
Scène de démonstration créée et effacée par
`tests/e2e/captures-pgd5-creer-ici.spec.ts` (client/site `PGD5CAP`, préfixe
I9) — jamais une fixture `SCENE.*`, jamais de donnée réelle.

## Écrans

| Fichier | Ce qu'il montre |
|---|---|
| `semaine-creer-ici-avant-1280.png` | Avant, à 1280 px : un clic sur une case vide ne montre rien — `CasePosable` n'a pas encore de prop `hrefCreerIci`. |
| `semaine-creer-ici-apres-1280.png` | Après, à 1280 px : le lien « + Créer ici » apparaît dans la case cliquée. |
| `semaine-creer-ici-avant-375.png` (× 2) | Avant ET après, à 375 px : **identiques** — sous 1024 px, la grille (donc `CasePosable`, donc « + Créer ici ») n'existe pas ; seule la liste en lecture seule (N-02) s'affiche. Voir la note plus bas. |
| `jour-creer-ici-avant-1280.png` / `jour-creer-ici-apres-1280.png` | Vue Jour, à 1280 px : même écart, sur une case « libre » de la frise. |
| `formulaire-avant-1280.png` / `formulaire-apres-1280.png` | `/interventions/nouvelle?poser_technicien=…&poser_date=…`, à 1280 px : le formulaire est **identique à l'œil** (PARCOURS-1) — seuls trois champs `<input type="hidden">` de plus dans le DOM après ce ticket, invisibles à l'écran. |
| `formulaire-avant-375.png` / `formulaire-apres-375.png` | Même écran, à 375 px : même constat. |
| `fiche-fenetre-apres-1280.png` / `fiche-fenetre-apres-375.png` | Après création depuis une case, la fiche `?cree=1&poser_…` avec la fenêtre de pose ouverte D'EMBLÉE, technicien et jour déjà choisis — à 375 px, la fenêtre est plein écran (héritée de PG-D4-TELEPHONE-ONGLETS). Sans capture « avant » : ce bandeau-fenêtre n'existe pas avant ce ticket (le bouton « Planifier maintenant » exige un clic). |

## Ce que la capture confirme, par construction

Le fichier de capture appelle exactement la même route de création que
l'écran (`choisirResultatParTexte`, `select[name="type"]`,
`textarea[name="description"]`, bouton « Créer ») : la capture APRÈS de la
fiche est donc la preuve, à l'écran, que la case a bien voyagé jusqu'à la
fenêtre de pose sans passer par aucune écriture intermédiaire — la même
propriété que `tests/e2e/planning-creer-ici.spec.ts` vérifie par le réseau
(`posteVersDeplacer === false` avant le clic sur « Planifier »).

## Sous 1024 px : « Créer ici » n'existe pas, et c'est voulu

`VueSemaine` bascule sa grille (`CasePosable`) pour une liste en lecture
seule sous `lg` (1024 px, N-02) — la liste n'a jamais eu de case de dépôt, et
n'en a donc aucune à proposer pour « + Créer ici ». C'est la même limite que
la grille elle-même : le geste de pose (glisser-déposer, « Poser… ») n'existe
pas non plus sous cette largeur. La création reste possible par le bouton
d'en-tête « Créer une intervention », sans préremplissage de case.
