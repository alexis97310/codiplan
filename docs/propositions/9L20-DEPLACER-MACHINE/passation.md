# 9L20-DEPLACER-MACHINE — passation

Démarré le 19/11/2026 à 01:36 (Nouméa), budget 120 min.

## La règle tenue

Décision d'Alexis du 10/11/2026 (option 1) : un geste « Déplacer la
machine » vers un autre site du même client, ou d'un autre client de la
société avec confirmation explicite, qui garde l'historique de la machine
et trace le déplacement. Plus de saisie ignorée en silence.

Mesuré sur `81894e0` : `modifierMachineDans` (`lib/machines/depot.ts`)
validait `site_id`/`client_id` par `schemaMachine`, puis ne les écrivait
jamais — un couple forgé sur `/api/machines/[id]/modifier` était donc
VALIDÉ puis IGNORÉ, sans qu'aucun message ne le dise.

## Ce qui est livré

### Point 1 — le geste et le refus nommé

- `lib/machines/depot.ts` : `modifierMachine` relit désormais la fiche
  AVANT d'écrire et REFUSE (`deplacement_requis`) si le `site_id`/
  `client_id` soumis diffère de la fiche, au lieu de l'ignorer. Nouvelle
  fonction `deplacerMachine` : site du même client (aucune confirmation),
  ou d'un autre client (confirmation explicite, revérifiée serveur) ;
  refuse en nommant le nombre si des interventions restent OUVERTES sur
  la machine — l'énoncé du ticket admet ce choix plutôt que de réécrire le
  site d'une intervention déjà posée (une donnée vécue, pas une
  affectation qui peut suivre).
- Le journal n'est pas réécrit par ce ticket : `machine` porte déjà le
  déclencheur générique depuis L2-01, et `tx.machine.update` suffit à
  tracer l'ancien site, le nouveau, l'auteur et la date — exactement ce
  que la note de `sitesTraverses` (`lib/machines/historique.ts`)
  annonçait. `lib/machines/emplacements.ts` (nouveau module, séparé de
  `historique.ts` pour ne pas fausser son propre gardien de requête
  unique) lit cette trace.
- `components/parc/formulaire-machine.tsx` : le site n'est plus affiché,
  même en lecture, dans le formulaire de correction — seul le geste
  « Déplacer la machine » (`components/machines/deplacer.tsx`, nouveau)
  le change désormais. Nouvelle route `app/api/machines/[id]/deplacer`.
- Fiche machine (`/parc/[id]`) : bouton « Déplacer la machine », bloc
  « Historique des emplacements ».

### Point 2 — une limite mesurée en cours de route, et la décision prise

La lecture du journal d'audit n'est ouverte, en base, qu'aux rôles
`admin_societe` et `direction` (matrice des habilitations, capacité
`consulter_journal_audit`) — une règle déjà en place, non modifiée par ce
ticket. Un rôle sans cette capacité qui consulterait
`historiqueDesEmplacements` recevrait donc zéro ligne sous la politique de
lecture, ce qui aurait affiché « jamais déplacée » sur une machine qui l'a
pourtant été : un faux négatif, pas un refus honnête.

**Décision pour tenir ce ticket dans son budget, à faire confirmer** : le
bloc « Historique des emplacements » n'est rendu, sur la fiche, qu'au rôle
qui a `consulter_journal_audit` (`peutConsulterEmplacements`,
`app/(back-office)/parc/[id]/page.tsx`) — ABSENT, jamais vide, pour les
autres rôles. Le geste « Déplacer la machine » lui-même reste ouvert à
tout rôle `gerer_machine` (ADMS, DIR, RM, RS, ADV, TEC) : écrire et lire
l'historique ne sont pas la même capacité. C'est une application d'une
règle déjà tranchée, pas une nouvelle décision de cloisonnement — mais
elle mérite d'être relue : un ADV qui déplace une machine ne verra plus,
sur l'écran qu'il vient d'utiliser, la trace de son propre geste.

### Point 3 — épreuves et captures

- `tests/isolation/9l20-deplacer-machine.test.ts` : cloisonnement (une
  société B ne déplace jamais une machine de la société A), interventions
  ouvertes refusées en nommant leur nombre (`MACHINE_A1`, déjà porteuse de
  deux interventions ouvertes dans le harnais existant), site identique,
  confirmation requise puis acceptée pour un autre client, déplacement
  accepté et TRACÉ (lu avec `admin_societe`, seul rôle qui le peut), et le
  nouveau refus de `modifierMachine` sur un site qui diffère de la fiche.
- Gardiens mis à jour à leur source : `ROUTE_CAPACITE`
  (`tests/unit/auth/porte.test.ts`, 118 routes), le compte de
  `<CarteEnTete>` de la fiche machine (`composition-fiche.test.ts`, 5), le
  nombre de valeurs en lecture seule du formulaire de correction
  (`lot-parc.test.ts`, 4 — le site n'y est plus).
- `tests/e2e/9l20-deplacer-machine.spec.ts`, aux deux largeurs demandées
  (1280, 375) : le formulaire de correction ne propose plus le site, le
  bouton ouvre un dialogue qui cherche un site sur TOUTE la société (sans
  restriction au client courant), le déplacement réussit et se lit dans
  « Historique des emplacements », et un site forgé sur l'ancien
  formulaire est refusé nommément.
- Captures (`docs/propositions/9L20-DEPLACER-MACHINE/captures/`), aux
  deux largeurs : la fiche avant et après le déplacement, le dialogue
  ouvert, le formulaire de correction sans le site. **AVANT non
  reproductible sur cet arbre** (même raison que
  `captures-9l18-garantie-recensement-sans-montant.spec.ts`) : le JSX qui
  affichait le site a disparu du formulaire, et la fiche ne peut plus se
  rendre sans le bouton qui vient avec lui. Seul l'APRÈS est versé.

## Ce qui n'a pas été construit, et pourquoi

Aucune migration — aucune colonne ni contrainte ne manquait : le journal
d'audit, déjà posé sur `machine` depuis L2-01, portait déjà tout ce que ce
ticket avait besoin de tracer.

Le vocabulaire imposé (D5/D47) a demandé un détour sur les textes du
nouveau geste : les refus nommés disent « cet emplacement » plutôt que
« ce site » (le mot imposé ne s'écrit qu'au dictionnaire des notions,
jamais en dur dans une valeur de `lib/i18n/fr.ts`), et les deux colonnes
de l'historique composent `motDansUnePhrase("site")` au rendu.

`pnpm verify` (format, typecheck, lint, test, isolation, build) passe sans
erreur ni avertissement ; `pnpm test:e2e` ciblé sur ce ticket passe aux
deux largeurs. `pnpm verify:full` est laissé à la file, comme demandé.
