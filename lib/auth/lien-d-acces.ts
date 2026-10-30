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
 * LE DERNIER LIEN A-T-IL ÉTÉ COPIÉ, PLUTÔT QU'ENVOYÉ PAR COURRIEL ? (B6,
 * relecture de 9I6B) — `detailCopie` (ci-dessous) écrit toujours la même
 * sous-chaîne, jamais celle de `detailEnvoi` : pas de nouvelle colonne,
 * aucune migration, le texte DÉJÀ journalisé suffit à distinguer les deux.
 */
export function detailEstCopie(detail: string | null): boolean {
  return detail !== null && detail.includes("lien copié par l'administrateur");
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

/** Ce que `preparerLienDAcces` tient, commun aux deux gestes qui le suivent. */
type PreparationLien = {
  readonly societeId: string;
  readonly role: NonNullable<ContexteSession["role"]>;
  readonly email: string;
  readonly premierEnvoi: boolean;
  readonly url: string;
};

type ResultatPreparation =
  | ({ readonly accepte: true } & PreparationLien)
  | { readonly accepte: false; readonly motif: MotifRefusAccesPartage };

/**
 * LES ÉTAPES PARTAGÉES PAR « ENVOYER » ET « COPIER » (9I6B-LIEN-ACCES-A-
 * COPIER) — la garde de capacité, l'identité, le cliquet de D65, le compte au
 * repos et l'émission du jeton sont EXACTEMENT les mêmes que la personne
 * reçoive son lien par courriel ou que l'administrateur le copie pour le lui
 * transmettre lui-même. Seule la SUITE diffère (voir `envoyerLienDAccesPartage`
 * et `copierLienDAccesPartage` ci-dessous) : l'un envoie un courriel et trace
 * un envoi, l'autre rend l'URL à l'appelant et trace une copie — ni l'un ni
 * l'autre ne doivent dupliquer ce qui précède, au risque de faire diverger un
 * jour le cliquet ou le modèle du compte au repos entre les deux chemins.
 */
async function preparerLienDAcces(
  contexteAdmin: ContexteSession,
  utilisateurId: string,
  client: PrismaClient,
  options: OptionsEnvoiLien,
): Promise<ResultatPreparation> {
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

  return {
    accepte: true,
    societeId,
    role,
    email: identite.email,
    premierEnvoi,
    url,
  };
}

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
  const preparation = await preparerLienDAcces(
    contexteAdmin,
    utilisateurId,
    client,
    options,
  );
  if (!preparation.accepte) {
    return preparation;
  }
  const { societeId, role, email, premierEnvoi, url } = preparation;

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
    email,
    url,
    email,
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

  return { accepte: true, destinataire: email, envoi };
}

/** Ce qu'un refus NOMMÉ dit — les mêmes motifs que l'envoi (D50). */
export type ResultatCopieLien =
  | { readonly accepte: true; readonly url: string }
  | { readonly accepte: false; readonly motif: MotifRefusAccesPartage };

/** Même forme que `detailEnvoi`, sans JAMAIS écrire le jeton (9I6B). */
function detailCopie(
  libelleChemin: string,
  cibleId: string,
  premierEnvoi: boolean,
): string {
  const geste = premierEnvoi ? "premier envoi" : "réémission";
  return `${libelleChemin}, ${geste} ; lien copié par l'administrateur ; ${MARQUEUR_CIBLE}${cibleId}`;
}

/**
 * COPIE (SANS L'ENVOYER) le lien de premier accès d'une identité déjà
 * reconnue membre par l'appelant — D170 (29/10/2026, choix « A ») : sans nom
 * de domaine, Resend refuse les courriels adressés à quiconque n'est pas
 * Alexis, et personne d'autre ne reçoit son lien. L'administrateur le copie
 * ici et le transmet lui-même (WhatsApp, SMS) — **la personne choisit
 * toujours elle-même son mot de passe**, l'administrateur ne le voit jamais.
 *
 * Mêmes gardes, même cliquet de D65, même jeton que
 * `envoyerLienDAccesPartage` (`preparerLienDAcces`, partagée) — seules la
 * SUITE et la trace diffèrent : aucun courriel n'est envoyé, et `detail`
 * nomme « lien copié par l'administrateur », JAMAIS l'URL elle-même, qui
 * porterait le jeton dans le journal (interdit de ce lot).
 *
 * @param contexteAdmin voir `envoyerLienDAccesPartage`.
 * @param utilisateurId la personne visée.
 * @param libelleChemin voir `envoyerLienDAccesPartage`.
 */
export async function copierLienDAccesPartage(
  contexteAdmin: ContexteSession,
  utilisateurId: string,
  libelleChemin: string,
  client: PrismaClient,
  options: OptionsEnvoiLien = {},
): Promise<ResultatCopieLien> {
  const preparation = await preparerLienDAcces(
    contexteAdmin,
    utilisateurId,
    client,
    options,
  );
  if (!preparation.accepte) {
    return preparation;
  }
  const { societeId, role, premierEnvoi, url } = preparation;

  // ── LA TRACE — L'ADMINISTRATEUR COMME AUTEUR, SANS LE JETON (D162, 9I6B) ─
  await avecDesignationAuth(client).journalAcces.create({
    data: {
      id: uuidv7(),
      utilisateur_id: contexteAdmin.utilisateurId,
      evenement: premierEnvoi
        ? "ouverture_identite"
        : "reemission_premier_acces",
      societe_id_cible: societeId,
      role,
      detail: detailCopie(libelleChemin, utilisateurId, premierEnvoi),
    },
  });

  return { accepte: true, url };
}
