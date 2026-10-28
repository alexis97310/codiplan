# 9I4-EQUIPE-N-PLUS-UN — passation

Branche dédiée `9I4-EQUIPE-N-PLUS-UN`, partant d'`origin/main` (`24f256bfa`) : `main` était
extrait dans un autre worktree (`/home/aplou/codiplan`).

## Le contrat du ticket, et où il s'arrête

Le ticket prescrit, au point 3 : « UNE lecture `compte.findMany({ where: { utilisateur_id:
{ in: [...] } } })`, puis un regroupement en mémoire », avec pour preuve de réussite (point
4) « nombre de requêtes constant, indépendant de N ». **Cette lecture unique a été mesurée,
et elle est IMPOSSIBLE sans toucher une politique RLS — hors territoire de ce lot.** C'est
la découverte centrale de ce lot ; le reste du contrat (points 1, 2, 4 partiellement, 5) est
tenu.

## Point 1 — la mesure, et sa preuve

`lib/auth/acces-technicien.ts` (`etatsAccesDesTechniciens`) et `lib/auth/acces-bureau.ts`
(`etatsAccesDesComptes`) bouclaient :

```ts
for (const utilisateurId of utilisateurIds) {
  const compte = await designe.compte.findFirst({ where: { utilisateur_id: utilisateurId }, ... });
  ...
}
```

Une lecture `compte.findFirst` par personne, **en séquence** : chacune attend la précédente.
`tests/isolation/9i4-equipe-n-plus-un.test.ts` pose un délai artificiel de 60 ms sur
`$transaction` (chaque lecture désignée en ouvre une) et mesure le temps total pour N = 1, 5,
20. **Rejoué contre le code d'AVANT ce lot** (`git stash` temporaire des deux fichiers
source, test conservé) : N=20 prend **1482 ms** — largement au-delà du seuil (`480 ms`) posé
pour le code corrigé. C'est la preuve que la boucle était bien séquentielle, et que son coût
croît avec l'effectif, comme l'audit du 28/10 le constatait (M4).

## Point 2 — un utilisateur peut-il avoir plusieurs `Compte` ?

**Mesuré : non, pas dans ce produit aujourd'hui.** `Compte` ne porte aucune unicité sur
`utilisateur_id` seul (`@@unique([emetteur, compte_externe_id])` seulement,
`prisma/schema.prisma:1112`), mais les **trois** chemins qui créent une ligne `compte` dans
ce dépôt posent tous `emetteur = "local:credential"` et `compte_externe_id = utilisateur_id` :

- l'amorçage (`lib/auth/amorcage.ts`, via `signUpEmail` — mesuré par un ticket antérieur,
  voir l'en-tête de `lib/auth/acces-technicien.ts`) ;
- `lib/auth/lien-d-acces.ts:152` (le chemin partagé technicien/bureau de ce lot) ;
- `prisma/seed.ts:210` (démonstration).

L'unicité `(emetteur, compte_externe_id)` borne donc, en pratique, à **une seule ligne par
utilisateur**. `designe.compte.findFirst` sans `orderBy` reste donc juste — documenté en
commentaire aux deux endroits (`etatsAccesDesTechniciens`, `etatsAccesDesComptes`) plutôt que
laissé implicite. Aucun émetteur autre que `local:credential` n'existe dans ce dépôt
aujourd'hui (aucun fournisseur OAuth configuré, `lib/auth/config.ts`) ; en ouvrir un referait
cette mesure.
`tests/isolation/9i4-equipe-n-plus-un.test.ts` (dernière `describe`) fige la mesure : une
ligne, le bon émetteur, le bon `compte_externe_id`.

## Point 3 — pourquoi la lecture UNIQUE prescrite est écartée

`compte` porte la politique `compte_lecture` (migration
`20260908090000_categorie3_cloisonnee_l1_02d`) :

```sql
USING (
  "utilisateur_id" = NULLIF(current_setting('app.authentification_utilisateur_id', true), '')::uuid
  OR "utilisateur_id" = NULLIF(current_setting('app.utilisateur_id', true), '')::uuid
)
```

La première branche est posée par `avecDesignationAuth` (`lib/auth/lecture-identite.ts`),
**une seule identité à la fois** — `aplatirConjonction` ne lit même pas un `OR` dans le
`where` (« une clé trouvée sous un OR ne bornerait rien : la requête pourrait rendre autre
chose que la ligne nommée »), et `texteDe` ne reconnaît que `{ champ: "x" }` et
`{ champ: { equals: "x" } }` — jamais `{ in: [...] }`. La seconde branche
(`app.utilisateur_id`) est posée par `avecContexteApplicatif` pour l'AUTEUR de l'audit,
c'est-à-dire **l'administrateur qui regarde**, jamais les techniciens/comptes qu'il consulte.

**Mesuré directement** (avant d'écrire le correctif, pour ne pas committer un résultat
supposé) : sous ce même client, `avecDesignationAuth(clientApp()).compte.findMany({ where: {
utilisateur_id: { in: [id1, id2] } } })` rend **zéro ligne** — ni `app.authentification_
utilisateur_id` ni `app.utilisateur_id` ne sont posées pour cette requête (`designations.
length === 0 && administration === undefined` → `return query(args)`, sans transaction, donc
sans `set_config`). La politique refuse donc tout, à l'aveugle. Ce test est conservé
(`tests/isolation/9i4-equipe-n-plus-un.test.ts`, deuxième `describe`) comme garde-fou : si un
jour il échoue, c'est que la désignation ou la politique ont changé, et ce document doit être
relu avant de croire la lecture batch acquise.

**Aucune autre variante n'échappe à cette limite sans toucher RLS ou élargir le territoire :**
- `avecSociete`/`avecContexteApplicatif` ne posent ni l'une ni l'autre variable que
  `compte_lecture` lit — ils gouvernent les tables de forme « société »/« parc » (I1), pas
  l'authentification.
- Poser `app.utilisateur_id` à tour de rôle resterait à UNE identité à la fois (c'est un
  scalaire) : aucun gain sur le nombre de requêtes, et ce serait de surcroît prétendre être
  quelqu'un d'autre pour l'audit — une fausse piste, pas une économie.
- Étendre `CLES_DESIGNATION`/`texteDe` à `{ in }` ne suffit pas seul : `set_config` ne porte
  qu'UNE valeur par variable, et la politique compare par `=`, pas par `= ANY(...)`. Il
  faudrait une politique RLS différente — une migration — ET toucher
  `lib/auth/lecture-identite.ts`, qui est explicitement HORS TERRITOIRE de ce lot (« toute
  autre partie de `lib/auth/**` »).
- Lire sous un rôle `BYPASSRLS` n'existe pas pour `codiplan_app` (seul `codiplan_reporting`
  le porte, réservé à `lib/reporting`, D21) — en donner un reviendrait à assouplir
  l'invariant I1/le cloisonnement des données personnelles, un point d'arrêt explicite du
  §8 de `CLAUDE.md`.

## Ce qui a été fait à la place (mitigation, pas résolution complète)

Les deux boucles `for (...) { await ... }` sont passées à `Promise.all` — même forme que les
lectures `journalAcces.findMany` par administrateur, juste au-dessus dans le même fichier,
déjà parallélisées et explicitement citées par le ticket comme « ce n'est pas le défaut ».
Les N lectures de `compte` restent N appels Prisma (le nombre de requêtes SQL ne baisse pas),
mais elles s'exécutent **de front** plutôt que l'une après l'autre : c'est le coût en LATENCE
VERS L'HÉBERGEUR — la justification même du ticket — qui cesse de croître avec l'effectif,
pas le nombre d'allers-retours. Comportement identique en sortie (mêmes quatre états,
mêmes refus, même filtrage par société) : les 36 épreuves existantes des quatre états d'accès
(`tests/isolation/acces-technicien.test.ts`, `tests/isolation/acces-bureau.test.ts`) passent
sans modification.

## Décision nécessaire (point d'arrêt, §8 de `CLAUDE.md`)

Une lecture RÉELLEMENT en UNE requête SQL, pour un nombre arbitraire d'identités, exige l'une
de ces deux voies — toutes deux des points d'arrêt :

1. **Une migration** qui étend `compte_lecture` (et les politiques sœurs si on les aligne)
   pour accepter un ENSEMBLE d'identités désignées — par exemple une variable de session
   portant une liste, comparée par `= ANY(string_to_array(...)::uuid[])` — plutôt qu'une
   seule. Cela touche une politique RLS d'une table d'authentification : un changement de
   schéma/cloisonnement nommé au §8.
2. **Accepter l'état actuel** : la mitigation « de front » ci-dessus reste la meilleure
   amélioration possible sans toucher RLS, et le N+1 résiduel (en nombre de requêtes, pas en
   latence perçue) est le prix du modèle « une table d'authentification ne se lit QUE par
   désignation, jamais en lot » — une garantie de sécurité délibérée
   (`lib/auth/lecture-identite.ts`, en-tête), pas un oubli.

Aucune des deux n'a été tranchée ici : la première est hors territoire et hors invariant sans
accord explicite ; la seconde est ce que ce lot livre, mais ne clôt pas formellement le
contrat du ticket (point 4, « nombre de requêtes constant »). **Le point d'arrêt est signalé
plutôt que deviné.**

## Points 4 et 5

- Épreuves des quatre états d'accès (existantes) : vertes, sans modification.
- Captures AVANT/APRÈS de l'écran Équipe : **non prises**. Aucun fichier d'écran, de route ni
  de composant n'a changé (seules les fonctions de lecture `lib/auth/acces-technicien.ts` et
  `lib/auth/acces-bureau.ts`, invisibles à l'écran) — l'écran est inchangé par construction,
  pas seulement par preuve visuelle. Si une capture est tout de même exigée comme preuve
  formelle, elle reste à faire.

## `CI=1 pnpm verify:full`, et pourquoi il n'a pas fini

Sortie complète dans `verify-final.txt` (ce dossier), lancé en un seul appel au premier plan,
borné à 35 min. **Tout ce qui précède `test:e2e` est VERT, sans aucun échec :**
`format:check`, `typecheck`, `lint`, `test` (478 fichiers, 5182 épreuves), `test:isolation`
(193 fichiers, 1684 épreuves), `build` (« Compiled successfully »), `feries:horizon`,
`audit:partitions`. C'est `pnpm verify` au complet, la porte de sortie du TICKET — verte.

`test:e2e` (Playwright, 1725 épreuves, un seul worker) a démarré, re-semé sa base, et tournait
encore — aucun échec observé dans la sortie capturée (seulement des points de progression et
une note déjà présente dans le dépôt, « capture non prise, voir le README », qui n'est pas une
régression de ce lot) — quand la limite de 35 min a coupé le processus (`ECONNRESET` final :
le serveur de test interrompu, pas un test qui a échoué). Même situation que la session
précédente l'a déjà rencontrée et documentée (`fe167a62f`,
« CI=1 pnpm verify:full, et pourquoi il n'a pas fini ») : la suite e2e complète dépasse,
seule, le budget d'un lot. `pnpm verify` (sans `test:e2e`) reste la mesure fiable à ce budget.
