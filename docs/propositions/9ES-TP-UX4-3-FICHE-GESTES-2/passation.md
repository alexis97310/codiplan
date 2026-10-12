# 9ES-TP-UX4-3-FICHE-GESTES-2 — passation

## 1. Ce qui a été livré

Décision n° 63 d'Alexis (08/10/2026), suite de 9ES-TP-UX4-3-FICHE-GESTES-1 : les cinq gestes de
planification qui restaient dans la carte « Actions » — Planifier, Trouver un créneau, Transmettre,
Affecter, Déplacer — la quittent à leur tour. Voir **D195** (`docs/arbitrages.md`, amende D194/D182/
D183) pour la décision complète.

- **A1** — À planifier : « Trouver un créneau » (`TrouverCreneau`, inchangé) en bouton PRIMAIRE de
  l'en-tête + « Planifier à la main » en dialogue secondaire (`DialoguePlanifier`, contenu ACTUEL du
  bloc — date, heure, durée, technicien, les quatre ensemble).
- **A2** — Planifiée : « Transmettre » primaire, en dialogue (`DialogueTransmettre`, sans champ, motif
  affiché à côté du bouton désactivé si `peutTransmettre` refuse) + « Déplacer » secondaire, en
  dialogue (`DialogueDeplacer`, contenu ACTUEL du bloc, `TrouverCreneau` en raccourci dedans). Affectée :
  « Déplacer » seul.
- **A3** — Menu « ⋯ » : « Changer de technicien… » (`DialogueChangerTechnicien`, ex-« Affecter » — le
  glossaire donne ce mot, jamais « réaffecter »), visible sur planifiée/affectée/en cours/suspendue,
  **toujours visible même sans `qualifier_affecter`** : le dialogue montre alors le refus à la place du
  champ (même régime que « Transmettre », jamais le régime D131 de Suspendre/Clôturer).
- **B1** — La carte « Actions » (`<aside>`), la fonction `Action`, la fonction `Saisie`, les ancres
  `#action-*`, le lien d'ancre d'en-tête et le lien téléphone 9AD disparaissent entièrement.
  `actionPrincipale` choisit désormais le bouton primaire de l'en-tête (même fonction, même huit
  réponses — `tests/unit/interventions/action-principale.test.ts` adapté en commentaire seulement).
- **B2** — Captures AVANT/APRÈS (à planifier, planifiée, affectée ; 375 et 1280 px) :
  `docs/propositions/9ES-TP-UX4-3-FICHE-GESTES-2/captures/`. Aucun débordement horizontal à 375 px.
- **B3** — D195 écrite, amende D194/D182/D183 (marques bidirectionnelles posées des deux côtés,
  `tests/unit/docs/amendements-arbitrages.test.ts` mis à jour).

### Écart nommé, assumé (voir D195)

« Déplacer » et « Changer de technicien » n'apparaissent plus sur `en_cours`/`suspendue`/`terminee` —
l'ancien bloc s'y rendait (tout statut non figé) ; la maquette ne les y montre pas. Perte de capacité
RÉELLE, pas restaurée en silence : si Alexis la veut, D195 se rouvre.

## 2. Défaut trouvé en route, corrigé

En jouant `verify:full` EN ENTIER (pas seulement les épreuves voisines nommées par le ticket), deux
fichiers non nommés étaient rouges, les deux causés par ce lot :

- `tests/e2e/fiche-intervention.spec.ts` (CLÔTURÉE, ANNULÉE) : la carte Actions portait, pour une
  intervention figée, une phrase expliquant pourquoi (« Clôturée : elle ne se modifie plus... ») —
  perdue avec la carte alors que B1 ne retire QUE les gestes, pas l'information. `bandeauDeLaFiche`
  (`app/(back-office)/interventions/presentation.ts`) gagne les cas `cloturee`/`annulee`, mêmes clés
  qu'avant, rendues par le `BandeauEtat` déjà en place depuis D182 — aucun composant neuf.
- `tests/e2e/captures-pg-b3-trouver-creneau-fiche.spec.ts` : cherchait un `<h2>` « Planifier » visible
  sans rien cliquer — ouvre désormais le dialogue d'abord, le referme avant de cliquer « Trouver un
  créneau » (un `<dialog>` natif est MODAL, il aurait bloqué ce clic).

Les deux, rejoués seuls après correction : verts.

## 3. Vérification jouée

- `pnpm format` / `pnpm typecheck` / `pnpm lint` / `pnpm test` (430 fichiers, 4636 tests) : verts, joués
  après CHAQUE commit.
- `CI=1 pnpm verify:full` joué UNE FOIS EN ENTIER (48,7 min) : a révélé les trois rouges du §2 (deux
  fichiers, trois tests). Les trois, corrigés puis REJOUÉS SEULS (`--workers=1`), sont verts.
- **`CI=1 pnpm verify:full` n'a PAS été rejoué en entier une seconde fois après ces correctifs** — le
  budget de temps (150 min) était épuisé. C'est le premier point à reprendre : rejouer la vérification
  complète pour confirmer qu'aucun quatrième rouge ne subsiste.
- Flakiness mesurée et écartée (NON un défaut de ce lot) pendant l'adaptation des épreuves voisines :
  `avertissements-1.spec.ts`, `fiche-trouver-creneau.spec.ts`, `9dd-pg-g14c-terrain-transmises.spec.ts`
  échouent sous parallélisme (fichier d'interception des courriels partagé entre workers,
  `tmpdir()/codiplan-e2e-courriels.jsonl`) mais passent chacun à 100 % rejoués seul(s) ou à un seul
  worker.

## 4. Ce qui reste à faire (prochaine reprise, dans l'ordre)

1. Rejouer `CI=1 pnpm verify:full` EN ENTIER pour confirmer qu'il est vert de bout en bout après les
   correctifs du §2 — pas seulement les deux fichiers touchés, la suite complète.
2. Si un rouge résiduel apparaît, le nommer et le corriger avant de considérer le lot terminé.

## 5. Ce qui n'est PAS construit (aucune route) — rappel du territoire

Valider le rapport, Changer la priorité, Remettre dans la file, Rouvrir, Corriger le temps validé :
toujours hors territoire (D195, D194).

## 6. Branche

Commits en détaché sur `origin/main` (068c67cc) :
- A1-A3+B1 (dialogues d'en-tête, retrait de la carte Actions)
- Épreuves voisines adaptées + correctif « Changer de technicien » (régime de refus)
- D195 (arbitrages.md) + câblage bidirectionnel
- Captures AVANT/APRÈS
- Correctif bandeau figée + capture pg-b3 (défauts trouvés par `verify:full`)
