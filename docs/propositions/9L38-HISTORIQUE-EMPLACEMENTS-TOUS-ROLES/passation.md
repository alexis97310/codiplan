# Passation — 9L38-HISTORIQUE-EMPLACEMENTS-TOUS-ROLES

## Ce qui était demandé

Seconde moitié de D280 (décision d'Alexis du 23/11/2026, point 3 de la séance ; 9L34 l'avait laissée bloquée, faute de migration autorisée dans ce lot-là) : « Historique des emplacements d'une machine : visible à tous ceux qui voient la fiche », pas seulement `admin_societe`/`direction`.

## Ce qui est LIVRÉ

**« Historique des emplacements » s'ouvre à ADMS, DIR, RM, RS, ADV** (TEC n'atteint jamais `/parc/[id]`, fermé par D221), par une nouvelle capacité `consulter_historique_emplacements` (`lib/auth/habilitations.ts`), distincte de `deplacer_machine` comme la lecture l'est de l'écriture.

**Mesuré AVANT d'écrire la migration : la voie que D280 décrivait (une seconde politique RLS scopée sur `journal_audit`) est refusée par un gardien existant.** `scripts/lib/politiques-rls.ts` (`ecartsJournal`, forme « journal » de I1/I8) exige qu'AUCUNE politique de `SELECT` sur `journal_audit` n'échappe à `app_peut_consulter_journal_audit()` — précisément pour qu'une politique plus étroite ne devienne jamais, par un ticket, le chemin par lequel le journal entier s'ouvrirait en silence. Je l'ai d'abord écrite, vue rougir, puis retirée plutôt que d'assouplir le gardien (qui aurait été l'assouplissement d'un invariant, un point d'arrêt du §8 que je n'ai pas eu besoin d'ouvrir puisqu'une voie alternative existait déjà, arbitrée).

**La voie retenue à la place** : `app_historique_emplacements_machine`, une QUATRIÈME fonction `SECURITY DEFINER` (même patron que D226/D233/D281 : `search_path` figé, `row_security = off`, `REVOKE ALL FROM PUBLIC` + `GRANT EXECUTE` au seul rôle applicatif), migration `20261124100000_historique_emplacements_tous_roles_9l38`. Elle ne pose AUCUNE politique sur `journal_audit` ; elle reçoit UNE société et UNE machine — jamais un rôle — et ne rend que les lignes `entite = 'machine'`, `action = 'modification'`, dont le `site_id` diffère avant/après. Le journal entier reste réservé à `consulter_journal_audit` (ADMS, DIR) ; `journal_audit_lecture` reste l'unique politique de `SELECT` sur la table.

Décision écrite en **D283** (`docs/arbitrages.md`), qui amende D280 sur ce point précis (la migration proposée n'est pas celle posée).

`historiqueDesEmplacements` (`lib/machines/emplacements.ts`) appelle désormais cette fonction par `$queryRaw` (même idiome que `lib/auth/invalidation-liens-acces.ts` pour D281), au lieu d'une requête Prisma directe sur `journal_audit` ; le filtrage TypeScript (site différent avant/après) est conservé en défense en profondeur, bien que redondant avec le filtre SQL.

`peutConsulterEmplacements` (`app/(back-office)/parc/[id]/page.tsx`) s'appuie sur la nouvelle capacité plutôt que sur `consulter_journal_audit`.

## Épreuves

- `tests/unit/auth/habilitations.test.ts` — `consulter_historique_emplacements` pour les dix rôles (ADMS, DIR, RM, RS, ADV, TEC au ●, les quatre autres au refus), plus le témoin « toute capacité où `admin_societe` a ● est aussi au ● pour `direction` ».
- `tests/unit/db/security-definer-sous-arbitrage.test.ts` — quatrième entrée de la liste close, avec son motif.
- `tests/isolation/9l20-deplacer-machine.test.ts` (describe « historiqueDesEmplacements — ouvert à tout rôle qui voit la fiche (D283) ») :
  - RM, RS et ADV de la société A lisent la trace d'un déplacement réel, puis remise en place ; direction et admin, inchangés, vérifiés aussi ;
  - une société B (RM) ne lit jamais les déménagements d'une machine de la société A ;
  - une ligne du journal qui N'EST PAS un déménagement (un champ modifié, site inchangé) reste illisible à RM sous `$queryRaw` direct sur `journal_audit`, visible à l'administrateur — la preuve que le journal entier reste fermé.
- `tests/e2e/9l38-historique-emplacements-tous-roles.spec.ts` (nouveau, sa propre scène `scene-9l38.ts`) : l'ADV déplace la machine (1280px), puis RM — qui n'a RIEN écrit — lit l'historique à 1280px et à 375px (desktop et mobile).
- `tests/e2e/tous-les-ecrans-rendent.spec.ts` — toujours vert, `/parc/[id]` rend 200.
- `pnpm test`, `pnpm test:isolation`, `CI=1 pnpm verify` : tous verts.

## Captures

`docs/propositions/9L38-HISTORIQUE-EMPLACEMENTS-TOUS-ROLES/captures/` :
- `9l38-fiche-adv-avant-1280.png` / `9l38-fiche-adv-apres-1280.png` — la fiche ADV avant et après son propre déplacement.
- `9l38-fiche-rm-apres-1280.png` / `9l38-fiche-rm-apres-375.png` — RM lit la même trace, sans l'avoir posée.

**AVANT non reproductible pour RM**, aux deux largeurs : le bloc était simplement ABSENT avant ce lot (aucun JSX à capturer), même limite que `tests/e2e/9l20-deplacer-machine.spec.ts` documente déjà pour un autre bloc.

`scripts/captures.mts` (régénération complète de `docs/captures/`) non rejouée — hors budget, même choix que 9L33/9L34, déjà en retard d'une trentaine de lots sur ce point.

## Feuille de route

`lib/feuille-de-route/contenu.ts` :
- La ligne « Historique des emplacements… » (Décisions prises) dit désormais que les DEUX moitiés de D280 sont livrées.
- L'entrée « bloqué » correspondante disparaît de « Bloqué / en enquête ».
- Deux lignes « livré » entrent dans « Livré depuis le 31/10 » : l'historique des emplacements (D283, 9L38), et les gardes en base de 9L19 (publiées le 23/11, D277) — qui sortent de « Décisions en attente », laquelle se vide et disparaît.

## Ce qui reste dû

- `scripts/captures.mts` (voir ci-dessus).
- Le repli de consolidation portable de D36 (lot 5) reste le candidat suivant connu pour une cinquième fonction `SECURITY DEFINER`, pas encore écrit.
