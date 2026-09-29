# Captures — 9BX-TP-A6-TRIS-MISE-EN-PAGE

Prises le 30/09/2026.

- APRÈS photographié contre `main` au commit `3b7329f` (dernier commit de
  code du lot, avant cette passation).
- AVANT photographié contre le commit `c915940` (dernier commit de `main`
  avant ce lot), depuis un `git worktree` jetable — jamais en modifiant le
  code livré pour reculer.
- Les deux passages jouent le **même fichier**, `tests/e2e/
  captures-tpa6.spec.ts` (committé, inerte sous `pnpm test:e2e` ordinaire,
  il n'écrit rien sans sa variable d'environnement `CAPTURES_TPA6`) — voir
  la mémoire « captures-avant-apres-e2e ».
- Deux largeurs par scène : 1280 px et 375 px. `fullPage`.
- Deux scènes forgées par ce même fichier, préfixées `TPA6-`, supprimées en
  fin de scénario : une agence inactive (`TPA6-Zzz Agence inactive
  (capture)`, code `TPA6INA`, partage le calendrier de Ducos comme Dolbeau
  le fait déjà dans le semis) et une intervention annulée, priorité P1,
  datée du jour même de la capture.
- Le `<select>` « Personne » est capturé FOCUSÉ mais FERMÉ — un `<select>`
  natif ouvert est un popup du système d'exploitation, et l'ouvrir a
  bloqué la capture Playwright en 375 px (mesuré) ; l'état fermé suffit à
  montrer le placeholder ajouté par ce lot.

## Les cinq scènes

| Fichier (préfixe) | Ce qui change |
|---|---|
| `parc-apercu` | `/parc`, une machine sélectionnée — AVANT (375 px) : l'action « Fiche complète » collée à côté de la référence, sans repli, dans une carte qui ne défile pas ; lien « Registre des vérifications périodiques » visible sous la pagination. APRÈS : l'action passe sous l'identification (`max-[600px]:flex-col`, `min-w-0`, PV-06) ; le lien vers le registre a disparu (PV-11, doublon de `nav.vgp`, déjà dans la barre). |
| `agences-inactive-en-fin` | `/parametres/agences` — AVANT : la ligne inactive garde son formulaire de pas et son lien de calendrier actionnables, comme une agence active. APRÈS : les deux sont masqués (badge « Inactif » gardé, ligne repérable), tri par `trierAlphanumeriquement` plutôt que délégué à `ORDER BY` (PA-27). |
| `equipe-tri-nom` | `/parametres/equipe` — AVANT : tri `orderBy: [{ agence_id }, { utilisateur_id }]` (par agence, illisible). APRÈS : tri par NOM (`trierLesTechniciens`, LISTES-1, PA-39). |
| `absences-select-personne` | `/absences` — AVANT : le `<select>` « Personne » s'ouvre déjà sur le premier déclarable, aucune option vide. APRÈS : « Sélectionner une personne » (option vide, désactivée, `required`) précède la liste, elle-même triée par nom (TR-9). |
| `tableau-de-bord-sans-annulee` | `/tableau-de-bord` — la scène forgée (une annulée P1 du jour) est comptée AVANT dans « Interventions aujourd'hui » et éligible à « Urgences » ; APRÈS elle en sort (`listerPlanning(..., { inclureAnnulees: false })`, IN-46). Le chiffre exact dépend du semis présent lors de chaque passage (`5` à ce tirage) ; ce qui compte est l'écart d'UNE unité entre les deux passages, pas la valeur absolue. |

## Non capturé — rien à signaler

Les cinq écrans du lot sont tous capturés ; aucun refus d'accès mesuré.
