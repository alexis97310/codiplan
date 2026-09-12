/**
 * L'INTERFACE D'ENVOI, ET ELLE EST ÉTROITE EXPRÈS (Q8, 13/09/2026).
 *
 * **Le choix du prestataire n'est pas une décision d'architecture.** Il se
 * change le jour où le volume monte, où le domaine d'expédition bouge, ou où
 * une facture arrive ; ce qui ne doit pas changer ce jour-là, c'est le reste du
 * produit. D'où une interface qui tient en trois types et une méthode.
 *
 * *Trois choses n'y sont PAS, et chacune est une porte qu'on n'ouvre pas :* ni
 * pièce jointe, ni HTML, ni destinataires multiples. Un lien d'accès se lit en
 * texte, et **un courriel d'authentification qui porte une pièce jointe ou du
 * HTML est un courriel qu'on apprend à ouvrir sans réfléchir.** Le jour où un
 * rapport PDF devra partir (L3-15), ce sera une autre interface ou une
 * extension décidée — jamais un champ glissé ici.
 *
 * ## CE QU'UN ENVOI NE FAIT JAMAIS : ÉCHOUER EN SILENCE
 *
 * `Envoi` est une SOMME, et c'est tout l'objet du type : un appelant ne peut pas
 * ignorer la moitié « pas parti » sans que le compilateur le dise. *Un canal
 * qui laisse croire qu'il a envoyé est pire qu'un canal absent* — l'agence
 * pense avoir invité, la personne n'a rien reçu, et personne ne le sait avant
 * le coup de téléphone.
 *
 * C'est le §9 appliqué à un canal : **le silence a exactement la forme du
 * succès**, et un `void` l'aurait donné gratuitement.
 */

/** Ce qu'on envoie. Du TEXTE, à UNE personne. */
export type Courriel = {
  readonly destinataire: string;
  readonly sujet: string;
  readonly texte: string;
};

/**
 * Ce qu'un envoi rend. Jamais `void`, jamais une exception seule.
 *
 * La `reference` est celle que le prestataire rend — elle sert à retrouver
 * l'envoi chez lui le jour où quelqu'un dit n'avoir rien reçu. **Elle n'est pas
 * une preuve de réception** : elle dit que le prestataire a pris la charge, et
 * rien de plus.
 */
export type Envoi =
  | { readonly parti: true; readonly reference: string }
  | { readonly parti: false; readonly motif: string };

/** Un expéditeur : ce qu'il est, et le seul verbe qu'il porte. */
export type Expediteur = {
  /** Le nom du prestataire, pour les traces et les messages de refus. */
  readonly nom: string;
  envoyer(courriel: Courriel): Promise<Envoi>;
};

/**
 * Une adresse est-elle ADRESSABLE ? Pas « valide » : *adressable*.
 *
 * **Le contrôle est volontairement grossier**, et c'est une décision. Une
 * expression régulière qui prétend valider une adresse de courriel refuse des
 * adresses légitimes — c'est mesurable et connu — et *refuser d'écrire à
 * quelqu'un parce qu'un motif ne l'aime pas est un défaut plus coûteux que de
 * laisser le prestataire rendre son refus*, qui lui, sait.
 */
export function estAdressable(adresse: string): boolean {
  const propre = adresse.trim();
  return propre.length > 2 && propre.includes("@") && !/\s/.test(propre);
}
