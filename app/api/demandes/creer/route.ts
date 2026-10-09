import { z } from "zod";

import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite, motifDuRefus } from "@/lib/auth/porte";
import { uuidv7 } from "@/lib/db/uuid";
import { deposerDemande, lireDemandePourCreation } from "@/lib/demandes/depot";
import { schemaDepot } from "@/lib/demandes/saisie";
import { machinesDesSites } from "@/lib/machines/depot";

import { champ } from "../../interventions/actions";
import { versLaFileDeQualification } from "../actions";

/**
 * « + DEMANDE » — LE DÉPÔT DEPUIS LE VOLET DU BUREAU (D188, partie 2).
 *
 * `deposerDemande` (`lib/demandes/depot.ts`) porte tout le cycle depuis
 * L2-06 ; cette route n'ajoute que ce qu'un formulaire exige et que le dépôt
 * ne peut pas juger lui-même :
 *
 * - **la capacité** — `creer_demande`, la même que le bouton d'en-tête ;
 * - **le sous-ensemble des sources saisissables à la main** — `SOURCES_DEMANDE`
 *   (`lib/demandes/saisie.ts`) en porte SIX ; `echeance_contrat`,
 *   `seuil_compteur` et `portail` naissent d'un autre chemin et sont REFUSÉES
 *   ici, qu'elles soient forgées ou non ;
 * - **la machine appartient au lieu choisi** — `machine_id` n'a, au schéma,
 *   aucune clé étrangère vers `site_id` (chapitre 11) : une machine d'un
 *   AUTRE lieu, même société, passerait la validation de forme sans ce
 *   contrôle. `machinesDesSites(contexte, [site_id])` est lue SOUS LE MÊME
 *   CONTEXTE que le reste de la route (I1) — une machine hors société n'y
 *   apparaîtrait de toute façon jamais ;
 * - **la rejouabilité d'un double clic** — même patron que
 *   `/api/interventions/creer` : l'`id` est posé au rendu, dans un champ
 *   caché ; si `lireDemandePourCreation` le retrouve déjà, rien n'est
 *   réécrit, et la réponse est LA MÊME redirection qu'un succès.
 *
 * **Écart nommé par D188** : un refus renvoie vers le volet rouvert avec
 * `source` et `description` conservées (`champsResoumis`), mais PAS client,
 * lieu ni machine — ces trois-là sont à ressaisir.
 */
export async function POST(requete: Request): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete));
}

const IDENTIFIANT_UUID = z.string().uuid();

/** Les trois sources que ce volet peut déposer — voir le docblock. */
const SOURCES_VOLET = new Set(["appel", "email", "detection_technicien"]);

type ChampsResoumis = {
  readonly source?: string;
  readonly description?: string;
};

function versVoletResoumis(motif: string, resoumis: ChampsResoumis): Response {
  const parametres = new URLSearchParams({ nouvelle: "1", motif });
  if (resoumis.source !== undefined) {
    parametres.set("source", resoumis.source);
  }
  if (resoumis.description !== undefined) {
    parametres.set("description", resoumis.description);
  }
  return new Response(null, {
    status: 303,
    headers: { Location: `/demandes?${parametres.toString()}` },
  });
}

function versLaFicheApresCreation(id: string): Response {
  return new Response(null, {
    status: 303,
    headers: { Location: `/demandes?creee=${id}` },
  });
}

async function traiter(requete: Request): Promise<Response> {
  const contexte = await exigerCapacite("creer_demande");
  if (contexte === null) {
    // REFUS DE DROIT — même réponse que les routes soeurs (clore, qualifier,
    // transformer) : le volet ne se rouvre pas, puisque le rôle n'a pas même
    // le droit de le voir.
    return versLaFileDeQualification(await motifDuRefus());
  }

  const formulaire = await requete.formData();
  const source = champ(formulaire, "source");
  const description = champ(formulaire, "description");
  const champsResoumis: ChampsResoumis = {
    source: source ?? undefined,
    description: description ?? undefined,
  };

  const idPropose = champ(formulaire, "id");
  const id =
    idPropose !== null && IDENTIFIANT_UUID.safeParse(idPropose).success
      ? idPropose
      : uuidv7();

  // REJOUABILITÉ (un double clic ne dépose qu'une demande) — lue SOUS LE
  // CONTEXTE CLOISONNÉ, comme `interventionDejaCreee` : un `id` d'une autre
  // société ne s'y voit jamais.
  const dejaDeposee = await lireDemandePourCreation(contexte, id);
  if (dejaDeposee !== null) {
    return versLaFicheApresCreation(id);
  }

  const siteId = champ(formulaire, "site_id");
  const saisie = schemaDepot.safeParse({
    id,
    source,
    client_id: champ(formulaire, "client_id"),
    site_id: siteId,
    machine_id: champ(formulaire, "machine_id"),
    description,
  });
  if (!saisie.success) {
    return versVoletResoumis("demande.refus.saisie_invalide", champsResoumis);
  }
  if (!SOURCES_VOLET.has(saisie.data.source)) {
    return versVoletResoumis("demande.refus.saisie_invalide", champsResoumis);
  }

  if (saisie.data.machine_id !== null) {
    const machinesDuLieu = await machinesDesSites(contexte, [
      saisie.data.site_id,
    ]);
    if (!machinesDuLieu.some((m) => m.id === saisie.data.machine_id)) {
      return versVoletResoumis(
        "demande.refus.machine_hors_lieu",
        champsResoumis,
      );
    }
  }

  const resultat = await deposerDemande(contexte, saisie.data);
  if (!resultat.accepte) {
    return versVoletResoumis(resultat.cle, champsResoumis);
  }
  return versLaFicheApresCreation(resultat.fiche.id);
}
