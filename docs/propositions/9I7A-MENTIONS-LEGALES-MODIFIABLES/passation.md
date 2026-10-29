# 9I7A-MENTIONS-LEGALES-MODIFIABLES — passation

## 1. Mesure (point 1), sur `c832cdcd`

- `societe.mentions_legales String?` existe déjà (`prisma/schema.prisma`, modèle `Societe`, commentaire « pied des documents ») — aucune migration dans ce ticket.
- Avant ce lot, la colonne était **affichée seulement** : `app/(back-office)/parametres/page.tsx` (`CarteIdentite`, `LigneIdentite`), lue par `lib/societes/identite.ts` (`CHAMPS_IDENTITE`/`lireIdentiteCloisonnee`) et par `lib/interventions/bon.ts` (`lireLogoEtRaisonSociale`, le pied du bon, 9I7). Aucune route n'écrivait dessus.
- **Le modèle à suivre, mesuré** : `app/api/parametres/societe/logo/route.ts` (POST) → `lib/societes/logo.ts` (`enregistrerLogo`) — capacité `parametrer_societe` vérifiée **à la porte** (`exigerCapaciteComplete`) **et dans la fonction** (pour rester sûre si appelée hors route), refus par motif nommé, écriture `tx.societe.update({ where: { id: contexte.societeId }, ... })` sous `avecContexteApplicatif`.
- **Capacité à écrire, sans migration ni GRANT** : la politique RLS `cloisonnement_identite` sur `societe` (`prisma/migrations/20260820120000_rls_policies/migration.sql:75-77`) est posée **sans clause `FOR`** — elle couvre déjà `SELECT`/`UPDATE`/toute commande, et donc toute colonne de la ligne, `id = app.societe_id` en `USING` et en `WITH CHECK`. Aucun `GRANT`/`REVOKE` ciblant `societe` au-delà de `GRANT SELECT ... TO codiplan_reporting` — pas de restriction colonne par colonne pour le rôle applicatif. **Conclusion mesurée au point 1** : écrire `mentions_legales` n'exige ni politique RLS neuve, ni `GRANT`, ni capacité neuve — le point d'arrêt prévu par le ticket ne s'est pas ouvert.

## 2. Ce qui a changé

### `lib/societes/identite.ts`

`enregistrerMentionsLegales(contexte, texte)` — même doctrine que `enregistrerLogo` : capacité vérifiée ici (pas seulement à la porte), texte nettoyé (`trim()`, vide → `null`, retours à la ligne internes conservés), borne `MENTIONS_LEGALES_MAX = 1000`, refus par motif nommé (`mentions_legales.refus.droit` | `mentions_legales.refus.taille`), écriture `tx.societe.update` sous `avecContexteApplicatif`. Le commentaire d'en-tête du module (qui disait « aucun réglage n'écrit ici ») est corrigé : les mentions légales sont désormais la seule colonne de ce module qui écrit, documenté comme tel.

### `app/api/parametres/societe/mentions-legales/route.ts` (neuf)

`POST`, même modèle que `/api/parametres/societe/logo` : `exigerCapaciteComplete("parametrer_societe")`, `requete.formData()`, `enregistrerMentionsLegales`, redirection 303 vers `/parametres` (avec `?motif=` sur refus, rien sur succès — même silence que le logo).

### `app/(back-office)/parametres/editeur-mentions-legales.tsx` (neuf, client)

`EditeurMentionsLegales` remplace la ligne de lecture des mentions légales dans `CarteIdentite`, pour les rôles qui tiennent `parametrer_societe` :
- **Au repos** : même rendu que `LigneIdentite` (libellé + valeur, « Non renseigné » si vide), plus un bouton « Modifier » si le rôle le permet.
- **Ouvert** : `<textarea>` contrôlé (compteur de caractères, rouge au-delà de 1 000 et bouton « Enregistrer » désactivé), aperçu « Pied du bon » (même classes que le pied réel, `lib/interventions/bon.ts` / `app/(back-office)/interventions/[id]/bon/page.tsx:565-568` : `whitespace-pre-wrap`, `border-t`), « Enregistrer »/« Annuler ».
- **Composant client pour le compteur et l'aperçu seulement** — la soumission reste un `<form method="post" action="...">` natif, aucun `fetch`. `MENTIONS_LEGALES_MAX` est passé en prop plutôt que réimporté depuis `lib/societes/identite.ts`, pour ne pas tirer `avecContexteApplicatif`/Prisma dans le paquet client.
- Textarea stylé à la main (`border-app-bord bg-app-surface rounded-md border`) : gardien `tests/unit/ui/carte-pas-recopiee.test.ts` — ajouté aux `EXCEPTIONS`, catégorie `champ` (même catégorie que `components/ui/champ.tsx`).

### `app/(back-office)/parametres/page.tsx`

`PageParametres` lit désormais `searchParams` (le retour `?motif=` de la route), affiche un `BandeauMotif` en tête si une clé valide est présente (même garde `estCleTraduction` que `/parametres/societe`). `CarteIdentite` reçoit `peutModifierMentionsLegales` et rend `EditeurMentionsLegales` à la place de l'ancien `LigneIdentite` pour cette seule ligne.

### `lib/i18n/fr.ts`

Neuf clés : `parametres.identite_mentions_legales_{modifier,annuler,enregistrer,aide,apercu_titre,compteur_caracteres}`, `mentions_legales.refus.{droit,taille}`, `ponctuation.slash`.

## 3. Épreuves

- `tests/unit/societes/identite.test.ts` — `enregistrerMentionsLegales` refuse un rôle sans `parametrer_societe` (y compris si le texte est AUSSI trop long — le motif de droit l'emporte), refuse un texte > 1 000 caractères, sans toucher la base.
- `tests/isolation/mentions-legales-societe.test.ts` (neuf, même patron que `logo-societe.test.ts`, `DATABASE_URL` redirigée sous `codiplan_app` avant tout import) — un enregistrement réussi se relit ; les espaces de bord sont retirés et un texte vide écrit `null` ; une écriture qui FORCE l'identifiant d'une autre société est refusée par la politique RLS, le texte de l'autre société reste intact ; un rôle sans la capacité est refusé, rien n'est écrit ; un texte de plus de 1 000 caractères est refusé, rien n'est écrit ; le journal d'audit trace le texte (pas de redaction nécessaire, à la différence des octets du logo).
- `tests/unit/auth/porte.test.ts` — la route neuve est ajoutée aux listes fermées `ROUTE_CAPACITE` (90→91) et `PORTE_COMPLETE` : un gardien existant (D-12/D153) fait rougir toute route qui appelle `exigerCapaciteComplete` sans y figurer.
- `pnpm test:isolation` — 194/194 fichiers verts, cloisonnement I1 inchangé ailleurs.
- `tests/e2e/captures-9i7a-mentions-legales-modifiables.spec.ts` — épreuve de bout en bout dédiée (`zz9I7A-`, scène partagée retirée en `afterAll`) : 5/5 vertes, prouve la ligne au repos, la saisie ouverte, l'enregistrement réel (POST → relecture sur `/parametres` ET sur le pied du bon).

## 4. Captures (`docs/propositions/9I7A-MENTIONS-LEGALES-MODIFIABLES/captures/`)

| Fichier | Contenu |
|---|---|
| `mentions-legales-ligne-au-repos-375.png` / `-1280.png` | La ligne « Mentions légales » avant modification, bouton « Modifier » visible |
| `mentions-legales-saisie-ouverte-375.png` / `-1280.png` | La zone de texte ouverte, compteur, aperçu « Pied du bon », Enregistrer/Annuler |
| `bon-avec-mentions-legales-375.png` / `-1280.png` | Le bon d'intervention, texte enregistré visible au pied |

Pas de capture « avant » séparée : ce ticket ajoute une capacité d'écriture sur un écran existant plutôt que de modifier une disposition déjà capturée par un autre lot (9I7, 9EZ-LOGO-SOCIETE-1) — les captures « au repos » ci-dessus en tiennent lieu pour la ligne telle qu'elle se lisait déjà.

## 5. Écarts assumés / points ouverts

- Aucun. Le point d'arrêt prévu par le ticket (RLS/GRANT/capacité à changer) ne s'est pas ouvert — voir § 1.
- Le badge « En lecture » de la carte « Identité » (`parametres.identite_badge_lecture`) n'a pas été retouché : cinq des six lignes de la carte restent réglées à la mise en service, seules les mentions légales deviennent modifiables. Changer ce badge toucherait un texte de maquette (M:4356-4361, rang 1) hors du territoire de ce ticket — signalé plutôt que changé.

## 6. Vérification

`CI=1 pnpm verify:full` lancé en entier, trace dans `verify-final.txt`.
