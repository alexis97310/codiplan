# Captures — 9EI-TP-UX5-1-FORMULAIRES

Prises par `tests/e2e/9ei-tp-ux5-1-formulaires.spec.ts` (`capturer()`), sur sa propre scène
préfixée `TPUX5-` (créée et supprimée par l'épreuve — jamais une donnée de production).

Commit : `39e81fb093c4d31617dcb036a52b7be0af8e7705` (partie D, décision D178).
Date : 07/10/2026.

- `formulaire-vide-{1280,375}.png` — `/interventions/nouvelle` à l'ouverture, les deux
  sections numérotées visibles, rien saisi.
- `site-choisi-machines-en-choix-{1280,375}.png` — le site TPUX5 choisi : la machine en
  choix visibles (« Sans machine » coché par défaut), la colonne « Récapitulatif » / « Qui
  sera prévenu ».
- `refus-erreur-sous-le-champ-priorite-{1280,375}.png` — soumission sans priorité (refus
  serveur forcé, `required` retiré) : le bandeau en tête et le message sous le groupe
  « Priorité ».
- `depuis-une-demande-qualifiee-{1280,375}.png` — `/interventions/nouvelle?demande=…` :
  lieu, machine et priorité préremplis depuis la demande qualifiée.
