# Passation — 9EE-TP-UX4-1-FICHE-INTERVENTION-1

## Ce que j'ai changé

La fiche intervention (`app/(back-office)/interventions/[id]/page.tsx`) reconstruite au
gabarit de la maquette du 28/09, sur sa TÊTE seulement (en-tête, bandeau d'état, frise
D8) :

- **`Page`** (`components/mise-en-page/page.tsx`) gagne deux props facultatives,
  `pastilles` (rendue DANS le `<h1>`, à côté du titre) et `faits` (sous le sous-titre).
  Aucun autre appelant ne change de rendu (les deux sont `undefined` partout ailleurs).
- **Surtitre** : « Intervention · <référence> » (+ « · Numéro provisoire »),
  `surtitreDeLaFiche` (nouvelle fonction, `presentation.ts`). **Titre** : « <nature> ·
  <client> » (QE-9 (a)) — la référence quitte le `<h1>` pour le surtitre ; `titreDeLaFiche`
  reste inchangée, elle ne sert plus qu'à `generateMetadata` (le titre d'onglet du
  navigateur ne bouge pas). **Pastilles** : statut (inchangée) + priorité (`Badge`, comme
  la fiche demande de 9ED).
- **La ligne de faits** (`EnTeteFiche`, neuf, `components/ui/entete-fiche.tsx`) : Site,
  Machine, Créneau (ex-« Date planifiée »), Technicien, Créée (masquée sur une fiche
  reprise d'un import). Un `<dl>` avec de vrais `<dt>`/`<dd>`, pas des `<div>` muets :
  Site/Machine/Technicien/Créneau réutilisent les clés `fr.ts` déjà écrites pour l'ancienne
  liste, pour que les épreuves de bout en bout qui cherchaient déjà ces `<dt>` continuent
  de les trouver sans que leur attente change.
- **L'action principale, en tête** : un lien (`LienPrimaire`, composant déjà existant,
  jamais une apparence recopiée) vers l'ancre `#action-<principale>` du bloc réel dans
  l'aside — même verdict, même capacité, même libellé que le lien 9AD au téléphone,
  qu'il REJOINT sans le remplacer (les deux coexistent).
- **Le bandeau d'état** (`BandeauEtat`, neuf, `components/ui/bandeau-etat.tsx` ;
  `bandeauDeLaFiche`, fonction pure neuve, `presentation.ts`) : un cas par statut — à
  planifier (refus si P1, information sinon, avec la durée et l'habilitation bloquante du
  site nommée), en retard (refus), planifiée calme (information), en cours avec un
  segment ouvert (information), suspendue (avertissement, motif et pièce), terminée
  (avertissement si la clôture est refusée, succès sinon).
- **La frise D8** (`FriseEtapes`, neuf, `components/ui/frise-etapes.tsx` ;
  `etapesDeLIntervention`, fonction pure neuve) : six étapes, une suspension ARRÊTE
  « En cours » plutôt que d'en ajouter une septième, aucune frise sur une annulée ni une
  fiche reprise d'un import.
- **`BlocATraiter`** (neuf, `components/ui/a-traiter.tsx`) : posé par anticipation pour
  TP-UX4-2, aucun appelant réel dans ce lot — testé seul.
- **Icône `clock`** ajoutée à `components/ui/icone.tsx` (contour exact de la planche de
  la maquette).
- **`lireFicheIntervention`** (`lib/interventions/depot.ts`) lit désormais
  `deplanifiee_le` (colonne déjà posée par 9CC-DEPLANIFIEE-1) — aucune migration.
- **La liste `<dl>` restante** perd Date, Nature, Priorité, Machine, Site, Technicien
  (montés dans l'en-tête ou les pastilles) ; garde Client (le `<h1>` le NOMME, cette ligne
  MÈNE à sa fiche — les deux rôles ne se recouvrent pas), Agence, Forfait, Mode de
  valorisation, Panne signalée, Contact sur place, Référence client, Motif d'annulation.

Pour l'exploitation : un planificateur voit désormais d'un coup d'œil où en est une
intervention (frise), depuis quand elle attend et pourquoi (bandeau), sans dérouler une
liste de quatorze lignes. Rien ne change dans les capacités, les verdicts ou les routes.

## Ce que j'ai mesuré

- `pnpm test` : 414 fichiers, 4388 tests, tous verts (avant et après chaque commit).
- `pnpm typecheck` / `pnpm lint` / `pnpm format:check` : verts à chaque commit.
- `CI=1 pnpm test:e2e` sur les 21 spécifications identifiées par l'audit comme
  potentiellement touchées par le changement d'en-tête : 74 tests, verts après
  adaptation de 4 sélecteurs (absences-3, fiche-375, fiche-telephone ×2, interventions-2).
- Épreuve neuve sur fixture dédiée (`tests/e2e/fiche-entete-bandeau-frise.spec.ts`, scène
  `9EE-`) : 7 tests, en-tête/bandeau/frise sur six statuts (dont P1 avec habilitation
  bloquante, suspendue avec pièce, terminée refusée et acceptée), sous les rôles ADV et
  responsable SAV — tous verts, captures prises.
- **`CI=1 pnpm verify:full` complet, deux exécutions** : la première (42,2 min) a trouvé 6
  régressions réelles (toutes dues au `role="status"` du nouveau bandeau d'information
  collidant avec le bandeau de motif existant, lui aussi `role="status"`, sur une fiche à
  planifier/planifiée qui redirige avec un refus) ; corrigées (5 épreuves, sélecteurs
  scopés au texte attendu — jamais l'attente affaiblie) et une (`planning-survol-cases`,
  sans rapport avec ce lot, une mesure de géométrie sur `/planning`) non reproduite sur
  la seconde exécution. **La seconde exécution (41,5 min) est passée entièrement : 1504
  tests d'isolation, 1042 tests de bout en bout (48 ignorés), build compris.**

## Ce que j'ai tranché et pourquoi

- **Pastilles DANS le `<h1>`, jamais à côté** (Q2 du pilote) : les 33 lectures
  `getByRole("heading",{level:1}).getByText(fr["statut.X"])` déjà écrites devaient
  continuer de trouver le statut sans qu'on les touche — seule la RÉFÉRENCE est sortie du
  `<h1>` (vers le surtitre), jamais le statut ni la priorité.
- **L'action principale est un LIEN D'ANCRE, jamais un second formulaire** (Q3/Q4/Q9) :
  aucun bloc ne se déplace de l'aside, l'en-tête ne fait que raccourcir le chemin vers lui
  — même mécanique que le lien 9AD déjà posé, qu'elle rejoint.
- **`BandeauEtat` est un quasi-doublon délibéré de `Message`** (Q12) : les deux portent un
  titre, un texte, un rôle qui suit le ton, mais `Message` sert un ÉVÉNEMENT (succès/refus
  d'un geste) et `BandeauEtat` sert un ÉTAT COURANT (y compris « tout va bien, en
  information ») — fondre les deux aurait ajouté un quatrième ton à un composant dont
  `TonMessage` est la liste fermée ailleurs dans le dépôt.
- **`EnTeteFiche` réutilise les clés `fr.ts` existantes** (Site → `mot("site")` ; Machine
  → `intervention.machine` ; Technicien → `intervention.technicien`) plutôt que d'ouvrir
  une seconde entrée pour le même mot : les épreuves de bout en bout qui cherchaient déjà
  ces `<dt>` par leur texte n'ont pas eu besoin de changer. Seul « Créneau » est un
  renommage voulu (ex-« Date planifiée »), et les deux épreuves qui le cherchaient par son
  ancien texte ont été adaptées.
- **Pas de fil d'Ariane sur cette fiche** (Q1, annule l'addendum du 06/10 11h) : elle
  garde `retourFiche`, choix du pilote — ce sera un lot à part.
- **Les valeurs de fixture (code d'habilitation, référence de pièce) de la nouvelle
  épreuve vivent dans `fr.ts`** (`9ee.e2e.*`), jamais en littéral dans une requête
  d'écran — même convention que `interventions2.e2e.*` ; sans ça, le gardien
  `sans-chaine-visible-en-dur` rougit (mesuré, corrigé).
- **Les dates de fixture passent par `instantDuJour(jourDe(maintenant(fuseau).local))`**,
  jamais `CURRENT_DATE` en SQL brut — le gardien `e2e-mise-en-scene.test.ts` le vérifie
  (`CURRENT_DATE` est le jour du serveur Postgres, pas celui de Nouméa) ; mesuré, corrigé.

## Ce que je n'ai PAS fait

- **Les onglets, la colonne « Sur place », le menu « ⋯ »** : hors de ce lot (-2,
  TP-UX4-2), territoire explicitement réservé.
- **Les captures AVANT** : seul l'APRÈS a été pris (voir le README des captures) — le
  temps du lot n'a pas suffi à rejouer la même épreuve contre le commit de départ depuis
  un `git worktree` jetable, et l'épreuve appelle `habilitationExigeeSurLeSite`, une
  fonction absente de l'ancien code. Écrit comme un manque, pas vérifié.
- **La checklist du bandeau « Terminée » refusé** : la maquette compose plusieurs raisons
  à partir d'une checklist que ce dépôt n'a pas (arbitrage du 03/10/2026, point 3.10) —
  le bandeau ne porte que la seule raison que `peutCloturer` connaît aujourd'hui (temps
  manquant).
- **« Valider le rapport » / l'état « rapport validé »** : n'existent pas (IN-20,
  migration), le bandeau « Prête à clôturer » ne les mentionne donc pas.
- **Dater un retour à la file par un déplacement vide ou par la reprise d'une suspendue**
  avec la même précision qu'un retour par absence (`deplanifiee_le`) : aucune colonne ne
  le porte ; ces deux cas restent datés par `cree_le` seul (migration, nommée en D182).

## Les pièges pour la session suivante

- **`role="status"` collide** : le bandeau de motif existant (refus/succès d'un geste,
  `<p role="status">` inline dans `page.tsx`) et le nouveau `BandeauEtat` (ton
  information/avertissement/succès) portent tous les deux `role="status"`. Toute épreuve
  future qui fait `page.getByRole("status")` NU sur la fiche intervention doit filtrer
  sur le TEXTE attendu (`.filter({hasText: ...})`) ou sur la balise (`p[role='status']`
  pour le motif, `div[role=...]` pour l'état) — jamais le rôle seul.
- **`BandeauMotif` (`components/ui/bandeau-motif.tsx`) existe déjà et porte
  `data-motif`**, mais la fiche intervention n'en a jamais fait usage — son bandeau de
  motif reste un `<p>` inline sans cet attribut. Si une session future veut éliminer la
  collision ci-dessus à la racine, c'est là qu'il faudrait regarder — PAS fait ici (hors
  territoire, risque de toucher un mécanisme partagé par d'autres écrans).
- **La suite e2e complète régénère des dizaines de captures d'autres lots** (toute
  épreuve qui capture la fiche intervention). `git checkout --` dessus avant de committer,
  jamais `git add -A`.
- **`EnTeteFiche` reçoit des `valeur: ReactNode` déjà composés** (y compris les liens) —
  elle ne connaît aucune règle de lien ni aucune donnée ; c'est `page.tsx` qui compose
  `contenuSite`/`contenuMachines` et les passe tout faits.
- **Les littéraux dans une requête d'écran d'une épreuve de bout en bout sont TOUJOURS
  flagués**, même une constante de fixture nommée (`PIECE_REF`, `TIRET`) si elle résout
  à un littéral de chaîne déclaré dans le même fichier — l'échappatoire éprouvée est soit
  une clé `fr.ts`, soit un appel de fonction (jamais tracé par le gardien).

## Ce qui reste à faire

- **TP-UX4-2** : les onglets (Résumé/Temps/Rapport/Valorisation/Historique), la colonne
  « Sur place » collante, le menu « ⋯ » des gestes rares — sur la tête posée ici.
- **Le fil d'Ariane sur la fiche intervention** : toujours absent (D168/9DR ne l'a jamais
  posé ici), reste un lot à part, hors ce ticket.
- **Dater les retours à la file par déplacement vide / reprise de suspendue** (migration)
  si Alexis le souhaite un jour — nommé en D182, limite connue.
- **Les captures AVANT**, si elles sont un jour nécessaires — rejouer
  `tests/e2e/fiche-entete-bandeau-frise.spec.ts` depuis un `git worktree` jetable au
  commit `23e45c98`, après avoir neutralisé l'appel à `habilitationExigeeSurLeSite`
  (absente de ce commit) dans un second fichier de capture dédié.
