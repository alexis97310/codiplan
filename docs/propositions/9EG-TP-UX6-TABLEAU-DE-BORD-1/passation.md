# 9EG-TP-UX6-TABLEAU-DE-BORD-1 — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

`/tableau-de-bord` est reconstruit selon le rôle (QE-7 (a), D185), au gabarit
de la maquette du 28/09 (`route("/tableau-de-bord", ...)`). Avant ce lot,
l'écran était identique pour tout rôle qui passe la garde `consulter_planning`
(complet) : quatre tuiles fixes, « Taux d'occupation : Non calculé »,
« Priorités opérationnelles » sans action de ligne, « Interventions sans
durée » réduite à un chiffre. Après ce lot :

- **ADV** voit : À planifier, Aujourd'hui, En retard, À facturer (absente du
  rendu, place nommée) ; la bande ajoute « interventions du jour à
  transmettre » ; les blocs sont Priorités (5 catégories), « Aujourd'hui, par
  technicien », « Interventions sans durée ».
- **Responsable matériel** voit : À planifier, En retard, Réserves VGP
  (absente), Suspendues ; la bande ajoute « garanties qui finissent » ; les
  blocs sont Priorités (4 catégories, sans Contrôle), « Aujourd'hui, par
  technicien », « Charge des 4 prochaines semaines », « Interventions sans
  durée ».
- **Responsable SAV** voit : À contrôler, Aujourd'hui, Suspendues, Retours
  sous 30 jours (absente) ; la bande ajoute « interventions sous garantie
  ouvertes » ; les blocs sont Priorités (2 catégories : Urgences, Contrôle),
  « Terminées : valider le rapport, puis clôturer », « Interventions sans
  durée ».
- **Direction et administrateur de société** gardent la composition ADV
  jusqu'au lot -2.

Une alerte P1 apparaît en tête pour les trois rôles quand une P1 attend dans
la file. « Priorités opérationnelles » porte désormais une icône, un
compteur, un filtre en liste déroulante dans l'en-tête de la carte (D122), et
sept lignes au plus (décision 24 d'Alexis, `LIGNES_PRIORITES`), avec une
action par ligne (Déplacer…, Transmettre…, ou un chevron vers la fiche).

## Reprise 9EGA-REPRISE-9EG-1 (09/10/2026, 18h01-20h50 Nouméa)

**Cause du rouge trouvée en une phrase** : `pnpm verify` (format/typecheck/
lint/unitaires/isolation/build) était intégralement VERT — le rouge de la
file venait de la suite e2e, jamais rejouée en entier par la session 9EG-1 ;
huit épreuves existantes ciblaient des tuiles du tableau de bord d'avant ce
lot (`kpi-bloques`, `kpi-occupation`, `kpi-vgp`, `kpi-interventions`, le lien
`tableau_de_bord.lien_demandes`) qui n'existent plus sur AUCUNE composition
du tableau de bord reconstruit — un gap que les T1-T20 de l'addendum ne
nommaient pas (seul `tableau-de-bord-liens-tuiles.spec.ts` et
`demandes.spec.ts` y figuraient, et pas pour cette cause-là).

Repris depuis `origin/main` à jour (f2c81e8b, 9EN) ; les 4 commits de la
garde `9EG-TP-UX6-TABLEAU-DE-BORD-1-garde` rejoués par `cherry-pick`, UN SEUL
conflit (`docs/arbitrages.md` : D186 et D185 ajoutées en fin de fichier par
deux lots parallèles — les deux conservées, D186 avant D185, aucun des deux
textes modifié).

**Première passe `CI=1 pnpm verify:full`** (après le rejeu) : rouge sur
`pnpm test` — `tests/unit/i18n/sans-chaine-visible-en-dur.test.ts` (gardien
L0-11) refusait une chaîne en dur dans une requête d'écran de l'épreuve
neuve `tests/e2e/9eg1-tableau-de-bord-roles.spec.ts:421`
(`page.getByText("9EG1- Technicien de l'épreuve")`). Le gardien résout un
identifiant jusqu'à sa déclaration : une `const` locale portant le littéral
ne suffit pas à l'échapper, une clé du dictionnaire si. Corrigé par une clé
neuve `tableau_de_bord.e2e.nom_technicien` (même modèle que
`planning.e2e.nom_technicien`, `equipe.e2e.nom`). `pnpm verify` ensuite
intégralement vert (4494 unitaires, 1514 isolation, build).

**`CI=1 pnpm test:e2e` en entier** (44.5 min) : 8 épreuves rouges, 48
ignorées (cascade `serial`), 1070 vertes. Toutes les huit retombaient sur la
même cause (ci-dessus). Corrigées une à une (voir commits) :

- `vgp-retard-visible.spec.ts` — retire la seule assertion sur la tuile VGP
  du tableau de bord (fonctions et clés déjà supprimées par la garde) ; le
  registre `/vgp` reste éprouvé tel quel. La mesure du défaut VGP-2 au
  niveau du calcul reste tenue par `tests/unit/vgp/voies-a-prevoir.test.ts`.
- `tableau-non-calcule.spec.ts` — SUPPRIMÉ : sa cible unique
  (`kpi-occupation`, `data-non-calcule`) n'a plus d'équivalent nulle part
  (`Statistiques` est réutilisé tel quel, D56, sans jamais ce motif — tout
  son texte est à taille uniforme, jamais un grand chiffre à côté).
- `plancher-12-pages.spec.ts` — retire le scénario G2 (même cause), documenté
  en commentaire plutôt que silencieusement renuméroté.
- `captures-9cb-menu.spec.ts` — bascule la capture survol/focus sur la tuile
  « À planifier », qui existe pour l'ADV (`kpi-bloques` n'existe plus pour
  aucun rôle).
- `captures-pg-a6-libelle-sans-duree.spec.ts` — cadre la requête d'écran à
  `[data-bloc="activite"]` : le libellé « Interventions sans durée »
  apparaît maintenant DEUX fois sur la page (titre de la carte ET, en
  sous-chaîne insensible à la casse, le libellé commun de la bande
  « interventions sans durée prévue ») — ambiguïté `strict mode` résolue par
  le cadrage, pas par un `.first()` qui aurait pu viser le mauvais élément.
- `demandes.spec.ts` — cible le lien « /demandes » de la bande par son
  `href` plutôt que par un libellé qui n'existe plus ; ajoute
  `data-bloc="bande-decomptes"` à `BandeDecomptes` pour le cadrer sans
  ambiguïté avec le lien de nav (même `href`). Puis, une FOIS ce cadrage en
  place, une SECONDE cause est apparue : ce fichier tourne en `serial`, et le
  test précédent (« LA FILE EST VIDE ») laisse les deux demandes du fichier
  TERMINALES — le compte retombe à zéro, et `BandeDecomptes` (D185) ne rend
  plus de lien du tout à zéro (« un décompte non nul est une porte, zéro est
  un état neutre »). Le test pose désormais sa propre demande ouverte juste
  avant de vérifier le lien, et la retire en `finally` — sans toucher « LA
  FILE EST VIDE », qui compte toujours zéro juste avant lui.
- `tableau-de-bord-liens-tuiles.spec.ts`, `tuiles-cliquables.spec.ts` — la
  tuile « Suspendues » (même `href` que l'ancienne « Dossiers bloqués »,
  `/interventions?vue=bloquees`) n'existe que sur la composition responsable
  matériel/SAV, jamais sur celle de l'ADV (`ouvrirUneSession`) : connexion RM
  dédiée (`connecterRM`, même geste que `droits-rm-rs.spec.ts`) pour ces deux
  scénarios seulement, le reste du fichier restant sur l'ADV. Retire
  `TUILES_INERTES` de `tuiles-cliquables.spec.ts` : ses trois cibles
  (`kpi-interventions`, `kpi-occupation`, `kpi-vgp`) n'existent plus, et D140
  (« toutes les tuiles de chiffres sont cliquables ») est désormais tenu PAR
  CONSTRUCTION sur ce tableau de bord — ce n'est pas une perte de couverture.

**Rejeu ciblé après corrections** (`tests/e2e/demandes.spec.ts` seul : 7/7 ;
les sept autres fichiers corrigés rejoués ensemble avec `9eg1-*` : 28/28).
**La suite e2e complète n'a PAS été rejouée une seconde fois après le DERNIER
correctif (`demandes.spec.ts`)** — la première passe complète a pris 44.5
min, la seconde (après les 7 premiers correctifs) 48.9 min ; une troisième
aurait dépassé le budget de 210 minutes de cette session une fois la
passation écrite. C'est une HYPOTHÈSE forte (chaque fichier rouge a été
rejoué seul avec succès, `pnpm verify` est vert, aucun autre fichier ne
référence les data-bloc retirés — vérifié par recherche texte), **pas une
mesure** : la file rejouera `pnpm verify:full` en entier avant de publier, et
c'est elle qui tranchera en dernier ressort.

### Tableau T1-T20 (addendum recalage 2, relu sur cette reprise)

| # | Fait / pas fait |
|---|---|
| T1 | Fait (garde) — base mesurée à jour au départ de la garde |
| T2 | Fait (garde) — lignes de code citées toujours exactes après rejeu |
| T3 | Fait (garde) — a-h, non revérifiés lettre par lettre dans cette reprise |
| T4 | Fait (garde) — informationnel, sans action |
| T5 | Fait (garde) — (a)(b)(c)(d) vides via `TUILES_ABSENTES` ; (e) « garanties qui finissent » construite |
| T6 | Fait (garde) — « Demande à qualifier » construite, amendement D176 présent dans `docs/arbitrages.md` |
| T7 | Fait (garde), RECONFIRMÉ par cette reprise — `tuiles-cliquables.spec.ts` prouve qu'aucune tuile du rendu actuel n'est l'exception « neutre à zéro » hors « En retard » |
| T8 | Fait (garde + 9EGA) — territoire tenu ; 9EGA n'a touché que test files, `lib/i18n/fr.ts` (bloc `tableau_de_bord.*`), `docs/arbitrages.md` (fin de fichier), `components/ui/bande-decomptes.tsx` (attribut de test, zéro logique) |
| T9 | Fait (garde), non revérifié en détail dans cette reprise |
| T10 | Fait (garde) — clés `bande_indisponible_*`, amendements D136/D175 présents |
| T11 | Fait (garde) — aucun geste « Appeler », témoin de capture adapté (diff de la garde) |
| T12 | Fait (garde), non revérifié en détail |
| T13 | Fait (garde), non revérifié en détail |
| T14 | Partiellement fait (garde) + COMPLÉTÉ par 9EGA — la garde a adapté sa propre liste de gardiens listés dans l'addendum ; cette reprise a trouvé et corrigé huit épreuves rouges supplémentaires que l'exécution e2e seule pouvait révéler (voir ci-dessus), dont deux (`demandes.spec.ts`, `captures-9cb-menu.spec.ts`) qui étaient pourtant déjà nommées dans la liste T14 d'origine |
| T15 | Fait (garde) + corrigé (9EGA, gardien L0-11 sur `9eg1-tableau-de-bord-roles.spec.ts`) |
| T16 | **PAS FAIT** — ni par la garde, ni par cette reprise (budget de session : la reprise a consommé son temps sur le rouge de verify:full, qui était le mandat explicite du ticket) |
| T17 | Fait (garde) — D185 présente, non renumérotée, D186 (9EN) et D185 coexistent en fin de fichier |
| T18 | Fait (garde + 9EGA) — `package.json` non modifié par aucun des deux |
| T19 | Fait (garde) — préambule D185 et les trois lignes « Amendé par D185 » (D136, D175, D176) confirmés présents |
| T20 | Fait (garde), non revérifié en détail |

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- `pnpm format:check`, `pnpm typecheck`, `pnpm lint` : verts (après chaque
  correctif de cette reprise).
- `pnpm test` (unitaires) : **4494/4494 verts, 421 fichiers** (420 + la clé
  `tableau_de_bord.e2e.nom_technicien` ne crée aucun fichier neuf).
- `pnpm test:isolation` : **1514/1514 verts, 170 fichiers**, inchangé.
- `pnpm build` : réussi.
- `pnpm feries:horizon`, `pnpm audit:partitions` : verts (rejoués par cette
  reprise, aucun changement ne les concerne).
- `pnpm test:e2e` (suite complète, 1ʳᵉ passe sur la garde rejouée avant tout
  correctif) : 8 rouges / 48 ignorées / 1070 vertes, 44.5 min.
- `pnpm test:e2e` (suite complète, 2ᵉ passe après les 7 premiers correctifs,
  avant celui de `demandes.spec.ts`) : 1 rouge / 48 ignorées / 1080 vertes,
  48.9 min.
- Rejeu ciblé après le correctif de `demandes.spec.ts` : ce fichier seul,
  7/7 ; les sept fichiers précédemment rouges plus `9eg1-tableau-de-bord-
  roles.spec.ts`, ensemble, 28/28.
- **Non mesuré** : une 3ᵉ passe complète de `pnpm test:e2e` après le tout
  dernier correctif (budget de session, voir plus haut) ; les AVANT de T16.

## Ce que j'ai tranché et pourquoi

- **Les épreuves rouges causées par la disparition de `kpi-bloques`/
  `kpi-occupation`/`kpi-vgp`/`kpi-interventions` sont ADAPTÉES, jamais
  réécrites pour inventer un équivalent qui n'existe pas** : quand aucune
  tuile du rendu actuel ne porte plus le motif qu'une épreuve éprouvait (le
  « Non calculé » à côté d'un grand chiffre, la tuile permanemment inerte),
  l'épreuve est retirée avec sa raison écrite, au même geste que la garde
  elle-même avait déjà fait pour `tests/unit/tableau-de-bord/
  vgp-trois-voies.test.ts` (fonctions supprimées). Ce n'est pas affaiblir un
  test : c'est reconnaître qu'un motif qu'il gardait a été retiré PAR
  DÉCISION (D185, maquette du 28/09), pas par accident.
- **La tuile « Suspendues » et l'ancienne « Dossiers bloqués » partagent le
  même `href`** (`/interventions?vue=bloquees`) : les épreuves qui
  l'éprouvaient restent donc valides dans leur PRINCIPE, seul le rôle qui la
  voit a changé (responsable matériel/SAV, plus l'ADV) — une connexion RM
  dédiée, jamais une tuile ADV qui n'existe pas.
- **`demandes.spec.ts` — une demande à soi plutôt qu'un changement d'ordre
  des tests** : réordonner les tests du fichier (mettre le test du tableau
  de bord AVANT « LA FILE EST VIDE ») aurait été plus court, mais aurait
  changé ce que « LA FILE EST VIDE » éprouve en pratique (elle veut la file
  VIDE APRÈS le cycle complet, pas à un instant arbitraire) — la solution
  retenue respecte l'ordre narratif du fichier (cycle complet → file vide →
  tableau de bord) et isole son propre fait générateur.
- **Les captures PNG régénérées par `pnpm test:e2e`, sans rapport avec ce
  lot, ont été restaurées (`git checkout --`) après chaque passe** — la
  suite complète réécrit, sans gate, plusieurs dizaines de captures d'autres
  tickets (mesuré : horodatage de modification concordant avec la fenêtre
  d'exécution) ; aucune n'a été committée.

## Ce que je n'ai PAS fait

- **Les captures AVANT de T16** — ni la garde ni cette reprise ne les a
  prises (la garde l'a dit dans sa passation ; cette reprise a priorisé la
  cause du rouge de `verify:full`, mandat explicite de ce ticket). Les
  captures APRÈS existantes restent valides : aucun changement visuel n'a
  été fait à `/tableau-de-bord` par cette reprise (uniquement des fichiers
  de test, une clé i18n dédiée aux épreuves, et un attribut `data-bloc` sans
  effet visuel sur `BandeDecomptes`).
- **Direction, administrateur de société, « Mise en route », le journal,
  la catégorie « Équipe »** — territoire du lot -2, non touché.
- **Une 3ᵉ passe complète de `pnpm test:e2e`** après le dernier correctif —
  voir « Ce que j'ai mesuré ».
- **Aucune règle de gestion, aucune migration, aucune ligne de semis,
  aucun prix** n'a été touché par cette reprise.

## Les pièges pour la session suivante

- **`pnpm test:e2e` en entier prend 44 à 49 minutes sur ce poste** — en
  tenir compte dans le budget d'une session avant de la lancer deux fois.
- **La suite e2e complète régénère sans discernement des dizaines de
  captures PNG d'autres tickets** (les specs de capture plus anciennes
  n'ont pas toutes le gate `process.env.CAPTURES_*`) : `git status
  --porcelain` après CHAQUE exécution de la suite complète, et restaurer
  (`git checkout --`) tout fichier `docs/propositions/**/captures/*` qui
  n'est pas le sien avant de committer.
- **Une connexion Postgres orpheline peut bloquer `test:e2e`** (`P2028`/
  `55006`, « database is being accessed by other users ») si une exécution
  précédente a été tuée par un timeout du harnais plutôt que d'aller à son
  terme : vérifier `pg_stat_activity` sur `codiplan_test` et terminer les
  connexions orphelines (`pg_terminate_backend`) avant de relancer — le
  process Playwright orphelin lui-même peut survivre au `timeout` du shell
  (SIGTERM ignoré) et doit être tué (`kill -9`) en plus de la connexion.
- **Le gardien L0-11 (`sans-chaine-visible-en-dur.test.ts`) résout un
  identifiant jusqu'à SA DÉCLARATION** : assigner un littéral à une `const`
  locale puis la passer à `getByText` NE SUFFIT PAS à l'échapper — seule une
  clé du dictionnaire (`fr["xxx.e2e.yyy"]`) le fait, au même modèle que
  `equipe.e2e.nom`/`planning.e2e.nom_technicien`.
- **`BandeDecomptes` (D185) ne rend AUCUN lien quand son compte est nul** —
  tout scénario e2e qui clique un décompte de la bande doit garantir que son
  compte est strictement positif au moment où il le vérifie, jamais en
  supposant l'état d'un fichier `serial` voisin.

## Ce qui reste à faire

- Le lot -2 (9EG-TP-UX6-TABLEAU-DE-BORD-2) : direction, administrateur de
  société, « Mise en route » (PU-1), le journal, la catégorie « Équipe ».
- Le lot du registre (D185 cite les décisions 48 d'Alexis) : « Retours sous
  30 jours », « Rapport validé / Clôturer », une fois posés, rempliront les
  emplacements vides nommés ici — sans rouvrir cette décision.
- Le ticket ARGENT (décision 45, après la refonte du registre, validé par
  Alexis avant dépôt) : la tuile « À facturer ».
- Les réserves VGP (décision 53, après la refonte, migration) : la tuile
  « Réserves VGP sans intervention ».
- **Les captures AVANT de T16** restent à prendre (le commit `8e9b760a`,
  tip de `main` avant tout ce travail, reste disponible pour les
  reconstruire) — nommé comme non fait par deux sessions consécutives.
- Une 3ᵉ passe complète de `pnpm test:e2e` sur le code final de cette
  reprise, par la session qui en a le budget, pour confirmer que les 48
  épreuves « ignorées » des deux passes précédentes (cascade `serial` des
  fichiers rouges) sont bien vertes une fois tous les fichiers corrigés
  ensemble.
