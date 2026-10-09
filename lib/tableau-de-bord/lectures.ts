import type { PrismaClient } from "@prisma/client";

import {
  etatsAccesDesTechniciens,
  type EtatAcces,
} from "@/lib/auth/acces-technicien";
import type { ContexteSession } from "@/lib/auth/contexte";
import { compterClients } from "@/lib/clients/depot";
import { schemaRechercheClient } from "@/lib/clients/saisie";
import type { CleTraduction } from "@/lib/i18n/fr";
import { compterInterventionsSansDuree } from "@/lib/interventions/depot";
import { compterLeParc } from "@/lib/machines/depot";
import { schemaRechercheParc } from "@/lib/machines/saisie";
import { listerLesTechniciens } from "@/lib/techniciens/depot";
import { famillesADeterminer } from "@/lib/vgp/registre";

/**
 * DES LECTURES MINCES POUR LE TABLEAU DE BORD DE L'ADMINISTRATEUR
 * (9EG-TP-UX6-TABLEAU-DE-BORD-2) — chacune appelle les MÊMES fonctions que
 * l'écran de destination (§9, 01/09) ; jamais un second calcul qui pourrait
 * diverger de la liste qu'il annonce.
 */

/** Un technicien ACTIF dont l'accès n'est pas encore ouvert. */
export type LigneAccesAOuvrir = {
  readonly utilisateurId: string;
  readonly nom: string;
  readonly etat: EtatAcces;
};

/**
 * LES TECHNICIENS ACTIFS SANS ACCÈS ACTIF — même lecture que `/parametres/
 * equipe` (`etatsAccesDesTechniciens`), restreinte aux lignes dont l'état
 * n'est pas `actif`. C'est la population de la tuile « Accès à ouvrir » ET du
 * bloc qui en porte le détail : jamais deux lectures.
 */
export async function techniciensAccesAOuvrir(
  contexte: ContexteSession,
  client?: PrismaClient,
): Promise<readonly LigneAccesAOuvrir[]> {
  const techniciens = (await listerLesTechniciens(contexte, client)).filter(
    (technicien) => technicien.actif,
  );
  if (techniciens.length === 0) {
    return [];
  }
  const etats = await etatsAccesDesTechniciens(
    contexte,
    techniciens.map((technicien) => technicien.utilisateurId),
    client,
  );
  return techniciens
    .map((technicien) => ({
      utilisateurId: technicien.utilisateurId,
      nom: technicien.nom,
      etat: etats.get(technicien.utilisateurId) ?? { etat: "aucun" as const },
    }))
    .filter((ligne) => ligne.etat.etat !== "actif");
}

/** Un point de « Données à compléter », NON NUL — texte et lien de 9DT. */
export type PointDonneesACompleter = {
  readonly cle: CleTraduction;
  readonly compte: number;
  readonly href: string;
};

/**
 * LES POINTS NON NULS DE « DONNÉES À COMPLÉTER » (`/parametres/donnees`,
 * 9DT) — les QUATRE points de ce lot (décision 44 d'Alexis en prévoit dix
 * dans un autre lot, D189 le note). La MÊME lecture que l'écran de
 * destination, jamais un second calcul (§9, 01/09) — et le MÊME lien.
 */
export async function pointsDonneesACompleter(
  contexte: ContexteSession,
  debutDuJour: Date,
  client?: PrismaClient,
): Promise<readonly PointDonneesACompleter[]> {
  const baseClients = schemaRechercheClient.parse({});
  const baseParc = schemaRechercheParc.parse({});
  const [
    interventionsSansDuree,
    familles,
    clientsSansCode,
    machinesIncompletes,
  ] = await Promise.all([
    compterInterventionsSansDuree(contexte, debutDuJour, client),
    famillesADeterminer(contexte),
    compterClients(
      contexte,
      { ...baseClients, sans_code_externe: true },
      client,
    ),
    compterLeParc(
      contexte,
      { ...baseParc, incompletes: true },
      debutDuJour,
      client,
    ),
  ]);
  const points: readonly PointDonneesACompleter[] = [
    {
      cle: "donnees_a_completer.kpi_interventions_sans_duree",
      compte: interventionsSansDuree,
      href: "/interventions?sans_duree_a_venir=1&vue=toutes",
    },
    {
      cle: "donnees_a_completer.kpi_vgp_a_determiner",
      compte: familles.length,
      href: "/vgp/a-determiner",
    },
    {
      cle: "donnees_a_completer.kpi_clients_sans_code",
      compte: clientsSansCode,
      href: "/clients?sans_code_externe=1&sans_equipement=1",
    },
    {
      cle: "donnees_a_completer.kpi_machines_incompletes",
      compte: machinesIncompletes,
      href: "/parc?incompletes=1",
    },
  ];
  return points.filter((point) => point.compte > 0);
}
