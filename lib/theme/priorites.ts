import type { TonBadge } from "@/components/ui/badge";

/**
 * LE TON D'UNE PRIORITÉ — UNE SEULE CORRESPONDANCE, PARTAGÉE PARTOUT (GR5,
 * audit du 26/09/2026, constat G6).
 *
 * Trois écrans peignaient la même priorité de trois façons différentes : le
 * tableau de bord et le registre des interventions en rose-rouge du P1 au
 * P3, la file « À planifier » du planning en gris pour les quatre, et la
 * fiche d'intervention en texte noir sans couleur du tout. Tranché par
 * Alexis le 26/09/2026 : P1 rouge, P2 orange, P3 et P4 gris — la maquette
 * donne P3 en bleu, écarté par cette décision.
 *
 * Une seule fonction pure, lue par les cinq écrans qui affichent une
 * priorité : `interventions.priorite`, `demandes.urgence` portent la même
 * valeur (`PrioriteIntervention` de `prisma/schema.prisma`), déjà réduite à
 * `string` par certains appelants (`tableau-de-bord/presentation.ts`, dont
 * les types restent minimaux) — le paramètre suit donc la même largeur.
 */
export function tonDePriorite(priorite: string): TonBadge {
  if (priorite === "p1") {
    return "rouge";
  }
  if (priorite === "p2") {
    return "orange";
  }
  return "gris";
}
