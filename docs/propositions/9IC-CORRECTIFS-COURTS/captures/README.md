# Captures AVANT/APRÈS — 9IC-CORRECTIFS-COURTS

AVANT = `origin/main` avant ce lot (commit `23700e26f`, rejoué dans un worktree jetable).
APRÈS = ce dépôt, après les points 1 à 5.

Spec : `tests/e2e/zz-captures-9ic-correctifs-courts.spec.ts` (`CAPTURES_9IC=<dossier>`).

## avant/

| Fichier | Taille |
|---|---|
| `equipe-1280.png` | 126 333 octets |
| `equipe-375.png` | 45 949 octets |
| `planning-bandeau-colonne-figee-1280.png` | 82 062 octets |
| `planning-bandeau-colonne-figee-375.png` | 58 486 octets |
| `signature-trait-1280.png` | 57 070 octets |
| `signature-trait-375.png` | 43 709 octets |
| `9i5-ma-journee-1280.png` | 69 124 octets |
| `9i5-ma-journee-375.png` | 50 405 octets |
| `9i5-tableau-de-bord-1280.png` | 119 096 octets |
| `9i5-tableau-de-bord-375.png` | 44 907 octets |
| `9i5-vgp-1280.png` | 121 492 octets |
| `9i5-vgp-375.png` | 48 719 octets |
| `9i5-donnees-a-completer-1280.png` | 64 966 octets |
| `9i5-donnees-a-completer-375.png` | 36 941 octets |
| `9i5-fiche-machine-1280.png` | 119 837 octets |
| `9i5-fiche-machine-375.png` | 53 517 octets |

## apres/

| Fichier | Taille |
|---|---|
| `equipe-1280.png` | 126 220 octets |
| `equipe-375.png` | 45 974 octets |
| `planning-bandeau-colonne-figee-1280.png` | 79 684 octets |
| `planning-bandeau-colonne-figee-375.png` | 58 486 octets |
| `signature-trait-1280.png` | 57 070 octets |
| `signature-trait-375.png` | 43 709 octets |
| `9i5-ma-journee-1280.png` | 64 696 octets |
| `9i5-ma-journee-375.png` | 51 541 octets |
| `9i5-tableau-de-bord-1280.png` | 119 317 octets |
| `9i5-tableau-de-bord-375.png` | 44 867 octets |
| `9i5-vgp-1280.png` | 121 447 octets |
| `9i5-vgp-375.png` | 48 671 octets |
| `9i5-donnees-a-completer-1280.png` | 64 966 octets |
| `9i5-donnees-a-completer-375.png` | 36 941 octets |
| `9i5-fiche-machine-1280.png` | 120 456 octets |
| `9i5-fiche-machine-375.png` | 54 728 octets |

## Ce que chaque paire montre

- **`equipe-*`** (point 2) — la lecture des comptes a changé de forme interne
  (tranches de 5), pas d'apparence : AVANT et APRÈS sont visuellement
  identiques, capturés pour documenter que l'écran rend toujours.
- **`planning-bandeau-colonne-figee-1280`** (point 4b) — AVANT, la ligne
  « Interventions non affectées » (la ligne figée scrollée jusqu'au bandeau)
  est visible SANS séparation nette sous le bandeau — aucune bordure basse
  propre, la ligne touche le bandeau. APRÈS, le bandeau porte sa bordure
  basse intacte et la ligne figée est entièrement masquée dessous — la
  preuve géométrique (`elementFromPoint`) est dans
  `tests/e2e/planning-bandeau-au-dessus-colonne-figee.spec.ts`, la capture
  l'illustre. À 375 px, le bandeau du bureau n'existe pas (`BandeauMobile` le
  remplace) : les deux images sont identiques, capturées pour mémoire.
- **`signature-trait-*`** (point 4a) — le trait a déjà la bonne épaisseur
  CSS depuis 9I2 ; ce lot ajoute une preuve sur les pixels du PNG, invisible
  à l'œil sur une capture à DPR 1. AVANT et APRÈS sont donc identiques —
  capturées pour documenter l'écran, la preuve est dans
  `tests/e2e/rapport-signature-epaisseur-trait.spec.ts`.
- **`9i5-*`** (point 5) — `ma-journee`, `tableau-de-bord` et `vgp` portent
  le nouveau texte (taille de fichier différente, texte visiblement
  reformulé) ; `fiche-machine` aussi (« l'historique de ses interventions »).
  `donnees-a-completer` est byte-identique : sa clé n'a pas été reformulée
  dans ce lot (seul le test qui la couvrait n'était plus tautologique).
