# PASTILLES-1 — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

- **Les compteurs des cartes `/clients` et `/sites` deviennent des pastilles
  de couleur, centrées sur leur ligne** — la demande exacte d'Alexis :
  `CarteEntite` (`components/ui/carte-entite.tsx`) accepte désormais un `ton`
  facultatif (`TonBadge`, réutilisé depuis `components/ui/badge.tsx` — les
  couleurs ne sont écrites qu'une fois) par compteur ; avec un ton, le
  compteur se rend en pastille (`rounded-full`, chiffre en gras et agrandi,
  libellé sur la même ligne) ; sans ton, le rendu reste EXACTEMENT celui
  d'avant.
- **Couleurs fixes, portées par la fonction qui construit le compteur, jamais
  choisies par la page** : `compteurSites` = bleu, `compteurEquipements`
  (clients ET sites) = rouge, `trajetAffiche` = gris (Alexis n'a nommé aucune
  couleur pour ce compteur), `compteurHabilitations` = vert.
- **Le libellé du compteur de sites passe de « lieu »/« lieux » à
  « site »/« sites »** — mais PAS en dur : « site » est un mot IMPOSÉ (§3,
  D5/D47), et `tests/unit/i18n/vocabulaire-impose.test.ts` refuse qu'il
  s'écrive ailleurs que sous `vocabulaire.*`. `compteurSites` compose donc le
  libellé par `motDansUnePhrase("site", pluriel)` (`lib/i18n/vocabulaire.ts`),
  et les deux clés `clients.sites_un`/`clients.sites_plusieurs` ont disparu du
  dictionnaire.
- **Nouvelle pastille VERTE « habilitation(s) »** sur `/sites` — ajout
  d'Alexis le soir même. Alimentée par `habilitationsRequisesParSite`
  (`lib/sites/depot.ts`), une lecture GROUPÉE (`groupBy`, un seul aller-retour
  par page, même construction qu'`equipementsParSite`). **Omise quand aucune
  exigence n'existe** — `compteurHabilitations` rend `null`, jamais un
  compteur à zéro, sur demande explicite (« lorsqu'il y a besoin d'au moins
  une habilitation »). Ordre des pastilles sur la carte site : équipements
  (rouge), habilitations (vert), trajet (gris).
- **La pastille JAUNE « contrat de maintenance » N'A PAS été faite** — voir
  « ce que je n'ai PAS fait ».

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- **Captures AVANT/APRÈS** dans ce dossier — `/clients` et `/sites`, à 1280 et
  390 px, apparence CLAIRE — prises par un spec e2e temporaire (non conservé,
  même recette que 36-LISTES-1) : AVANT sur les fichiers revenus à `HEAD~1`
  (l'état d'avant ce lot), APRÈS sur `16d58a8` (le commit de ce lot). Un site
  fictif « Atelier de démonstration PASTILLES-1 », posé par le spec lui-même
  (jamais dans `prisma/seed.ts`, hors territoire) sous un client et une agence
  déjà dans la scène, avec UNE exigence d'habilitation — visible sur
  `sites-*-apres.png` (pastille verte « 1 habilitation »), absente sur
  `sites-*-avant.png` (le site existe déjà côté AVANT, sans aucune pastille
  verte : la colonne n'existait pas encore côté écran).
  `sites-1280-apres.png` montre concrètement l'effet : AVANT, les compteurs
  sont du texte plat aligné à gauche (« 1 lieu », « 2 équipements ») ; APRÈS,
  des pastilles centrées et colorées, et le site de démonstration porte en
  plus sa pastille verte.
- **`pnpm verify:full` presque intégralement vert** sur le dernier commit :
  `format:check`, `typecheck`, `lint`, 2691 tests unitaires (249 fichiers),
  1183 tests d'isolation (115 fichiers, dont le nouveau
  `tests/isolation/pastilles-habilitations.test.ts`), `build`,
  `feries:horizon` (vert, NC et FR à au moins douze mois), `audit:partitions`
  (13 partitions, 0 ligne dans la partition par défaut), et 187 scénarios de
  bout en bout PASSÉS sur 192 (3 sautés — des scénarios déjà sautés sur
  `main`, sans rapport avec ce lot — et 1 rouge au premier passage :
  `parcours-creer-puis-planifier.spec.ts` — « PLANIFIER refuse sans les
  quatre valeurs… », `interventions`/`planning`, HORS TERRITOIRE de ce
  ticket. Rejoué SEUL immédiatement après : vert en 3,8 s. Une seule exécution
  rouge sur deux ne fait pas les « deux rouges » qui imposent l'arrêt — je
  n'ai touché ni `app/interventions/**` ni `app/planning/**`, donc je le note
  comme un flake pré-existant, non reproduit isolément, plutôt que de
  relancer `verify:full` en entier une seconde fois pour ce seul test.
- **`pnpm chemins`** confirme que `habilitationsRequisesParSite` est atteinte
  depuis `app/(back-office)/sites/page.tsx` — aucune exemption nouvelle, la
  liste fermée des 21 exemptions n'a pas bougé.

## Ce que j'ai tranché et pourquoi

1. **`habilitationsRequisesParSite` n'a PAS été éprouvée contre le site fixe
   `SITE_A1_S1`** du harnais d'isolation, alors qu'`equipementsParSite` (le
   modèle explicite du ticket) l'est. Mesuré en écrivant le scénario : au
   moins quatre autres fichiers d'isolation
   (`habilitations.test.ts`, `pose-habilitation.test.ts`,
   `habilitations-referentiel.test.ts`, `alimentation-habilitations.test.ts`)
   posent puis retirent leurs PROPRES exigences sur `SITE_A1_S1`, chacun dans
   son fichier ; y ajouter une exigence de plus et compter EXACTEMENT un a
   d'abord rendu 2 (une collision avec une exigence posée par un autre
   fichier, `fileParallelism: false` n'empêchant pas qu'un test antérieur ait
   laissé une trace au moment précis de la lecture). Le scénario final pose
   son PROPRE site (`SITE_PASTILLES_1`, sous le CLIENT_A1 existant), retiré en
   fin de fichier — la même leçon que [[e2e-semis-partage-parallele]] côté
   isolation : un scénario qui compte pose SON site.
2. **Le libellé du compteur de sites se COMPOSE, il ne s'écrit pas** — voir
   ci-dessus. C'est une conséquence directe d'un gardien existant
   (`vocabulaire-impose.test.ts`) que je n'avais pas anticipée en lisant le
   ticket : ma première écriture (`"clients.sites_un": "site"` en dur) a fait
   rougir ce gardien immédiatement à `pnpm test`. Corrigé en composant via
   `motDansUnePhrase`, jamais en affaiblissant le gardien.
3. **La pastille verte omet ZÉRO plutôt que de l'afficher** — lecture directe
   de la phrase d'Alexis (« lorsqu'il y a besoin d'au moins une habilitation »),
   au lieu du calque exact de `compteurEquipements`, qui lui affiche « 0 ».
   Les deux notions ne sont pas symétriques dans la demande : le nombre
   d'équipements informe même à zéro (« aucun équipement enregistré » est un
   fait utile), l'absence d'exigence d'habilitation n'a rien à signaler.
4. **Le compte d'habilitations est TOTAL, bloquant ou non** — la demande ne
   distingue pas les deux pour la pastille ; seule RG-PLA-04 (l'affectation)
   le fait, ailleurs dans le dépôt.

## Ce que je n'ai PAS fait

- **La pastille JAUNE « contrat de maintenance » n'existe pas.** Le ticket le
  dit lui-même : aucune donnée de contrat n'existe au schéma (le module
  Contrats est reporté, décision 9). Je n'ai inventé ni colonne, ni table, ni
  migration.
- **Aucune capture en apparence SOMBRE.** Le ticket en demande une paire
  (claire ET sombre) à côté de chaque capture claire. `app/globals.css` et
  `docs/arbitrages.md` (rang 1) documentent une décision EXPLICITE et
  ANTÉRIEURE : *« PAS D'APPARENCE SOMBRE, et c'est une absence décidée (…) une
  apparence sombre sera un thème — donc une décision, avec ses couleurs
  validées »*. Aucun mécanisme de bascule sombre n'existe dans le dépôt — en
  fabriquer un pour cette seule paire de captures aurait été exactement le
  geste que cette décision interdit (« inventer des couleurs que personne n'a
  validées »). J'ai donc produit les captures en apparence claire seule et je
  signale ce point : **si une apparence sombre est réellement voulue, c'est
  une décision de conception à part, avec ses propres jetons de couleur
  validés — pas un sous-produit de ce lot de pastilles.**
- **Je n'ai touché ni `prisma/seed.ts` ni aucune migration** — le site de
  démonstration avec son habilitation requise, visible sur la capture, est
  posé par le spec e2e temporaire lui-même (supprimé après usage), jamais
  dans le jeu de données livré.

## Les pièges pour la session suivante

- **`SITE_A1_S1` est un bien commun très sollicité** dans
  `tests/isolation/` : au moins cinq fichiers y posent des exigences
  d'habilitation transitoires. Un nouveau scénario qui doit COMPTER quelque
  chose sur ce site précis se lit d'abord comme un TÉMOIN à confirmer
  (`clientOwner()` avant toute assertion), jamais comme une valeur figée.
- **Le mot « site » (et « agence ») ne s'écrit JAMAIS en dur** dans
  `lib/i18n/fr.ts`, y compris au singulier isolé dans une chaîne qui semble
  anodine (« site » un jour, « Site » un autre) — `pnpm test` le referme
  immédiatement (`tests/unit/i18n/vocabulaire-impose.test.ts`). Le réflexe est
  `mot("site")`/`motDansUnePhrase("site", pluriel)`, jamais une clé neuve du
  dictionnaire.
- **Le site de démonstration avec habilitation n'est PAS masqué par défaut
  seulement en apparence** : il n'a aucun équipement, donc LISTES-1 le
  masque tant que la case « Afficher aussi… » n'est pas cochée — le spec de
  capture navigue vers `/sites?sans_equipement=1` pour cette raison précise.

## Ce qui reste à faire

- **Statuer sur l'apparence sombre**, si la demande d'Alexis se confirme :
  c'est un chantier de conception à part (jetons de couleur validés), pas une
  suite de ce ticket.
- **La pastille jaune « contrat de maintenance »** attend le module Contrats
  (décision 9).
