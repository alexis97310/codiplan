import { Prisma, type PrismaClient } from "@prisma/client";

import { type ContexteSession } from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";
import { LIMITE_RECHERCHE_PAR_DEFAUT } from "@/lib/demandes/saisie";

/**
 * LA LECTURE PORTAIL DES DEMANDES (9K15-PORTAIL-MATRICE-LECTURE-ECRITURE,
 * étude du 08/11 §3.2 M1).
 *
 * Deux fonctions dédiées, chacune avec SON PROPRE `select` fermé — même
 * discipline que `lib/portail/historique-etats.ts` (9J08B) et
 * `lib/portail/interventions.ts` (9J05) : ni l'une ni l'autre ne réutilise
 * `CHAMPS_DEMANDE` (`lib/demandes/depot.ts`, qui sert aussi la file ADV,
 * R2-21), pour qu'un futur champ ajouté LÀ-BAS pour le bureau n'atteigne
 * jamais le portail par réutilisation.
 *
 * Les deux filtres de statut (`nouvelle`/`qualifiee` et
 * `transformee`/`close_sans_suite`) sont RECOPIÉS depuis `lib/demandes/
 * depot.ts` plutôt qu'importés : ce ne sont pas des colonnes exposées, mais
 * des valeurs d'une énumération stable (`StatutDemande`), et la recopie ne
 * porte aucun des deux risques que ce fichier referme (une colonne
 * nouvelle, un `select` qui diverge).
 *
 * Aucune politique RLS neuve : `demande` porte déjà la forme « parc » (D102)
 * — société, `app.client_id`, périmètre de sites — et ce module lit SOUS le
 * contexte, sans aucune comparaison réécrite ici (§9, 01/09).
 */

/**
 * LA LISTE CLOSE des colonnes que ce module s'autorise à sélectionner sur
 * `demande` — `tests/unit/portail/demande-colonnes-fermees.test.ts` lit ces
 * clés RÉELLES, jamais une copie tenue à la main.
 */
export const SELECTION_DEMANDE_PORTAIL = {
  id: true,
  numero: true,
  annee: true,
  statut: true,
  source: true,
  urgence: true,
  machine_arretee: true,
  description: true,
  date_souhaitee: true,
  client_id: true,
  site_id: true,
  machine_id: true,
  agence_id: true,
  contact_id: true,
  depose_le: true,
  compteur_accuse_le: true,
  accuse_le: true,
  motif_cloture: true,
  close_le: true,
} as const;

export type LigneDemandePortail = Prisma.DemandeGetPayload<{
  select: typeof SELECTION_DEMANDE_PORTAIL;
}>;

/** La file des demandes ouvertes, vue par le portail (statuts actifs). */
export async function demandesOuvertesDuPortail(
  contexte: ContexteSession,
  client?: PrismaClient,
): Promise<readonly LigneDemandePortail[]> {
  return avecContexteApplicatif(
    contexte,
    async (tx) =>
      tx.demande.findMany({
        where: { statut: { in: ["nouvelle", "qualifiee"] } },
        orderBy: [{ urgence: "asc" }, { depose_le: "asc" }],
        select: SELECTION_DEMANDE_PORTAIL,
      }),
    client,
  );
}

/** La file des demandes traitées, paginée, vue par le portail. */
export async function demandesTraiteesDuPortail(
  contexte: ContexteSession,
  criteres: { readonly page: number },
  client?: PrismaClient,
): Promise<readonly LigneDemandePortail[]> {
  return avecContexteApplicatif(
    contexte,
    async (tx) =>
      tx.demande.findMany({
        where: { statut: { in: ["transformee", "close_sans_suite"] } },
        orderBy: { depose_le: "desc" },
        select: SELECTION_DEMANDE_PORTAIL,
        skip: (criteres.page - 1) * LIMITE_RECHERCHE_PAR_DEFAUT,
        take: LIMITE_RECHERCHE_PAR_DEFAUT,
      }),
    client,
  );
}
