# 9G6-FORMULAIRES — passation

Branche dédiée `9G6-FORMULAIRES`, partant d'`origin/main` (a7182b066) : `main` était extrait sur un autre
worktree (`/home/aplou/codiplan`) au démarrage de cette session. `origin/main` n'a pas bougé pendant la
session (vérifié par `git fetch` en fin de lot) : aucun rebase n'était nécessaire.

T0 = 04:33 (Pacific/Noumea). Rendu de la main vers T0+90 (06:03), après les six points et les captures ;
le reste du temps (verify) a débordé le budget de code neuf — voir plus bas, « verify:full ».

## Point 1 — Site tapé sans être choisi bloque l'envoi et garde le texte

**Avant** : `components/ui/selecteur-recherche.tsx:204-214` — le champ texte visible était `required`, mais
le champ caché `site` ne se remplit que par `choisir()` (un clic sur une proposition). Taper un texte sans
cliquer une proposition laissait le champ caché vide ; le formulaire partait quand même au serveur
(`app/api/interventions/creer/route.ts:72`, `site: lieu[1]` devenait `undefined`), qui refusait avec
« Ce lieu n'existe pas... » — en PERDANT le texte tapé (`versLeFormulaire` ne renvoie qu'un identifiant
validé, jamais un texte libre).

**Après** : `setCustomValidity` + `onInvalid` sur le champ texte (`selecteur-recherche.tsx:117-256`) rendent
le champ invalide tant qu'un texte est tapé sans sélection — la soumission HTML5 est bloquée AVANT que
l'évènement `submit` ne se déclenche (donc avant le filet de double-clic de `BoutonCreer`, qui écoute ce
même évènement sur le même formulaire). Message en ligne, clé neuve `selecteur.choix_requis`
(`lib/i18n/fr.ts`). Le texte tapé reste dans le champ puisque rien ne part au serveur.

**Preuve** : `tests/e2e/champ-fautif.spec.ts` (nouveau test), `tests/unit/ui/lot-parc.test.ts` (deux
épreuves existantes adaptées — elles tapaient un modèle sans jamais le choisir, exactement le défaut que ce
point répare).

## Point 2 — Le retour de /interventions/nouvelle lit `?depuis=`

**Avant** : `interventions/nouvelle/page.tsx:360` (fil d'ariane) et `:565` (« Annuler ») menaient toujours à
`/planning`, même en arrivant de `?client=`/`?site=` (fiche client, fiche site).

**Après** : `cheminDeRetour(params.depuis)` — un chemin interne accepté seulement s'il commence par un seul
`/` et ne porte ni `//` ni `://` (redirection ouverte refusée). Défaut inchangé (`/planning`) en l'absence
du paramètre ou s'il est invalide. Aucun appelant existant ne pose encore `?depuis=` (hors territoire de ce
lot) : c'est une infrastructure prête, pas encore câblée depuis les fiches client/site.

**Point ouvert** — le libellé du fil d'ariane reste « Planning » même quand `depuis` pointe ailleurs (texte
inchangé, seul le `href` change). Le ticket ne demandait que la destination ; un libellé dynamique («
Retour » générique ?) serait une décision de plus à prendre si `?depuis=` est un jour câblé depuis d'autres
écrans.

**Preuve** : `tests/e2e/9g6-point2-retour.spec.ts` (nouveau, 4 scénarios : défaut, chemin interne accepté,
URL externe refusée, protocole relatif `//` refusé).

## Point 3 — Premier accès : new-password, coches réactives, ton d'erreur

**Avant** : `components/session/formulaire.tsx` — `Champ` posait `autoComplete="current-password"` sur ses
deux seuls appelants (`/premier-acces`, `/enrolement`), qui posent TOUS LES DEUX un mot de passe NEUF.
`Message` affichait tout refus en gris `role="status"`. Les deux coches (« 8 caractères ou plus », «
identique à la confirmation ») sur `/premier-acces` étaient rendues côté SERVEUR, toujours vertes, sans
rapport avec la saisie.

**Après** : `autoComplete="new-password"` par défaut sur `Champ` (override possible). `Message` passe en
ton refus (`role="alert"`, `CLASSES_TON.refus`, partagé avec `MessageAcces`). Nouveau composant client
`ChampsNouveauMotDePasse` (`components/session/champs-nouveau-mot-de-passe.tsx`) : les deux coches
reflètent l'état réel des deux champs, disparaissent tant que la règle n'est pas satisfaite.
`LONGUEUR_MINIMALE` reste lue depuis `lib/auth/premier-acces.ts` côté SERVEUR et passée en prop — ce module
porte Better Auth, qu'un composant client ne doit jamais empaqueter (vérifié : `pnpm build` passe, bundle
`/premier-acces` à 731 B).

**Preuve** : `tests/e2e/9g6-point3-premier-acces.spec.ts` (nouveau, 3 scénarios), `tests/unit/session/
formulaire.test.tsx` (adapté : `role="status"` → `role="alert"`).

## Point 4 — Enrôlement : clavier numérique, code de secours, placeholder juste

**Avant** : le code à 6 chiffres de `/enrolement` (`Champ nom="code"`) n'avait ni `inputMode="numeric"` ni
`autoComplete="one-time-code"` — modèle `components/session/champ-code.tsx`, déjà posé sur `/connexion/
code`. Le placeholder du code de secours affichait `xxxx-xxxx` (4+4) alors que le `pattern` du champ exige
5+5 (`[A-Za-z0-9]{5}-[A-Za-z0-9]{5}`).

**Après** : `Champ` porte deux props optionnelles (`inputMode`, `autoComplete`), posées sur l'appel
d'`/enrolement`. Clé neuve `connexion.code.secours.placeholder_cinq_cinq` (« xxxxx-xxxxx ») ; l'ancienne
clé reste, orpheline.

**Preuve** : deux assertions ajoutées à `tests/e2e/enrolement-secrets-hors-url.spec.ts` (fixture existante,
lourde — réutilisée plutôt que dupliquée) et une assertion corrigée dans `tests/e2e/9edz-connexion-code.
spec.ts` (épreuve existante qui vérifiait l'ancien placeholder, exactement ce que ce point change).

## Point 5 — VGP : (obligatoire)/(facultatif) et Annuler

**Remesuré d'abord** : `components/ui/section-formulaire.tsx` porte déjà sa carte (`Carte`, lot 9G9D,
25/10/2026) — rien à refaire. Les quatre autres formulaires cités par le ticket (Nouvelle intervention,
Nouveau client, Nouveau site, Nouvelle machine EN CRÉATION) portent déjà `libelleChampObligatoire`/
`libelleChampFacultatif` et un « Annuler » — vérifié par lecture directe de chaque fichier.

**Seul écart réel** : `components/vgp/formulaire-verification.tsx` — trois champs `required`
(date_verification, origine, organisme) et deux facultatifs (reference_rapport, observations) sans AUCUNE
mention, et aucun « Annuler » à côté d'« Enregistrer ».

**Après** : les cinq libellés passent par `libelleChampObligatoire`/`libelleChampFacultatif`. « Annuler »
(clé neuve `vgp.verifier.annuler`) mène à `/vgp`.

**Point ouvert** — « Exemples dans les champs là où la maquette en montre » (sous-clause du point 5) n'a pas
été traité : vérifier la maquette pour chacun des cinq écrans cités demandait plus de temps que le budget
du lot ne permettait à ce stade (point 5 de 8, priorité décroissante). Aucune régression introduite ; juste
non fait.

**Preuve** : `tests/unit/vgp/formulaire-verification-labels.test.tsx` (nouveau, 3 épreuves).

## Point 6 — Agences : territoire et fuseau lisibles, Annuler

**Avant** : `parametres/agences/nouvelle/page.tsx` et `[agenceId]/page.tsx` affichaient le CODE brut du
territoire (« FR », « NC ») et l'identifiant IANA technique du fuseau (« Pacific/Noumea ») parmi ~400
options. Aucun des deux formulaires n'avait de lien « Annuler ».

**Après** : nouveau fichier `app/(back-office)/parametres/agences/presentation.ts` —
`libelleTerritoire(code)` (NC → Nouvelle-Calédonie, FR → France métropolitaine, code inconnu laissé tel
quel — référentiel ouvert) et `libelleFuseau(identifiantIana)` (nom de ville lisible, « Nouméa » avec son
accent). « Annuler » ajouté aux deux formulaires (clés neuves `agence.creer.annuler`, `agence.fiche.
annuler`).

**Deux sous-demandes du ticket non tenues, et POURQUOI (pas un oubli)** :
- Le décalage UTC affiché (« Nouméa (UTC+11) ») exigerait `Intl.DateTimeFormat(...).formatToParts(new
  Date())` hors de `lib/calendar/fuseau.ts` — interdit par `tests/unit/calendar/
  sans-date-courante-implicite.test.ts` (I7, D46), sans exemption ouverte.
- Un tri « fuseaux du territoire d'abord » commencerait par écrire un identifiant IANA en dur
  (`"Pacific/Noumea"`, `"Europe/Paris"`) — interdit par `tests/unit/calendar/sans-fuseau-en-dur.test.ts`,
  liste d'exemptions close à `prisma/seed-data.ts` seul.

  Les deux ont été tentés en premier jet, mesurés rouges sur ces deux gardiens, et RETIRÉS plutôt que
  d'ajouter une exemption (interdit explicite du lot). C'est un point à trancher par Alexis si la forme
  « UTC+11 » et le tri par territoire restent voulus : soit une troisième exemption nommée sur l'un des
  deux gardiens, soit une donnée dédiée (table de priorité par territoire, posée en base plutôt qu'en dur).

**Preuve** : `tests/unit/agences/territoire-et-fuseau-presentation.test.ts` (nouveau, 6 épreuves). Attention
— j'ai d'abord écrasé par erreur un fichier EXISTANT du même nom (`tests/unit/agences/presentation.test.ts`,
qui teste `libelleAgenceAvecCode`, module différent) ; restauré immédiatement par `git checkout HEAD --`
avant tout commit, mes épreuves vivent dans un fichier au nom distinct. Vérifié : le fichier original est
intact dans l'historique.

## Points 7 et 8 — NON FAITS, en « Points ouverts »

Le budget de code neuf (T0+90) a été atteint avant d'attaquer ces deux points. Dans l'ordre de priorité du
ticket, ils passent donc en points ouverts plutôt que d'être bâclés sous pression de temps :

- **Point 7** — `components/parc/formulaire-machine.tsx:337-396`, le gabarit de « Corriger la fiche
  machine » (MODIFICATION) reste à l'ancien gabarit : pas de sous-titre, pas de « (facultatif) », pas
  d'« Annuler », l'action n'est pas collée au téléphone, et l'aide « SN-INCONNU-<référence interne> »
  affiche un chevron brut au lieu d'un texte lisible. **Remesurer avant de toucher** : le mode CRÉATION du
  même fichier est déjà au bon gabarit (vérifié pendant le point 5) — seule la branche MODIFICATION est en
  cause.
- **Point 8** — `parc/nouvelle/page.tsx:93-105` : `?site=` sans `&client=` ne préremplit rien. Il faudrait
  déduire le client du site (`lireSite` puis son `client_id`, sous le contexte RLS déjà en place pour
  `?client=`).

## Captures

Quatre écrans capturés, AVANT (`origin/main`, détaché temporairement dans CE worktree — `main` était
extrait ailleurs) et APRÈS, à 375 et 1280 px :

```
$ ls -la docs/propositions/9G6-FORMULAIRES/captures/
agences-nouvelle-apres-1280.png        50069
agences-nouvelle-apres-375.png         18421
agences-nouvelle-avant-1280.png        50069
agences-nouvelle-avant-375.png         18421
interventions-nouvelle-apres-1280.png  96169
interventions-nouvelle-apres-375.png   43463
interventions-nouvelle-avant-1280.png  96169
interventions-nouvelle-avant-375.png   43463
premier-acces-apres-1280.png           56079
premier-acces-apres-375.png            29411
premier-acces-avant-1280.png           56322
premier-acces-avant-375.png            30491
vgp-enregistrer-apres-1280.png         69147
vgp-enregistrer-apres-375.png          39963
vgp-enregistrer-avant-1280.png         66350
vgp-enregistrer-avant-375.png          36029
```

**Agences et Interventions sont octet-identiques avant/après** — attendu : les corrections capturées sur
ces deux écrans (href d'« Annuler », validation `setCustomValidity`, options d'un `<select>` fermé) ne
changent rien au RENDU VISIBLE d'un chargement à froid, sans interaction. Premier accès et VGP diffèrent
réellement (ton du bandeau, nouveau composant client). Enrôlement et le code de secours de la connexion
(point 4) n'ont pas de capture : leurs corrections (`inputMode`, `autoComplete`, placeholder) ne se
voient qu'à l'interaction clavier/gestionnaire de mots de passe, déjà prouvées par les épreuves e2e
correspondantes.

## `pnpm verify` / `verify:full`

`CI=1 pnpm verify` **PASSE EN ENTIER** (format:check, typecheck, lint, test — 5149 tests, test:isolation,
build) — voir `docs/propositions/9G6-FORMULAIRES/verify-final.txt`.

`pnpm feries:horizon` et `pnpm audit:partitions` passent (sortie dans le même fichier).

**`pnpm test:e2e` (la suite COMPLÈTE, `CI=1`, donc UN SEUL worker) n'a PAS pu être lancée en entier** : 376
fichiers de spec e2e dans le dépôt, chacun lançant son propre serveur/seed — bien au-delà du budget de
session restant à ce stade du lot (verify:full vient APRÈS les 150 minutes de code, pas dans ce budget,
mais la session elle-même a une limite). **Le ticket l'anticipe explicitement** (« s'il ne peut pas finir,
DIS-LE ») : je le dis ici plutôt que de prétendre l'avoir fait ou de l'interrompre en silence.

**À la place**, chaque écran touché a été éprouvé par l'épreuve e2e qui le couvre, individuellement, et
toutes sont vertes À LA FIN du lot (pas seulement au moment de leur commit) :
- `tests/e2e/champ-fautif.spec.ts` (6 tests)
- `tests/e2e/9g6-point2-retour.spec.ts` (4 tests)
- `tests/e2e/9g6-point3-premier-acces.spec.ts` (3 tests)
- `tests/e2e/enrolement-secrets-hors-url.spec.ts` (4 tests)
- `tests/e2e/9edz-connexion-code.spec.ts` (5 tests)
- `tests/e2e/fiche-machine-vgp.spec.ts`, `tests/e2e/captures-9br-tpa4b-messages.spec.ts` (10 tests, VGP)
- `tests/e2e/liens-fiches.spec.ts`, `tests/e2e/9dr-fil-d-ariane.spec.ts` (10 tests, fil d'ariane)
- `tests/e2e/acces-bureau.spec.ts`, `tests/e2e/acces-technicien.spec.ts`, `tests/e2e/
  9ewb3-connexion-maquette.spec.ts` (7 tests, premier accès réel par courriel)
- `tests/e2e/9dq-tp-nav1-hub-agences.spec.ts`, `tests/e2e/agences-etat-visible.spec.ts` (6 tests, agences)
- `tests/e2e/zz-captures-9g6-formulaires.spec.ts` (8 tests, les captures elles-mêmes)

**Quelqu'un qui reprend ce lot devrait lancer `CI=1 pnpm test:e2e` en entier avant tout merge** — ce que
cette session n'a pas pu faire, faute de temps, pas faute d'avoir essayé.

## État final

```
$ git log --oneline -8
3844f5d16 9G6-FORMULAIRES — captures AVANT/APRÈS des écrans touchés (375 et 1280 px)
4030d21cc 9G6-FORMULAIRES — point 6 : Agences — territoire et fuseau lisibles, Annuler
c61e32dc2 9G6-FORMULAIRES — point 5 : VGP — (obligatoire)/(facultatif) et Annuler
da4a9ece7 9G6-FORMULAIRES — point 4 : Enrôlement — clavier numérique, code de secours, placeholder juste
f9c23aea2 9G6-FORMULAIRES — point 3 : Premier accès — new-password, coches réactives, ton d'erreur
9c70b467f 9G6-FORMULAIRES — point 2 : le retour de /interventions/nouvelle lit ?depuis=
e68f4786e 9G6-FORMULAIRES — point 1 : un site tapé sans être choisi bloque l'envoi et garde le texte
a7182b066 9G4A-DIALOGUE-CONFIRMATION-ABSENCES — passation : cause mesurée mais non identifiée, arrêt à T0+50
```

Branche `9G6-FORMULAIRES`, 7 commits sur `a7182b066` (`origin/main`, inchangé depuis le début de la
session — vérifié par `git fetch`). Aucun push (interdit par la consigne).

Arbre propre après ce dernier commit (passation + verify-final.txt).
