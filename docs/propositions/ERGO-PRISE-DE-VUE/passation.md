# 9AX-ERGO-PRISE-DE-VUE — passation

## Ce que j'ai change (et ce que ca change pour l'exploitation)

- `docs/captures/*.png` et `docs/captures/README.md` regeneres par une prise de vue reelle
  (`pnpm exec tsx scripts/captures.mts`) ancree sur le commit PUBLIE `ad4feee` (28/09/2026,
  ticket 9AV-CG9-CAPTURES-EXPLOITATION, HEAD = origin/main au demarrage). La derniere prise
  precedente etait ancree sur `bbf7e3c` (18/09), perimee depuis tout le lot ERGO-26-09 :
  l'exploitation dispose desormais d'une reference a jour de 27 ecrans (54 images), au lieu
  d'images vieilles de dix jours qui ne montraient ni le tableau de bord, ni le registre des
  interventions, ni la fiche de detail d'une intervention (trois ecrans ajoutes a
  `ECRANS_EXPLOITATION` depuis, par 9AV-CG9-CAPTURES-EXPLOITATION).
- Base locale jetable PostgreSQL 16 (conteneur `codiplan-pg16`, port 5433 — `scripts/
  postgres-jetable.sh` echoue sur ce poste, seul PostgreSQL 18 y est installe nativement ;
  le conteneur pinne deja la version 16 que la CI exige, donc reutilise en connaissance de
  cause), base `codiplan_test` DROP puis recreee, `db:deploy` + `db:seed` sous le role
  proprietaire, serveur `next start -p 3100` sous `codiplan_app`.
- Comptes utilises : `COURRIEL` = `admin.societe@codima.test` (role `admin_societe`, acces
  complet a la quasi-totalite des ecrans de back-office selon la matrice §5.2 —
  `lib/auth/habilitations.ts` —, seul rôle interne mono-societe qui couvre planning, clients,
  sites, parc, vgp, imports ET les quatre pages de parametrage) ; `COURRIEL_MULTI` =
  `direction@codima.test` (habilite CODIMA-NC + CODIMA-EU). Aucun `COURRIEL_PORTAIL`, aucun
  `COURRIEL_TERRAIN` — non demandes par le ticket (§3 : « compte principal, puis
  direction@codima.test »).
- Mots de passe choisis aleatoirement (`openssl rand -base64 24`) via un script Playwright
  jetable (`.scratch-premier-acces-9ax.mts`, supprime avant le commit) suivant chaque URL de
  premier acces sur `http://127.0.0.1:3100` exclusivement. Aucun mot de passe n'a ete ecrit
  dans un fichier, un commit, un journal ou ce document (I9).

## Ce que j'ai mesure (comptes AVANT/APRES)

- **Sidebar a 390 px** : se replie sur les 27 ecrans captures (icone `☰`, aucune colonne
  laterale fixe). Mesure a l'en-tete IHDR de chaque `*--390.png` : les 27 images font
  **exactement 390 px de large** (script Python, lecture des 8 octets de largeur/hauteur
  post-signature PNG) — Playwright prend cette capture en `fullPage: true`
  (`scripts/captures.mts:1002-1004`), qui etend la hauteur ET la largeur du cliche a la
  taille reellement rendue quand le contenu deborde horizontalement ; une largeur figee a
  390 sur les 27 fichiers est donc la preuve, pas une hypothese, qu'aucun n'a debordonne.
  Verifie aussi a l'oeil sur `planning--390` (charge par technicien, cartes empilees),
  `parametres-agences--390` et `parametres-trajets--390` (tableaux qui s'adaptent).
- **Combien debordent a 390 px** : **zero**, sur les 27 ecrans reellement photographies a
  cette largeur (les 27 IHDR mesures ci-dessus). Meme mesure sur les 27 `*--1280.png` :
  toutes a exactement 1280 px, aucun debordement non plus au format poste de travail.
- **C-B3** (`parametres-trajets` / `parametres-agences` se peignent-elles ?) : **oui, les
  deux**, aux deux largeurs, sous `admin.societe@codima.test` — tableaux complets (zones de
  trajet Grand Noumea/Sud/Cote Est/Cote Ouest/Nord/Iles ; les trois agences avec leur
  calendrier et jours travailles), verifie visuellement sur les quatre fichiers.
- **`arrivee-sans-societe`** : **juste**. Capturee sous `COURRIEL_MULTI` avant toute
  activation de societe — porte le selecteur « Choisir la societe » et deux occurrences du
  bouton d'activation, aucun lien direct vers le planning (verdict rendu par
  `verdictDuTemoin`, lot 99O). Image mise a jour (le commit precedent la portait deja juste
  depuis 99O + le ticket suivant qui l'a reellement executee ; cette prise la reconfirme au
  nouveau commit).
- **Refus de la prise** — 10 fichiers (5 ecrans x 2 largeurs) :
  - `portail` (x2) : **attendu**, D10 — aucun compte portail n'a de ligne dans
    `utilisateur_societe`, donc aucun lien de premier acces ne peut lui etre emis
    aujourd'hui ; refus documente depuis la prise du 10/09.
  - `terrain`, `terrain-intervention` (x2 chacun) : refus **consequence directe de la
    consigne du ticket** (§3-4 ne demandent ni `COURRIEL_TERRAIN` ni `MOT_DE_PASSE_TERRAIN`) —
    `/terrain` renvoie au planning tout compte dont l'acces au planning est COMPLET, et
    `admin.societe@codima.test` en fait partie (matrice §5.2). Pas une regression : le README
    precedent (perime) les capturait parce qu'il fournissait cette quatrieme identite,
    absente du perimetre demande ici.
  - `arrivee` (x2) : **constat, pas une consequence du perimetre demande** —
    `app/(back-office)/arrivee/decision.ts` (`destinationSiSocieteUnique`, audit ergonomie du
    25/09) redirige tout compte a UNE SEULE societe droit vers sa destination (`/planning`
    ici) sans jamais rendre `/arrivee` : « zero ou plusieurs societes ne changent rien »,
    seul le cas `= 1` saute l'ecran. Capturer `arrivee` (societe active + bouton d'entree, PAR
    OPPOSITION a `arrivee-sans-societe`) exige donc un compte MULTI-societe — sur cette base
    de demonstration, le seul est `direction@codima.test`, qui n'a pas
    `administrer_agences`/`administrer_utilisateurs` (matrice §5.2, colonne ADMS uniquement)
    et aurait probablement fait echouer `parametres-agences`. Tension reelle entre les deux
    exigences (compte multi-societe pour `arrivee`, compte admin complet pour les ecrans de
    parametrage) qu'aucun compte du seed ne resout a lui seul — a arbitrer, pas a corriger ici.
  - `client-detail` (x2) : **defaut de l'outil de prise de vue, pas de l'application**. Le
    temoin attendu par `scripts/captures.mts:413` est `"Dernières interventions"` ; le libelle
    reel, depuis le commit `0f4b18f` (23/09/2026, ticket HISTORIQUE-CLIENT-1, pagination de
    l'historique), est `"Historique des interventions"`
    (`lib/i18n/fr.ts:390`, `clients.fiche.interventions`). `scripts/captures.mts` n'a jamais
    ete mis a jour apres ce renommage : l'ecran se peint correctement (verifie sur le
    fragment de page renvoye dans le refus — breadcrumb « Clients › Atelier Ducos », titre,
    code DEMO-001, boutons + Site / + Intervention), mais le temoin perime le fait refuser
    depuis cinq jours sans que personne ne l'ait remarque, faute de prise de vue entre-temps.
- `pnpm format:check`, `pnpm test`, puis `CI=1 pnpm verify:full` : voir en fin de document.

## Ce que j'ai tranche et pourquoi

- **`COURRIEL` = `admin.societe@codima.test`**, pas `direction@codima.test`. Choix motive par
  la matrice §5.2 : `admin_societe` a un acces complet a `parametrer_societe`,
  `administrer_agences`, `administrer_utilisateurs`, `consulter_journal_audit`, la quasi
  totalite des ecrans exploitation — c'est le seul compte mono-societe qui couvre les quatre
  pages de parametrage demandees par C-B3. `direction@codima.test` aurait rendu `arrivee`
  capturable mais aurait probablement fait echouer `parametres-agences` (aucun acces a
  `administrer_agences`) — la question C-B3 posee explicitement par le ticket a pese plus
  lourd que la capture d'un seul ecran (`arrivee`) desormais nomme comme constat plutot que
  silencieusement absent.
- **Base recreee depuis zero (DROP/CREATE) plutot que reutilisee** : la base `codiplan_test`
  du conteneur portait deja des donnees d'une session precedente (2 societes, residus d'un
  autre `test:isolation`) — une prise sur cette base n'aurait pas ete une base « jetable »
  au sens d'I9, et le compte `admin.societe@codima.test` y portait potentiellement deja un
  mot de passe, rendant `--reemettre` impossible (RefusReemission si `mot_de_passe` n'est pas
  NULL, `lib/auth/amorcage.ts:473`).
- **Tout le geste (reset base, amorcage des deux identites, pose des mots de passe, prise de
  vue) tient dans UN SEUL script bash** plutot que plusieurs appels d'outil : le mot de passe
  choisi pour `admin.societe@codima.test` a ete perdu une premiere fois entre deux appels
  d'outil distincts (l'etat du shell ne survit pas d'un appel a l'autre), ce qui a impose de
  relancer toute la sequence — documente ici pour que la session suivante ne recommence pas
  la meme erreur.
- **Pas de `COURRIEL_TERRAIN`** : suit le ticket a la lettre (§3-4 ne le mentionnent pas),
  au prix des quatre refus `terrain`/`terrain-intervention` nommes ci-dessus plutot que
  d'ajouter une identite hors perimetre demande.

## Ce que je n'ai PAS fait

- Je n'ai pas corrige le temoin perime de `client-detail` dans `scripts/captures.mts`
  (`"Dernières interventions"` → `"Historique des interventions"`) : le ticket est explicite
  — « si la prise revele un defaut, tu le NOMMES, tu ne le corriges pas » — et ce fichier
  n'est de toute facon pas dans le territoire du ticket (`app/`, `lib/`, `components/`,
  `scripts/` sont exclus).
- Je n'ai pas ajoute de `COURRIEL_TERRAIN` pour recuperer les quatre images `terrain` /
  `terrain-intervention` : hors du perimetre explicitement donne par le ticket.
- Je n'ai pas arbitre la tension `arrivee` (compte multi-societe requis) contre
  `parametres-agences` (compte admin_societe requis) : nomme comme constat, pas tranche.
- Je n'ai pas touche `docs/propositions/*/captures/*.png` (modifications preexistantes,
  etrangeres a ce ticket, visibles dans `git status` avant que je commence) : ni lus ni
  ajoutes au commit.
- Je n'ai pas rejoue la base hebergee ni approche de donnees reelles (I9) : base locale
  jetable uniquement, detruite en fin de geste.

## Les pieges pour la session suivante

- **L'etat du shell (variables exportees, `cd`) NE SURVIT PAS entre deux appels d'outil
  Bash distincts** dans ce harnais — mesure directement ce lot : un mot de passe pose pour
  `admin.societe@codima.test` dans un appel a ete inaccessible au suivant, obligeant a
  recreer la base et tout rejouer en un seul script. Toute sequence "poser un mot de passe
  puis l'utiliser" doit tenir dans UN SEUL appel Bash (ou passer par un fichier — exclu ici
  par I9 pour un secret).
- **`scripts/postgres-jetable.sh` echoue sur ce poste** (seul PostgreSQL 18 est installe
  nativement, le script exige les binaires 16). Le conteneur Docker `codiplan-pg16` (port
  5433) fournit deja la bonne version et les roles `codiplan_app`/`codiplan_reporting` —
  utilisable directement en DROP/CREATE de `codiplan_test` avant `db:deploy` + `db:seed`,
  sans passer par le script.
- **Le temoin `client-detail` de `scripts/captures.mts:413` est perime depuis le 23/09**
  (commit `0f4b18f`) : un futur ticket qui touche `scripts/` devra le corriger
  (`"Dernières interventions"` → `"Historique des interventions"`), sans quoi cette capture
  restera refusee indefiniment alors que l'ecran fonctionne.
- **Aucun compte du seed ne couvre a la fois `arrivee` (exige multi-societe) et
  `administrer_agences`/`administrer_utilisateurs`** (exige `admin_societe`, mono-societe
  sur cette base). Capturer les deux categories d'ecrans correctement demanderait soit un
  second compte au seed, soit une passe dediee comme celle deja construite pour
  `arrivee-sans-societe` (99O) — a arbitrer.
- Le conteneur `codiplan-pg16` reste demarre (persistant, partage avec d'autres sessions
  sur ce poste) ; la base `codiplan_test` qu'il porte est celle recreee par cette prise, pas
  restauree a son etat anterieur — conforme a l'usage habituel de cette base (`test:
  isolation` la recree de toute facon).

## Ce qui reste a faire

- Corriger le temoin perime de `client-detail` (`scripts/captures.mts:413`) dans un ticket
  qui a `scripts/` dans son territoire, puis rejouer la prise pour recuperer les deux images.
- Arbitrer le choix de compte pour `arrivee` (voir « pieges » ci-dessus) et, une fois
  tranche, rejouer la prise pour recuperer `arrivee--clair--1280/390.png`.
- Si `/terrain` et `/terrain-intervention` doivent rester dans la reference, fournir
  `COURRIEL_TERRAIN` / `MOT_DE_PASSE_TERRAIN` (ex. `guerin@codima.test`, role `technicien`,
  acces planning RESTREINT) dans une prochaine prise explicitement mandatee pour cela.

## Verification

- `pnpm format:check` : vert.
- `pnpm test` (unitaires) : vert.
- `CI=1 pnpm verify:full` : vert (format:check, typecheck, lint, test, test:isolation,
  build, feries:horizon, audit:partitions, test:e2e), execute une fois en entier au premier
  plan — voir sortie complete dans la session, aucun echec.
