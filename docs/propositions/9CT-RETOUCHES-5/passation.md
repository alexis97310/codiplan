# Passation — 9CT-RETOUCHES-5

Dépôt `alexis97310/codiplan`, main local. Commit pilote mesuré au départ : `d80157b`.
Quatre commits de code + un commit de captures + un commit d'arbitrage, tous sur `main`
en local, **rien poussé**.

```
16d14f2 9CT-RETOUCHES-5 — captures AVANT/APRÈS (décision 7)
eacfbda 9CT-RETOUCHES-5 — D141, paragraphe RETOUCHES-5 (décisions 6 et 7)
778fae9 9CT-RETOUCHES-5 — Transmettre toutes les planifiées prêtes exclut les passées (décision 7)
536d824 9CT-RETOUCHES-5 — une Affectée remise dans la file prévient le technicien (décision 6)
1dad3a2 9CT-RETOUCHES-5 — les courriels partent après la transaction
```

**Écart au découpage annoncé par le ticket** : le ticket demandait quatre commits, nommés
dans cet ordre précis. En pratique, un `git add -p` destiné à isoler le commit 2
(`transmettreIntervention` sans doublon) dans `lib/interventions/depot.ts` et
`tests/isolation/transmission-groupee.test.ts` est resté STAGÉ au moment du premier
`git commit`, et a donc été absorbé dans le commit 1 (`1dad3a2`) — ce commit porte en
réalité la scission des envois **et** le filtre société + `updateMany` sans doublon de
`transmettreIntervention`, avec sa preuve de concurrence. Le commit 2 du ticket
(« filtre société explicite et transmission sans doublon ») n'existe donc pas comme
commit séparé ; son contenu est réel et testé, seule l'étiquette manque. Rien n'est perdu,
rien n'est non testé — c'est une erreur de manipulation `git`, pas une case sautée.

---

## 1. Ce que j'ai changé, et ce que ça change pour l'exploitation

**Les courriels d'avertissement partent désormais HORS de toute transaction**
(`lib/avertissements/planification.ts`) — `avertirApresPlanification` et
`avertirApresTransmissionGroupee` lisent et composent un `PlanEnvoi` SOUS le contexte
cloisonné (transaction courte), puis envoient avec `envoyerPlan` APRÈS que la transaction
s'est refermée. **Pour l'exploitation** : un envoi lent (jusqu'à `DELAI_ENVOI_MS` = 10 s,
`lib/courriel/resend.ts`), ou plusieurs envoyés en série (le récapitulatif groupé), ne
peuvent plus faire échouer la transaction de lecture (défaut Prisma 5 000 ms,
`lib/db/rls.ts`) — et donc ne peuvent plus transformer une planification ou une
transmission déjà validée en page d'erreur à l'écran.

**`transmettreIntervention` écrit désormais par un `updateMany` conditionné**
(`statut = "planifiee"`, en plus de `societe_id`) plutôt qu'un `update` inconditionnel.
**Pour l'exploitation** : deux clics de transmission quasi simultanés sur la même ligne
(double clic, deux onglets) n'écrivent plus deux fois et n'envoient plus deux courriels —
le second est refusé, nommé (`intervention.refus.pas_planifiee`), sans erreur serveur.

**Une Affectée remise dans la file (sa date vidée, elle retombe à `A_PLANIFIER`, QG-4)
prévient maintenant le technicien d'avant**, par le courriel « retirée » EXISTANT — celui
d'un changement de technicien (AVERTISSEMENTS-2) — jamais un texte neuf. **Pour
l'exploitation** : un technicien qui voyait déjà une intervention sur son terrain, et à
qui le bureau retire sa date sans lui en assigner une autre, en est maintenant informé
par courriel au lieu de découvrir sa disparition silencieusement. Les deux chemins qui
remettent dans la file (le tiroir du planning, qui efface le technicien en même temps que
la date ; la fiche, qui le garde) produisent ce courriel — c'est `avant.technicienId`,
l'état juste avant l'écriture, qui décide, jamais la colonne actuelle.

**« Transmettre toutes les planifiées prêtes » exclut désormais les Planifiées dont la
date est déjà passée** — seules celles d'aujourd'hui ou plus tard partent ; les passées
sont listées à part sous un motif fermé neuf, `date_passee` (« Date passée — à clôturer,
annuler ou replanifier »), jamais forcées ni effacées. **Pour l'exploitation** : le bouton
« Toutes » ne transmet plus silencieusement des lignes dont la date est révolue — une
Planifiée oubliée la semaine dernière n'est plus poussée au technicien avec hier pour
date, elle apparaît dans la liste des laissées, à traiter à la main (clôturer, annuler,
replanifier). « Transmettre demain » n'est pas concerné (son jour visé est toujours
J+1 ou plus).

**La route `POST /api/interventions/transmettre` ne peut plus répondre 500 après une
transmission déjà validée** — un filet `try/catch` entoure la relecture des
avertissements groupés ; en cas d'accident d'infrastructure sur cette seule relecture
(jamais sur un envoi lent ou refusé par le prestataire, puisque `envoyerCourriel` ne lève
jamais), la transmission reste acquise et le compte-rendu affiché dit « 0 technicien
prévenu » plutôt que de faire échouer toute la requête.

**Alignement de cloisonnement, sans changement de comportement visible** : les lectures
`contact`/`utilisateur` de `lib/avertissements/planification.ts` portent maintenant un
filtre `societe_id` explicite (en plus de la politique RLS déjà en place), comme le reste
du dépôt. La ligne `contact.findMany` nommée dans le constat du ticket (planification.ts,
ex-lignes 519-523) a été alignée — ce n'était pas une exception.

---

## 2. Ce que j'ai mesuré (comptes AVANT/APRÈS)

**Aucune mesure propre de `d19a9d0` n'a été prise avant de commencer à éditer** — non
vérifié, écrit comme tel plutôt que supposé. Ce qui suit est MESURÉ sur HEAD (`CI=1 pnpm
verify:full`) et complété par un compte DÉDUIT du diff exact (`git diff d19a9d0 HEAD`),
jamais par une seconde exécution sur l'ancien code.

**APRÈS ce lot, mesuré** (HEAD) : `pnpm test` 362 fichiers / **3717** tests, tous verts.
`pnpm test:isolation` 140 fichiers / **1317** tests, tous verts.

**Tests ajoutés par ce lot, déduits du diff** (`+  it(` net par fichier, compté précisément,
pas estimé) : unitaires — `tests/unit/interventions/cycle-de-vie.test.ts` +5 (motif
`date_passee`), `tests/unit/avertissements/sans-courriel-dans-la-transaction.test.ts` +4
(fichier neuf, gardien statique) — soit **+9** au total, donc **3708** avant ce lot par
arithmétique. Isolation — `tests/isolation/avertissements-transmission.test.ts` +2 net (un
test renommé PLANIFIÉE/AFFECTÉE, un ajouté, décision 6), `avertissements-transmission-
groupee.test.ts` +1 (garde-fou double envoi lent), `transmission-groupee.test.ts` +2
(concurrence `transmettreIntervention`, `aPartirDe`/`date_passee`) — soit **+5** au total,
donc **1312** avant ce lot par arithmétique.

**Captures AVANT/APRÈS** (`docs/propositions/9CT-RETOUCHES-5/captures/`, scène forgée
`9CTCAP-`, effacée) — sur `/planning`, vue Semaine, commit `d19a9d0` vs `778fae9` :
- « Transmettre toutes les planifiées prêtes » : **28** (avant) → **13** (après). La
  baisse de 15 vient des Planifiées de démonstration du seed (`prisma/seed.ts`) datées
  dans le passé, désormais exclues.
- Liste des laissées : **3** lignes « Sans heure » (avant) → la même liste PLUS toutes les
  lignes « Date passée » (après), dont les deux lignes forgées par le spec de captures.
  Le compte exact de lignes « Date passée » DÉRIVE avec le temps (la démonstration ne
  rajeunit pas) ; ce n'est pas un invariant, voir le README des captures.

**`CI=1 pnpm verify:full`, résultat complet** (log intégral conservé le temps de cette
session, non committé) :
- `format:check`, `typecheck`, `lint` : verts.
- `pnpm test` : **3717 passés / 3717**.
- `pnpm test:isolation` : **1317 passés / 1317**.
- `pnpm run build` : vert.
- `feries:horizon`, `audit:partitions` : verts.
- `pnpm test:e2e` : **767 passés, 7 skipped, 1 did not run, 1 ÉCHOUÉ** —
  `tests/e2e/planning-jour-en-tete.spec.ts:102` (« l'en-tête dit qui est bloqué, et le
  compte de créneaux libres reste affiché »). **Hors territoire de ce lot.** Détail et
  analyse sous « Le conflit non résolu », plus bas.

`CI=1 pnpm verify:full` **n'est donc PAS vert dans son ensemble** à la fin de cette
session, à cause de ce seul test étranger.

---

## 3. Ce que j'ai tranché et pourquoi

**La scission lecture/envoi se fait par un type interne `PlanEnvoi`**, plutôt que de
passer un `delais` plus généreux à `avecContexteApplicatif`. Un délai plus long aurait
gardé le défaut structurel (un envoi reste capable de bloquer une transaction, juste plus
longtemps) ; la scission l'élimine par construction — c'est pourquoi un gardien STATIQUE
(`tests/unit/avertissements/sans-courriel-dans-la-transaction.test.ts`) l'exige, plutôt
qu'un simple test dynamique qui ne prouverait qu'un cas précis.

**Le garde-fou dynamique (double envoi lent) utilise une horloge RÉELLE, pas simulée.**
Première tentative avec `vi.useFakeTimers()` : le test a timeout à 30 s — l'horloge
simulée interfère avec les véritables allers-retours Postgres du harnais d'isolation
(mesuré, non exploré plus loin : un seul red, pas deux, avant de changer d'approche).
Deuxième tentative, horloge réelle avec un délai de 5 200 ms par envoi (juste au-dessus du
défaut Prisma de 5 000 ms) : passe en ~10,5 s. Le test est donc RÉELLEMENT lent (accepté,
documenté en commentaire) plutôt que simulé à tort.

**`transmettreIntervention` relit la ligne par `findFirstOrThrow` après l'`updateMany`**
plutôt que de composer la ligne retournée à la main depuis les champs déjà connus : une
relecture reste plus sûre qu'une supposition sur ce que la base vient d'écrire (colonnes
calculées, valeurs par défaut), au prix d'un aller-retour de plus — négligeable face au
gain (plus de transmission en double).

**`motifsNonTransmissible` accepte `aPartirDe` en second paramètre OPTIONNEL**, plutôt que
de dupliquer la fonction ou d'ajouter un troisième motif examiné inconditionnellement :
omis, le comportement est EXACTEMENT celui d'avant ce lot (aucun motif de date), ce qui
garde « Transmettre demain » inchangé sans branche spéciale à son appel.

**La borne `debutDuJourSociete` est hissée en tête de `page.tsx`**, calculée une seule
fois et réutilisée par l'onglet « En retard » ET par « Transmettre toutes » — la
duplication aurait été une seconde lecture du même critère (§9, 01/09).

---

## 4. Ce que je n'ai PAS fait

- Je n'ai pas touché au texte reçu par le CLIENT — aucune des deux décisions ne le change,
  conformément à l'instruction.
- Je n'ai pas ajouté de pagination, de défilement ou de plafond à la liste « Laissées, à
  compléter » — ce n'était pas demandé, et la toucher aurait été une logique nouvelle hors
  scope. C'est précisément ce qui cause l'échec e2e décrit plus bas.
- Je n'ai pas essayé de corriger `tests/e2e/planning-jour-en-tete.spec.ts` — ni son
  assertion (interdit absolu, CLAUDE.md §5), ni sa mise en scène (le grossissement de la
  liste des laissées ne vient pas d'une scène propre à CE test mais du volume global de
  données de démonstration historiques, qu'aucun réglage de CE test ne peut neutraliser
  sans toucher au semis — interdit par ce ticket).
- Je n'ai pas poussé le filtre `societe_id` plus loin que ce que le constat du ticket
  nommait : les lectures listées (planification.ts, transmettreIntervention) sont
  couvertes ; je n'ai pas audité le reste du dépôt pour des lectures similaires hors
  territoire.
- Je n'ai pas mesuré `pnpm test` ni `pnpm test:isolation` sur le commit `d19a9d0` avant de
  commencer à éditer — les comptes « avant » du §2 sont déduits du diff, jamais
  re-mesurés sur l'ancien code ; non vérifié, écrit comme tel.

---

## 5. Les pièges pour la session suivante

### Le conflit non résolu — `tests/e2e/planning-jour-en-tete.spec.ts:102`

**Ce qu'elle attend** : à la viewport 1280×800, sur `/planning?vue=jour`, la légende de la
vue Jour (`[data-maquette-bloc="vue-jour"] > ul`) est visible SANS défiler
(`toBeInViewport()`).

**Ce qu'elle obtient** : `viewport ratio 0` — la légende n'est plus dans la zone visible
sans défiler.

**Deux tentatives** : échoue de façon identique et déterministe aux deux passages
(première mesure dans `CI=1 pnpm verify:full`, seconde en relisant le code pour confirmer
la cause — pas une troisième tentative de correction, un contrôle de la lecture).

**La cause, identifiée par lecture** : le bloc « Laissées, à compléter »
(`app/(back-office)/planning/page.tsx:1312` et suivantes) s'affiche en permanence « dès
qu'elle n'est pas vide », **sur TOUTES les vues** (`jour` comme `semaine` — il n'est PAS
imbriqué dans le `{vue === "semaine" ? ... : null}` qui entoure les deux boutons de
transmission, juste au-dessus). Avant ce lot, cette liste ne contenait que les quelques
lignes « Sans heure »/« Sans technicien » du jeu de démonstration (3, mesuré). Ce lot
ajoute le motif `date_passee` : le jeu de démonstration (`prisma/seed.ts`) pose un grand
nombre de Planifiées sur des dates qui s'éloignent chaque jour un peu plus d'aujourd'hui,
et qui portent donc TOUTES ce motif désormais. La liste grossit en conséquence, pousse le
reste de la page vers le bas, et la légende de la vue Jour — plus bas sur l'écran — sort
du cadre visible à 800 px de hauteur.

**Deux options, pour Alexis** :
  1. **Plafonner/rendre défilable la liste « Laissées, à compléter »** (par exemple une
     hauteur maximale avec défilement interne au-delà de N lignes) — règle l'effet sur
     TOUTES les pages qui en souffriraient, mais c'est une décision d'ergonomie nouvelle,
     hors du mandat de ce ticket.
  2. **Restreindre l'affichage permanent de cette liste à la vue Semaine**, là où vivent
     déjà les boutons de transmission — cohérent avec leur emplacement, mais contredit la
     décision du 02/10/2026 (point 1, sous D141/14B) qui dit « affichée en permanence »
     sans distinction de vue ; à retrancher explicitement si retenu.
  Je n'ai tranché ni l'un ni l'autre : c'est un effet de bord réel, découvert par ce lot,
  mais la correction touche un écran et une liste que ce ticket n'a pas mandat de
  redessiner.

### Piège connu — la scène partagée du seed porte de plus en plus de dates passées

Chaque jour qui passe, davantage de Planifiées de démonstration deviennent « Date
passée » : le compte du bouton « Transmettre toutes » et la taille de la liste des
laissées, mesurés dans ce lot (28 → 13), **ne sont pas des invariants** — un prochain lot
qui les compterait en dur se tromperait. Les tests unitaires et d'isolation de ce lot
fixent leurs propres dates ; aucun ne dépend de l'horloge réelle ni du volume du seed.

### Les deux worktrees de captures

Les captures AVANT/APRÈS ont été prises avec un `git worktree` temporaire sur `d19a9d0`
(`node_modules` symlinké depuis le dépôt principal, lockfile identique vérifié avant de le
faire). Le worktree a été supprimé en fin de lot (`git worktree remove --force`) — rien
ne devrait en rester, mais `git worktree list` est à vérifier si quelque chose semble
manquant à la session suivante.

---

## 6. Ce qui reste à faire

- **Trancher le conflit non résolu ci-dessus** (liste des laissées qui pousse la légende
  de la vue Jour hors champ) — aucune des deux options n'est appliquée.
- **Si Alexis tranche l'option 1 ou 2 ci-dessus**, `tests/e2e/planning-jour-en-tete.spec.ts`
  redeviendra vert sans qu'aucune de ses assertions n'ait eu besoin d'être touchée.
- Remesurer `pnpm test:isolation` sur `d19a9d0` isolément si un compte AVANT exact est
  nécessaire (non fait, voir §4).
