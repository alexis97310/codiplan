# 9J03-PORTAIL-CONTACTS — passation

T0 = 17:01 (Pacific/Noumea). Budget 150 min.

## Point 1 — inventaire de ce qui existait déjà

`lib/contacts/depot.ts` et `lib/contacts/saisie.ts` sont lus EN ENTIER, et ne
sont touchés à aucun moment de ce lot (hors territoire, lecture seule).

### `schemaCreationContact` (`lib/contacts/saisie.ts`)

| Champ | Accepté | Remarque |
|---|---|---|
| `client_id` | oui, `z.uuid()` | **jamais lu du formulaire portail** — vient de `contextePortailContact()`, jamais de l'entrée (voir point 2) |
| `site_id` | oui, `z.uuid().nullable().default(null)` | facultatif ; `null` = contact du client |
| `nom` | oui, `min(1)` | requis |
| `fonction`, `telephone`, `mobile` | oui, nullable | facultatifs |
| `email` | oui, `z.email().nullable()` | requis EN PRATIQUE : `canaux` par défaut vaut `["email"]`, et CS43 (`exigerCourrielSiCanalEmail`) refuse l'absence de courriel dès que le canal `email` est demandé — ce qui est TOUJOURS le cas ici, le portail ne proposant aucun canal (un seul est implémenté) |
| `roles` | oui, `min(1)`, ensemble clos sur `ROLES_CONTACT` | requis, au moins un rôle |
| `canaux` | oui, mais **jamais soumis par le formulaire portail** | défaut `["email"]` — le seul implémenté (`CANAUX_IMPLEMENTES`) ; proposer une case à cocher pour un canal que rien ne sait servir serait le mensonge silencieux que le back-office refuse déjà |

### `schemaModificationContact`

| Champ | Accepté | Remarque |
|---|---|---|
| `client_id` | **REFUSÉ par construction** | n'existe pas dans ce schéma — un contact ne change jamais de client (décision L1-02, même raison que `site.client_id`) |
| `site_id` | oui, modifiable | contrairement au back-office (`/api/contacts/[id]/modifier` ne l'expose pas), le formulaire PORTAIL le propose : un seul formulaire par contact ici, création et rattachement compris |
| `nom`, `fonction`, `telephone`, `mobile`, `email` | oui, tous optionnels | |
| `roles` | oui, optionnel | |
| `canaux` | oui, mais **jamais soumis** | comme la création |
| `actif` | oui, mais **jamais soumis** | même décision que le back-office : la bascule d'activité est un geste séparé, non construit dans ce lot (voir Points ouverts) |

### `lib/contacts/depot.ts`

`creerContact`, `modifierContact`, `contactsDuClient`, `contactsDuSite` sont
complets et déjà appelés UNIQUEMENT par le back-office avant ce lot. La
politique RLS « parc » de `contact` (migration `20260907140000_contact_l1_03`)
porte déjà la disjonction `site_id IS NULL OR site_id = ANY(périmètre)` —
aucune migration n'est nécessaire, conformément à la note de la tâche.

**Mesuré sur le `WITH CHECK` de la politique** (ligne ~224-251 de la
migration) : il referme sur `client_id = app.client_id` ET sur
`site_id = ANY(app.perimetre_sites)` quand ces variables sont posées. Un
`site_id` hors périmètre lève donc une erreur PostgreSQL `42501`
(violation de politique RLS) — et **`motifDeLErreur` (`lib/contacts/depot.ts`)
ne la reconnaît pas** : elle ne couvre que les violations de contrainte
connues (clé étrangère, contrainte `CHECK`, courriel/canal). Hors territoire
pour corriger `depot.ts`, donc un FILET est ajouté côté route
(`app/api/portail/contacts/filet.ts`) — voir point 2.

## Point 2 — routes portail

- `app/api/portail/contacts/contexte.ts` — `contextePortailContact()`, même
  lecture que `app/(portail)/portail/page.tsx` (rôle portail, premier
  rattachement sur la société active). `motifDuRefusPortail()` — même forme
  que `motifDuRefus` (`lib/auth/porte.ts`), pour que le gardien D-12/A4b
  (`"auth.refus"` jamais en dur dans une route) reste vert.
- `app/api/portail/contacts/saisie-recue.ts` — lecture du formulaire. **`client_id`
  n'est jamais lu de la requête** : construit depuis `contextePortailContact()`.
  `versLeRetourPortail` redirige toujours vers `/portail/contacts`.
- `app/api/portail/contacts/filet.ts` — attrape le refus `42501` de la
  politique (site hors périmètre) et le convertit en redirection lisible
  (`contacts.refus.erreur_serveur`), même forme que `avecFilet`
  (`app/api/interventions/actions.ts`, SAV-02).
- `app/api/portail/contacts/creer/route.ts`,
  `app/api/portail/contacts/[id]/modifier/route.ts`.
- `tests/unit/auth/porte.test.ts` — deux exemptions D-12 ajoutées (routes du
  portail, hors matrice de capacités des rôles internes).

## Point 3 — écran `/portail/contacts`

`app/(portail)/portail/contacts/{page.tsx,presentation.ts,vue.tsx}`. Même
gabarit visuel que `/portail` (classes brutes `bg-app-surface border-app-bord
rounded-lg`, pas les composants `Carte`/`Badge` du back-office). Lecture
LARGE retenue (voir ticket) : `contactsDuClient` rend tout l'annuaire du
client, pas la seule fiche du compte connecté.

**Gap nommé — aucune entrée de menu.** `lib/navigation/entrees.ts` et
`app/(portail)/portail/page.tsx` sont hors territoire : cet écran n'est donc
atteignable que par son URL directe. Ajouter une entrée au menu plat du
portail est la décision que D97/D121 réservent, pas un réflexe de ticket — à
confirmer par Alexis.

## Point 6 — captures : BLOQUÉ, nommé plutôt que contourné

**Aucune capture n'a été prise.** La clause d'arrêt du ticket l'avait
anticipé : `git log origin/main` ne porte `9J02-PORTAIL-INVITATION-LIEN` sur
aucune branche (vérifié aussi en local, `git log --all`). Construire quand
même était explicitement demandé — fait, points 1 à 5 — mais les captures
exigent une VRAIE session de navigateur, et la vérification a établi que
**rien, aujourd'hui, ne peut poser un mot de passe sur un compte portail par
le chemin de production** :

- `tests/e2e/setup/scene.ts` (`ouvrirLeCompteDeLEpreuve`) pose le mot de
  passe d'un compte de l'épreuve par `reemettreJetonPremierAcces`
  (`lib/auth/amorcage.ts`), qui EXIGE une ligne dans `utilisateur_societe`
  (`etat.habilitations === 0` → `RefusReemission`). Un compte portail n'en a
  structurellement AUCUNE (D10) : ce chemin refuse toute identité portail par
  construction, pas par un oubli de ce ticket.
- Aucun autre chemin de production n'existe : c'est précisément ce que
  9J02-PORTAIL-INVITATION-LIEN doit poser, et qui n'est pas mergé.
- Aucun e2e du dépôt ne pose jamais un cookie ou une empreinte de mot de
  passe fabriquée pour contourner `/connexion` (mesuré : aucune occurrence de
  `setCookie`/`addCookies`/empreinte posée à la main dans
  `tests/e2e/setup/*.ts`) — **ouvrir ce précédent pour ce seul ticket aurait
  été le raccourci que la doctrine du dépôt refuse déjà** (« un harnais qui
  poserait un cookie fabriqué mesurerait le planning et rien d'autre »,
  `tests/e2e/setup/session.ts`).

**Décision prise ici : ne pas contourner.** Capturer l'écran aurait exigé
soit de fabriquer une session, soit de réimplémenter à la hâte une moitié du
flux d'invitation que 9J02 doit poser correctement — les deux auraient été
une dette plus coûteuse que l'absence de capture. À rouvrir dès
9J02-PORTAIL-INVITATION-LIEN mergé : les captures (375/1280, liste et
formulaire de création, avant/après une création) deviennent alors possibles
par le chemin normal, et `docs/etudes/equipe-2026-10-29/tickets/9J03-captures/`
existe déjà, vide, pour les recevoir.

## Points ouverts (non bloquants)

1. **Pas de bascule d'activité depuis le portail.** Le ticket ne liste que
   `creer` et `modifier` au point 2 ; `basculerActiviteContact` existe
   (`lib/contacts/depot.ts`) mais n'est appelée par aucune route portail.
   Sans elle, un compte ne peut pas « retirer » un contact parti — seulement
   corriger sa fiche. Tension avec la lecture large retenue pour la
   désignation du périmètre (gérer le départ d'un collègue) : à confirmer.
2. **Aucune entrée de menu** vers `/portail/contacts` (voir point 3).
3. **Pas de reprise de saisie après un refus** (CS46, back-office) : un
   formulaire refusé se vide — simplification délibérée sous le budget de
   temps, jamais une perte de donnée côté base.
4. **Captures non prises** — voir point 6 ci-dessus, bloqué par l'absence de
   9J02-PORTAIL-INVITATION-LIEN.

## Point 7 — fin

Livré : routes (point 2), écran (point 3), épreuves d'isolation neuves
(point 4), traçabilité (point 5). Bloqué et nommé : captures (point 6).

**`CI=1 pnpm verify` (la porte de CE ticket) est VERT en entier** —
format:check, typecheck, lint, test (5483 tests), test:isolation (1817
tests), build — journalisé dans `9J03-verify-final.txt`.

**`pnpm verify:full` n'a pas pu finir dans le budget de 150 min.**
`feries:horizon` et `audit:partitions` sont verts. `test:e2e` (1877
scénarios, 1 worker, ~40 min mesurées sur ce poste) a été lancé à 18:39 et
coupé à 19:19 : environ 1450 scénarios étaient passés, sans échec visible
qui nomme `contact` ou `portail`. Non rejoué faute de temps — à relancer en
CI nocturne (c'est l'exécution prévue, CLAUDE.md §4) ou dans une session
suivante avec son propre budget. `pnpm verify` étant vert, la définition de
« terminé » du ticket (hors `verify:full` « en fin de LOT », pas de chaque
ticket) est satisfaite.
