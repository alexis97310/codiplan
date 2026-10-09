import type { Prisma } from "@prisma/client";

import { chargerCalendrierAgence } from "@/lib/calendar/agence";
import { versLocal } from "@/lib/calendar/fuseau";
import { etatAccuse } from "@/lib/demandes/accuse";
import { type LigneDemande } from "@/lib/demandes/depot";

import { candidatesAlerte } from "./presentation";

/**
 * LA PASTILLE DES 30 MINUTES SUR L'ONGLET « À TRAITER » (chapitre 16.1 ;
 * D176 l'écarte pour son coût, D188 la construit sous une borne mesurée).
 *
 * `candidatesAlerte` (pure, `./presentation.ts`) filtre d'abord SANS aucune
 * lecture : seules les demandes qui ONT une chance réelle d'être en retard
 * méritent qu'on charge le calendrier de leur établissement. **Zéro
 * candidate, zéro lecture.** Ensuite, UN SEUL `chargerCalendrierAgence` par
 * établissement DISTINCT parmi les candidates (jamais par candidate) — la
 * fenêtre commune part du compteur le plus ancien jusqu'à `maintenant`,
 * même patron que `[id]/page.tsx` pour la fiche d'une demande.
 *
 * Un établissement sans calendrier (`null`) ou dont la lecture échoue ne
 * construit jamais la pastille pour ses candidates : inconnu n'est pas
 * ouvert (I7).
 *
 * `tx` est un paramètre : cette fonction ne lit jamais sous un contexte
 * qu'elle fabriquerait elle-même — l'appelant (`page.tsx`) reste le seul
 * point où le contexte cloisonné se pose.
 */
export async function pastilleATraiterAllumee(
  tx: Prisma.TransactionClient,
  societeId: string,
  demandesOuvertesListe: readonly LigneDemande[],
  maintenant: Date,
): Promise<boolean> {
  const candidates = candidatesAlerte(demandesOuvertesListe, maintenant);
  if (candidates.length === 0) {
    return false;
  }

  const plusAncien = candidates.reduce((a, b) =>
    a.compteur_accuse_le.getTime() <= b.compteur_accuse_le.getTime() ? a : b,
  );
  const fenetre = {
    du: versLocal(plusAncien.compteur_accuse_le, "UTC"),
    au: versLocal(maintenant, "UTC"),
  };

  const agenceIds = [...new Set(candidates.map((d) => d.agence_id))];
  const calendriers = new Map<
    string,
    Awaited<ReturnType<typeof chargerCalendrierAgence>>
  >();
  for (const agenceId of agenceIds) {
    const calendrier = await chargerCalendrierAgence(tx, {
      societeId,
      agenceId,
      fenetre,
    });
    calendriers.set(agenceId, calendrier);
  }

  return candidates.some((demande) => {
    const calendrier = calendriers.get(demande.agence_id) ?? null;
    if (calendrier === null) {
      return false;
    }
    const etat = etatAccuse(calendrier, {
      compteurDepart: demande.compteur_accuse_le,
      accuseLe: null,
      maintenant,
    });
    return etat.etat === "sans_reponse" && etat.depasse;
  });
}
