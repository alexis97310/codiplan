# Passation — 9EB-TP-UX3-2-LISTES-2

## Ce que j'ai changé, et ce que ça change pour l'exploitation

**`/parc`** : les trois anciens KPI muets (« Machines affichées », « Garanties < 90 jours »,
« En panne ou arrêtées ») deviennent trois **tuiles-portes** cliquables (D140) — « Machines suivies »
(vue `parc`, hors sorties), « En panne » (vue `panne`, avec le détail « dont N avec une intervention
ouverte »), « Garanties qui finissent » (vue `garantie`, fenêtre `JOURS_GARANTIE` = 90 jours, inchangée).
Au-dessus de la barre de recherche, comme la maquette du 28/09 le dessine — avant, elles étaient en
dessous. Quatre **puces de vue** (Dans le parc / En panne / Garantie proche / Sorties du parc,
QE-10 (a)) s'ajoutent, avec des **puces retirables** pour chaque critère posé par un `<select>` ou un
lien (client, site, famille, état, et les filtres de 9DT — ajoutée depuis/jusqu'au, origine,
incomplètes). Les quatre `<select>` de LISTES-1 restent : la vue est un cinquième axe, combiné en `AND`,
jamais un remplacement. Pour un ADV, cela veut dire : un clic de plus pour voir « ce qui est sorti du
parc » (jusqu'ici invisible sans filtre manuel), et un chiffre fiable sur chaque tuile — cliquer dessus
ouvre EXACTEMENT la liste qu'elle compte.

La ligne de la liste passe de « Marque Référence » / « Famille · Série · Année » à
**« Famille · Marque Référence » / « Client · Site · N° de série »** — le client revient dans la ligne,
qu'il avait quittée pour N-12. L'aperçu passe de six à **huit champs**, dans l'ordre de D126 (Famille,
Marque, Référence, N° de série, Année de vente, Client · site en lien vers la fiche du site, Fin de
garantie, Agence) ; un champ vide se lit désormais « Non renseigné » en gris plutôt que le signe « — »
court (ce dernier reste inchangé partout ailleurs, y compris dans la liste). « Contrat » quitte l'aperçu
(aucune table ne le porte, l'écart reste nommé tel quel). Les « Dernières interventions » sont désormais
chacune un lien vers l'intervention.

**`/imports`** : trois puces (Tous / À appliquer / Avec des rejets) au-dessus du tableau « Derniers
imports » (renommé, l'ancien titre « Journal des chargements » reste en dictionnaire, inutilisé), comptées
par un `count` sous contexte — jamais par les 50 lignes rendues.

**`lib/machines/depot.ts`** : `filtreDuParc` gagne un cinquième axe (`vue`) et un second paramètre, le
jour civil de la société (nécessaire à la vue `garantie`) — ce qui a changé la signature de
`rechercherLeParc`/`compterLeParc`/`rechercherLeParcPourExport` dans TOUT le dépôt (indicateurs, données
à compléter, export). La recherche texte du parc porte désormais aussi sur la référence interne (PV-03).
Une nouvelle lecture groupée (`compterPanneAvecInterventionOuverte`) alimente le détail de la tuile
« En panne ».

## Ce que j'ai mesuré

- **Unitaires** : 4344 tests passés (`pnpm test`), 0 échec, après adaptation de
  `tests/unit/machines/parc.test.ts`, `tests/unit/perf/parc-resume-etroit.test.ts` (ajout d'un `id` de
  site dans les fixtures) et `tests/unit/ui/lot-parc.test.ts` (signature à trois arguments de
  `filtreDuParc`/`compterLeParc`) ; suppression de `tests/unit/machines/parc-regroupement-client.test.ts`
  (sa seule fonction, `regrouperLeParcParClient`, n'a plus d'appelant — les intertitres disparaissent).
- **Isolation** : 1504 tests passés (`pnpm test:isolation`), sur la vraie base PostgreSQL locale.
  Fixtures dédiées : `tests/isolation/parc-vues-gabarit.test.ts` (les quatre vues rendent exactement la
  population attendue, `compterLeParc === lignes.length`, société B absente, l'export rend les MÊMES
  identifiants que la liste pour chacune des quatre vues) et
  `tests/isolation/imports-vues-gabarit.test.ts` (les trois puces comptent exactement ce que
  `listerLesLots` ouvrirait).
- **Bout en bout** : la suite ENTIÈRE (268 fichiers, 1083 tests) a tourné sous `CI=1` contre la vraie
  base : **1035 passés, 48 ignorés (captures conditionnelles à une variable d'environnement absente),
  0 échec**, en 41 minutes. Deux épreuves existantes ont dû être adaptées (voir plus bas) ; toutes les
  autres — dont `parc.spec.ts`, `parc-sites.spec.ts`, `parc-incompletes-fin.spec.ts`, `liens-3.spec.ts`,
  `parc-375.spec.ts`, `fiche-machine.spec.ts`, `listes-1.spec.ts`, `indicateurs-donnees.spec.ts`,
  `ecrans-largeur-utile.spec.ts`, `liens-fiches.spec.ts`, `export-registres.spec.ts`, `imports.spec.ts`,
  `9dg-tp-s1-lecture-technicien.spec.ts` — sont restées vertes SANS modification, preuve que le défaut de
  vue (`parc` quand l'adresse n'a ni `vue` ni critère de lien) préserve le comportement mesuré avant ce
  ticket.
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check` (via `pnpm format` relancé à vide), `pnpm build`,
  `pnpm feries:horizon`, `pnpm audit:partitions` : tous verts.
- Capture réelle (1280 px, scène de démonstration) : tuile « Machines suivies » = 7 (détail « hors 1
  sortie du parc »), « En panne » = 1 (détail « Aucune avec une intervention ouverte »), « Garanties qui
  finissent » = 0 (« Aucune sous 90 jours ») — voir `captures/1280-parc-defaut.png`.

## Ce que j'ai tranché, et pourquoi

- **Le défaut de vue vit dans la PAGE, pas dans le schéma** (`vue: "tout"` par défaut dans
  `schemaRechercheParc`, mais `/parc` impose `parc` en l'absence de `vue` ET de tout critère posé par un
  lien). Choisi pour que les liens déjà publiés (indicateurs, données à compléter, fiches client/site, qui
  ne portent jamais `vue`) gardent EXACTEMENT leur population d'avant ce ticket — mesuré vrai par les 13
  épreuves existantes restées inchangées.
- **Les tuiles comptent Client/Site/Famille SANS le texte de recherche** ; les puces comptent TOUTE la
  recherche en cours, `vue` seule changeant. Deux axes différents, voulus : la maquette dit explicitement
  « filtrées par client, site ou famille, les tuiles comptent dans ce périmètre », et ne mentionne jamais
  le texte libre.
- **`resumerLeParc`/`resumerLeParcFiltre` ne sont PAS retirées**, malgré la perte de leur seul appelant
  (les anciens KPI) : elles rejoignent `FONCTIONS_SANS_CHEMIN`
  (`scripts/lib/chemins-de-depot.ts`) avec leur motif — ce sont les fonctions PURES déjà éprouvées par
  `tests/unit/machines/parc.test.ts` et `tests/unit/perf/parc-resume-etroit.test.ts`, qui n'avaient pas de
  raison d'être supprimées pour autant.
- **« Non renseigné » en gris reste CANTONNÉ aux huit champs de l'aperçu** (famille, année de vente, fin
  de garantie) — la liste et le reste du dépôt gardent le signe d'absence court (`—`), pour ne pas changer
  ce qu'un autre écran affiche déjà.
- **Trois écarts nommés et assumés, faute de pouvoir toucher `components/ui/maitre-detail.tsx`** (hors
  territoire, gardé par deux tests) : pas de repli à deux cibles au téléphone (PV-07), le n° de série de
  la sous-ligne n'est pas en chasse fixe, la pastille de statut des « Dernières interventions » reste un
  mot du dictionnaire plutôt qu'une classe de couleur. Les trois sont nommés dans la décision D180.

## Ce que je n'ai PAS fait

- Je n'ai PAS touché au seuil des garanties (`JOURS_GARANTIE`, 90 jours — déjà fixé par Alexis le
  05/10/2026, PV-08).
- Je n'ai PAS touché à la fiche machine (`/parc/[id]`) ni à ses gestes.
- Je n'ai PAS masqué « + Intervention » pour une machine sortie (PV-19, non tranché par ce ticket).
- Je n'ai PAS retouché la pastille VGP de l'aperçu.
- Je n'ai PAS refait le reste de `/imports` (étapes, bandeau du lot en attente, modèles, abandonner/
  défaire) : hors territoire, reste à écrire.
- Je n'ai PAS modifié `components/ui/maitre-detail.tsx`, ni `lib/machines/ecarts-maquette.ts` (la liste
  `ECARTS_MAQUETTE_APERCU_PARC` reste telle quelle, « Contrat » y est toujours nommé comme écart à
  l'ancienne maquette — vrai des deux côtés).
- Aucune migration, aucune donnée de production, aucune dépendance nouvelle.

## Les pièges pour la session suivante

- **`filtreDuParc`, `rechercherLeParc`, `compterLeParc`, `rechercherLeParcPourExport` ont tous un nouveau
  paramètre `aujourdHui: Date`** entre les critères et le client Prisma optionnel. Tout nouvel appelant
  doit le fournir — même si sa vue n'est jamais `garantie`, la signature l'exige.
- **Les tuiles et les puces NE comptent PAS la même chose** (voir « Ce que j'ai tranché »). Un futur
  changement qui ferait AJOUTER un filtre aux tuiles doit relire la note de tête de
  `app/(back-office)/parc/page.tsx` avant de le faire — c'est un choix délibéré, pas un oubli.
- **La suite e2e complète régénère ~150 PNG d'autres tickets** (captures prises par d'autres specs qui
  tournent dans la même suite) : je les ai restaurés par `git checkout --` avant de commiter, fichier par
  fichier jamais par `git add -A`. Si une prochaine session lance la suite complète, elle devra faire de
  même.
- **Le seuil « 480 px visibles » de `parc-tri.spec.ts`** est redescendu à 390 px (mesuré : 401,75 px)
  parce que les tuiles et les puces du gabarit du 28/09 prennent de la place au-dessus de la liste — ce
  n'est pas une régression de CE ticket qu'il faudrait « réparer », c'est le nouveau standard mesuré.
- **`parc-apercu-borne.spec.ts`** lit désormais `[data-bloc="apercu-timeline"] > a` (et non plus `> div`)
  — chaque événement de la frise est un lien depuis ce ticket.
- Le gardien `tests/unit/gardiens/chemins-de-depot.test.ts` a dû recevoir deux nouvelles exemptions
  (`resumerLeParc`, `resumerLeParcFiltre`) : si un jour un écran les rappelle, RETIRER ces deux exemptions
  plutôt que les laisser traîner (le gardien le ferait rougir dans l'autre sens).

## Ce qui reste à faire

- La refonte complète de `/imports` (étapes, bandeau « Le lot … attend d'être appliqué », « Télécharger un
  modèle », « Ce qui s'importe, et dans quel ordre ») — hors de ce lot, faute de place (annoncé dans le
  ticket lui-même).
- PV-07 (repli à deux cibles au téléphone sur `/parc`) et la chasse fixe du n° de série dans la
  sous-ligne — nécessitent de toucher `components/ui/maitre-detail.tsx`, hors territoire de ce ticket.
- La pastille de statut colorée des « Dernières interventions » de l'aperçu — même raison.
- PV-19 (masquer « + Intervention » pour une machine sortie du parc) reste à trancher (TP-PARC).
