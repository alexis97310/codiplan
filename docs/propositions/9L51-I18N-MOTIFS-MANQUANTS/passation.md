# 9L51-I18N-MOTIFS-MANQUANTS — passation

## Le manquant confirmé

`regle_arrondi.refus.droit` (`lib/societes/identite.ts:252`,
`enregistrerRegleArrondi`) était bien renvoyée par le code et absente de
`lib/i18n/fr.ts`, comme la revue de 9I8A1 l'avait relevé le 31/10. Mesuré en
contexte réel : `app/(back-office)/parametres/tarifs/page.tsx:321` lit ce
motif par `estCleTraduction(motif) ? t(motif) : null` — sans la clé, la
condition rend faux et **rien ne s'affiche**, pas même la clé brute. Un
technicien ou un administrateur sans le droit `parametrer_societe` qui
soumettrait le formulaire de la règle d'arrondi (`/parametres/tarifs`) serait
refusé en silence.

Clé ajoutée (`lib/i18n/fr.ts`, section `tarifs.regle_facturation.*`, à côté
de `tarifs.regle_facturation.refus_saisie`) :

```
"regle_arrondi.refus.droit": "Votre rôle ne permet pas cette action."
```

Même texte que ses quatre voisins exacts du dépôt (`afficher_montants.refus.droit`,
`delai_relance_suite.refus.droit`, `majoration_hors_ouverture.refus.droit`,
`mentions_legales.refus.droit`) : un refus de droit sur une carte de
paramétrage société dit toujours la même phrase.

## Le gardien : ce qu'il recense, et ce qu'il ne recense pas

`tests/unit/outils/motifs-de-refus.ts` (lecture) et
`tests/unit/gardiens/motif-connu-du-dictionnaire.test.ts` (règle) :
recensent tout littéral **pointé** déclaré sous un type nommé `Refus…` ou
`Motif…` dans `lib/` et `app/`, et échouent si l'un d'eux manque au
dictionnaire (`estCleTraduction`, importé de `lib/i18n/fr`, jamais ré-exposé
par `lib/i18n/index.ts` — il n'est pas un accesseur de texte).

**Mesuré avant d'écrire la règle, pour rester juste (deux faux positifs
écartés) :**

1. Une propriété `motif: "…"` existe aussi **côté écran**, comme simple
   étiquette comparée par `===` pour choisir un AUTRE texte déjà traduit —
   `motif === "equipe.acces.tous_envoyes"`
   (`app/(back-office)/parametres/equipe/page.tsx:355`) n'est jamais passé à
   `t()`, il sélectionne `t("equipe.acces.tous_envoyes.un"/".plusieurs"/...)`.
   Recenser toute propriété `motif:` du dépôt aurait fait rougir ce cas sur
   un dépôt sain. Se limiter à la DÉCLARATION du type à sa source (`lib/`,
   `app/api/`) l'écarte : cette étiquette n'est déclarée sous aucun type
   `Refus…`/`Motif…`.
2. `VerdictPublication.motif` (`lib/db/verdict-publication.ts`) est une
   phrase française complète, lue par la commande `pnpm deploiement:verifier`
   — un développeur, jamais un écran (L0-11). Son type est `string`, pas un
   littéral : hors du périmètre du gardien par construction (il ne lit que
   des `LiteralTypeNode`).

**Ce que le gardien ne couvre délibérément pas** (écrit dans
`motifs-de-refus.ts`) : les codes COURTS sans point
(`"fusionnee"`, `"introuvable"`…), composés plus loin par un gabarit
littéral — `` `machine.refus.${resultat.motif}` ``
(`app/api/machines/[id]/changer-statut/route.ts:84`). Résoudre cette
composition exigerait de suivre, par le vérificateur de types, la valeur
d'une variable à travers un appel de fonction — hors de portée d'une lecture
syntaxique, et le ticket nomme lui-même le périmètre : « littéraux de la
forme domaine.refus.xxx ».

**Éprouvé contre un faux négatif réel** : le correctif a été retiré par un
`git stash` temporaire pendant la rédaction, le gardien a retrouvé exactement
`regle_arrondi.refus.droit` et rien d'autre, puis le correctif a été restauré
(`git stash apply`, jamais `pop`, puis `drop` de l'entrée nommée). Deux cas
fabriqués dans le test lui-même prouvent en plus que : un type `Motif…` à
littéraux courts (sans point) ne déclenche rien ; un type `Refus…` à littéral
pointé inconnu est détecté et nommé précisément (fichier, ligne, clé).

Sur le dépôt réel, le gardien recense aujourd'hui 30 littéraux pointés sous
un type `Refus…`/`Motif…` — les 29 autres existaient déjà au dictionnaire.

## Épreuves

`pnpm test` (6108 passés, dont les 4 du gardien), `pnpm test:isolation`
(2587 passés), `CI=1 pnpm verify` (format, typecheck, lint, test,
isolation, build) — tous verts.

## Aucune capture, aucune migration, aucun arbitrage

Aucun écran ne change visiblement pour un rôle qui a le droit — le bandeau
rouge de `/parametres/tarifs` existait déjà pour les autres refus de la même
carte ; seul un rôle sans `parametrer_societe` le verrait apparaître
désormais pour celui-ci, ce qui est la correction elle-même, pas un
changement de disposition. Pas de colonne manquante, pas de règle de gestion
qui change : rien à écrire dans `docs/arbitrages.md`.
