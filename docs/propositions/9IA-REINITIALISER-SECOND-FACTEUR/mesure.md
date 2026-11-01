# 9IA — Mesure (point 1)

## `SecondFacteur` (table `second_facteur`)

Colonnes : `id`, `utilisateur_id`, `secret`, `codes_secours`, `verifie`
(`@default(true)` dans le schéma, mais écrit `false` à l'enrôlement — voir
`lib/auth/enrolement.ts`), `echecs_verification`, `verrouille_jusqu_a`,
`verrouillages_consecutifs`.

**Aucune politique de suppression** (D59) : sous `FORCE ROW LEVEL SECURITY`,
`DELETE` est refusé pour tout le monde. L'acte ne peut donc PAS supprimer la
ligne — il doit la laisser inerte.

## Ce qui force le ré-enrôlement, mesuré sur le parcours réel

`lib/auth/enrolement.ts` (`preparerEnrolement`) appelle
`auth.api.enableTwoFactor`. Lu dans
`node_modules/better-auth/.../plugins/two-factor/index.mjs` (fonction
`enableTwoFactor`, ~l.104-163) :

1. il cherche la ligne existante par `userId` (`findOne`) ;
2. si elle existe, il l'**UPDATE** (par `id`) avec un secret et des codes de
   secours NEUFS, et pose `verified: existingTwoFactor.verified === true` —
   c'est-à-dire qu'il **reprend l'ancien drapeau `verified`** ;
3. sinon il en crée une.

**Conséquence directe** : si `second_facteur.verifie` est déjà `false` au
moment où la personne relance l'enrôlement, `enableTwoFactor` récrit le secret
et les codes PAR LUI-MÊME, et repose `verified: false`. **Il n'est donc pas
nécessaire que l'acte efface ou régénère `secret`/`codes_secours` — remettre
`verifie` à `false` suffit à déclencher un VRAI ré-enrôlement au prochain
passage**, sans jamais lire ni écrire le secret depuis notre code (ce que
l'acte, de toute façon, n'a pas le droit de faire — voir L7-04).

La lecture de la ligne existante (`findOne` par `userId`), lors de ce futur
ré-enrôlement, passe par la politique `second_facteur_lecture`
(forme « désignation », `app.authentification_utilisateur_id` ou
`app.utilisateur_id` = la ligne elle-même) : la personne lit SA PROPRE ligne,
ce que cette politique permet déjà sans qu'il soit besoin d'y toucher.

## Le cercle qu'il faut éviter — mesuré par L1-02f (`lib/auth/enrolement.ts`)

« Un compte dont `mfa_actif` est vrai et `second_facteur.verifie` faux ne peut
plus entrer du tout : la connexion lève `TOTP_NOT_ENABLED`. » Remettre
`verifie` à `false` SANS aussi remettre `utilisateur.mfa_actif` à `false`
enfermerait donc la personne au lieu de la laisser ré-enrôler. **Les deux
écritures sont donc nécessaires**, et c'est la raison pour laquelle le geste
touche deux tables.

## Ce que `second_facteur_modification` (RLS actuelle) permet déjà

Lecture et écriture, mais seulement sous la forme « désignation » — la ligne
du SUJET lui-même (`app.authentification_utilisateur_id` ou `app.utilisateur_id`
= `second_facteur.utilisateur_id`), jamais celle d'un tiers. Aucune politique
n'ouvre aujourd'hui une écriture administrative sur la ligne d'autrui — c'est
tout l'objet des politiques ajoutées par cette migration.

## Ce que `utilisateur_modification` (RLS actuelle) permet déjà — et ce qu'elle ne couvre pas

Admin_societe et direction, sur une identité de LEUR société active
(`app_peut_administrer_identites()` + `EXISTS utilisateur_societe`). Cela
suffirait pour B (`admin_societe`) si l'on acceptait un `WHERE` ordinaire —
MAIS cette politique n'exclut pas la propre ligne de l'acteur (piège D90, voir
la migration) et, structurellement, **`admin_plateforme` n'y figure jamais**
(il n'a ni société active ni ligne dans `utilisateur_societe` — `lib/auth/
roles.ts`, "ils n'ont aucun accès par défaut aux données d'une société
cliente"). A (`admin_plateforme`) ne peut donc PAS emprunter ce chemin, quel
qu'il soit. C'est pourquoi la migration écrit `utilisateur.mfa_actif`
exactement comme `second_facteur` — par un `UPDATE` sans `WHERE`, désigné par
`app.reinitialisation_sujet_id`, bornée par sa propre politique.

## Écart constaté, hors territoire de ce ticket — signalé, non réparé

`A` (`admin_plateforme`) n'a aujourd'hui AUCUN chemin d'écran vers l'équipe
d'une société cliente : `obtenirSession()` (`lib/auth/session.ts`) lie
`societeId` et `role` — l'un est `null` si l'autre l'est — et `admin_plateforme`
n'a jamais de ligne dans `utilisateur_societe` (confirmé : aucune société du
seed n'en porte une). La console éditeur qui ouvrirait ce chemin est
explicitement différée au lot 7 (`docs/arbitrages.md`, plusieurs entrées :
« admin_plateforme seul » pour L7-01, console éditeur citée comme lot 7 dans
`lib/auth/inscription-fermee.ts`). **L'acte et sa politique RLS supportent
donc A intégralement et sont prêts à être appelés dès que ce chemin existera**
— mais aucun écran de ce lot n'expose de bouton à `admin_plateforme`, faute
d'un endroit où le poser. Voir la passation.
