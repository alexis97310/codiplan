# Passation — 9BX-TP-A6-TRIS-MISE-EN-PAGE

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

1. **`/parc`, l'aperçu (PV-06)** — `DetailHero` (`components/ui/maitre-detail.tsx`)
   passe en colonne sous 600 px (`max-[600px]:flex-col`, `min-w-0` sur le
   bloc gauche et ses deux textes) — même règle que `machine-banner` de
   `/parc/[id]`. **Sur le terrain, à 375 px, le bouton « Fiche complète »
   n'est plus rogné** : avant ce lot, la carte étant `overflow-hidden`, le
   bouton était simplement inatteignable au téléphone.
2. **`/parametres/agences` (PA-27)** — tri `trierAlphanumeriquement` sur le
   libellé (LISTES-1), extrait dans `trierReglagesAgences`
   (`composants.tsx`) pour être éprouvé sans base ; les agences **inactives
   passent en fin de liste**, leur ligne prend un fond gris
   (`bg-app-surface-creuse`, jeton déjà posé), et **le formulaire du pas ET
   le lien vers les plages horaires disparaissent** pour une inactive — plus
   personne ne peut régler les horaires d'un établissement fermé par erreur.
   « Modifier » reste, sur les deux états.
3. **Équipe et « Personne » (PA-39, TR-9)** — tri par NOM partout
   (`trierLesTechniciens` dans `lib/techniciens/depot.ts`,
   `comparerAlphanumerique` sur `nomSeul` dans `lib/absences/ecran.ts`),
   plus un choix vide obligatoire (« Sélectionner une personne ») en tête du
   `<select>` « Personne » des absences — **on ne peut plus déclarer un
   blocage sur la première personne de la liste par inadvertance**, le
   serveur refusait déjà l'envoi vide (`schemaCreationAbsence`, `uuid`).
4. **Tableau de bord (IN-46)** — `listerPlanning(..., { inclureAnnulees:
   false })` pour les tuiles « Interventions aujourd'hui » et « Urgences ».
   **Une intervention annulée aujourd'hui ne gonfle plus ces deux chiffres**
   ni ne remonte dans les priorités opérationnelles.
5. **`/parc`, le lien VGP (PV-11)** — retiré : `nav.vgp` est déjà une
   entrée de la barre de navigation depuis longtemps, le lien du bas de
   page était un doublon silencieux. Corrigés avec lui : le commentaire de
   `app/(back-office)/vgp/page.tsx` (qui affirmait le contraire), l'écart
   `ECARTS_MAQUETTE_AJOUTS_PARC` (`lib/machines/ecarts-maquette.ts`), et la
   clé `vgp.lien_depuis_parc` (retirée, plus aucun usage).
6. **Gardien des chemins (MO §2)** — `scripts/lib/chemins-de-depot.ts`
   contrôle désormais TOUT fichier direct de `lib/vgp/*.ts`, pas seulement
   ses `depot*.ts` (il n'y en a pas). Douze fonctions sans appelant réel
   sont nommées avec leur motif dans `FONCTIONS_SANS_CHEMIN` : une
   (`clore`) sans appelant du tout, sept appelées seulement par des tests,
   quatre exportées pour ces seuls tests.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- **Captures** dans `docs/propositions/TP-A6-TRIS-MISE-EN-PAGE/captures/`
  (le dossier porte le nom du ticket source, pas le préfixe numérique —
  choix cohérent avec le README qu'il contient), AVANT (commit `c915940`,
  via `git worktree`) et APRÈS (commit `3b7329f`), 1280 et 375 px.
- **Tableau de bord** : sur la scène forgée (une annulée P1 du jour),
  « Interventions aujourd'hui » passe de **6 → 5**, et la ligne annulée
  disparaît de « Priorités opérationnelles » — voir
  `tableau-de-bord-sans-annulee-{avant,apres}-1280.png`.
- **Agences** : la ligne inactive garde son formulaire de pas et son lien
  de calendrier AVANT, les deux disparaissent APRÈS — voir
  `agences-inactive-en-fin-{avant,apres}-1280.png`. Sa POSITION ne bouge
  pas d'un cran dans ce jeu précis : son libellé forgé (« TPA6-Zzz… »)
  triait déjà en dernier par ordre alphabétique. La preuve du
  repositionnement en fin de liste, elle, est dans
  `tests/unit/agences/tri-reglages.test.ts` (jeu où l'inactive est nommée
  « Bravo », donc alphabétiquement AVANT deux actives).
- **Coût d'une extension du gardien à TOUT `lib/`** (mesuré, pas
  seulement estimé) : **144 fonctions** exportées de `lib/*.ts` n'ont
  aujourd'hui aucun appelant réel et n'ont pas d'exemption écrite — un
  script jetable a rejoué l'algorithme de `cheminsDesDepots()` sur la
  population élargie. Hors territoire de ce ticket.
- `pnpm verify:full` intégral (format, typecheck, lint, test, test:isolation,
  build, feries:horizon, audit:partitions, test:e2e) : **vert**, 656 tests
  e2e passés, 7 sautés (aucun de ce lot).

## Ce que j'ai tranché et pourquoi

- **Tri par NOM plutôt que par agence-puis-nom** (équipe et absences) : le
  texte du lot et LISTES-1 nomment l'ordre alphanumérique croissant, sans
  qualifier de clé composée ; le pilote a choisi la lecture la plus simple
  et la plus proche de la citation d'Alexis.
- **Seules les ANNULÉES sortent des tuiles du tableau de bord**, pas les
  terminées/clôturées : c'est le texte exact du ticket (« on retire les
  ANNULEES seulement »). Si Alexis veut aussi retirer les terminées et
  clôturées de « Interventions aujourd'hui »/« Urgences », c'est une
  décision distincte, non prise ici.
- **Aucun bouton « Réactiver » n'est créé** pour une agence inactive :
  seule « Modifier » (la fiche existante) permet de la réactiver, comme
  avant ce lot.
- **Le sélecteur « Personne » est capturé FERMÉ, pas ouvert** : un
  `<select>` natif ouvert est un popup du système d'exploitation qui a
  BLOQUÉ `page.screenshot()` en 375 px (mesuré, retenté deux fois avant de
  changer d'approche) ; l'état fermé (placeholder visible) suffit à
  montrer le changement.
- **Le gardien des chemins n'est étendu qu'à `lib/vgp`**, jamais à tout
  `lib/` : décision du pilote, confirmée par la mesure (144 fonctions
  concernées) — une extension plus large est un ticket à part.

## Ce que je n'ai PAS fait

- Pas de tri par agence-puis-nom (voir « tranché » ci-dessus).
- Pas de retrait des terminées/clôturées des tuiles du tableau de bord.
- Pas de bouton « Réactiver » sur une agence inactive.
- Pas d'extension du gardien des chemins au-delà de `lib/vgp`.
- Pas touché au comparateur du planning (`lib/interventions/grille.ts:305-316`,
  `localeCompare` sans `numeric`) — hors territoire, noté seulement.
- Pas touché à `compterParVue` (`lib/interventions/depot.ts:3696`), dont
  le compte `aujourdhui` du REGISTRE inclut toujours les annulées — c'est
  une tuile différente de celles visées par IN-46 (le registre, pas le
  tableau de bord), hors territoire de ce ticket.

## Les pièges pour la session suivante

- **Le guardian `estModuleDeDepot` a deux formes désormais** : le motif
  régulier `lib/<domaine>/depot*.ts` ET les fichiers directs des
  `DOMAINES_ETENDUS` (aujourd'hui : `["lib/vgp"]`). Ajouter un domaine à
  cette liste fait grossir immédiatement la population contrôlée — mesurer
  AVANT (comme ce lot l'a fait pour `lib/vgp`) plutôt que d'ajouter à
  l'aveugle.
- **`agencesSansTechnicienDisponible`** (`app/(back-office)/absences/
  presentation.ts`) consomme le même tableau `declarables` que le
  `<select>` « Personne », et range les agences en rupture par PREMIÈRE
  APPARITION dans ce tableau : trier `declarables` par nom (ce lot) change
  donc l'ordre des agences du KPI « Rupture de service ». Vérifié qu'aucun
  test n'en dépend, documenté dans `lib/absences/ecran.ts` (docblock de
  `PersonneDeclarable`) — à garder en tête si un futur ticket touche
  encore cet ordre.
- **La contrainte `intervention_planifiee_a_sa_duree`** (PARCOURS-1) exige
  `duree_estimee_min` dès qu'une intervention passe `planifiee`/`affectee` :
  un scénario d'isolation ou de capture qui pose une intervention à ce
  statut sans cette colonne échoue à l'écriture, pas à l'assertion.
- **`git worktree` pour l'AVANT** : le fichier de capture doit être copié
  À LA MAIN dans le worktree (il n'existe pas encore sur l'ancien commit) ;
  le retirer avec `git worktree remove --force` une fois fini, sinon il
  reste listé par `git worktree list`.
- **Bruit préexistant, non touché** : deux PNG modifiés hors territoire
  (`docs/propositions/AVERT-POSE-FICHE/captures/fiche-avert-pose-apres-
  {1280,375}.png`, probablement régénérés par une exécution antérieure de
  `pnpm test:e2e`) et deux PNG non suivis dans
  `docs/propositions/9BV-TP-A5b-DATES-REPRISE/captures/` — ni l'un ni
  l'autre n'est de ce lot, aucun n'a été ajouté ni supprimé.

## Ce qui reste à faire

- Décider si les terminées/clôturées doivent aussi sortir des tuiles
  « Interventions aujourd'hui »/« Urgences » du tableau de bord (question
  ouverte pour Alexis, voir « tranché » ci-dessus).
- Décider si un bouton « Réactiver » doit être ajouté sur une agence
  inactive dans `/parametres/agences` (aujourd'hui, seule la fiche
  « Modifier » le permet).
- Éventuellement ouvrir un ticket pour étendre le gardien des chemins à
  tout `lib/` — 144 fonctions à nommer, mesuré ci-dessus, ce n'est pas un
  geste d'un après-midi.
- Le comparateur du planning (`lib/interventions/grille.ts:305-316`) reste
  sans `numeric: true` — hors territoire, à reprendre si LISTES-1 doit
  s'y appliquer aussi.
