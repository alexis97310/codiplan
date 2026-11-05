# 9J02-PORTAIL-INVITATION-LIEN — passation (Reprise 9J02A)

Budget : T0 09:59 (Pacific/Noumea), limite 150 min. Code neuf terminé avant T0+100.

## Reprise 9J02A, et pourquoi

9J02 (04/11/2026) s'était arrêté avant d'écrire une ligne de code, sur une contradiction mesurée : son point 2
adossait l'invitation à `gerer_client_site` (D130 — ADV compris), mais inviter un client ouvre souvent une
identité `utilisateur` neuve, et l'écriture sur cette table est gardée EN BASE par `utilisateur_ouverture`
(`app_peut_administrer_identites()`) — admin_societe et direction, et eux seuls (D37/D199). Un ADV aurait
franchi la porte applicative puis buté sur un refus RLS silencieux. Alexis a tranché le 05/11/2026 vers 08:40 :
**« Admin et direction »** — l'ADV ne peut pas inviter.

## LA DÉCISION D230 (`docs/arbitrages.md`)

L'invitation et la révocation d'un accès portail relèvent d'`administrer_utilisateurs`, comme toute ouverture
d'identité du dépôt (technicien, compte de bureau, amorçage) — **jamais** `gerer_client_site` (D130). Zéro
migration, zéro politique RLS touchée : la garde applicative et la garde de base disaient déjà la même chose,
il suffisait de les faire parler l'une à l'autre.

## Mesure (point 1 du ticket)

`lib/auth/lien-d-acces.ts` portait déjà `preparerLienDAcces`/`copierLienDAccesPartage` pour les comptes
INTERNES (technicien, bureau) — identité déjà existante, `requestPasswordReset` réutilisé. Pour un client,
l'identité n'existe souvent PAS encore, et D96 (11/09/2026) pose quatre exigences tenues par la BASE : usage
unique, durée limitée, révocable, tracé. Décision d'architecture prise ici (laissée à « la session » par D96
§« ce qui n'est pas tranché ») : le compte naît ACTIF immédiatement (même modèle que `ouvrirPremierCompte`,
qui pose l'habilitation AVANT que la personne choisisse un mot de passe) — le périmètre (ici : tout le client,
V1) est donc fixé à la GÉNÉRATION, jamais choisi par qui consomme le lien. La consommation elle-même est
l'écran GÉNÉRIQUE `/premier-acces` existant (D65), inchangé : il ne sait rien d'un client ni d'un site.

**Contrainte mesurée avant d'écrire : `auth.api.signUpEmail` est interdit hors de `lib/auth/amorcage.ts`**
(`tests/unit/auth/amorcage-retrait.test.ts`, condition de retrait de l'amorçage Q1/D65). L'identité et son
compte au repos sont donc écrits DIRECTEMENT (`avecDesignationAuth(client, administration).utilisateur.create`
puis `.compte.create`, `mot_de_passe: null`) — le gardien nomme lui-même cette voie comme sa limite connue
(« un chemin […] sans passer par `signUpEmail` […] lui échapperait »), et c'est exactement ce chemin-ci.

## Point par point

1. **`lib/auth/lien-d-acces.ts` (extension)** — `inviterClientAuPortail` (garde `administrer_utilisateurs`,
   identité désignée par courriel ou ouverte si absente, rattachement `UtilisateurClient` créé/réactivé par
   `upsert` sur `(utilisateur_id, client_id)`, jeton émis sauf si un mot de passe existe déjà — `dejaActif`),
   `revoquerAccesPortailClient` (bascule `actif = false`, I6 : jamais de suppression), `comptesDuPortailDuClient`
   (lecture pour la fiche, forme « rattachement » déjà ouverte par D92/L1-02c — aucune désignation nécessaire).
2. **Capacité** : `administrer_utilisateurs` couvre exactement `{admin_societe, direction}`
   (`lib/auth/habilitations.ts:207`) ; l'écriture d'`utilisateur` par `app_peut_administrer_identites()`
   l'accepte (même fonction que D37/D199 pour le reste du dépôt). Le bouton n'est PAS affiché à l'ADV
   (`peutAdministrerAccesPortail`, fiche client, onglet Identité) ; une requête forgée reçoit
   `{ erreur: "acces_refuse" }` (403) avant tout appel au dépôt, **et** le dépôt lui-même la refuse une
   seconde fois (`RefusInvitationClient`, défense en profondeur).
3. **Routes** : `app/api/clients/[id]/inviter/route.ts` (JSON, lien à copier, D170 — jamais de courriel,
   Resend ne peut pas écrire à qui n'est pas Alexis) ; `app/api/clients/[id]/revoquer-acces/route.ts`
   (formulaire + redirection 303, même forme que `/api/contacts/[id]/activite`).
4. **Écran** : carte « Accès portail » sur l'onglet Identité de la fiche client — liste des comptes
   (courriel, état) avec bouton « Révoquer l'accès » par ligne active, formulaire « Inviter au portail »
   (`components/clients/formulaire-invitation-portail.tsx`, client, même modèle que `BoutonCopierLien`
   9I6B/D170 — clipboard, repli en lecture seule, refus nommé).
5. **Périmètre de sites — DÉFÉRÉ** : aucun sélecteur de sites à l'invitation (toujours « tout le client »,
   convention déjà écrite au schéma : aucune ligne `UtilisateurClientSite` = tous les sites). Le ticket
   original (point 3) demandait « le périmètre de sites choisi » ; faute de budget dans cette reprise, V1
   invite sur TOUT le client. Un sélecteur de sites est un ajout, pas une correction — prochain ticket.
6. **Épreuves d'isolation** (`tests/isolation/invitation-portail-client.test.ts`, 10 scénarios) : ouverture
   d'identité + rattachement actif + jeton + trace (admin_societe ET direction, D199) ; client introuvable ;
   ADV refusé avant toute écriture (requête forgée) ; seconde invitation pour le même client RÉACTIVE plutôt
   que dupliquer (contrainte unique) ; identité déjà servie → accès immédiat sans jeton (`dejaActif`) ;
   lecture pour la fiche ; révocation bascule `actif=false`, le compte ne lit plus son rattachement (D92,
   `rattachementsDuCompte`), jamais de suppression ; identifiant inconnu ; ADV refusé en révocation aussi.
   `pnpm test:isolation` intégral joué une fois : 1843/1843 vert.
7. **Captures** 375/1280 px, AVANT (worktree sur `f34b423fa`, carte absente, rouge attendu aux assertions
   — capture prise avant) / APRÈS (ce lot : carte visible pour admin_societe avec un compte actif et un
   compte révoqué, absente pour adv), `docs/etudes/equipe-2026-10-29/tickets/9J02-captures/`.
8. **Registre** : D230 ajoutée en fin de `docs/arbitrages.md` (après D229).
9. **Feuille de route** (`lib/feuille-de-route/contenu.ts`) : l'élément « Portail client (9J02 à 9J08, 9J20) »
   passe de `pret` à `en_cours` — seule l'invitation est livrée, le reste du groupe (contacts, demande,
   fiche machine, interventions, bon, barème) reste à écrire.

## Ce qui reste à faire (prochains tickets)

1. **Sélecteur de sites à l'invitation** — restreindre le périmètre plutôt que « tout le client » (point 5
   ci-dessus).
2. **9J03 à 9J08, 9J20** — le reste du portail client, nommés par la feuille de route.
3. **Le chemin `/arrivee → /portail` reste à construire** (constat mesuré, hors territoire de ce lot) :
   `ContexteSession.clientId` est forcé `null` dans `lib/auth/session.ts` (commentaire explicite, « le chemin
   du portail reste à construire ») — un compte client qui vient de choisir son mot de passe atterrit sur
   `/arrivee` sans lien automatique vers `/portail` ; `/portail/page.tsx` fonctionne déjà si on lui tape
   l'URL (elle relit `utilisateur_client` elle-même). Pas une régression de ce lot — un gap préexistant,
   documenté ici pour qu'il ne se perde pas.

## Vérification jouée

`CI=1 pnpm verify` (pas `verify:full` — la file de nuit la joue). `pnpm test:isolation` intégral joué une
fois séparément (1843/1843) après les écritures touchant `utilisateur`/`utilisateur_client`/`compte`.

---

## Reprise 9J02B, et ce qu'elle a trouvé

Repris de `9J02A-REPRISE-9J02-garde` (7 commits, cherry-pickés tels quels sur `origin/main` à `86131f57c`,
aucun conflit). Seul échec mesuré par 9J02A, deux fois : `tests/e2e/captures-9j02a-acces-portail.spec.ts:141`
— « à 1280px › capture […] (admin_societe) » — `getByRole('heading', { name: 'Accès portail' })`
introuvable ; la même capture à 375px passait.

**Mesure** : `CI=1 pnpm exec playwright test tests/e2e/captures-9j02a-acces-portail.spec.ts --workers=1`
reproduit l'échec exactement — mais `error-context.md` de l'échec montre la page `/clients` (la LISTE), pas
`/clients/{id}`. La fiche client n'était jamais ouverte.

**Cause, pas celle devinée au ticket** (ni état partagé entre épreuves, ni carte absente à 1280px, ni ordre
`serial` en cause) : le `beforeAll` du spec posait `clientId` **seulement si `CAPTURES_9J02A` était défini** —
exactement la même garde que l'écriture des fichiers PNG eux-mêmes :

```ts
test.beforeAll(async () => {
  if (DOSSIER === "") return;        // ← la fixture entière derrière la garde
  clientId = await clientDeLEpreuve();
});
```

`pnpm test:e2e` et `verify:full` ne positionnent jamais `CAPTURES_9J02A` (cette variable ne sert qu'aux
lancements manuels qui produisent de vraies captures). `clientId` reste donc `""`, et
`page.goto('/clients/?onglet=identite')` atterrit sur la liste des clients — la carte n'y a jamais existé. Le
mode `serial` du fichier arrête la suite au premier rouge : c'est pour ça que les deux mesures de 9J02A
comptaient « 1 failed, 3 did not run » (jamais exécutées, donc jamais vues comme un deuxième échec) plutôt que
quatre échecs distincts — la phrase « la même capture à 375px passe » du ticket de reprise venait en réalité
du lancement MANUEL antérieur (point 6, avec `CAPTURES_9J02A` posé), pas de `verify:full`.

**Tous les autres fichiers de capture du dépôt posent leur fixture sans condition** et ne gardent que
l'écriture du PNG derrière la variable (vérifié sur `captures-9ah-gr14-prestations-sites.spec.ts` : le
`beforeAll` qui crée client/site/prestation n'a aucune garde `DOSSIER`). Ce spec s'en écartait seul — un
défaut de l'ÉPREUVE, pas de l'écran. Les captures déjà commitées par 9J02A
(`docs/etudes/equipe-2026-10-29/tickets/9J02-captures/apres/admin-acces-portail-{1280,375}.png`) le confirment :
la carte « Accès portail » s'affiche correctement aux deux largeurs, avec un compte actif et un compte révoqué
visibles — l'écran n'a jamais eu de défaut.

**Correction** : `clientDeLEpreuve()` s'exécute désormais sans condition dans `beforeAll`, alignée sur le
patron du reste du dépôt. Rejoué `--repeat-each=2` : 8/8 vert (deux passages complets, idempotent — la
fonction supprime déjà les lignes des deux courriels d'épreuve avant de les recréer).

**Vérification jouée** : fichier seul (×1 puis `--repeat-each=2`, 8/8) ; `pnpm test:isolation` intégral,
213 fichiers / 1849 tests, vert ; `pnpm test`, 499 fichiers / 5497 tests, vert ; `CI=1 pnpm verify`
(format:check + typecheck + lint + test + test:isolation + build), vert de bout en bout. Aucune autre épreuve
e2e ne touche `inviterClientAuPortail`/`revoquerAccesPortailClient` (recherche confirmée, un seul fichier de
capture les exerce). `pnpm verify:full` n'a pas été rejoué ici — la file de nuit le fait.

**Portée** : un seul fichier modifié (`tests/e2e/captures-9j02a-acces-portail.spec.ts`, une ligne retirée),
aucune ligne de production touchée, aucune migration, rien hors territoire de la reprise.
