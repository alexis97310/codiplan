# 53-PLANNING-3 — passation

## Ce que j'ai changé

- **`app/(back-office)/planning/statistiques.tsx`** — dès que
  `occupation.sansDuree > 0` pour une ligne (technicien, agence), le bloc
  « charge par technicien » n'affiche plus « Taux X % » (ni « pas de
  calendrier ») : il affiche « Charge incomplète — N intervention(s) sans
  durée saisie… », avec les heures engagées reformulées en PLANCHER
  (« au moins Hh engagées » plutôt que la mention nue), et un lien
  `/interventions?sans_duree_a_venir=1` (le même critère que la tuile du
  tableau de bord, AFFICHAGE-MATERIEL-1). La barre segmentée, le nombre
  d'interventions, le trajet et la mention « au-delà de 100 % » ne changent
  pas — seul le bloc taux/sans-calendrier est remplacé, unconditionnellement,
  par la nouvelle mention.
  - **Pour l'exploitation** : un technicien dont les interventions n'ont pas
    de durée saisie ne s'affiche plus « 0 % » — un chiffre juste qui le
    faisait paraître libre alors qu'il peut être débordé et simplement mal
    saisi (SAV-05). Le planificateur voit maintenant l'incomplétude, sait
    combien d'interventions manquent de durée, et a un lien direct pour les
    corriger.
- **`lib/i18n/fr.ts`** — trois clés neuves : `statistiques.charge_incomplete`,
  `statistiques.au_moins`, `statistiques.charge_incomplete_lien`, plus
  `planning.e2e.nom_technicien` (fixture de l'épreuve, même famille que
  `equipe.e2e.nom`).
- Rien dans `lib/interventions/statistiques.ts` : `occupation.sansDuree` et
  `occupation.minutesEngagees` portaient déjà tout ce dont l'écran avait
  besoin — aucune fonction pure `chargeIncomplete()` n'a été nécessaire côté
  calcul, seulement côté rendu (`chargeIncomplete()` et
  `heuresEngageesAuMoins()` dans `statistiques.tsx`, toutes deux réutilisent
  `combienSansDuree` déjà existante, jamais une seconde formulation du même
  compte).

## Ce que j'ai mesuré

- **Avant** (lu dans le code, mesure de départ du ticket) :
  `Chiffres()` affichait `tauxEtFormule` dès que `tauxOccupation` n'était pas
  `null`, sans regarder `occupation.sansDuree` — capture non prise (le
  correctif était déjà écrit avant la première capture de ce lot).
- **Après**, capture `docs/propositions/53-PLANNING-3/captures/planning--1280.png` :
  scène forgée (un technicien `PL3-Témoin`, une intervention `en_cours` sans
  durée sur l'agence Ducos) sur `/planning?vue=jour`. La ligne affiche : « au
  moins 00:00 engagées · 00:50 de trajet · 08:00 ouvrables · Charge
  incomplète — 1 sans durée saisie — elle compte dans le nombre, et pour zéro
  minute dans le taux · Voir les interventions sans durée → ». Ni « % » ni
  « Taux » nulle part sur la ligne.
- `pnpm typecheck`, `pnpm lint`, `pnpm exec prettier --check` : verts sur
  tous les fichiers touchés.
- `pnpm vitest run` sur les trois fichiers du domaine
  (`charge-incomplete.test.ts`, `occupation-affichee.test.ts`,
  `statistiques.test.ts`) : 31/31 verts.
- `pnpm test` (tout `--project unit`, 254 fichiers) : vert après correction
  des deux gardiens ci-dessous — voir « ce que j'ai tranché ».
- `pnpm test:e2e` complet (220 tests, 12 workers) : `tests/e2e/planning-3.spec.ts`
  vert, ainsi que 215 autres tests. Deux échecs ÉTRANGERS au lot — voir « les
  pièges pour la session suivante ».
- `pnpm build`, `pnpm test:isolation`, `pnpm feries:horizon`,
  `pnpm audit:partitions` : non rejoués séparément après la dernière
  correction (déjà verts dans la même exécution de `verify:full` qui a
  produit les deux échecs étrangers ci-dessous — rien dans ce lot ne les
  touche).

## Ce que j'ai tranché, et pourquoi

- **La règle s'applique inconditionnellement dès `sansDuree > 0`**, y compris
  quand le calendrier est inconnu (`tauxOccupation === null`) : plutôt que
  de distinguer « sans durée + calendrier connu » (le cas mesuré par
  SAV-05) de « sans durée + pas de calendrier », un seul état incomplet est
  plus simple à lire et reste vrai dans les deux cas — le taux, de toute
  façon, n'aurait rien affiché de plus qu'« incomplète ».
- **Le lien `sans_duree_a_venir=1` s'affiche À CHAQUE FOIS que la charge est
  incomplète**, sans essayer de savoir si les interventions sans durée de
  CETTE ligne sont dans le passé ou l'avenir. Le composant ne reçoit que des
  compteurs agrégés (`OccupationTechnicien`), jamais les dates individuelles
  des interventions ; les faire remonter aurait touché
  `lib/interventions/statistiques.ts`, `lib/interventions/occupation.ts` et
  tous leurs appelants pour un affinage que le ticket n'exigeait pas
  explicitement (« UNE SEULE CHOSE »). Le lien reste correct dans tous les
  cas : il mène à une liste filtrée qui peut être vide un jour donné, jamais
  à une fausse promesse.
- **`combienSansDuree` est réutilisée telle quelle** dans le nouveau message
  plutôt que dupliquée sous une formulation plus courte : la phrase est plus
  longue que ce que le ticket citait en exemple, mais c'est la MÊME source
  que la mention qu'elle remplace, et le gardien `occupation-affichee.test.ts`
  continue d'exiger `statistiques.sans_duree_un`/`sans_duree` dans le fichier.
- **`role: Role.technicien` et `NOM_TECHNICIEN` passé par le dictionnaire**
  (`fr["planning.e2e.nom_technicien"]`) dans `tests/e2e/planning-3.spec.ts` —
  deux gardiens existants (`roles-sans-chaine-libre.test.ts`,
  `sans-chaine-visible-en-dur.test.ts`) rougissaient sur ma première version,
  qui écrivait `role: "technicien"` en dur et cherchait le nom forgé par un
  littéral passé à `getByText`. Corrigés en suivant exactement le patron déjà
  posé par `tests/e2e/equipe.spec.ts` (`equipe.e2e.nom`) plutôt qu'en
  assouplissant quoi que ce soit aux deux gardiens.

## Ce que je n'ai PAS fait

- Aucune migration, aucune ligne de semis, aucun prix — hors périmètre du
  ticket, et rien n'en avait besoin.
- Je n'ai pas touché `app/(back-office)/planning/page.tsx` au-delà de rien :
  l'appel `<Statistiques lignes={charges} annuaire={annuaire} />` n'a pas
  changé de signature, donc même pas cette ligne.
- Je n'ai pas fait dépendre l'affichage du lien `sans_duree_a_venir=1` de la
  période affichée (voir « ce que j'ai tranché » ci-dessus).
- Je n'ai pas touché aux deux tests étrangers en échec (voir ci-dessous) :
  ni leur mise en scène, ni leur assertion.

## Les pièges pour la session suivante

- **`tests/e2e/avertissements-1.spec.ts:367`** (« le badge « Nouveau » se
  voit, puis s'efface à l'ouverture par le technicien affecté ») échoue de
  façon **reproductible, seul, sur `main` avant ce lot** (vérifié sur un
  worktree à `0646a9d`, `pnpm playwright test tests/e2e/avertissements-1.spec.ts
  -g badge`) : `a[href="/terrain/<uuid>"]` introuvable sous 5 s. Ce n'est pas
  une régression de ce lot — aucun fichier de ce lot ne touche `/terrain`, le
  badge, ni la scène AVERTISSEMENTS-1 — mais c'est un rouge PRÉEXISTANT sur
  `main`, à traiter par un ticket dédié.
- **`tests/e2e/porte-capacites.spec.ts:256`** a rougi UNE FOIS sous
  `verify:full` (220 tests, 12 workers) avec `Unique constraint failed on
  the fields: (id)` sur `intervention.create` — puis est repassé au VERT à
  deux reprises quand rejoué seul ou avec moins de contention. C'est très
  probablement la même famille de flake que celle documentée dans l'en-tête
  du fichier (mesurée le 24/09/2026, 20h15) : ce lot n'y touche pas et n'a
  rien changé qui explique cette collision d'identifiant fixe.
- **Le forfait de la scène e2e forgée** (`01a3f000-…-f1` à `-f4`,
  `pl3-temoin@codima.test`) est entièrement neuf — utilisateur, société,
  technicien ET intervention — pour rester hors de portée de toute autre
  scène sous `fullyParallel` (piège documenté par 51-STABILITE-1). Le jour
  local visé est `MARDI + 91 jours` : si un lot futur pousse un autre
  décalage encore plus loin (le plus grand connu avant celui-ci était +63,
  `parcours-creer-puis-planifier.spec.ts`), vérifier qu'il ne retombe pas sur
  ce même jour pour le même technicien Ducos.

## Ce qui reste à faire

- Rien côté 53-PLANNING-3 : les critères d'acceptation du ticket sont
  couverts par `tests/unit/interventions/charge-incomplete.test.ts` et
  `tests/e2e/planning-3.spec.ts`, tous deux verts.
- Hors périmètre, nommé par le ticket lui-même : nom du technicien figé au
  défilement, file triable, absence avant dépôt, visites à caler (SAV-06).
- Le rouge préexistant d'`avertissements-1.spec.ts:367` mérite un ticket à
  part — voir « les pièges » ci-dessus.
