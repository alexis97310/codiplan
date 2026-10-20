import type { TypeIntervention } from "@prisma/client";

import { premiereLignePanne } from "@/components/terrain/presentation";
import type { LignePlanning } from "@/lib/interventions/depot";
import {
  jourEtDateAbregee,
  machinesAffichees,
} from "@/lib/interventions/presentation-partagee";
import type { Priorite, StatutIntervention } from "@/lib/interventions/saisie";

/**
 * CE QUE LA CARTE DE MA JOURNÉE AFFICHE, ET RIEN DE PLUS (9F4H5B-JOURNEE-
 * SANS-MONTANT, point 1 — revue de 9F4H5-TERRAIN-VIVANT, publiée `487673db`).
 *
 * `LignePlanning` porte `montant_ht`, `devise_code`, `mode_valorisation`, les
 * deux temps (`temps_mesure_min`, `temps_valide_min`), `contact_id`,
 * `reference_client`, les motifs d'annulation et de suspension, entre autres —
 * tout ce que la matrice du §5.2 refuse au technicien (il n'a pas
 * `voir_montants_vente`). `app/(mobile)/terrain/page.tsx` passait la ligne
 * ENTIÈRE à `components/terrain/liste-journee.tsx`, un composant CLIENT
 * ("use client") : tout ce qui traverse ses props est sérialisé dans la
 * réponse reçue par le téléphone, montants compris.
 *
 * Cette projection est LA SEULE porte entre la lecture serveur et la carte —
 * un champ absent d'ici ne PEUT PAS atteindre le téléphone, quelle que soit
 * une évolution future de `CHAMPS_LIGNE` (§9, 01/09 : une liste ouverte de
 * champs à exclure un par un finit toujours par en oublier un ; une liste
 * FERMÉE de champs à inclure ne peut pas en laisser passer un de trop).
 *
 * Les formats déjà composés (`machinesLibelle`, `enRetardPrevueLibelle`,
 * `panneResume`) le sont ICI, côté serveur — jamais par la carte — pour que
 * celle-ci n'ait plus besoin d'importer `machinesAffichees` ni
 * `jourEtDateAbregee` depuis le back-office (point 4 du même ticket).
 */
export type LigneJourneeAffichee = {
  readonly id: string;
  readonly statut: StatutIntervention;
  readonly type: TypeIntervention;
  readonly priorite: Priorite;
  readonly creneau_debut: Date | null;
  readonly creneau_fin: Date | null;
  /** Nul tant que ce technicien n'a pas ouvert la fiche (AVERTISSEMENTS-1). */
  readonly vue_technicien_le: Date | null;
  readonly client: { readonly raison_sociale: string };
  readonly site: { readonly libelle: string };
  /** La première ligne de la panne signalée, ou `null` si elle est vide. */
  readonly panneResume: string | null;
  /** `null` quand aucune machine n'est affectée — la carte ne montre alors rien. */
  readonly machinesLibelle: string | null;
  /** `null` hors d'« En retard », ou quand la ligne n'a pas de date planifiée. */
  readonly enRetardPrevueLibelle: string | null;
};

/** Projette une ligne lue par `listerPlanning`/`interventionsEnRetard` vers ce que la carte affiche. */
export function projeterLigneJournee(
  ligne: LignePlanning,
  libellesMachines: ReadonlyMap<string, string>,
): LigneJourneeAffichee {
  return {
    id: ligne.id,
    statut: ligne.statut,
    type: ligne.type,
    priorite: ligne.priorite,
    creneau_debut: ligne.creneau_debut,
    creneau_fin: ligne.creneau_fin,
    vue_technicien_le: ligne.vue_technicien_le,
    client: { raison_sociale: ligne.client.raison_sociale },
    site: { libelle: ligne.site.libelle },
    panneResume: premiereLignePanne(ligne.description),
    machinesLibelle:
      ligne.machines.length === 0
        ? null
        : machinesAffichees(ligne, libellesMachines),
    enRetardPrevueLibelle:
      ligne.date_planifiee === null
        ? null
        : jourEtDateAbregee(ligne.date_planifiee, false),
  };
}
