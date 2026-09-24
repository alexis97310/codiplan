# 56-FORMULAIRES-2 — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

`POST /api/interventions/creer` distinguait déjà un refus de DROIT
(`exigerCapacite` → `null`) d'un refus de SAISIE (schéma, lieu, panne
manquante), mais renvoyait les deux vers `/planning?motif=…` — c'est le refus
de SAISIE qui change ici, pas celui de droit.

- `app/api/interventions/creer/formulaire.ts` (NOUVEAU) — `versLeFormulaire(cle,
  champs)` construit une redirection 303 vers `/interventions/nouvelle` en
  reportant chaque champ soumis (`site`, `machine`, `type`, `priorite`,
  `description` tronquée à 1000 caractères, `reference_client`, `contact_id`).
- `app/api/interventions/creer/route.ts` — capture ce qui a été soumis AVANT
  toute validation Zod, et renvoie vers `versLeFormulaire` (au lieu de
  `versLePlanning`) sur les deux refus de saisie : l'échec de `schemaCreation`
  et le refus de `creerIntervention` (lieu inconnu, client inactif, etc.). Le
  refus de droit garde `versLePlanning`, inchangé.
- `app/(back-office)/interventions/nouvelle/page.tsx` — relit `type`,
  `priorite`, `description`, `reference_client` et `contact_id` depuis l'URL,
  valide `type`/`priorite` contre leur liste close et `contact_id` contre les
  contacts du site présélectionné (même discipline que `machineIdInitiale`
  déjà en place pour LIENS-1) ; une valeur inconnue ou hors liste redonne un
  champ vide, jamais une erreur.
- `components/interventions/site-et-machines.tsx` — nouvelle prop optionnelle
  `contactIdInitiale`, et le `<select>` du contact passe d'un `defaultValue`
  figé à un état contrôlé (même mécanique que la machine), pour pouvoir le
  préremplir une fois les contacts du site chargés.

**Pour l'exploitation** : un ADV qui oublie de décrire la panne (ou choisit un
lieu invalide) ne perd plus la saisie du reste du formulaire — il corrige
seulement ce qui manque et resoumet.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- **AVANT** (lecture du code, confirmée par le ticket) : tout refus de
  `POST /api/interventions/creer` redirigeait vers `/planning?motif=…`, sans
  aucun champ reporté.
- **APRÈS**, mesuré par l'épreuve de bout en bout `tests/e2e/formulaires-2.spec.ts` :
  un formulaire rempli (site, machine, type « Curatif », priorité « P1 »,
  référence client « FRM2-ref ») mais SANS panne, soumis, revient sur
  `/interventions/nouvelle?...`, affiche le motif « panne manquante », et les
  SIX champs (site — texte visible ET champ cloisonné client:site, machine,
  type, priorité, référence client) ont gardé leur valeur exacte — capturé en
  375 et 1280 px dans `docs/propositions/56-FORMULAIRES-2/captures/`. Après
  ajout de la panne et seconde soumission, exactement **1** intervention dont
  la référence commence par `FRM2-` existe en base (comptage `startsWith`,
  jamais un compte total qui inclurait d'autres scénarios parallèles).
- `pnpm verify` complet, exécuté une fois toutes les modifications faites :
  `format:check`, `typecheck`, `lint` (0 avertissement), `test` — 255 fichiers
  / 2756 tests, `test:isolation` — 119 fichiers / 1216 tests, `build` — tous
  verts.
- Les épreuves e2e voisines qui partagent `ChampSiteEtMachines`
  (`parcours-creer-puis-planifier.spec.ts`, `selecteurs-1.spec.ts`) rejouées
  après la modification du composant partagé : 8/8 vertes, aucune régression.
- La base de test ne garde aucune trace de la scène `FRM2-` après l'épreuve
  (vérifié par requête SQL directe après exécution).

## Ce que j'ai tranché et pourquoi

1. **`versLeFormulaire` vit dans un fichier À PART de `route.ts`
   (`app/api/interventions/creer/formulaire.ts`), pas dans `route.ts` lui-même
   ni dans `../actions.ts`.** Next.js type-vérifie qu'un module de route
   n'exporte que ses gestionnaires HTTP et sa poignée d'exports de
   configuration (`tsc` sur `.next/types` refusait `export function
   versLeFormulaire`) — je l'ai mesuré en essayant d'abord dans `route.ts`. Le
   ticket écrivait « ajoute une aide locale » et interdisait `../actions.ts`
   (partagé par d'autres routes) : un fichier voisin, dans le même dossier,
   me semble la lecture la plus proche de cette instruction compte tenu de la
   contrainte technique — mais c'est un fichier NEUF, hors de la liste
   « Territoire » du ticket (qui ne nommait que `route.ts`,
   `interventions/nouvelle/`, `fr.ts`), et je le signale explicitement plutôt
   que de le laisser passer en silence.
2. **`components/interventions/site-et-machines.tsx` est touché**, alors que
   le « Territoire » du ticket ne le nomme pas non plus. Sans cette
   modification, `contact_id` — un des sept champs que le ticket demande de
   reporter — ne pouvait pas se préremplir : c'est le seul endroit où existe
   le `<select name="contact_id">`, et il n'acceptait aucune prop pour une
   valeur initiale. J'ai ajouté une prop optionnelle
   (`contactIdInitiale`, même contrat que `machineIdInitiale` déjà présent)
   et converti ce `<select>` d'un `defaultValue` figé à un état contrôlé,
   sans toucher au comportement du second appelant du composant
   (`clients/[id]/page.tsx`, qui ne passe pas cette prop). Le changement
   reste petit et rejoué sans régression par les épreuves e2e existantes, mais
   c'est un écart au territoire déclaré, à valider.
3. **`mode_valorisation` ne fait PAS partie des champs reportés.** Le ticket
   énumère explicitement sept champs dans le format d'URL attendu
   (§« CE QUE TU FAIS », point 1) et `mode_valorisation` n'y figure pas ; je
   m'y suis tenu à la lettre plutôt que d'étendre à « chaque champ » au sens
   large. Son défaut (`temps_passe`) reste posé après un refus, comme avant ce
   lot.
4. **Le texte de la scène e2e (client, site, numéro de série, panne,
   référence client) est passé par `lib/i18n/fr.ts`** (`formulaires2.e2e.*`),
   même si le gardien L0-11 ne l'aurait pas strictement exigé pour tous ces
   champs (un `.fill()` n'est pas une « requête d'écran » au sens du gardien) :
   c'est la discipline déjà suivie par `avertissements.e2e.*` et
   `fiche360.e2e.*`, et j'ai préféré la cohérence à l'économie de quelques
   lignes.

## Ce que je n'ai PAS fait

- Aucune alerte « non enregistré » à la sortie de page — explicitement hors
  périmètre du ticket.
- Les routes `affecter`/`annuler`/`cloturer`/`deplacer` gardent
  `versLePlanning` sur tout refus : explicitement hors périmètre, reportées
  ci-dessous.
- Aucune migration, aucune ligne de semis, aucun changement de règle de
  création.
- `mode_valorisation` n'est pas reporté (voir « ce que j'ai tranché »,
  point 3).

## Les pièges pour la session suivante

- **`versLeFormulaire` ne peut pas vivre dans `route.ts`** : Next.js refuse à
  la compilation (`.next/types`) qu'un module de route exporte autre chose que
  ses gestionnaires HTTP. Toute future aide du même genre, sur une autre
  route, devra suivre le même schéma (fichier voisin non-route).
- **Le `<select>` du contact est maintenant CONTRÔLÉ**, comme celui de la
  machine — si un futur lot ajoute un troisième champ dépendant du site
  choisi dans `ChampSiteEtMachines`, le même schéma (état + effet qui
  resynchronise sur `auSite`) s'applique, pas un `defaultValue` figé qui ne se
  réévalue qu'au montage.
- Le territoire déclaré par ce ticket (`route.ts`, `interventions/nouvelle/`,
  `fr.ts`) s'est révélé insuffisant pour couvrir `contact_id`, un des sept
  champs explicitement demandés : à vérifier lors de la rédaction du prochain
  ticket touchant ce formulaire, que le territoire couvre bien
  `components/interventions/site-et-machines.tsx` s'il doit à nouveau changer.

## Ce qui reste à faire

- L'alerte « non enregistré » à la sortie de la page `/interventions/nouvelle`
  (hors périmètre de ce lot, nommée par le ticket).
- Étendre `versLeFormulaire` (ou son équivalent) aux routes
  `affecter`/`annuler`/`cloturer`/`deplacer`, qui perdent encore la saisie de
  leurs propres formulaires sur un refus (même défaut que celui réparé ici,
  nommé comme hors périmètre par le ticket).
- Si `mode_valorisation` doit un jour être reporté lui aussi, ajouter un
  huitième champ à `versLeFormulaire`/`champsResoumis` et à la page — décision
  à prendre par un futur ticket, pas tranchée ici.
