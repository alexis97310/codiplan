# 9L04-PORTAIL-INVITATION-EN-ATTENTE — passation

Décision d'Alexis du 10/11/2026 : le rattachement d'un compte déjà existant au parc d'un client
reste EN ATTENTE tant que son titulaire ne l'a pas accepté explicitement. Un seul message de refus
neutre couvre désormais tous les cas « adresse connue ailleurs ». Écrite en entier :
`docs/arbitrages.md` D249 (revient sur D233).

## MIGRATION À JOUER par Alexis : staging puis DB migrate & seed, puis Vercel

**Nom exact** : `20261113073000_rattachement_client_en_attente_9l04`. Additive, deux colonnes
nullables sur `utilisateur_client` (`accepte_le`, `nom_client_invitation`), avec reprise explicite
des lignes déjà en base (posées à `accepte_le = now()` — aucun accès existant n'est retiré par cette
migration). `pnpm db:deploy` l'applique sans réécrire aucune migration déjà jouée.

## Ce que ce ticket fait

1. **Schéma, forme la plus simple compatible avec les politiques RLS existantes.** `accepte_le`
   (`timestamptz`, nullable) porte l'acceptation. `nom_client_invitation` (texte, nullable) est un
   CLICHÉ du nom du client, posé par l'administrateur à la création d'un rattachement EN ATTENTE —
   **jamais une lecture de `client`** : ce dernier reste de forme « parc » (D10/D22) sans aucune
   politique nouvelle, et désigner le client pour lire son nom aurait ouvert tout son parc avant
   l'acceptation. Le nom de la SOCIÉTÉ, lui, reste lu en direct (la forme « adhésion », D67/D92, ne
   borne déjà sa clause qu'à `actif`, qu'une ligne en attente porte toujours). Le compromis assumé :
   le cliché peut devenir faux si le client est renommé avant l'acceptation — fenêtre courte, enjeu un
   seul libellé d'écran, voir l'en-tête de la migration et le point 5 de D249.

2. **`inviterClientAuPortail` (`lib/auth/lien-d-acces.ts`), réécrite.**
   - Identité NOUVELLE : inchangé — lien de premier accès, `accepte_le` posé dès la création (le
     premier accès vaut acceptation, D96).
   - Identité DÉJÀ OUVERTE (peu importe qu'elle ait déjà un mot de passe ou non, peu importe la
     société) : rattachement créé EN ATTENTE (`accepte_le: null`), **aucun jeton émis**. Le motif
     `compte_connu_ailleurs` remplace l'ancien `compte_connu_autre_societe` ET l'usage de
     `compte_interne` pour un employé déjà actif d'une autre société — un seul message neutre.
     `compte_interne` reste réservé au cas LOCAL (employé de la société ACTIVE), qui n'est pas le
     secret d'une autre société.
   - Réactivation (même client, upsert) : `accepte_le`/`nom_client_invitation` ne sont jamais
     retouchés — un rattachement déjà accepté une fois ne redemande rien.

3. **Une ligne non acceptée n'ouvre AUCUN accès.** `rattachementsDuCompte`
   (`lib/portail/depot.ts`) et `lireRole`/`habilitationsDuCompte`
   (`lib/auth/societe-active.ts`) filtrent désormais `accepte_le: { not: null }` : impossible de lire
   le parc, impossible de choisir cette société comme active, tant que ce n'est pas accepté.

4. **L'écran d'arrivée montre les invitations en attente, avant tout le reste.**
   `app/(apres-session)/arrivee/page.tsx` lit `rattachementsEnAttenteDuCompte`
   (`lib/auth/lien-d-acces.ts`) et, si la liste n'est pas vide, N'AUTO-REDIRIGE PAS vers le portail ou
   le planning même pour une société unique — le titulaire voit « <Société> vous donne accès au parc
   de <Client> », Accepter/Refuser (composition par morceaux, jamais d'interpolation dans `t()`, §5).
   Deux routes neuves, self-service, SANS capacité (identité prise de la session, filtrée par
   `utilisateur_id` ET `accepte_le: null` dans `accepterRattachementClient`/
   `refuserRattachementClient`) : `app/api/session/rattachements/[id]/accepter` et `.../refuser`.
   Exemptées nommément dans `tests/unit/auth/porte.test.ts` (D-12) — ce n'est pas un acte
   d'administration, c'est la personne qui répond pour elle-même.

5. **Fiche client, carte « Accès portail ».** `CompteDuPortailClient.enAttente` (vrai si `actif` et
   `accepte_le` nul) affiche « En attente d'acceptation » à la place d'« Accès actif », et masque
   « Copier un nouveau lien » (9K14) — aucun mot de passe à réinitialiser avant acceptation.

6. **`new Date()` évité partout ailleurs.** `accepte_le` est un INSTANT d'audit, jamais une date
   calendaire — `lib/auth/instant-acceptation.ts` (créé) en est le point de passage unique,
   exempté nommément dans `tests/unit/calendar/sans-date-courante-implicite.test.ts`, MÊME
   raisonnement que `lib/db/uuid.ts` (I10). `prisma/seed.ts` l'utilise aussi : le compte portail de
   démonstration doit rester ACCEPTÉ, sans quoi la fiche client l'affichait « en attente
   d'acceptation » à tort (mesuré, corrigé avant de livrer).

## CE QUE CE TICKET NE FAIT PAS, SIGNALÉ PLUTÔT QUE TRANCHÉ SEUL

**Aucune fonction `SECURITY DEFINER` ni politique RLS nouvelle n'a été ajoutée sur `client`** pour
lire son nom en direct. L'alternative existait (une forme « rattachement » de plus sur `client`,
symétrique de D92, ou une fonction bornée à `app.utilisateur_id`) ; le cliché (point 1 ci-dessus) a
été préféré parce qu'il ne touche à AUCUNE politique existante et n'allonge pas la liste fermée des
treize formes de I1. Condition de réouverture écrite dans D249 : si un écran futur a besoin du nom
RÉEL (pas un cliché) d'un client avant acceptation, cette décision se relit.

**Un compte dont l'identité a été ouverte mais qui n'a ENCORE JAMAIS choisi de mot de passe, invité
une seconde fois (à un autre client) avant d'avoir activé le premier, n'a plus aucun moyen de se
connecter par ce second geste** : avant ce ticket, une réémission de lien lui donnait un second
chemin ; D249 ne distingue plus ce cas et ne lui envoie plus rien. Le PREMIER lien (de la toute
première invitation) reste valable une heure puis expire, comme avant — l'administrateur peut
toujours réinviter pour le réémettre. Résidu nommé, pas fermé : à signaler à Alexis si jugé gênant en
pratique.

## Épreuves

- **Isolation** — `tests/isolation/invitation-portail-client.test.ts` : réécrit en profondeur
  (identité nouvelle acceptée d'emblée ; identité déjà ouverte toujours en attente, avec ou sans mot
  de passe, dans la même société ou ailleurs ; réactivation sans redemander d'acceptation ; le motif
  neutre comparé OCTET POUR OCTET entre les deux scénarios « connu ailleurs » ; `comptesDuPortailDuClient.enAttente` ;
  `rattachementsEnAttenteDuCompte` isolé par identité (D92) ; `accepterRattachementClient`/
  `refuserRattachementClient`, y compris le refus `introuvable` sur une ligne d'autrui ou déjà
  traitée). `tests/isolation/setup/global.ts` : les cinq rattachements partagés du harnais posent
  désormais `accepte_le` — sans quoi la quasi-totalité des scénarios du dépôt échouait.
- **Bout en bout** — `tests/e2e/captures-9l04-portail-invitation-en-attente.spec.ts` (créé) :
  l'arrivée montre l'invitation avant toute redirection ; accepter mène immédiatement au portail ;
  refuser laisse la ligne inactive (vérifié en base). `tests/e2e/captures-9k01-portail-invitation-revocation.spec.ts`
  mis à jour pour D249 (motif neutre, message « en attente » au lieu d'« accès immédiat »). Quatorze
  autres specs portail, qui invitent chacune UNE identité nouvelle unique, ont subi le seul
  renommage mécanique `dejaActif` → `enAttente` (toujours `false` pour une identité nouvelle,
  comportement inchangé — vérifié un par un avant le renommage). Captures 1280/375 sous
  `docs/propositions/9L04-PORTAIL-INVITATION-EN-ATTENTE/captures/`.
- **Gardien D-12** (`tests/unit/auth/porte.test.ts`) — les deux routes neuves, exemptées nommément.
- **Gardien calendrier** (`tests/unit/calendar/sans-date-courante-implicite.test.ts`) —
  `lib/auth/instant-acceptation.ts` exempté nommément.

## `CI=1 pnpm verify` — jouée au complet, vert

`format:check`, `typecheck`, `lint`, `test` (5774 tests), `test:isolation` (2198 tests) et `build` :
vert de bout en bout.

## Non joué par moi

`verify:full` (feries:horizon, audit:partitions, test:e2e au complet) — laissé à la file, comme
demandé. Seuls les specs e2e directement concernés par ce ticket ont été rejoués ci-dessus, au
premier plan.

## Reprise 9L03B (13/11/2026) — « lien gardé »

9L04 a été recalé deux fois à sa livraison, sur les MÊMES deux scènes (`tickets/recales/9L04-PORTAIL-INVITATION-EN-ATTENTE.md`) : « Copier un nouveau lien » (9K14) disparaissait de la ligne d'un compte invité jamais activé, et le texte confirmant un lien copié (9J21) n'apparaissait plus après l'invitation. Décision d'Alexis du 13/11/2026 : écrite en entier, `docs/arbitrages.md` D250 (amende D249).

**Le critère.** Une identité EXISTANTE qui n'a JAMAIS choisi de mot de passe (`compte.mot_de_passe IS NULL`), et EXCLUSIVE à la société active (D226), reste traitée comme une identité NEUVE — qu'elle soit invitée pour la première fois ou pour un second client de la MÊME société : elle garde (ou regagne) son lien de premier accès, `accepte_le` est posée dès la création, et « Copier un nouveau lien » (9K14) reste proposé sur sa ligne. Une identité DÉJÀ ACTIVÉE (un mot de passe existe, quelle que soit la société) reste EN ATTENTE sans jeton — D249 inchangée sur ce point. Le refus neutre `compte_connu_ailleurs` pour une identité jamais activée connue d'une AUTRE société (non exclusive) est inchangé : mesuré, ce cas ne distingue toujours rien de plus qu'avant (D226/9K04).

**`inviterClientAuPortail` (`lib/auth/lien-d-acces.ts`).** Le compte au repos de l'identité trouvée est désormais lu une seule fois (`compteExistant`), avant la garde d'exclusivité — réutilisé par le refus `compte_connu_ailleurs` existant ET par le nouveau critère `jamaisActivee` (posé seulement dans la branche EXCLUSIVE). `traiterCommeNeuve = identiteOuverteIci || jamaisActivee` pilote désormais `accepte_le`/`nom_client_invitation` à la création, l'émission du jeton, et la trace (`detailCopie`, réutilisée : « premier envoi » pour une identité ouverte ICI, « réémission » pour une identité jamais activée déjà ouverte).

**`comptesDuPortailDuClient` (lecture).** `enAttente` ne se lit plus sur la seule colonne `accepte_le` : une ligne `actif`, sans acceptation, N'EST « en attente » QUE si un mot de passe existe déjà pour cette identité (lu par désignation, `compte.findFirst`, sur les seules lignes qui en ont besoin). Sans ce correctif, une ligne jamais activée posée directement en base (hors `inviterClientAuPortail` — exactement le cas de la scène 9K14) resterait affichée « en attente » à tort.

**La cause du second recalage (9J21) — un résidu de nettoyage, sans lien avec le critère lui-même.** La scène D de `captures-9j21-finitions-invitation.spec.ts` connecte le compte client de l'épreuve, ce qui fait basculer sa société active EN SE CONNECTANT (`basculerSociete`, `lib/auth/societe-active.ts`) — et cette bascule journalise EN SON PROPRE NOM. Un passage précédent laissait donc une ligne `journal_acces` derrière lui (`utilisateur_id` = l'identité de la scène, jamais nettoyée par aucun `afterAll`), et le nettoyage idempotent de `preparerLaScene` (son `beforeAll`) violait `journal_acces_utilisateur_id_fkey` au passage suivant en tentant de supprimer `utilisateur` avant `journal_acces` — faisant échouer `beforeAll`, et donc TOUTES les scènes du fichier, y compris celle (A) qui n'a rien à voir avec le critère. Purger `journal_acces` d'abord (par la relation `utilisateur.email`) referme ce résidu. Mesuré : aucun autre fichier e2e ne connecte lui-même l'identité qu'il supprime ensuite (seul `captures-9ia1-second-facteur-exclusivite.spec.ts` fait déjà ce nettoyage, et dans le bon ordre) — le défaut était localisé à ce seul fichier.

**Épreuves.** `tests/isolation/invitation-portail-client.test.ts` : le test devenu faux (« une identité déjà ouverte, invitée à un second client, entre EN ATTENTE elle aussi — même sans mot de passe nulle part ») est réécrit pour affirmer le NOUVEAU comportement ; un second test couvre la lecture (`comptesDuPortailDuClient`, ligne jamais activée posée directement en base → `enAttente: false`). `tests/e2e/captures-9l03b-reprise-portail-invitation.spec.ts` (créé) : scène dédiée posant une ligne EN ATTENTE et une ligne JAMAIS ACTIVÉE sur le MÊME client, capturée en 375/1280px (`docs/propositions/9L04-PORTAIL-INVITATION-EN-ATTENTE/captures/apres-acces-portail-en-attente-et-jamais-activee-{1280,375}.png`) — les deux lignes y sont visibles côte à côte, avec et sans le bouton. Les captures « écran d'acceptation » et « arrivée en attente » de 9L04 restent celles déjà prises, inchangées par cette reprise. `docs/captures/` (exploitation générale, `scripts/captures.mts`) ne couvre aucun écran `/clients/[id]` : rien à y mettre à jour.

Rejoué au premier plan (`CI=1 --workers=1`) : les deux scènes recalées (9K14, 9J21), les e2e de 9L04, la nouvelle scène 9L03B, et `tests/e2e/tous-les-ecrans-rendent.spec.ts` — tout vert. `pnpm test` (5774 tests), `pnpm test:isolation` (2199 tests) et `CI=1 pnpm verify` rejoués au complet, vert.

**Non joué par moi** : `verify:full` (feries:horizon, audit:partitions, test:e2e au complet) — laissé à la file.
