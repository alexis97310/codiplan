import type { Prisma } from "@prisma/client";

import type { ContexteActif } from "@/lib/auth/contexte";
import { peutPleinement } from "@/lib/auth/habilitations";
import { avecContexteApplicatif } from "@/lib/db/client";

/**
 * L'IDENTITÉ DE LA SOCIÉTÉ ACTIVE, EN LECTURE POUR SIX DE SES SEPT COLONNES
 * (QT-22, D167, 05/10/2026, TP-NAV1).
 *
 * Six colonnes, et pas une de plus : celles que la carte « Identité » du hub
 * de paramétrage affiche. La charte (couleurs) et le reste de la société ont
 * leur propre chemin d'écriture, hors de ce module, et cette liste de LECTURE
 * ne s'agrandit pas au passage. Seules les mentions légales, depuis
 * 9I7A-MENTIONS-LEGALES-MODIFIABLES, ont aussi leur écriture ici —
 * `enregistrerMentionsLegales`, même doctrine que `enregistrerLogo`
 * (`lib/societes/logo.ts`).
 *
 * **La devise porte son libellé et ses décimales** (9EWD-PARAMETRES-HUB-
 * MAQUETTE) — la carte affiche « Franc pacifique (XPF), sans décimale »,
 * jamais le seul code : le libellé et le compte de décimales viennent du
 * référentiel `Devise` (I3), jamais approchés ni recopiés.
 *
 * **Cloisonnement.** Même discipline que `lireThemeCloisonne`
 * (`lib/theme/session.ts`) : le filtre applicatif (`where: { id: societeId }`)
 * puis la politique RLS de `societe` (`id = app.societe_id`, D42) — une
 * session active sur A ne peut pas lire l'identité de B, pas même en le
 * demandant explicitement.
 */
export const CHAMPS_IDENTITE = {
  raison_sociale: true,
  territoire: true,
  fuseau_horaire: true,
  devise: { select: { code: true, libelle: true, decimales: true } },
  libelle_code_externe: true,
  mentions_legales: true,
} as const;

export type IdentiteSociete = Prisma.SocieteGetPayload<{
  select: typeof CHAMPS_IDENTITE;
}>;

/**
 * Lit l'identité de `societeId` sous le contexte cloisonné DÉJÀ POSÉ sur `tx`.
 *
 * Extraite pour que le scénario d'isolation éprouve exactement la requête que
 * sert l'application — sous le rôle applicatif restreint, politiques
 * comprises — et non une variante écrite pour le test.
 */
export async function lireIdentiteCloisonnee(
  tx: Prisma.TransactionClient,
  societeId: string,
): Promise<IdentiteSociete | null> {
  return tx.societe.findFirst({
    where: { id: societeId },
    select: CHAMPS_IDENTITE,
  });
}

/**
 * LE SIGLE DE LA PASTILLE (9EWD-PARAMETRES-HUB-MAQUETTE, M:4358) — dérivé des
 * initiales de la raison sociale, jamais saisi : deux mots donnent leurs
 * initiales, un seul donne ses deux premiers caractères.
 */
export function sigleDeLaRaisonSociale(raisonSociale: string): string {
  const mots = raisonSociale
    .trim()
    .split(/\s+/)
    .filter((mot) => mot.length > 0);
  if (mots.length >= 2) {
    return (mots[0]!.charAt(0) + mots[1]!.charAt(0)).toLocaleUpperCase("fr");
  }
  return (mots[0] ?? "").slice(0, 2).toLocaleUpperCase("fr");
}

/** La borne de longueur des mentions légales (9I7A-MENTIONS-LEGALES-MODIFIABLES). */
export const MENTIONS_LEGALES_MAX = 1000;

export type RefusMentionsLegales =
  "mentions_legales.refus.droit" | "mentions_legales.refus.taille";

export type ResultatMentionsLegales =
  | { readonly ok: true }
  | { readonly ok: false; readonly motif: RefusMentionsLegales };

/** Espaces de bord retirés, vide → `null`. Les retours à la ligne internes restent. */
function mentionsLegalesNettoyees(texte: string): string | null {
  const nettoye = texte.trim();
  return nettoye === "" ? null : nettoye;
}

/**
 * Enregistre les mentions légales — le texte du pied des documents
 * (`lib/interventions/bon.ts`) — de la société active de `contexte`.
 *
 * Même doctrine que `enregistrerLogo` (`lib/societes/logo.ts`) : la capacité
 * se vérifie ICI, pas seulement à la porte de la route — ce module reste
 * appelable depuis un scénario d'isolation qui n'emprunte pas la route —, et
 * le refus est un motif NOMMÉ, jamais une exception.
 */
export async function enregistrerMentionsLegales(
  contexte: ContexteActif,
  texte: string,
): Promise<ResultatMentionsLegales> {
  if (!peutPleinement(contexte.role, "parametrer_societe")) {
    return { ok: false, motif: "mentions_legales.refus.droit" };
  }
  const nettoye = mentionsLegalesNettoyees(texte);
  if (nettoye !== null && nettoye.length > MENTIONS_LEGALES_MAX) {
    return { ok: false, motif: "mentions_legales.refus.taille" };
  }
  await avecContexteApplicatif(contexte, (tx) =>
    tx.societe.update({
      where: { id: contexte.societeId },
      data: { mentions_legales: nettoye },
    }),
  );
  return { ok: true };
}
