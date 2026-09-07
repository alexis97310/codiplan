/**
 * CE QUE LA SURFACE HTTP N'OFFRE PAS (tickets L1-02c puis L1-02d).
 *
 * Deux décisions d'exploitation, une même doctrine — **dans un produit où
 * l'accès est délivré, le libre-service n'est pas une surface à borner, c'est
 * une exception à justifier transition par transition** (D58). On n'ouvre pas
 * ce qu'on saura refermer ; on ouvre ce qu'on a une raison d'ouvrir.
 *
 * ## L'INSCRIPTION EN LIBRE-SERVICE N'EXISTE PAS (L1-02c, 07/09/2026).
 *
 * *Personne ne crée son propre compte. Jamais, dans aucun mode.* Un compte de
 * portail est délivré par CODIMA à un client ; un compte interne est ouvert par
 * l'administrateur de la société ; en mode éditeur, la première identité d'une
 * société cliente est ouverte par la console éditeur (lot 7). **Ce n'est pas
 * une restriction, c'est le métier.**
 *
 * Ce module tient la reconnaissance du chemin, à part de la route, pour une
 * seule raison : un gardien doit pouvoir l'éprouver sans monter Next.js.
 *
 * **Ce qu'il ferme, et ce qu'il ne ferme pas.** Il ferme la SURFACE — ce qu'un
 * navigateur peut atteindre. L'API serveur `auth.api.signUpEmail` reste
 * appelable par notre propre code, et c'est ce qui rend l'acte administratif
 * possible ; la politique `utilisateur_ouverture` la borne en base, en exigeant
 * une société active et le rôle qui administre. `disableSignUp` de Better Auth
 * fermerait les deux d'un coup — mesuré — et c'est ce qu'il faudra faire le
 * jour où le chemin administratif d'ouverture de compte existera. Il n'existe
 * pas encore : le fermer aujourd'hui retirerait le seul moyen de créer une
 * identité avec ses identifiants. Inscrit au registre plutôt que caché ici.
 */

/**
 * ## ET LA GESTION DU SECOND FACTEUR PAR LE SUJET NON PLUS (L1-02d, 08/09/2026).
 *
 * `/two-factor/disable` désactive le second facteur du compte connecté : il met
 * `mfa_actif` à `false` **puis supprime la ligne de `second_facteur`**. C'est
 * très exactement la transition que D58 refuse d'ouvrir — *un compte peut
 * modifier ce qui parle de lui, jamais ce qui gouverne son accès.* Le retrait
 * d'un second facteur est un acte administratif : L7-01, `admin_plateforme`
 * seul, journalisé.
 *
 * `/two-factor/enable` est fermé aussi, et pour une raison différente qu'il faut
 * dire : la transition d'enrôlement, elle, est DÉCIDÉE. Mais ce point d'entrée
 * générique porte le mot de passe en corps de requête et ouvre la porte jumelle
 * dans le même greffon ; l'enrôlement s'écrira comme un chemin à nous, borné par
 * `second_facteur_enrolement`, plutôt qu'en rallumant un générique dont on
 * hériterait aussi le contraire.
 *
 * **Pourquoi ce n'était pas déjà fermé, et pourquoi il fallait le faire
 * MAINTENANT.** Ces deux points d'entrée étaient INERTES — mesuré le 07/09,
 * `Unauthorized` sur les deux — mais pas par décision : l'intergiciel de session
 * du greffon lisait l'identité jointe à la session, ce que la politique de
 * L1-02c filtrait. *Une fermeture par effet de bord n'est pas une fermeture,
 * c'est un accident qui nous arrange.* Et L1-02d répare précisément cette
 * lecture : les deux points d'entrée allaient donc se RALLUMER tout seuls. La
 * fermeture délibérée arrive avec la réparation, dans le même geste.
 *
 * **Ce qui n'est PAS fermé, et c'est délibéré** : les chemins de VÉRIFICATION du
 * second facteur (`/two-factor/verify-totp` et ses voisins). Ils servent à
 * présenter le facteur, pas à le gouverner — les fermer interdirait la connexion
 * de tout compte qui en porte un.
 */

/**
 * Les chemins fermés, en liste close.
 *
 * `/sign-up` couvre `/sign-up/email` — le seul aujourd'hui, aucun fournisseur
 * externe n'étant déclaré. Les deux autres sont nommés exactement : un préfixe
 * `/two-factor` aurait emporté la vérification avec eux.
 *
 * La liste porte ce qui existe, et un gardien refuse qu'un chemin d'inscription
 * ou de gouvernance du second facteur apparaisse sans y entrer.
 */
export const CHEMINS_FERMES: readonly string[] = [
  "/sign-up",
  "/two-factor/enable",
  "/two-factor/disable",
];

/** Conservé sous son ancien nom : la moitié « inscription » de la liste. */
export const CHEMINS_INSCRIPTION: readonly string[] = ["/sign-up"];

/** Vrai si ce chemin est fermé — quel que soit le préfixe de montage. */
export function estCheminFerme(chemin: string): boolean {
  const normalise = chemin.replace(/\/+$/, "");
  return CHEMINS_FERMES.some(
    (interdit) =>
      normalise.endsWith(interdit) || normalise.includes(`${interdit}/`),
  );
}

/** Vrai si ce chemin ouvre une inscription. Conservé pour ce qu'il nomme. */
export function estCheminInscription(chemin: string): boolean {
  const normalise = chemin.replace(/\/+$/, "");
  return CHEMINS_INSCRIPTION.some(
    (interdit) =>
      normalise.endsWith(interdit) || normalise.includes(`${interdit}/`),
  );
}
