# CONTACTS-1 — passation

Travail commité **sur `main` en local**, sans proposition ni branche distante
(processus établi depuis DOC-1/TAUX-1/HISTORIQUE-SITE-1). **Rien n'a été
poussé.**

Point de départ : `54fb800` (`main` au démarrage, BON-1). `git stash list`
montre `stash@{0}: WIP on main: 98ba2fc AGENCE-2` — vu, laissé en place, sans
rapport avec ce lot (mémoire du poste).

---

## 1. Ce que j'ai changé

| fichier | ce qui change |
|---|---|
| `lib/contacts/depot.ts` (NEUF, 278 lignes) | Le chemin d'écriture des contacts, sur la forme de `lib/habilitations/depot.ts` : `creerContact`, `modifierContact` (`updateMany`, zéro ligne touchée = `introuvable`), `basculerActiviteContact`, `contactsDuClient` (tous les contacts du client, site compris), `contactsDuSite` (seulement ceux du site). Les deux clés composites (`contact_client_fkey`, `contact_site_du_client_fkey`) sont laissées à la base — aucune lecture préalable, `motifDeLErreur` traduit `P2003`/`P2025` en `client_hors_perimetre` / `site_hors_client` / `introuvable`. `client_id` n'est jamais réécrit (conforme à `saisie.ts`). |
| `app/api/contacts/saisie-recue.ts` (NEUF) | Lit un `FormData` vers `CreationContact`/`ModificationContact` — **aucune validation neuve**, seulement `schemaCreationContact.safeParse` / `schemaModificationContact.safeParse`. `versLeRetour` valide le chemin de retour (`/clients/<uuid>` ou `/sites/<uuid>`) avant de rediriger, jamais une entrée libre. Aucun canal n'est lu (`CANAUX_IMPLEMENTES` n'en connaît qu'un). |
| `app/api/contacts/creer/route.ts`, `app/api/contacts/[id]/modifier/route.ts`, `app/api/contacts/[id]/activite/route.ts` (NEUFS) | Trois routes, `exigerCapacite("gerer_client_site")` — la même capacité que la création/modification d'un client ou d'un site (D130). L'activité est un geste séparé, sur la forme de `/api/habilitations/[id]/activite` : l'état visé est ENVOYÉ, jamais déduit d'une bascule. |
| `app/(back-office)/contacts/presentation.tsx` (NEUF, 317 lignes) | `BlocContacts`, partagé par la fiche client et la fiche site : liste des contacts (chacun dans un `<details>` avec son formulaire de modification et son bouton actif/inactif) + formulaire de création. `siteOptions` (non nul sur la fiche client) ouvre le choix du rattachement ; `siteFixe` (fiche site) le fige. Les rôles viennent de `ROLES_CONTACT` (`lib/contacts/saisie.ts`), jamais recopiés. |
| `app/(back-office)/clients/[id]/page.tsx` | `contactsDuClient` lue ; le bloc statique qui disait l'absence d'écran est remplacé par `<BlocContacts bloc="contacts-client" … siteOptions={sites…} montrerRattachement />`. |
| `app/(back-office)/sites/[id]/page.tsx` | `contactsDuSite` lue ; `<BlocContacts bloc="contacts-site" … siteOptions={null} siteFixe={site.id} montrerRattachement={false} />` sous le bloc des habilitations exigées. |
| `lib/i18n/fr.ts` | `clients.fiche.contacts_sans_ecran` **disparaît** (devenu faux) → `clients.fiche.contacts_vide`. Nouvelles entrées `contact.*`, `contacts.*`, `sites.fiche.contacts*`, `contacts.e2e.*`. Aucune n'écrit le mot imposé « site » en toutes lettres dans sa VALEUR — le gardien du vocabulaire (D5/D47) l'a rappelé deux fois (voir §5) ; « lieu » le remplace en prose, comme `sites.fiche.interventions_vide` le fait déjà. |
| `tests/unit/auth/porte.test.ts` | Les trois routes neuves entrent dans `ROUTE_CAPACITE` sous `gerer_client_site` (46 → 49 routes gardées) — gardien D-12, population dérivée du disque. |
| `tests/isolation/contacts-ecriture.test.ts` (NEUF, 424 lignes, 10 épreuves) | Le chemin applicatif : créer/modifier/désactiver ; les deux refus référentiels (client d'une autre société, site d'un autre client) ; `contactsDuClient` rend le contact du client ET celui de son site ; `contactsDuSite` ne rend QUE les siens (jamais ceux du client, jamais ceux d'un autre site) ; cloisonnement entre sociétés sur les deux lectures. |
| `tests/e2e/contacts.spec.ts` (NEUF, 275 lignes, 2 épreuves) | RENDU : la fiche client dit son absence puis montre l'interlocuteur créé par le formulaire ; la fiche site crée un interlocuteur qui apparaît aussi sur la fiche client, jamais sous l'autre site. Scène à soi (client + deux sites, IDs `e2e00000-…-c17*`), jamais empruntée au semis partagé. |

**Ce que ça change pour l'exploitation.** Alexis peut désormais enregistrer QUI
appeler chez un client — nom, fonction, téléphone, mobile, courriel, rôles —
depuis la fiche client (tous les interlocuteurs) et depuis la fiche d'un site
(ceux de ce lieu précisément), les désactiver sans perdre l'historique, et les
modifier. `DEMANDES-1`, qui dépendait d'un `Contact` identifiable, n'est plus
bloqué par une table sans écriture.

---

## 2. Ce que j'ai mesuré

### L'écran — `tests/e2e/contacts.spec.ts`, scène posée, 1280 px

Captures dans `docs/propositions/18-CONTACTS-1/avant/` et `…/apres/` :

| fiche | AVANT (`54fb800` avec le code du lot stashé, 22/09 14:12 UTC) | APRÈS (22/09 14:13 UTC) |
|---|---|---|
| « Client sans interlocuteur (épreuve CONTACTS-1) » | bloc « Contacts », texte fixe : *« Les interlocuteurs d'un client sont prévus … aucun écran ne permet encore d'en saisir un. »* — ni formulaire, ni liste. | bloc « Contacts » avec un formulaire de création complet (rattachement, nom, fonction, téléphone, mobile, courriel, rôles) ; après soumission, une ligne « Donneuse d'ordre (épreuve) — Donneur d'ordre — Contact du client (aucun lieu associé) ». |
| « Lieu qui recevra un interlocuteur (épreuve CONTACTS-1) » | aucun bloc « Interlocuteurs » sur la fiche site. | bloc « Interlocuteurs » avec son propre formulaire (site figé) ; après soumission, une ligne « Contact du lieu (épreuve) », visible AUSSI sur la fiche client, absente de la fiche de l'AUTRE lieu du même client. |

Le spec a rougi sur le code d'avant à la première assertion des deux tests —
`locator('[data-bloc="contacts-client"]')` / `…="contacts-site"` introuvables
— exactement comme annoncé par le constat du ticket. Les captures AVANT sont
prises avant cette assertion (`avant/mesure.json` : deux passages séparés, le
mode série n'ouvrant pas le second test quand le premier rougit — `-g "LA
FICHE SITE"` pour le second, comme HISTORIQUE-SITE-1).

**Comment l'AVANT a été pris.** `git stash push -u` sur les six fichiers du
lot (`fr.ts`, les deux fiches, `lib/contacts/depot.ts`, `app/api/contacts/`,
`app/(back-office)/contacts/`, `tests/isolation/contacts-ecriture.test.ts`),
en gardant `tests/e2e/contacts.spec.ts` seul dans l'arbre — il ne référence
aucun symbole neuf au niveau du TYPE (les clés du dictionnaire sont lues par
nom, `(fr as Record<string,string>)[cle]`, la scène n'appelle que des modèles
Prisma déjà existants) — puis `pnpm exec playwright test` sur le code
d'avant, et `git stash pop` immédiatement après.

**Un incident sans rapport avec le lot, corrigé au passage.** Le premier essai
a échoué au SEED (`P2022 : the column intervention.commentaire_technicien
does not exist`) — le Prisma Client généré dans `node_modules` était STALE,
généré depuis un état antérieur au retrait de cette colonne (probablement
depuis le stash AGENCE-2, jamais reconstruit). `pnpm exec prisma generate`
l'a réparé ; aucun fichier du dépôt n'a bougé pour ça.

### La chaîne d'écriture — `tests/isolation/contacts-ecriture.test.ts`

10 épreuves, toutes rouges avant (`Cannot find package '@/lib/contacts/depot'`
— mesuré en déplaçant `lib/contacts/depot.ts` hors du dépôt puis en le
remettant), toutes vertes après. Ce que chaque vert prouve : la création
écrit réellement (site nul et site du client) ; la modification ne touche
QUE les champs soumis (`nom`/`email` inchangés après une modification qui
ne portait que sur `fonction`/`roles`) ; la bascule d'activité va dans les
deux sens ; un identifiant d'une autre société est `introuvable`, jamais une
exception ; les deux clés composites refusent (`client_hors_perimetre`,
`site_hors_client`) sans écrire une ligne ; `contactsDuClient` rend le
contact du client ET celui de son site ; `contactsDuSite` ne rend QUE les
siens (témoins négatifs sur le client sans site et sur l'autre site) ;
cloisonnement société A / société B sur les deux lectures, avec témoin
positif avant le témoin négatif.

### La porte

`pnpm verify:full`, EN ENTIER, deux passages complets :

1. **14:14 UTC** — rouge à `format:check` (6 fichiers neufs non passés au
   formateur). Réparé par `pnpm exec prettier --write` sur ces 6 fichiers.
2. **14:14 UTC, second passage** — rouge à `typecheck`
   (`tests/isolation/contacts-ecriture.test.ts:110`, `.sort()` sur un
   `readonly string[]`). Réparé (`[...modification.fiche.roles].sort()`).
3. **14:14–14:18 UTC, troisième passage** — rouge à SEPT épreuves, sur
   TROIS gardiens distincts, chacune une seule fois (voir §3 et §5 pour le
   détail de chaque réparation) :
   - `tests/unit/auth/porte.test.ts` — les 3 routes neuves absentes de
     `ROUTE_CAPACITE` ;
   - `tests/unit/i18n/sans-chaine-visible-en-dur.test.ts` — un texte JSX
     extrait dans une variable via une expression conditionnelle (le gardien
     ne suit pas `t(...)` à travers une variable intermédiaire), et un
     séparateur `" · "` écrit en dur au lieu de
     `t("ponctuation.point_median")` ;
   - `tests/unit/i18n/vocabulaire-impose.test.ts` — trois entrées neuves du
     dictionnaire écrivaient le mot imposé « site » dans leur VALEUR.
4. **14:18–14:21 UTC, quatrième passage — VERT, en entier** :
   `format:check`, `typecheck`, `lint`, **2572** unitaires (233 fichiers,
   +10), **1114** d'isolation (107 fichiers), `build`, `feries:horizon` (2
   territoires, horizon ≥ 12 mois), `audit:partitions` (13 partitions,
   défaut vide), **140** e2e passés (+2) — les 2 restants sont les deux
   `skip` préexistants de `tous-les-ecrans-rendent.spec.ts`.

Aucune épreuve n'a rougi deux fois de suite pour la MÊME cause : la règle des
deux rouges (22/09) ne s'est pas déclenchée.

---

## 3. Ce que j'ai tranché, et pourquoi

Aucun de ces points ne touche l'argent facturé, une obligation légale, ni ce
qu'un client voit (le portail client n'a pas de bloc contacts dans ce lot).

1. **Aucun canal proposé à la saisie.** `CANAUX_IMPLEMENTES` n'en connaît
   qu'un (courriel), et `schemaCreationContact` le pose PAR DÉFAUT dès que le
   champ `canaux` est absent — ce qui, combiné à `exigerCourrielSiCanalEmail`,
   rend le courriel EFFECTIVEMENT obligatoire aujourd'hui (aucun contact ne
   peut exister sans canal, et le seul canal connu exige un courriel).
   *Ce n'est pas une règle que j'ai écrite* : c'est une conséquence de
   `lib/contacts/saisie.ts` (L1-03, hors territoire), que je me contente de
   NOMMER plutôt que de contourner — l'écran ne propose donc aucune case à
   cocher pour un canal que rien ne sait servir, conformément au point 3 de
   l'arbitrage du ticket. *Réouverture :* le jour où `sms` rejoint
   `CANAUX_IMPLEMENTES`, l'écran pourra proposer un choix ; pas avant.
2. **`site_id` n'est PAS modifiable depuis l'écran**, alors que
   `schemaModificationContact` l'autorise. J'ai lu le ticket comme demandant
   de rendre les DEUX rattachements possibles À LA CRÉATION (« l'écran doit
   rendre les deux possibles, et dire lequel il est »), pas de permettre de
   déplacer un contact d'un site à l'autre après coup — un geste plus rare et
   plus risqué (site du mauvais client refusé par la clé composite, mais
   aucune confirmation à l'écran). *Réouverture :* si l'exploitation veut
   déplacer un contact, `modifierContact` l'accepte déjà (`site_id` est dans
   `ModificationContact`) — il ne manque qu'un champ au formulaire d'édition.
3. **`actif` n'est PAS dans le formulaire de modification**, sur la forme de
   `/api/habilitations/[id]/activite` (geste séparé, état ENVOYÉ) plutôt que
   sur la forme des clients/techniciens (`<select>` dans le même formulaire,
   D129). Les deux formes coexistent déjà dans le dépôt ; j'ai suivi celle de
   `lib/habilitations/depot.ts`, nommée comme modèle par le ticket lui-même
   (« sur la forme de `lib/habilitations/depot.ts` »). *Réouverture :*
   aucune — c'est la forme demandée.
4. **Édition par `<details>`/`<summary>`, sans JavaScript client.** Les
   écrans du dépôt sont des composants serveur purs (formulaires HTML,
   `method="post"`) ; un `<details>` ouvre/ferme la fiche d'édition sans
   script, cohérent avec le reste de la base de code. *Réouverture :*
   si l'ergonomie déçoit à l'usage (ERGO-1 l'a fait pour les habilitations),
   remonter le formulaire au niveau du tableau plutôt que dans une
   disclosure, comme le lot ERGO-1 l'a fait pour les habilitations.
5. **`contact.rattachement.client` dit « aucun lieu associé »**, jamais
   « aucun site » — le gardien du vocabulaire (D5/D47) l'a rappelé deux fois
   pendant ce lot (voir §5) : le mot « site » ne s'écrit qu'aux entrées
   `vocabulaire.*`, toute autre entrée qui doit en parler compose avec
   `mot("site")` ou dit « lieu » en prose, comme `sites.fiche.interventions_vide`
   le fait déjà. *Réouverture :* aucune, c'est la règle du dépôt.
6. **Aucune capture du formulaire de modification déployé.** Les captures
   obligatoires (fiche client AVANT/APRÈS, fiche site avec interlocuteurs,
   client sans interlocuteur, formulaire de création) sont toutes prises ;
   le `<details>` de MODIFICATION d'un contact existant n'a pas de capture à
   part, parce qu'il porte les mêmes champs que la création — une seconde
   capture n'aurait rien montré de plus.

---

## 4. Ce que je n'ai PAS fait

- **Pas touché `lib/contacts/saisie.ts`** (interdit par le ticket) — même si
  la conséquence « courriel de fait obligatoire » (voir §3.1) m'a semblé
  mériter d'être nommée plutôt que doublée par une seconde validation.
- **Pas touché `prisma/schema.prisma` ni écrit de migration** — la table, ses
  contraintes, sa politique RLS et son déclencheur d'audit existent depuis
  L1-03 ; ce lot n'ouvre que des chemins applicatifs.
- **Pas touché `tests/isolation/contact.test.ts`** (déjà bon, éprouve la base
  par lecture brute) — `contacts-ecriture.test.ts` est un fichier NEUF, sur
  le CHEMIN APPLICATIF.
- **Pas d'écran de suppression** — même raisonnement que les clients et les
  sites : la voie ordinaire est `actif = false`, réversible par la lecture.
- **Pas d'envoi de courriel, pas de canal SMS** — RG-INT-05 les consommera,
  hors territoire de ce lot.
- **Pas touché le portail client** (`/portail`, hors territoire) : les
  interlocuteurs n'y sont pas montrés dans ce lot.
- **Pas touché `lib/imports/**`, `lib/vgp/**`, `lib/tarification/**`.**
- **Pas écrit dans `docs/backlog.md`** ni `docs/arbitrages.md` — hors
  territoire ; voir §6.
- **Rien poussé.**

---

## 5. Les pièges pour la session suivante

- **Le Prisma Client généré peut être STALE et silencieux jusqu'au seed.**
  `node_modules/.prisma/client` ne se régénère pas tout seul quand
  `schema.prisma` change dans un stash puis en sort ; l'erreur (`P2022`, une
  colonne absente) pointe vers la MIGRATION alors que la vraie cause est le
  client généré. `pnpm exec prisma generate` avant toute suite e2e après un
  `git stash pop` ou un `checkout` qui a bougé `schema.prisma` est la
  vérification à faire en premier, pas en dernier.
- **`t("clé")` extrait dans une CONSTANTE via une expression CONDITIONNELLE
  n'est pas reconnu par le gardien `sans-chaine-visible-en-dur`** —
  `tests/unit/outils/rendu-visible.ts` (`constantesLitterales`) retrace les
  constantes avec un contexte VIDE (aucun accesseur connu), donc `t(...)` à
  l'intérieur d'un ternaire assigné à une `const` puis affiché ailleurs se
  voit comme une chaîne en dur — SEUL l'argument littéral du `t()` est
  d'ailleurs celui qui est rapporté (la clé, pas la valeur), ce qui est le
  signe distinctif du défaut. **La réparation est d'écrire le `t(...)` /
  ternaire DIRECTEMENT dans le JSX**, jamais dans une variable intermédiaire.
  Les fichiers déjà en place composent `t(...)` directement au point de rendu
  (ex. `app/(back-office)/sites/presentation.ts`, `libelleRattachement`) ;
  ce lot est le premier à l'avoir heurté en écrivant l'inverse.
- **Le gardien du vocabulaire imposé (D5/D47) mord aussi sur les fixtures
  `*.e2e.*`.** « Contact de site (épreuve) » a été refusé au même titre
  qu'une vraie entrée d'écran — le gardien ne fait pas de différence entre
  texte réel et texte de test, et c'est voulu (même raisonnement que
  L0-11 : le texte attendu par un test de rendu EST un emplacement visible).
- **`.join(" · ")` écrit en dur est une faute au même titre qu'un libellé** —
  `t("ponctuation.point_median")` existe déjà pour ça, à ne pas redécouvrir
  à la prochaine liste de champs concaténés.
- **`git stash push -u -- <chemins>` mélange fichiers suivis modifiés et
  fichiers neufs non suivis en une seule opération** — plus simple que la
  distinction faite à HISTORIQUE-SITE-1 entre `stash` (suivis) et déplacement
  manuel (neufs), et ça fonctionne pour un test e2e gardé HORS du stash tant
  qu'il ne référence aucun symbole neuf.

---

## 6. Ce qui reste à faire

1. **Le déplacement de `site_id` après création** — `modifierContact` le
   permet déjà ; il ne manque qu'un champ (probablement dans une seconde
   disclosure, pour ne pas banaliser le geste) côté écran, si l'exploitation
   le demande (§3.2).
2. **Le portail client** ne montre toujours pas les interlocuteurs — hors
   territoire de ce lot, mais `contactsDuClient`/`contactsDuSite` sont prêts
   à être appelées depuis un écran portail le jour où RG-DRO-01 l'exige.
3. **`DEMANDES-1`** peut maintenant désigner un `Contact` réel — c'était le
   point bloquant nommé par le ticket.
4. **Reporter dans `docs/backlog.md`** que la table de contacts a désormais
   un chemin d'écriture complet (créer/modifier/désactiver/lire), et que le
   « bloc contacts sans écran » cité par plusieurs commentaires ailleurs dans
   le dépôt (ex. la doc-comment de R3-12) est devenu faux.
