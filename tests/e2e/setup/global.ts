import { chromium } from "@playwright/test";

import { BASE_URL } from "../../../playwright.config";
import { preparerLaBase, recreerLaBase, VARIABLE_BASE_E2E } from "./base";
// POSÉ AVANT « ./scene », et l'ordre est tout l'objet de ce module : la
// configuration d'authentification lit son environnement à l'évaluation.
import "./environnement";
import {
  COMPTE_ADMIN_SOCIETE_EPREUVE,
  COMPTE_TECHNICIEN_EPREUVE,
  ecrireLaScene,
  ouvrirLeCompteDeLEpreuve,
} from "./scene";
import { ouvrirLaSessionSensible } from "./session";

/**
 * PRÉPARATION DES SCÉNARIOS DE BOUT EN BOUT (R2-18).
 *
 * ## Ce qu'il fait, dans cet ordre, et l'ordre est une décision
 *
 * 0. La base est DÉTRUITE et recréée — jetable veut dire jetée.
 * 1. Migrations et semis, par le chemin de production (`migrate deploy`).
 * 2. La scène du planning — des lignes écrites exprès, aux identifiants fixes.
 * 3. Le mot de passe du compte de l'épreuve, par le chemin de premier accès.
 * 4. Le second facteur du compte `admin_societe`, par l'écran — voir plus bas.
 *
 * Le mot de passe vient EN DERNIER parce qu'il traverse la bibliothèque
 * d'authentification, qui exige une base déjà migrée : l'inverse échouerait en
 * nommant la mauvaise cause. Le webServer, lui, tourne déjà à ce stade —
 * `playwright.config.ts` le démarre comme un PLUGIN, dont la préparation
 * précède celle des `globalSetups` (`runner/tasks.js`,
 * `createGlobalSetupTasks`) — sans quoi l'étape 4 n'aurait aucun serveur à
 * joindre.
 *
 * ## Le secret de session est TIRÉ AU SORT à chaque exécution
 *
 * *Jamais écrit dans le dépôt* (§9 du protocole de session, I9). Il ne sert
 * qu'à ce serveur-là, pour ces quelques minutes-là, et il est passé au serveur
 * de test par son environnement — jamais par un fichier.
 *
 * **Sans lui, `/connexion` et `/enrolement` rendaient 500** : mesuré le
 * 11/09/2026 par le scénario de R2-16. Ce défaut-là est réparé au niveau des
 * pages (`etatArriveeOuAnonyme`) ; le secret reste néanmoins requis pour qu'une
 * session s'ouvre réellement, ce qui est tout l'objet de ces scénarios.
 *
 * ## L'ENRÔLEMENT DE `admin_societe`, ICI ET UNE SEULE FOIS (Lot E2E-1)
 *
 * `admin_societe` est un rôle sensible (§2, MFA imposée) — la SEULE identité
 * de ce rôle dans le semis, et plusieurs fichiers de scénario s'y connectent
 * (`tests/e2e/equipe.spec.ts`, `tests/e2e/montants-par-role.spec.ts`).
 * **Mesuré : un fichier qui enrôle ce compte lui-même, en cours de run,
 * n'a aucun moyen sûr de faire connaître sa clé aux AUTRES** — un `Map` de
 * module ne survit ni à `fullyParallel` (chaque fichier peut tourner dans son
 * propre processus) ni à une reprise après échec (Playwright ouvre un worker
 * NEUF, voir `tests/e2e/setup/session.ts`). L'enrôlement se fait donc ICI,
 * une seule fois, dans un navigateur que cette préparation ouvre et ferme
 * elle-même — **avant** que `playwright.config.ts` ne distribue le moindre
 * fichier à un worker, donc avant toute parallélisation et toute reprise.
 * `ouvrirLaSessionSensible` pose la clé lue à l'écran dans `process.env`, que
 * chaque worker hérite à sa naissance, y compris un worker né en cours de
 * run. Chaque fichier de scénario continue de traverser l'écran comme un
 * humain le ferait ; seule la PREMIÈRE traversée a lieu ici plutôt que dans
 * l'un d'eux.
 */
export default async function preparation(): Promise<void> {
  if (process.env[VARIABLE_BASE_E2E] === undefined) {
    // Aucune base : les scénarios qui en ont besoin le DIRONT eux-mêmes en
    // échouant. Un `skip` silencieux ici rendrait un vert qui ne parle de rien
    // (§9, 30/08 — un décompte nul ressemble à un sans-faute).
    return;
  }
  await recreerLaBase();
  preparerLaBase();
  const reperes = await ecrireLaScene();
  await ouvrirLeCompteDeLEpreuve(reperes.societeId);
  // LE SECOND COMPTE — celui du terrain (R5-01). Il passe par le MÊME chemin,
  // et c'est ce qui le rend vrai : *un harnais qui écrirait une empreinte en
  // base éprouverait un chemin qui n'existe pas.*
  await ouvrirLeCompteDeLEpreuve(reperes.societeId, COMPTE_TECHNICIEN_EPREUVE);
  // LE TROISIÈME — celui qui ne voit pas les montants (D37). Même chemin
  // encore : trois identités, une seule façon d'ouvrir un compte.
  await ouvrirLeCompteDeLEpreuve(
    reperes.societeId,
    COMPTE_ADMIN_SOCIETE_EPREUVE,
  );

  const navigateur = await chromium.launch();
  try {
    const page = await navigateur.newPage({ baseURL: BASE_URL });
    await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  } finally {
    await navigateur.close();
  }
}
