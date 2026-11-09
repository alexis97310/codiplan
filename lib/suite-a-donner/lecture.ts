import { type PrismaClient, type StatutSuiteADonner } from "@prisma/client";

import { type ContexteSession } from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";

/**
 * LA LECTURE DE L'ONGLET « SUITES À DONNER » (9J18-SUITE-A-DONNER-ECRAN,
 * FLX-10).
 *
 * **Fichier séparé de `lib/suite-a-donner/depot.ts`**, délibérément : ce
 * dernier reste figé à ses « quatre fonctions, pas plus » (9J17, D231), et
 * aucune d'elles ne lit. Deux FORMES de ligne, jamais une troisième :
 *
 *   - `a_qualifier` — une intervention CLÔTURÉE qui porte un `suite_a_donner`
 *     non vide et qu'aucune ligne `SuiteADonner` ne couvre encore. Ce n'est
 *     PAS l'état de naissance du schéma (`StatutSuiteADonner.a_qualifier`,
 *     jamais atteint en pratique — voir le docblock de `qualifierSuite`) :
 *     c'est une lecture VIRTUELLE, composée ici, qui n'existe dans aucune
 *     colonne.
 *   - `suite` — une ligne `SuiteADonner` déjà créée, à n'importe quel statut
 *     réel du schéma (y compris `cloturee` : l'onglet est un REGISTRE, pas
 *     seulement une file de travail — même principe que `/interventions`
 *     qui garde « Toutes »).
 *
 * **Le cloisonnement n'est pas écrit ici** (I1) : les deux lectures passent
 * par `avecContexteApplicatif`, et c'est la politique RLS de forme
 * « filiation » posée par 9J17 qui décide — jamais une seconde comparaison
 * de société au-dessus d'elle (§9, 01/09).
 */

/** Le nombre de lignes rendues par l'onglet — un registre de démonstration, jamais un historique sans fin. */
const LIMITE_SUITES_A_DONNER = 200;

export type InterventionAQualifier = {
  readonly id: string;
  readonly annee: number | null;
  readonly numero: number | null;
  readonly suite_a_donner: string;
  readonly cloturee_le: Date | null;
  readonly client: { readonly raison_sociale: string };
  readonly site: { readonly libelle: string };
};

export type LigneSuiteADonner = {
  readonly id: string;
  readonly statut: StatutSuiteADonner;
  readonly motif_sans_suite: string | null;
  readonly intervention_origine: {
    readonly id: string;
    readonly annee: number | null;
    readonly numero: number | null;
    readonly suite_a_donner: string | null;
    readonly client: { readonly raison_sociale: string };
    readonly site: { readonly libelle: string };
  };
  readonly intervention_reprise: {
    readonly id: string;
    readonly annee: number | null;
    readonly numero: number | null;
    readonly statut: string;
  } | null;
};

/**
 * CE QUE LA FICHE D'UNE INTERVENTION MONTRE DE SA SUITE À DONNER, DANS LES
 * DEUX SENS (9K09-FICHE-CLOTURE-SUITE-ORIGINE, I5 de l'étude du 08/11/2026) —
 * `commeOrigine` quand un dossier est né DE cette intervention,
 * `commeReprise` quand CETTE intervention est la reprise d'un dossier né
 * d'une autre. Les deux lectures sont indépendantes — une intervention peut
 * en théorie porter les deux (elle a terminé un travail avec sa propre
 * suite à donner, ET elle est elle-même née d'une suite à donner antérieure).
 *
 * `orderBy: { cree_le: "asc" }` sur `commeOrigine` : le double clic rapide
 * nommé par `suitesADonnerDuRegistre` ci-dessus peut en théorie créer deux
 * lignes pour la même intervention d'origine ; la première créée reste la
 * ligne canonique que cette fiche montre.
 */
export type SuiteADonnerOrigine = {
  readonly id: string;
  readonly statut: StatutSuiteADonner;
} | null;

export type OrigineDeLaReprise = {
  readonly id: string;
  readonly annee: number | null;
  readonly numero: number | null;
} | null;

export async function suiteADonnerPourIntervention(
  contexte: ContexteSession,
  interventionId: string,
  client?: PrismaClient,
): Promise<{
  readonly commeOrigine: SuiteADonnerOrigine;
  readonly commeReprise: OrigineDeLaReprise;
}> {
  return avecContexteApplicatif(
    contexte,
    async (tx) => {
      const [commeOrigine, suiteDeReprise] = await Promise.all([
        tx.suiteADonner.findFirst({
          where: { intervention_origine_id: interventionId },
          select: { id: true, statut: true },
          orderBy: { cree_le: "asc" },
        }),
        tx.suiteADonner.findFirst({
          where: { intervention_reprise_id: interventionId },
          select: {
            intervention_origine: {
              select: { id: true, annee: true, numero: true },
            },
          },
        }),
      ]);
      return {
        commeOrigine,
        commeReprise: suiteDeReprise?.intervention_origine ?? null,
      };
    },
    client,
  );
}

/**
 * TOUT CE QUE L'ONGLET MONTRE — les deux formes, pas encore ORDONNÉES
 * ensemble : l'appelant (la page) décide de la présentation, cette fonction
 * ne fait que lire.
 */
export async function suitesADonnerDuRegistre(
  contexte: ContexteSession,
): Promise<{
  readonly aQualifier: readonly InterventionAQualifier[];
  readonly suites: readonly LigneSuiteADonner[];
}> {
  return avecContexteApplicatif(contexte, async (tx) => {
    const [aQualifier, suites] = await Promise.all([
      tx.intervention.findMany({
        where: {
          statut: "cloturee",
          suite_a_donner: { not: null },
          suites_a_donner_origine: { none: {} },
        },
        select: {
          id: true,
          annee: true,
          numero: true,
          suite_a_donner: true,
          cloturee_le: true,
          client: { select: { raison_sociale: true } },
          site: { select: { libelle: true } },
        },
        orderBy: { cloturee_le: "desc" },
        take: LIMITE_SUITES_A_DONNER,
      }),
      tx.suiteADonner.findMany({
        select: {
          id: true,
          statut: true,
          motif_sans_suite: true,
          intervention_origine: {
            select: {
              id: true,
              annee: true,
              numero: true,
              suite_a_donner: true,
              client: { select: { raison_sociale: true } },
              site: { select: { libelle: true } },
            },
          },
          intervention_reprise: {
            select: { id: true, annee: true, numero: true, statut: true },
          },
        },
        orderBy: [{ statut: "asc" }, { cree_le: "desc" }],
        take: LIMITE_SUITES_A_DONNER,
      }),
    ]);
    return {
      aQualifier: aQualifier.map((ligne) => ({
        ...ligne,
        // `where: { suite_a_donner: { not: null } }` le garantit déjà —
        // cette assertion ne fait que le dire au typage.
        suite_a_donner: ligne.suite_a_donner as string,
      })),
      suites,
    };
  });
}
