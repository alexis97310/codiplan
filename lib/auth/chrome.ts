import { obtenirSession } from "@/lib/auth/session";
import type { ContexteSession } from "@/lib/auth/contexte";

/**
 * CE QUE LE CHROME A LE DROIT DE SAVOIR — et surtout, CE QU'IL N'A PAS LE DROIT
 * DE FAIRE ÉCHOUER.
 *
 * ## L'incident qui a fait ce module (11/09/2026)
 *
 * D95 a mis la barre de navigation dans la mise en page racine, et la barre a
 * besoin du nom de la personne connectée. La session a donc été lue **là**, par
 * un appel nu à `obtenirSession`. *Mesuré en rejouant `pnpm test:e2e` : sans
 * `BETTER_AUTH_SECRET`, la bibliothèque d'authentification lève au premier
 * appel, la mise en page racine lève avec elle, et **toutes les pages rendent
 * 500** — y compris `/` qui ne touche aucune base, et `/sante` dont le contrat
 * entier est de ne JAMAIS lever.* Le serveur n'a jamais répondu, et la prise de
 * vue a expiré au bout de 240 secondes.
 *
 * **Le contrat existait déjà, écrit noir sur blanc un module plus loin**, dans
 * `lib/theme/session.ts` : *« un thème ne fait jamais échouer un rendu — toute
 * impossibilité rend le thème neutre »*. Le chrome de la barre est exactement
 * de la même espèce que la charte : de la présentation, posée sur chaque route,
 * y compris celles qui précèdent toute session. **Il devait donc hériter du
 * même contrat, et il ne l'avait pas** — parce que la fonction appelée n'était
 * pas la même.
 *
 * *C'est le §9 du 09/09 dans sa forme la plus simple : la garantie était
 * énoncée pour le THÈME, et le fait à tenir est « la mise en page racine ne
 * lève jamais ». Un second appelant a traversé l'énoncé sans le rencontrer.*
 *
 * ## Ce que ce module garantit, et ce qu'il ne garantit pas
 *
 * **Il ne lève jamais.** Aucune impossibilité — secret absent, base
 * injoignable, session illisible, table manquante — ne remonte : elle rend
 * `null`, ce qui signifie « personne n'est connecté, autant que le chrome
 * sache ».
 *
 * **Il ne décide de RIEN.** Une page qui exige une session continue de la
 * demander par `obtenirSession` et de rediriger elle-même. Ce module ne sert
 * qu'à peindre, et *une pastille d'initiales absente n'est pas un droit
 * accordé*. Confondre les deux ferait de la barre un contrôle d'accès, ce que
 * `lib/navigation/entrees.ts` refuse explicitement.
 */

/** Ce que le chrome lit d'une session, et rien de plus. */
export type IdentiteDeChrome = {
  readonly nom: string;
  readonly contexte: ContexteSession;
};

/**
 * La session, vue par le chrome : `null` plutôt qu'une exception.
 *
 * `lecture` est injectable pour que le contrat — *« ne lève jamais »* — soit
 * MESURABLE : le scénario lui passe une lecture qui lève, et constate `null`.
 * Sans cette couture, on ne pourrait éprouver que le cas qui marche, c'est-à-
 * dire pas le contrat (§9, 30/08 — la violation a-t-elle bien eu lieu ?).
 */
export async function identiteDeChrome(
  entetes: Headers,
  lecture: (e: Headers) => Promise<{
    identite: { nom: string };
    contexte: ContexteSession;
  } | null> = obtenirSession,
): Promise<IdentiteDeChrome | null> {
  try {
    const session = await lecture(entetes);
    if (session === null) {
      return null;
    }
    return { nom: session.identite.nom, contexte: session.contexte };
  } catch {
    // Voir l'entête. Aucune impossibilité ne fait échouer un rendu : ni le
    // secret manquant, ni la base injoignable, ni une session illisible.
    return null;
  }
}
