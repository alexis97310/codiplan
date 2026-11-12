import type { PrismaClient } from "@prisma/client";

import { maintenant } from "@/lib/calendar/fuseau";
import type { Envoi } from "@/lib/courriel/message";
import { prisma } from "@/lib/db/client";
import { avecSociete } from "@/lib/db/rls";

import {
  estCibleProtegeeCopieNouveauLien,
  parTranchesDeCinq,
} from "./acces-bureau";
import { DUREE_LIEN_PREMIER_ACCES_SECONDES } from "./config";
import { type ContexteSession, exigerSocieteActive } from "./contexte";
import {
  copierLienDAccesPartage,
  detailEstCopie,
  envoyerLienDAccesPartage,
  identiteExclusiveALaSociete,
  RefusEnvoiAcces,
  roleDansLaSocieteActive,
  viseCetteCible,
} from "./lien-d-acces";
import { peutPleinement } from "./habilitations";
import { avecDesignationAuth } from "./lecture-identite";
import { ROLES } from "./roles";

export { RefusEnvoiAcces, viseCetteCible };

/**
 * DONNER L'ACCÈS À UN TECHNICIEN DEPUIS ÉQUIPE (D162, ticket 9DJ-TP-ACC1).
 *
 * ## Ce que ce module répare
 *
 * Créer un technicien dans Équipe (`lib/techniciens/depot.ts`) écrit son
 * IDENTITÉ — `utilisateur`, `utilisateur_societe`, `technicien` — mais
 * n'ouvre aucun moyen de connexion : aucune ligne `compte`, aucun jeton.
 * Le seul chemin qui en émettait un était le geste d'AMORÇAGE
 * (`lib/auth/amorcage.ts`), réservé à la toute première identité d'une
 * société. Un technicien créé ensuite restait donc sans accès, pour
 * toujours — QT-1 (28/09/2026) ferme ce trou : l'administrateur de la
 * société ENVOIE un lien d'accès, depuis Équipe.
 *
 * ## Pourquoi ce module ne réutilise pas `ouvrirPremierCompte` /
 * `reemettreJetonPremierAcces` tels quels
 *
 * Les deux gestes de `lib/auth/amorcage.ts` existent déjà et émettent un
 * jeton par le même mécanisme (`creerAuth` muni d'un canal). Mais leur trace
 * dans `journal_acces` nomme l'IDENTITÉ elle-même comme auteur — « c'est la
 * seule vérité du geste d'amorçage », qui n'a personne d'autre à nommer.
 * Ici, il y a quelqu'un d'autre : **l'administrateur agit sur le compte d'un
 * tiers**, exactement la situation de `lib/auth/deverrouillage.ts` (L7-04),
 * dont ce module reprend la forme de trace — l'auteur est l'administrateur,
 * la cible est nommée dans `detail`. Rejouer les deux gestes existants aurait
 * donc écrit une trace fausse ; ce module compose directement les mêmes
 * briques qu'eux (`creerAuth`, `avecDesignationAuth`), sans les copier.
 *
 * ## Le compte au repos, modelé sur `prisma/seed.ts`
 *
 * `poserLeMoyenDeConnexionAuRepos` y mesure les trois valeurs d'un compte
 * réellement ouvert par `signUpEmail` — `emetteur = "local:credential"`,
 * `fournisseur_id = "credential"`, `compte_externe_id` = l'identifiant de
 * l'identité — et pose `mot_de_passe: null`. Ce module pose la même ligne,
 * pour la même raison : aucun mot de passe n'existe tant que la personne n'en
 * a pas choisi un (D65), et `requestPasswordReset` exige qu'une ligne de
 * `compte` existe déjà pour émettre un jeton.
 *
 * ## CE QUI N'EST PAS VÉRIFIÉ, ET POURQUOI — DÉSORMAIS BORNÉ À L'ENVOI
 *
 * Le ticket 9DJ-TP-ACC1-DONNER-ACCES nommait un quatrième refus : « cette
 * personne a un accès dans une autre société ». Il reste NON implémenté pour
 * `envoyerLienDAcces`/`envoyerNouveauLienDAcces` : `utilisateur_societe`
 * porte la forme « société » (I1) — une politique RLS ordinaire, filtrée par
 * `app.societe_id` — et aucune lecture de ce module ne peut, sous le contexte
 * de l'administrateur, voir une ligne d'une AUTRE société : la base rend zéro
 * ligne, à l'aveugle comme en nommant. `journal_acces` porte bien
 * `societe_id_cible`, mais ces deux colonnes sont INFORMATIVES PAR
 * ARBITRAGE (D34) et ne doivent JAMAIS filtrer une décision —
 * `tests/unit/auth/journal-acces-informatif.test.ts` le garde. Détecter ce
 * cas pour un COURRIEL ENVOYÉ exigerait donc soit une nouvelle politique RLS
 * (une migration), soit une lecture sous un rôle qui voit toutes les sociétés
 * (hors de propos pour un geste d'`admin_societe`) : les deux restent hors du
 * territoire de ce module. Voir la passation de 9DJ-TP-ACC1-DONNER-ACCES.
 *
 * **`copierLienDAcces` ferme ce même trou pour la COPIE** (décision d'Alexis
 * du 10/11/2026, 9L01-COPIE-LIEN-EXCLUSIVITE) — la différence tient au geste,
 * pas à une politique RLS nouvelle : copier rend l'URL, un secret au porteur,
 * À L'ADMINISTRATEUR lui-même, qui pourrait l'ouvrir et poser le mot de passe
 * d'une identité qu'il ne contrôle pas entièrement ; envoyer la pose dans un
 * courriel adressé à la personne, jamais à l'administrateur. `copierLienDAcces`
 * appelle donc `identiteExclusiveALaSociete` (D226, `lib/auth/lien-d-acces.ts`)
 * — la même fonction `SECURITY DEFINER` déjà posée sur `copierNouveauLienDAcces`
 * — APRÈS l'appartenance, AVANT tout jeton.
 *
 * ## DEPUIS 9ET-COMPTES-BUREAU-1 : LES ÉTAPES 2 À 6 SONT PARTAGÉES
 *
 * `lib/auth/lien-d-acces.ts` porte désormais l'identité, le cliquet de D65,
 * le jeton, le courriel et la trace — identiques pour un technicien et pour
 * un compte de bureau (`lib/auth/acces-bureau.ts`). Ce module ne garde que
 * l'ÉTAPE 1, propre au technicien : est-il membre de la société active, et
 * actif ?
 */

/** Ce qu'un refus NOMMÉ dit, et il n'en dit jamais plus (D50). */
export type MotifRefusAcces =
  /** Hors périmètre, ou pas un technicien de la société active (D50). */
  | "introuvable"
  /** `Technicien.actif` est faux : on ne donne pas accès à qui est parti. */
  | "membre_inactif"
  /** Le cliquet de D65 : une identité qui a déjà choisi son mot de passe. */
  | "deja_un_mot_de_passe";

export type ResultatEnvoiAcces =
  | {
      readonly accepte: true;
      readonly destinataire: string;
      readonly envoi: Envoi;
    }
  | { readonly accepte: false; readonly motif: MotifRefusAcces };

/**
 * Ce qu'un refus NOMMÉ dit pour LA SEULE copie d'un PREMIER lien de
 * technicien — les motifs partagés (`MotifRefusAcces`) plus `autre_societe`
 * (D226, 9L01-COPIE-LIEN-EXCLUSIVITE), jamais rendu par l'envoi par courriel
 * (voir l'en-tête du module).
 */
export type MotifRefusCopieLienAcces = MotifRefusAcces | "autre_societe";

/** Même forme que `ResultatEnvoiAcces`, pour le geste « copier » (9I6B). */
export type ResultatCopieAcces =
  | { readonly accepte: true; readonly url: string }
  | { readonly accepte: false; readonly motif: MotifRefusCopieLienAcces };

/**
 * Ce qu'un refus NOMMÉ dit pour LA SEULE copie d'un NOUVEAU lien de
 * technicien — les motifs partagés (`MotifRefusAcces`) plus `cible_protegee`
 * (D223) et `autre_societe` (D226, 9I8D1), jamais rendus par le premier lien
 * ni par l'envoi par courriel.
 */
export type MotifRefusCopieNouveauLienAcces =
  MotifRefusAcces | "cible_protegee" | "autre_societe";

export type ResultatCopieNouveauLienAcces =
  | { readonly accepte: true; readonly url: string }
  | {
      readonly accepte: false;
      readonly motif: MotifRefusCopieNouveauLienAcces;
    };

/** Ce que la trace nomme avant la virgule — voir `lib/auth/lien-d-acces.ts`. */
const LIBELLE_CHEMIN =
  "lien d'accès envoyé par l'administrateur de la société ou la direction — " +
  "chemin administratif (D162)";

/**
 * « NOUVEAU LIEN » (mot de passe oublié, D86, décision n° 86 d'Alexis du
 * 13/10/2026) — nommé distinctement du premier envoi dans la trace, jamais
 * confondu avec lui.
 */
const LIBELLE_CHEMIN_NOUVEAU_LIEN =
  "nouveau lien (mot de passe oublié) envoyé par l'administrateur de la " +
  "société ou la direction — chemin administratif (D86)";

/**
 * LE TECHNICIEN EST-IL MEMBRE DE LA SOCIÉTÉ ACTIVE, ET ACTIF ? — partagé par
 * `envoyerLienDAcces` et `envoyerNouveauLienDAcces` (D86) : les deux gestes
 * posent la même question avant d'appeler `envoyerLienDAccesPartage`.
 *
 * `technicien` est de forme « société » (I1) : un identifiant d'une autre
 * société rend `null`, exactement comme un identifiant inconnu — même
 * refus, par construction, jamais par un `if` qui les distinguerait (D50).
 */
async function technicienMembreEtActif(
  contexteAdmin: ContexteSession,
  utilisateurId: string,
  client: PrismaClient,
): Promise<MotifRefusAcces | null> {
  const societeId = exigerSocieteActive(contexteAdmin);
  const technicien = await avecSociete(client, societeId, (tx) =>
    tx.technicien.findFirst({
      where: { utilisateur_id: utilisateurId },
      select: { actif: true },
    }),
  );
  if (technicien === null) {
    return "introuvable";
  }
  if (!technicien.actif) {
    return "membre_inactif";
  }
  return null;
}

/**
 * Envoie (ou réémet) le lien de premier accès d'un technicien de la société
 * active.
 *
 * @param contexteAdmin la session de l'administrateur — `role` doit détenir
 *   `administrer_utilisateurs` (`admin_societe` ET, depuis D199, 13/10/2026,
 *   décision n° 85, `direction`). Vérifié dans `envoyerLienDAccesPartage`,
 *   pas seulement à la porte de la route.
 * @param utilisateurId le technicien visé.
 */
export async function envoyerLienDAcces(
  contexteAdmin: ContexteSession,
  utilisateurId: string,
  client: PrismaClient = prisma,
  environnement: Record<string, string | undefined> = process.env,
): Promise<ResultatEnvoiAcces> {
  const refus = await technicienMembreEtActif(
    contexteAdmin,
    utilisateurId,
    client,
  );
  if (refus !== null) {
    return { accepte: false, motif: refus };
  }

  return envoyerLienDAccesPartage(
    contexteAdmin,
    utilisateurId,
    LIBELLE_CHEMIN,
    client,
    environnement,
  );
}

/**
 * ENVOIE UN NOUVEAU LIEN D'ACCÈS À UN TECHNICIEN DONT L'ACCÈS EST DÉJÀ ACTIF
 * (D86) — le cliquet de D65 est sauté pour CE geste seul
 * (`OptionsEnvoiLien.nouveauLien`, `lib/auth/lien-d-acces.ts`). Le premier
 * envoi (`envoyerLienDAcces`) garde son refus intact.
 *
 * @param contexteAdmin voir `envoyerLienDAcces`.
 * @param utilisateurId le technicien visé.
 */
export async function envoyerNouveauLienDAcces(
  contexteAdmin: ContexteSession,
  utilisateurId: string,
  client: PrismaClient = prisma,
  environnement: Record<string, string | undefined> = process.env,
): Promise<ResultatEnvoiAcces> {
  const refus = await technicienMembreEtActif(
    contexteAdmin,
    utilisateurId,
    client,
  );
  if (refus !== null) {
    return { accepte: false, motif: refus };
  }

  return envoyerLienDAccesPartage(
    contexteAdmin,
    utilisateurId,
    LIBELLE_CHEMIN_NOUVEAU_LIEN,
    client,
    environnement,
    { nouveauLien: true },
  );
}

/**
 * COPIE (SANS L'ENVOYER) le lien de premier accès d'un technicien de la
 * société active — voir `copierLienDAccesPartage`
 * (`lib/auth/lien-d-acces.ts`) pour le pourquoi (9I6B-LIEN-ACCES-A-COPIER,
 * D170). Même garde d'appartenance que `envoyerLienDAcces`.
 *
 * **D226, ajoutée par 9L01-COPIE-LIEN-EXCLUSIVITE** — voir l'en-tête du
 * module : une identité aussi rattachée à une AUTRE société refuse ICI,
 * AVANT tout jeton émis, exactement comme `copierNouveauLienDAcces` plus bas.
 * Aucune « cible protégée » (D223) ici : ce contrôle n'existe que pour la
 * copie d'un NOUVEAU lien (mot de passe oublié) — le PREMIER lien d'une
 * cible `direction` ou `admin_societe` reste permis, rôle que ne porte
 * jamais un technicien de toute façon.
 *
 * @param contexteAdmin voir `envoyerLienDAcces`.
 * @param utilisateurId le technicien visé.
 */
export async function copierLienDAcces(
  contexteAdmin: ContexteSession,
  utilisateurId: string,
  client: PrismaClient = prisma,
): Promise<ResultatCopieAcces> {
  const refus = await technicienMembreEtActif(
    contexteAdmin,
    utilisateurId,
    client,
  );
  if (refus !== null) {
    return { accepte: false, motif: refus };
  }
  if (
    !(await identiteExclusiveALaSociete(contexteAdmin, utilisateurId, client))
  ) {
    return { accepte: false, motif: "autre_societe" };
  }

  return copierLienDAccesPartage(
    contexteAdmin,
    utilisateurId,
    LIBELLE_CHEMIN,
    client,
  );
}

/**
 * COPIE UN NOUVEAU LIEN D'ACCÈS (mot de passe oublié, D86) D'UN TECHNICIEN
 * DONT L'ACCÈS EST DÉJÀ ACTIF — le cliquet de D65 est sauté pour CE geste
 * seul, exactement comme `envoyerNouveauLienDAcces` (9I6B).
 *
 * **D223 et D226, ajoutés par 9I8D1** — ce chemin n'avait AUCUN contrôle de
 * rôle protégé (D223 ne couvrait que le bureau, passation de 9I8D) : un
 * technicien porte toujours le rôle `technicien` dans `utilisateur_societe`
 * (jamais `direction` ni `admin_societe`), donc `cible_protegee` ne peut pas
 * se déclencher aujourd'hui par construction — le contrôle est posé en
 * DÉFENSE, pour ne jamais dépendre de cet invariant restant vrai sans
 * surveillance. L'exclusivité (D226), elle, s'applique pleinement : un
 * technicien peut être membre de PLUSIEURS sociétés. Ordre des contrôles :
 * capacité (porte de la route) → rôle protégé (D223) → exclusivité (D226).
 *
 * @param contexteAdmin voir `envoyerLienDAcces`.
 * @param utilisateurId le technicien visé.
 */
export async function copierNouveauLienDAcces(
  contexteAdmin: ContexteSession,
  utilisateurId: string,
  client: PrismaClient = prisma,
): Promise<ResultatCopieNouveauLienAcces> {
  const refus = await technicienMembreEtActif(
    contexteAdmin,
    utilisateurId,
    client,
  );
  if (refus !== null) {
    return { accepte: false, motif: refus };
  }
  const role = await roleDansLaSocieteActive(
    contexteAdmin,
    utilisateurId,
    client,
  );
  if (role !== null && estCibleProtegeeCopieNouveauLien(role)) {
    return { accepte: false, motif: "cible_protegee" };
  }
  if (
    !(await identiteExclusiveALaSociete(contexteAdmin, utilisateurId, client))
  ) {
    return { accepte: false, motif: "autre_societe" };
  }

  return copierLienDAccesPartage(
    contexteAdmin,
    utilisateurId,
    LIBELLE_CHEMIN_NOUVEAU_LIEN,
    client,
    { nouveauLien: true },
  );
}

/**
 * L'état d'accès d'un technicien, tel que l'écran Équipe le montre.
 *
 * « lien_expire » (point 1, 9EXA-EQUIPE-TECHNICIENS-MAQUETTE, D204) — même
 * forme et même seuil que `EtatAccesBureau` (`lib/auth/acces-bureau.ts`) :
 * un lien envoyé il y a plus de `DUREE_LIEN_PREMIER_ACCES_SECONDES` et
 * jamais suivi d'un mot de passe. Un second envoi reste toujours possible
 * depuis cet état — ce n'est pas un refus, c'est une information d'affichage.
 */
export type EtatAcces =
  | { readonly etat: "aucun" }
  | {
      readonly etat: "lien_envoye";
      readonly horodatage: Date;
      /** Vrai si ce dernier lien a été COPIÉ, jamais envoyé par courriel (B6). */
      readonly copie: boolean;
    }
  | {
      readonly etat: "lien_expire";
      readonly horodatage: Date;
      readonly copie: boolean;
    }
  | { readonly etat: "actif" };

/**
 * L'état d'accès de chaque technicien demandé — pour l'affichage d'Équipe.
 *
 * **SEULS LES IDENTIFIANTS MEMBRES DE LA SOCIÉTÉ ACTIVE SONT RENDUS** (9EXB,
 * point 2 — fuite mesurée) — `compte` se lit PAR DÉSIGNATION
 * (`avecDesignationAuth`), société-agnostique par construction : sans ce
 * filtre explicite, un appelant qui transmettrait l'identifiant d'un
 * technicien d'une AUTRE société obtiendrait son état réel (mot de passe
 * posé ou non, lien en cours), alors que `listerLesTechniciens` ne l'aurait
 * jamais proposé. Même parade que `etatsAccesDesComptes`
 * (`lib/auth/acces-bureau.ts`, `idsValides`).
 *
 * **L'HISTORIQUE DE TOUS CEUX QUI ADMINISTRENT LES IDENTITÉS DE LA SOCIÉTÉ,
 * PAS SEULEMENT CELUI QUI REGARDE** (point 1, même correctif que le solde 175
 * de `etatsAccesDesComptes`, `lib/auth/acces-bureau.ts`) — `journal_acces` ne
 * se lit que PAR DÉSIGNATION, une politique RLS self-authored
 * (`journal_acces_lecture`, `utilisateur_id = app.authentification_
 * utilisateur_id`) : une seule transaction, désignée sur
 * `contexteAdmin.utilisateurId`, ne rendrait QUE ce que CETTE personne a
 * elle-même envoyé, alors qu'une autre personne habilitée de la même société
 * (un autre `admin_societe`, ou la direction depuis D199) peut avoir envoyé
 * le dernier lien. Une transaction PAR rôle au ● sur
 * `administrer_utilisateurs` (jamais une liste écrite à la main), puis le
 * plus récent événement visant chaque cible, tous confondus.
 *
 * **`designe.compte.findFirst` PORTE UN `orderBy` DE DÉFENSE, PAS DE
 * CORRECTIF (9I4-EQUIPE-N-PLUS-UN, point 2 ; `orderBy` ajouté en
 * 9IC-CORRECTIFS-COURTS)** — `Compte` n'a aucune unicité sur
 * `utilisateur_id` seul (`@@unique([emetteur, compte_externe_id])` seulement,
 * `prisma/schema.prisma`), mais **mesuré** : les TROIS chemins qui créent une
 * ligne `compte` dans ce dépôt — l'amorçage (`signUpEmail`, voir l'en-tête de
 * ce module), `lib/auth/lien-d-acces.ts` et `prisma/seed.ts` — posent tous
 * `emetteur = "local:credential"` et `compte_externe_id = utilisateur_id`.
 * L'unicité (emetteur, compte_externe_id) borne donc, EN PRATIQUE, à UNE seule
 * ligne par utilisateur. Un second émetteur (un fournisseur OAuth, par
 * exemple) n'existe dans aucun chemin de ce dépôt aujourd'hui ; en ouvrir un
 * referait cette mesure. `orderBy: [{ cree_le: "asc" }, { id: "asc" }]` ne
 * corrige donc rien d'observé — il borne le résultat si ce jour arrivait,
 * plutôt que de laisser Postgres choisir silencieusement laquelle
 * `findFirst` rend.
 */
export async function etatsAccesDesTechniciens(
  contexteAdmin: ContexteSession,
  utilisateurIds: readonly string[],
  client: PrismaClient = prisma,
): Promise<ReadonlyMap<string, EtatAcces>> {
  if (utilisateurIds.length === 0) {
    return new Map();
  }
  const societeId = exigerSocieteActive(contexteAdmin);
  const designe = avecDesignationAuth(client);

  const membres = await avecSociete(client, societeId, (tx) =>
    tx.technicien.findMany({
      where: {
        societe_id: societeId,
        utilisateur_id: { in: [...utilisateurIds] },
      },
      select: { utilisateur_id: true },
    }),
  );
  const idsValides = new Set(membres.map((m) => m.utilisateur_id));
  if (idsValides.size === 0) {
    return new Map();
  }

  const administrateurs = await avecSociete(client, societeId, (tx) =>
    tx.utilisateurSociete.findMany({
      where: {
        societe_id: societeId,
        role: {
          in: ROLES.filter((r) =>
            peutPleinement(r, "administrer_utilisateurs"),
          ),
        },
      },
      select: { utilisateur_id: true },
    }),
  );
  const evenements = (
    await Promise.all(
      administrateurs.map((administrateur) =>
        designe.journalAcces.findMany({
          where: {
            utilisateur_id: administrateur.utilisateur_id,
            evenement: {
              in: ["ouverture_identite", "reemission_premier_acces"],
            },
          },
          select: { detail: true, horodatage: true },
        }),
      ),
    )
  ).flat();

  // `maintenant` exige un fuseau (gardien L0-08, point 2) même si cette
  // comparaison est une DURÉE, pas une lecture calendaire — le fuseau choisi
  // ne change donc rien à l'instant rendu, qui seul importe ici.
  const { instant } = maintenant("UTC");
  const limiteExpiration = new Date(
    instant.getTime() - DUREE_LIEN_PREMIER_ACCES_SECONDES * 1000,
  );

  // ── LE COMPTE DE CHAQUE PERSONNE, PAR TRANCHES DE 5 (9I4 puis 9IC) ────────
  //
  // `compte` porte la politique « DÉSIGNATION » (self-authored,
  // `utilisateur_id = app.authentification_utilisateur_id`,
  // `lib/auth/lecture-identite.ts`, `CLES_DESIGNATION.compte`) : chaque
  // lecture ne peut nommer QU'UNE ligne, et une seule — `aplatirConjonction`
  // n'y lit même pas un `OR`, par construction (« une clé trouvée sous un OR
  // ne bornerait rien »). **Mesuré** (9I4-EQUIPE-N-PLUS-UN, point 3) :
  // `compte.findMany({ where: { utilisateur_id: { in: [...] } } })` sous ce
  // même client rend ZÉRO ligne — `texteDe` ne lit pas `{ in }`, la
  // désignation part vide, et `app.authentification_utilisateur_id` n'est
  // jamais posée pour cette requête. Une lecture BATCH, en UNE requête SQL,
  // qui respecterait cette politique exigerait qu'elle accepte un ENSEMBLE
  // d'identités plutôt qu'une seule — une politique RLS, hors territoire de ce
  // lot (voir `docs/propositions/9I4-EQUIPE-N-PLUS-UN/passation.md`).
  //
  // Ce qui reste, et qui ne touche ni RLS ni migration : les N lectures
  // restent nécessaires, mais PAR TRANCHES DE `TAILLE_TRANCHE_LECTURE_COMPTE`
  // plutôt que l'une après l'autre OU toutes de front sans plafond — voir
  // `parTranchesDeCinq` (`lib/auth/acces-bureau.ts`).
  const comptes = await parTranchesDeCinq(
    utilisateurIds.filter((utilisateurId) => idsValides.has(utilisateurId)),
    async (utilisateurId) => ({
      utilisateurId,
      compte: await designe.compte.findFirst({
        where: { utilisateur_id: utilisateurId },
        select: { mot_de_passe: true, cree_le: true },
        orderBy: [{ cree_le: "asc" }, { id: "asc" }],
      }),
    }),
  );

  const resultat = new Map<string, EtatAcces>();
  for (const { utilisateurId, compte } of comptes) {
    if (compte === null) {
      resultat.set(utilisateurId, { etat: "aucun" });
      continue;
    }
    if (compte.mot_de_passe !== null) {
      resultat.set(utilisateurId, { etat: "actif" });
      continue;
    }
    const correspondants = evenements.filter((evenement) =>
      viseCetteCible(evenement.detail, utilisateurId),
    );
    const dernier =
      correspondants.length === 0
        ? undefined
        : correspondants.reduce((plusRecent, evenement) =>
            evenement.horodatage > plusRecent.horodatage
              ? evenement
              : plusRecent,
          );
    const horodatage = dernier?.horodatage ?? compte.cree_le;
    resultat.set(utilisateurId, {
      etat: horodatage < limiteExpiration ? "lien_expire" : "lien_envoye",
      horodatage,
      copie: detailEstCopie(dernier?.detail ?? null),
    });
  }
  return resultat;
}
