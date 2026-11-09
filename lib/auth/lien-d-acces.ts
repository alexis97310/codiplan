import { Prisma, type PrismaClient } from "@prisma/client";

import type { Envoi } from "@/lib/courriel/message";
import { envoyerLienPremierAcces } from "@/lib/courriel/premier-acces";
import { avecContexteApplicatif, prisma } from "@/lib/db/client";
import { avecSociete, VARIABLE_SESSION_UTILISATEUR } from "@/lib/db/rls";
import { uuidv7 } from "@/lib/db/uuid";

import { creerAuth } from "./config";
import { type ContexteSession, exigerSocieteActive } from "./contexte";
import { peut } from "./habilitations";
import {
  avecDesignationAuth,
  type ContexteAdministratif,
} from "./lecture-identite";
import type { Role } from "./roles";

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

/**
 * LE RÔLE ACTUEL d'une identité dans `utilisateur_societe`, POUR LA SOCIÉTÉ
 * ACTIVE — SANS le filtre « rôle de bureau » de
 * `lib/auth/acces-bureau.ts` (`roleDuCompteDeBureauMembre`) : un technicien y
 * a AUSSI une ligne (`creerTechnicien`, `lib/techniciens/depot.ts`), avec le
 * rôle `technicien`. Partagée par les DEUX routes « copier un nouveau lien »
 * (D223, bureau ET technicien) : la cible protégée se juge sur le RÔLE réel,
 * jamais sur la table d'où l'appelant est parti.
 *
 * `null` si l'identité n'a aucune ligne pour cette société — un identifiant
 * inconnu ou d'une AUTRE société s'y confond, par construction RLS (I1).
 */
export async function roleDansLaSocieteActive(
  contexteAdmin: ContexteSession,
  utilisateurId: string,
  client: PrismaClient,
): Promise<Role | null> {
  const societeId = exigerSocieteActive(contexteAdmin);
  const habilitation = await avecSociete(client, societeId, (tx) =>
    tx.utilisateurSociete.findFirst({
      where: { utilisateur_id: utilisateurId, societe_id: societeId },
      select: { role: true },
    }),
  );
  return habilitation?.role ?? null;
}

/** Le code SQLSTATE d'une erreur, jamais l'identifiant qui l'a déclenchée. */
function sqlstateDeLErreur(erreur: unknown): string {
  if (erreur instanceof Prisma.PrismaClientKnownRequestError) {
    const sqlstate = erreur.meta?.["code"];
    if (typeof sqlstate === "string") {
      return sqlstate;
    }
    return erreur.code;
  }
  return "inconnu";
}

/**
 * CETTE IDENTITÉ EST-ELLE EXCLUSIVE À LA SOCIÉTÉ ACTIVE ? (D226, 01/11/2026,
 * 9I8D1-REPRISE-9I8D) — appelle `app_identite_exclusive_a_la_societe`
 * (migration `20261101080000_identite_exclusive_a_la_societe_9i8d1`), la
 * SEULE fonction `SECURITY DEFINER` du dépôt, autorisée nommément par D226.
 *
 * `avecSociete` pose `app.societe_id` AVANT l'appel : la fonction le lit dans
 * le contexte, jamais en paramètre (voir la note de la migration). Un
 * contexte sans société active lève ICI, avant même d'atteindre la base
 * (`exigerSocieteActive`) — la fonction, elle, lèverait aussi si elle était
 * atteinte sans société posée.
 *
 * **FAIL-CLOSED (9I8D2)** : sous le propriétaire hébergé, qui n'est ni
 * superutilisateur ni `BYPASSRLS` tant que le point 3 de ce lot n'a pas
 * reposé son propriétaire, cette fonction LÈVE au lieu de répondre (note de
 * la migration, `SET row_security = off` sous FORCE RLS). Une exception ici
 * ne doit JAMAIS devenir une page 500 : elle vaut « non exclusif », au même
 * titre qu'un résultat vide. L'erreur est journalisée SANS l'identité ni la
 * société en cause — seuls le nom de la fonction et le code SQLSTATE sortent.
 */
export async function identiteExclusiveALaSociete(
  contexteAdmin: ContexteSession,
  utilisateurId: string,
  client: PrismaClient,
): Promise<boolean> {
  const societeId = exigerSocieteActive(contexteAdmin);
  try {
    const lignes = await avecSociete(
      client,
      societeId,
      (tx) =>
        tx.$queryRaw<
          readonly { readonly exclusif: boolean }[]
        >`SELECT "app_identite_exclusive_a_la_societe"(${utilisateurId}::uuid) AS "exclusif"`,
    );
    return lignes[0]?.exclusif ?? false;
  } catch (erreur) {
    console.error(
      "app_identite_exclusive_a_la_societe a échoué, code SQLSTATE :",
      sqlstateDeLErreur(erreur),
    );
    return false;
  }
}

/**
 * VARIANTE EN LOT de `identiteExclusiveALaSociete`, pour l'écran Équipe —
 * même forme que `etatsAccesDesComptes`/`etatsAccesDesTechniciens` : la
 * fonction SQL ne prend qu'UNE identité, les lectures restent donc N, mais DE
 * FRONT (`Promise.allSettled`) plutôt que l'une après l'autre.
 *
 * `identiteExclusiveALaSociete` ne lève déjà plus (fail-closed, 9I8D2), mais
 * `Promise.allSettled` plutôt que `Promise.all` tient la même garantie
 * INDÉPENDAMMENT de cette implémentation : UN échec ne doit jamais faire
 * tomber l'écran Équipe entier (`app/error.tsx`) pour toutes les identités de
 * la page — une identité en échec vaut `false` (bouton caché), les autres
 * répondent normalement.
 */
export async function identitesExclusivesALaSociete(
  contexteAdmin: ContexteSession,
  utilisateurIds: readonly string[],
  client: PrismaClient = prisma,
): Promise<ReadonlyMap<string, boolean>> {
  if (utilisateurIds.length === 0) {
    return new Map();
  }
  const resultats = await Promise.allSettled(
    utilisateurIds.map((utilisateurId) =>
      identiteExclusiveALaSociete(contexteAdmin, utilisateurId, client),
    ),
  );
  return new Map(
    utilisateurIds.map((utilisateurId, index) => {
      const resultat = resultats[index];
      return [
        utilisateurId,
        resultat?.status === "fulfilled" ? resultat.value : false,
      ] as const;
    }),
  );
}

/**
 * CETTE IDENTITÉ TIENT-ELLE UN RATTACHEMENT INTERNE DANS UNE AUTRE SOCIÉTÉ
 * QUE L'ACTIVE ? (D233, complément du 09/11/2026, 9K04-PORTAIL-INVITATION-
 * EMPLOYE) — appelle `app_identite_interne_ailleurs` (migration
 * `20261109050000_identite_interne_ailleurs_9k04`), la SECONDE entrée de
 * `AUTORISEES_PAR_ARBITRAGE` (D50), sur le modèle de D226.
 *
 * Question plus étroite que `identiteExclusiveALaSociete` : ne regarde que
 * `utilisateur_societe` (rattachement INTERNE — bureau ou technicien), jamais
 * `utilisateur_client`. Ferme le résidu nommé par D233 (c) :
 * `identiteExclusiveALaSociete` seule ne peut pas distinguer un compte
 * d'employé d'ailleurs d'un compte client d'ailleurs.
 *
 * **FAIL-CLOSED (même famille que 9I8D2), MAIS INVERSÉ par rapport à
 * `identiteExclusiveALaSociete`** : dans `inviterClientAuPortail`, c'est la
 * réponse `true` qui mène au REFUS (motif `compte_interne`). Une exception
 * ici ne doit donc JAMAIS devenir une acceptation silencieuse : elle vaut
 * « oui, interne ailleurs », au même titre qu'un résultat trouvé — jamais
 * `false`. L'erreur est journalisée SANS l'identité ni la société en cause.
 */
export async function identiteInterneAilleurs(
  contexteAdmin: ContexteSession,
  utilisateurId: string,
  client: PrismaClient,
): Promise<boolean> {
  const societeId = exigerSocieteActive(contexteAdmin);
  try {
    const lignes = await avecSociete(
      client,
      societeId,
      (tx) =>
        tx.$queryRaw<
          readonly { readonly interne_ailleurs: boolean }[]
        >`SELECT "app_identite_interne_ailleurs"(${utilisateurId}::uuid) AS "interne_ailleurs"`,
    );
    return lignes[0]?.interne_ailleurs ?? true;
  } catch (erreur) {
    console.error(
      "app_identite_interne_ailleurs a échoué, code SQLSTATE :",
      sqlstateDeLErreur(erreur),
    );
    return true;
  }
}

/**
 * L'INVITATION D'UN CLIENT AU PORTAIL (D96, D230, 9J02A-REPRISE-9J02).
 *
 * ## Une porte DISTINCTE (D96, §3) — et pourtant adossée au même module
 *
 * D96 pose quatre exigences tenues par la BASE : usage unique, durée limitée,
 * révocable, tracé. Les deux premières viennent, comme pour un compte
 * interne, du jeton de premier accès de Better Auth (`verification`, une
 * heure, à usage unique). La troisième est `UtilisateurClient.actif`
 * (`revoquerAccesPortailClient` ci-dessous). La quatrième est `journal_acces`,
 * SEULEMENT quand une identité est ouverte — une simple réactivation
 * (deuxième rattachement, ou ré-invitation après révocation) touche une
 * table de la PREMIÈRE catégorie de I1, déjà auditée par déclencheur (I8) :
 * y ajouter une trace manuelle serait une DOUBLE comptabilité.
 *
 * ## Capacité porteuse : `administrer_utilisateurs`, PAS `gerer_client_site`
 *
 * D230 (`docs/arbitrages.md`) : inviter au portail ouvre souvent une identité
 * neuve, et `utilisateur_ouverture` ne l'accepte que de `app_peut_administrer_identites()`
 * — admin_societe et direction (D37/D199), jamais l'ADV malgré D130. C'est la
 * MÊME garde que `preparerLienDAcces` ci-dessus, par construction : les deux
 * ouvrent une identité.
 *
 * ## `UtilisateurClient` est créé ACTIF, jamais en attente
 *
 * Il n'existe aucun autre point d'ancrage : la consommation du jeton de
 * premier accès passe par l'écran GÉNÉRIQUE `/premier-acces` (D65), commun à
 * tous les comptes, qui ne sait rien d'un client ni d'un site et n'écrit
 * jamais `utilisateur_client`. Le périmètre est donc fixé ICI, à la
 * génération — jamais choisi par qui consomme le lien (D96) — exactement
 * comme l'amorçage (`ouvrirPremierCompte`) pose l'habilitation AVANT que la
 * personne n'ait choisi un mot de passe. Le compte naît SANS mot de passe
 * (voir plus bas, pourquoi jamais `signUpEmail`) et reste donc inutilisable
 * tant qu'elle n'en a pas choisi un : « actif » dit le PÉRIMÈTRE accordé,
 * pas la capacité de s'en servir.
 *
 * ## Le périmètre de sites — DÉFAUT « tous les sites du client »
 *
 * Aucune ligne `UtilisateurClientSite` n'est posée par ce geste : c'est la
 * convention déjà écrite au schéma (« aucune ligne = tous les sites,
 * jamais aucun »). Un sélecteur de sites à l'invitation reste à construire
 * — passation de ce lot.
 *
 * ## Seconde identité, seconde invitation : RÉUTILISE, jamais ne duplique
 *
 * Si le courriel désigne une identité déjà ouverte (ailleurs dans CETTE
 * société), elle n'est pas rouverte. Le rattachement est un `upsert` sur la
 * clé unique `(utilisateur_id, client_id)` — un second appel pour le MÊME
 * client réactive la ligne plutôt que d'échouer sur la contrainte.
 *
 * Si l'identité porte déjà un mot de passe (elle a déjà servi, pour un AUTRE
 * client), aucun jeton n'est émis : l'accès est immédiat, il n'y a rien à
 * transmettre (`url: null`, `dejaActif: true`).
 *
 * ## UNE IDENTITÉ CONNUE D'UNE AUTRE SOCIÉTÉ (C1, étude du 08/11, décision
 * d'Alexis du 08/11 ~09:00)
 *
 * Trouvée par son courriel, une identité peut appartenir à une tout AUTRE
 * société — `preparerLienDAcces` ci-dessus ne se pose jamais la question
 * (D96 garde déjà sa propre porte, `/premier-acces`, générique). Ici, un
 * administrateur de la société A ne doit JAMAIS obtenir le lien d'un compte
 * pas encore activé d'une société B, ni recevoir plus que ces deux faits :
 *
 * - le mot de passe est déjà posé (`compte.mot_de_passe`, lu sans filtre de
 *   société — voir `preparerLienDAcces`) : « quelle que soit la société où il
 *   est connu », c'est un compte client déjà ACTIF, et l'invitation pose
 *   simplement le rattachement (`dejaActif: true`), EXACTEMENT comme pour une
 *   seconde invitation dans la MÊME société ;
 * - sinon, et SEULEMENT si `identiteExclusiveALaSociete` (D226) répond faux —
 *   c'est-à-dire que l'identité porte au moins une ligne `utilisateur_societe`
 *   OU `utilisateur_client` pour une société autre que l'active — le geste
 *   refuse NOMMÉMENT (`compte_connu_autre_societe`) AVANT d'émettre quoi que
 *   ce soit : aucun jeton, aucun rattachement.
 *
 * **Ce que `identiteExclusiveALaSociete` seule ne peut PAS distinguer** :
 * elle ne rend qu'un booléen (D226, `SET row_security = off` nommément borné
 * à ce résultat) — jamais LAQUELLE des deux tables a répondu. Un compte déjà
 * actif ailleurs (mot de passe posé) tombe donc dans la branche `!exclusive`
 * sans qu'on sache encore s'il s'agit d'un client ou d'un employé.
 *
 * **D233 (c), fermé par le complément du 09/11/2026 (9K04-PORTAIL-
 * INVITATION-EMPLOYE)** : `identiteInterneAilleurs` (D233, migration
 * `20261109050000_identite_interne_ailleurs_9k04`) tranche cette seconde
 * question — ce compte déjà actif ailleurs porte-t-il un rattachement
 * `utilisateur_societe` (interne) pour une AUTRE société ? Si oui, refus
 * NOMMÉ (`compte_interne`), avant tout rattachement ni tout jeton — un
 * employé d'ailleurs ne devient jamais un compte client, même déjà actif.
 * Sinon, (a) s'applique : accepté, `dejaActif: true`.
 */

/** Ce qu'un refus NOMMÉ dit, et il n'en dit jamais plus (D50). */
export type MotifRefusInvitationClient =
  "client_introuvable" | "compte_interne" | "compte_connu_autre_societe";

export type ResultatInvitationClient =
  | {
      readonly accepte: true;
      /**
       * `null` quand l'identité portait déjà un mot de passe : l'accès au
       * nouveau client est immédiat, aucun lien n'est à transmettre.
       */
      readonly url: string | null;
      readonly dejaActif: boolean;
    }
  | { readonly accepte: false; readonly motif: MotifRefusInvitationClient };

/** Ce que le geste refuse pour une raison qui n'est PAS un motif nommé. */
export class RefusInvitationClient extends Error {}

function exigerCapaciteInvitationClient(
  contexteAdmin: ContexteSession,
): NonNullable<ContexteSession["role"]> {
  const role = contexteAdmin.role;
  if (role === null || !peut(role, "administrer_utilisateurs")) {
    throw new RefusInvitationClient(
      `Le rôle « ${role ?? "aucun"} » ne peut pas administrer l'accès portail ` +
        "d'un client : cette action est réservée à l'administrateur de la " +
        "société ou à la direction (D37/D199, D230).",
    );
  }
  return role;
}

/**
 * Invite un client au portail — génère (ou réémet) le lien de premier accès
 * de son compte, et accorde le rattachement.
 *
 * @param contexteAdmin la session de l'administrateur — `role` doit détenir
 *   `administrer_utilisateurs`. Vérifié ICI, pas seulement à la porte de la
 *   route (D230).
 * @param clientId le client visé, dans la société active.
 * @param email le courriel du contact invité — déjà validé par la route
 *   (Zod, CLAUDE.md §5).
 */
export async function inviterClientAuPortail(
  contexteAdmin: ContexteSession,
  clientId: string,
  email: string,
  client: PrismaClient = prisma,
): Promise<ResultatInvitationClient> {
  const societeId = exigerSocieteActive(contexteAdmin);
  const role = exigerCapaciteInvitationClient(contexteAdmin);

  // ── LE CLIENT EXISTE-T-IL, DANS LA SOCIÉTÉ ACTIVE ? ──────────────────────
  const fiche = await avecSociete(client, societeId, (tx) =>
    tx.client.findUnique({ where: { id: clientId }, select: { id: true } }),
  );
  if (fiche === null) {
    return { accepte: false, motif: "client_introuvable" };
  }

  // ── L'IDENTITÉ — DÉSIGNÉE PAR LE COURRIEL, OUVERTE SI ABSENTE ───────────
  const administration: ContexteAdministratif = { societeId, role };
  const existante = await avecDesignationAuth(
    client,
    administration,
  ).utilisateur.findUnique({ where: { email }, select: { id: true } });

  let utilisateurId: string;
  let identiteNouvelle = false;
  if (existante !== null) {
    // ── UN COMPTE INTERNE NE PEUT PAS DEVENIR UN COMPTE CLIENT ──────────────
    //
    // `utilisateur_societe` et `utilisateur_client` sont censées être
    // exclusives (commentaire du schéma), mais rien en base ne l'impose : sans
    // ce contrôle, une adresse d'administrateur recevrait un rattachement
    // `utilisateur_client` tout en gardant son rôle interne, et `lireRole`
    // (qui regarde `utilisateur_societe` AVANT `utilisateur_client`) ferait
    // toujours gagner le rôle interne — l'invitation semblerait réussie sans
    // jamais ouvrir le portail promis.
    const roleInterne = await roleDansLaSocieteActive(
      contexteAdmin,
      existante.id,
      client,
    );
    if (roleInterne !== null) {
      return { accepte: false, motif: "compte_interne" };
    }
    utilisateurId = existante.id;

    // ── CETTE IDENTITÉ EST-ELLE CONNUE D'UNE AUTRE SOCIÉTÉ ? (C1) ───────────
    //
    // Voir le en-tête de la fonction, juste au-dessus, pour ce que ce refus
    // couvre et ce qu'il ne peut PAS distinguer. Lu AVANT tout rattachement
    // ni tout jeton : un refus ici n'écrit rien.
    const exclusive = await identiteExclusiveALaSociete(
      contexteAdmin,
      existante.id,
      client,
    );
    if (!exclusive) {
      const compteAilleurs = await avecDesignationAuth(client).compte.findFirst(
        {
          where: { utilisateur_id: existante.id },
          select: { mot_de_passe: true },
        },
      );
      if (compteAilleurs === null || compteAilleurs.mot_de_passe === null) {
        return { accepte: false, motif: "compte_connu_autre_societe" };
      }

      // ── CE COMPTE DÉJÀ ACTIF AILLEURS EST-IL UN EMPLOYÉ, PAS UN CLIENT ?
      // (D233 (c), fermé par D233 complément 9K04) ───────────────────────
      //
      // Jusqu'ici, un compte déjà actif ailleurs (mot de passe posé) était
      // accepté sans distinction — (a) et (c) suivaient la même branche. La
      // décision d'Alexis du 08/11 ~09:00, point (c) : un employé (interne)
      // d'une autre société est refusé, même déjà actif. Lu AVANT tout
      // rattachement ni tout jeton : un refus ici n'écrit rien.
      const interneAilleurs = await identiteInterneAilleurs(
        contexteAdmin,
        existante.id,
        client,
      );
      if (interneAilleurs) {
        return { accepte: false, motif: "compte_interne" };
      }
    }
  } else {
    // ── L'IDENTITÉ ET SON COMPTE AU REPOS, ÉCRITS DIRECTEMENT ───────────────
    //
    // JAMAIS `auth.api.signUpEmail` : `tests/unit/auth/amorcage-retrait.test.ts`
    // exige le RETRAIT du geste d'amorçage (Q1 / D65) dès qu'un appel à cette
    // fonction apparaît hors de `lib/auth/amorcage.ts` — c'est la signature
    // même d'un « chemin administratif d'ouverture de compte », et ce lot n'a
    // ni mandat ni migration pour retirer l'amorçage. Le gardien annonce
    // lui-même sa limite : « un chemin […] sans passer par `signUpEmail` […]
    // lui échapperait » — c'est exactement ce chemin-ci, et aucun mot de passe
    // jetable n'est donc nécessaire : le compte naît SANS mot de passe, comme
    // le fait déjà `preparerLienDAcces` ci-dessus pour une identité interne qui
    // n'en a pas encore.
    utilisateurId = uuidv7();
    const designe = avecDesignationAuth(client, administration);
    await designe.utilisateur.create({
      data: { id: utilisateurId, nom: email, email },
    });
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
    identiteNouvelle = true;
  }

  // ── LE RATTACHEMENT — CRÉÉ OU RÉACTIVÉ, JAMAIS DE LIGNE utilisateur_societe
  await avecContexteApplicatif(
    contexteAdmin,
    (tx) =>
      tx.utilisateurClient.upsert({
        where: {
          utilisateur_id_client_id: {
            utilisateur_id: utilisateurId,
            client_id: clientId,
          },
        },
        create: {
          id: uuidv7(),
          utilisateur_id: utilisateurId,
          client_id: clientId,
          societe_id: societeId,
          actif: true,
        },
        update: { actif: true },
      }),
    client,
  );

  // ── LE JETON — SEULEMENT SI AUCUN MOT DE PASSE N'EXISTE ENCORE ──────────
  const compteExistant = await avecDesignationAuth(client).compte.findFirst({
    where: { utilisateur_id: utilisateurId },
    select: { mot_de_passe: true },
  });
  const dejaActif =
    compteExistant !== null && compteExistant.mot_de_passe !== null;

  let url: string | null = null;
  if (!dejaActif) {
    const emetteur = creerAuth(
      client,
      { societeId, role: null },
      async (remise) => {
        url = remise.url;
      },
    );
    // `?email=` SUR LE LIEN LUI-MÊME (9J21, point 6) — Better Auth reporte
    // tout ce qui figure déjà dans `redirectTo` jusqu'au lien final, en plus
    // du jeton qu'il y ajoute. `/premier-acces` affiche cette adresse en
    // LECTURE SEULE (D35/D50 intacts : rien n'est lu du jeton pour l'obtenir,
    // voir `lib/i18n/fr.ts`). Alexis a vu, le 06/11, la personne invitée
    // modifier l'adresse qu'il avait saisie — l'écran n'avait alors AUCUN
    // champ `email` soumis au serveur, qui ne lit toujours l'identité que du
    // jeton : il n'y a donc rien d'autre à « refuser ».
    await emetteur.api.requestPasswordReset({
      body: {
        email,
        redirectTo: `/premier-acces?email=${encodeURIComponent(email)}`,
      },
    });
    if (url === null || url === "") {
      throw new RefusInvitationClient(
        "Aucun jeton de premier accès n'a été émis : l'invitation échoue " +
          "plutôt que de rendre un lien muet.",
      );
    }
  }

  // ── LA TRACE — SEULEMENT SI UNE IDENTITÉ A ÉTÉ OUVERTE (D162) ───────────
  if (identiteNouvelle) {
    await avecDesignationAuth(client).journalAcces.create({
      data: {
        id: uuidv7(),
        utilisateur_id: contexteAdmin.utilisateurId,
        evenement: "ouverture_identite",
        societe_id_cible: societeId,
        role,
        detail:
          `invitation au portail client, premier envoi ; lien copié par ` +
          `l'administrateur ; ${MARQUEUR_CIBLE}${utilisateurId}`,
      },
    });
  }

  return { accepte: true, url, dejaActif };
}

/**
 * Ce que la trace nomme avant la virgule, pour la SEULE copie d'un NOUVEAU
 * lien d'un compte du portail — voir `copierNouveauLienDAccesPortail`.
 */
const LIBELLE_CHEMIN_NOUVEAU_LIEN_PORTAIL =
  "nouveau lien (mot de passe oublié) copié par l'administrateur de la " +
  "société ou la direction — compte du portail client (D96/D230, D223/D226)";

/** Ce qu'un refus NOMMÉ dit — les motifs partagés plus ceux du portail (D50). */
export type MotifRefusCopieNouveauLienPortail =
  MotifRefusAccesPartage | "revoque" | "autre_societe";

export type ResultatCopieNouveauLienPortail =
  | { readonly accepte: true; readonly url: string }
  | {
      readonly accepte: false;
      readonly motif: MotifRefusCopieNouveauLienPortail;
    };

/**
 * COPIE UN NOUVEAU LIEN D'ACCÈS (mot de passe oublié) D'UN COMPTE DU PORTAIL
 * CLIENT DONT L'ACCÈS EST DÉJÀ ACTIF (9K14-PORTAIL-COPIER-NOUVEAU-LIEN) —
 * variante portail de `copierNouveauLienDAccesBureau`
 * (`lib/auth/acces-bureau.ts`), D86/9I6B : Alexis ne reçoit pas les courriels
 * et veut, comme administrateur, voir et copier le lien d'un compte du
 * portail depuis la fiche du client (backlog B7).
 *
 * **D223 et D226 appliquées comme pour un compte de bureau** (étude du
 * 08/11, §5.1 : sans elles, ce geste recrée C1 — une identité du portail
 * partagée avec une autre société pourrait recevoir ici un lien utilisable
 * par qui ne la contrôle pas entièrement). Ordre des contrôles, chacun avec
 * son motif : capacité `administrer_utilisateurs` (défense en profondeur,
 * D230) → rattachement de CE compte à CE client, dans la société active
 * (`introuvable` sinon, sans rien dire de plus) → rattachement ACTIF
 * (`revoque` : un compte révoqué se RÉ-INVITE, il ne reçoit pas de nouveau
 * lien) → exclusivité D226 (`autre_societe`, fail-closed comme 9I8D2).
 * Aucune lecture cross-société hors `identiteExclusiveALaSociete`.
 *
 * **Aucune « cible protégée » (D223) ici** : un compte du portail ne porte
 * jamais le rôle `direction` ni `admin_societe` — ces deux rôles n'existent
 * que dans `utilisateur_societe`, jamais dans `utilisateur_client` (D96). Ce
 * que D223 apporte à ce geste est sa DISCIPLINE (capacité, puis D226),
 * jamais une liste de rôles protégés à recopier ici.
 *
 * @param contexteAdmin voir `inviterClientAuPortail` — même garde (D230).
 * @param clientId le client visé, dans la société active.
 * @param utilisateurId le compte du portail visé.
 */
export async function copierNouveauLienDAccesPortail(
  contexteAdmin: ContexteSession,
  clientId: string,
  utilisateurId: string,
  client: PrismaClient = prisma,
): Promise<ResultatCopieNouveauLienPortail> {
  const societeId = exigerSocieteActive(contexteAdmin);
  exigerCapaciteInvitationClient(contexteAdmin);

  const rattachement = await avecSociete(client, societeId, (tx) =>
    tx.utilisateurClient.findFirst({
      where: { client_id: clientId, utilisateur_id: utilisateurId },
      select: { actif: true },
    }),
  );
  if (rattachement === null) {
    return { accepte: false, motif: "introuvable" };
  }
  if (!rattachement.actif) {
    return { accepte: false, motif: "revoque" };
  }

  if (
    !(await identiteExclusiveALaSociete(contexteAdmin, utilisateurId, client))
  ) {
    return { accepte: false, motif: "autre_societe" };
  }

  return copierLienDAccesPartage(
    contexteAdmin,
    utilisateurId,
    LIBELLE_CHEMIN_NOUVEAU_LIEN_PORTAIL,
    client,
    { nouveauLien: true },
  );
}

/** Ce qu'un refus NOMMÉ dit — la ligne n'existait pas (D50). */
export type ResultatRevocationAccesPortail =
  | { readonly accepte: true }
  | { readonly accepte: false; readonly motif: "introuvable" };

/**
 * Révoque l'accès portail d'un compte client — bascule `actif = false` sur sa
 * ligne `UtilisateurClient`, jamais de suppression (I6). Même mécanisme que
 * `basculerActiviteContact` (`lib/contacts/depot.ts`).
 *
 * **RÉVOCATION IMMÉDIATE (I1, décision d'Alexis du 08/11, point (d))** : si,
 * APRÈS cette bascule, l'identité ne tient plus aucun accès ACTIF dans la
 * SOCIÉTÉ QUI RÉVOQUE — ni un autre rattachement `UtilisateurClient`, ni une
 * ligne `UtilisateurSociete` — toutes ses sessions sont détruites dans la
 * foulée : un client révoqué connecté ne doit plus rien voir, barème compris.
 * « Dans la société qui révoque », jamais ailleurs : I1 interdit de lire une
 * AUTRE société pour en décider, et ce n'est pas nécessaire — si l'identité
 * garde un accès dans une autre société, sa session y reste valable, et
 * chaque porte du portail (`rattachementsDuCompte`, filtrée `actif: true`,
 * et désormais `contextePortailTarifs`) revérifie son rattachement à chaque
 * requête.
 *
 * @param contexteAdmin voir `inviterClientAuPortail` — même garde (D230).
 * @param utilisateurClientId la ligne `UtilisateurClient` visée, jamais
 *   l'identifiant du client ni celui du compte : une même personne peut être
 *   rattachée à plusieurs clients, chacun révocable indépendamment.
 */
export async function revoquerAccesPortailClient(
  contexteAdmin: ContexteSession,
  utilisateurClientId: string,
  client: PrismaClient = prisma,
): Promise<ResultatRevocationAccesPortail> {
  exigerCapaciteInvitationClient(contexteAdmin);
  const societeId = exigerSocieteActive(contexteAdmin);

  const ligne = await avecContexteApplicatif(
    contexteAdmin,
    async (tx) => {
      const touchees = await tx.utilisateurClient.updateMany({
        where: { id: utilisateurClientId },
        data: { actif: false },
      });
      if (touchees.count === 0) {
        return null;
      }
      return tx.utilisateurClient.findUnique({
        where: { id: utilisateurClientId },
        select: { utilisateur_id: true },
      });
    },
    client,
  );
  if (ligne === null) {
    return { accepte: false, motif: "introuvable" };
  }
  const utilisateurId = ligne.utilisateur_id;

  const [resteUnRattachementClient, resteUnRoleInterne] = await Promise.all([
    avecSociete(client, societeId, (tx) =>
      tx.utilisateurClient.findFirst({
        where: { utilisateur_id: utilisateurId, actif: true },
        select: { id: true },
      }),
    ),
    avecSociete(client, societeId, (tx) =>
      tx.utilisateurSociete.findFirst({
        where: { utilisateur_id: utilisateurId },
        select: { utilisateur_id: true },
      }),
    ),
  ]);
  if (resteUnRattachementClient === null && resteUnRoleInterne === null) {
    // `avecDesignationAuth` ne reconnaît QUE le jeton pour `session` (la
    // table n'accepte, en désignation, que « token » — voir
    // `CLES_DESIGNATION`) : la politique `session_fermeture`, elle, admet
    // AUSSI sa propre ligne par `app.utilisateur_id` (D59/L1-02d) — la même
    // variable que `fermerLesAutresSessions` (`lib/auth/mon-compte.ts`) pose
    // à la main pour la même raison.
    await client.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        "SELECT set_config($1, $2, true)",
        VARIABLE_SESSION_UTILISATEUR,
        utilisateurId,
      );
      await tx.session.deleteMany({ where: { utilisateur_id: utilisateurId } });
    });
  }

  return { accepte: true };
}

/** Un compte du portail, tel que la fiche client le montre. */
export type CompteDuPortailClient = {
  readonly id: string;
  /** L'IDENTITÉ — distincte de `id` (D10) : `id` désigne le RATTACHEMENT. */
  readonly utilisateurId: string;
  readonly email: string;
  readonly actif: boolean;
};

/**
 * Les comptes portail rattachés à CE client, dans la société active —
 * lecture pour la fiche client back-office. `utilisateur_client` et
 * `utilisateur` sont tous deux lisibles sous ce contexte par leur branche
 * « rattachement » respective (migrations L1-02c et L1-02b) : aucune
 * désignation n'est nécessaire ici, à la différence de l'ouverture d'identité
 * ci-dessus.
 */
export async function comptesDuPortailDuClient(
  contexteAdmin: ContexteSession,
  clientId: string,
  client: PrismaClient = prisma,
): Promise<readonly CompteDuPortailClient[]> {
  const societeId = exigerSocieteActive(contexteAdmin);
  const lignes = await avecSociete(client, societeId, (tx) =>
    tx.utilisateurClient.findMany({
      where: { client_id: clientId },
      select: {
        id: true,
        actif: true,
        utilisateur_id: true,
        utilisateur: { select: { email: true } },
      },
      orderBy: { id: "asc" },
    }),
  );
  return lignes.map((ligne) => ({
    id: ligne.id,
    utilisateurId: ligne.utilisateur_id,
    email: ligne.utilisateur.email,
    actif: ligne.actif,
  }));
}
