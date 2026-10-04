# 9DK-PG-G15A-ABSENCE-ECOURTER — passation

## Ce que j'ai changé

**QG-8 bis — « Absence » partout à l'écran.** 19 clés de `lib/i18n/fr.ts`
(`absences.titre`, `absences.declarer`, `absences.aucune`, `absences.pastille_bloque`,
`absence.refus.*`, `intervention.refus.absence`, `intervention.technicien_agenda_bloque_le`,
`intervention.disponibilite_technicien.fenetre`, `tableau_de_bord.kpi_absences_jour`,
`tableau_de_bord.lien_absences_jour`, `planning.agenda_bloque`,
`planning.legende.agenda_bloque`, `planning.resume_agenda_bloque_un`,
`planning.resume_agendas_bloques`), le témoin des captures
(`scripts/captures.mts`), les écarts nommés (`lib/absences/ecarts-maquette.ts`)
et le docblock de `app/(back-office)/absences/page.tsx` disent désormais
« absence »/« absent » plutôt que « blocage »/« agenda bloqué ». Les noms de
code (table, colonnes, fonctions, triggers, `data-bloc`) ne changent pas. Pour
l'exploitation : le titre de l'écran redevient « Absences », cohérent avec
l'entrée de menu — ce que 99D-ABSENCES-2 demandait sans trancher.

**QT-15 — état par ligne, Écourter remplace Lever pour une absence en cours.**
`lib/absences/periode.ts` expose `etatAbsence` (pure, "a_venir" | "en_cours" |
"terminee", bornes comprises). `lib/absences/depot.ts` expose `ecourterAbsence`
(nouvelle fin entre aujourd'hui et l'ancienne fin, jamais avant le début,
refus nommés) ; `leverLeBlocage` refuse désormais sur une absence déjà
commencée (`absence.refus.deja_commencee`). Nouvelle route
`POST /api/absences/ecourter` ; `lever` passe sous `exigerCapaciteComplete`
(seul le ● agit sur une ligne déjà posée). Pour l'exploitation : le tableau de
`/absences` montre une colonne « État » et l'action qui convient — plus de
bouton « Lever » universel qui supprimait n'importe quelle ligne quel que soit
son état.

**QT-23 — la tuile devient « Absents aujourd'hui ».** Remplace « Demandes à
valider / Sans objet » (sans objet depuis R3-14), même critère que le tableau
de bord. Le `data-bloc="kpi-demandes-valider"` est gardé à l'identique.

**TR-5 — un technicien déclare sa propre absence.** `modifier_planning` passe
à `{ complet: [...], restreint: [TEC] }` (`lib/auth/habilitations.ts`). La
route `declarer` (déjà `exigerCapacite`) laisse donc passer le ○ ; les routes
`ecourter`/`lever` (`exigerCapaciteComplete`) le ferment. Le trigger
`absence_declaree_pour_soi` reste le seul garde-fou pour « pour soi, jamais
pour un autre ». Pour l'exploitation : un technicien peut enfin déclarer sa
propre absence depuis son compte, ce qu'aucun rôle technicien ne pouvait
faire avant ce lot.

**TR-3 — le tableau n'a plus de borne haute à 90 jours.** `lireLesAbsences`
accepte `au: Date | null` (`null` = pas de borne). Une absence déclarée loin
dans l'avenir reste visible — et donc gérable — jusqu'à son terme.

**QE-13e — les 4 semaines suivantes, en bandes.** Nouvelle fonction
`semainesSuivantes` (`app/(back-office)/absences/presentation.ts`), aucune
requête supplémentaire (déjà incluses par la levée de la borne haute de TR-3).

**MO-31 — lien « Déclarer une absence » depuis le planning.** En-tête de
ligne d'un technicien (Semaine et Jour), vers `/absences` pré-rempli
(personne, `du=au=aujourd'hui`, `apercu=1`). Gardé par `peutModifierLePlanning`
— un technicien le voit sur sa propre ligne (puisqu'il a maintenant le ○).

**Constat 8 (défaut de fuseau, corrigé).** `periodesBloquees` comparait des
instants zonés à des dates civiles en lisant leur date UTC nue — sous
`Pacific/Noumea` (UTC+11), un lundi ENTIER bloqué (240 min, le seul jour ouvert
du calendrier fixture de l'agence A) ne retranchait que 60 des 240 minutes du
dénominateur du taux d'occupation. Corrigé : la fonction prend le fuseau en
paramètre, relit la fenêtre en jour civil LOCAL, et rend des instants réels
zonés. Pour l'exploitation : le taux d'occupation d'un technicien à Nouméa (et
dans tout fuseau positif) était **faussement optimiste** pendant une absence —
ce lot le corrige sans migration, aucune donnée en base n'est à reprendre (le
calcul est fait à la lecture, jamais matérialisé).

**D136** écrite dans `docs/arbitrages.md` — le numéro était réservé depuis le
27/09/2026 (QG-8 bis) et resté en blanc entre D135 et D137. Elle tranche QG-8
bis/QT-15/QT-23/TR-5/QE-13e, lève la réserve de 99D-ABSENCES-2, et marque TR-3/
QE-13e/MO-31 comme « précisions du pilote, à valider par Alexis » (voir
ci-dessous, « ce que j'ai tranché »). `docs/backlog.md` : 99D-ABSENCES-2 passe
de BLOQUÉ à LIVRÉ, citant D136.

## Ce que j'ai mesuré

- `pnpm format:check`, `pnpm typecheck`, `pnpm lint`, `pnpm test` (unitaires,
  3936 tests) et `pnpm test:isolation` (1379 tests) — tous verts après chaque
  commit, pas seulement à la fin.
- Épreuve de bout en bout neuve (`tests/e2e/absences-ecourter-etat.spec.ts`,
  8 scénarios, scène propre `ABSECO-`) : état et action de chaque ligne,
  tuile « Absents aujourd'hui » (page et tableau de bord), pastille dans les
  4 semaines suivantes, écourtement effectif en base, suppression effective
  après confirmation, affordances du technicien connecté (lecture seule, sur
  `COMPTE_TECHNICIEN_EPREUVE` — jamais d'écriture sur cette identité
  partagée), lien MO-31 (Semaine et Jour, sur un jour ouvré explicite : le
  dimanche ferme toutes les agences fixtures).
- Épreuve unitaire neuve (`tests/unit/absences/periode.test.ts`) qui prouve
  `periodesBloquees` exacte sous `Pacific/Noumea`, ET l'épreuve d'isolation
  neuve (`occupation-absences.test.ts`) qui prouve que bloquer le seul jour
  ouvert d'une semaine (calendrier fixture de l'agence A, lundi 08:00-12:00,
  240 min) vide exactement le dénominateur — **mesurée ROUGE avant le
  correctif** (60 min retranchées au lieu de 240, dénominateur résiduel de
  180 au lieu de 0), VERTE après.
- AVANT/APRÈS : je n'ai PAS rejoué la procédure complète (checkout du commit
  parent, capture, retour) — faute de temps dans la fenêtre de 210 minutes.
  Les captures prises (`docs/propositions/9DK-PG-G15A-ABSENCE-ECOURTER/
  captures/`) sont donc des captures APRÈS seulement, à 1280 px (et 375 px
  pour l'état/actions du tableau). **Ce que je n'ai pas vérifié reste non
  vérifié** : je n'ai pas de preuve visuelle de l'écran AVANT ce lot.

## Ce que j'ai tranché, et pourquoi

Les documents du Projet cités par le ticket (`claude/mesure-abs-parc-03-10.md`,
`claude/decisions-alexis-03-10.md`) **n'existent pas** dans ce dépôt — ni sur
le disque, ni dans l'historique `git` (vérifié par une recherche exhaustive
avant de commencer). Faute d'eux, j'ai pris moi-même, comme pilote, les trois
précisions d'application que le ticket laissait ouvertes, en suivant la
consigne d'Alexis « ne reste pas bloqué » :

- **TR-3** : « plus de borne haute » plutôt qu'une borne reculée (ex. 6 mois) —
  parce qu'une borne reculée reporte le même défaut plus loin, sans le
  résoudre.
- **QE-13e** : les 4 bandes réutilisent `JourDuCalendrier` et `vue.absences`
  tels qu'ils existent déjà (aucun nouveau composant, aucune nouvelle
  requête) — pour rester dans l'esprit « EN PLUS, rien d'autre ne change ».
- **MO-31** : le lien pré-remplit `du=au=aujourd'hui` plutôt que le jour
  précis de la cellule survolée, en Vue Semaine (une ligne y couvre 7 jours,
  « aujourd'hui » est la seule date non ambiguë) ; en Vue Jour, `jourAffiche`
  aurait été tout aussi juste mais j'ai gardé la même règle dans les deux vues
  pour ne pas faire deviner une différence de comportement.

Ces trois choix sont marqués « à valider par Alexis » dans D136 — ce sont des
choix de pilote, pas des arbitrages.

J'ai aussi tranché, sans les marquer comme choix du pilote (ce sont des
conséquences mécaniques, pas des choix) :

- **La tuile « Absents aujourd'hui »** affiche le détail (liste des noms)
  plutôt qu'un lien de navigation — même forme que la tuile « Rupture de
  service » déjà sur cette page, pour deux tuiles côte à côte qui se lisent
  pareil plutôt que deux idiomes différents.
- **Le témoin « écran COURT »** de `tests/e2e/ecrans-largeur-utile.spec.ts`
  quitte `/absences` (désormais > 900 px à cause de QE-13e, mesuré 1135 px)
  pour `/parametres/societe` (un titre, une carte, deux paragraphes, aucune
  lecture de base).
- **Une assertion préexistante fausse, révélée par le correctif du constat 8**
  (`occupation-absences.test.ts`, « un blocage le fait DIMINUER ») : elle
  affirmait qu'un seul jour bloqué ne pouvait pas vider le dénominateur — vrai
  par accident grâce au défaut de fuseau, sur un calendrier qui n'ouvre QUE ce
  jour-là. Corrigée pour dire ce qui est vrai (`toBe(0)`), avec le motif écrit
  dans le commentaire du test.

## Ce que je n'ai PAS fait

- **La demi-journée / plage horaire (QG-8, le reste du lot PG-G15)** — exige
  une migration, explicitement hors territoire de ce ticket (« Migration :
  NON »).
- **Les captures AVANT** (voir « ce que j'ai mesuré » ci-dessus).
- **Aucune action sur une absence « Terminée »** — aucun bouton, aucune route :
  c'est le sujet même de QT-15, pas un oubli.
- **Aucune modification du périmètre de lecture du technicien** (9DG) : il ne
  voit toujours que sa propre absence, inchangé.

## Les pièges pour la session suivante

- **`claude/mesure-abs-parc-03-10.md` et `claude/decisions-alexis-03-10.md`
  n'existent pas dans ce dépôt.** Si un futur ticket les cite à nouveau,
  vérifier d'abord qu'ils existent avant de s'appuyer sur leur contenu
  supposé — ce lot a dû travailler sans eux.
- **Le dimanche ferme toutes les agences fixtures** (aucune plage ouverte) :
  la vue Jour du planning rend un état vide ce jour-là, sans aucune ligne. Un
  scénario qui vise `/planning?vue=jour` sans `?jour=` explicite est donc
  fragile selon le jour d'exécution — `tests/e2e/absences-ecourter-etat.spec.ts`
  calcule le prochain lundi (`cleDuProchainLundi`) plutôt que de dépendre
  d'« aujourd'hui ». Il existe apparemment un correctif plus général en cours
  (9DW-E2E-DIMANCHE, cité dans les instructions de fin de session) — je ne
  l'ai pas vu passer sur `main` pendant cette session ; à vérifier après le
  rebase final.
- **`periodesBloquees` a changé de signature** (4ᵉ paramètre `fuseau`
  obligatoire) : tout nouveau site d'appel doit passer le fuseau du
  CALENDRIER dont viennent `debut`/`fin`, jamais celui de la société si l'un
  des deux diffère (L3-01a, un technicien peut avoir son propre calendrier).
- **Le corpus `/absences` a grossi** (240 lignes de plus dans `page.tsx`) :
  si un futur ticket y ajoute encore du contenu, vérifier d'abord qu'aucun
  autre scénario ne s'appuie sur sa hauteur ou sur son contenu exact (le
  gardien `lot-a1-a4.test.ts` ne lit que les `data-bloc`, jamais le texte).
- **Le rebase de fin de session n'a pas encore été joué** au moment d'écrire
  cette passation — à faire juste avant de rendre la main, avec `pnpm verify`
  et les specs e2e de ce lot rejouées après.

## Ce qui reste à faire

- La demi-journée / plage horaire (QG-8, migration) — ticket suivant, déjà
  nommé par le pilote précédent.
- Faire valider par Alexis les trois précisions du pilote (TR-3, QE-13e,
  MO-31) marquées dans D136.
- Jouer la procédure AVANT/APRÈS complète si une preuve visuelle de l'écran
  d'avant ce lot devient nécessaire (elle ne l'était pas pour ce lot : le
  code d'avant reste lisible dans l'historique `git`).
