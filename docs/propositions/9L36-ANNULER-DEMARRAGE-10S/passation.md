# 9L36-ANNULER-DEMARRAGE-10S — passation

Décision d'Alexis du 23/11/2026 (séance de décisions, point 8 : « « Annuler le démarrage » 10 secondes (M9) : oui »).
Écrite en `docs/arbitrages.md` sous **D282**. Ferme le point M9 de la feuille de route, laissé « à trancher » depuis
l'audit technicien du 10/11/2026.

## Ce qui a été livré

1. **La matrice D8 s'ouvre d'une flèche, `EN_COURS → AFFECTEE`** (`prisma/migrations/20261124090000_annuler_demarrage_9l36`,
   `intervention_cycle_de_vie`), bornée par le même déclencheur : la transition n'est permise que si un segment
   ouvert depuis moins de treize secondes (dix, plus trois de marge réseau) existe encore sur l'intervention, et
   SEULEMENT sous `current_user = 'codiplan_app'` — jamais sous le propriétaire du schéma (migrations, harnais de
   test), qui n'est filtré par aucune politique RLS non plus (D94). **Mesuré avant d'écrire la version finale** :
   la première rédaction partait de la version du déclencheur posée par D160 (04/10) plutôt que de celle, plus
   récente, posée par D135/RG-INT-03 (20261022210000, refus de clôture sans rapport validé) — elle aurait donc fait
   disparaître ce refus en silence. `tests/isolation/intervention.test.ts` (« la CLÔTURE sans rapport validé ») l'a
   révélé avant que ce lot ne soit livré ; la version posée reprend l'intégralité de celle de D135.

2. **`segment_travail` accorde désormais `DELETE`, sous TROIS verrous cumulés** : une politique RLS `FOR DELETE`
   (forme « interne », identique aux trois politiques voisines — **mesurée nécessaire** : `GRANT DELETE` seul,
   sous `FORCE ROW LEVEL SECURITY` sans politique pour ce verbe, résolvait silencieusement ZÉRO ligne, jamais une
   erreur), un déclencheur `BEFORE DELETE` qui ne laisse supprimer qu'un segment ENCORE OUVERT et ENCORE dans la
   fenêtre de treize secondes, et ce déclencheur lui-même scopé à `current_user = 'codiplan_app'` — **mesuré
   nécessaire aussi** : sans ce bornage de rôle, le déclencheur cassait le nettoyage de fixtures de `clientOwner()`
   dans la quasi-totalité des fichiers de la suite d'isolation (164 épreuves rouges à la première version). La
   frontière retenue (`current_user = 'codiplan_app'`) est celle, déjà posée partout ailleurs par les
   `GRANT`/`REVOKE` de ce dépôt, qu'il manquait à un DÉCLENCHEUR.

3. **`annulerLeDemarrage`** (`lib/interventions/depot-compteur.ts`) — le chemin applicatif, et le SEUL appelant de
   la transition posée au point 1. Quatre gardes, dans l'ordre : (a) le segment ouvert de LA PERSONNE CONNECTÉE
   (l'intervention n'est pas un paramètre, même doctrine qu'`arreterLeCompteur`) ; (b) la fenêtre de dix secondes
   côté SERVEUR (`peutAnnulerLeDemarrage`, `lib/interventions/compteur.ts`, pure, sans base ni horloge) ; (c) le
   PREMIER démarrage seulement — aucun autre segment, fermé ou ouvert, sur cette intervention, sinon
   `compteur.refus.annulation_reprise_non_couverte` : revenir à `affectee` n'a de sens que pour ce chemin, une
   réouverture (`terminee`/`suspendue → en_cours`) perdrait la clôture ou la suspension dont elle vient ; (d) aucune
   saisie depuis l'ouverture du segment — `ChecklistReponse`, `InterventionPrestation`, `InterventionSignature`,
   `InterventionPieceRemplacee` (leur propre horodatage), et le rapport (`commentaire_technicien`/`suite_a_donner`,
   qui n'en porte aucun en propre : `intervention.modifie_le` le signale, avec une marge de deux secondes pour
   l'écart entre l'écriture du segment et celle du statut dans la MÊME transaction). L'écriture de l'intervention
   précède TOUJOURS la suppression du segment (l'inverse ferait échouer la garde du déclencheur, qui lit
   `segment_travail` pour juger sa propre transition).

4. **Route, file hors réseau, écran** — `app/api/terrain/[id]/compteur/route.ts` (geste `annuler_demarrage`,
   troisième valeur du même point d'entrée que `demarrer`/`arreter`) ; `GesteCompteur.action` et `gesteReconnu`
   (`lib/terrain/file-saisies.ts`) l'acceptent ; `components/terrain/annuler-demarrage.tsx` (nouveau) — UN SEUL
   composant pour les deux cas : un démarrage ENCORE en file se retire par `retirerSaisie`, SANS appel réseau (même
   régime que `GesteSuppressionPhoto` sur une photo pas encore partie) ; un démarrage déjà CONFIRMÉ pose le geste et
   repart en file s'il échoue à partir. Le compte à rebours affiché est purement informatif (dix secondes, sans la
   marge réseau du serveur — un compte à rebours qui irait jusqu'à treize mentirait sur ce que « dix secondes »
   promet). Monté dans `app/(mobile)/terrain/[id]/page.tsx`, à côté de `BoutonCompteurTerrain`.

## Ce qui N'A PAS été fait, et pourquoi

**`docs/captures/` (la prise de vue complète de l'application) n'a PAS été rejouée.** La procédure
(`docs/captures/README.md`) exige un geste humain irréductible : choisir un mot de passe via un lien de premier
accès réémis, suivi dans un navigateur. Une session non interactive ne peut ni recevoir ce lien ni le suivre.
Seules les captures PROPRES à ce lot (`docs/propositions/9L36-ANNULER-DEMARRAGE-10S/captures/`) ont été prises, via
le scénario de bout en bout lui-même (serveur et base jetables, déjà provisionnés par le harnais e2e) :
`avant-affectee-375.png` (l'écran, inchangé, avant démarrage), `apres-bouton-annuler-visible-375.png` (le bouton
neuf, en ligne), `apres-hors-reseau-bouton-annuler-visible-375.png` (le même bouton, bandeau orange) et
`apres-annule-retour-affectee-375.png` (le retour à « affectée »). Pas de capture 1280 px : aucun écran du
back-office n'est touché par ce lot.

## Épreuves

- **`tests/unit/interventions/compteur.test.ts`** — `peutAnnulerLeDemarrage` : permis dans les dix secondes, permis
  dans la marge réseau (jusqu'à treize), refusé au-delà, avec sa clé.
- **`tests/unit/terrain/file-saisies.test.ts`** — `annuler_demarrage` traverse `gesteReconnu` sans changement.
- **`tests/unit/feuille-de-route/contenu.test.ts`** — mis à jour : quatre éléments restent dans la section audit
  (M9 a migré, livré, vers « Livré depuis le 31/10 »).
- **`tests/isolation/annuler-demarrage-9l36.test.ts`** (nouveau) — le chemin de production (annulation acceptée
  dans la fenêtre, aucun temps compté ; refusée après dix secondes ; refusée pour un AUTRE technicien ; refusée
  après une saisie ; refusée sur une reprise) ET le déclencheur SEUL, sous `codiplan_app`, sans passer par
  `annulerLeDemarrage` (refusé sans segment, refusé après treize secondes, jumeau : un segment tout juste ouvert
  passe).
- **`tests/isolation/compteur-du-technicien.test.ts`** — mis à jour : « un segment ne se SUPPRIME pas » devient
  « un segment FERMÉ ne se supprime pas » + « un segment OUVERT depuis plus de treize secondes ne se supprime pas
  non plus » + le JUMEAU (un segment tout juste ouvert se supprime). Le témoin de privilège est inversé : `DELETE`
  est désormais ACCORDÉ (c'est le déclencheur qui garde, plus le privilège).
- **`tests/isolation/intervention.test.ts`** — la matrice D8 « jouée sur tous les couples » porte désormais
  `en_cours → affectee` comme PERMISE ; le couple pose son propre segment jetable (frais, pour que la garde de
  fenêtre passe) avant l'écriture, nettoyé AVANT l'intervention (FK `Restrict`).
- **`tests/e2e/9l36-annuler-demarrage.spec.ts`** (nouveau) — trois scénarios, 375 px, attente réelle (jamais une
  horloge de navigateur avancée — la fenêtre est jugée par `now()` de PostgreSQL) : annulation en ligne dans la
  fenêtre (retour à affectée, segment disparu, `temps_mesure_min` toujours `NULL`) ; le bouton disparaît après onze
  secondes (le compteur, lui, continue de tourner) ; annulation hors réseau d'un démarrage encore en file, sans
  appel serveur (rien n'a jamais été appliqué côté base une fois le réseau revenu).

`pnpm test` (6065 tests), `pnpm test:isolation` (2564 tests) et `CI=1 pnpm verify` (format, typecheck, lint, test,
test:isolation, build) passent tous, rejoués en avant-plan pendant ce lot. Les trois scénarios e2e ciblés ont aussi
été rejoués en avant-plan (verts) — `pnpm test:e2e` en entier n'a PAS été rejoué (budget du lot, et le mémo du poste
le déconseille : plus de 30 minutes à un worker) ; la file de nuit joue `verify:full` après ce lot.

## Feuille de route

L'élément M9 (« à trancher ») de la section « Application technicien — audit du 10/11/2026 » est retiré de cette
section et migré, statut `livre`, vers « Livré depuis le 31/10 », avec sa référence (D282, 9L36).

## MIGRATION À JOUER par Alexis

`prisma/migrations/20261124090000_annuler_demarrage_9l36` — **DB migrate production, puis Vercel.** Elle ne touche
aucune donnée existante (aucun `UPDATE`/`DELETE` de ligne) : elle redéfinit `intervention_cycle_de_vie`, ajoute une
politique RLS et un déclencheur `BEFORE DELETE` sur `segment_travail`, et accorde `DELETE` au rôle applicatif sur
cette seule table.
