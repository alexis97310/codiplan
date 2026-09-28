# Captures — PG-A3a-MESSAGES-POSE

Chemin 2 de l'audit d'ergonomie du 27/09/2026 : le formulaire « Déplacer » de la fiche d'une
intervention déjà planifiée pré-remplit sa durée (99S-GR4-DEPLACER) ; vider SEULEMENT l'heure
échouait sur le refine « une heure et une durée, ou rien » (`lib/interventions/saisie.ts`) et
affichait « Une intervention dure au moins un créneau. Tirez la poignée sous le début du bloc,
jamais au-dessus. » — un texte qui ne s'applique qu'au redimensionnement du planning, à qui n'a
rien tiré.

Prises par `tests/e2e/captures-pg-a3a-messages-pose.spec.ts` (env `CAPTURES_PG_A3A`), sur une
intervention `planifiee` de sa propre scène (préfixe `PGA3A-`, six semaines après aujourd'hui) :
ouverture du bloc « Déplacer », heure vidée, durée laissée telle quelle, soumission.

- `bandeau-heure-obligatoire-avant-*.png` — rejoué sur le code d'AVANT ce ticket (`git worktree`
  sur le commit `a246446`, 9BB-PG-G1-DOCS-FERIES-ORDRE, le dernier avant ce ticket) : le bandeau
  rouge dit « Une intervention dure au moins un créneau. Tirez la poignée sous le début du bloc,
  jamais au-dessus. »
- `bandeau-heure-obligatoire-apres-*.png` — après le commit `54aeab7`
  (PG-A3a-MESSAGES-POSE) : le bandeau dit « L'heure de début est obligatoire. » —
  `intervention.refus.heure_obligatoire`, la clé neuve.

À 1280 et 375 px.
