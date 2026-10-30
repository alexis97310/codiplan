# 9I8-AFFICHAGE-DES-MONTANTS — passation

## Point 1 — l'inventaire mesuré

Grep sur `accesAuxMontants`, `formatMoney`, `montant_ht`, `valorisation` sous `app/` et `lib/` (hors tests).
Deux écrans — et seulement deux — affichent un montant d'INTERVENTION :

| Écran | Fichier | État avant ce lot |
|---|---|---|
| Onglet Valorisation de la fiche | `app/(back-office)/interventions/[id]/page.tsx` (`Valorisation`, ~l.1700/1887) | **Bogue M1** : `fiche.valorisation !== null && fiche.devise !== null` masque TOUT le composant — titre et motif compris — tant que l'intervention n'est pas clôturée, ou si clôturée sans taux en vigueur à sa date. |
| Bon d'intervention (version interne) | `app/(back-office)/interventions/[id]/bon/page.tsx` (`valorisationTuile`, ~l.471) | Déjà correct : la tuile se monte dès que `interne` est vrai, et affiche `sans_droit` / `taux_absent` / le détail — jamais masquée entièrement. Non touché par ce lot (seulement par le point 5, réglage société). |

Écrans explicitement HORS primètre (pas un montant d'INTERVENTION, ou paramétrage des prix — reste visible, décision confirmée 29/10) :
`app/(back-office)/parametres/tarifs/page.tsx` (paramétrage des prix), `app/(back-office)/interventions/nouvelle/page.tsx` et
`app/(back-office)/demandes/[id]/page.tsx` (sélection de `mode_valorisation`, pas un montant affiché), `app/(back-office)/interventions/presentation.ts`
(nom de l'onglet, pas un montant), tout `lib/tarification/**`, `lib/money/**`, `lib/interventions/depot.ts`, `lib/reporting/**` (calcul, lecture seule).

Point central des droits : `lib/interventions/montants-visibles.ts` (`accesAuxMontants`, D37) — déjà juste, mais inatteignable depuis la fiche
tant que le bloc entier était masqué en amont par la condition de montage.

## Point 2 — Option A

`Valorisation` se monte désormais dès que `fiche.devise !== null` (quel que soit `fiche.valorisation`). Le composant distingue, dans l'ordre :
1. `!montants.montre` → motif `intervention.valorisation.sans_droit` (inchangé, D37/D88).
2. `montants.montre && valorisation !== null` → détail inchangé.
3. `montants.montre && valorisation === null && clotureeLe === null` → `intervention.valorisation.pas_encore` (« Pas encore valorisée : le montant sera calculé à la clôture. »).
4. `montants.montre && valorisation === null && clotureeLe !== null` → `intervention.valorisation.total_inconnu` (une clôturée dont le taux historique n'est plus lisible à sa date — `depot.ts` ne renvoie `valorisation` à `null`, après clôture, que dans ce seul cas : `temps_valide_min` n'est écrit qu'à la clôture, et au-delà `tauxEnVigueur` est l'unique branche qui laisse `valorisation` à `null`).

## Point 3 — migration

`<NOM_EXACT_DE_LA_MIGRATION>` — colonne `societe.afficher_montants BOOLEAN NOT NULL DEFAULT true`. Aucune donnée modifiée, aucune politique RLS touchée.
**À jouer sur le site de test ET en production** (`pnpm db:deploy`).

## Point 4 — le réglage

Case « Afficher les montants » dans `/parametres/societe`, gardée côté serveur à `admin_societe` + `direction` pour CE réglage.

## Point 5 — le masquage

`accesAuxMontants` prend le réglage de société en compte ; message `intervention.valorisation.desactive_par_societe` partout où un montant d'intervention
s'affiche (fiche, bon).

## Mesure du budget

T0 = 05:45 (Pacific/Noumea). Travail sur la branche dédiée `9I8-AFFICHAGE-DES-MONTANTS`, partant d'`origin/main` (HEAD était détaché sur
`origin/main` au démarrage de la session — aucun autre worktree n'y était extrait).
