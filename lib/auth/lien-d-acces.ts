import type { PrismaClient } from "@prisma/client";

import type { Envoi } from "@/lib/courriel/message";
import { envoyerLienPremierAcces } from "@/lib/courriel/premier-acces";
import { avecSociete } from "@/lib/db/rls";
import { uuidv7 } from "@/lib/db/uuid";

import { creerAuth } from "./config";
import { type ContexteSession, exigerSocieteActive } from "./contexte";
import { peut } from "./habilitations";
import {
  avecDesignationAuth,
  type ContexteAdministratif,
} from "./lecture-identite";

/**
 * LES ÉTAPES COMMUNES À TOUT ENVOI (OU RÉÉMISSION) D'UN LIEN DE PREMIER ACCÈS
 * (D162, extrait de `lib/auth/acces-technicien.ts` pour 9ET-COMPTES-BUREAU-1).
 *
 * Donner l'accès à un technicien et donner l'accès à un compte de bureau
 * partagent TOUT sauf une question — « cette personne est-elle membre, et sous
 * quelle forme ? » — que chaque appelant pose à SA façon avant d'appeler
 * `envoyerLienDAccesPartage` ci-dessous, qui tient le reste : la vérification
 * de capacité (D37), l'identité, le cliquet de D65, le jeton, le courriel, la
 * trace dont l'administrateur est l'auteur. Voir l'en-tête de
 * `lib/auth/acces-technicien.ts` pour le raisonnement complet — il ne se répète
 * pas ici.
 */

/** Ce qu'un refus NOMMÉ dit, et il n'en dit jamais plus (D50). */
export type MotifRefusAccesPartage = "introuvable" | "deja_un_mot_de_passe";

export type ResultatEnvoiLien =
  | {
      readonly accepte: true;
      readonly destinataire: string;
      readonly envoi: Envoi;
    }
  | { readonly accepte: false; readonly motif: MotifRefusAccesPartage };

/** Ce que le geste refuse pour une raison qui n'est PAS un motif nommé. */
export class RefusEnvoiAcces extends Error {}

/**
 * Le marqueur qui porte la CIBLE d'un envoi dans `detail` — TOUJOURS en fin de
 * chaîne (voir `viseCetteCible`). `journal_acces` désigne la trace par son
 * AUTEUR, l'administrateur : `detail` est donc le seul endroit qui porte la
 * cible.
 */
const MARQUEUR_CIBLE = "cible:";

function detailEnvoi(
  libelleChemin: string,
  cibleId: string,
  premierEnvoi: boolean,
  envoi: Envoi,
): string {
  const geste = premierEnvoi ? "premier envoi" : "réémission";
  const resultat = envoi.parti
    ? `courriel parti (référence ${envoi.reference})`
    : `courriel NON parti (${envoi.motif})`;
  return `${libelleChemin}, ${geste} ; ${resultat} ; ${MARQUEUR_CIBLE}${cibleId}`;
}

/** Vrai si un événement de l'historique de l'administrateur vise cette cible. */
export function viseCetteCible(
  detail: string | null,
  utilisateurId: string,
): boolean {
  return (
    detail !== null && detail.endsWith(`${MARQUEUR_CIBLE}${utilisateurId}`)
  );
}

/**
 * CE QU'UN APPELANT PEUT DEMANDER EN PLUS DU CHEMIN LUI-MÊME.
 *
 * `nouveauLien` — D86 (décision n° 86 d'Alexis, 13/10/2026) : le menu « … »
 * d'un compte dont l'accès est déjà ACTIF propose « Envoyer un nouveau lien
 * d'accès » (mot de passe oublié). Le cliquet de D65 (« déjà un mot de
 * passe ») est écrit pour fermer la voie du PREMIER envoi pour toujours — il
 * ne doit JAMAIS fermer celle-ci, nommée et tracée séparément (voir
 * `envoyerNouveauLienDAcces`/`envoyerNouveauLienDAccesBureau`). Absent ou
 * faux, le comportement est inchangé : le premier envoi garde son refus.
 */
export type OptionsEnvoiLien = {
  readonly nouveauLien?: boolean;
};

/**
 * Envoie (ou réémet) le lien de premier accès d'une identité déjà reconnue
 * membre par l'appelant.
 *
 * @param contexteAdmin la session de l'administrateur — `role` doit détenir
 *   `administrer_utilisateurs` (D37 : `admin_societe` ou, depuis D199,
 *   `direction`). Vérifié ICI, pas seulement à la porte de la route.
 * @param utilisateurId la personne visée.
 * @param libelleChemin ce que la trace nomme avant la virgule — identifie le
 *   CHEMIN administratif d'où vient l'envoi (technicien ou compte de bureau),
 *   jamais la cible elle-même.
 */
export async function envoyerLienDAccesPartage(
  contexteAdmin: ContexteSession,
  utilisateurId: string,
  libelleChemin: string,
  client: PrismaClient,
  environnement: Record<string, string | undefined>,
  options: OptionsEnvoiLien = {},
): Promise<ResultatEnvoiLien> {
  const societeId = exigerSocieteActive(contexteAdmin);
  const role = contexteAdmin.role;
  if (role === null || !peut(role, "administrer_utilisateurs")) {
    throw new RefusEnvoiAcces(
      `Le rôle « ${role ?? "aucun"} » ne peut pas envoyer de lien d'accès : ` +
        "cette action est réservée à l'administrateur de la société ou à " +
        "la direction (D37/D199).",
    );
  }

  // ── L'IDENTITÉ — lue par désignation sur son identifiant ────────────────
  const administration: ContexteAdministratif = { societeId, role };
  const designe = avecDesignationAuth(client, administration);
  const identite = await designe.utilisateur.findUnique({
    where: { id: utilisateurId },
    select: { email: true },
  });
  if (identite === null) {
    return { accepte: false, motif: "introuvable" };
  }

  // ── LE COMPTE — LE CLIQUET DE D65 : DÉJÀ UN MOT DE PASSE ? ───────────────
  //
  // SAUTÉ POUR LE SEUL GESTE « NOUVEAU LIEN » (D86, `options.nouveauLien`) —
  // voir `OptionsEnvoiLien` ci-dessus.
  const compteExistant = await designe.compte.findFirst({
    where: { utilisateur_id: utilisateurId },
    select: { mot_de_passe: true },
  });
  if (
    compteExistant !== null &&
    compteExistant.mot_de_passe !== null &&
    options.nouveauLien !== true
  ) {
    return { accepte: false, motif: "deja_un_mot_de_passe" };
  }

  const premierEnvoi = compteExistant === null;
  if (premierEnvoi) {
    // LE COMPTE AU REPOS — même modèle que `poserLeMoyenDeConnexionAuRepos`
    // (`prisma/seed.ts`). Sans cette ligne, `requestPasswordReset` n'a rien à
    // réinitialiser : la bibliothèque exige un compte « credential » existant.
    await designe.compte.create({
      data: {
        id: uuidv7(),
        utilisateur_id: utilisateurId,
        emetteur: "local:credential",
        compte_externe_id: utilisateurId,
        fournisseur_id: "credential",
        mot_de_passe: null,
      },
    });
  }

  // ── LE JETON, PAR UNE INSTANCE MUNIE DU CANAL (modèle Q1 / D65) ──────────
  //
  // L'instance de PRODUCTION ne porte jamais ce canal (lib/auth/config.ts) :
  // seule celle-ci, construite ici, peut faire émettre un jeton.
  let url = "";
  const emetteur = creerAuth(
    client,
    { societeId, role: null },
    async (remise) => {
      url = remise.url;
    },
  );
  await emetteur.api.requestPasswordReset({
    body: { email: identite.email, redirectTo: "/premier-acces" },
  });
  if (url === "") {
    throw new RefusEnvoiAcces(
      "Aucun jeton de premier accès n'a été émis : le lien ne peut pas être " +
        "envoyé. Le geste échoue plutôt que de rendre un envoi muet.",
    );
  }

  // ── LA RAISON SOCIALE (D207, 9EZ-LOGO-SOCIETE-2) — le courriel reste du
  // texte seul, il gagne seulement le NOM de la société en tête. ──────────
  const societe = await avecSociete(client, societeId, (tx) =>
    tx.societe.findUnique({
      where: { id: societeId },
      select: { raison_sociale: true },
    }),
  );

  // ── LE COURRIEL — HORS TRANSACTION, COMME LE GESTE D'AMORÇAGE ───────────
  //
  // `envoyerLienPremierAcces` ne lève jamais : un canal non configuré ou un
  // refus du prestataire rend `{ parti: false, motif }`, jamais une exception
  // — le jeton, lui, EST émis, et la trace ci-dessous s'écrit quand même.
  const envoi = await envoyerLienPremierAcces(
    identite.email,
    url,
    identite.email,
    societe?.raison_sociale ?? "",
    environnement,
  );

  // ── LA TRACE — L'ADMINISTRATEUR COMME AUTEUR (D162) ──────────────────────
  await avecDesignationAuth(client).journalAcces.create({
    data: {
      id: uuidv7(),
      utilisateur_id: contexteAdmin.utilisateurId,
      evenement: premierEnvoi
        ? "ouverture_identite"
        : "reemission_premier_acces",
      societe_id_cible: societeId,
      role,
      detail: detailEnvoi(libelleChemin, utilisateurId, premierEnvoi, envoi),
    },
  });

  return { accepte: true, destinataire: identite.email, envoi };
}
