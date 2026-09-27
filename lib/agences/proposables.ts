import type { Prisma } from "@prisma/client";

/**
 * LES AGENCES PROPOSABLES DANS UN MENU DE RATTACHEMENT (AGENCE-ACTIVE, 9AY-AA-1).
 *
 * ## Le constat que ce module ferme
 *
 * Décision d'Alexis du 26/09/2026 : une agence inactive sort des CHOIX et des
 * FILTRES ; elle reste dans Paramètres > Agences et sur les fiches
 * existantes (précédent D129 pour le client inactif). Aucun lecteur commun
 * « agences proposables » n'existait : la seule forme du critère était le
 * `where: { actif: true }` écrit dans `agencesDisponibles`
 * (`lib/techniciens/depot.ts`), et les deux pages `/sites/nouveau` et
 * `/sites/[id]` lisaient `tx.agence.findMany` SANS aucun filtre.
 *
 * ## LE PIÈGE QUE `garder` FERME
 *
 * Filtrer `actif` SANS RIEN D'AUTRE romprait `/sites/[id]` : un site rattaché
 * à une agence qu'on vient de désactiver perdrait son option dans le menu, le
 * navigateur retomberait sur la première agence de la liste, et le prochain
 * « Enregistrer » d'un tout autre champ changerait le rattachement du site
 * sans que personne ne l'ait demandé. `garder` — l'identifiant de l'agence que
 * la fiche ouverte porte déjà — est donc réintroduite même inactive, marquée
 * `inactive: true` : elle reste CHOISIE, elle ne redevient pas un choix
 * possible pour un site qui ne la porte pas encore.
 *
 * ## SEUL LECTEUR DU CRITÈRE (§9)
 *
 * `agencesDisponibles` (`lib/techniciens/depot.ts`) l'appelle désormais au
 * lieu d'écrire son propre `where` : un critère métier écrit à deux endroits
 * est un critère qui divergera un jour.
 */
export type AgenceProposable = {
  readonly id: string;
  readonly libelle: string;
  readonly code: string;
  readonly inactive: boolean;
};

export async function agencesProposables(
  tx: Prisma.TransactionClient,
  options?: { readonly garder?: string | null },
): Promise<readonly AgenceProposable[]> {
  const garder = options?.garder ?? null;
  const agences = await tx.agence.findMany({
    where:
      garder === null
        ? { actif: true }
        : { OR: [{ actif: true }, { id: garder }] },
    select: { id: true, libelle: true, code: true, actif: true },
    orderBy: [{ libelle: "asc" }, { id: "asc" }],
  });
  return agences.map((agence) => ({
    id: agence.id,
    libelle: agence.libelle,
    code: agence.code,
    inactive: !agence.actif,
  }));
}
