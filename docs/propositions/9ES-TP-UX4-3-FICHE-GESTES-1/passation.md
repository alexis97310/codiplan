# 9ES-TP-UX4-3-FICHE-GESTES-1 — passation

## 1. Ce qui a été livré

Décision n° 63 d'Alexis (08/10/2026) : la fiche intervention gagne des dialogues d'en-tête pour les
gestes d'avancement, et la carte « Actions » perd les quatre blocs correspondants. Voir **D194**
(`docs/arbitrages.md`) pour la décision complète.

- **A0** — `peutAnnuler` (`lib/interventions/cycle-de-vie.ts`) refuse désormais une `terminee` (la
  matrice D8 ne porte, depuis `TERMINEE`, que `EN_COURS` et `CLOTUREE` — jamais `ANNULEE`). Défaut
  mesuré par le pilote : l'écran promettait un geste que la base (`intervention_cycle_de_vie`)
  rejetait ensuite.
- **A1** — `components/ui/dialogue.tsx` : le `<dialog>` générique (feuille basse, Escape et fermeture
  natives, corps et pied laissés à l'appelant).
- **A2** — `components/ui/menu-plus.tsx` : le menu « ⋯ » générique (patron de `MenuCreer`). Icône
  `more` ajoutée à `components/ui/icone.tsx`.
- **B1-B4** — En-tête de la fiche (`app/(back-office)/interventions/[id]/page.tsx`) : un bouton par
  geste PERMIS selon le statut (Suspendre…/Clôturer… ouvrent un dialogue ; Reprendre reste un
  formulaire direct ; Bon d'intervention devient le primaire d'une clôturée) ; menu « ⋯ » pour
  Annuler… (statuts non figés, non terminés) et Bon d'intervention (terminée). La carte Actions perd
  les quatre blocs Clôturer/Reprendre/Suspendre/Annuler et le bloc Annuler mort sur une figée. Trois
  nouveaux composants : `components/interventions/dialogue-{suspendre,cloturer,annuler}.tsx`.
- **Correctif RSC** — `MenuPlus` prenait d'abord un render prop (`enfants`), ce que React refuse entre
  un composant SERVEUR (la fiche) et un composant CLIENT : passage à `children` + un contexte
  (`useFermerMenuPlus`) pour l'entrée qui doit refermer le menu. Trouvé en jouant les épreuves
  voisines, pas en relisant le code.
- **Correctif doublon** — le lien d'ancre d'en-tête (`#action-<principale>`) restait rendu pour
  « reprendre »/« clôturer » EN PLUS du nouveau bouton — deux boutons/liens « Clôturer » sur une
  terminée. Restreint à `planifier`/`transmettre` (les deux seuls gestes qui restent dans la carte),
  comme c'était déjà fait pour le lien 9AD au téléphone.
- **Épreuves e2e adaptées** (vertes, mesurées) : `fiche-telephone.spec.ts`, `fiche-entete-bandeau-frise.spec.ts`,
  `affichage-materiel.spec.ts`, `ecrans-largeur-utile.spec.ts` (`main aside form` : 4 → 3, Annuler
  quitte l'aside), `fiche-actions.spec.ts`, `fiche-cloturer.spec.ts`, `fiche-intervention.spec.ts`.

## 2. Ce qui N'EST PAS fait — à reprendre

Le budget de temps (150 min) a été consommé avant la fin de l'adaptation des épreuves voisines et
avant les captures. Dans l'ordre où les reprendre :

1. **`tests/e2e/fiche-cloturer-replie.spec.ts`** — mesure encore le bloc « Clôturer » REPLIÉ/DÉPLIÉ
   en `<details>` de la carte Actions (`blocCloturerReplie`), retiré par ce lot. À réécrire autour de
   `DialogueCloturer` : le dialogue montre TOUJOURS le champ (jamais replié), et SI `peutCloturer`
   refuse, le motif s'affiche À CÔTÉ du champ avec le bouton désactivé (pas un bloc séparé).
2. **`tests/e2e/fiche-annuler.spec.ts`** — l'helper `ouvrirAnnuler` clique un `<details>/<summary>`
   « Annuler l'intervention » qui n'existe plus : le geste est maintenant dans le menu « ⋯ »
   (`DialogueAnnuler`). Toutes les épreuves du fichier (motif vide désactive le bouton, confirmation
   refusée, confirmation acceptée) sont à rejouer contre le nouveau chemin : ouvrir « ⋯ », cliquer
   « Annuler l'intervention », remplir le motif dans le dialogue, bouton pied désactivé tant que vide.
3. **`tests/e2e/interventions-2.spec.ts:188`** — même mécanique obsolète pour Suspendre
   (`detailsSuspendre(page).locator("summary").click()`), sur le scénario à deux pauses
   (Suspendre/Reprendre/Suspendre). Le `detailsSuspendre` doit devenir le bouton d'en-tête + le
   dialogue `DialogueSuspendre`.
4. **Captures AVANT/APRÈS** (375 et 1280 px, statuts en cours/suspendue/terminée/clôturée) dans
   `docs/propositions/9ES-TP-UX4-3-FICHE-GESTES-1/captures/` — AUCUNE n'a été prise (ni AVANT, faute
   d'avoir réservé le temps au tout début, ni APRÈS). Dossier créé, vide.
5. Après ces trois fichiers verts, rejouer `CI=1 pnpm verify:full` EN ENTIER (pas seulement les
   épreuves voisines listées par le ticket) avant de considérer le lot terminé.

## 3. Pourquoi (décision et amendement)

Décision n° 63 d'Alexis, 08/10/2026 (`claude/decisions-alexis-08-10.md`) : « fiche intervention :
MAQUETTE — boutons d'en-tête + fenêtres (dialogues) + menu « ⋯ » ». Amende D182 (l'action principale
n'est plus toujours un lien d'ancre : pour Suspendre/Clôturer/Annuler c'est un bouton qui ouvre un
dialogue) et D183 R1 (la carte Actions PERD ces quatre blocs ; un menu ⋯ existe désormais) — **sur ce
seul point** : Planifier, Trouver un créneau, Transmettre, Affecter, Déplacer restent dans la carte,
inchangés, au lien d'ancre. Voir **D194** pour le texte complet.

## 4. Défauts trouvés en route (hors scope initial, corrigés)

- `peutAnnuler` permettait d'annuler une TERMINÉE (A0, voir §1) — corrigé avec un test dédié.
- Le render prop function passé à `MenuPlus` depuis un composant serveur — React le refuse
  nativement ; corrigé en passant à `children` + contexte.
- Le doublon de lien d'ancre pour Clôturer/Reprendre — corrigé en restreignant le lien principal à
  Planifier/Transmettre.

## 5. Ce qui N'est PAS construit (aucune route) — rappel du territoire

Valider le rapport, Changer la priorité, Remettre dans la file, Rouvrir, Corriger le temps validé :
aucun de ces cinq gestes n'a de route dans ce dépôt. Ni bouton, ni entrée de menu, ni texte
« bientôt » n'a été posé pour eux — conformément à l'INTERDIT du ticket.

## 6. Vérification jouée

`pnpm format` / `pnpm typecheck` / `pnpm lint` / `pnpm test` (suite unitaire complète, 430 fichiers,
4631 tests) : VERTS sur le dernier commit de cette session. `pnpm test:isolation` et
`pnpm verify:full` (avec `test:e2e` complet) n'ont **pas** été rejoués en entier — les trois fichiers
e2e du §2 y sont rouges, connus et expliqués, pas des rouges étrangers. Les sept épreuves e2e
listées au §1 ont été rejouées individuellement et sont vertes.
