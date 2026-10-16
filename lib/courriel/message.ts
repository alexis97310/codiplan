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
 * ## Q8 AMENDÉE POUR LE SEUL MÉTIER (D89, 13/10/2026, 9EZ-LOGO-SOCIETE-2)
 *
 * Cette règle tient pour `Courriel`, SANS EXCEPTION : connexion (premier
 * accès, nouveau lien, réinitialisation) reste du texte seul pour toujours —
 * *« un courriel d'authentification qui apprend à ouvrir sans réfléchir »*
 * reste le risque qu'on refuse de prendre, quel que soit le volume ou le
 * prestataire.
 *
 * Pour les courriels MÉTIER (annulation, planification, signature terrain,
 * transmission groupée) — qui n'ouvrent ni ne déverrouillent rien — Alexis a
 * tranché l'inverse : le logo de la société vaut mieux qu'une mise en page
 * absente. `CourrielMetier`, plus bas, est cette extension DÉCIDÉE — jamais un
 * champ glissé sur `Courriel`, qui n'en porte aucun de plus qu'avant.
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

/**
 * Une image à intégrer EN LIGNE dans le HTML d'un `CourrielMetier`, référencée
 * par son `cid` (`src="cid:…"`) — jamais par une URL publique (D89 : la route
 * `/api/societe/logo` exige une session, et Gmail bloque les data URI).
 */
export type ImageEnLigne = {
  readonly cid: string;
  readonly type: "image/png" | "image/jpeg";
  readonly octets: Uint8Array;
};

/** La mise en page HTML d'un courriel métier — ≤ 1 image, multipart avec `texte`. */
export type MiseEnPage = {
  readonly html: string;
  readonly imagesEnLigne: readonly ImageEnLigne[];
};

/**
 * CE QUE Q8 REFUSE POUR `Courriel` ET ACCORDE AU SEUL MÉTIER (D89). Un
 * `CourrielMetier` EST un `Courriel` — `texte` reste obligatoire, multipart —
 * augmenté d'une mise en page HTML.
 */
export type CourrielMetier = Courriel & {
  readonly miseEnPage: MiseEnPage;
};

/** Un expéditeur : ce qu'il est, et les deux verbes qu'il porte (D89). */
export type Expediteur = {
  /** Le nom du prestataire, pour les traces et les messages de refus. */
  readonly nom: string;
  envoyer(courriel: Courriel): Promise<Envoi>;
  /** Même discipline que `envoyer` — jamais d'exception, jamais de silence. */
  envoyerMetier(courriel: CourrielMetier): Promise<Envoi>;
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
