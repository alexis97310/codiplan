import { type PrismaClient } from "@prisma/client";
import { z } from "zod";

import { prisma as clientParDefaut } from "@/lib/db/client";

import { auth, type Auth } from "./config";
import { avecDesignationAuth } from "./lecture-identite";

/**
 * L'ENRÔLEMENT DU SECOND FACTEUR — la seule transition en libre-service que ce
 * produit ouvre (ticket L1-02f, décision D58).
 *
 * ## Pourquoi un chemin à nous, et non le point d'entrée de la bibliothèque
 *
 * D59 a fermé `/two-factor/enable` **et** `/two-factor/disable` sur la surface
 * HTTP, nommément, parce qu'ils vivent dans le même greffon : rallumer le
 * premier aurait rallumé son jumeau. Ce qui reste ouvert — et qui ne l'a jamais
 * été par accident — c'est **l'API serveur**, appelable par notre propre code,
 * exactement comme `signUpEmail` l'est pour l'ouverture administrative d'un
 * compte. La surface refermée est celle qu'un navigateur atteint ; celle-ci ne
 * s'atteint que d'ici.
 *
 * ## CE QUE LA MESURE A TROUVÉ, ET QUI EST LE CŒUR DU TICKET
 *
 * Mesuré le 08/09/2026, chaîne réelle : `enableTwoFactor` réussit,
 * `verifyTOTP` répond **HTTP 200** avec un code juste — et **rien n'est
 * enrôlé**. `second_facteur.verifie` reste `false`, `utilisateur.mfa_actif`
 * reste `false`, et le compte se reconnecte sans qu'aucun second facteur ne lui
 * soit demandé.
 *
 * *Un enrôlement qui répond « c'est fait » et n'a rien fait* — et c'est le pire
 * sens de défaillance possible : l'utilisateur se croit protégé, RG-DRO-05 se
 * croit tenue, et la base dit non aux deux sans que personne l'entende. Les
 * deux écritures étaient refusées en silence, chacune pour sa raison (voir la
 * migration `20260908140000`).
 *
 * **Ce module écrit donc les deux drapeaux lui-même**, chacun sous la
 * désignation que sa politique attend, et il VÉRIFIE qu'ils ont bougé. Un refus
 * de RLS sur un `UPDATE` n'est pas une erreur : c'est zéro ligne. Ne pas
 * compter les lignes, ici, ce serait reconstruire le défaut qu'on répare.
 *
 * ## LE CLIQUET NE SE DESSERRE PAS
 *
 * Rien dans ce module ne désenrôle. Il n'appelle jamais `disableTwoFactor`, et
 * il ne pourrait pas : `second_facteur` n'a **aucune** politique de suppression
 * (D59), et `utilisateur_enrolement_mfa` refuse le passage de `true` à `false`.
 * Le retrait d'un second facteur est un acte administratif — L7-01,
 * `admin_plateforme` seul, journalisé.
 *
 * ## LA SESSION EST FERMÉE À LA FIN, ET C'EST VOULU
 *
 * La session qui enrôle a été ouverte **sans** second facteur — le compte n'en
 * avait pas. Lui accorder les droits du rôle au motif qu'un code vient d'être
 * saisi reviendrait à faire confiance à une session qui n'a pas franchi la
 * porte que RG-DRO-05 impose. On la ferme donc, et l'utilisateur se reconnecte
 * en présentant son facteur : la session qui porte les droits est celle qui a
 * présenté le facteur, sans exception.
 */

/** Entrée serveur — Zod, sans exception (CLAUDE.md §2). */
export const schemaDemandeEnrolement = z.object({
  motDePasse: z.string().min(1),
});

export const schemaConfirmationEnrolement = z.object({
  /** Six chiffres. Le format est vérifié ici ; la valeur, par la bibliothèque. */
  code: z.string().regex(/^\d{6}$/),
});

/** Ce que la préparation rend à l'écran, et qui ne s'affiche qu'une fois. */
export type PreparationEnrolement =
  | {
      readonly issue: "prepare";
      /** URI `otpauth://` à présenter en QR code. */
      readonly uriTotp: string;
      /** La même clé, en toutes lettres, pour une saisie manuelle. */
      readonly cleManuelle: string;
      /** Les codes de secours, rendus UNE fois et jamais relisibles. */
      readonly codesSecours: readonly string[];
    }
  | { readonly issue: "refus" };

export type ConfirmationEnrolement =
  | { readonly issue: "enrole" }
  | { readonly issue: "code_invalide" }
  | { readonly issue: "refus" };

/**
 * Le jeton de session que porte le `Set-Cookie` d'une réponse, s'il y en a un.
 *
 * Le cookie de Better Auth est `<jeton>.<signature>` : c'est la partie avant le
 * point qui est la clé de `session.token`.
 */
function jetonDuCookie(reponse: Response): string {
  for (const entete of reponse.headers.getSetCookie?.() ?? []) {
    const paire = entete.split(";")[0] ?? "";
    const separateur = paire.indexOf("=");
    if (
      separateur === -1 ||
      !paire.slice(0, separateur).endsWith("session_token")
    ) {
      continue;
    }
    return decodeURIComponent(paire.slice(separateur + 1)).split(".")[0] ?? "";
  }
  return "";
}

/** La clé lisible que porte l'URI — c'est elle qu'on saisit à la main. */
function cleManuelleDe(uri: string): string {
  try {
    return new URL(uri).searchParams.get("secret") ?? "";
  } catch {
    return "";
  }
}

/**
 * Prépare l'enrôlement : crée la ligne de `second_facteur` et rend le secret.
 *
 * **Le mot de passe est redemandé, et ce n'est pas une friction gratuite.** La
 * bibliothèque l'exige (`shouldRequirePassword`), et elle a raison : poser un
 * second facteur est le geste qui gouverne l'accès au compte. Une session
 * volée ne doit pas suffire à s'en poser un — ce qui reviendrait à verrouiller
 * le compte au nom de son voleur.
 *
 * À ce stade `mfa_actif` reste `false` et `verifie` reste `false` : rien n'est
 * enrôlé tant que le code n'a pas été présenté. Un enrôlement abandonné laisse
 * donc un compte exactement dans l'état où il était.
 */
export async function preparerEnrolement(
  entetes: Headers,
  entree: unknown,
  instance: Auth = auth(),
): Promise<PreparationEnrolement> {
  const demande = schemaDemandeEnrolement.safeParse(entree);
  if (!demande.success) {
    return { issue: "refus" };
  }

  try {
    const reponse = await instance.api.enableTwoFactor({
      body: { password: demande.data.motDePasse, method: "totp" },
      headers: entetes,
    });
    const lu = z
      .object({ totpURI: z.string().min(1), backupCodes: z.array(z.string()) })
      .safeParse(reponse);
    if (!lu.success) {
      return { issue: "refus" };
    }
    return {
      issue: "prepare",
      uriTotp: lu.data.totpURI,
      cleManuelle: cleManuelleDe(lu.data.totpURI),
      codesSecours: lu.data.backupCodes,
    };
  } catch {
    // Mot de passe faux, session absente, greffon indisponible : un seul refus.
    // Distinguer ces cas renseignerait sur l'état du compte (D35).
    return { issue: "refus" };
  }
}

/**
 * Confirme l'enrôlement : vérifie le code, POSE les deux drapeaux, ferme la
 * session.
 *
 * La vérification du code est celle de la bibliothèque — `verifyTOTP` déchiffre
 * le secret avec la clé de signature et compare. La réécrire ici aurait
 * introduit une **seconde implémentation d'un même critère**, qui diverge en
 * silence parce qu'aucune des deux ne prétend être l'autre (§9, 01/09) : le
 * code accepté à l'enrôlement doit être exactement celui qu'accepte la
 * connexion.
 *
 * Ce qui est à nous, ce sont les deux ÉCRITURES, parce que celles de la
 * bibliothèque désignent la ligne par son `id` et sont refusées en silence.
 */
export async function confirmerEnrolement(
  entetes: Headers,
  utilisateurId: string,
  jetonSession: string,
  entree: unknown,
  instance: Auth = auth(),
  client: PrismaClient = clientParDefaut,
): Promise<ConfirmationEnrolement> {
  const demande = schemaConfirmationEnrolement.safeParse(entree);
  if (!demande.success) {
    return { issue: "code_invalide" };
  }

  // ── L'ORDRE DES DEUX ÉCRITURES EST UN CHOIX DE SENS DE DÉFAILLANCE ──────
  //
  // Un compte dont `mfa_actif` est vrai et `second_facteur.verifie` faux **ne
  // peut plus entrer du tout** : la connexion lève `TOTP_NOT_ENABLED`, et le
  // cliquet interdit de revenir en arrière — il faudrait L7-01 pour le
  // débloquer. Cet état est donc le seul qu'il faut rendre impossible.
  //
  // Or `verifyTOTP` pose `mfa_actif` lui-même dès qu'il accepte le code : lui
  // laisser la main d'abord ouvrirait exactement cette fenêtre, si courte
  // soit-elle, et une écriture refusée juste après enfermerait le compte.
  //
  // `verifie` est donc écrit AVANT que le code ne soit présenté, et c'est sûr
  // parce que ce drapeau est **inerte tant que `mfa_actif` est faux** : la
  // connexion ne lit `second_facteur` que si le compte en déclare un. Un
  // enrôlement abandonné laisse une ligne inerte, pas un compte enfermé.
  const facteur = await avecDesignationAuth(client).secondFacteur.updateMany({
    where: { utilisateur_id: utilisateurId },
    data: { verifie: true },
  });
  if (facteur.count === 0) {
    // Zéro ligne n'est PAS une erreur en SQL : c'est le refus silencieux de
    // RLS, ou l'absence de préparation. Le compter est ce qui sépare ce module
    // du défaut qu'il répare.
    return { issue: "refus" };
  }

  let renouvelee = "";
  try {
    const reponse = await instance.api.verifyTOTP({
      body: { code: demande.data.code },
      headers: entetes,
      asResponse: true,
    });
    if (reponse.status !== 200) {
      return { issue: "code_invalide" };
    }
    renouvelee = jetonDuCookie(reponse);
  } catch {
    return { issue: "code_invalide" };
  }

  // ── ET L'ÉTAT FINAL EST RELU, JAMAIS DÉDUIT ─────────────────────────────
  //
  // `verifyTOTP` a peut-être posé `mfa_actif` (sa politique le lui permet
  // depuis ce ticket), peut-être pas : compter les lignes d'un `updateMany`
  // dirait « zéro » dans les DEUX cas — refusé, ou déjà vrai. C'est l'ÉTAT qui
  // compte, pas le delta, et il se lit.
  await avecDesignationAuth(client).utilisateur.updateMany({
    where: { id: utilisateurId, mfa_actif: false },
    data: { mfa_actif: true },
  });
  const identite = await avecDesignationAuth(client).utilisateur.findUnique({
    where: { id: utilisateurId },
    select: { mfa_actif: true },
  });
  if (identite === null || !identite.mfa_actif) {
    return { issue: "refus" };
  }

  // Les sessions ouvertes SANS second facteur n'en portent pas les droits :
  // celle qui a enrôlé, et celle que `verifyTOTP` a renouvelée dans une réponse
  // que personne ne reçoit. Les deux sont fermées — un jeton vivant que nul ne
  // détient reste un jeton vivant.
  for (const jeton of [jetonSession, renouvelee].filter((j) => j !== "")) {
    await avecDesignationAuth(client).session.deleteMany({
      where: { token: jeton },
    });
  }

  return { issue: "enrole" };
}

/**
 * Ce que la préparation a déposé dans l'URL, relu par la page.
 *
 * **Extrait de la page à dessein.** Le gardien de L0-11 lit tout littéral
 * atteignable depuis une expression JSX, et il a raison de le faire : c'est
 * ainsi qu'il attrape une chaîne visible cachée derrière une variable. Le NOM
 * d'un paramètre d'URL n'est pas une chaîne visible — il n'est jamais lu par un
 * humain —, et sa place n'est donc pas dans un composant. La coupure de L0-11
 * est une coupure de DESTINATION : ce texte-ci va vers une machine.
 */
export function preparationDeLUrl(parametres: Record<string, unknown>): {
  readonly cle: string;
  readonly codesSecours: readonly string[];
  readonly motif: string;
} {
  const texte = (nom: string): string => {
    const valeur = parametres[nom];
    return typeof valeur === "string" ? valeur : "";
  };
  return {
    cle: texte("cle"),
    codesSecours: texte("secours").split(",").filter(Boolean),
    motif: texte("motif"),
  };
}
