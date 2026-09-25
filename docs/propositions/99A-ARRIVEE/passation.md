# 99A-ARRIVEE — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

`app/(back-office)/arrivee/` :

- **Le rôle se lit en clair.** `lib/i18n/fr.ts` porte désormais une clé
  `role.<valeur>` par valeur de `Role` (`lib/auth/roles.ts`), reprise mot pour
  mot du §5 du cahier des charges (§5.1 pour les personas, §5.2/§22.5 pour les
  trois rôles qui n'y figurent pas). `page.tsx` (bloc « Rôle ») et
  `composants.tsx` (`Choix`, la liste des sociétés) affichent tous deux ce
  libellé — plus jamais le nom brut de l'énumération (« admin_societe » lu par
  l'audit).
- **Le bloc société redevient lisible.** Le `<dt>` du bloc `bg-societe-primaire`
  utilisait `text-app-encre-faible` (2,06:1 mesuré à l'audit — un gris calé sur
  la surface neutre de l'application, jamais sur une couleur de société). Il
  passe à `text-societe-primaire-encre`, calculée par `encreLisible`
  (`lib/theme/contraste.ts`) pour être **garantie ≥ 4,5:1** quelle que soit la
  charte du client, plutôt qu'un hexadécimal choisi à l'œil.
- **L'écran s'efface pour les deux tiers du parc.** Un compte rattaché à une
  seule société ne voit plus « Vous êtes connecté » : `/arrivee` redirige
  d'emblée vers le point d'entrée de son rôle (`/portail`, `/terrain` ou
  `/planning` — `app/(back-office)/arrivee/decision.ts`, `pointEntreeRole`,
  la MÊME fonction que le lien qu'elle remplace). Zéro ou plusieurs sociétés
  laissent la page exactement comme avant, sélecteur compris.

Pour l'exploitation : un technicien ou un ADV qui se connecte arrive
directement sur son écran de travail, sans clic intermédiaire ni titre qui ne
disait rien de plus que « connecté ». Un compte à plusieurs sociétés (aucun
n'existe aujourd'hui côté clients de démonstration, mais `direction@codima.test`
en porte deux côté données de seed) garde le sélecteur, inchangé.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- **Contraste du `<dt>` du bloc société** : `text-app-encre-faible` sur
  `bg-societe-primaire` mesurait 2,06:1 à l'audit du 25/09/2026 (constat 2).
  `text-societe-primaire-encre` est, par construction de `encreLisible`
  (`lib/theme/contraste.ts`, `PLANCHER_ENCRE = √21 ≈ 4,58`), **toujours**
  ≥ 4,5:1 contre `bg-societe-primaire` — pas une mesure ponctuelle mais une
  garantie déjà démontrée par `tests/unit/theme/contraste.test.ts`. Non
  reproductible par capture d'écran dans ce lot : voir « Ce que je n'ai pas
  fait ».
- **Route atteinte après connexion, AVANT/APRÈS** (`tests/e2e/arrivee.spec.ts`,
  captures `docs/propositions/99A-ARRIVEE/captures/`) :
  | Compte | Rôle | AVANT | APRÈS |
  |---|---|---|---|
  | `adv@codima.test` | `adv`, une société | `/arrivee` | `/planning` |
  | `guerin@codima.test` | `technicien`, une société, accès restreint | `/arrivee` | `/terrain` |
- **`pnpm verify:full` en entier** (`CI=1 pnpm verify:full`) : vert —
  format:check, typecheck, lint, 2868 tests unitaires, 1239 scénarios
  d'isolation, build, horizon des fériés, partitions d'audit, et 283 scénarios
  de bout en bout (3 sautés, sans donnée de semis — inchangé, hors périmètre
  de ce ticket).

## Ce que j'ai tranché et pourquoi

- **La décision « par où ce rôle entre » vit dans un fichier neuf,
  `decision.ts`**, plutôt que dans `page.tsx` — même raison que `composants.tsx`
  (Next.js refuse qu'un fichier de route exporte autre chose que ce qu'il
  reconnaît) et même bénéfice : `pointEntreeRole` s'éprouve sans navigateur
  (`tests/unit/app/arrivee-decision.test.ts`), et c'est la MÊME fonction que
  lisent le lien affiché (`Entree`) et la redirection automatique — deux
  lectures d'un même critère auraient pu diverger en silence.
- **Le cas « plusieurs sociétés » n'a pas d'épreuve de bout en bout neuve.**
  Aucun compte de `tests/e2e/setup/scene.ts` n'est habilité sur deux sociétés.
  `direction@codima.test` L'EST (`prisma/seed-data.ts`), et c'est déjà le
  compte que `scripts/captures.mts` utilise pour photographier ce même état —
  mais `tests/e2e/setup/global.ts` n'ouvre son premier accès que pour trois
  identités (`adv`, `guerin`, `admin.societe`) : `direction@codima.test`
  n'a pas de mot de passe connu du harnais Playwright, et `direction` exige un
  second facteur. Le forger aurait touché le setup GLOBAL, partagé par tout le
  parc de scénarios, pour un gain que le ticket autorisait déjà à sauter :
  « sinon teste la fonction pure de décision en unitaire ». C'est fait
  (`tests/unit/app/arrivee-decision.test.ts`, cas `nombreSocietes` à 0, 1, 2
  et 3).
- **`tests/e2e/ecrans-largeur-utile.spec.ts` perd sa mesure de mise en page de
  `/arrivee`** (R2-04, « l'arrivée commence en haut »). Le compte du fichier
  (`ouvrirUneSession`, ADV, une société) ne voit plus jamais `/arrivee` — un
  `page.goto("/arrivee")` suit désormais la redirection sans rien peindre à
  mesurer. Retirée plutôt que contournée : la classe `<Page>` qui portait la
  correction R2-04 reste partagée et éprouvée par les AUTRES scénarios du même
  fichier (établissements, forfaits, fiche d'intervention).
- **`tests/e2e/tous-les-ecrans-rendent.spec.ts` gagne une exception fermée,
  `REDIRECTS_CONNUS`.** Ce gardien refuse toute redirection sur CHAQUE route du
  back-office — une garantie qui reste juste pour toutes les routes sauf UNE,
  désormais : `/arrivee`, pour le compte `admin_societe` de ce fichier (une
  société, accès complet), qui redirige vers `/planning`. Une entrée nommée et
  motivée, pas un assouplissement de la règle générale.
- **`tests/e2e/ecrans-largeur-utile.spec.ts`, « les écrans sans session ne
  défilent pas pour rien »**, plantait pour une raison différente, découverte
  en cours de route (voir « pièges » ci-dessous) : corrigée en effaçant
  réellement la session avant le test, ce que son titre promettait déjà.

## Ce que je n'ai PAS fait

- **Aucune capture du bloc société lui-même** (le `<dt>` recontrasté, les
  libellés de rôle dans `Societe`/`Choix`). Ce bloc ne se rend plus pour AUCUN
  compte connectable du harnais e2e (tous à une seule société, donc
  redirigés) ; le capturer aurait exigé de rendre `direction@codima.test`
  connectable dans le setup global — écarté pour la même raison que
  l'épreuve multi-société ci-dessus. La preuve du contraste reste la garantie
  mathématique de `encreLisible` (démontrée par
  `tests/unit/theme/contraste.test.ts`), pas une image.
- **Aucune capture AVANT.** La redirection est un fait serveur (un en-tête
  `Location`), jamais un rendu : il n'y a rien à photographier côté « avant »
  que l'URL et le titre de page n'expriment déjà mieux qu'une image (couverts
  par les assertions de `tests/e2e/arrivee.spec.ts`).
- **Je n'ai pas touché `/connexion`, `/enrolement`, ni le choix de société** —
  hors territoire du ticket, et je n'ai vérifié aucune régression au-delà de
  ce que `pnpm verify:full` couvre.

## Pièges pour la session suivante

- **La redirection d'`/arrivee` a un rayon d'action plus large que l'écran
  lui-même.** Presque toute route du back-office contient un
  `redirect("/arrivee")` de secours quand le contexte n'est pas actif
  (`societeId === null`) — ceux-ci restent sans conséquence, parce que dans ce
  cas `etatArrivee` rend `sans_societe`, jamais `arrivee`, et la redirection
  neuve ne se déclenche que sur `arrivee`. Mais **`ouvrirUneSession` (le
  helper de connexion le plus utilisé du dépôt) atterrit maintenant sur
  `/planning` et non plus `/arrivee`** : toute épreuve future qui suppose
  encore `/arrivee` après connexion (grep `/\/arrivee/` avant d'écrire une
  nouvelle épreuve) se trompera en silence tant qu'elle ne l'a pas vérifié à
  l'écran.
- **Le défaut de `ecrans-largeur-utile.spec.ts` (« sans session ») était
  DÉJÀ LÀ avant ce ticket** — la session ADV du `beforeEach` du fichier
  n'était jamais effacée avant ce test précis, sans conséquence tant que le
  point d'arrivée d'un compte connecté restait petit. Un autre fichier qui
  partage ce même défaut (session héritée, jamais effacée, sur un test qui
  prétend en être dépourvu) resterait invisible tant que sa redirection
  n'atterrit pas sur un grand écran — je n'ai PAS cherché d'autre occurrence
  au-delà de ce que `pnpm verify:full` a fait rougir.
- **Trois épreuves échouent sous forte parallélisation** (`workers` > 1),
  indépendamment de ce ticket : `fiche-technicien-nomme.spec.ts`,
  `glisser-deposer.spec.ts`, `historique-site.spec.ts`. Vérifié par
  comparaison directe avec le commit précédent (`git worktree`, même
  exécution parallèle) : les trois échouent aussi SANS aucun des changements
  de ce lot. Elles passent toutes les trois sous `CI=1` (un seul worker,
  utilisé par `pnpm verify:full`) — non corrigées ici, hors territoire.

## Ce qui reste à faire

- Rendre `direction@codima.test` (ou une identité neuve) connectable par le
  harnais Playwright si une épreuve de bout en bout du cas « plusieurs
  sociétés » devient nécessaire ailleurs — décision à prendre au niveau du
  setup global (`tests/e2e/setup/global.ts`), pas dans un lot qui ne fait que
  passer par `/arrivee`.
- Les trois épreuves flakys sous parallélisation (ci-dessus) mériteraient un
  ticket dédié — elles ne relèvent pas de `/arrivee`.
