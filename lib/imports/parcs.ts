import { type PrismaClient } from "@prisma/client";

import { type ContexteSession } from "@/lib/auth/contexte";

import { type ParcsDImport } from "./modeles";
import { indexerLesAgences } from "./parc-agences";
import {
  indexerLeParcHistorique,
  indexerLeParcModeles,
  indexerLeParcSites,
} from "./parc-cibles";
import { indexerLeParcClients } from "./parc-clients";
import { indexerLesFamilles } from "./parc-familles";
import { indexerLesMachinesParSerie } from "./parc-machines";
import { lireLaDeviseDeLaSociete } from "./parc-societe";

/**
 * LES PARCS DONT LES GABARITS ONT BESOIN, LUS D'UN BLOC (REPRISE-HISTORIQUE).
 *
 * *La route de contrôle les lisait un par un, et deux scénarios d'isolation
 * recopiaient la même liste* — cinq index le 16/09, neuf aujourd'hui. Une
 * liste recopiée à trois endroits diverge au premier index qu'on ajoute d'un
 * seul côté (§9, 01/09) : le gabarit qui en dépend recevrait un parc VIDE, et
 * chaque ligne deviendrait création. **`ParcsDImport` n'a pas de défaut** pour
 * que l'oubli ne compile pas ; cette fonction est ce qui évite qu'il faille y
 * penser.
 *
 * Les lectures sont parallèles — chacune ouvre sa propre transaction
 * cloisonnée —, et le type n'est pas encore connu : les gabarits se
 * construisent AVANT que le marqueur ait choisi (`gabaritDuMarqueur`).
 */
export async function indexerLesParcs(
  contexte: ContexteSession,
  client?: PrismaClient,
): Promise<ParcsDImport> {
  const [
    clients,
    agences,
    familles,
    sites,
    modeles,
    machines,
    historique,
    devise,
  ] = await Promise.all([
    indexerLeParcClients(contexte, client),
    indexerLesAgences(contexte, client),
    indexerLesFamilles(contexte, client),
    indexerLeParcSites(contexte, client),
    indexerLeParcModeles(contexte, client),
    indexerLesMachinesParSerie(contexte, client),
    indexerLeParcHistorique(contexte, client),
    lireLaDeviseDeLaSociete(contexte, client),
  ]);
  return {
    clients,
    agences,
    familles,
    sites,
    // **Les sites répondent à TROIS questions** : la cible de leur gabarit,
    // le parent d'un équipement, et — depuis l'historique — le SEUL site d'un
    // client. Une seule lecture, trois index.
    sitesDetails: sites.details,
    modeles,
    machines,
    historique,
    devise,
  };
}
