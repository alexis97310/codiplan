/**
 * L'INSCRIPTION EN LIBRE-SERVICE N'EXISTE PAS (ticket L1-02c, décision
 * d'exploitation du 07/09/2026).
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
 * Les chemins d'inscription de Better Auth, en liste close.
 *
 * `/sign-up/email` est le seul aujourd'hui — aucun fournisseur externe n'est
 * déclaré (`emailAndPassword` seul dans `lib/auth/config.ts`). La liste porte
 * ce qui existe, et un gardien refuse qu'un chemin d'inscription apparaisse
 * sans y entrer.
 */
export const CHEMINS_INSCRIPTION: readonly string[] = ["/sign-up"];

/** Vrai si ce chemin ouvre une inscription — quel que soit le préfixe de montage. */
export function estCheminInscription(chemin: string): boolean {
  const normalise = chemin.replace(/\/+$/, "");
  return CHEMINS_INSCRIPTION.some(
    (interdit) =>
      normalise.endsWith(interdit) || normalise.includes(`${interdit}/`),
  );
}
