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
