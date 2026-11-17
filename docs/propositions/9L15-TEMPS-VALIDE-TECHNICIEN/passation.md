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
