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

Trois composants de `components/ui/` gagnent des props facultatives
(`Kpi.icone`/`.unite`, `Carte.icone`/`.compte`/`.pied`/`.enTeteDroite`),
toutes rétrocompatibles — aucun écran existant ne change sans les passer.

## Ce que j'ai mesuré

- `pnpm typecheck`, `pnpm lint`, `pnpm format:check` : verts.
- `pnpm test` (unitaires) : 4437/4437 verts, 420 fichiers.
- `pnpm test:isolation` : 1514/1514 verts, 170 fichiers.
- `pnpm build` : réussi, `/tableau-de-bord` compile (465 B / 106 kB First
  Load JS, dynamique).
- `tests/e2e/9eg1-tableau-de-bord-roles.spec.ts` (épreuve neuve, fixture
  propre `9EG1-`) : 12/12 verts, joué CONTRE UNE BASE RÉELLE
  (`pnpm exec playwright test tests/e2e/9eg1-tableau-de-bord-roles.spec.ts`).
  Il prouve, pour les trois rôles : qu'une tuile cliquable ouvre la liste qui
  porte bien l'identifiant attendu ; que l'alerte P1 nomme le bon client ;
  que les catégories « Urgences » et « Pièces » des Priorités listent les
  bonnes lignes ; que la tuile « En retard » (15-16 lignes de démonstration
  déjà présentes sur la société partagée) ouvre bien un registre qui contient
  la ligne de l'épreuve ; que la bande compte l'intervention « à transmettre »
  et la ligne « sans durée » de l'épreuve ; que « Aujourd'hui, par
  technicien » nomme le technicien de l'épreuve ; que « Charge des 4
  prochaines semaines » est visible sans tuile « Réserves VGP » pour le
  responsable matériel ; que « Terminées » nomme le client absent à la
  signature pour le responsable SAV ; que les options du filtre de Priorités
  diffèrent bien par rôle (Contrôle absent pour RM, présent pour RS ;
  « À planifier ou transmettre » absent pour RS).
- **Ce que je n'ai PAS mesuré** : `pnpm verify:full` dans son intégralité
  (il rejoue toute la suite e2e existante, plusieurs dizaines de fichiers,
  hors budget de cette session) — seul le fichier neuf a été rejoué contre
  une base réelle. `pnpm feries:horizon` et `pnpm audit:partitions` n'ont pas
  été relancés (aucun changement de ce lot ne les concerne). La file
  (`11-FILE.sh`) rejouera `pnpm verify:full` avant de publier, et ne publiera
  pas si elle rougit.

## Ce que j'ai tranché et pourquoi

- **Le taux d'occupation ne s'affiche jamais seul (D56).** La maquette
  dessine un pourcentage par ligne dans « Aujourd'hui, par technicien » et
  « Charge des 4 prochaines semaines » (`meter()`, `cell()`), sans
  numérateur, dénominateur ni formule. `tests/unit/interventions/
  occupation-affichee.test.ts` refuse qu'un composant appelle `tauxOccupation`
  sans porter les quatre mentions inséparables. Plutôt qu'écrire un second
  affichage de taux (la faute que ce gardien existe pour refuser), les deux
  blocs RÉUTILISENT `Statistiques` (`app/(back-office)/planning/
  statistiques.tsx`), déjà conforme. C'est un écart nommé à la maquette,
  assumé : la disposition en est changée (un bloc `Statistiques` complet par
  semaine plutôt qu'une grille compacte), jamais le principe (un taux par
  technicien, jamais un taux d'équipe).
- **Composition par `Role`, jamais par une chaîne inventée.** `CompositionRole`
  vaut `Role.adv | Role.responsable_materiel | Role.responsable_sav` — une
  première version utilisait des chaînes `"adv"/"resp_materiel"/"resp_sav"`,
  mais `"adv"` collisionnait avec la valeur réelle de `Role.adv` et faisait
  rougir `tests/unit/auth/roles-sans-chaine-libre.test.ts` (L0-06). Passer
  par l'énumération réelle supprime la collision ET documente mieux l'intention
  (la composition EST un rôle, celui dont elle reprend l'écran).
- **« À facturer », « Réserves VGP », « Retours sous 30 jours », « Rapport
  validé » restent des emplacements vides, nommés dans `TUILES_ABSENTES`/le
  corps de D185** : aucune lecture réelle n'existe sur ce dépôt pour ces
  quatre informations (décisions 45/48/53 d'Alexis du 09/10). Les rangées de
  tuiles du responsable matériel et du responsable SAV montrent donc TROIS
  tuiles, jamais quatre chiffres inventés.
- **« Garanties qui finissent » (responsable matériel) EST construite**,
  contrairement à ce que l'addendum du ticket supposait a priori : la lecture
  existe déjà (`compterLeParc` avec la vue « garantie », le même critère que
  `/parc?vue=garantie`), pour le coût d'UNE requête de plus.
- **« Demande à qualifier » EST construite** dans les Priorités (ADV,
  responsable matériel), amendant D176 sur ce seul écran (décision 47
  d'Alexis) : la pastille d'onglet et les autres gestes du lot des demandes
  restent hors territoire.
- **`cree_le` de la P1 de l'épreuve e2e est fixé dans le passé** (2020) pour
  que l'alerte nomme, À COUP SÛR, la P1 de l'épreuve plutôt qu'une P1 plus
  ancienne du semis — mesuré nécessaire après un premier échec (l'alerte
  nommait une P1 du semis, pas celle de l'épreuve).
- **La vérification de la tuile « En retard » dans l'épreuve passe par le
  registre (`/interventions?vue=en_retard`), pas par la carte Priorités** :
  la société partagée porte 15-16 lignes « en retard » de démonstration, bien
  au-delà du seuil de 7 lignes de la carte (décision 24) — la carte filtrée
  ne suffit donc pas à y retrouver une ligne précise, le registre (sans ce
  plafond) si.

## Ce que je n'ai PAS fait

- **Direction, administrateur de société, « Mise en route », le journal** —
  territoire du lot -2 (9EG-TP-UX6-TABLEAU-DE-BORD-2), explicitement hors de
  celui-ci.
- **La catégorie « Équipe »** des Priorités — lot -2.
- **« Rapport à valider depuis plus de 48 h »** et, dans « Terminées », la
  mention « rapport validé / à valider » — `temps_valide_le` n'est posé qu'à
  l'instant de la clôture (jamais pendant que l'intervention est
  « terminée ») : en faire un décompte inventerait une distinction que ce
  dépôt ne mesure pas (décision 48, lot du registre à venir).
- **« Retours sous 30 jours » et « Réserves VGP sans intervention »** —
  aucune lecture sur ce dépôt (le premier comparerait deux lignes, hors
  portée de `filtreDesInterventions` sans SQL brut ; le second suppose un
  modèle de réserve qui n'existe pas encore).
- **Le composant `Jauge`** prévu en tête de lot a été écrit puis RETIRÉ : la
  bascule vers `Statistiques` (voir plus haut) l'a rendu inutile — gardé dans
  `git log` de cette session, jamais committé en l'état final.
- **Les captures AVANT** — voir `captures/README.md` : oubliées en tête de
  session, avant la première modification de code. Seules les captures APRÈS
  existent.
- **`pnpm verify:full` dans son intégralité** — voir « Ce que j'ai mesuré ».
- **Aucune règle de gestion n'a été changée** (conforme à la consigne du
  ticket : aucune anomalie de ce genre rencontrée).

## Les pièges pour la session suivante

- **`"adv"` en chaîne libre fait rougir `roles-sans-chaine-libre.test.ts`** —
  ce n'est PAS évident à la lecture (le mot ressemble à une abréviation
  anodine) : tout code qui distingue une composition ou un sous-ensemble de
  rôles doit passer par `Role.<valeur>`, jamais par un raccourci textuel, même
  dans un commentaire entouré de guillemets droits.
- **La société partagée porte beaucoup de lignes « en retard » de
  démonstration** (15-16 au moment de cette session, et ça grandit avec le
  temps puisque le semis a des dates fixes) : toute épreuve qui compte sur la
  présence d'UNE ligne précise dans la carte Priorités (plafonnée à 7) doit
  soit filtrer par catégorie ET vérifier que la catégorie reste sous le seuil,
  soit passer par le registre complet (sans plafond) comme
  `tests/e2e/9eg1-tableau-de-bord-roles.spec.ts` le fait pour « En retard ».
- **`Statistiques` (`app/(back-office)/planning/statistiques.tsx`) est
  maintenant importé par deux fichiers hors de `app/(back-office)/planning/`**
  (`components/tableau-de-bord/bloc-aujourdhui-technicien.tsx` et
  `bloc-charge-4-semaines.tsx`, via un chemin relatif `../../app/...` — pas
  d'alias `@/app/...` pour un import depuis `components/`). Le lot -2, qui
  pose « Mise en route », n'a probablement pas besoin de ce composant, mais
  toute évolution de `Statistiques` doit se rappeler qu'il a maintenant TROIS
  appelants, pas un seul.
- **Le fil d'Ariane, le chrome (QE-3 à QE-5), l'action « + » collée partout
  (décision 41-43) ne sont PAS touchés par ce lot** — ce sont des décisions
  d'Alexis du 09/10 sans effet mesuré ICI (D185 le dit explicitement), mais un
  lecteur pressé du corps du ticket pourrait croire qu'elles manquent par
  oubli plutôt que par choix.
- **`compositionDuRole` retombe sur `Role.adv` pour TOUT rôle qui n'est ni
  responsable matériel ni responsable SAV** — y compris, en théorie,
  `technicien` ou un rôle éditeur, qui n'atteignent jamais cet écran (la garde
  `consulter_planning` complet les arrête avant). Le lot -2 devra remplacer ce
  repli par un `switch` exhaustif sur les cinq rôles de bureau quand il posera
  la composition direction/administrateur.

## Ce qui reste à faire

- Le lot -2 (9EG-TP-UX6-TABLEAU-DE-BORD-2) : direction, administrateur de
  société, « Mise en route » (PU-1), le journal, la catégorie « Équipe ».
- Le lot du registre (D185 cite les décisions 48 d'Alexis) : « Retours sous 30
  jours », « Rapport validé / Clôturer », une fois posés, rempliront les
  emplacements vides nommés ici — sans rouvrir cette décision.
- Le ticket ARGENT (décision 45, après la refonte du registre, validé par
  Alexis avant dépôt) : la tuile « À facturer ».
- Les réserves VGP (décision 53, après la refonte, migration) : la tuile
  « Réserves VGP sans intervention ».
- Prendre les captures AVANT manquantes si elles s'avèrent nécessaires à une
  relecture ultérieure (le commit `8e9b760a` reste disponible pour les
  reconstruire).
