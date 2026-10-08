# Captures — 9EE-TP-UX4-1-FICHE-INTERVENTION-2

Prises le 09/10/2026, par `tests/e2e/fiche-onglets-sur-place.spec.ts` (scène
propre, préfixée `9EE2-`, créée en `beforeAll` et supprimée en `afterAll`).
Deux largeurs par scène : 1280 px et 375 px, `fullPage`.

**APRÈS seulement** — même manque que celui que `9EE-TP-UX4-1-FICHE-
INTERVENTION-1/captures/README.md` nomme déjà (mémoire « captures-avant-
apres-e2e ») : le temps du lot n'a pas suffi à rejouer l'AVANT (le gabarit
sans onglets, sans carte « Sur place ») depuis un commit antérieur dans un
`git worktree` jetable. Écrit ici comme un manque, pas comme un fait.

- `fiche-onglets` — une intervention `a_planifier`, les cinq onglets de la
  maquette (Résumé, Temps, Rapport, Valorisation, Historique) visibles dans la
  rangée, capturée sur l'onglet Historique après la navigation de l'épreuve.
- `fiche-sur-place` — la carte « Sur place » de l'onglet Résumé : adresse,
  horaires (lun.–ven. groupés), donneur d'ordre (nom · fonction, deux liens
  `tel:`), consignes d'accès, habilitation bloquante, agence.
- `fiche-valorisation-resp-sav` — l'onglet Valorisation, sous le rôle
  `responsable_sav` (un rôle qui NE voit PAS les montants, sur cette fiche qui
  n'en porte aucun — voir `tests/e2e/montants-par-role.spec.ts` pour la paire
  de rôles qui, elle, en montre).

**Ce qui manque, nommé** : les cinq onglets d'une intervention `terminee` (la
scène de ce fichier est `a_planifier` ; `tests/e2e/fiche-entete-bandeau-
frise.spec.ts` capture déjà l'en-tête d'une `terminee` « prête à clôturer »,
hors onglets) ; Résumé d'une `en_cours`, d'une `cloturee`, d'une reprise
d'import ; le rôle ADV sur la carte « Sur place » et « Créée depuis » au-delà
de ce que les épreuves elles-mêmes capturent en fin de test.
