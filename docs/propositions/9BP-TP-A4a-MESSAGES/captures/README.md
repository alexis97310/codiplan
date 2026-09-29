# Captures — 9BP-TP-A4a-MESSAGES

Prises le 29/09/2026.

- APRÈS photographié contre `main` au commit `e0cb6ae` (dernier commit de code
  du lot, avant la passation).
- AVANT photographié contre le commit `2cdee2b` (dernier commit de `main`
  avant ce lot), depuis un `git worktree` jetable — jamais en modifiant le
  code livré pour reculer.
- Les deux passages jouent le **même fichier**,
  `tests/e2e/captures-tpa4a-messages.spec.ts` (committé, comme les autres
  specs `captures-*` du dépôt — inerte sous `pnpm test:e2e` ordinaire, il
  n'écrit rien sans `CAPTURES_TPA4A`) : `CAPTURES_TPA4A_PHASE` ne change que
  le nom du fichier produit, jamais le code exécuté.
- Deux largeurs par scène : 1280 px et 375 px. `fullPage`.
- Toutes les scènes sont des **navigations en lecture seule** : le motif
  affiché voyage par le paramètre d'URL que la route poserait elle-même après
  un refus — aucune écriture n'a eu lieu pour produire ces images.

## Les douze scènes

| Fichier (préfixe) | Ce qui change |
|---|---|
| `fiche-refus-connexion` | `/interventions/{id}?motif=auth.refus` — inchangé, sert de repère : c'est ENCORE le texte de l'échec de connexion, sur les 7 routes de création qui restent hors territoire (A4b) et sur les 4 routes de session |
| `fiche-refus-droit` | `?motif=auth.refus_droit` — **absent AVANT** (la clé n'existait pas, aucun bandeau) ; **présent APRÈS** : « Votre rôle ne permet pas cette action. » |
| `connexion-indisponible` | `/connexion?motif=auth.indisponible` — **absent AVANT** ; **présent APRÈS** : le texte de panne technique, distinct du refus |
| `interventions-periode-inversee` | `/interventions?du=2026-10-10&au=2026-10-01` — AVANT : page vidée en silence (aucun bandeau, « Aucune intervention enregistrée. ») ; APRÈS : bandeau rouge nommant l'inversion + lien « Tout effacer » |
| `interventions-recherche-vide` | `/interventions?q=TPA4-AUCUN` — AVANT : « Aucune intervention enregistrée. » ; APRÈS : « Aucune intervention ne correspond à ces critères. » |
| `vgp-recherche-vide` | `/vgp?q=TPA4-AUCUN` — AVANT : « Aucune machine n'est enregistrée pour cette société. », aucun lien ; APRÈS : « Aucune ligne ne correspond. » + « Voir tout le registre » |
| `fiche-affecter` / `fiche-affecter-corrige` | Affecter sans technicien : AVANT `intervention.refus.habilitation` (faux — aucun technicien désigné) ; APRÈS `intervention.refus.planification_technicien_manquant` |
| `fiche-suspendre` / `fiche-suspendre-corrige` | Suspendre, pièce sans date : AVANT `intervention.refus.motif_manquant` (faux) ; APRÈS `intervention.refus.piece_et_date` |
| `fiche-cloturer` / `fiche-cloturer-corrige` | Clôturer, temps invalide : AVANT `intervention.refus.temps_manquant` (faux) ; APRÈS `intervention.refus.temps_invalide` |

## Ce que ces captures NE montrent PAS

PV-26 (« Rien n'a été modifié » retiré des deux textes `*.refus.
connexion_interrompue`) n'a pas de capture ici : les deux écrans qui les
affichent (`/parc/nouvelle`, le glisser-déposer du planning) exigent une
interaction réelle interceptée au niveau réseau (`page.route(..., r =>
r.abort())`), pas une simple navigation par paramètre d'URL. Le texte neuf est
vérifié par `tests/unit/ui/lot-parc.test.ts` et `tests/unit/planning/
pose.test.tsx` (rendu du composant, pas une capture d'écran) — voir la
passation pour la décision de ne pas construire ces deux mises en scène ici.
