# Chaîne de vérification

*19 août 2026 — ticket L0-02*

L'arbitrage D14 fixe deux portes : `pnpm verify` à chaque ticket, `pnpm verify:full` à chaque lot. Voici comment elles sont armées.

---

## 1. Deux portes, deux projets Vitest

**Contexte.** Le cloisonnement multi-société (`test:isolation`) doit être bloquant dès le ticket, les tests bout en bout seulement en fin de lot.

**Options écartées.**
*Deux fichiers de configuration Vitest* — duplique les alias, le greffon React et l'amorce ; une divergence entre les deux passerait inaperçue.
*Un seul projet avec des étiquettes* — `pnpm test` exécuterait aussi les tests d'isolation, et la distinction des deux portes ne serait plus qu'une convention de nommage.

**Choix.** Un seul `vitest.config.mts`, deux projets — `unit` en environnement jsdom, `isolation` en environnement Node — sélectionnés par `vitest run --project <nom>`. Les tests bout en bout restent chez Playwright, jamais chez Vitest. Les portes elles-mêmes sont de simples enchaînements `&&` : un ordonnanceur de scripts serait une dépendance pour ce que le shell fait déjà.

**Conséquences.** Ajouter un test d'isolation revient à déposer un fichier dans `tests/isolation/`, sans toucher à la configuration. `tests/unit/chaine-verification.test.ts` vérifie que `verify` enchaîne bien les cinq étapes dans l'ordre et que `test:e2e` n'y figure pas : retirer `test:isolation` de la porte fait désormais échouer la porte elle-même.

---

## 2. Un gardien de cloisonnement provisoire, mais non vide

**Contexte.** `pnpm test:isolation` est bloquant dès maintenant, alors que les scénarios réels supposent le schéma (L0-03) et les politiques RLS (L0-04). Un répertoire vide fait sortir Vitest en erreur ; un `expect(true)` complaisant ferait passer la porte pour armée alors qu'elle ne l'est pas.

**Options écartées.**
*Rendre `test:isolation` tolérant au vide* (`--passWithNoTests`) — la porte deviendrait verte par absence de tests, exactement le défaut contre lequel elle existe.
*Repousser la porte au ticket L0-05* — l'arbitrage D14 la veut dans `verify` dès maintenant, et une porte ajoutée après coup s'ajoute rarement.

**Choix.** `tests/isolation/gardien.test.ts` protège la porte plutôt que le cloisonnement : il vérifie que le répertoire exécute au moins un fichier et qu'aucun test n'y est neutralisé (`.skip`, `.only`, `.todo`). Le `README.md` du répertoire énonce ce qui reste à écrire au ticket L0-05.

**Conséquences.** La porte est réellement armée sans prétendre couvrir le cloisonnement — **`pnpm test:isolation` vert ne signifie rien sur le cloisonnement tant que L0-05 n'est pas fait**. Le gardien sera remplacé, pas complété, par les douze scénarios de L0-05, et la vérification manuelle exigée par l'arbitrage — retirer un filtre société fait échouer les tests — sera consignée ici à ce moment-là.

---

## 3. Playwright épinglé, et compilation de production sous test

**Contexte.** Les tests bout en bout doivent être reproductibles en intégration continue comme en local.

**Options écartées.**
*Mettre le serveur de développement sous test* — plus rapide à démarrer, mais ce n'est pas ce binaire qui part chez le client, et le mode développement masque une partie des erreurs de rendu serveur.
*Écrire un chemin d'exécutable de navigateur dans la configuration* — lie le dépôt à une machine.

**Choix.** `@playwright/test` est épinglé à `1.56.1`, dont la révision Chromium est celle fournie par l'environnement d'exécution. Le serveur mis sous test est une compilation de production (`next build` puis `next start`) sur le port 3100. Le contexte de navigation est fixé à `fr-FR` et `Pacific/Noumea` — UTC+11, sans changement d'heure.

**Conséquences.** `pnpm test:e2e` reste utilisable seul : il compile lui-même si besoin, le cache Next rendant la reconstruction quasi immédiate après `pnpm verify`. L'épinglage devra être levé consciemment, avec le navigateur correspondant.

---

## 4. Intégration continue : deux tâches mutuellement exclusives

**Contexte.** L'arbitrage D14 demande `verify` à chaque commit et `verify:full` sur la branche principale et chaque nuit.

**Choix.** Un seul flux `.github/workflows/ci.yml`, deux tâches gardées par des conditions disjointes : `verify` sur les propositions de fusion et les poussées hors `main` ; `verify:full` sur `main`, à la demande, et par déclenchement planifié à 15h00 UTC — soit 02h00 à Nouméa. `pnpm format:check` précède les deux, car le formatage ne fait pas partie de `verify`.

**Conséquences.** `verify` n'est jamais joué deux fois sur `main`, puisque `verify:full` le contient. Le fuseau de la tâche nocturne est celui des utilisateurs, pas celui du serveur.

---

## 5. Vérification du critère d'acceptation

Le ticket exige qu'un test volontairement faux fasse échouer la commande. Vérifié le 19 août 2026, un cas par porte, chaque fichier retiré ensuite :

| Test faux déposé dans | Commande | Résultat |
|---|---|---|
| `tests/unit/` | `pnpm verify` | échec, code de sortie 1, à l'étape `test` |
| `tests/isolation/` | `pnpm verify` | échec, code de sortie 1, à l'étape `test:isolation` |
| `tests/e2e/` | `pnpm test:e2e` | échec, code de sortie 1 |

La chaîne s'interrompt à la première étape en défaut, ce qui donne un journal court en intégration continue. La CI exécutant ces mêmes commandes, elle échoue dans les mêmes cas.
