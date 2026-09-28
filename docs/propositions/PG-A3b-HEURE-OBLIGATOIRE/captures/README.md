# Captures — PG-A3b-HEURE-OBLIGATOIRE

Décision QG-4 d'Alexis du 27/09/2026 (`docs/propositions/planning-gmao/decisions-2026-09-27.md`) :
une intervention `planifiee`/`affectee` ne peut plus devenir une « journée sans heure » par un
simple déplacement — heure et durée restent obligatoires tant que la date est gardée ; tout vider
(date, heure, durée) remet l'intervention dans la file.

Prises par `tests/e2e/captures-pg-a3b-heure-obligatoire.spec.ts` (env `CAPTURES_PGA3B`), sur sa
propre scène (préfixe `PGA3B-`, six semaines après aujourd'hui) : une intervention `a_planifier`
pour le bloc « Planifier », une intervention `planifiee` avec heure et durée pour le bloc
« Déplacer ».

- `planifier-avant-*.png` / `deplacer-avant-*.png` — rejoué sur le code d'AVANT ce ticket
  (`git worktree` sur le commit `940cc53`, 9BI-PG-G8-EN-RETARD — passation, le dernier avant ce
  ticket) : le champ heure porte « Heure de début (laisser vide pour une journée sans heure) »,
  et le bloc « Déplacer » n'a aucune note sur la remise en file.
- `planifier-apres-*.png` / `deplacer-apres-*.png` — après le commit `f6fa091`
  (PG-A3b-HEURE-OBLIGATOIRE) : le champ heure porte simplement « Heure de début », et le bloc
  « Déplacer » gagne la note « Pour remettre l'intervention dans la file, videz la date, l'heure
  et la durée. »

À 1280 et 375 px. Le comportement du refus et de la remise dans la file — non visible par une
seule capture statique — est éprouvé par `tests/e2e/pg-a3b-heure-obligatoire.spec.ts`, pas par ce
spec de capture (qui n'affirme aucun texte neuf, pour rester rejouable sur l'ancien code sans
casser le typecheck du build — voir l'entête du fichier).
