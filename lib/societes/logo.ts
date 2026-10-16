import { createHash } from "node:crypto";

import type { Prisma, PrismaClient } from "@prisma/client";

import type { ContexteActif, ContexteSession } from "@/lib/auth/contexte";
import { peutPleinement } from "@/lib/auth/habilitations";
import { avecContexteApplicatif } from "@/lib/db/client";
import {
  formatImageReconnu,
  type FormatImageReconnu,
} from "@/lib/documents/formats-image";
import { t } from "@/lib/i18n/fr";

/**
 * LE LOGO DE LA SOCIÉTÉ, EN BASE (décision n° 87 d'Alexis, 13/10/2026,
 * 9EZ-LOGO-SOCIETE-1).
 *
 * Même doctrine que la photo du technicien (D96, `lib/documents/depot.ts`) :
 * `lib/documents/stockage.ts` n'a aucun chemin inscriptible sur l'hébergeur,
 * et le logo entre donc EN BASE, borné à 300 Ko (`societe_logo_plafond`).
 *
 * **Le type se juge sur les octets, jamais sur `fichier.type` ni le nom** —
 * `formatImageReconnu` (`lib/documents/formats-image.ts`), déjà la doctrine
 * des photos : un SVG renommé `.png` franchirait les deux.
 *
 * **La capacité se vérifie ICI, pas seulement à la porte de la route.** La
 * route appelle déjà `exigerCapaciteComplete("parametrer_societe")`, mais ce
 * module reste appelable depuis un scénario d'isolation qui n'emprunte pas la
 * route — le refus de droit doit donc être le même des deux côtés.
 */

/** 300 Ko (décision n° 87) — la même borne que la contrainte `societe_logo_plafond`. */
export const TAILLE_MAX_LOGO_OCTETS = 300 * 1024;

export type RefusLogo =
  | "logo.refus.droit"
  | "logo.refus.vide"
  | "logo.refus.taille"
  | "logo.refus.type";

export type ResultatLogo =
  { readonly ok: true } | { readonly ok: false; readonly motif: RefusLogo };

/** Le logo d'une société, tel qu'il est gardé en base. */
export type LogoSociete = {
  readonly octets: Buffer;
  readonly type: FormatImageReconnu;
  readonly empreinte: string;
};

const CHAMPS_LOGO = {
  logo_octets: true,
  logo_type: true,
  logo_empreinte: true,
} as const;

function logoDepuisColonnes(colonnes: {
  logo_octets: Uint8Array | null;
  logo_type: string | null;
  logo_empreinte: string | null;
}): LogoSociete | null {
  if (
    colonnes.logo_octets === null ||
    colonnes.logo_type === null ||
    colonnes.logo_empreinte === null
  ) {
    return null;
  }
  // `societe_logo_type_reconnu` (migration) ferme déjà cette forme en base :
  // la garde ici ne fait que porter le même refus au niveau du type.
  if (
    colonnes.logo_type !== "image/png" &&
    colonnes.logo_type !== "image/jpeg"
  ) {
    return null;
  }
  return {
    octets: Buffer.from(colonnes.logo_octets),
    type: colonnes.logo_type,
    empreinte: colonnes.logo_empreinte,
  };
}

/**
 * Lit le logo de la société ACTIVE de `contexte`. `null` si elle n'en a
 * déposé aucun.
 *
 * **Cloisonnement** : même discipline que `lireThemeCloisonne` — filtre
 * applicatif `where: { id: societeId }`, puis la politique RLS `id =
 * app.societe_id` (D42). Une session active sur A ne peut pas lire le logo de
 * B, pas même en le demandant explicitement.
 */
export async function lireLogo(
  contexte: ContexteActif,
): Promise<LogoSociete | null> {
  return avecContexteApplicatif(contexte, async (tx) => {
    const societe = await tx.societe.findFirst({
      where: { id: contexte.societeId },
      select: CHAMPS_LOGO,
    });
    return societe === null ? null : logoDepuisColonnes(societe);
  });
}

/**
 * L'empreinte SEULE du logo de `societeId`, sous le contexte cloisonné DÉJÀ
 * POSÉ sur `tx` — pour le thème (`lib/theme/session.ts`), qui ne doit jamais
 * porter les octets.
 */
export async function empreinteDuLogo(
  tx: Prisma.TransactionClient,
  societeId: string,
): Promise<string | null> {
  const societe = await tx.societe.findFirst({
    where: { id: societeId },
    select: { logo_empreinte: true },
  });
  return societe?.logo_empreinte ?? null;
}

/** Le logo, la raison sociale ET le pied, pour un courriel métier (D207). */
export type LogoEtRaisonSociale = {
  readonly raisonSociale: string;
  readonly logo: LogoSociete | null;
  /** `societe.mentions_legales` — `null` si absentes ou vides : aucun pied. */
  readonly pied: string | null;
};

/**
 * Lit le logo, la raison sociale ET les mentions légales de `societeId`, sous
 * le contexte cloisonné DÉJÀ POSÉ sur `tx` — pour `lib/avertissements/*`
 * (D207, 9EZ-LOGO-SOCIETE-2 ; mentions légales, 9EZ-LOGO-SOCIETE-4), qui
 * composent un courriel métier à partir des TROIS dans la MÊME lecture : une
 * transmission groupée touche plusieurs interventions de la MÊME société, et
 * rien de tout cela ne doit être lu une fois par intervention.
 *
 * `null` seulement si `societeId` ne désigne aucune ligne — impossible en
 * pratique puisque l'appelant tient déjà `societeId` d'une intervention
 * cloisonnée sur la même société.
 */
export async function lireLogoEtRaisonSociale(
  tx: Prisma.TransactionClient,
  societeId: string,
): Promise<LogoEtRaisonSociale | null> {
  const societe = await tx.societe.findFirst({
    where: { id: societeId },
    select: { raison_sociale: true, mentions_legales: true, ...CHAMPS_LOGO },
  });
  if (societe === null) {
    return null;
  }
  return {
    raisonSociale: societe.raison_sociale,
    logo: logoDepuisColonnes(societe),
    pied:
      societe.mentions_legales !== null &&
      societe.mentions_legales.trim() !== ""
        ? societe.mentions_legales
        : null,
  };
}

/**
 * LECTURE SÛRE, POUR UN COURRIEL (point 1, 9EZ-LOGO-SOCIETE-4-COURRIELS-SOLDE)
 * — LE LOGO NE DOIT JAMAIS BLOQUER UN GESTE NI UN ENVOI.
 *
 * Avant ce ticket, `lireLogoEtRaisonSociale` s'appelait DANS la même
 * transaction que le reste de la composition d'un courriel
 * (`lib/avertissements/*`) : une erreur de cette lecture (panne
 * d'infrastructure, ligne corrompue) faisait échouer TOUTE la composition —
 * plus aucun courriel ne partait, pas même sans logo — alors que le geste
 * métier qu'il annonce (annulation, planification, signature terrain) avait
 * déjà été validé en base, par un AUTRE appel, plus tôt.
 *
 * Cette fonction lit donc le logo dans SA PROPRE transaction, séparée de
 * celle qui compose le reste du courriel, et absorbe toute erreur ICI :
 * tracée (sans donnée personnelle ni URL — gardien `url-hors-journal`), elle
 * rend un repli CONNU plutôt que de lever — raison sociale par défaut, aucun
 * logo, aucun pied — pour que l'appelant envoie quand même, sans image.
 */
export async function lireLogoEtRaisonSocialePourCourriel(
  contexte: ContexteSession,
  societeId: string,
  connexion?: PrismaClient,
): Promise<LogoEtRaisonSociale> {
  const repli: LogoEtRaisonSociale = {
    raisonSociale: t("app.nom"),
    logo: null,
    pied: null,
  };
  try {
    const societe = await avecContexteApplicatif(
      contexte,
      (tx) => lireLogoEtRaisonSociale(tx, societeId),
      connexion,
    );
    return societe ?? repli;
  } catch (erreur) {
    console.error("lecture du logo de société pour un courriel", erreur);
    return repli;
  }
}

/**
 * Dépose le logo de la société active de `contexte`. Refuse — par un motif
 * NOMMÉ, jamais une exception — un rôle sans la capacité, un fichier vide,
 * un fichier trop lourd, ou un format non reconnu à ses octets.
 */
export async function enregistrerLogo(
  contexte: ContexteActif,
  octets: Buffer,
): Promise<ResultatLogo> {
  if (!peutPleinement(contexte.role, "parametrer_societe")) {
    return { ok: false, motif: "logo.refus.droit" };
  }
  if (octets.length === 0) {
    return { ok: false, motif: "logo.refus.vide" };
  }
  if (octets.length > TAILLE_MAX_LOGO_OCTETS) {
    return { ok: false, motif: "logo.refus.taille" };
  }
  const format = formatImageReconnu(octets);
  if (format === null) {
    return { ok: false, motif: "logo.refus.type" };
  }

  const empreinte = createHash("sha256").update(octets).digest("hex");
  await avecContexteApplicatif(contexte, (tx) =>
    tx.societe.update({
      where: { id: contexte.societeId },
      data: {
        logo_octets: new Uint8Array(octets),
        logo_type: format,
        logo_empreinte: empreinte,
      },
    }),
  );
  return { ok: true };
}

/** Retire le logo de la société active de `contexte`. Même garde de capacité. */
export async function retirerLogo(
  contexte: ContexteActif,
): Promise<ResultatLogo> {
  if (!peutPleinement(contexte.role, "parametrer_societe")) {
    return { ok: false, motif: "logo.refus.droit" };
  }
  await avecContexteApplicatif(contexte, (tx) =>
    tx.societe.update({
      where: { id: contexte.societeId },
      data: { logo_octets: null, logo_type: null, logo_empreinte: null },
    }),
  );
  return { ok: true };
}
