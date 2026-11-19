# 9L28-PORTAIL-PHOTOS-BORNES-D236 — passation

Quatre points de code, un point de documentation. Aucune migration, aucun test existant assoupli.
Décision d'Alexis du 10/11/2026 pour l'ensemble du lot.

## Point 1 — les photos du bon, visibles au portail

`/api/documents/{id}/octets` ne tentait qu'un seul chemin, `exigerCapacite("consulter_planning")` —
or un compte portail n'a jamais cette capacité (la matrice de `lib/auth/habilitations.ts` ne la
donne qu'au bureau et au terrain). Le bon du portail affiche pourtant des photos par le MÊME `<img>`
que le bureau (`TuileCommentaires`, `components/interventions/bon-tuiles.tsx`, partagée) : chaque
photo d'un bon clôturé rendait 404 côté client.

La route tente désormais un second chemin quand le premier échoue, sous le rôle portail — même
construction de contexte que la page du bon (`contexteEtBon`,
`app/(portail)/portail/interventions/[id]/bon/page.tsx`). `lib/documents/depot.ts` gagne
`octetsDocumentDuParc`, qui ne compare rien lui-même : la politique « héritage » de `document` et la
forme « parc » de `intervention` (D84, D93) tranchent déjà le client, la société et la classe — et
cette fonction ajoute SEULEMENT une borne que la base ne tient pas, l'intervention doit être close
(`cloturee_le IS NOT NULL`), pour ne pas ouvrir une photo que le bon lui-même refuse encore
d'afficher.

Épreuve : `tests/isolation/photo-octets-portail.test.ts` — le client DE l'intervention close voit sa
photo, un autre client ne la voit pas (404), une photo de classe `interne` reste fermée, la même
photo reste lisible côté interne (témoin), et une intervention pas encore close referme la photo
même pour son propre client.

## Point 2 — bornes de taille sur les saisies du portail

Mesuré : `lib/contacts/saisie.ts` (nom, fonction, téléphone, mobile, courriel) n'avait qu'un
`.min(1)`, aucun plafond — un contact créé ou modifié depuis le portail pouvait porter un texte de
taille arbitraire. Ajouté : `NOM_MAXIMALE` (200, la borne déjà posée pour un libellé humain ailleurs
— `libelle` de `lib/sites/saisie.ts`, `RAISON_SOCIALE_LONGUEUR_MAXIMALE` de `lib/clients/saisie.ts`
— reprise plutôt que réinventée), `TELEPHONE_MAXIMALE` (40), `EMAIL_MAXIMALE` (254, la borne RFC
5321, pas un choix arbitraire).

Vérifié, déjà bornés : `lib/demandes/saisie.ts` (`description`, max 4000) — rien à ajouter côté
demandes.

Même constat sur le mot de passe, saisie de « Mon compte » (partagée par le portail,
`/api/session/mon-compte/mot-de-passe`) et du premier accès : `z.string()` nu, sans aucune borne,
haché par bcrypt quelle que soit sa taille. `LONGUEUR_MAXIMALE` (128, `lib/auth/premier-acces.ts`,
aux côtés du `LONGUEUR_MINIMALE` déjà en place) bornée désormais sur les trois champs des deux
schémas (`lib/auth/premier-acces.ts`, `lib/auth/mon-compte.ts`).

Épreuves : `tests/unit/contacts/saisie.test.ts`, `tests/unit/auth/premier-acces.test.ts` (le
« refuse » avant jeton, le « discordance » à la borne exacte), `tests/isolation/mon-compte-mot-de-
passe.test.ts` (le refus ET le témoin — la borne exacte change réellement le mot de passe).

## Point 3 — la route terrain de suspension tient D236 elle-même

Mesuré sur `app/api/terrain/[id]/suspendre/route.ts` : la route relayait le `motif` soumis par
l'appelant (l'écran envoie toujours le texte fixe, mais la route ne l'imposait pas), et
`schemaSuspension` — partagé avec le bureau, inchangé — autorise la pièce et la date ABSENTES
ensemble. Un appel direct, hors de l'écran, pouvait donc se faire passer pour une suspension libre
sans aucune pièce — exactement ce que D236 réserve au bureau.

La route exige désormais la pièce ET la date, toutes les deux, AVANT même de construire la saisie
Zod ; et elle ignore tout motif soumis par le formulaire pour y substituer systématiquement
`t("terrain.suspendre.motif_auto")`, le même texte que l'écran envoyait déjà. `schemaSuspension`
n'a pas changé — il reste celui du bureau.

Épreuve : `tests/unit/interventions/terrain-route-suspendre.test.ts`, trois cas ajoutés/révisés —
pièce et date présentes sans motif (accepté, motif fixe quand même), ni pièce ni date même avec un
motif (refus nommé), un motif libre manifestement incompatible avec une attente de pièce (accepté
mais IGNORÉ, remplacé par le texte fixe).

## Point 4 — passation 9CR, une adresse manifestement neutre

L'hôte fictif de `docs/propositions/9CR-CI-CLOISONNEMENT-CONNEXION/passation.md` suivait le format
exact d'un vrai point d'accès Neon (`ep-<id>-pooler.<région>.aws.neon.tech`). Alexis confirme qu'il
était inventé. Remplacé par `ep-exemple-pooler.exemple-region.invalid` / `ep-exemple.exemple-
region.invalid` (RFC 2606, `.invalid`) — même comportement démonstratif conservé (la terminaison
`-pooler` reste ce que `decrireConnexion` lit pour dire « mutualisé »).

## Point 5 — captures

`tests/e2e/captures-9l28-portail-bon-photos.spec.ts`, APRÈS SEULEMENT — même constat que
`captures-9j22-portail-bon-technicien-temps.spec.ts` et `captures-9k06-portail-compte-telephone.spec.ts`
pour la même page : un AVANT fidèle exigerait de rejouer le code d'avant ce ticket sous un serveur
reconstruit, deux compilations de production en plus du budget. La procédure pour qui reprend ce
point est écrite en tête du fichier.

`docs/propositions/9L28-PORTAIL-PHOTOS-BORNES-D236/captures/bon-photos-apres-375.png` et
`bon-photos-apres-1280.png` : le bon du portail, intervention close, une photo (classe `client`,
un pixel PNG valide) visible sous la tuile « Commentaires et photos ».

## Ce qui n'a pas été fait

`docs/arbitrages.md` — rien à ajouter : les quatre points tiennent des décisions déjà arrêtées
(D236, et la décision verbatim d'Alexis du 10/11/2026 pour les quatre points de ce ticket), aucune
règle du chapitre 10 ne change.
