# 9F6A-DOSSIER-AUDIT-8-AGENTS — passation

Préparation de l'audit à 8 agents : outil corrigé, catalogue étendu à tout le
site, verdict automatique, dossier par écran, répartition en 8 paquets.
**Aucun verdict écrit à la main** — le champ « verdict » de chaque fiche est
calculé par `tests/audit-visuel/mesures.ts` (`calculerVerdict`), jamais jugé.
**Aucun code applicatif touché** (`app/`, `components/`, `lib/`, `prisma/`).

**`main` était extrait ailleurs** (`/home/aplou/codiplan`, worktree
distinct) : ce lot a travaillé sur la branche dédiée
`9F6A-dossier-audit-8-agents`, partie d'`origin/main` (8b4512d1, inchangé
pendant tout le lot — aucun rebase n'a été nécessaire). Rien n'a été poussé.

## Point 1 — l'outil corrigé

| # | Défaut mesuré | Avant | Après |
|---|---|---|---|
| a | `fullPage: true` faussé par les bandeaux sticky et la barre basse fixed | `ecrans.spec.ts` (9EWC) une seule capture `fullPage` par écran/largeur | `captureHautEtPleine` (`tests/audit-visuel/ecrans.spec.ts:118-142`) : une capture **« haut »** (viewport seul) et une **« pleine »** (viewport redimensionné à `scrollHeight`, plafonné à 4 hauteurs d'écran, `tronquee` notée si dépassé, viewport rétabli après) — site ET maquette |
| b | Faux 404 du premier accès | `comptes.ts` (9EWC) `return reemission.urlPremierAcces` — URL interne de Better Auth (`/api/auth/reset-password/<token>?callbackURL=...`), 404 au `page.goto` direct | `tests/audit-visuel/comptes.ts:118-199` : `jetonDeLUrl` extrait le jeton, et le code construit `/premier-acces?token=<jeton>` — l'URL que l'écran attend réellement. Cas expiré : le jeton est consommé une première fois, PUIS présenté une seconde fois (`choisirLePremierMotDePasse` rejoué) ; refusé (`issue: "refuse"`), l'URL rendue est `/premier-acces?motif=premier_acces.refuse`, exactement ce que `app/api/session/premier-acces/route.ts:35-41` construit sur ce refus |
| c | `resolution.ts:96` prenait n'importe quelle intervention `en_cours` | `premiereIntervention("en_cours")` sans filtre | `tests/audit-visuel/resolution.ts:68-80` : filtrée sur `technicien_id` du technicien de la scène (`garnier@codima.test`) — **mesuré en corrigeant l'outil** : aucune des 4 interventions `en_cours` du semis n'appartient à ce technicien, donc la fiche back-office « en cours » (`interventions-i436`) redevient `absente` plutôt que de montrer, à tort, l'intervention d'un AUTRE technicien pendant que la capture terrain plante sur un refus d'accès silencieux |
| d | Mesures manquantes | 6 mesures (défilements, halo, contrastes, troncatures, contrôles natifs, images cassées) | `tests/audit-visuel/mesures.ts` ajoute : éléments en débordement horizontal **nommés** (pas seulement un booléen), boutons sans nom accessible, champs sans étiquette, rectangles (h1, bouton principal, barre), colonnes/lignes visibles des tableaux, intitulés h1-h3, et une instrumentation réseau/console (`instrumenter`) séparant les préchargements Next.js abandonnés (`net::ERR_ABORTED`, `_rsc=`) des vrais échecs — posée AVANT chaque `page.goto`, jamais après |

## Point 2 — couverture

**81 écrans** au catalogue (69 dans `tests/audit-visuel/catalogue.ts`, 5 captures
spéciales d'accès, 5 tableaux de bord de rôle supplémentaires — `adv`,
`technicien`, `responsable_materiel`, `responsable_sav`, `direction` ;
`admin_societe` était déjà la seule identité réelle derrière l'entrée
générique « Tableau de bord »).

Par source (à 1280 px) :

| Site et maquette | Site seul (`maquette: "aucune"`) | Maquette seule (site `absente`) |
|---|---|---|
| 60 | 5 (`racine`, `parametres-societe`, `parametres-agences-calendrier`, `parametres-forfaits-id`, `terrain-hors-reseau`) | 16 |

**Faux `absente` corrigés** (point 2.b) : `/indicateurs` et `/portail` ont de
vraies routes, le catalogue de 9EWC les disait encore absentes.

**Ajoutés** (point 2.a/c) : `/`, `/terrain-hors-reseau`, `/parametres/societe`,
`/parametres/forfaits/[id]`, `/parametres/agences/calendrier/[id]` (pages du
site sans écran de maquette) ; planning `deux_semaines` et `mois` (les deux
vues du sélecteur qui manquaient) ; l'état `annulee` d'intervention.

**Non couverts, et pourquoi** (16 « maquette seule », tous pré-existants sauf
le portail) :
- `arrivee` (« Choisir la société ») : exige un compte habilité sur au moins
  deux sociétés ; la scène partagée n'en écrit qu'une par identité — hors
  temps imparti, comme dans 9EWC.
- `demandes-d31`, `imports-L16` : aucune ligne correspondante dans le semis
  actuel (aucune demande non qualifiée ; aucun import `applique`).
- `interventions-i436`, `terrain-i-i436`, `-rapport`, `-signature` :
  **conséquence directe du point 1.c** — aucune intervention `en_cours` du
  semis n'appartient au technicien de la scène. Le rapport et la signature
  n'ont de toute façon aucune route directe (`/terrain/[id]` est une page
  unique, ces états s'atteignent par une action, pas une URL) — non
  entreprise par manque de temps, voir « Points ouverts ».
- `vgp-reserves`, `parametres-journal`, `compte`, `terrain-scan`,
  `terrain-machine-m4`, `terrain-machines`, `terrain-machine-express` : aucune
  route sur le site (pré-existant, 9EWC le disait déjà).
- `portail` : **tenté** (point 2.d) via un compte de démonstration dédié
  (`ouvrirSessionPortailDeDemonstration`, `tests/audit-visuel/comptes.ts`),
  abandon PROPRE et motif écrit — *mesuré* : `reemettreJetonPremierAcces`
  refuse (`RefusReemission`) parce que le compte portail n'a délibérément
  aucune entrée `utilisateur_societe` (D10, `prisma/seed-data.ts:1131`) ; ce
  geste n'habilite que les identités `utilisateur_societe`. Le bon mécanisme
  pour un compte portail est hors du temps imparti de ce lot — à chercher
  côté `lib/auth/lien-d-acces.ts` / `acces-technicien.ts` ou équivalent
  portail, non exploré.

Dialogues de premier niveau (menu « Créer », recherche globale, confirmations) :
**non entrepris** — aucun capturé, faute de temps après le reste du point 2.
Le menu (bandeau + barre latérale) n'a pas de capture séparée : il est visible
dans chaque capture « pleine » de tableau de bord, mais n'est pas isolé en tant
que tel.

## Point 3 — verdict automatique

Compté sur `index.json`, à 1280 px : **62 « écart mesuré »**, **16 « non
mesuré »** (écrans `absente`), **3 « sans maquette »** (aucune anomalie ET
aucune maquette), **0 « C »**.

Aucun « C » n'est pas une anomalie de l'outil : la comparaison compare un
rendu DYNAMIQUE (le site, données du semis, police système) à un rendu
STATIQUE (fichier HTML de maquette) — l'écart de rectangle (±8 px) ou
d'intitulé est quasi systématique même sur un écran visuellement conforme.
**Le verdict est une triage, pas un jugement** : « écart mesuré » dit *« un
agent doit regarder »*, jamais *« c'est un défaut »* — c'est délibérément
plus sévère que les 36 « C » sans mesure de 9EWC, jugés trop indulgents par
le pilote.

## Point 4 — le dossier

- Taille totale : **21 Mo** (plafond 40 Mo), JPEG qualité 55.
- Répartition en 8 paquets (`docs/audits/9F6/repartition.md`) :

| Paquet | Écrans |
|---|---|
| P1 — Accès et sans session | 12 |
| P2 — Pilotage | 8 |
| P3 — Planning | 4 |
| P4 — Demandes et registre | 5 |
| P5 — Fiches intervention et bon | 8 |
| P6 — Clients, sites, parc, VGP | 14 |
| P7 — Paramètres et imports | 18 |
| P8 — Terrain | 12 |

**Déséquilibre mesuré** : P7 (18 écrans) fait plus du double de P3 (4 écrans)
— annoncé automatiquement par `repartition.md` (règle écrite dans
`tests/audit-visuel/dossier.ts`, pas une observation à la main).

`tests/unit/audits/9f6-repartition.test.ts` : chaque écran dans exactement un
paquet de la liste close, lu sur `index.json` — vert.

## Points ouverts

- **Terrain : rapport et signature** — non capturés. Pas de route directe ;
  il aurait fallu piloter l'interface (démarrer l'intervention, remplir le
  rapport, signer) depuis un scénario dédié, à l'image de
  `tests/e2e/rapport-terrain.spec.ts`. Hors temps imparti.
- **Dialogues de premier niveau** (menu « Créer », recherche globale,
  confirmations) — aucun capturé.
- **Menu séparé par rôle** — non isolé en capture propre ; visible dans
  chaque tableau de bord de rôle.
- **Portail client** — amorçage refusé, abandon propre, cause identifiée
  (voir point 2) mais pas réparée.
- **« Choisir la société » (`/arrivee`)** — nécessite un compte multi-société,
  absent de la scène partagée.
- **Comparaison maquette ↔ site pour "intitulés"** : égalité stricte de la
  LISTE complète des h1-h3 — un intitulé en plus ou en moins (ex. un fil
  d'Ariane) suffit à faire basculer en « écart mesuré » même sans défaut
  réel. Accepté comme biais délibérément conservateur (voir point 3), mais
  les 8 agents doivent le savoir en lisant une fiche.
- **Tableaux "colonnes/lignes visibles"** : compte les lignes dont la hauteur
  rendue est non nulle ; un tableau virtualisé ou paginé différemment entre
  site et maquette compte comme un écart.

## Fin de lot

- `pnpm audit:visuel` joué une dernière fois en entier avant ce commit (voir
  les deux exécutions pleines, 86/86 tests verts, 6.2-6.3 min chacune — la
  seconde est celle dont le dossier committé est issu, après correction d'un
  doublon de clé entre le catalogue et la capture spéciale du lien expiré).
- `CI=1 pnpm verify:full` tenté EN ENTIER : `format:check`, `typecheck`,
  `lint`, `test` (4958 tests), `test:isolation` (1638 tests), `build`,
  `feries:horizon`, `audit:partitions` — **tous verts**. `test:e2e` (1479
  tests) a été interrompu après 50 min sans aucun échec observé jusqu'au
  point d'arrêt : l'exécution complète dépasse le budget de temps de cette
  session, **même limite assumée que 9F4H5B-JOURNEE-SANS-MONTANT** (passation
  du 20/10/2026). Détail dans `verify-final.txt`.
  **Mesuré en l'interrompant** : `test:e2e` RÉGÉNÈRE, comme effet de bord,
  des centaines de captures AVANT/APRÈS d'AUTRES lots sous
  `docs/propositions/**/captures/` (224 fichiers modifiés ou créés à
  l'arrêt) — restaurées par `git checkout -- docs/propositions/` et
  `git clean -fd docs/propositions/` avant tout commit. C'est une seconde
  raison, indépendante de la durée, de ne jamais laisser `test:e2e` aller à
  son terme dans ce lot : l'interdiction « ne régénère aucune capture d'un
  autre lot » s'applique à CHAQUE commit de ce lot, pas seulement au dossier
  d'audit.
- Rebase sur `origin/main` effectué avant le dernier commit ; `CI=1 pnpm
  verify` rejoué après rebase, vert.
