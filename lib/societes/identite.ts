import type { Prisma } from "@prisma/client";

import type { ContexteActif, ContexteSession } from "@/lib/auth/contexte";
import { peutPleinement } from "@/lib/auth/habilitations";
import { avecContexteApplicatif } from "@/lib/db/client";
import {
  REGLE_PAR_DEFAUT,
  type RegleArrondi,
} from "@/lib/tarification/valorisation";

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
  | "mentions_legales.refus.droit"
  | "mentions_legales.refus.taille"
  | "mentions_legales.refus.caracteres";

export type ResultatMentionsLegales =
  | { readonly ok: true }
  | { readonly ok: false; readonly motif: RefusMentionsLegales };

/**
 * UN OCTET NUL OU UN CARACTÈRE DE CONTRÔLE (hors tabulation et retour à la
 * ligne) — réserve de la revue de 9I7A, 9I7D-RESERVES-DE-REVUE-ACCES-ET-
 * MENTIONS, point 3. PostgreSQL refuse déjà l'octet NUL dans une colonne
 * texte (erreur non maîtrisée, 500) ; les autres caractères de contrôle
 * passeraient tels quels dans un pied de document imprimé. `\t` (0x09) et
 * `\n` (0x0A, APRÈS normalisation ci-dessous) restent permis.
 */
const CARACTERE_CONTROLE_INTERDIT = /[\u0000-\u0008\u000B-\u001F\u007F]/;

/**
 * Espaces de bord retirés, `\r\n` → `\n` AVANT le décompte et le stockage
 * (point 3, 9I7D) — un texte saisi sur un clavier dont le navigateur pose
 * `\r\n` comptait deux caractères pour un seul retour à la ligne, et le
 * stockage s'écartait du texte relu (NFC implicite des navigateurs, jamais
 * mesuré ici), un aller-retour qui changeait le texte à l'insu de qui l'a
 * saisi. Les retours à la ligne internes restent, SEULE leur forme change.
 */
function mentionsLegalesNettoyees(texte: string): string | null {
  const normalise = texte.replace(/\r\n/g, "\n");
  const nettoye = normalise.trim();
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
  if (nettoye !== null && CARACTERE_CONTROLE_INTERDIT.test(nettoye)) {
    return { ok: false, motif: "mentions_legales.refus.caracteres" };
  }
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

export type RefusAfficherMontants = "afficher_montants.refus.droit";

export type ResultatAfficherMontants =
  | { readonly ok: true }
  | { readonly ok: false; readonly motif: RefusAfficherMontants };

/**
 * Lit `societe.afficher_montants` (9I8-AFFICHAGE-DES-MONTANTS, demande
 * d'Alexis du 28/10/2026, option A) — ACTIVÉ PAR DÉFAUT, `true`, si aucune
 * société active n'est posée sur la session : *un défaut qui retire sans
 * qu'on l'ait voulu est le pire des défauts*, même sens de défaillance que
 * `accesAuxMontants`.
 *
 * Prend un `ContexteSession`, pas un `ContexteActif` — les écrans qui
 * affichent un montant (la fiche, le bon) ont déjà prouvé `societeId` et
 * `role` non nuls en lisant leurs propres données sous le même contexte ;
 * exiger ici un second type plus étroit n'ajouterait qu'une conversion.
 */
export async function lireAfficherMontants(
  contexte: ContexteSession,
): Promise<boolean> {
  if (contexte.societeId === null) {
    return true;
  }
  const societeId = contexte.societeId;
  const ligne = await avecContexteApplicatif(contexte, (tx) =>
    tx.societe.findFirst({
      where: { id: societeId },
      select: { afficher_montants: true },
    }),
  );
  return ligne?.afficher_montants ?? true;
}

/**
 * Enregistre `societe.afficher_montants`. Même doctrine que
 * `enregistrerMentionsLegales` ci-dessus : `parametrer_societe` est DÉJÀ,
 * dans la matrice (`lib/auth/habilitations.ts`), exactement `admin_societe`
 * et `direction` — aucune garde supplémentaire n'est donc nécessaire pour ce
 * réglage, et aucune n'est ajoutée.
 *
 * Ne touche qu'une colonne d'AFFICHAGE : aucun montant n'est recalculé ni
 * modifié (`lib/interventions/depot.ts` reste lecture seule).
 */
export async function enregistrerAfficherMontants(
  contexte: ContexteActif,
  valeur: boolean,
): Promise<ResultatAfficherMontants> {
  if (!peutPleinement(contexte.role, "parametrer_societe")) {
    return { ok: false, motif: "afficher_montants.refus.droit" };
  }
  await avecContexteApplicatif(contexte, (tx) =>
    tx.societe.update({
      where: { id: contexte.societeId },
      data: { afficher_montants: valeur },
    }),
  );
  return { ok: true };
}

/**
 * Lit la règle d'arrondi du temps facturé de la société active
 * (9I8A1-REPRISE-9I8A, décision d'Alexis du 29/10/2026) — `REGLE_PAR_DEFAUT`
 * si aucune société active n'est posée sur la session, même sens de
 * défaillance que {@link lireAfficherMontants} : c'est le réglage par défaut
 * officiel (celui de la migration), jamais une valeur inventée ici.
 *
 * Sert les écrans qui ont besoin de la règle AVANT la clôture — le dialogue
 * « Clôturer » (`components/interventions/dialogue-cloturer.tsx`), qui
 * explique la règle qui s'appliquera, à un instant où
 * `lireFicheIntervention` ne rend encore aucune `ValorisationAffichee`
 * (`temps_valide_min` n'est écrit qu'à la clôture) — et la page de
 * paramétrage des tarifs, pour le réglage lui-même.
 */
export async function lireRegleArrondi(
  contexte: ContexteSession,
): Promise<RegleArrondi> {
  if (contexte.societeId === null) {
    return REGLE_PAR_DEFAUT;
  }
  const societeId = contexte.societeId;
  const ligne = await avecContexteApplicatif(contexte, (tx) =>
    tx.societe.findFirst({
      where: { id: societeId },
      select: {
        facturation_plancher_min: true,
        facturation_palier_min: true,
        facturation_seuil_palier_min: true,
      },
    }),
  );
  if (ligne === null) {
    return REGLE_PAR_DEFAUT;
  }
  return {
    plancherMinutes: ligne.facturation_plancher_min,
    palierMinutes: ligne.facturation_palier_min,
    seuilPalierMinutes: ligne.facturation_seuil_palier_min,
  };
}

export type RefusRegleArrondi = "regle_arrondi.refus.droit";

export type ResultatRegleArrondi =
  | { readonly ok: true }
  | { readonly ok: false; readonly motif: RefusRegleArrondi };

/**
 * Enregistre la règle d'arrondi de la société active — trois entiers, déjà
 * validés par l'appelant (`schemaRegleArrondi`,
 * `app/api/parametres/tarifs/regle-facturation/route.ts`). Même doctrine que
 * `enregistrerAfficherMontants` : la capacité se vérifie ICI, pas seulement à
 * la porte de la route.
 *
 * Ne touche à AUCUNE intervention déjà clôturée — `valorisation_figee` les
 * protège (`lib/interventions/depot.ts`) — et ne recalcule rien : seul le
 * réglage change, pour les clôtures à venir.
 */
export async function enregistrerRegleArrondi(
  contexte: ContexteActif,
  regle: RegleArrondi,
): Promise<ResultatRegleArrondi> {
  if (!peutPleinement(contexte.role, "parametrer_societe")) {
    return { ok: false, motif: "regle_arrondi.refus.droit" };
  }
  await avecContexteApplicatif(contexte, (tx) =>
    tx.societe.update({
      where: { id: contexte.societeId },
      data: {
        facturation_plancher_min: regle.plancherMinutes,
        facturation_palier_min: regle.palierMinutes,
        facturation_seuil_palier_min: regle.seuilPalierMinutes,
      },
    }),
  );
  return { ok: true };
}
