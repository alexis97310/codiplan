import {
  libelleClientSite,
  libelleOptionClient,
} from "@/app/(back-office)/presentation";
import { referenceAffichee } from "@/app/(back-office)/interventions/presentation";
import { exigerContexteActif, type ContexteSession } from "@/lib/auth/contexte";
import { rechercherClients, sitesParClient } from "@/lib/clients/depot";
import { schemaRechercheClient } from "@/lib/clients/saisie";
import { avecContexteApplicatif } from "@/lib/db/client";
import { normaliserRaisonSociale } from "@/lib/excel/rapprochement";
import { listerInterventions } from "@/lib/interventions/depot";
import {
  perimetreClientDuTechnicien,
  perimetreParcDuTechnicien,
} from "@/lib/interventions/perimetre-technicien";
import { schemaRechercheInterventions } from "@/lib/interventions/saisie";
import { libellesDesSites, rechercherSites } from "@/lib/sites/depot";
import { schemaRechercheSite } from "@/lib/sites/saisie";

/**
 * LA RECHERCHE GLOBALE DU BANDEAU DU BUREAU (QE-3, 9DU-TP-NAV3-RECHERCHE-RAIL,
 * D171).
 *
 * ## CE QU'ELLE N'EST PAS : une cinquième lecture
 *
 * Elle ne récrit AUCUN critère : clients et sites réutilisent
 * `rechercherClients`/`rechercherSites`, DÉJÀ sans accent ni casse depuis CS2
 * (`normaliserRaisonSociale`, `lib/excel/rapprochement.ts`) — la même
 * fonction, jamais une seconde normalisation qui pourrait diverger ;
 * interventions réutilise `listerInterventions`, dont le `texte` cherche déjà
 * le client, le site ET le numéro de référence
 * (`lib/interventions/depot.ts`). Seules les MACHINES
 * n'avaient aucune recherche sans accent (`filtreDuParc` compare en SQL,
 * insensible à la casse mais PAS aux accents) : cette fonction leur applique
 * la MÊME normalisation que CS2, sur les candidats que le périmètre du
 * technicien borne déjà.
 *
 * ## LE PÉRIMÈTRE DU TECHNICIEN S'APPLIQUE AUX QUATRE GROUPES (9DG, QT-2, D152)
 *
 * Chaque groupe est borné par la MÊME restriction que l'écran qui le porte
 * déjà : `perimetreClientDuTechnicien` pour les clients et les sites,
 * `perimetreParcDuTechnicien` pour les machines, `restrictionParPersonne`
 * (interne à `listerInterventions`) pour les interventions. Un technicien
 * restreint ne voit donc, ici comme ailleurs, que SON périmètre — jamais une
 * cinquième porte dérobée vers le reste de la société.
 *
 * ## AUCUN MONTANT
 *
 * Aucun des quatre libellés ne porte de prix, de tarif ni de marge — ce ne
 * sont que des désignations (raison sociale, lieu, référence de modèle,
 * numéro d'intervention), exactement ce qu'un sélecteur de création affiche
 * déjà pour les mêmes entités.
 */

const LIMITE_PAR_GROUPE = 5;

export type ResultatRecherche = {
  readonly id: string;
  readonly libelle: string;
  readonly href: string;
};

export type CleGroupeRecherche =
  "clients" | "sites" | "machines" | "interventions";

export type GroupeRecherche = {
  readonly cle: CleGroupeRecherche;
  readonly resultats: readonly ResultatRecherche[];
};

async function rechercherClientsPourRecherche(
  contexte: ContexteSession,
  texte: string,
): Promise<readonly ResultatRecherche[]> {
  const criteres = schemaRechercheClient.parse({
    texte,
    etat: "actifs",
    inclure_sans_equipement: true,
    limite: LIMITE_PAR_GROUPE,
    page: 1,
  });
  const restriction = await avecContexteApplicatif(contexte, (tx) =>
    perimetreClientDuTechnicien(tx, exigerContexteActif(contexte)),
  );
  const resultats = await rechercherClients(
    contexte,
    criteres,
    undefined,
    restriction,
  );
  const sites = await sitesParClient(contexte, resultats);
  return resultats.map((client) => ({
    id: client.id,
    libelle: libelleOptionClient(
      client.raison_sociale,
      client.code_externe,
      sites.get(client.id)?.communes[0],
    ),
    href: `/clients/${client.id}`,
  }));
}

async function rechercherSitesPourRecherche(
  contexte: ContexteSession,
  texte: string,
): Promise<readonly ResultatRecherche[]> {
  const criteres = schemaRechercheSite.parse({
    texte,
    actifs_seulement: true,
    inclure_sans_equipement: true,
    sous_contrat_seulement: false,
    limite: LIMITE_PAR_GROUPE,
    page: 1,
  });
  const restrictionClient = await avecContexteApplicatif(contexte, (tx) =>
    perimetreClientDuTechnicien(tx, exigerContexteActif(contexte)),
  );
  const restriction =
    restrictionClient === undefined ? undefined : { client: restrictionClient };
  const resultats = await rechercherSites(
    contexte,
    criteres,
    undefined,
    restriction,
  );
  const { clients } = await libellesDesSites(contexte, resultats);
  return resultats.map((site) => ({
    id: site.id,
    libelle: libelleClientSite(clients.get(site.client_id) ?? "", site.libelle),
    href: `/sites/${site.id}`,
  }));
}

/**
 * LES MACHINES — seul groupe sans recherche serveur existante (voir l'entête
 * du fichier). Le périmètre borne les CANDIDATS, jamais le texte : la
 * normalisation se joue ensuite, en JS, EXACTEMENT comme `clientsFiltresParTexte`
 * (`lib/clients/depot.ts`) le fait depuis CS2 — pas une seconde manière de
 * résoudre la même tension (base sans accent, texte avec).
 */
async function rechercherMachinesPourRecherche(
  contexte: ContexteSession,
  texte: string,
): Promise<readonly ResultatRecherche[]> {
  const texteNormalise = normaliserRaisonSociale(texte);
  const candidats = await avecContexteApplicatif(contexte, async (tx) => {
    const restriction = await perimetreParcDuTechnicien(
      tx,
      exigerContexteActif(contexte),
    );
    return tx.machine.findMany({
      where: restriction,
      select: {
        id: true,
        numero_serie: true,
        client: { select: { raison_sociale: true } },
        site: { select: { libelle: true } },
        modele: { select: { marque: true, reference: true } },
      },
    });
  });
  return candidats
    .filter((machine) =>
      [
        machine.numero_serie,
        machine.client.raison_sociale,
        machine.site.libelle,
        machine.modele.marque,
        machine.modele.reference,
      ].some(
        (champ) =>
          champ !== null &&
          normaliserRaisonSociale(champ).includes(texteNormalise),
      ),
    )
    .slice(0, LIMITE_PAR_GROUPE)
    .map((machine) => ({
      id: machine.id,
      libelle: `${machine.modele.marque} ${machine.modele.reference} — ${machine.client.raison_sociale}`,
      href: `/parc/${machine.id}`,
    }));
}

/**
 * LES INTERVENTIONS — `listerInterventions` applique déjà
 * `restrictionParPersonne` (QT-2, D152), qui REFUSE (lève) pour un rôle sans
 * aucun accès au planning. Aucun rôle qui atteint le bandeau du bureau n'est
 * dans ce cas aujourd'hui (voir l'entête), mais ce groupe rend une liste vide
 * plutôt que de faire échouer les trois autres si un jour c'était le cas —
 * une recherche partielle reste plus juste qu'une recherche en panne.
 */
async function rechercherInterventionsPourRecherche(
  contexte: ContexteSession,
  texte: string,
): Promise<readonly ResultatRecherche[]> {
  try {
    const criteres = schemaRechercheInterventions.parse({ texte, page: 1 });
    const resultats = await listerInterventions(contexte, criteres);
    return resultats.slice(0, LIMITE_PAR_GROUPE).map((intervention) => ({
      id: intervention.id,
      libelle: `${referenceAffichee(intervention)} — ${intervention.client.raison_sociale}`,
      href: `/interventions/${intervention.id}`,
    }));
  } catch {
    return [];
  }
}

const GROUPES_VIDES: readonly GroupeRecherche[] = [
  { cle: "clients", resultats: [] },
  { cle: "sites", resultats: [] },
  { cle: "machines", resultats: [] },
  { cle: "interventions", resultats: [] },
];

/**
 * LA RECHERCHE, GROUPÉE — `texteBrut` vide ou blanc rend les quatre groupes
 * vides SANS INTERROGER LA BASE : un dialogue qui vient de s'ouvrir n'a encore
 * rien à chercher.
 */
export async function rechercherGlobalement(
  contexte: ContexteSession,
  texteBrut: string,
): Promise<readonly GroupeRecherche[]> {
  const texte = texteBrut.trim();
  if (texte === "") {
    return GROUPES_VIDES;
  }

  const [clients, sites, machines, interventions] = await Promise.all([
    rechercherClientsPourRecherche(contexte, texte),
    rechercherSitesPourRecherche(contexte, texte),
    rechercherMachinesPourRecherche(contexte, texte),
    rechercherInterventionsPourRecherche(contexte, texte),
  ]);

  return [
    { cle: "clients", resultats: clients },
    { cle: "sites", resultats: sites },
    { cle: "machines", resultats: machines },
    { cle: "interventions", resultats: interventions },
  ];
}
