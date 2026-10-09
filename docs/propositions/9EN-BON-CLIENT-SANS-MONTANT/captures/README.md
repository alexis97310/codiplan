# Captures — 9EN-BON-CLIENT-SANS-MONTANT (D186)

Prises par `tests/e2e/9en-captures.spec.ts`, gated par la variable
`CAPTURES_9EN` (le chemin COMPLET du dossier cible) — l'exécution ordinaire
de `pnpm test:e2e` n'écrit donc jamais ces fichiers.

- **Rôle** : ADV (`COMPTE_EPREUVE`, voit les montants de vente) pour toutes
  les captures sauf `bon-admin-societe-*`, prises avec `admin_societe`
  (`COMPTE_ADMIN_SOCIETE_EPREUVE`, D37 — ne voit pas les montants).
- **Fixture** : scène neuve, préfixée `9EN-`, créée et détruite par le
  fichier de capture lui-même — un client, un site, une intervention
  `terminee` avec un segment de 90 minutes et un forfait de déplacement
  (`FORFAITS_SCENE[0]`), jamais `SCENE.*` ni la fixture de
  `bon-intervention.spec.ts`.
- **Commande AVANT** (code d'avant ce lot, commit `8e9b760a`, rejoué depuis
  un worktree séparé — voir `docs/propositions/9EN-BON-CLIENT-SANS-MONTANT/passation.md`) :
  ```
  git worktree add /tmp/9en-avant 8e9b760a
  ln -s $(pwd)/node_modules /tmp/9en-avant/node_modules
  cp .env /tmp/9en-avant/.env
  cp tests/e2e/9en-captures.spec.ts /tmp/9en-avant/tests/e2e/9en-captures.spec.ts
  cd /tmp/9en-avant
  CAPTURES_9EN="<dépôt>/docs/propositions/9EN-BON-CLIENT-SANS-MONTANT/captures/avant" CI=1 pnpm playwright test tests/e2e/9en-captures.spec.ts
  ```
- **Commande APRÈS** (code livré, depuis le dépôt principal) :
  ```
  CAPTURES_9EN="$(pwd)/docs/propositions/9EN-BON-CLIENT-SANS-MONTANT/captures/apres" CI=1 pnpm playwright test tests/e2e/9en-captures.spec.ts
  ```

## Fichiers

| Fichier | Rôle | Ce qu'il montre |
|---|---|---|
| `bon-adv-defaut-ecran.png` / `-impression.png` | ADV | Le bon par défaut (`/bon`, sans paramètre). AVANT : la section « Valorisation » s'affiche toujours. APRÈS : elle n'existe plus du tout — version CLIENT, QT-8 (a). |
| `bon-adv-interne-ecran.png` / `-impression.png` | ADV | `/bon?version=interne`. AVANT : identique à la capture par défaut (le paramètre n'existait pas encore). APRÈS : bascule active sur « Version interne », badge dans l'en-tête, bloc Valorisation complet (taux, forfait, total), mention de pied « VERSION INTERNE — ne pas remettre au client ». |
| `bon-barre-375.png` | ADV | La barre d'outils à 375 px. AVANT : seul le bouton « Imprimer le bon ». APRÈS : la bascule « Version client · sans montant » / « Version interne » tient sur la largeur sans déborder (`flex-wrap`). |
| `bon-admin-societe-ecran.png` / `-impression.png` | admin_societe | AVANT : le motif « Votre rôle ne donne pas accès aux montants de vente » reste affiché à l'écran (D88), retiré seulement à l'impression. APRÈS : aucune bascule proposée (le rôle n'a pas le droit), aucun motif, aucune mention — la version client, point. |

Les références `Local-C10A71` (avant) et `Local-EC69F9` (après) diffèrent
simplement parce que le numéro de bon est attribué par le serveur à chaque
exécution (I10) — deux scènes distinctes, pas une anomalie.
