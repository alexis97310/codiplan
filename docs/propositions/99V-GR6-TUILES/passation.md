# 99V-GR6-TUILES — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

- **`lib/interventions/depot.ts`** — `enAttenteDePiece` exclut désormais les clients
  inactifs (`filtreClientActif(false)`, réutilisé — même geste que `listerPlanning`).
  C'est la seule file qui l'alimente, la carte « Dossiers bloqués » du tableau de
  bord ; son détail doit compter sous le même filtre que le total qui le contient.
- **`app/(back-office)/tableau-de-bord/page.tsx`** — la tuile « Dossiers bloqués »
  compte désormais **toutes** les suspendues (`compterParVue` sur une recherche
  vide, le même critère que l'onglet « Bloquées » du registre — client actif
  compris), et non plus seulement celles qui attendent une pièce. Son détail
  devient « dont N en attente de pièce » (N = la file `enAttenteDePiece`, sous-
  population du total). Elle mène maintenant à `/interventions?vue=bloquees`.
  Libellé de la tuile inchangé.
- **`app/(back-office)/interventions/page.tsx`** — `kpiDuRegistre` réutilise
  `compterParVue` sur une recherche vide pour ses deux tuiles « En cours » et
  « En attente », au lieu d'un `count` littéral sans filtre client actif. Les
  deux tuiles mènent maintenant à `/interventions?vue=en_cours` et
  `/interventions?vue=bloquees` — des liens NUS, qui ne composent pas avec les
  filtres actifs (la portée du bandeau reste fixe, `hrefOnglet` n'est jamais
  utilisé ici).
- **`lib/i18n/fr.ts`** — une clé neuve pour le détail de la tuile du tableau de
  bord (`tableau_de_bord.en_attente_detail_suffixe_piece`), une pour son lien
  (`tableau_de_bord.lien_dossiers_bloques`), deux pour les liens du registre
  (`interventions.lien_kpi_en_cours`, `interventions.lien_kpi_en_attente`).
  L'ancienne clé `tableau_de_bord.en_attente_detail_suffixe` (« depuis plus de
  30 jours ») est retirée : ce détail n'existe plus, remplacé par le sous-total
  « en attente de pièce ». **Aucun libellé de tuile ni d'onglet renommé**
  (décision d'Alexis du 26/09 : « Dossiers bloqués », « En attente »,
  « Bloquées », « Suspendue » gardent leurs mots).

Pour l'exploitation : les trois tuiles disent maintenant EXACTEMENT ce que
leur onglet montre — un exploitant qui clique une tuile atterrit sur la liste
qu'elle vient de lui annoncer, jamais une liste plus courte ou plus longue.
Les deux tuiles du registre ont par ailleurs gagné un lien qu'elles n'avaient
jamais eu.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

Captures dans `docs/propositions/99V-GR6-TUILES/captures/` (`avant-*`/`apres-*`,
1280 et 375), prises par le même harnais que les scénarios de bout en bout
(`ouvrirUneSession`), sur la base de démonstration locale, AVANT au commit
`7c8736a` (avant ce lot) et APRÈS au code de ce lot :

- **Tableau de bord, « Dossiers bloqués »** : AVANT = **1** (aucun lien).
  APRÈS = **0**, avec le lien « Voir les dossiers bloqués → ». L'écart
  n'est pas théorique : la base de démonstration porte une intervention
  suspendue avec pièce attendue (`Local-000030`, `CMP-5502-A`) dont le CLIENT
  est inactif — comptée par l'ancien total (`enAttenteDePiece` sans filtre),
  absente de l'onglet « Bloquées » (qui l'excluait déjà, RG-PLA-08). C'est
  exactement l'écart structurel décrit par l'audit (constat G7), mesuré ici
  sur un cas vivant plutôt que supposé. La carte « Priorités opérationnelles »
  perd d'ailleurs sa ligne « Pièce attendue » entre les deux captures, pour la
  même raison.
- **Registre, « En cours »** : AVANT = **2** (aucun lien), onglet « En cours »
  déjà à **(1)**. APRÈS = **1**, avec le lien « Voir les interventions en
  cours → » vers `/interventions?vue=en_cours` — le même nombre que l'onglet.
  Le même client inactif que ci-dessus porte une intervention `en_cours`,
  expliquant l'écart AVANT.
- **Registre, « En attente »** : AVANT = **1** (aucun lien), onglet
  « Bloquées » déjà à **(0)**. APRÈS = **0**, avec le lien « Voir les dossiers
  bloqués → » vers `/interventions?vue=bloquees`.
- `pnpm test` : 2909 tests, 270 fichiers, vert. `pnpm test:isolation` : 1239
  tests, 126 fichiers, vert (dont `tests/isolation/suspension.test.ts`, qui
  traverse `enAttenteDePiece`). `pnpm typecheck`, `pnpm lint`,
  `pnpm format:check`, `pnpm build` : verts.
- `pnpm exec playwright test` (suite complète, 316 scénarios) : les six
  scénarios neufs ou réécrits de ce lot passent tous
  (`tests/e2e/tableau-de-bord-liens-tuiles.spec.ts`,
  `tests/e2e/registre-kpi-liens.spec.ts`). Voir « Le conflit non résolu » plus
  bas pour trois échecs étrangers au lot.

## Ce que j'ai tranché et pourquoi

- **Aucune scène `ERGO6-` forgée pour les épreuves e2e**, malgré le modèle
  suggéré (`registre-1.spec.ts`). Forger une intervention `en_cours` ou
  `suspendue` — même temporairement — changerait un compte que d'AUTRES
  épreuves lisent en parallèle sur la société partagée : le ticket lui-même
  l'interdit explicitement dans son piège connu (« Tes epreuves ne forgent
  RIEN qui change un compte lu par une autre epreuve dans la societe
  partagee (tuiles du tableau de bord, KPI…) »). J'ai résolu la tension en
  faveur de cette règle, plus spécifique et plus tardive dans le texte du
  ticket : les deux nouveaux/réécrits scénarios (`tableau-de-bord-liens-
  tuiles.spec.ts`, `registre-kpi-liens.spec.ts`) sont en LECTURE SEULE,
  comparent la tuile à son onglet dans le même passage, et ne comptent jamais
  un nombre absolu — exactement le repli que le fichier existant pratiquait
  déjà (« Lecture seule », docblock de tête).
- **Le total de la tuile « Dossiers bloqués » vient de `compterParVue`,
  jamais d'un nouveau `count` écrit à la main** — le ticket le demande
  explicitement (« ne crée pas une seconde lecture du critère »), et c'est le
  même geste que le registre : une seule fonction de dépôt sait ce qu'est
  « toutes les suspendues, client actif compris ».
- **`enAttenteDePiece` exclut le client inactif DANS le dépôt**, pas par un
  filtre recomposé côté écran. C'est son seul appelant, et c'est la même
  discipline que `listerPlanning` (qui applique déjà `filtreClientActif(false)`
  sans case pour le lever) : la carte « Dossiers bloqués » n'offre elle non
  plus aucune case « inclure les clients inactifs ».
- **`SEUIL_ANCIENNETE_JOURS`, `ancienNombreEnAttente` et le type
  `FicheEnAttente` sont supprimés**, pas laissés orphelins : le nouveau détail
  ne compte plus l'ancienneté, et rien d'autre ne les appelait (vérifié par
  recherche globale avant suppression).
- **Les liens du registre sont NUS** (`/interventions?vue=en_cours`,
  `/interventions?vue=bloquees`), jamais `hrefOnglet(parametresActifs, …)` —
  conforme à la portée FIXE déjà écrite au-dessus de `kpiDuRegistre`
  (« changer un filtre ne doit pas faire bouger ces trois nombres »).
- **`tests/unit/interventions/colonnes-et-kpi.test.ts` a été réécrit**, pas
  seulement complété : ses anciennes assertions (`'statut: "en_cours"'`,
  `'statut: "suspendue"'` littéraux dans `page.tsx`) vérifiaient un détail
  d'implémentation que ce ticket change délibérément (ces deux critères vivent
  maintenant dans `compterParVue`, `lib/interventions/depot.ts`). Je n'ai pas
  affaibli le test : son intention (« un FAIT RÉEL, jamais une valeur
  illustrative ») reste vérifiée, sous une autre forme (présence de l'appel à
  `compterParVue(contexte, CRITERES_REGISTRE_VIDE)` et du mappage vers
  `enCours`/`enAttente`).
- **Deux marqueurs `data-bloc` ajoutés** (`kpi-en-cours`, `kpi-en-attente`) sur
  le registre, absents avant ce lot — nécessaires pour cibler chaque tuile
  dans le scénario e2e neuf, même convention que les marqueurs déjà posés sur
  le tableau de bord (`kpi-bloques`, etc.). Pas de logique, un simple crochet
  de test.

## Ce que je n'ai PAS fait

- Je n'ai pas touché à `dashboard()` de la maquette ni à la disposition D125 —
  aucune tuile déplacée, aucun libellé renommé.
- Je n'ai pas ajouté de case « inclure les clients inactifs » à la carte
  « Dossiers bloqués » ni au bandeau du registre : la case existante du
  registre suffit à retrouver l'historique complet depuis cet écran-là.
- Je n'ai pas touché aux tuiles « Interventions aujourd'hui », « Taux
  d'occupation », « VGP à prévoir », « Planifiées cette semaine » — hors
  territoire du ticket.
- Je n'ai pas forgé la scène `ERGO6-` suggérée par le ticket — voir « Ce que
  j'ai tranché et pourquoi ».

## Les pièges pour la session suivante

- **Le nombre de la tuile « Dossiers bloqués » peut redescendre à 0 sur la
  base de démonstration** dès qu'un ticket futur modifie ou retire
  l'intervention `Local-000030` (client inactif) — les captures AVANT de ce
  lot resteraient une preuve historique, pas un état permanent à retrouver.
- **`detailEnAttenteDePiece` a changé de sens** : avant ce lot, un détail
  absent voulait dire « rien au-delà de 30 jours » ; depuis ce lot, un détail
  absent veut dire « aucune des suspendues ne porte de pièce attendue ». Une
  session qui chercherait encore un seuil d'ancienneté sur cette tuile ne le
  trouvera plus — c'est voulu (voir la note de tête d'`enAttenteDePiece`,
  `lib/interventions/depot.ts`).
- **Ne pas réintroduire `client: { actif: true } }` à la main** dans
  `kpiDuRegistre` ou ailleurs pour un besoin voisin : `filtreClientActif` est
  privée à `lib/interventions/depot.ts`, et le geste attendu est de composer
  avec `compterParVue`/`enAttenteDePiece`, pas de la dupliquer.

## Le conflit non résolu

Aucun rouge sur le territoire de ce ticket. `pnpm exec playwright test` (suite
complète, hors filtre) a rendu trois échecs sur des fichiers ÉTRANGERS à ce
lot, non touchés par le diff (confirmé par `git diff 7c8736a HEAD --stat`) :

- `tests/e2e/equipe-1.spec.ts:212` — collision de sélecteur strict (« 2
  interventions à venir » matche deux liens de deux techniciens différents) ;
  vraisemblablement une coïncidence de données de démonstration, pas un
  défaut introduit ici.
- `tests/e2e/planning-6.spec.ts:50` (1280px et 1440px) — `[data-aujourdhui]`
  introuvable dans la vue semaine du planning ; sans rapport avec le registre
  ou le tableau de bord.
- `tests/e2e/parcours-creer-puis-planifier.spec.ts:123` — rouge seulement en
  contention (suite complète, plusieurs workers) ; repassé au vert seul, avec
  `--workers=1`, aux côtés d'`equipe-1` et `planning-6` (ces deux-là restent
  rouges même isolés, donc pas un pur effet de parallélisme).

Ces trois n'entrent dans aucun périmètre de ce lot (`app/(back-office)/
interventions/`, `app/(back-office)/tableau-de-bord/`, `lib/interventions/
depot.ts`, `lib/i18n/fr.ts`) et je ne les ai pas touchés, ni leur mise en
scène ni leur assertion — je les nomme ici sans les corriger, comme demandé.
