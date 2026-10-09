import type { PrismaClient } from "@prisma/client";

import type { ContexteSession } from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";

/**
 * LE JOURNAL D'AUDIT, LU PAR LE TABLEAU DE BORD (I8, chapitre 11.2, D32 ;
 * 9EG-TP-UX6-TABLEAU-DE-BORD-2).
 *
 * Deux lectures, une même fenêtre — le JOUR CIVIL de la société, reçu en
 * paramètre (`debutDuJour`, jamais lu ici, même discipline que
 * `lib/vgp/registre.ts`) : *une fonction qui lit l'horloge rend un test vert
 * parce que l'heure a bougé, non parce que la règle tient* (D85).
 *
 * `societe_id` est filtré EXPLICITEMENT, en plus de la politique RLS
 * (`journal_audit`, migration `20260829120000_journal_audit` :202-207) — la
 * même discipline que le reste du dépôt : une politique qui protège déjà ne
 * dispense pas la requête de porter son propre critère.
 *
 * **Jamais `valeurs_avant`/`valeurs_apres`** — ce module ne les sélectionne
 * même pas : le tableau de bord ne montre qu'« entité, action, auteur,
 * horodatage », jamais le détail d'une ligne métier.
 */
export type EcritureJournal = {
  readonly id: string;
  readonly entite: string;
  readonly entiteId: string;
  readonly action: string;
  readonly horodatage: Date;
  readonly utilisateurId: string | null;
};

/** Les `limite` dernières écritures du jour, les plus récentes d'abord. */
export async function dernieresEcrituresDuJour(
  contexte: ContexteSession,
  debutDuJour: Date,
  limite: number,
  client?: PrismaClient,
): Promise<readonly EcritureJournal[]> {
  const societeId = contexte.societeId as string;
  const lignes = await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.journalAudit.findMany({
        where: { societe_id: societeId, horodatage: { gte: debutDuJour } },
        select: {
          id: true,
          entite: true,
          entite_id: true,
          action: true,
          horodatage: true,
          utilisateur_id: true,
        },
        orderBy: { horodatage: "desc" },
        take: limite,
      }),
    client,
  );
  return lignes.map((ligne) => ({
    id: ligne.id,
    entite: ligne.entite,
    entiteId: ligne.entite_id,
    action: ligne.action,
    horodatage: ligne.horodatage,
    utilisateurId: ligne.utilisateur_id,
  }));
}

/** Le nombre total d'écritures du jour — jamais `.length` des lignes rendues, bornées par `limite`. */
export async function compterEcrituresDuJour(
  contexte: ContexteSession,
  debutDuJour: Date,
  client?: PrismaClient,
): Promise<number> {
  const societeId = contexte.societeId as string;
  return avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.journalAudit.count({
        where: { societe_id: societeId, horodatage: { gte: debutDuJour } },
      }),
    client,
  );
}
