# 9K14-PORTAIL-COPIER-NOUVEAU-LIEN — passation

## 1. Mesure (point 1)

Ce qui existait déjà, et sur quoi ce ticket s'appuie entièrement :

- `copierLienDAccesPartage(contexteAdmin, utilisateurId, libelleChemin, client,
  { nouveauLien: true })` (`lib/auth/lien-d-acces.ts`) — commun au technicien
  et au bureau depuis 9I6B/D86. Appelé avec `nouveauLien: true`, il SAUTE le
  cliquet de D65 (« déjà un mot de passe ») : la seule différence entre « premier
  lien » et « nouveau lien » est CE SEUL booléen, rien de plus.
- Conséquence mesurée : pour un compte DÉJÀ activé (mot de passe posé),
  `nouveauLien: true` est la SEULE façon de recopier un lien (sans lui, le
  geste refuse `deja_un_mot_de_passe`). Pour un compte JAMAIS activé (mot de
  passe encore `null`), `nouveauLien: true` ne change rien d'observable : le
  cliquet n'aurait de toute façon pas refusé, et le jeton émis est identique à
  celui d'un premier lien. **Le portail suit donc la même règle que le
  bureau sans en inventer une autre** : `copierNouveauLienDAccesPortail`
  fonctionne correctement dans les deux cas, et rien ne distingue l'un de
  l'autre au niveau du domaine.
- Ce que le bureau MONTRE diffère néanmoins des deux cas : `GesteAccesBureau`
  (`app/(back-office)/parametres/equipe/page.tsx`) n'affiche le bouton
  « Copier un nouveau lien » que pour un compte `état === "actif"` (mot de
  passe posé) ; un compte encore `lien_envoyé`/`aucun` montre à la place
  « Envoyer »/« Copier le lien d'accès » (premier lien). **Le portail n'a pas
  cette distinction d'état à l'écran** : `CompteDuPortailClient` ne porte que
  `actif` (le RATTACHEMENT, jamais révoqué) — il n'existe aujourd'hui aucun
  signal d'écran « mot de passe posé ou non » pour un compte du portail, et la
  fiche client n'offre déjà aucun moyen de recopier le PREMIER lien d'un
  compte invité qui ne l'aurait pas reçu (seule une ré-invitation par courriel
  le fait, en réactivant la ligne). **Décision prise pour ce lot** : le
  bouton « Copier un nouveau lien » est affiché pour CHAQUE compte dont le
  rattachement est actif, sans distinguer les deux cas — il devient, de fait,
  le seul recours pour recopier n'importe quel lien perdu (premier ou nouveau)
  d'un compte non révoqué. Fonctionnellement sûr (D223/D226 appliquées dans
  les deux cas, voir plus bas) ; à confirmer par Alexis si une distinction
  d'écran était en réalité voulue — hors territoire de ce lot sans elle
  (`CompteDuPortailClient` n'expose pas aujourd'hui `compte.mot_de_passe`, et
  l'ajouter aurait dépassé le périmètre d'un bouton).

## 2. Domaine (point 2)

`copierNouveauLienDAccesPortail(contexteAdmin, clientId, utilisateurId, client)`
(`lib/auth/lien-d-acces.ts`, à côté de `inviterClientAuPortail`) — réutilise
`copierLienDAccesPartage`, jamais dupliqué. Ordre des contrôles, chacun avec
son motif :

1. capacité `administrer_utilisateurs` (défense en profondeur, D230,
   `exigerCapaciteInvitationClient`, déjà partagée avec l'invitation et la
   révocation) ;
2. rattachement de CE compte à CE client, dans la société active
   (`utilisateurClient.findFirst` sous `avecSociete` — la forme RLS filtre
   déjà toute autre société, donc un couple `clientId`/`utilisateurId`
   d'une autre société ne rend RIEN, sans distinction d'un couple simplement
   mal assorti) → `introuvable` sinon, sans rien dire de plus ;
3. rattachement ACTIF → `revoque` sinon (un compte révoqué se RÉ-INVITE, il
   ne reçoit pas de nouveau lien) ;
4. exclusivité D226 (`identiteExclusiveALaSociete`, fail-closed comme 9I8D2)
   → `autre_societe` sinon.

**Aucune « cible protégée » (D223) ici** : un compte du portail ne porte
jamais `direction` ni `admin_societe` (rôles de `utilisateur_societe` seule,
jamais de `utilisateur_client`) — D223 apporte à ce geste sa DISCIPLINE
(capacité puis D226), pas une liste de rôles à recopier. Documenté dans la
JSDoc de la fonction pour qu'un futur lecteur ne cherche pas un motif
`cible_protegee` qui n'existe pas côté portail.

`CompteDuPortailClient` (même fichier) gagne `utilisateurId` — `id` ne
portait que le rattachement (`UtilisateurClient.id`, nécessaire à la
révocation), jamais l'identité ; la nouvelle route a besoin des DEUX.

## 3. Route et écran (point 3-4)

`POST /api/clients/[id]/comptes/[utilisateurId]/copier-nouveau-lien` — même
forme que `app/api/equipe/bureau/[id]/copier-nouveau-lien/route.ts` : porte
`administrer_utilisateurs` d'abord (403 nommé `acces_refuse` sinon), UUID
validés (`z.uuid()`, refus `introuvable` sinon — jamais une page 500 pour un
identifiant malformé), `Cache-Control: no-store` sur toute réponse
(`reponseLienCopie`, déjà partagée par les quatre routes équipe), l'URL
rendue en JSON, jamais en redirection.

Écran : `BoutonCopierLien` (`components/equipe/bouton-copier-lien.tsx`) est
RÉUTILISÉ tel quel sur chaque ligne ACTIVE de la carte « Accès portail »
(`app/(back-office)/clients/[id]/page.tsx`) plutôt que d'être recopié —
seul ajout, un prop `libelle` optionnel (`CleTraduction`, défaut
`"equipe.acces.copier_lien"` inchangé pour technicien et bureau) pour que le
portail nomme son geste « Copier un nouveau lien »
(`clients.acces.copier_nouveau_lien`), distinct du PREMIER lien. La carte
entière reste gardée par `peutAdministrerAccesPortail` (inchangé) : un ADV ne
voit ni la carte ni le bouton, pas seulement le bouton seul.

## 4. Épreuves (point 5)

- **Isolation** (`tests/isolation/copier-nouveau-lien-portail.test.ts`, 9
  scénarios) : accepté + trace (« reemission_premier_acces », « lien copié
  par l'administrateur », auteur = l'administrateur jamais le compte client),
  DIRECTION accepté comme l'admin (D199), introuvable (autre client de la
  même société ; client ET compte d'une autre société, sans rien apprendre,
  I1 ; identifiant inconnu), revoque, D226 (exclusif permis ; `autre_societe`
  refusé chez A ET chez B), requête forgée (ADV rejeté AVANT toute écriture,
  `RefusInvitationClient`).
- **Unitaire route** (`tests/unit/clients/copier-nouveau-lien-portail-route.test.ts`)
  — 403 + no-store, UUID malformé refusé sans atteindre le domaine, les DEUX
  identifiants transmis dans le bon ordre, refus nommé transmis tel quel,
  succès rend l'URL.
- **Gardien des routes** (`tests/unit/auth/porte.test.ts`) — la route neuve
  ajoutée à `ROUTE_CAPACITE` ; le compte attendu passe de 103 à 104.
- **e2e** (`tests/e2e/captures-9k14-portail-copier-nouveau-lien.spec.ts`,
  1280 et 375px, scène propre préfixée `9k14lien-`, nettoyée en
  `afterAll`) : l'administrateur voit le bouton, le clique, le lien part au
  presse-papiers (jamais affiché en clair, vérifié après rechargement) ; un
  ADV ne voit ni la carte ni le bouton. **Captures APRÈS seulement**
  (`docs/propositions/9K14-PORTAIL-COPIER-NOUVEAU-LIEN/`) — ce bouton
  n'existait pas avant ce ticket, rien à capturer « avant » (même raison que
  `captures-9k01-portail-invitation-revocation.spec.ts`).
- `tests/e2e/tous-les-ecrans-rendent.spec.ts` et les specs existantes de la
  fiche client / du portail (9j02a, 9j21, 9k01) rejoués, verts, aucune
  régression — aucun `getByText`/`getByRole` existant n'était ambigu avec
  « Copier un nouveau lien ».

## 5. Vérifié

`CI=1 pnpm verify` (format, typecheck, lint, test — 508/508 fichiers —,
test:isolation — 232/232 fichiers —, build) passe entièrement, zéro
avertissement. `verify:full` est laissé à la file de nuit, comme demandé.

## 6. Écart noté, pas tranché

Le document référencé par le ticket, `etude-0811/portail-securite.md` §5.1,
n'existe PAS dans ce dépôt (`docs/propositions/etude-0811/` est absent,
`git log --all` ne le trouve sous aucun chemin). La mention « C1, étude du
08/11 » apparaît déjà, pour mémoire, dans
`tests/isolation/invitation-portail-client.test.ts` et
`tests/e2e/captures-9k01-portail-invitation-revocation.spec.ts` — le
raisonnement qu'elle désigne (C1 : une identité partagée entre sociétés) est
donc déjà connu par ces fichiers et par D226 lui-même, et ce lot s'y est
tenu sans avoir besoin du document manquant. Signalé plutôt que supposé :
si l'étude existe ailleurs (une autre voie, un brouillon non commité), elle
n'a pas pu être consultée ici.

## 7. Git

Détaché depuis `origin/main` (worktree `codiplan-voie1`, conforme à l'état
du dépôt en début de lot). Commits atomiques par point, rebasé sur
`origin/main`, arbre propre. Jamais de push.
