# VISUEL-1 — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

- **Chaque écran pose désormais son propre titre d'onglet.** `app/layout.tsx`
  porte un gabarit (`metadata.title = { template: "%s — CODIPLAN", default:
  "CODIPLAN" }`, la chaîne du gabarit elle-même vivant au dictionnaire,
  `app.gabarit_titre`) ; les 47 `page.tsx` de `app/**` (hors la racine
  `/`, qui garde le titre par défaut) posent chacun `metadata.title` ou
  `generateMetadata`. *Pour l'exploitation* : plusieurs onglets ouverts se
  distinguent enfin — « Planning des interventions — CODIPLAN », « Clients —
  CODIPLAN », etc. — plutôt que cinq onglets identiques « CODIPLAN ».
- **Les quatre fiches nommées par le ticket portent le nom de leur objet** :
  la fiche client affiche la raison sociale, la fiche site son libellé, la
  fiche machine « <marque> <référence> » (la même forme que sa bannière),
  la fiche intervention sa référence affichée (« INT-00042 » ou
  « Local-XXXXXX »). Chacune passe par `generateMetadata`, avec une lecture
  MÉMOÏSÉE PAR REQUÊTE (`cache()` de React) partagée avec le rendu de la
  page — aucune requête supplémentaire à la base pour ces quatre écrans.
- **La barre du back-office ne montre plus ce qu'on ne peut pas ouvrir**
  (arbitrage D132, `docs/arbitrages.md`). Deux filtres, appliqués dans
  `lib/navigation/entrees.ts` (`entreesAffichables`) et
  `components/navigation/barre.tsx` :
  1. Une entrée INERTE (« Contrats », « Console éditeur ») n'est plus
     affichée du tout, quel que soit le rôle — l'amendement de la doctrine
     « jamais absente », qui continue de valoir pour la LISTE des quatorze
     destinations elle-même (la maquette, D121, fait toujours foi).
  2. Une entrée dont le rôle courant n'a pas la CAPACITÉ qui la gouverne
     (`lib/auth/habilitations.ts`, jamais une seconde liste de rôles)
     disparaît aussi : « Portail client » exige `consulter_parc_propre`
     (le rôle `client` seul l'a), « App technicien » exige `saisir_rapport`.
  *Pour l'exploitation* : `admin_societe` voit onze destinations sur
  quatorze, plutôt que d'apprendre à ses dépens que trois d'entre elles
  mènent à un refus ou à une redirection muette.
- **Cinq chaînes du glossaire ne fuitent plus de référence de ticket
  interne.** Deux étaient nommées par le ticket (`imports.
  modele_indisponible_motif`, « L1-09 » ; `machine.documents.sans_octets`,
  « L8-05 ») ; deux autres portaient la même faute et ont été trouvées en
  balayant tout `fr.ts` avec le motif exact du ticket (`vgp.borne`,
  « L9-08 » ; `absences.kpi_demandes_a_valider_motif`, « R3-14 »).
  « R2-13 » avait déjà quitté la tuile du tableau de bord (lot TABLEAU-1,
  vérifié, non retouché ici) ; « I8 » n'existait que dans des commentaires
  de code, jamais dans une valeur du dictionnaire — rien à corriger là.
- **Un gardien neuf empêche la fuite de revenir**
  (`tests/unit/i18n/sans-jargon-interne.test.ts`) : il applique le motif
  exact du ticket (`\b[A-Z]{1,2}\d{1,2}(-\d{2})?\b`, entre parenthèses ou en
  fin de phrase) à CHAQUE valeur de `fr.ts`, avec une liste d'exemptions
  fermée dans les deux sens. La seule exemption mesurée aujourd'hui :
  `planning.legende.en_cours` (« En cours / P1 ») — une étiquette de
  priorité métier, pas une référence de ticket, qui se trouve arriver en fin
  de phrase par construction.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- **Titres d'onglet, mesurés par un spec e2e temporaire** (non conservé,
  recette de la mémoire « captures-avant-apres-e2e ») :

  | Écran | AVANT (`f0cfe16`) | APRÈS (ce lot) |
  |---|---|---|
  | `/planning` | `CODIPLAN` | `Planning des interventions — CODIPLAN` |
  | `/interventions` | `CODIPLAN` | `Interventions — CODIPLAN` |
  | `/clients` | `CODIPLAN` | `Clients — CODIPLAN` |
  | `/parc` | `CODIPLAN` | `Parc machines — CODIPLAN` |
  | `/tableau-de-bord` | `CODIPLAN` | `Tableau de bord — CODIPLAN` |

  Confirmé aussi par l'épreuve de bout en bout étendue
  (`tests/e2e/tous-les-ecrans-rendent.spec.ts`) : sur les 38 routes du
  back-office qu'elle ouvre réellement, `document.title` n'est jamais
  exactement « CODIPLAN » et se termine toujours par « — CODIPLAN » ; sur
  les quatre fiches nommées, le titre porte le nom de l'objet lu
  indépendamment en base (une seconde lecture, volontairement séparée de
  celle de chaque page, pour ne pas éprouver une copie d'elle-même).
- **Captures AVANT/APRÈS**, dans ce dossier — barre à 1280 px, menu mobile à
  390 px, fiche machine (bloc Documents), `/imports` — prises par le même
  spec temporaire : AVANT sur `f0cfe16` (état de `main` avant ce lot), APRÈS
  sur ce commit. La barre AVANT porte visiblement « Contrats » et « Console
  éditeur » éteints, et « Portail client » cliquable ; la barre APRÈS n'en
  porte plus aucun, pour `admin_societe`.
- **`pnpm verify:full` complet et vert** sur ce commit : `format:check`,
  `typecheck`, `lint`, 2658 tests unitaires (246 fichiers), 1158 tests
  d'isolation (114 fichiers), `build` (65 pages), `feries:horizon` (2
  territoires, 12 mois d'avance), `audit:partitions` (13 partitions,
  0 ligne dans la partition par défaut), et 174 scénarios de bout en bout
  (3 sautés, motif nommé, sans donnée au semis — inchangé par ce lot).

## Ce que j'ai tranché et pourquoi

1. **L'amendement de D132 porte sur le RENDU, jamais sur la LISTE.**
   `ENTREES` continue de porter exactement les quatorze destinations de la
   maquette (D121, gardien `entrees.test.ts` inchangé) — seul ce qu'un
   rendu du back-office en montre à un rôle donné varie. Une entrée inerte
   qui livre son écran redevient visible d'elle-même le jour où `chemin`
   cesse d'être `null` : rien à retoucher dans le mécanisme de filtrage.
2. **La capacité de chaque entrée est choisie par le domaine qu'elle OUVRE,
   jamais par une action qu'on y accomplit accessoirement** — écrit en
   détail dans `lib/navigation/entrees.ts` au-dessus de `CAPACITE_REQUISE`.
   « Parc machines » et « VGP » lisent `consulter_parc_complet` (la vue),
   pas `gerer_machine` ni `enregistrer_vgp` (l'écriture).
3. **Le rôle atteint `BarreDeNavigation` par un prop OPTIONNEL, jamais en
   changeant ce que `app/(back-office)/layout.tsx` passe comme `entrees`.**
   Le gardien R2-16 (`tests/unit/app/barre-par-segment.test.ts`) exige la
   présence littérale de `entrees={ENTREES}` dans ce fichier ; `role={role}`
   s'ajoute à côté, sans y toucher. `role` vient de `chromeDeLaRequete`
   (`lib/navigation/chrome.ts`), déjà appelée par ce layout pour le thème et
   les initiales — zéro lecture de session supplémentaire.
4. **Un appelant qui ne passe pas `role` garde le comportement d'avant D132
   pour le filtre de capacité** (seul le filtre des entrées inertes reste
   inconditionnel). Le portail et le terrain n'ont aujourd'hui ni entrée
   inerte ni entrée hors de portée de leur seul rôle ; leurs mises en page
   n'ont donc pas eu besoin d'être touchées.
5. **Les lectures des quatre fiches sont mémoïsées PAR REQUÊTE avec
   `cache()` de React**, jamais dupliquées entre `generateMetadata` et la
   page — y compris la SESSION elle-même (`sessionCache`), sans quoi
   `contexte` serait un objet différent à chaque appel et casserait la
   mémoïsation par égalité d'arguments. Pour l'écran des calendriers
   d'agence (`/parametres/agences/[id]`) et celui des forfaits, une lecture
   BORNÉE (juste le libellé) remplace la mémoïsation complète quand
   dupliquer toute la lecture de la page aurait été disproportionné — le
   ticket l'autorisait explicitement.

## Ce que je n'ai PAS fait

- **`/terrain/[id]` (la journée d'un technicien) garde un titre générique**
  (`t("terrain.titre")`), pas le nom du client de l'intervention affichée.
  Ce n'est pas l'une des quatre fiches que le ticket nomme explicitement
  (client, site, machine, intervention), et le temps du lot a été mis sur
  ces quatre-là plutôt que sur une cinquième non demandée.
- **`(portail)/layout.tsx` et `(mobile)/layout.tsx` ne reçoivent pas
  `role`** — voir le point 4 ci-dessus. Le mécanisme (`entreesAffichables`)
  est prêt ; le câblage est à faire le jour où l'une de ces deux barres
  gagne une entrée inerte ou hors de portée de son seul rôle.
- **La branche « entrée inerte » de `Entree()`
  (`components/navigation/barre.tsx`) n'a pas été supprimée**, alors
  qu'elle est désormais inatteignable depuis `BarreDeNavigation` (les
  entrées inertes sont filtrées avant). Je l'ai laissée : le type
  `EntreeNavigation.chemin` reste `string | null` par construction (la
  liste `ENTREES` porte réellement des entrées inertes), et la retirer
  aurait forcé soit un second type, soit un `as` — aucun des deux ne
  valait le gain pour du code mort mais inoffensif.
- **Aucune migration, aucun droit changé** — D131 fait foi, inchangé.
  Le filtrage de la barre ne décide jamais rien à la place de la politique
  de cloisonnement ou du garde de route.

## Les pièges pour la session suivante

- **`tsconfig` inclut `tests/`, et `next build` type-vérifie tout ce
  périmètre.** Pour rejouer un AVANT/APRÈS par `git checkout <ancien-ref>
  -- .`, tout fichier de test NEUF (donc non touché par ce checkout, resté
  dans sa forme APRÈS) qui référence une API qui n'existe pas encore dans
  l'ancien code fait échouer le `build` AVANT. Déplacer ces fichiers neufs
  hors de `tests/` le temps de la capture AVANT, les remettre avant la
  capture APRÈS — c'est ce que ce lot a dû faire pour
  `barre-par-role.test.tsx` et `sans-jargon-interne.test.ts`.
- **`git restore .` après un `git checkout <ref> -- .` NE RESTAURE PAS À
  `HEAD`** — `checkout` a déjà mis l'ANCIEN contenu dans l'INDEX, et
  `restore` (sans argument de source) restaure le répertoire de travail
  DEPUIS L'INDEX, donc reste sur l'ancien contenu. La commande qui revient
  réellement à l'état commité est `git checkout HEAD -- .` (ou `git restore
  --source=HEAD --staged --worktree .`).
- **Le gardien R3-12 (`scripts/lib/chemins-de-depot.ts`) détecte un
  appelant par une REGEX TEXTUELLE `nomDeFonction\s*\(`** — une fonction de
  dépôt enveloppée `cache(lireSite)` sans qu'aucun fichier atteint ne
  porte plus jamais littéralement `lireSite(` devient « orpheline », même
  si elle est bel et bien appelée (par la valeur enveloppée). Le remède qui
  garde le mécanisme honnête : `cache((contexte, id) => lireSite(contexte,
  id))` plutôt que `cache(lireSite)` — la mémoïsation reste identique, et
  le texte `lireSite(contexte, id)` reste lisible par le gardien. `lireSite`
  a eu besoin de ce remède ; `lireClient` (déjà exempté pour un motif
  aujourd'hui périmé), `lireMachine` et `lireFicheIntervention` (chacune
  gardant un AUTRE appelant réel ailleurs) n'en ont pas eu besoin.
- **`main a[href^="/parc/"]` matche aussi `/parc/nouvelle`** (le bouton
  « + Machine ») avant toute ligne de machine — un sélecteur de capture ou
  de test qui veut LA fiche d'une machine doit exclure ce chemin
  explicitement.

## Ce qui reste à faire

- Rien n'est bloquant pour ce lot. Deux limites connues, nommées ci-dessus
  sous « Ce que je n'ai pas fait », restent à lever le jour où elles
  comptent : le titre générique de `/terrain/[id]`, et le câblage de `role`
  pour le portail et le terrain si l'une des deux barres gagne un jour une
  entrée inerte ou hors de portée d'un rôle.
