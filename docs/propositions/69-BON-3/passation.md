# 69-BON-3 — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

`lireBonIntervention` (`lib/interventions/bon.ts`) rend trois champs nouveaux,
lus dans la même requête que le reste du bon, jamais `undefined` :

- `adresseSite: string | null` — la rue de `site.adresse` (même convention que
  `agence.adresse`/`client.adresse_facturation`, une clé `rue`) suivie de la
  commune (`site.commune`, la colonne dédiée), en une ligne. `null` seulement
  quand ni l'une ni l'autre n'est renseignée. La composition est faite par une
  fonction PURE et exportée, `formatAdresseSite`.
- `contact: string | null` — le nom du contact sur place, même lecture que la
  fiche (`contact: { select: { nom: true } }`).
- `machinesIdentifiees: readonly string[]` — `marque référence — N° série
  XXX`, lue par une requête propre à ce module (jamais `libellesDesMachines`
  de `lib/machines/depot.ts`, qui répond à une autre question et ne porte
  jamais le numéro de série).

La page (`app/(back-office)/interventions/[id]/bon/page.tsx`) ajoute au
`<dl>` d'en-tête, dans l'ordre demandé : Date planifiée, Nature, Client, Site,
Adresse, Agence, Machine(s) avec leur S/N, Panne signalée / travail demandé,
Contact sur place, Référence client. La ligne « Machine » n'utilise plus
`libellesDesMachines`/`machinesAffichees` (import retiré) : elle affiche
désormais `bon.machinesIdentifiees`, qui porte le numéro de série.

**Pour l'exploitation** : un bon imprimé et remis au client dit maintenant
quand la visite a eu lieu, sur quel type d'intervention, à quelle adresse, sur
quelle machine précise (numéro de série, pas seulement le modèle) et pour quel
motif — ce qu'un bon SAV doit porter, et qui manquait entièrement.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- AVANT (lecture du code, main `e92194c`) : le `<dl>` d'en-tête ne portait que
  quatre lignes — Client, Site, Agence, Machine (sans numéro de série). Ni
  date, ni nature, ni adresse, ni motif.
- APRÈS (capture jouée par `tests/e2e/bon-3.spec.ts`, voir
  `captures/bon-identification-complete-1280.png`) : dix lignes — Date
  planifiée (`20/09/2026`), Nature (`Curatif`), Client, Site, Adresse
  (`BON3 — 1 rue de l'Épreuve, Nouméa`), Agence, Machine (`Ravaglioli KPX-337
  — N° série BON3-SN-1`), Panne signalée (`BON3 fuite verin`), Contact sur
  place (`—`, aucun contact sur cette fixture), Référence client (`—`).
- `pnpm typecheck`, `pnpm lint`, `pnpm test` (2779 tests), `pnpm test:isolation`
  (1227 tests), `pnpm build` : verts. `pnpm verify:full` : vert (242 tests e2e
  passés, 3 ignorés — préexistants, sans rapport avec ce lot).

## Ce que j'ai tranché et pourquoi

- **La rue vient d'une clé `rue` dans `site.adresse` (JSON libre).** Le
  chapitre 11.2 ne fixe aucune forme à cette adresse (commentaire du schéma) ;
  `rue` est la convention déjà en usage pour `agence.adresse` et
  `client.adresse_facturation` (`prisma/seed-data.ts`). Une adresse sans clé
  `rue` exploitable rend la commune seule, jamais une ligne vide sur une
  donnée simplement absente.
- **Le numéro de série vient d'une requête PROPRE à `lib/interventions/bon.ts`**,
  jamais de `libellesDesMachines` (`lib/machines/depot.ts`), qui reste
  inchangée : elle répond à « quel modèle » pour d'autres écrans (registre,
  fiche) et ne doit pas changer de forme pour ce lot. Une seconde fonction qui
  répond à une question différente (« quelle machine précise ») n'est pas une
  seconde lecture du même critère.
- **Une clé i18n neuve, `intervention.bon.numero_serie` = « N° série »**,
  plutôt que de réutiliser `machine.fiche.kv_serie` (« N° de série ») : les
  deux textes diffèrent, et le lot demandait explicitement cette forme
  compacte. `site.adresse` (« Adresse »), en revanche, existait déjà à
  l'identique et a été réutilisée sans double écriture.
- **La Date et la Nature reprennent la même composition que la fiche**
  (`heureDuCreneau`/`dateCivile` pour l'une, `objetDuBloc` pour l'autre,
  toutes deux déjà écrites dans `presentation.ts`) — jamais une seconde
  lecture du même format qui pourrait diverger (§9, 01/09).
- **Les fixtures de l'épreuve de bout en bout passent par `lib/i18n/fr.ts`**
  (`bon3.e2e.*`), même discipline que `registre3.e2e.*`/`formulaires2.e2e.*` :
  le gardien L0-11 prend tout littéral passé à `page.getByText`/`getByRole`
  dans un fichier qui interroge l'écran, fixture comprise.
- **Un défaut d'environnement, sans rapport avec ce lot, a été corrigé au
  passage** : le client Prisma généré portait encore `intervention.demande_id`
  (un champ qui n'existe ni dans `prisma/schema.prisma` ni dans la base —
  probablement un résidu d'une session antérieure dont le schéma n'a jamais
  été régénéré après un `git checkout`). `pnpm test:isolation` échouait sur 41
  scénarios sans rapport avec BON-3, et le seed e2e échouait purement et
  simplement. `pnpm db:generate` (régénère le client depuis le schéma commité,
  n'écrit ni migration ni donnée) a suffi ; confirmé en rejouant la suite sur
  `main` non modifié avant de toucher au code de ce lot.

## Ce que je n'ai PAS fait

- Aucune migration, aucune colonne neuve. `adresseSite`, `contact` et
  `machinesIdentifiees` sont composés à la lecture, jamais stockés.
- Le nom et la qualité du signataire sur la signature (BON-4, migration
  requise) — explicitement hors périmètre par le ticket.
- Aucune modification de `interventions/[id]/page.tsx`, `lib/machines/`,
  `app/api/`, `prisma/` — territoires interdits par le ticket.
- L'épreuve e2e n'assert pas le Contact sur place ni la Référence client
  (la fixture n'en porte pas, exprès, pour ne pas allonger le graphe de
  fixture au-delà de ce que la preuve exige) : ces deux lignes restent
  couvertes visuellement par `tests/e2e/bon-intervention.spec.ts`, qui
  continue de rendre le bon sur sa propre fixture sans régression.

## Les pièges pour la session suivante

- **Le client Prisma généré peut diverger silencieusement du schéma commité.**
  Si `pnpm test:isolation` échoue en masse sur une colonne absente
  (`PrismaClientKnownRequestError ... does not exist in the current
  database`) alors que `prisma migrate status` dit la base à jour, comparer
  `node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/index.d.ts`
  au schéma : `pnpm db:generate` régénère sans toucher ni migration ni
  donnée.
- **`site.adresse` est un JSON libre, sans schéma imposé par la base.**
  `formatAdresseSite` ne lit qu'une clé `rue` ; une adresse saisie sous une
  autre forme (boîte postale seule, tribu) ne produira qu'une commune sans
  rue — c'est le comportement voulu (aucune donnée n'est inventée), mais à
  garder en tête si un futur lot introduit un formulaire de saisie
  d'adresse : il devra écrire sous la même clé `rue` pour que ce module la
  lise.
- **`@@unique([intervention_id])` sur `intervention_machine`** : une
  intervention ne porte qu'une machine au plus (arbitrage PARCOURS-1) — la
  fixture de ce lot n'en crée qu'une, exprès.

## Ce qui reste à faire

- BON-4 (hors périmètre, nécessite une migration) : le nom et la qualité du
  signataire sur la signature du bon.
- Aucun autre écart connu sur ce lot.
