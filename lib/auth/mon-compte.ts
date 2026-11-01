import { APIError } from "better-auth/api";
import { z } from "zod";

import { auth, type Auth } from "./config";
import { dansUnEchangeAuth } from "./echange";
import { LONGUEUR_MINIMALE } from "./premier-acces";

/**
 * MON COMPTE — changer son mot de passe EN ÉTANT CONNECTÉ (9I9-MON-COMPTE).
 *
 * ## Ce qui distingue ce module du premier accès
 *
 * `lib/auth/premier-acces.ts` consomme un jeton à usage unique, émis pour un
 * compte dont on ne sait rien côté serveur avant qu'il ne se présente : les
 * refus y sont indiscernables (D35, D50), parce que distinguer renseignerait
 * un tiers sur l'existence ou l'état d'un compte.
 *
 * Ici, une session valide existe déjà : l'identité est CONNUE, par
 * construction — c'est elle, et seulement elle, que `changePassword` relit
 * (`sensitiveSessionMiddleware`, Better Auth). Aucun identifiant de compte ne
 * transite jamais en entrée de ce module : une requête qui en forgerait un
 * (nom de champ quelconque) serait ignorée, jamais lue. *On ne change que SON
 * PROPRE mot de passe, parce qu'il n'y a littéralement rien d'autre à
 * désigner.* Distinguer un mot de passe actuel faux d'une saisie discordante
 * ne renseigne donc personne qu'elle ne sache déjà : c'est son propre compte.
 *
 * ## Les autres sessions de la personne — téléphone volé (9I91, 02/11/2026)
 *
 * `changePassword` accepte un `revokeOtherSessions` optionnel : vrai, il
 * détruit — MESURÉ dans le greffon, pas deviné — TOUTES les sessions du
 * compte, y compris celle qui vient d'appeler, puis en recrée une neuve et
 * pose son cookie sur CETTE réponse (`setSessionCookie`, dans l'endpoint). Ce
 * module le passe : un changement de mot de passe ferme toute autre session
 * ouverte du compte (téléphone volé, poste partagé), et la session courante
 * est remplacée par sa neuve plutôt que révoquée — la personne reste
 * connectée, avec un jeton qui n'a plus jamais voyagé avant ce changement.
 * Les `Set-Cookie` de cette réponse sont donc rendus à l'appelant HTTP
 * (`cookies`, ci-dessous), exactement comme `lib/auth/connexion.ts` le fait
 * pour `signInEmail` : reportés tels quels, jamais refabriqués (§9, 01/09).
 */

const Saisie = z.object({
  motDePasseActuel: z.string().min(1),
  motDePasse: z.string(),
  confirmation: z.string(),
});

/**
 * Le corps qu'une réponse d'erreur de `changePassword` porte, relu par un
 * schéma plutôt que par une conversion de type — un corps inattendu dégrade
 * en refus générique, jamais en exception qui se propagerait (même parti pris
 * que `lib/auth/session.ts`).
 */
const schemaCorpsErreur = z.object({ code: z.string() });

export type SaisieChangementMotDePasse = z.input<typeof Saisie>;

export type IssueChangementMotDePasse =
  | {
      readonly issue: "abouti";
      /**
       * Les `Set-Cookie` de la session neuve, à reporter tels quels sur la
       * réponse HTTP — sans eux, le navigateur garde le cookie de la session
       * que `revokeOtherSessions` vient de détruire, et la personne serait
       * déconnectée au prochain geste (L1-02f, même contrat que
       * `lib/auth/connexion.ts`).
       */
      readonly cookies: readonly string[];
    }
  | { readonly issue: "discordance" }
  | { readonly issue: "trop_court" }
  | { readonly issue: "actuel_incorrect" }
  | { readonly issue: "refuse" };

/**
 * Change le mot de passe de la personne dont `entetes` porte la session.
 *
 * `entetes` est ce que l'appelant HTTP a reçu de la requête — les cookies de
 * session y voyagent, et c'est tout ce que `changePassword` lit pour savoir
 * QUI agit. Aucun identifiant de compte n'est un paramètre de cette fonction.
 */
export async function changerSonMotDePasse(
  saisie: SaisieChangementMotDePasse,
  entetes: Headers,
  instance: Auth = auth(),
): Promise<IssueChangementMotDePasse> {
  const analyse = Saisie.safeParse(saisie);
  if (!analyse.success) {
    return { issue: "refuse" };
  }
  const { motDePasseActuel, motDePasse, confirmation } = analyse.data;

  // LES DEUX CONTRÔLES DE SAISIE D'ABORD, même ordre que le premier accès :
  // ils ne consultent ni ne modifient rien en base.
  if (motDePasse !== confirmation) {
    return { issue: "discordance" };
  }
  if (motDePasse.length < LONGUEUR_MINIMALE) {
    return { issue: "trop_court" };
  }

  return dansUnEchangeAuth(async () => {
    try {
      // `asResponse` plutôt que le corps seul (L1-02f) : c'est la RÉPONSE qui
      // porte les `Set-Cookie` de la session neuve que `revokeOtherSessions`
      // vient de poser, sans lesquels l'appelant HTTP n'aurait rien à
      // reporter au navigateur. MESURÉ (passation) : avec `asResponse`, le
      // greffon ne LÈVE plus l'`APIError` d'un refus (« mot de passe actuel
      // faux »), il la rend sous forme de `Response` en erreur — c'est le
      // STATUT qui porte le refus, et il faut le lire avant le corps.
      const reponse = await instance.api.changePassword({
        headers: entetes,
        body: {
          currentPassword: motDePasseActuel,
          newPassword: motDePasse,
          revokeOtherSessions: true,
        },
        asResponse: true,
      });
      if (reponse.status !== 200) {
        const corps = await reponse.json().catch(() => null);
        const erreur = schemaCorpsErreur.safeParse(corps);
        if (erreur.success && erreur.data.code === "INVALID_PASSWORD") {
          return { issue: "actuel_incorrect" as const };
        }
        return { issue: "refuse" as const };
      }
      const cookies = reponse.headers.getSetCookie?.() ?? [];
      return { issue: "abouti" as const, cookies };
    } catch (erreur) {
      if (
        erreur instanceof APIError &&
        erreur.body?.code === "INVALID_PASSWORD"
      ) {
        return { issue: "actuel_incorrect" as const };
      }
      // Session absente, greffon indisponible, ou tout autre refus de la
      // bibliothèque : un seul motif, qui ne distingue rien de plus — aucun
      // de ces cas n'apprend quoi que ce soit sur un AUTRE compte.
      return { issue: "refuse" as const };
    }
  });
}
