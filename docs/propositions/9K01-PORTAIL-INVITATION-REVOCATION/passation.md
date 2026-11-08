# 9K01-PORTAIL-INVITATION-REVOCATION — passation

## État : LIVRÉ, avec un résidu NOMMÉ (voir « Ce qui n'est pas fait »)

Budget de 120 min. T0 = 09:28 (Pacific/Noumea). Commits livrés, du plus ancien au plus récent :

1. `7323b7daa` — points 2, 3, 4 : identité cross-société à l'invitation, révocation immédiate.
2. `eaa2c8b99` — point 5 : captures 375/1280px des trois issues cross-société.
3. `c7d9c7406` — point 6 : D233, l'arbitrage.

## Mesure (point 1)

- `inviterClientAuPortail` (`lib/auth/lien-d-acces.ts:576-731` avant ce lot) : trouve l'identité
  par courriel (`avecDesignationAuth`, cross-société par construction, c'est une table
  d'authentification), puis appelle `roleDansLaSocieteActive(contexteAdmin, …)` — qui ne lit QUE
  la société active (RLS, forme « société », I1). Une identité pas encore activée d'une AUTRE
  société passait ce contrôle sans bruit : `roleInterne` valait `null` (aucune ligne
  `utilisateur_societe` dans la société active), le rattachement `utilisateur_client` se posait,
  et comme `compte.mot_de_passe` était `null`, un NOUVEAU jeton de premier accès était émis et
  rendu à l'administrateur — c'est exactement C1 de l'étude.
- `roleDansLaSocieteActive` (`lien-d-acces.ts:368-381`) : lit `utilisateurSociete` sous
  `avecSociete(client, societeId)` — RLS filtre à LA société passée, jamais une autre. Ne convient
  PAS tel quel pour une lecture cross-société : il faudrait lui passer la société de l'ailleurs,
  qu'on ne connaît justement pas sans la lire (c'est tout le problème).
- `identiteExclusiveALaSociete` (`lien-d-acces.ts:415-438`, D226) : SEULE fonction `SECURITY
  DEFINER` du dépôt, autorisée nommément. Lit, sous `row_security = off` (fail-closed si le rôle
  n'est pas le propriétaire), l'EXISTENCE d'une ligne `utilisateur_societe` OU `utilisateur_client`
  pour une société AUTRE que l'active, et ne rend qu'un booléen — jamais laquelle des deux tables a
  répondu, jamais le nom de l'autre société. **Convient tel quel pour (b)** (refuser un compte pas
  encore activé connu ailleurs, qu'il soit employé ou client là-bas) ; **ne convient PAS pour
  distinguer (c)** d'un compte déjà actif connu ailleurs (voir « Ce qui n'est pas fait »).
- Révocation (`revoquerAccesPortailClient`, avant ce lot) : un seul `updateMany` posait
  `actif = false` sur `UtilisateurClient`. Aucune lecture de `session`, aucune fermeture.
  `rattachementsDuCompte` (`lib/portail/depot.ts:58-73`) filtre déjà `actif: true` — les portes
  `contacts`/`demandes` (`app/api/portail/{contacts,demandes}/contexte.ts`) le relisent à chaque
  requête et étaient donc DÉJÀ protégées. **Seule `/api/portail/tarifs` ne l'est pas** (voir
  ci-dessous, et pourquoi je n'y ai PAS touché).
- Table `session` (Better Auth) : clé par `token`, colonne `utilisateur_id`. Politique RLS
  `session_fermeture` (migration `20260908090000_categorie3_cloisonnee_l1_02d`) accepte, en
  SUPPRESSION, `token = app.authentification_jeton_session` **OU**
  `utilisateur_id = app.utilisateur_id` (PAS la variable `app.authentification_utilisateur_id` de
  `avecDesignationAuth` — deux variables différentes). `avecDesignationAuth` ne reconnaît QUE le
  jeton pour ce modèle (`CLES_DESIGNATION.session.ou`, `lib/auth/lecture-identite.ts:178-190`) :
  supprimer par `utilisateur_id` exige donc de poser `app.utilisateur_id` à la main, exactement
  comme `fermerLesAutresSessions` (`lib/auth/mon-compte.ts:131-158`) le fait déjà pour une autre
  raison. **Première tentative fausse** : j'ai d'abord appelé
  `avecDesignationAuth(client).session.deleteMany({where: {utilisateur_id}})` — zéro ligne
  supprimée (RLS ne voit rien sans la bonne variable posée), repéré par l'épreuve d'isolation
  elle-même avant tout commit.
- `obtenirSession` (`lib/auth/session.ts:81-…`) relit `getSession` de Better Auth à CHAQUE appel ;
  `lib/auth/config.ts` ne pose aucun `cookieCache`. Une session détruite est donc invisible dès la
  requête suivante, sans délai de cache à craindre.

## Point 2+3 — L'identité cross-société à l'invitation (C1)

`inviterClientAuPortail` lit maintenant, pour une identité EXISTANTE (après le refus inchangé du
compte interne de la société active) :

1. `identiteExclusiveALaSociete` — si vrai (identité connue seulement d'ici, ou nouvelle), rien ne
   change : chemin inchangé.
2. Si faux (connue ailleurs), lit `compte.mot_de_passe` (déjà lu par désignation, sans filtre de
   société, comme le fait déjà `preparerLienDAcces` pour le chemin interne) :
   - posé → **(a)** accepté, `dejaActif: true`, rattachement posé, aucun jeton — quelle que soit
     la société où le mot de passe a été posé ;
   - absent (ou aucune ligne `compte`) → refus NOMMÉ `compte_connu_autre_societe`, AVANT tout
     rattachement et tout jeton.

Nouvelle clé `clients.acces.refus.compte_connu_autre_societe` (`lib/i18n/fr.ts`, dans le bloc
existant des clés d'accès portail, comme demandé). Le composant d'écran
(`formulaire-invitation-portail.tsx`) n'a PAS bougé : il lit déjà `clients.acces.refus.${motif}`
par nom, avec repli sur `clients.acces.refus.erreur` — une clé neuve suffit.

## Point 4 — Révocation immédiate (I1)

`revoquerAccesPortailClient` lit maintenant, APRÈS avoir basculé `actif = false` : l'identité
tient-elle encore, DANS LA SOCIÉTÉ QUI RÉVOQUE (jamais ailleurs — I1), un autre rattachement
`UtilisateurClient` actif OU une ligne `UtilisateurSociete` ? Si non, toutes ses sessions sont
détruites dans la foulée (pattern de `mon-compte.ts`, voir mesure). Si oui (second rattachement
dans la même société, ou accès conservé ailleurs), la session n'est PAS détruite — ce que décrit
la décision est déjà tenu par les portes existantes (`rattachementsDuCompte`, filtrée `actif`).

**Je n'ai PAS touché `/api/portail/tarifs` — décision prise en cours de route, à relire.** Mon
premier réflexe était d'y ajouter la même vérification que `contacts`/`demandes`
(`rattachementsDuCompte`). `tests/isolation/9j20-portail-tarifs.test.ts` porte un gardien STATIQUE
explicite — « la porte elle-même ne résout aucun rattachement » — qui aurait rougi : lire
`rattachementsDuCompte` ou citer `clientId` dans `app/api/portail/tarifs/contexte.ts` y est
interdit nommément (décision du pilote du 29/10/2026, D232). J'ai donc reverté cette édition.
En y réfléchissant, ce n'était de toute façon pas nécessaire : le barème ne dépend que de la
société active sur la SESSION, et la révocation ci-dessus détruit la session dès que l'identité
perd tout accès à la société — donc `obtenirSession` rend `null` à la requête suivante, sur
`/api/portail/tarifs` comme partout ailleurs. Le cas qui resterait ouvert — un compte qui garde un
AUTRE rattachement actif dans la MÊME société — voit alors légitimement le barème, qui est un prix
de vente de la société, pas d'un client (D232) : ce n'est pas une fuite.

## Point 5 — Captures

`tests/e2e/captures-9k01-portail-invitation-revocation.spec.ts`, APRÈS seulement (les trois
scénarios n'existaient pas avant ce lot). Société CODIMA-EU choisie comme « société B » pour ne
jamais se confondre avec CODIMA-NC, société active de `COMPTE_ADMIN_SOCIETE_EPREUVE`. Trois
identités jetables, posées puis nettoyées de façon idempotente (comme 9J21) :
`9k01-client-actif-eu@codima.test` (compte client de B, mot de passe posé — (a)),
`9k01-client-attente-eu@codima.test` (compte client de B, sans mot de passe — (b)),
`9k01-employe-eu@codima.test` (ligne `UtilisateurSociete` sur B, aucun compte — (c)). Six captures
dans `docs/propositions/9K01-PORTAIL-INVITATION-REVOCATION/captures/`, 375 et 1280 px :
`apres-refus-connu-autre-societe-en-attente-*`, `apres-refus-connu-autre-societe-employe-*`,
`apres-accepte-client-actif-autre-societe-*`.

## Point 6 — L'arbitrage

D233 (`docs/arbitrages.md`), verbatim d'Alexis du 08/11 ~09:00 : la règle (a)/(b)/(c), la
révocation immédiate, ET le résidu assumé ci-dessous, avec sa condition de réouverture explicite.

## Ce qui n'est PAS fait — à lire avant de croire (c) complètement fermé

**(c) ne porte pas son propre motif.** La décision distingue un employé d'une autre société (refus
toujours) d'un client d'une autre société déjà actif (accepté). `identiteExclusiveALaSociete`
(D226) ne rend qu'un booléen : elle dit « connue ailleurs », jamais PAR QUELLE table — c'est
EXACTEMENT ce que D226 a borné (`SET row_security = off`, un seul résultat, aucun nom qui fuit).
Pour un compte PAS ENCORE ACTIVÉ, cette limite ne coûte rien : (b) et (c) refusent tous les deux,
avec le même message, et le code est correct. Pour un compte DÉJÀ ACTIF (mot de passe posé) qui se
trouve être un EMPLOYÉ d'une autre société plutôt qu'un client, le code l'accepte (branche (a)) —
ce n'est PAS une régression (le code d'avant ce lot l'acceptait déjà, sans même consulter
`identiteExclusiveALaSociete`), mais ce n'est pas non plus ce que (c) demande au sens strict.
Fermer complètement ce résidu demande une seconde fonction `SECURITY DEFINER` (sur le modèle de
D226, pour distinguer la table qui a répondu) — une migration, hors du mandat « aucune migration »
de ce lot. D233 nomme ce résidu et sa condition de réouverture ; je ne l'ai pas contourné par un
raccourci applicatif (relire `utilisateur_societe` d'une autre société en posant `app.societe_id`
à la main aurait recréé, en code, exactement le trou que D226 a fermé en base).

## Vérification

`pnpm format`, `pnpm typecheck`, `pnpm lint`, `pnpm test` (5541 tests), `pnpm test:isolation`
(1951 tests, dont les 6 nouveaux scénarios de ce lot) — tous verts après chaque commit.
`verify:full` est laissé à la file, comme demandé.

## Reprise 9K01A (08/11)

9K01 est parti le 08/11 09:28 de `4d9e8e888`, recalé à tort : `-verify-2.txt` ne porte AUCUN échec
hors `tests/e2e/planning-5.spec.ts:198` (lundi de Pâques 2027, jour férié lu en base — sans rapport
avec ce lot), corrigé entre-temps par `9K00-E2E-PLANNING5-FERIE`. Les autres lignes `stderr`
relevées dans cette trace (erreurs RLS, « Reset password isn't enabled », violations de politique
sur `utilisateur`) appartiennent à des tests qui vérifient volontairement un comportement
fail-closed ou fail-safe et sont passés — ce ne sont pas des échecs.

Les 4 commits de la garde `9K01-PORTAIL-INVITATION-REVOCATION-garde` (`7323b7daa`, `eaa2c8b99`,
`c7d9c7406`, `d43a135a5`) ont été reportés par cherry-pick, sans modification, sur une branche
`9K01A-REPRISE-9K01` partant d'`origin/main` (`7246d3e7d`, qui porte déjà 9K00). Aucun conflit.

Rejoués au premier plan : `pnpm test:isolation` (227 fichiers, 1951 tests, vert) ;
`CI=1 pnpm exec playwright test --workers=1 tests/e2e/planning-5.spec.ts` (1 passed) ;
`CI=1 pnpm verify` (vert, code de sortie 0, build compris).
