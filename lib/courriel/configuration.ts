import type { Expediteur } from "./message";
import { expediteurResend, NOM_RESEND } from "./resend";

/**
 * LE CODE DÉMARRE SANS LA CLÉ, ET IL LE DIT (Q8, 13/09/2026).
 *
 * **Rien ici ne lève au chargement du module, et rien ne s'écroule sans
 * configuration.** L'application doit démarrer, se connecter, afficher un
 * planning et rendre `/api/sante` sur une installation où personne n'a encore
 * déposé de clé d'envoi — parce que c'est l'état de TOUTE installation neuve, y
 * compris celle où l'on cherche justement à s'envoyer le premier lien.
 *
 * **Ce qui échoue est l'ENVOI, et il échoue en NOMMANT ce qui manque.** Pas un
 * « échec d'envoi », pas un journal d'erreur qu'on lira plus tard : le nom de la
 * variable à poser et l'endroit où la poser. *Un canal non configuré qui rend
 * une erreur vague fait chercher du côté du réseau pendant une heure.*
 *
 * ## AUCUN SECRET N'EST ÉCRIT ICI, NI NULLE PART DANS LE DÉPÔT
 *
 * Pas de clé, pas d'identifiant, pas d'exemple « de test » — I9, et le dépôt est
 * PUBLIC depuis le 12/09/2026. Ce module ne connaît que des NOMS de variables.
 * Le dépôt de la clé est un geste d'exploitation, hors du dépôt, et c'est un des
 * deux seuls cas d'arrêt du protocole de session.
 *
 * ## LE PRESTATAIRE N'EST PAS CHOISI ICI — IL L'ÉTAIT DÉJÀ
 *
 * Le §2 du `CLAUDE.md` impose Resend au titre de la couche « Email », et cette
 * ligne est antérieure à la question. *Ce n'est donc pas une dépendance
 * nouvelle, c'est une dépendance qu'on active* — et elle s'active sans rien
 * installer : l'interface de Resend est un `POST` en HTTPS, écrit en trente
 * lignes plutôt qu'en deux cents kilo-octets (CLAUDE.md §2).
 *
 * **Une seconde voie reste ouverte sans que ce module bouge** — un SMTP, celui
 * d'une boîte ordinaire avec un mot de passe d'application. Elle demande une
 * DÉPENDANCE (aucun client SMTP n'est installé, et `fetch` n'en tient pas lieu),
 * c'est-à-dire un arbitrage. Ce qu'elle coûte et ce qu'elle exige sont écrits
 * dans `docs/mise-en-ligne.md` ; ce module l'accueillera en un fichier, sans que
 * rien d'autre change. *C'est exactement ce pour quoi l'interface est étroite.*
 */

/** Le nom de la variable qui porte la clé. Un NOM, jamais une valeur. */
export const VARIABLE_CLE = "COURRIEL_API_CLE";

/** Le nom de la variable qui porte l'adresse d'expédition. */
export const VARIABLE_EXPEDITEUR = "COURRIEL_EXPEDITEUR";

/** Ce que la configuration rend : un expéditeur, ou ce qui manque pour l'avoir. */
export type Configuration =
  | { readonly configure: true; readonly expediteur: Expediteur }
  | { readonly configure: false; readonly manque: string };

/**
 * L'expéditeur, ou le refus NOMMÉ.
 *
 * *Les deux variables sont nommées séparément quand les deux manquent* : dire
 * « la configuration est incomplète » obligerait à ouvrir le code pour savoir
 * quoi poser, et le destinataire de ce message est quelqu'un qui lit sur un
 * téléphone.
 */
export function configurationCourriel(
  environnement: Record<string, string | undefined>,
): Configuration {
  const cle = environnement[VARIABLE_CLE]?.trim() ?? "";
  const expediteur = environnement[VARIABLE_EXPEDITEUR]?.trim() ?? "";

  const absentes = [
    cle.length === 0 ? VARIABLE_CLE : null,
    expediteur.length === 0 ? VARIABLE_EXPEDITEUR : null,
  ].filter((nom): nom is string => nom !== null);

  if (absentes.length > 0) {
    return {
      configure: false,
      manque:
        `L'envoi de courriel n'est pas configuré : ${absentes.join(" et ")} ` +
        `${absentes.length > 1 ? "sont absentes" : "est absente"}. ` +
        `Le canal utilise ${NOM_RESEND}, que le §2 du CLAUDE.md impose. ` +
        "La marche à suivre — où déposer la clé et comment vérifier qu'un " +
        "envoi part — est dans `docs/mise-en-ligne.md`, section « Le canal " +
        "d'envoi de courriel ». RIEN N'A ÉTÉ ENVOYÉ.",
    };
  }

  return {
    configure: true,
    expediteur: expediteurResend(cle, expediteur),
  };
}
