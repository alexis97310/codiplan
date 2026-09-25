# 81-EQUIPE-1 — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

- `lib/techniciens/depot.ts` — nouvelle fonction
  `compterInterventionsAVenirParTechnicien(contexte, utilisateurIds, client?)` :
  une SEULE requête `groupBy` sur `intervention.technicien_id` pour toute la
  liste passée, jamais une par technicien. « À venir » = statut ni `terminee`,
  ni `cloturee`, ni `annulee`, ET `date_planifiee` aujourd'hui (jour civil de
  l'agence, L0-08) ou plus tard — même exclusion que `criteresSansDureeAVenir`
  de `lib/interventions/depot.ts`, réécrite ici (pas importée : le territoire
  du ticket n'ouvrait pas ce fichier, et ce dépôt n'a pas vocation à en
  dépendre). Un technicien sans intervention à venir reçoit `0`, jamais une
  absence de mesure dans la carte retournée (même discipline que
  `lib/absences/depot.ts`).
- `app/(back-office)/parametres/equipe/page.tsx` — pour chaque technicien
  AFFICHÉ (respecte le filtre actifs/tous existant), la fiche de modification
  montre, à côté de la case « Actif », un lien « N intervention(s) à venir »
  vers `/interventions?technicien=<id>` (sans `vue` — voir plus bas) suivi de
  « — à réaffecter si vous le désactivez », quand N > 0.
- `app/api/techniciens/[id]/modifier/route.ts` — après une modification
  ACCEPTÉE qui pose `actif: false`, si ce technicien porte encore des
  interventions à venir, la redirection porte `motif`, `technicien` et `n` (au
  lieu du seul `motif` habituel) : la page recompose l'avertissement avec le
  nombre exact et le même lien. **Rien n'est refusé, rien n'est désaffecté
  automatiquement** — exactement ce que le ticket demande.
- `lib/i18n/fr.ts` — cinq clés neuves sous `equipe.*` (le décompte
  singulier/pluriel composé hors JSX, la note, le libellé du lien, la phrase
  de l'avertissement).

**Pour l'exploitation** : un administrateur qui décoche « Actif » sur un
technicien qui a encore des missions à venir le voit désormais AVANT de
valider (le lien est présent dans la fiche qu'il est en train de modifier),
et se le fait redire après coup s'il l'a quand même fait — avec un lien direct
vers les interventions à réaffecter. Rien ne bloque ni ne réaffecte à sa
place : c'est un rappel, pas une règle de gestion nouvelle.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- AVANT (lecture du code sur `main` à `adf66f6`) : `page.tsx` ne lisait ni
  n'affichait aucun compte d'intervention ; `modifier/route.ts` redirigeait
  toujours vers `versLEquipe(...)` avec au plus un `motif` fixe, jamais de
  paramètre `technicien`/`n`.
- APRÈS — `tests/isolation/equipe-1.test.ts` (5 épreuves, vertes) : une
  identité fictive porte une intervention à venir dans la société A ET dans
  la société B ; le compte pris sous le contexte A rend `1` (jamais celle de
  B), celui pris sous le contexte B rend `1` (jamais celle de A) — le
  cloisonnement I1 tient. Une ligne passée et une ligne clôturée (toutes deux
  dans la société A, même identité) sont exclues : sans ces deux filtres, le
  compte passerait à 3 au lieu de 1.
- APRÈS — `tests/e2e/equipe-1.spec.ts` (2 épreuves, vertes, scène `EQU1-`
  créée et supprimée par le fichier) : un technicien avec deux interventions
  PLANIFIÉES à venir (+3 j, +10 j) et une CLÔTURÉE passée (-10 j) affiche
  « 2 interventions à venir » avec `href="/interventions?technicien=<id>"` ;
  le désactiver pose l'avertissement avec le même « 2 » et le même lien, puis
  le clic y mène réellement ; le technicien redevient bien inactif ensuite
  (comportement `Technicien.actif` inchangé — vérifié par `equipe.spec.ts`,
  toujours vert, 4/4).
- `pnpm verify` (format, typecheck, lint, `pnpm test` 2821/2821,
  `pnpm test:isolation` 1239/1239, build) : vert de bout en bout.
  `pnpm verify:full` (avec `test:e2e` complet, `feries:horizon`,
  `audit:partitions`) n'a PAS été rejoué en entier — seuls les deux fichiers
  e2e concernés (`equipe-1.spec.ts`, `equipe.spec.ts`) l'ont été, tous deux
  verts. C'est un choix de temps, pas une mesure : `11-FILE.sh` rejoue
  `verify:full` de toute façon avant publication.

## Ce que j'ai tranché et pourquoi

1. **Le lien vers le registre ne porte AUCUN `vue`** — le ticket suggère
   `?technicien=<id>&vue=…` avec « la vue "à venir" existante la plus proche ;
   la lire ». Lu `lib/interventions/saisie.ts` (`VUES_REGISTRE`) et
   `lib/interventions/depot.ts` (`criteresVue`) : aucune des six vues
   (`a_planifier`, `aujourdhui`, `en_cours`, `bloquees`, `a_controler`,
   `historique`) ne porte « aujourd'hui ou plus tard, hors
   terminée/clôturée/annulée ». La plus proche PAR LA DATE, `aujourdhui`,
   masquerait une intervention comptée pour demain ou la semaine prochaine —
   un décompte qui dit 2 mais dont le lien n'en montre qu'une serait un défaut
   pire que l'absence de filtre. L'absence de `vue` (« Toutes ») est le seul
   sur-ensemble sûr : il ne peut jamais cacher une ligne que le compte a
   comptée. Documenté dans le code (`lienInterventionsAVenir`).
2. **Le compte porte sur `affiches`, pas sur tous les techniciens de la
   société** — le ticket dit « pour chaque technicien AFFICHÉ » ; la requête
   groupée ne lit donc que les identifiants déjà filtrés par le bouton
   actifs/tous, jamais une liste plus large.
3. **La désactivation compare l'état RÉSULTANT, pas le précédent** — un
   enregistrement qui pose `actif: false` déclenche l'avertissement dès que le
   compte est positif, que le technicien fût déjà inactif ou non avant cette
   soumission. Éviter une lecture supplémentaire de l'état précédent pour un
   cas qui n'est de toute façon jamais un refus.
4. **`compterInterventionsAVenirParTechnicien` réécrit son propre
   `debutDuJourSociete`** plutôt que d'importer celui de
   `lib/interventions/depot.ts` (privé, non exporté, et le territoire du
   ticket n'ouvrait pas ce fichier). Dix lignes dupliquées, documentées comme
   telles dans le commentaire de la fonction.

## Ce que je n'ai PAS fait

- Aucune modification de `lib/interventions/*`, `prisma/`, du planning, ni
  aucune écriture sur `intervention` (le dépôt neuf ne fait que lire).
- Aucune vue de registre neuve (`a_venir`) — hors territoire du ticket, et le
  point 1 ci-dessus explique pourquoi le contournement retenu n'en avait pas
  besoin.
- Rien ne réaffecte ni ne bloque une désactivation : c'est un avertissement,
  jamais un refus, conformément à la consigne.
- Je n'ai PAS rejoué `pnpm verify:full` dans son intégralité (voir mesure
  ci-dessus) ni `pnpm feries:horizon` / `pnpm audit:partitions`, sans lien
  avec ce lot.

## Les pièges pour la session suivante

- Le badge « Actif »/« Inactif » vit dans la LIGNE du tableau
  (`<tr>` de `Tableau`), jamais dans le `<details>` de la fiche de
  modification (qui ne porte que le formulaire et le bloc habilitations) —
  ma première version de `equipe-1.spec.ts` cherchait au mauvais endroit
  (premier rouge, corrigé, second passage vert : voir le commit de correction
  `d9e2190` pour la forme exacte de la requête).
- `intervention.statut IN ('planifiee', 'affectee')` EXIGE
  `duree_estimee_min NON NUL` (contrainte `intervention_planifiee_a_sa_duree`,
  D104/PARCOURS-1) — toute fixture qui pose une de ces deux valeurs sans durée
  échoue au `INSERT`, vu deux fois en écrivant ce lot (isolation puis e2e).
- `intervention.statut` est un type PostgreSQL énuméré : un `$executeRawUnsafe`
  paramétré doit caster explicitement (`$n::"StatutIntervention"`), Postgres
  ne le déduit pas d'un paramètre lié comme il le ferait d'un littéral.
- `compterInterventionsAVenirParTechnicien` suppose une marge de plusieurs
  jours dans les fixtures de date (le fichier e2e utilise ±3/±10/-10 jours en
  UTC) : une fixture à J+0/J-0 pile serait sensible au fuseau de la société de
  démonstration (Nouméa, UTC+11) et pourrait tomber du mauvais côté de minuit
  selon l'heure d'exécution.

## Ce qui reste à faire

- Rien d'identifié dans le périmètre de ce ticket. Une vue de registre
  « à venir » dédiée (si le produit la juge utile un jour) resterait à
  arbitrer et à construire dans `lib/interventions/*` — explicitement hors de
  ce lot.
