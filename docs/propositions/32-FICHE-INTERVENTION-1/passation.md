# FICHE-INTERVENTION-1 — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

- **La date et l'heure planifiées entrent dans l'en-tête** de la fiche
  (`app/(back-office)/interventions/[id]/page.tsx`), en première ligne du
  bloc d'identité — avant « Nature ». `lireFicheIntervention`
  (`lib/interventions/depot.ts`) lit désormais le fuseau de l'agence
  (`fuseauDeLAgence`, déjà utilisé ailleurs dans ce fichier) et le rend dans
  la fiche ; l'écran compose la date (`dateCivile`) et l'heure
  (`heureDuCreneau`, la MÊME fonction que le planning) en une seule ligne
  « 13/10/2026 08:00 ». Sans date, la ligne dit « À planifier »
  (`t("statut.a_planifier")`, réutilisé), jamais un tiret nu. *Pour
  l'exploitation* : un planificateur voit QUAND se passe l'intervention sans
  ouvrir le formulaire « Déplacer ».
- **Le retour mène à l'écran d'origine.** Les liens des listes et fiches qui
  ouvrent une intervention (registre `/interventions`, fiche client, fiche
  site, fiche machine — deux endroits sur `/parc/[id]`) portent désormais
  `?depuis=…` (et `?depuis_id=…` pour une machine, une intervention pouvant
  en porter plusieurs). `retourFiche` (`../presentation.ts`) est une LISTE
  FERMÉE de cinq valeurs (`planning`, `interventions`, `client`, `site`,
  `machine`) — jamais une URL libre reçue en clair — et rend **ensemble**
  l'`href` et le libellé du lien, pour que les deux ne puissent jamais
  diverger (voir « Ce que j'ai tranché », point 1). Sans `depuis`, ou une
  valeur inconnue, le retour reste « Retour au planning », comme avant ce
  ticket.
- **Sur une intervention clôturée ou annulée, le mur d'actions disparaît.**
  Les cinq blocs d'action (affecter, déplacer, clôturer, suspendre/reprendre,
  annuler) et le formulaire « Ajouter une machine » sont regroupés dans un
  panneau unique « Actions ». Quand l'intervention est FIGÉE (`estFige`,
  `lib/interventions/cycle-de-vie.ts` — ni bloc refusé répété quatre fois,
  ni formulaire d'ajout de machine avec sa liste de ~30 entrées : une seule
  ligne reprend le texte déjà écrit pour ce refus
  (`intervention.refus.cloturee_figee` / `annulee_figee`), et SEULE
  l'annulation reste un formulaire plein quand le rôle et D131 l'autorisent.
  Sur une intervention NON figée, rien ne change : chaque refus continue de
  s'afficher à la place de l'action, avec sa raison écrite en toutes
  lettres (la porte accessible-au-clavier, la liste nominative bloquée par
  le rôle, etc. restent comme avant — voir « Ce que je n'ai pas fait »).
- **Le sous-titre du numéro provisoire perd son jargon.**
  `intervention.sans_numero` passe de « Le numéro est attribué par le
  serveur à la première synchronisation. » à « Numéro provisoire ». La clé
  reste la même ; seul son texte change (elle n'est utilisée que sur cette
  fiche).
- **La note « Déduit du lieu d'intervention » ne se répète plus** : elle ne
  s'affiche plus que sous « Agence », plus sous « Forfait de déplacement ».

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- `pnpm verify:full`, deux fois de suite, **vert en entier** à la seconde
  tentative : 2638 tests unitaires, 1154 tests d'isolation, 165 scénarios
  e2e passés (3 volontairement ignorés, préexistant à ce lot). La première
  tentative a rougi deux fois pour deux raisons DIFFÉRENTES, corrigées
  chacune avant de relancer — voir « pièges » ci-dessous.
- Douze captures 1280/390 px, AVANT et APRÈS, dans ce dossier — trois
  fiches (planifiée-datée, clôturée, sans date), prises par un spec e2e
  temporaire non conservé (recette de la mémoire
  `captures-avant-apres-e2e`) : AVANT sur le code de `5c8fe0a` (état de
  `main` avant ce lot), APRÈS sur ce commit. La fiche clôturée est le
  contraste le plus net : AVANT, quatre blocs rouges répètent chacun « … ne
  se modifie plus sans trace… » et un formulaire « Ajouter une machine »
  reste ouvert ; APRÈS, une ligne et un seul formulaire (« Annuler »).
- L'épreuve neuve `tests/e2e/fiche-intervention.spec.ts` (5 scénarios) a été
  rejouée sur le code d'AVANT (`git checkout 5c8fe0a -- <fichiers
  touchés>`, hors épreuve elle-même) : le scénario du retour rougit
  immédiatement — aucun `?depuis=` n'est compris, le lien reste « Retour au
  planning » quel que soit le paramètre —, et celui des blocs sur une fiche
  clôturée rougit sur les quatre formulaires refusés qui restent montés.
  Rejouée sur ce commit, les cinq scénarios passent, individuellement et
  ensemble.

## Ce que j'ai tranché et pourquoi

1. **`retourFiche` rend l'`href` ET le libellé dans un seul objet
   (`RetourFiche`), jamais deux fonctions séparées.** Ma première écriture
   avait deux fonctions (`retourFiche` pour l'`href`, `libelleRetourFiche`
   pour le texte) qui relisaient chacune `depuis` — et l'épreuve neuve l'a
   fait rougir : pour `?depuis=machine` avec un `depuis_id` qui ne
   correspond à AUCUNE machine de l'intervention, `retourFiche` retombait
   correctement sur le planning, mais `libelleRetourFiche` — qui ne
   regardait que la valeur brute de `depuis`, pas si l'identifiant avait
   validé — continuait de dire « Retour à la machine ». Le lien aurait donc
   MENTI sur sa propre destination. La même famille de faute que §9 nomme
   partout dans ce dépôt (deux lectures d'un même critère divergent en
   silence) ; la correction fusionne les deux en un seul calcul qui ne peut
   plus se contredire.
2. **« Ajouter une machine » est gouverné par `estFige`, jamais par une
   nouvelle règle.** Le dépôt (`ajouterMachineAIntervention`,
   `lib/interventions/depot.ts`) n'a AUCUN garde-fou de statut aujourd'hui —
   on peut rattacher une machine à une intervention clôturée ou annulée par
   la route elle-même, ce ticket n'y touche pas (aucune migration, aucune
   règle métier changée, conformément aux interdits). La disparition du
   formulaire sur une fiche figée est donc une décision **purement
   présentation** — elle ne ferme aucun trou côté serveur, elle arrête
   seulement de PROPOSER un geste qui n'a plus de sens une fois
   l'intervention figée. Je le signale explicitement : si un rôle sait
   forger la requête POST, la route l'accepterait encore aujourd'hui. Ce
   n'est pas un défaut de ce ticket — le ticket interdit toute règle
   métier — mais une lacune PRÉEXISTANTE qui mériterait sa propre décision
   d'arbitrage (§8 du CLAUDE.md : « une règle métier absente… non tranchée »)
   si l'exploitation veut la fermer.
3. **Le résumé « figée » reprend les clés de refus EXISTANTES
   (`intervention.refus.cloturee_figee`, `…annulee_figee`), aucune clé
   neuve pour ce texte.** Elles disaient déjà exactement ce qu'il fallait
   dire (l'une se termine par « Seule son annulation reste possible. »), et
   une seconde phrase aurait été une seconde lecture du même fait.
4. **Le panneau « Actions » ne change RIEN au régime d'une intervention non
   figée.** Le constat du ticket citait aussi « sept blocs ouverts en même
   temps » sur une intervention planifiée ; je n'ai PAS supprimé les
   refus individuels de cette catégorie (qualification requise, motif
   suspendu manquant, temps non mesuré…) — `tests/e2e/intervention-technicien-select.spec.ts`
   et `tests/e2e/blocage-agenda-visible.spec.ts`, préexistants, exigent que
   ces refus restent LISIBLES EN TOUTES LETTRES sur l'écran, jamais
   seulement au survol. Le ticket demandait le régime « aucun refus ne
   s'affiche » spécifiquement pour `cloturee`/`annulee` (D131) ; je m'y suis
   tenu au lieu d'étendre le changement à un régime que les épreuves
   existantes interdisent déjà.

## Ce que je n'ai PAS fait

- Aucune migration, rien sous `prisma/` — conforme aux interdits.
- Aucune règle métier ni aucun droit changé — D131 fait toujours foi ; les
  cinq `Verdict` réutilisés (`peutAffecter`, `peutDeplacer`, `peutCloturer`,
  `peutSuspendre`, `peutAnnuler`) et les portes `accesSurCetteIntervention`
  de 29-DROITS-1 sont lus tels quels, jamais recopiés.
- Le vrai numéro d'intervention (NUMERO-1) n'est pas posé : le sous-titre
  dit « Numéro provisoire », il ne fait toujours QUE ça.
- Hors territoire non touché : `lib/tarification/**`, `lib/calendar/**`
  (seulement IMPORTÉ, jamais modifié), `lib/imports/**`, `lib/auth/**`,
  `.github/**`, `vercel.json`.
- Je n'ai pas ajouté de garde de statut à `ajouterMachineAIntervention`
  côté serveur (voir point 2 ci-dessus) : c'eût été une règle métier, hors
  du territoire de ce ticket.

## Les pièges pour la session suivante

- **Le gardien `tests/unit/i18n/sans-chaine-visible-en-dur.test.ts` inspecte
  aussi les fichiers `tests/e2e/*.spec.ts`.** Un littéral passé à
  `toContainText`/`getByRole(..., {name})` — même une valeur « juste »
  comme `"08:00"` — est refusé s'il n'est pas dérivé d'une fonction
  reconnue du dictionnaire (`fr`, `t`, `mot`, `motDansUnePhrase`, importées
  depuis `@/lib/i18n` ou un sous-chemin). **Et il y a un piège dans le
  piège** : `motDansUnePhrase("site")` INLINE dans l'appel de requête
  passe, mais extrait dans un `const libelle = \`…${motDansUnePhrase("site")}\`;`
  puis référencé par identifiant, il NE passe PLUS — la résolution des
  constantes de fichier (`constantesLitterales` dans
  `tests/unit/outils/rendu-visible.ts`) tourne avec un contexte VIDE, sans
  connaître les imports du fichier, et prend alors le littéral pour une
  chaîne en dur. La leçon : dans un spec e2e, un texte MESURÉ (calculé par
  la même fonction que l'écran) passe toujours ; un texte composé doit
  rester DANS l'expression de la requête, jamais extrait dans une variable
  nommée en amont.
- **Une valeur mesurée par la production, jamais recopiée dans le
  scénario.** `heureAttendue` (dans `tests/e2e/fiche-intervention.spec.ts`)
  est calculée par `heureDuCreneau`, la même fonction que l'écran — pas
  écrite en dur — précisément pour cette raison ET parce que c'est la bonne
  pratique de toute façon (une épreuve qui recopierait « 08:00 » à la main
  ne prouverait rien de la conversion de fuseau).
- **`porte-capacites.spec.ts:97` (« un technicien ne peut pas créer de
  fiche client ») a rougi UNE FOIS**, sur un compte de clients qui a varié
  de 4 à 3 entre l'`avant` et l'`apres` du test — sans rapport avec ce
  ticket (aucun fichier de ce test ni du chemin de création de client n'a
  été touché). Rejoué seul dans le `verify:full` suivant, il est passé. Je
  soupçonne une course avec un `afterEach`/`afterAll` d'un AUTRE spec qui
  supprime un client pendant que celui-ci compte (plusieurs specs créent et
  suppriment des clients jetables sous `fullyParallel`) — un flake
  PRÉEXISTANT, pas un défaut de ce lot, mais à surveiller s'il revient.
- **Recette des captures confirmée une nouvelle fois** : `tsconfig.json`
  inclut `tests/`, donc `next build` (lancé par le `webServer` de
  Playwright) type-vérifie le spec de capture même contre l'ANCIEN code —
  le spec temporaire ne doit RIEN importer ni lire du dictionnaire qui soit
  propre au ticket (je l'ai gardé volontairement muet sur ce point : aucune
  lecture de `fr`, aucun import d'un export neuf).

## Ce qui reste à faire

- Rien d'identifié dans le territoire de ce ticket. Les points laissés de
  côté (garde de statut sur l'ajout de machine côté serveur, redesign du
  mur d'actions pour les statuts non figés) sont des décisions à part,
  documentées ci-dessus, pas des oublis.
