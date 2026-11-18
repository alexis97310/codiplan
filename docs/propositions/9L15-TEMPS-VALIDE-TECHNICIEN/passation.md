# 9L15-TEMPS-VALIDE-TECHNICIEN — passation

Démarré le 18/11/2026 à 08:55 (Nouméa), budget 90 min.

## La règle tenue

Décision d'Alexis du 10/11/2026 (option 1) : le technicien peut clôturer son
intervention, mais le temps validé y est alors égal au temps mesuré par le
compteur — sans correction possible de sa part. Seuls le responsable et
l'ADV corrigent le temps validé, avec auteur et date tracés. Cela rétablit
D120 (le compteur est la seule source du temps) en gardant D131 (le ○ du
technicien sur `cloturer_intervention`, scopé à sa propre intervention).
Arbitrage écrit sous D271 (`docs/arbitrages.md`).

## Ce qui est livré

### Point 1 — le serveur refuse la correction, jamais en silence

`lib/interventions/depot.ts`, `cloturerIntervention` : le périmètre
(`perimetreParPersonne(..., "cloturer_intervention")`) est désormais repris
pour juger la VALEUR soumise, pas seulement l'intervention visée. Un accès
RESTREINT (○, le technicien) n'accepte que `temps_valide_min ===
temps_mesure_min` ; toute autre valeur refuse nommément
(`intervention.refus.temps_corrige_par_technicien`, `lib/i18n/fr.ts`). Un
accès COMPLET (ADMS, DIR, RM, RS, ADV) continue de corriger librement — rien
ne change pour le bureau. Les deux colonnes de traçage (`temps_valide_par`,
`temps_valide_le`) existaient déjà et s'écrivent pour toute clôture, quel
qu'en soit l'auteur ; ce ticket ne leur ajoute rien, il referme l'écart qui
laissait un technicien s'en servir pour corriger sa propre mesure.

### Point 2 — l'écran : lecture pour un accès restreint, saisie pour un accès complet

`components/interventions/dialogue-cloturer.tsx` : `DialogueCloturer` reçoit
`correctionAutorisee`. Vrai (accès complet) : champ éditable, comportement
ACTUEL, inchangé. Faux (accès restreint) : le champ devient un `<span>` en
lecture (même formatage que `enDuree`, utilisé ailleurs sur la fiche), avec
l'aide « Le bureau peut le corriger » (`intervention.cloture.
temps_valide_lecture_aide`) — et un champ `<input type="hidden">` qui porte
la même valeur, pour que le formulaire reste unique (un seul
`name="temps_valide_min"`, jamais deux chemins de soumission).
`app/(back-office)/interventions/[id]/page.tsx` calcule
`correctionTempsAutorisee` avec `peutPleinement(role, "cloturer_
intervention")`, déjà importée, et la passe au dialogue.

### Point 3 — épreuves

- `tests/isolation/droits-cycle-de-vie.test.ts` (étendu, describe
  « CLÔTURER ») : un technicien REFUSÉ s'il corrige le temps qu'il a mesuré
  (rien ne change en base) ; le bureau CORRIGE librement, et la correction
  est tracée (`temps_valide_par`, `temps_valide_le`).
- `tests/e2e/9l15-temps-valide-technicien.spec.ts` (nouveau) : la MÊME règle,
  rejouée par la vraie route (`/api/interventions/<id>/cloturer`) sous une
  session de technicien ouverte par l'écran — preuve que la PORTE laisse le
  ○ atteindre le dépôt, pas seulement que le dépôt juge correctement.

## CE QUI N'A PAS ÉTÉ CONSTRUIT, ET POURQUOI — UN POINT À PORTER À ALEXIS

Le ticket demande (point 2) que l'écran du technicien, « en ligne et hors
réseau », montre le temps validé en lecture. **Mesuré en cherchant cet
écran : il n'existe pas.**

- `/interventions/<id>` — la seule page qui rend `DialogueCloturer` — est
  fermée au technicien par le garde de D221
  (`app/(back-office)/template.tsx`) : pour SA PROPRE intervention affectée,
  il est systématiquement renvoyé vers `/terrain/<id>`, quel qu'en soit le
  statut. Il n'atteint donc jamais ce dialogue, par aucune navigation.
- La fiche terrain (`app/(mobile)/terrain/[id]/page.tsx`) ne porte aucune
  action « Clôturer » : aucun bouton, aucune route sous `app/api/terrain/`,
  aucune clé `terrain.*cloture*` au dictionnaire. La clôture n'est pas non
  plus portée par la file hors réseau (`lib/terrain/file-saisies.ts` /
  `lib/interventions/saisie-differee.ts` ne couvrent que le compteur et
  « Terminer »).

Le ○ que D131 ouvre au technicien sur `cloturer_intervention` est donc
aujourd'hui un chemin SANS ÉCRAN — atteignable seulement par un appel direct
à la route, jamais par un geste réel. C'est un constat distinct de cette
décision, et je ne l'ai pas résolu en construisant un écran neuf : bâtir une
clôture terrain (bouton, route, et sa place dans la file hors réseau si elle
doit rester utilisable sans réseau) est un changement de surface largement
plus grand que les deux fichiers mesurés par ce ticket
(`lib/auth/habilitations.ts`, `lib/interventions/depot.ts`), et j'ai choisi
de ne pas l'improviser dans le budget d'un ticket qui ne le nommait pas.

Ce que j'ai fait à la place : le serveur refuse déjà, nommément et dans tous
les cas, toute valeur différente du temps mesuré quand c'est un technicien
qui clôture — par la route réelle, prouvé par l'épreuve e2e ci-dessus.
`DialogueCloturer` porte `correctionAutorisee` et sait déjà se comporter
correctement SI un jour un écran l'ouvre à un accès restreint — mais
aujourd'hui, seuls des rôles à accès COMPLET atteignent ce dialogue, donc
cette branche ne s'affiche à personne en pratique.

**Autre conséquence du même constat** : le refus serveur
(`intervention.refus.temps_corrige_par_technicien`) ne s'affiche nulle part
non plus aujourd'hui pour un technicien — `versLaFiche` le pose en paramètre
d'URL sur `/interventions/<id>?refus=...`, une page que D221 lui ferme avant
qu'elle ne rende quoi que ce soit. Un technicien qui tenterait de corriger
son temps par un appel direct serait bien refusé (prouvé), mais ne verrait
aucun message — seulement une absence de clôture.

**Proposition** : ouvrir un ticket séparé pour la clôture terrain (bouton,
route `/api/terrain/<id>/cloturer`, place dans la file hors réseau ou
décision explicite de la garder en ligne seulement), plutôt que de la
construire ici sans mandat.

## Ce qui n'a pas changé

Aucune migration : `temps_valide_par`/`temps_valide_le` et leur contrainte
de traçage existaient déjà. Aucune autre capacité de la matrice, aucune
autre route — annulation, suspension/reprise, VGP restent sous leur propre
périmètre D131, inchangé.

## Épreuves jouées

`pnpm test` (5969 tests), `pnpm test:isolation` (2296 tests), `pnpm
typecheck`, `pnpm lint`, `pnpm format:check` — tous verts. Les e2e ciblées
(`fiche-cloturer.spec.ts` + `9l15-temps-valide-technicien.spec.ts`, 5
scénarios) jouées au premier plan contre un serveur de production construit
localement — vertes. `build` (`next build`) a été vérifié manuellement
(construction réussie) ; le lancer sous `pnpm verify` sur cette machine
échoue par manque de mémoire au delà de 6144 Mo de tas — limite déjà
atteinte par la taille actuelle du dépôt, sans rapport avec ce ticket
(confirmé : la même commande, avec 8192 Mo, réussit à l'identique sur le
code de ce ticket). `verify:full` est laissé à la file, comme demandé.

## Reprise 9L15A-REPRISE-TEMPS-VALIDE (18/11/2026)

Reprise mandatée après deux rouges de `CI=1 pnpm verify` à l'étape `next
build` (`JavaScript heap out of memory`, plafond 6144 Mo) — cause mesurée par
9L13A-REPRISE-MEMOIRE-BUILD comme commune à TOUS les lots du 18/11 sur
`origin/main` seul, et refermée entre-temps par
`9L16A-MEMOIRE-BUILD-MARGE` (36 réciproques Prisma `@ignore`, marge ~300 Mo
rendue, plafond inchangé) : le diff de ce ticket n'y était pas en cause.

- **`tickets/recales/9L15-TEMPS-VALIDE-TECHNICIEN.md` et
  `traces/9L15-TEMPS-VALIDE-TECHNICIEN-verify-{1,2}.txt`** : absents de ce
  dépôt (ni sur `origin/main`, ni sur aucune branche, ni ailleurs sur la
  machine — recherché). Cette reprise s'appuie donc sur le CONTEXTE écrit
  dans le mandat de reprise, qui portait déjà la mesure de la cause ; aucun
  des deux fichiers n'a pu être relu en entier comme demandé.
- Branche `9L15A-REPRISE-TEMPS-VALIDE` ouverte depuis `origin/main` à jour
  (`5ee78c1a0`). Les trois commits de `9L15-TEMPS-VALIDE-TECHNICIEN-garde`
  (points 1, 2, 3) cherry-pickés dans l'ordre. Deux sans conflit ; le
  troisième en a un sur `docs/arbitrages.md` — les deux lots avaient écrit
  **D270** sous un mandat parti du même `origin/main` : 9L13
  (« suspendre ferme le compteur ») y était déjà publié entre-temps. La
  décision de ce ticket est renumérotée **D271**, partout — `docs/
  arbitrages.md`, `docs/propositions/9L15-TEMPS-VALIDE-TECHNICIEN/
  passation.md` (ce fichier, plus haut), `tests/e2e/
  9l15-temps-valide-technicien.spec.ts`, `tests/isolation/
  droits-cycle-de-vie.test.ts`, `components/interventions/
  dialogue-cloturer.tsx`, `app/(back-office)/interventions/[id]/page.tsx`,
  `lib/i18n/fr.ts`, `lib/interventions/depot.ts`, et le titre du commit
  cherry-pické (amendé). Rien d'autre n'a changé dans les trois commits.
- Aucune relation Prisma nouvelle posée par ce ticket (`prisma/schema.prisma`
  non touché) : rien à marquer `@ignore` au sens du gardien de 9L16A.
- Recherche dans `tests/e2e/**` des localisateurs de la même famille
  (« Temps validé », `temps_valide_min`, « Clôturer », le nouveau libellé
  « Le bureau peut le corriger ») : AUCUN besoin de les rendre plus précis.
  Toutes les épreuves existantes qui touchent `DialogueCloturer`
  (`fiche-cloturer.spec.ts`, `fiche-cloturer-replie.spec.ts`,
  `9k09-fiche-cloture-suite-origine.spec.ts`, etc.) s'ouvrent sous un compte
  à accès complet (`ouvrirUneSession`/`COMPTE_EPREUVE`), donc restent sur la
  branche `correctionAutorisee = true`, inchangée — le même constat que plus
  haut (« chemin SANS ÉCRAN ») : aucune épreuve existante n'exerçait déjà la
  branche restreinte avant ce ticket, donc aucune n'est entrée en collision
  avec le nouveau libellé de lecture.
- Pic mesuré de `pnpm build` (`/usr/bin/time -v`, `.next` effacé avant) :
  **Maximum resident set size : 6 028 012 ko ≈ 5 887 Mio**, soit une marge de
  ≈ 257 Mio sous le plafond de 6144 Mio — cohérent avec la marge « ~300 Mo »
  rendue par 9L16A (l'écart tient à la variance d'une mesure à l'autre, pas à
  ce ticket : aucune relation Prisma neuve, aucun type inféré nouveau).
- Rejoué au premier plan, `CI=1 --workers=1` : les e2e de ce ticket
  (`9l15-temps-valide-technicien.spec.ts`), la famille `*cloture*`
  (`9k09-fiche-cloture-suite-origine`, `fiche-avant-cloture-lien-rapport-
  role`, `fiche-cloturer-replie`, `fiche-cloturer`,
  `zz-captures-9h1b-avant-cloture-roles`) et
  `tests/e2e/tous-les-ecrans-rendent.spec.ts` ensemble : **78 passed, 4
  skipped, 0 failed**. Puis `pnpm test:isolation` : **250 fichiers, 2301
  tests, tous verts**. Puis `CI=1 pnpm verify` entier (format, typecheck,
  lint, 5971 tests unitaires, 2301 tests d'isolation, build) : **vert de bout
  en bout**, build compris — le point bloquant des deux tentatives
  précédentes est donc refermé, comme mesuré par 9L13A/9L16A.
- Aucune assertion retirée, élargie, ni `skip`/`fixme`/`retries` ajoutés.
  Aucun changement de fond au-delà du renumérotage D270→D271.
