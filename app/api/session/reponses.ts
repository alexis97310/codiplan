/**
 * LES RÉPONSES DES CHEMINS DE SESSION (ticket L1-02f).
 *
 * ## Pourquoi des routes plutôt que des actions de serveur
 *
 * Un formulaire HTML qui poste vers une route fonctionne **sans JavaScript**, et
 * la réponse porte ses `Set-Cookie` sans qu'aucune couche ne s'interpose. Une
 * action de serveur aurait exigé le greffon `nextCookies` de Better Auth, qui
 * appelle `cookies()` de Next à l'intérieur de `auth.api.*` : les scénarios
 * d'isolation, qui n'ont pas de portée de requête Next, ne pourraient plus
 * appeler cette même chaîne. *Le premier écran n'a d'intérêt que s'il s'éprouve
 * sans navigateur.*
 *
 * ## LES COOKIES SONT REPORTÉS, JAMAIS REFABRIQUÉS
 *
 * Le cookie de session porte une signature calculée avec la clé de l'instance,
 * et ses attributs viennent de la configuration. Les reconstruire ici aurait
 * été une seconde implémentation d'un même contrat — celle qui diverge en
 * silence (§9, 01/09).
 */

/** Redirige, en reportant tels quels les `Set-Cookie` reçus. */
export function redirection(
  vers: string,
  cookies: readonly string[] = [],
): Response {
  const entetes = new Headers({ Location: vers });
  for (const cookie of cookies) {
    entetes.append("Set-Cookie", cookie);
  }
  // 303 et non 302 : après un POST, le navigateur doit suivre en GET.
  return new Response(null, { status: 303, headers: entetes });
}

/**
 * Redirige en portant un motif de refus, sous forme de CLÉ et jamais de texte.
 *
 * Une exception ne transporte pas de message destiné à un humain : la couche de
 * rendu choisit sa clé au dictionnaire (`lib/i18n/fr.ts`, la coupure de L0-11).
 */
export function redirectionAvecMotif(
  vers: string,
  motif: string,
  cookies: readonly string[] = [],
): Response {
  return redirection(`${vers}?motif=${encodeURIComponent(motif)}`, cookies);
}

/** Lit un champ texte d'un formulaire, sans jamais rendre autre chose. */
export function champ(formulaire: FormData, nom: string): string {
  const valeur = formulaire.get(nom);
  return typeof valeur === "string" ? valeur : "";
}
