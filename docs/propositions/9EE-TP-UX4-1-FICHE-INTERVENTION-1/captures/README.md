# Captures — 9EE-TP-UX4-1-FICHE-INTERVENTION-1

Prises le 08/10/2026, par `tests/e2e/fiche-entete-bandeau-frise.spec.ts` (scène
propre, préfixée `9EE-`, créée en `beforeAll` et supprimée en `afterAll`).
Deux largeurs par scène : 1280 px et 375 px, `fullPage`.

**APRÈS seulement** — l'AVANT (le gabarit précédent, sans en-tête composé ni
bandeau d'état ni frise) n'a pas été rejoué depuis un `git worktree` jetable
contre le commit mesuré (6533c962/23e45c98) : le temps du lot n'a pas suffi à
la recette complète AVANT/APRÈS (mémoire « captures-avant-apres-e2e »), et le
spec de capture appelle `habilitationExigeeSurLeSite` — une fonction que
l'ancien code ne porte pas, donc un fichier qui ne type-vérifierait pas contre
l'ancien commit sans un second spec. Écrit ici comme un manque, pas comme fait.

- `a-planifier-p1` — à planifier, priorité P1, habilitation bloquante sur le
  site : bandeau refus (« À planifier depuis… Priorité critique. Habilitation
  9EE-BR exigée sur le site. »), frise en tête, « Planifier » en tête.
- `a-planifier-p1-resp-sav` — la même fiche, sous le rôle `responsable_sav`.
- `planifiee-en-retard` — planifiée hier : bandeau refus « En retard… ».
- `en-cours-compteur` — un segment ouvert : bandeau information « Compteur en
  marche depuis… ».
- `suspendue-piece` — suspendue, motif et pièce attendue : bandeau
  avertissement, frise à l'étape « En cours » arrêtée.
- `terminee-refusee` — terminée sans temps mesuré : bandeau avertissement
  « Clôture pas encore possible. », raison nommée.
- `terminee-prete` — terminée avec temps mesuré : bandeau succès « Prête à
  clôturer. », le lien « Clôturer » en tête mène au bloc réel de l'aside.
- `terminee-prete-resp-sav` — la même fiche, sous le rôle `responsable_sav`.
