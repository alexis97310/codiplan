# Captures — PG-B3-TROUVER-CRENEAU-FICHE

Audit du 27/09/2026 §4.4 ; spécification §3.10 ; suite de PG-B1-VERDICT-LECTURE et
PG-B2-FENETRE-POSE. Depuis la fiche d'une intervention « À planifier », il fallait lire le
planning, revenir, puis retaper date, heure, durée et technicien à la main. Le bouton
« Trouver un créneau » ouvre désormais `FenetrePose` (PG-B2, import, aucune copie) directement
depuis le bloc « Planifier » de la fiche, avec le jour CHOISISSABLE — la fiche n'a ni case ni
glissé pour le fixer, contrairement au planning.

Prises par `tests/e2e/captures-pg-b3-trouver-creneau-fiche.spec.ts` (env `CAPTURES_PGB3`), sur sa
propre scène (préfixe `PGB3CAP`) : une intervention « À planifier » sans technicien ni créneau, à
l'agence Ducos.

- `planifier-avant-*.png` — rejoué sur le code d'AVANT ce ticket (`git worktree` sur le commit
  `7746003`, 9BL-TP-A1-HISTORIQUES-CLIENT-SITE, le dernier avant ce ticket) : le bloc
  « Planifier » ne porte que le formulaire nu (date, heure, durée, technicien).
- `planifier-apres-*.png` — après le commit `afd229a` (PG-B3-TROUVER-CRENEAU-FICHE) : le bouton
  « Trouver un créneau » apparaît en tête du bloc ; le formulaire existant reste, replié sous
  « Saisir à la main » (fermé par défaut).
- `fenetre-apres-*.png` — la fenêtre ouverte par ce bouton : même composant que le planning, mais
  le champ « Date » y est un champ modifiable (pré-rempli au jour courant de la société, ici
  faute de date déjà connue sur cette intervention), jamais un texte fixe.

**Aucun `fenetre-avant-*.png`** : cet écran est CRÉÉ par ce ticket, il n'existe pas sur le code
d'avant — le bouton qui l'ouvre n'y est pas rendu, la seconde capture du spec est sautée (assertion
sur son nombre d'occurrences, jamais une clé de dictionnaire qui casserait le typecheck du build
sur l'ancien code).

À 1280 et 375 px.
