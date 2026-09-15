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

/**
 * PRÉPARATION DES SCÉNARIOS DE BOUT EN BOUT (R2-18).
 *
 * ## Ce qu'il fait, dans cet ordre, et l'ordre est une décision
 *
 * 0. La base est DÉTRUITE et recréée — jetable veut dire jetée.
 * 1. Migrations et semis, par le chemin de production (`migrate deploy`).
 * 2. La scène du planning — des lignes écrites exprès, aux identifiants fixes.
 * 3. Le mot de passe du compte de l'épreuve, par le chemin de premier accès.
 *
 * Le mot de passe vient EN DERNIER parce qu'il traverse la bibliothèque
 * d'authentification, qui exige une base déjà migrée : l'inverse échouerait en
 * nommant la mauvaise cause.
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
}
