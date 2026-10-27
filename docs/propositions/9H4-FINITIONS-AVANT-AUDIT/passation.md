# 9H4-FINITIONS-AVANT-AUDIT — passation

Budget 150 min. T0 = 19:02 (Pacific/Noumea). Fin de la correction : 20:48 (106 min).
Captures AVANT/APRÈS **non prises** — budget de temps consommé par `verify:full`
(voir plus bas) avant d'y arriver. Chaque point ci-dessous a néanmoins été
rejoué ROUGE puis VERT par sa propre épreuve pendant la correction, ce qui
est la preuve qui fait foi.

| Point | Mesuré avant | Fait | Preuve |
|---|---|---|---|
| 1. Signature (terrain) | `rapport-automatique.tsx` : canevas `width={320} height={140}` fixe, affiché `w-full h-[140px]` — au-delà de 320 px affichés, `toDataURL` enregistre un PNG 320×140 qui ne correspond plus au ratio affiché (tracé étiré). | `useLayoutEffect` pose `canvas.width`/`height` = taille affichée réelle × `devicePixelRatio`, mesurée au montage de la section signature. | `tests/unit/terrain/rapport-automatique.test.tsx` — nouveau test : affiché 650×140 à `devicePixelRatio=2`, résolution 1300×280, même ratio que l'affichage (avant : 320×140 fixe, ratio différent). |
| 2. Compteur terrain | `compteur-terrain.tsx` : toute erreur de `.json()` traitée comme « joint » (refus affiché), y compris 502/504 de passerelle ou un corps coupé qui n'ont peut-être jamais atteint l'application. | Seul le statut HTTP `500` (celui que CETTE route pose elle-même) reste reconnu comme « joint » ; tout le reste (502, corps coupé, etc.) repart en file comme une coupure. | `tests/unit/terrain/compteur-terrain.test.tsx` — 3 nouveaux tests : 500 applicatif → refus affiché, rien en file ; 502 HTML → en file ; corps coupé (200, lecture interrompue) → en file. |
| 3. Fiche hors réseau | `consultation-hors-reseau.tsx` : section Compteur après lieu/contact/machines/panne — sous le pli à 375 px, contrairement à la fiche en ligne. | Section Compteur déplacée juste après l'en-tête, même ordre que `/terrain/[id]`. | `tests/unit/terrain/fiche-hors-reseau-travail.test.tsx` — nouveau test : le titre Compteur précède la section Panne dans l'arbre (`compareDocumentPosition`). |
| 4. Légende Jour | `<VueJour>` (page.tsx l.2309) ne recevait pas `afficherAnnulees` → la légende Jour n'affichait jamais « Annulée », même avec `?annulees=1`. | `afficherAnnulees={afficherAnnulees}` passé à l'appel réel. | `tests/e2e/planning-jour-legende-annulees.spec.ts` — rejoué ROUGE sans le passage de prop (stash), VERT avec. |
| 5. Colonne figée Jour | `<th scope="row">` (colonne figée) posait `z-[1]` ; les blocs de la frise, positionnés `absolute` dans leur propre case, posaient `z-10` — un bloc commençant tôt dans la journée passait AU-DESSUS de la colonne figée une fois la frise défilée. | Colonne figée remontée à `z-20`, au-dessus des blocs. | `tests/e2e/planning-jour-colonne-figee-empilement.spec.ts` — compare directement les `z-index` résolus ; ROUGE (1 < 10) avant, VERT (20 > 10) après. |
| 6a. Plein écran au téléphone | Le bouton (`BasculerPleinEcran`) était masqué sous 901 px dans les DEUX sens : `?pleinEcran=1` arrivé par un lien partagé ou une fenêtre réduite depuis le bureau retirait la colonne « À traiter » sans aucun moyen tactile d'en sortir (`EchapPleinEcran` n'écoute que le clavier). | Le bouton ne reste masqué sous 901 px que pour ENTRER ; SORTIR reste visible à toute largeur (classe conditionnelle sur `pleinEcran`). | `tests/e2e/planning-largeur-et-carte.spec.ts` — nouveau test : à 375 px, « Entrer » invisible, « Quitter le plein écran » visible et fonctionnel. Rejoué ROUGE/VERT. |
| 6b. `DefilerVersAujourdhuiMois` | Aucune `key` liée au mois, aucune dépendance d'effet (`[]`) — une navigation DOUCE (lien client) vers un autre mois puis le retour sur le mois d'aujourd'hui ne remontait jamais ce composant : le défilement héritait de la position laissée par le mois intermédiaire. | `key={cleJour(jours[0])}` sur `<DefilerVersAujourdhuiMois>` — force un nouveau montage, donc un nouveau défilement, à chaque mois affiché. | `tests/e2e/planning-mois-defilement-aujourdhui.spec.ts` — déterministe sans connaître le jour réel (position imposée = l'opposé de la position correcte mesurée au premier montage). Rejoué ROUGE/VERT. |
| 7. Zéro au singulier | Liste de `!== 1`/`=== 1 ? un : plusieurs` non passés par `decompte`/`auPluriel` (ou équivalents locaux sans le cas zéro). | Corrigés : `tarifs/page.tsx` (carte mobile, incohérent avec la table déjà correcte) ; `decomptes-parametrage.ts` (`decompteAgences`) ; `clients/presentation.ts` (`compteurSites`, `chiffreSites`, `ligneHomonyme`) ; `parametres/materiel/page.tsx` (`decompteModeles`, délègue à `decompte()`) ; `tableau-de-bord/presentation.ts` (`uniteAccordee`, et ses deux usages dans `detailAujourdhui`). Deux tests existants encodaient le défaut comme attendu (« LE CAS QUI DOIT RESTER VERT : zéro prend le pluriel ») — corrigés. | `tests/unit/clients/chiffres-carte.test.ts`, `tests/unit/clients/presentation-ecran.test.ts`, `tests/unit/navigation/decomptes-parametrage.test.ts`, `tests/unit/tableau-de-bord/presentation.test.ts` — assertions zéro ajoutées/corrigées, toutes vertes. **Non reproduits** (gardés en amont par un cas zéro séparé, vérifié ligne par ligne) : `absences/presentation.ts` (jours ≥ 1 par construction), `parametres/equipe/presentation.ts` (les deux appelants testent `=== 0` avant d'appeler), `components/ui/barre-selection.tsx` (ne se rend jamais à longueur 0), `components/terrain/liste-journee.tsx` (l'appelant teste `=== 0` avant), `lib/vgp/libelles.ts` (`joursDepasses > 0` par construction), `absences/page.tsx` (`compte === 0` traité séparément juste au-dessus). **Grep `!== 1` hors tests** : 3 occurrences restantes — 1 de pluralisation (`decomptes-parametrage.ts:93`, déjà gardée par `if (sansTrajet > 0)`), 2 égalités techniques sans rapport (`lib/imports/modeles.ts`, `lib/auth/amorcage.ts`). |
| 8. Petites finitions | `demandes/[id]/page.tsx` ~l.794 : `break-all` coupait un mot même sans débordement à éviter, contrairement à `break-words hyphens-auto` partout ailleurs (9G3). `interventions/[id]/page.tsx` : le lien primaire « Bon d'intervention » (fiche clôturée) posé nu, jamais enrobé de `BarreActionCollee`, contrairement à TOUTES les autres fiches du back-office. | `break-all` → `break-words hyphens-auto`. `<LienPrimaire>` enrobé de `<BarreActionCollee>`. | `tests/e2e/interventions-fiche-action-collee-bon.spec.ts` — pleine largeur collée à 375 px, largeur de contenu inchangée à 1280 px. Rejoué ROUGE/VERT (fixture dédiée, jamais lue ailleurs). |

## `pnpm verify` (séparé, en entier) — VERT

5167 tests unitaires (477 fichiers), 1679 tests d'isolation (192 fichiers),
build de production : tous passés. Voir le début de
`verify-final.txt`.

## `pnpm verify:full` — TRONQUÉ, HONNÊTEMENT

`verify` rejoué (vert, comme ci-dessus) puis `test:e2e` : 1700 épreuves sur
**un seul worker** (donc en série) — environ 460 épreuves vues passer en 25
minutes avant que la limite de temps de l'outil (30 min) ne coupe la
commande. Aucun `FAIL` rencontré avant la coupure. `feries:horizon` et
`audit:partitions` n'ont pas eu leur tour, faute de budget. Note complète
en fin de `verify-final.txt`.

**Ce qui fait foi pour CE lot** : chaque point ci-dessus porte sa propre
épreuve e2e ou unitaire, rejouée ROUGE puis VERTE pendant la correction
(voir la colonne Preuve) — c'est cette preuve-là, pas l'exécution complète
de `verify:full` qui n'a pas pu finir dans le budget du ticket.

## Nettoyage

`test:e2e` régénère, en effet de bord, des captures PNG/PDF d'AUTRES
tickets (`docs/propositions/<autre-ticket>/captures/*`) — aucune n'a été
commitée ; les fichiers suivis ont été restaurés (`git checkout --`), les
nouveaux fichiers non suivis supprimés.

## Points ouverts

- Captures AVANT/APRÈS 375/1280 des écrans touchés : **non prises**, faute
  de budget après `verify:full`. À reprendre en premier dans un lot de
  reprise, avant toute nouvelle correction.
- `feries:horizon` / `audit:partitions` : non joués (ni rouge ni vert).
- `test:e2e` complet : non terminé (coupé à ~460/1700). Rejouer en arrière-plan
  ou par lots pour obtenir un verdict complet.
