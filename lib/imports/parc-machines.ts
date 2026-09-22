import { type PrismaClient } from "@prisma/client";

import { type ContexteSession } from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";
import { cleDeRapprochement } from "@/lib/excel/rapprochement";

import { type CandidatMachine, type ParcMachines } from "./reprise";

/**
 * LES MACHINES PAR SÉRIE, AVEC LEUR CLIENT (REPRISE-HISTORIQUE ; D127).
 *
 * ## Pourquoi ce n'est PAS `indexerLeParcEquipements`
 *
 * Celui-là répond à *« cette FICHE existe-t-elle déjà ? »* et retire de son
 * index toute clé que deux fiches se partagent — c'est juste pour lui : un
 * choix au hasard y serait un écrasement. Celui-ci répond à *« quelle machine
 * de CE client porte cette série ? »* — le rang 2 de D127 —, et il lui faut
 * TOUS les candidats avec leur client. *Deux questions, deux index* ; la clé,
 * elle, est la MÊME fonction (`cleDeRapprochement`, L1-08b), sans quoi rien ne
 * se rattacherait jamais (§9, 01/09).
 *
 * ## Aucun filtre sur le statut ni sur `actif`
 *
 * Une machine réformée, ou fusionnée (D28, L3-10 non construit), porte
 * toujours sa série — et l'archive parle du passé : une intervention de 2019
 * s'est faite sur la machine qui existait alors. *L'ignorer ferait passer un
 * rattachement sûr pour une série inconnue.*
 */
export async function indexerLesMachinesParSerie(
  contexte: ContexteSession,
  client?: PrismaClient,
): Promise<ParcMachines> {
  const machines = await avecContexteApplicatif(
    contexte,
    (tx) =>
      tx.machine.findMany({
        select: {
          id: true,
          numero_serie: true,
          reference_interne: true,
          client_id: true,
        },
      }),
    client,
  );

  const parSerie = new Map<string, CandidatMachine[]>();
  for (const m of machines) {
    // La MÊME clé que `indexerLeParcEquipements` : série nue, ou référence
    // préfixée `SN-INCONNU-` quand la plaque est illisible (D6). Le rang est
    // sans objet — `numero_serie` est NOT NULL, la forme de dernier recours ne
    // se produit pas ici.
    const cle = cleDeRapprochement({
      numeroSerie: m.numero_serie,
      reference: m.reference_interne ?? undefined,
      rang: 0,
    }).cle;
    const candidats = parSerie.get(cle) ?? [];
    candidats.push({ id: m.id, clientId: m.client_id });
    parSerie.set(cle, candidats);
  }
  return { parSerie };
}
