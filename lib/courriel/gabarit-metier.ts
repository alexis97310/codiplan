import {
  BORDURE_COURRIEL,
  FOND_COURRIEL,
  SURFACE_COURRIEL,
  TEXTE_ATTENUE_COURRIEL,
  TEXTE_COURRIEL,
} from "@/lib/theme/courriel";

import type { CourrielMetier } from "./message";

/**
 * LE GABARIT HTML DES COURRIELS MÉTIER (D89, 9EZ-LOGO-SOCIETE-2).
 *
 * Fonction PURE, testable sans réseau ni base : elle reçoit ce qu'il faut
 * pour composer une page, elle rend une chaîne. Rien ici ne lit `fetch`, et ce
 * fichier ne connaît pas le point d'envoi du prestataire (le gardien de
 * `tests/unit/courriel/envoi.test.ts` exige un SEUL fichier qui le connaisse,
 * `resend.ts`).
 *
 * **Compatible messageries, pas « moderne »** : tableau simple, largeur fixe
 * 600 px, styles EN LIGNE sur chaque balise, pas de CSS externe, pas de
 * script, pas de police ni d'image distante. Beaucoup de clients de
 * messagerie ignorent `<style>` et bloquent tout ce qui vient du réseau à la
 * lecture — le logo lui-même est une pièce jointe EN LIGNE (`cid:`), jamais
 * une URL (D89 : la route `/api/societe/logo` exige une session, Gmail
 * bloque les data URI).
 *
 * **TOUTE valeur insérée est ÉCHAPPÉE.** `raisonSociale`, `titre`,
 * `paragraphes` et `pied` viennent in fine d'une saisie (nom de client, motif
 * d'annulation, adresse de site) : un nom de client porteur de `<script>` ou
 * de `"><img onerror=…>` doit se retrouver comme TEXTE dans le courriel,
 * jamais comme balise.
 */

export type DonneesGabaritMetier = {
  readonly societe: {
    readonly raisonSociale: string;
    /** Absent : la société n'a déposé aucun logo — le gabarit s'en passe. */
    readonly logo?: { readonly cid: string };
  };
  readonly titre: string;
  /** Une ligne du texte — une par `<p>`, dans l'ordre reçu. */
  readonly paragraphes: readonly string[];
  readonly pied?: string;
};

/** Les cinq caractères qu'une insertion dans du HTML doit neutraliser. */
export function echapperHtml(valeur: string): string {
  return valeur
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const POLICE = "Arial, Helvetica, sans-serif";

function blocLogoEtRaisonSociale(
  societe: DonneesGabaritMetier["societe"],
): string {
  const logo =
    societe.logo === undefined
      ? ""
      : `<img src="cid:${echapperHtml(societe.logo.cid)}" alt="${echapperHtml(
          societe.raisonSociale,
        )}" height="48" style="display:block;border:0;outline:none;margin-bottom:8px;">`;
  return [
    logo,
    `<div style="font-family:${POLICE};font-size:16px;font-weight:bold;color:${TEXTE_COURRIEL};">` +
      `${echapperHtml(societe.raisonSociale)}</div>`,
  ].join("\n");
}

function blocParagraphes(paragraphes: readonly string[]): string {
  return paragraphes
    .map(
      (paragraphe) =>
        `<p style="margin:0 0 12px;font-family:${POLICE};font-size:14px;` +
        `line-height:20px;color:${TEXTE_COURRIEL};">${echapperHtml(paragraphe)}</p>`,
    )
    .join("\n");
}

function blocPied(pied: string | undefined): string {
  if (pied === undefined) {
    return "";
  }
  return (
    `<tr><td style="padding:16px 24px;border-top:1px solid ${BORDURE_COURRIEL};` +
    `font-family:${POLICE};font-size:12px;color:${TEXTE_ATTENUE_COURRIEL};">` +
    `${echapperHtml(pied)}</td></tr>`
  );
}

/**
 * Compose la page HTML d'un courriel métier. Un seul tableau de 600 px,
 * centré ; en-tête logo + raison sociale, titre, paragraphes, pied optionnel.
 */
export function miseEnPageMetier(donnees: DonneesGabaritMetier): string {
  return [
    "<!DOCTYPE html>",
    '<html lang="fr">',
    `  <body style="margin:0;padding:0;background-color:${FOND_COURRIEL};">`,
    `    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${FOND_COURRIEL};">`,
    "      <tr>",
    '        <td align="center" style="padding:24px 12px;">',
    `          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:${SURFACE_COURRIEL};">`,
    "            <tr>",
    '              <td style="padding:24px 24px 16px;">',
    `                ${blocLogoEtRaisonSociale(donnees.societe)}`,
    "              </td>",
    "            </tr>",
    "            <tr>",
    '              <td style="padding:0 24px 24px;">',
    `                <h1 style="margin:0 0 16px;font-family:${POLICE};font-size:18px;color:${TEXTE_COURRIEL};">` +
      `${echapperHtml(donnees.titre)}</h1>`,
    `                ${blocParagraphes(donnees.paragraphes)}`,
    "              </td>",
    "            </tr>",
    `            ${blocPied(donnees.pied)}`,
    "          </table>",
    "        </td>",
    "      </tr>",
    "    </table>",
    "  </body>",
    "</html>",
  ].join("\n");
}

/** Le logo d'une société, tel que ce module en a besoin — jamais plus. */
export type LogoPourCourriel = {
  readonly type: "image/png" | "image/jpeg";
  readonly octets: Uint8Array;
};

/** Le `cid` de la pièce jointe en ligne — une seule image par courriel. */
export const CID_LOGO_SOCIETE = "logo-societe";

/**
 * CONSTRUIT UN `CourrielMetier` À PARTIR DU TEXTE EXISTANT (D89) — même
 * `destinataire`/`sujet`/`texte` qu'un courriel ordinaire, jamais réécrits ;
 * le HTML reprend les mêmes lignes, une par paragraphe.
 *
 * `societe` est `null` seulement si sa lecture a échoué (impossible en
 * pratique) : le courriel part quand même, SANS logo, avec une raison
 * sociale vide plutôt que d'échouer — un logo manquant ne doit jamais coûter
 * l'envoi (D89).
 */
export function construireCourrielMetier(
  destinataire: string,
  sujet: string,
  texte: string,
  societe: {
    readonly raisonSociale: string;
    readonly logo: LogoPourCourriel | null;
  } | null,
): CourrielMetier {
  const raisonSociale = societe?.raisonSociale ?? "";
  const logo = societe?.logo ?? null;
  const paragraphes = texte.split("\n").filter((ligne) => ligne.trim() !== "");
  const html = miseEnPageMetier({
    societe: {
      raisonSociale,
      ...(logo === null ? {} : { logo: { cid: CID_LOGO_SOCIETE } }),
    },
    titre: sujet,
    paragraphes,
  });
  return {
    destinataire,
    sujet,
    texte,
    miseEnPage: {
      html,
      imagesEnLigne:
        logo === null
          ? []
          : [{ cid: CID_LOGO_SOCIETE, type: logo.type, octets: logo.octets }],
    },
  };
}
