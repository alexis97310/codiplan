# 9F1-TABLEAU-DE-BORD-DIRECTION-ADMIN — passation

Mesuré sur origin/main a65a7de9 au départ (D91, décision n° 91 d'Alexis du 13/10/2026,
amende D199/D185/D189). Trois commits livrés : composition + lectures, épreuves + captures,
documentation.

## Ce que j'ai changé

- **La direction reçoit, en plus de sa propre composition, les blocs d'administration** —
  conséquence directe de « la direction a tout pouvoir » (D199) : si elle détient déjà
  toutes les capacités de l'administrateur de société, son tableau de bord doit les
  montrer. `voitLesBlocsDAdministration(composition)` (`presentation.ts`) remplace les
  comparaisons directes à `Role.admin_societe` sur les lectures et le rendu des blocs
  partagés.
- **Tuiles** : la direction garde ses trois tuiles rendues (« Clôturé en \<mois\> »,
  « En retard », « Parc suivi ») et reçoit ensuite les trois tuiles propres à
  l'administrateur (« Accès à ouvrir », « Données à compléter », « Import en contrôle ») —
  « Parc suivi », commune, ne compte qu'une fois. `tuilesRenduesDuRole(Role.direction)`
  passe de 3 à 6 tuiles.
- **Bande de décomptes** : `DECOMPTE_PAR_COMPOSITION` devient une LISTE par rôle (plus une
  valeur unique) — la direction porte désormais `p1_a_planifier` ET
  `habilitations_echeance` (les deux décomptes d'habilitations, expirées et à renouveler
  sous 60 jours), l'administrateur ne change pas.
- **Blocs** : `BlocAccesAOuvrir` et `BlocDonneesACompleter` rejoignent la colonne
  principale de la direction, APRÈS le bloc du mois et la carte Priorités ;
  `BlocMiseEnRoute` rejoint sa colonne latérale, APRÈS la charge des 4 prochaines semaines,
  AVANT le journal (il y était déjà pour l'administrateur — seule la condition change).
  L'alerte P1 et la carte « Interventions sans durée » restent absentes chez la direction
  (D189, V4) : ce ticket ne les rediscute pas.
- **Lectures** : les lectures d'administration (accès à ouvrir, données à compléter, import
  en contrôle, bande d'habilitations), désormais partagées par deux compositions, tournent
  en un seul `Promise.all`, avec la lecture du bloc du mois propre à la direction — jamais
  une suite d'`await` séquentiels. `faitsMiseEnRoute` (`lib/tableau-de-bord/mise-en-route.ts`)
  accepte un troisième paramètre optionnel, la liste « accès à ouvrir » déjà lue par
  l'appelant, pour ne plus la relire une seconde fois : le N+1 qu'elle portait n'est plus
  exécuté qu'une fois — pour l'administrateur aussi, pas seulement pour la direction. Son
  ancien appel à deux arguments (l'épreuve d'isolation `9eg2-tableau-de-bord.test.ts`
  compris) reste valide sans changement.

## Ce que j'ai mesuré

- **Unitaire** (`tests/unit/tableau-de-bord/presentation.test.ts`) : les six tuiles de la
  direction dans l'ordre exact ; `voitLesBlocsDAdministration` vraie pour direction et
  administrateur, fausse pour les trois autres ; `DECOMPTE_PAR_COMPOSITION[Role.direction]`
  = `["p1_a_planifier", "habilitations_echeance"]`, l'administrateur inchangé.
- **Isolation** (`tests/isolation/9eg2-tableau-de-bord.test.ts`, contre un vrai
  PostgreSQL) : ajout d'un contexte `DIRECTION_B` — la direction de la société B ne lit ni
  les techniciens ni les comptes de la société A, par les mêmes fonctions
  (`techniciensAccesAOuvrir`, `pointsDonneesACompleter`) déjà éprouvées pour
  l'administrateur.
- **Bout en bout** (`tests/e2e/9eg2-tableau-de-bord-direction-admin.spec.ts`, 21 épreuves,
  même fixture propre préfixée `9EG2-` que le lot -2, la direction et l'administrateur de
  ce fichier partageant la même société) : recopie pour la direction les cinq vérifications
  déjà éprouvées pour l'administrateur (tuile « Accès à ouvrir » → écran filtré, bloc
  « Accès à ouvrir » nommant le technicien avec un bouton « Envoyer le lien », tuile
  « Import en contrôle » → écran filtré, « Mise en route » à `N sur 8` et huit liens, bande
  habilitations → écrans filtrés). Capture AVANT/APRÈS 1280 et 375 px du tableau de bord de
  la direction (`docs/propositions/9F1-TABLEAU-DE-BORD-DIRECTION-ADMIN/captures/`).

  **Une assertion existante corrigée, pas affaiblie** : « ni l'alerte P1 ni \<texte\>
  "Interventions sans durée" » matchait par simple texte libre (`getByText`), qui rougissait
  dès ce lot — le MÊME libellé français (`"Interventions sans durée"`) nomme à la fois le
  titre de la carte (qui doit rester absente chez la direction, inchangé) ET un point de
  « Données à compléter » (`donnees_a_completer.kpi_interventions_sans_duree`, qui, lui,
  s'affiche légitimement puisque la direction reçoit désormais ce bloc). Le sélecteur est
  désormais `getByRole("heading", { name: ..., exact: true })`, qui ne cible QUE le titre de
  carte (un `<h2>`, `components/ui/carte.tsx`) — la carte reste prouvée absente, avec la
  même rigueur qu'avant, sans faux rouge sur une collision de texte entre deux concepts
  distincts.

- **Épreuves voisines** (`git grep -l "tableau-de-bord" tests/e2e`) : vérifié par lecture
  qu'aucune autre ne cite `Role.direction`/`Role.admin_societe` — toutes les autres
  couvrent la scène ADV/responsable matériel/responsable SAV, non touchée par ce lot.

## Documentation

`docs/arbitrages.md` — D209 (nouvelle décision), amende D185, D189 et D199 (ligne « Amendé
par D209 » ajoutée aux trois, et la phrase de D199 « le tableau de bord de la direction
garde sa composition » précisée comme ne valant que pour son propre lot).
`tests/unit/docs/amendements-arbitrages.test.ts` — les trois paires attendues ajoutées à
`AMENDEMENTS_ATTENDUS`. `docs/backlog.md` — cinq tickets (L0-06, L0-06b, L7-01, L7-03,
L7-04) relus contre D199 amendée, aucun n'avait d'affirmation périmée par ce changement
(aucun ne discute la composition du tableau de bord) ; empreintes de relecture
remplacées par celles que le gardien a calculées.

## Ce qui reste ouvert

Rien d'identifié hors territoire de ce ticket. La condition de réouverture de D209 : si une
tuile, un bloc ou un décompte neuf s'ajoute à la composition de l'administrateur de
société, `TUILES_PAR_COMPOSITION[Role.direction]` et `DECOMPTE_PAR_COMPOSITION[Role.direction]`
ne le suivront pas automatiquement — ce sont des listes écrites à la main.
