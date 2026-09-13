import { envoyerCourriel } from "./index";
import type { Envoi } from "./message";

/**
 * LE COURRIEL DE PREMIER ACCÈS — le canal qui manquait (Q8, 13/09/2026).
 *
 * ## Ce qu'il répare, et c'est mesuré
 *
 * *Le 12/09/2026 au soir, Alexis ne pouvait plus entrer dans sa propre
 * application.* Une purge avait effacé les comptes ; le semis les recrée avec
 * `mot_de_passe NULL`, **ce qui est l'état voulu** — la base est en ligne et le
 * dépôt est public, aucun mot de passe ne s'y écrit. La seule porte est donc le
 * lien de premier accès, et ce lien n'avait **aucun canal** :
 *
 * | | |
 * |---|---|
 * | un journal d'exécution GitHub | le dépôt est **public** : un lien de premier accès y est un matériau d'authentification lisible par tout le monde |
 * | une console locale | Alexis travaille depuis un téléphone — ni terminal, ni accès à la base |
 *
 * **Ce n'est pas L2-13.** Celui-là ouvre la porte des CLIENTS, et D96 a écarté
 * l'envoi pour eux avec sa raison. Ici il s'agit de l'EXPLOITANT lui-même, qui
 * n'a aucun back-office ouvert tant qu'il n'est pas entré : *un problème
 * d'amorçage, pas d'invitation* — et il se pose à chaque base neuve.
 *
 * ## LE TEXTE NE PASSE PAS PAR `lib/i18n/fr.ts`, ET C'EST LA RÈGLE
 *
 * La coupure de L0-11 se lit sur la DESTINATION du texte, jamais sur le
 * fichier : *ce qu'un humain lit **en se servant de l'application** passe par le
 * dictionnaire.* Un courriel d'amorçage n'est pas dans l'application — il est
 * envoyé par un geste d'exploitation à quelqu'un qui ne peut pas encore
 * l'ouvrir. Même famille que « documentation contre exécution » (D50).
 *
 * ## CE QU'IL N'ÉCRIT PAS
 *
 * **Ni mot de passe, ni identifiant de société, ni nom de base.** Le corps ne
 * porte que l'URL, l'identité qu'elle ouvre, ce qu'elle vaut et combien de
 * temps. Un courriel se retrouve dans une corbeille, se transfère, s'imprime :
 * *tout ce qu'il porte est durable et hors de notre portée.*
 *
 * ## ET IL NOMME L'IDENTITÉ QU'IL OUVRE (13/09/2026, complément de Q8)
 *
 * *Il s'adressait implicitement à son propriétaire, et ce n'est plus vrai :*
 * `--destinataire` dissocie la boîte qui reçoit de l'identité que le lien
 * ouvre. Un lecteur qui reçoit un lien sans savoir de QUI il ouvre le compte
 * ne peut pas juger s'il doit le suivre — et sur une base de démonstration,
 * les neuf identités semées portent des adresses en `.test` qui ne recevront
 * jamais rien : celui qui reçoit n'est JAMAIS celui qui est nommé.
 *
 * **L'identité est un argument OBLIGATOIRE**, jamais un paramètre facultatif :
 * un appelant qui l'oublierait ne compile pas (la leçon de D70), là où un
 * défaut aurait laissé partir un courriel muet sur ce qu'il ouvre.
 */

/** L'objet, court : il se lit dans une notification de téléphone. */
export const SUJET_PREMIER_ACCES = "CODIPLAN — votre lien de premier accès";

/**
 * Le corps. **L'URL, l'identité qu'elle ouvre, et ce qu'il faut en savoir.**
 *
 * *Quatre questions, et chacune se pose devant un lien reçu par courriel :* de
 * quel compte parle-t-il, d'où vient-il, combien de temps vaut-il, que faire
 * s'il ne marche plus. Sans la première, un lien reçu pour l'identité d'un
 * autre se suit sans le savoir ; sans les autres, un lien expiré se lit comme
 * une panne.
 *
 * **« le compte de X » et jamais « votre compte »** : la seconde formule était
 * vraie tant que le destinataire ÉTAIT l'identité, et `--destinataire` a cessé
 * de le garantir. Une formule qui n'est vraie que dans un cas sur deux est un
 * silence, pas une politesse.
 */
export function corpsPremierAcces(url: string, identite: string): string {
  return [
    `Ce lien ouvre le compte CODIPLAN de ${identite} et demande de choisir son`,
    "mot de passe. Qui le suit entre dans l'application SOUS CETTE IDENTITÉ.",
    "",
    url,
    "",
    "Il ne sert QU'UNE FOIS et il expire au bout d'une heure. Passé ce délai,",
    "redemandez-en un : ce message est le seul endroit où ce lien existe, il",
    "n'est relisible nulle part ailleurs.",
    "",
    "Si vous n'avez rien demandé, ignorez ce message — le lien s'éteindra seul.",
  ].join("\n");
}

/**
 * Envoie le lien, et rend ce qui s'est passé — **jamais rien**.
 *
 * L'appelant décide quoi faire d'un échec : le geste d'amorçage, lui, imprime
 * alors l'URL sur sa sortie, de sorte qu'un envoi manqué ne coûte jamais le
 * lien lui-même. *Le canal est un confort ; le jeton est le produit.*
 */
export async function envoyerLienPremierAcces(
  destinataire: string,
  url: string,
  identite: string,
  environnement: Record<string, string | undefined> = process.env,
): Promise<Envoi> {
  return envoyerCourriel(
    {
      destinataire,
      sujet: SUJET_PREMIER_ACCES,
      texte: corpsPremierAcces(url, identite),
    },
    environnement,
  );
}
