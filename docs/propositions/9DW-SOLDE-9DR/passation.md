# 9DW-SOLDE-9DR — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

Rien de métier : ce lot ne change aucune règle de gestion, aucun écran visible par un
rôle, hors un seul point (R2, fil d'Ariane). Il corrige des épreuves fragiles sous
exécution parallèle locale, des épreuves qui ne prouvaient pas tout à fait ce qu'elles
prétendaient, et un oubli de documentation.

- **S1, L1, L2, Q1, Q2** (pollution de scène) : plusieurs épreuves e2e choisissaient une
  agence ou comptaient des lignes sans tenir compte des scènes forgées par d'autres
  fichiers tournant en parallèle (`fullyParallel`, hors CI). Corrigé en choisissant
  l'agence par son CODE (DUCOS) ou en restreignant les comptes aux trois agences
  permanentes du semis, jamais en affaiblissant une égalité stricte.
- **O1-O6** (relecture de 9DO) : un gardien manquait son sens inverse (O1), un tri
  n'était prouvé qu'alphabétique et pas alphanumérique (O2), trois specs réécrivaient
  leurs PNG à chaque `pnpm test:e2e` (O3), une contre-épreuve manquait (O4), un test ne
  prouvait que l'absence d'un cas (O5), deux specs de capture forgeaient leur scène même
  sans la variable d'environnement de capture (O6).
- **R1** : deux liens avaient perdu leur égalité stricte sur `?depuis=` (passés à un
  préfixe) ; un contrôle négatif dépendait de la forme exacte d'une URL.
- **R2** (le seul changement visible) : le dernier maillon du fil d'Ariane de la fiche
  calendrier affichait `titreDuCalendrier(...)` (« Calendrier — Ducos ») au lieu du nom
  brut de l'agence, à la différence de tous les autres fils du dépôt. Un responsable qui
  suit ce fil verra désormais « Ducos », pas « Calendrier — Ducos », au dernier maillon.
- **R3** : `docs/arbitrages.md` (D167) ne citait pas D153, qui a déjà posé le droit
  d'écrire sur une agence sous `administrer_agences`. Aucun changement de sens, une seule
  phrase ajoutée.
- **R4** : trois contrôles négatifs (le libellé du compteur ne doit plus apparaître après
  la pause) visaient un motif trop large (préfixe + heure) qu'un libellé sans heure
  aurait fait passer à tort.
- **R5** : un test a été renommé pour dire exactement ce qu'il prouve (l'URL du clic,
  puis une recherche séparée par raison sociale) — 9DU avait dû introduire cette
  recherche séparée pour une raison de pagination réelle, sans renommer le test.
- **R6** : un titre de test disait « 1280×800 » alors que la fenêtre réelle, changée par
  9DU pour tenir compte du bandeau fixe, est 1280×864. Seuil de 480 px inchangé.
- **Captures** : nouveau fichier `tests/e2e/captures-9dw-fil-ariane.spec.ts`, gardé par
  `CAPTURES_9DW`, qui capture les six écrans du fil d'Ariane (client, site, machine,
  demande, fiche agence, fiche calendrier) à 1280 et 375 px, sur sa propre scène
  (`9DW-CAPT-`), jamais sur `SCENE.*`.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- **S1/vgp-4** : avant, `toHaveCount(1)` portait sur TOUTES les lignes de
  `/vgp?etat=depassees` (unscoped) ; après, sur les lignes filtrées par le numéro de
  série du semis — toujours 1, mais ne romprait plus si `vgp2-registre.spec.ts` ajoute sa
  propre dépassée en parallèle. Vérifié par lecture (ordre des échéances : celle du
  semis, calculée à l'exécution du seed, précède toujours celle calculée à l'exécution du
  test — jamais mesuré en conditions de course réelles, seulement raisonné).
- **R6/parc-tri** : mesuré en conditions réelles (log temporaire, retiré avant commit) —
  **487,2 px visibles à 1280×864**, contre un seuil de 480 px. Marge réelle : 7 px. Je ne
  l'ai PAS élargie, l'instruction demandait de ne rien inventer, pas de rendre le test
  plus confortable.
- **Gardien O1** : vérifié que `tests/unit/auth/porte.test.ts` rougit bien si on retire
  une entrée de `PORTE_COMPLETE` (fait, puis restauré) — le nouveau test détecte
  réellement l'oubli qu'il nomme.
- **Tous les fichiers e2e touchés** : rejoués ensemble, un seul worker, contre une vraie
  base migrée et semée — 60 passés, 29 sautés (les trois fichiers de capture gardés par
  variable d'environnement, correctement inertes sans elle). Zéro rouge.
- **`pnpm verify`** : vert de bout en bout (format, typecheck, lint, 4142 tests
  unitaires, 163 fichiers d'isolation, build).

## Ce que j'ai tranché, et pourquoi

- **S1 — option « compte restreint » plutôt que « société propre »** : le ticket
  offrait deux options. Créer une société dédiée pour `MACHINE_X3` aurait exigé un
  utilisateur et une session propres à cette société (aucun fichier du dépôt ne crée de
  société à la volée ; la RLS rendrait la machine invisible à la session ADV partagée
  sans ce montage) — risque disproportionné pour un gain marginal. Restreindre le compte
  de `vgp-4` à sa propre machine est la voie que le ticket autorisait explicitement et
  qui ne touche qu'un seul fichier.
- **Q1 — comptes restreints aux codes du semis, jamais recopiés en dur** : plutôt que
  d'écrire littéralement « DUCOS »/« Ducos » dans une requête d'écran (ce que le gardien
  `sans-chaine-visible-en-dur` ne détecte pas pour `.filter({hasText})`, mais qui aurait
  dupliqué une donnée que `prisma/seed-data.ts` porte déjà), j'ai dérivé le motif depuis
  `SOCIETES` (export existant) à l'exécution.
- **O5 — réutilisation de `libelleDestinataireCourriels`, jamais une chaîne recomposée
  à la main** : une première version composait le texte attendu avec
  `` `${t(...)} ${nom} (${email})` ``, qui a fait rougir le gardien `sans-chaine-visible-
  en-dur` (le « deux temps » qui résout une constante ne reconnaît pas `t()` comme
  référence au dictionnaire dans ce chemin — limite du gardien, pas un faux positif sur
  mon texte). Rejouer la fonction de production évite la chaîne ET la duplication de
  règle (§9, 01/09 : « la seconde implémentation d'un critère n'est jamais gratuite »).
- **R5 — renommer plutôt que réécrire** : la pagination réelle ne garantit pas que le
  client de l'épreuve tombe sur la première page des clients sans code de toute la
  société partagée ; chercher par nom exact SUR la page atteinte par le clic aurait pu
  échouer pour une raison étrangère au test. Le ticket autorisait ce repli.
- **Captures — scène forgée dédiée, pas `SCENE.*`, même forme que 9dr-fil-d-ariane** :
  `SCENE.*` ne porte que des interventions de planning, aucun client/site/machine/demande
  stable. J'ai recopié la forme exacte de `tests/e2e/9dr-fil-d-ariane.spec.ts` (même
  auteur de scène, même discipline), avec son propre préfixe `9DW-CAPT-` et ses propres
  clés `lib/i18n/fr.ts`.

## Ce que je n'ai PAS fait

- **vgp-retard-visible.spec.ts** : en creusant S1, j'ai trouvé que ce fichier (hors
  périmètre nommé par le ticket) attend EXACTEMENT « 1 échéance dépassée » sur le
  tableau de bord — un compte global que `MACHINE_X3` (forgée par
  `vgp2-registre.spec.ts`) peut, lui aussi, rompre sous `fullyParallel`. Non corrigé :
  pas nommé par S1, et la correction aurait touché une tuile de comptage réel, pas un
  simple choix de locator — risque de dépasser le périmètre du lot. **Résiduel pour la
  session suivante.**
- **`agences-etat-visible.spec.ts:275`** (témoin `code: { not: code }` sans restriction
  aux codes permanents) : même famille de risque que Q1/Q2, pas nommé par le ticket, pas
  touché — je me suis arrêté à ce qui était explicitement demandé plutôt que d'étendre la
  correction à toute occurrence similaire trouvée en cours de route.
- **`vgp-4.spec.ts` et d'autres fichiers de capture non gardés** : en traitant O3/O6,
  j'ai remarqué que `vgp-4.spec.ts` (et probablement d'autres) réécrivent aussi leurs PNG
  à chaque `pnpm test:e2e`, sans variable d'environnement — exactement le défaut d'O3,
  mais sur un fichier non nommé par le ticket. Pas corrigé, pour rester dans le périmètre
  cité. Un audit plus large de ce motif serait utile un jour.
- **Aucune migration, aucune ligne de semis, aucun prix** — conforme à l'interdit du
  lot.

## Les pièges pour la session suivante

- **Le gardien `sans-chaine-visible-en-dur` ne reconnaît pas `t("clé")`/`fr["clé"]`
  comme référence au dictionnaire quand ils sont nichés dans la valeur d'une CONSTANTE
  locale** (`const x = \`${t("clé")} ...\`; toHaveText(x)`) — seulement quand ils sont
  l'argument DIRECT de la fonction gardée, ou nichés dans un appel à une fonction non
  reconnue dont l'argument EST `fr["clé"]` (pas une constante intermédiaire qui l'enrobe).
  Contournement propre : composer le texte attendu avec la MÊME fonction de production
  que l'écran (comme O5 ci-dessus), jamais recomposer soi-même avec des `t()`/`fr[]`
  imbriqués dans un gabarit.
- **`test.skip(condition, motif)` appelé au niveau du MODULE (pas dans un test ni un
  describe) empêche bien `beforeAll` de s'exécuter** — vérifié empiriquement (O6) : sans
  la variable de capture, aucune écriture en base, les 7/10 tests du fichier passent en
  "skipped" sans toucher la base. C'est la bonne forme pour les futurs fichiers
  `zz-captures-*`/`captures-*` qui forgent une scène.
- **`vgp-retard-visible.spec.ts` et `agences-etat-visible.spec.ts:275`** (ci-dessus) :
  risques résiduels connus, non corrigés, à reprendre si une session future les voit
  rougir sous exécution parallèle locale.
- **La marge de `parc-tri.spec.ts` (R6) est réelle mais étroite** : 487 px pour un seuil
  de 480. Un changement de layout qui grignote quelques pixels sous le bandeau fixe fera
  rougir ce test avant de casser visiblement quoi que ce soit — c'est voulu (le test
  existe pour ça), mais à savoir avant de le relire en diagnostic.

## Ce qui reste à faire

- Rien de nommé par ce ticket n'est resté ouvert : les trois parties (pollution de
  scène, relecture de 9DO, petits soldes de 9DR) et l'addendum R4/RECALAGE sont tous
  traités, avec leurs commits dédiés.
- Les deux risques résiduels signalés ci-dessus (« Ce que je n'ai PAS fait ») restent
  ouverts pour une session future, sous leur propre ticket si jugés dignes d'être
  corrigés.
