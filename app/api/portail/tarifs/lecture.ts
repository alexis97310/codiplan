import {
  instantDuJour,
  jourDe,
  lireFuseau,
  maintenant,
} from "@/lib/calendar/fuseau";
import { prisma } from "@/lib/db/client";
import { avecSociete } from "@/lib/db/rls";
import { lireDevise, montant, type Devise, type Montant } from "@/lib/money";
import type { RegleArrondi } from "@/lib/tarification/valorisation";
import { tauxEnVigueur } from "@/lib/tarification/taux-horaire";

/**
 * LA LECTURE DU BARÈME PORTAIL (9J20-PORTAIL-GRILLE-TARIFAIRE, CLI-7).
 *
 * **LA ROUTE ISOLÉE, décision du pilote du 29/10/2026.** `avecSociete` pose
 * UNIQUEMENT `app.societe_id` — jamais `app.client_id`, jamais
 * `app.perimetre_sites` (les deux que `avecContexteApplicatif` poserait
 * depuis la session). Le barème est un prix de vente propre à la SOCIÉTÉ,
 * pas au client ni à son périmètre de sites ; il n'y a donc ni raison ni
 * besoin de résoudre un rattachement portail pour le lire, et cette
 * transaction ne touche AUCUNE table de forme « parc », « habilitation » ou
 * « rattachement » — `tests/isolation/9j20-portail-tarifs.test.ts` le garde.
 *
 * **UN SEUL APPEL SERVEUR** : les trois lectures — société (majoration,
 * règle de comptage du temps, fuseau), taux en vigueur, catalogue de
 * forfaits actifs — composent EN UNE FOIS sous la même transaction. La
 * société est lue d'abord — son fuseau décide ce qu'« aujourd'hui » veut
 * dire (L0-08) —, puis le taux et le catalogue en parallèle : jamais quatre
 * allers-retours distincts depuis l'écran. Le catalogue est UNE jointure
 * Prisma (`findMany`), jamais une boucle de résolution par forfait (INTERDIT
 * du ticket).
 */

export type ForfaitDuBareme = {
  readonly id: string;
  readonly code: string;
  readonly libelle: string;
  readonly type: string;
  readonly montant: Montant;
  readonly zoneGeo: readonly string[];
  readonly familleId: string | null;
  readonly typeIntervention: readonly string[];
};

export type BaremePortail = {
  readonly devise: Devise;
  /** `null` quand aucun taux n'a de date d'effet connue (RG-TAR-04). */
  readonly tauxHoraire: Montant | null;
  /**
   * La valeur BRUTE du `Decimal(5,2)` de la société, en texte — jamais un
   * `number` reformaté par `toFixed` (I3, gardien
   * `tests/unit/money/sans-decimales-en-dur.test.ts`, qui ne distingue pas un
   * pourcentage d'un montant). `Decimal.toString()` rend déjà la précision
   * exacte, sans zéro de queue superflu (mesuré : `"50.00"` → `"50"`).
   */
  readonly majorationHorsOuverturePct: string;
  readonly regleArrondi: RegleArrondi;
  readonly forfaits: readonly ForfaitDuBareme[];
};

export async function lireBaremePortail(
  societeId: string,
): Promise<BaremePortail> {
  return avecSociete(prisma, societeId, async (tx) => {
    const societe = await tx.societe.findFirstOrThrow({
      where: { id: societeId },
      select: {
        majoration_hors_ouverture_pct: true,
        facturation_plancher_min: true,
        facturation_palier_min: true,
        facturation_seuil_palier_min: true,
        fuseau_horaire: true,
        devise: { select: { code: true, decimales: true, symbole: true } },
      },
    });

    // « Aujourd'hui » se lit dans le fuseau de la SOCIÉTÉ (L0-08), jamais
    // celui du serveur — même lecture que `app/(back-office)/parametres/
    // tarifs/page.tsx`.
    const aujourdhui = instantDuJour(
      jourDe(maintenant(lireFuseau(societe.fuseau_horaire)).local),
    );

    const [taux, forfaits] = await Promise.all([
      tauxEnVigueur(tx, aujourdhui),
      tx.forfait.findMany({
        where: { societe_id: societeId, actif: true },
        orderBy: [{ type: "asc" }, { rang: "asc" }],
        select: {
          id: true,
          code: true,
          libelle: true,
          type: true,
          montant_mineur: true,
          devise_code: true,
          zone_geo: true,
          famille_id: true,
          type_intervention: true,
        },
      }),
    ]);

    return {
      devise: lireDevise(societe.devise),
      tauxHoraire: taux?.taux ?? null,
      majorationHorsOuverturePct:
        societe.majoration_hors_ouverture_pct.toString(),
      regleArrondi: {
        plancherMinutes: societe.facturation_plancher_min,
        palierMinutes: societe.facturation_palier_min,
        seuilPalierMinutes: societe.facturation_seuil_palier_min,
      },
      forfaits: forfaits.map((f) => ({
        id: f.id,
        code: f.code,
        libelle: f.libelle,
        type: f.type,
        montant: montant(f.montant_mineur, f.devise_code),
        zoneGeo: f.zone_geo,
        familleId: f.famille_id,
        typeIntervention: f.type_intervention,
      })),
    };
  });
}
