import { type PrismaClient } from "@prisma/client";
import { APIError } from "better-auth/api";
import { z } from "zod";

import { prisma as clientParDefaut } from "@/lib/db/client";
import { VARIABLE_SESSION_UTILISATEUR } from "@/lib/db/rls";

import { auth, type Auth } from "./config";
import { dansUnEchangeAuth } from "./echange";
import { LONGUEUR_MINIMALE } from "./premier-acces";
import { type Role } from "./roles";
import { obtenirSession } from "./session";

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
 * détruit — en principe — TOUTES les sessions du compte, y compris celle qui
 * vient d'appeler, puis en recrée une neuve et pose son cookie sur CETTE
 * réponse (`setSessionCookie`, dans l'endpoint). Ce module le passe : un
 * changement de mot de passe ferme toute autre session ouverte du compte
 * (téléphone volé, poste partagé), et la session courante est remplacée par
 * sa neuve plutôt que révoquée — la personne reste connectée, avec un jeton
 * qui n'a plus jamais voyagé avant ce changement. Les `Set-Cookie` de cette
 * réponse sont donc rendus à l'appelant HTTP (`cookies`, ci-dessous),
 * exactement comme `lib/auth/connexion.ts` le fait pour `signInEmail` :
 * reportés tels quels, jamais refabriqués (§9, 01/09).
 *
 * ## MESURÉ : l'option du greffon ne ferme RIEN ici, et pourquoi
 *
 * `deleteUserSessions` (le greffon) écrit `DELETE FROM session WHERE
 * utilisateur_id = …` à travers `avecDesignationAuth`
 * (`lib/auth/lecture-identite.ts`), qui ne pose AUCUNE désignation pour un
 * `where` sur `utilisateur_id` — la politique `session_fermeture` ne reçoit
 * donc ni le jeton ni `app.utilisateur_id`, et refuse tout : **zéro ligne
 * supprimée**, sans erreur (mesuré par un script hors dépôt contre une base
 * réelle, deux sessions ouvertes, l'une et l'autre encore présentes après
 * l'appel). Étendre `CLES_DESIGNATION` pour couvrir ce cas élargirait la
 * lecture des sessions à QUICONQUE connaît un `utilisateur_id` (la politique
 * de lecture le permettrait alors aussi) — exactement ce que le commentaire
 * de `CLES_DESIGNATION.session` refuse déjà pour la lecture par jeton, et une
 * décision hors du territoire de ce ticket (§8 : touche le cloisonnement des
 * tables d'authentification).
 *
 * Ce module ferme donc les autres sessions LUI-MÊME, en posant `app.utilisateur_id`
 * (`VARIABLE_SESSION_UTILISATEUR`) dans une transaction qu'il contrôle
 * entièrement, bornée à l'identifiant que `changePassword` vient de
 * confirmer être CELUI de la session qui a réussi — jamais une valeur reçue
 * en entrée. C'est exactement le chemin que la politique `session_fermeture`
 * anticipait déjà (« pour qu'un compte voie et révoque ses sessions sans
 * avoir à présenter chaque jeton », migration L1-02d) ; il manquait
 * simplement un appelant qui le prenne, et le greffon ne le prend pas.
 *
 * ## MESURÉ AUSSI : la session neuve nait SANS société active, ni rôle
 *
 * `createSession` (le greffon, toujours) ouvre une ligne nue — seul
 * `databaseHooks.session.create.before` (`lib/auth/config.ts`) y ajoute
 * `second_facteur_valide`, rien d'autre. Constaté au navigateur (Playwright,
 * `tests/e2e/9i9-mon-compte.spec.ts`) : sans correction, la personne
 * atterrissait sur `/planning` plutôt que de rester sur « Mon compte »,
 * faute de société active sur la session neuve. Ce module reporte donc, dans
 * la MÊME transaction, la société et le rôle que la session D'AVANT portait —
 * lus avant l'appel, par `obtenirSession`, jamais devinés.
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

/** Le corps qu'une réponse ABOUTIE de `changePassword` porte. */
const schemaCorpsAbouti = z.object({
  token: z.string().min(1),
  user: z.object({ id: z.uuid() }),
});

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
 * Détruit toute session de ce compte AUTRE que `tokenConserve`, puis lui
 * reporte la société et le rôle que la session remplacée portait — voir les
 * deux « MESURÉ » ci-dessus pour ce que `revokeOtherSessions` ne fait pas
 * ici, et pourquoi cette fonction existe pour le faire à sa place.
 *
 * `utilisateurId` n'est jamais celui d'une saisie : il vient du corps que
 * `changePassword` vient de rendre, APRÈS que le mot de passe actuel a été
 * vérifié — c'est l'identité de LA SESSION qui a réussi, point.
 */
async function fermerLesAutresSessions(
  client: PrismaClient,
  utilisateurId: string,
  tokenConserve: string,
  contexteAvant: {
    readonly societeId: string | null;
    readonly role: Role | null;
  },
): Promise<void> {
  await client.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      "SELECT set_config($1, $2, true)",
      VARIABLE_SESSION_UTILISATEUR,
      utilisateurId,
    );
    await tx.session.deleteMany({
      where: { utilisateur_id: utilisateurId, NOT: { token: tokenConserve } },
    });
    if (contexteAvant.societeId !== null && contexteAvant.role !== null) {
      await tx.session.updateMany({
        where: { token: tokenConserve },
        data: {
          societe_id_active: contexteAvant.societeId,
          role_actif: contexteAvant.role,
        },
      });
    }
  });
}

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
  client: PrismaClient = clientParDefaut,
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
    // Lu AVANT l'appel : c'est ce que la session D'AVANT portait, à reporter
    // sur la session neuve une fois `changePassword` abouti (voir le second
    // « MESURÉ » ci-dessus). `null` si la session a disparu entre-temps —
    // `fermerLesAutresSessions` s'abstient alors de reporter quoi que ce soit.
    const sessionAvant = await obtenirSession(entetes, instance);
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
      const corpsBrut: unknown = await reponse.json().catch(() => null);
      const corps = schemaCorpsAbouti.safeParse(corpsBrut);
      if (corps.success) {
        await fermerLesAutresSessions(
          client,
          corps.data.user.id,
          corps.data.token,
          {
            societeId: sessionAvant?.contexte.societeId ?? null,
            role: sessionAvant?.contexte.role ?? null,
          },
        );
      }
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
