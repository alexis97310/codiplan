# Captures — 9BR-TP-A4b-MESSAGES

Audit du 28/09/2026 (lot TP-A4, second corps A4b) : les réussites d'une fiche se rendaient dans
le même bandeau rouge qu'un refus (CS17, PA-05) ; `/parc/[id]` ne lisait jamais `?motif=`, si
bien que créer ou modifier une machine ne disait rien (PV-18) ; sept formulaires de création
perdaient toute la saisie au premier refus (CS23, CS42, CS46, PA-06, PV-45, IN-03).

Prises par `tests/e2e/captures-9br-tpa4b-messages.spec.ts` (env `CAPTURES_TPA4B`,
`CAPTURES_TPA4B_PHASE`), sur une scène propre préfixée `TPA4CAP-` (un client, un site, une
machine, une demande), créée et supprimée par l'épreuve — aucune ligne de semis. Chaque scène de
lecture est une simple navigation (`?motif=`) ; chaque scène de saisie soumet un refus de
VALIDATION (schéma), qui n'écrit rien sur aucun des deux codes.

- `*-avant-*.png` — rejoué sur le code d'AVANT ce lot (`git worktree` sur le commit `5aa9544`,
  9BOA-REPRISE-9BO, le dernier avant ce lot).
- `*-apres-*.png` — après les commits de code de ce lot (jusqu'à `00d9a75`,
  9BR-TP-A4b-MESSAGES — refus de droit des routes de création).

À 1280 et 375 px.

## Le ton du bandeau (CS17, PA-05, PV-18)

- `fiche-client-succes-*` (`?motif=clients.modifie`) — AVANT : bandeau rouge. APRÈS : bandeau
  vert.
- `fiche-client-refus-*` (`?motif=client.refus.saisie`) — reste rouge des deux côtés : la preuve
  qu'un vrai refus n'a pas changé de couleur.
- `fiche-site-succes-*`, `agences-liste-succes-*`, `agences-calendrier-succes-*`,
  `agence-modifier-succes-*`, `equipe-succes-*` — même bascule rouge → vert sur les cinq autres
  fiches du commit 1.
- `fiche-machine-succes-*` (`/parc/<id>?motif=machine.creee`) — AVANT : aucun bandeau (le motif
  n'était jamais lu). APRÈS : bandeau vert.

## La saisie gardée après un refus (CS23, CS42, CS46, PA-06, PV-45, IN-03)

Sept formulaires, chacun rempli puis soumis avec un refus de VALIDATION provoqué exprès (code
externe en double, rattachement absent, nom vide, libellé vide, montant vide, organisme vide,
nature vide) :

- `clients-nouveau-refus-saisie-gardee-*`, `sites-nouveau-refus-saisie-gardee-*`,
  `contact-refus-saisie-gardee-*`, `agence-nouvelle-refus-saisie-gardee-*`,
  `forfaits-refus-saisie-gardee-*`, `vgp-refus-saisie-gardee-*`,
  `intervention-refus-saisie-gardee-*` (ouverte depuis une demande, mode « Forfait » choisi).

AVANT : tous les champs reviennent vides (seul le motif du refus voyage). APRÈS : chaque champ
rempli — hors celui qui a causé le refus — garde sa valeur.
