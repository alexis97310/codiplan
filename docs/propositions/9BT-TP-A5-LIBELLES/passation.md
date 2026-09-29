# Passation — 9BT-TP-A5-LIBELLES

## Ce que j'ai changé

1. **PV-02 — « Agence CODIMA » retiré de l'aperçu et de la fiche machine.**
   `parc/page.tsx` et `parc/[id]/page.tsx` composent désormais `mot("agence")`
   seul ; les clés `parc.kv_agence_suffixe` et `machine.fiche.kv_agence_suffixe`
   (valeur « CODIMA ») sont supprimées du dictionnaire. La divergence avec la
   maquette (qui garde « Agence CODIMA » en `<dt>`) est un écart de CONTENU
   nommé — `ECARTS_MAQUETTE_CONTENU_APERCU_PARC` (nouvelle liste) et une
   entrée ajoutée à `ECARTS_MAQUETTE_CONTENU_FICHE`, motivés par D29 et D128
   cas 1.
2. **TR-28 — le portail ne nomme plus « CODIMA » en dur.** `portail.
   sous_titre` et `portail.sans_lieu` deviennent des paires de demi-phrases
   (`_avant`/`_apres`), composées dans `sousTitreDuPortail`/`sansLieuDuPortail`
   (`app/(portail)/portail/presentation.ts`) autour de
   `chromeDeLaRequete().theme.nom` — la raison sociale réelle de la société
   qui sert la page, jamais une constante. Pour l'exploitation : un compte
   portail d'une société qui n'est pas CODIMA lit désormais SA société, pas
   celle d'une autre.
3. **TR-53 — le refus « temps manquant » ne nomme plus « Winpro ».**
   `intervention.refus.temps_manquant` dit « ... se traite dans votre
   logiciel de facturation ... » (décision d'Alexis).
4. **PA-11 — statut « Remplacé le » sur un ancien taux horaire.**
   `statutDuTaux` (nouveau `app/(back-office)/parametres/taux-horaire/
   presentation.ts`) dérive, depuis l'ordre `date_effet desc` déjà lu par la
   page, la date à laquelle chaque ligne plus ancienne que le taux en
   vigueur a été remplacée. Pour l'exploitation : un directeur qui consulte
   l'historique voit maintenant POURQUOI une ligne n'est plus en vigueur,
   pas une cellule vide.
5. **PA-18 — le calcul n'applique que le déplacement, le verdict le dit.**
   `verdict` (nouveau `app/(back-office)/parametres/forfaits/presentation.ts`)
   rend `forfaits.non_applique` (« Non appliqué par le calcul aujourd'hui »)
   pour tout forfait actif dont la nature n'est pas le déplacement — avant
   ce lot, ces natures affichaient à tort « Retenu »/« Applicable après »/
   « Écarté », des verdicts qui décrivent une sélection que
   `lib/interventions/depot.ts` ne fait jamais pour elles. Le déplacement
   garde ses trois verdicts, « Inactif » reste inchangé pour toute nature.
   **Aucun calcul de valorisation n'est modifié.**
6. **PA-19 — la zone sans forfait de déplacement se dit.**
   `phraseSansForfaitDeDeplacement` lit la même `forfaitRetenu` que la page
   utilisait déjà (restreinte aux déplacements actifs) ; quand elle rend
   `null` (catalogue vide compris), la page affiche désormais « Aucun
   forfait de déplacement pour cette zone : le déplacement n'est pas
   facturé. » au lieu de laisser la section disparaître sans explication.
7. **CS34 — les aides de temps de trajet ne promettent plus les tournées.**
   D107 Q3 diffère les tournées après D74 ; `site.temps_trajet_min.aide` et
   `trajets.explication_planification` ne les mentionnent plus, seulement le
   calcul de charge.
8. **CS1 — le badge de la carte client accorde au masculin.** `client.actif`
   (« Actif ») remplace `clients.etat.actif` (« Active ») sur le badge ;
   `clients.inactif` devient « Inactif » (au lieu de « inactive »). Le
   sélecteur « État de la fiche » de la fiche client (`clients.etat.actif`/
   `clients.etat.inactif`) n'est pas touché — CS1 ne vise que le badge de
   liste. `CarteClient` est extraite dans son propre fichier
   (`app/(back-office)/clients/carte-client.tsx`) : un `page.tsx` de l'App
   Router n'accepte que les exports que Next.js reconnaît, et le composant
   devait être exporté pour un gardien de rendu direct.

Aucune règle de gestion, aucun calcul de valorisation, aucune requête de
taux ou de forfait n'a changé de comportement — seul ce que l'écran EN DIT a
changé (PA-18 corrige un affichage qui décrivait un calcul faux, il ne
change aucun montant facturé).

## Ce que j'ai mesuré

- `pnpm verify` (format:check + typecheck + lint + test + test:isolation +
  build) : **vert**, à chaque commit.
- `pnpm test:isolation` : 135 fichiers, 1290 scénarios, verts.
- `pnpm test` (unitaire) : 463 fichiers, 4606 scénarios, verts — dont les
  nouveaux `tests/unit/i18n/sans-nom-de-societe.test.ts` (rouge sur main
  avant ce lot, sur les 5 clés PV-02/TR-28/TR-53 mesurées par l'audit),
  `tests/unit/i18n/aides-sans-tournees.test.ts`, `tests/unit/portail/
  presentation.test.ts`, `tests/unit/parametres/{taux-horaire,forfaits}-
  presentation.test.ts`, `tests/unit/clients/carte-badge.test.tsx`, et
  l'extension de `tests/unit/machines/ecarts-maquette.test.ts`.
- `pnpm chemins` : aucun nouvel orphelin (le déplacement de `CarteClient`
  dans `carte-client.tsx` reste atteint depuis `app/(back-office)/clients/
  page.tsx`).
- Captures AVANT/APRÈS des sept écrans touchés, à 1280 et 375 px — voir
  `captures/README.md`. Chaque paire confirme visuellement le défaut sur le
  code AVANT (commit `11dc4da`) et sa correction sur le code livré (commit
  `e233820`) : « Agence CODIMA » → « Agence », badge « Active »/« inactive »
  → « Actif »/« Inactif », « Winpro » → « votre logiciel de facturation »,
  statut vide → « Remplacé le 01/01/2020 », « Retenu » sur une prestation →
  « Non appliqué par le calcul aujourd'hui », section muette → phrase PA-19.
- `/portail` : NON capturé — refus mesuré (D10, aucun compte portail ne
  peut ouvrir de session aujourd'hui), documenté dans `captures/README.md`
  avec le même constat que `ERGO-PRISE-DE-VUE`. Non vérifié visuellement en
  conséquence ; les deux fonctions de composition (`sousTitreDuPortail`,
  `sansLieuDuPortail`) sont couvertes par un test unitaire de rendu à la
  place.

## Ce que j'ai tranché et pourquoi

- **Les quatre textes neufs sont ceux du corps du ticket**, tels que
  décidés par Alexis le 29/09/2026 : « Ce que \<raison sociale\> suit pour
  vous... », « ... votre interlocuteur chez \<raison sociale\>. »,
  « Remplacé le JJ/MM/AAAA », « Non appliqué par le calcul aujourd'hui ».
  Restent à valider par Alexis (listés aussi ci-dessous).
- **`verdict` prend la nature en paramètre plutôt que de la lire sur
  `forfait.type`** : signature demandée par le corps du ticket, cohérente
  avec l'appel existant depuis `Nature()` qui connaît déjà sa propre nature.
- **La phrase PA-19 se rend dans la PAGE, pas dans `Nature`** :
  `Nature` retourne `null` quand `lignes.length === 0`, donc un catalogue
  totalement vide de déplacement ne pourrait jamais y afficher la phrase.
- **Le test du badge client (`carte-badge.test.tsx`) est un rendu direct
  React Testing Library**, pas un scénario e2e : précédent déjà posé par
  `tests/unit/navigation/barre-du-portail.test.tsx`. Plus rapide, et évite
  d'ajouter une dépendance à une session e2e pour une seule assertion de
  texte.
- **Le catalogue de forfaits des captures jetables REMPLACE celui du semis
  et de la scène e2e partagée** (delete puis deux lignes neuves, scopées à
  `grand_noumea`) : c'est la seule façon de montrer une zone SANS aucun
  forfait de déplacement, ce qu'aucune zone de la base partagée ne peut
  démontrer (`FORFAITS_SCENE` et `FORFAITS_DEMONSTRATION` posent tous deux
  des forfaits universels, sans condition de zone).

## Ce que je n'ai PAS fait

- **Hors lot, nommé par l'audit, non touché** : le troisième statut de
  PA-11 (« À partir du ... » pour un taux futur) ; la limite de PA-18 sur la
  création de forfait (proposition « limiter à la nature déplacement »,
  explicitement laissée « à confirmer ») ; « depuis le rattachement » du
  libellé `site.temps_trajet_min` (CS34/D107 Q1) ; `lib/imports/vgp.ts:132`
  (grammaire d'import, pas un libellé d'écran).
- **Aucune migration, aucune ligne de semis, aucun prix modifié.**
- **`/portail` non capturé** — voir ci-dessus.
- **TP-A5b (planning, absences, trajets, fiche intervention)** — hors
  territoire de ce corps, à lancer séparément sur `main` à jour.

## Les pièges pour la session suivante

- **`FORFAITS_SCENE`/`FORFAITS_DEMONSTRATION` sont tous deux `type:
  "deplacement"`, `zone_geo: NULL` (universels)** : toute zone de la base
  e2e partagée a donc TOUJOURS un déplacement « Retenu ». Un scénario qui
  voudrait démontrer PA-19 sur la base partagée échouera silencieusement
  (la phrase ne s'affichera jamais) sans cette information.
- **La contrainte d'unicité `(societe_id, date_effet)` de `taux_horaire`** :
  la scène e2e pose déjà une ligne au 01/01/2020 (`tests/e2e/setup/
  scene.ts`) — toute ligne neuve doit choisir une autre date.
- **`captures-tpa5-libelles-throwaway.spec.ts` REFUSE de s'exécuter si
  `E2E_DATABASE_URL` nomme `codiplan_test`** (gardien explicite en tête du
  fichier) : c'est voulu, pas un bug à contourner — invoquer ce fichier
  exige de pointer `E2E_DATABASE_URL` sur une base jetable dédiée, jamais la
  base partagée.
- **`CarteClient` a quitté `page.tsx`** : `tests/unit/theme/
  lien-visible.test.ts` tient une liste FERMÉE des fichiers qui portent
  `CLASSES_LIEN` — elle a dû être mise à jour (le chemin change, pas le
  compte). Un futur déplacement similaire d'un composant hors d'un
  `page.tsx` devra faire le même geste.

## Ce qui reste à faire

- Faire valider par Alexis les quatre textes neufs cités dans « Ce que j'ai
  tranché ».
- Lancer TP-A5b (planning, absences, trajets, fiche intervention) sur `main`
  à jour, dans une session séparée.
- Les quatre points explicitement hors lot listés ci-dessus, s'ils sont un
  jour repris.
