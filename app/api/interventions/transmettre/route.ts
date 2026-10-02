import {
  avertirApresTransmissionGroupee,
  type CompteRenduRecapitulatif,
} from "@/lib/avertissements/planification";
import { dansUnEchangeAuth } from "@/lib/auth/echange";
import { exigerCapacite, motifDuRefus } from "@/lib/auth/porte";
import { avecContexteApplicatif } from "@/lib/db/client";
import {
  debutDuJourSociete,
  listerPlanifieesATransmettre,
  transmettreEnGroupe,
} from "@/lib/interventions/depot";

import { versLePlanning } from "../actions";

/**
 * `POST /api/interventions/transmettre` — TRANSMETTRE PLUSIEURS PLANIFIÉES
 * D'UN COUP (QG-5, D141, 9CP-PG-G14B-TRANSMETTRE-GROUPE) : « Transmettre
 * demain » (une sélection cochée, `id` répété) et « Transmettre toutes les
 * planifiées prêtes » (`toutes=1`, résolue ICI plutôt que sur une liste
 * d'identifiants postée par le navigateur — un `id` manquant à l'envoi du
 * formulaire ne doit pas rester hors de « toutes »).
 *
 * **Toujours un POST natif, toujours une redirection 303 vers `/planning`** —
 * contrairement à `.../[id]/transmettre`, aucun tiroir n'appelle cette route
 * en JSON : le dialogue « Transmettre demain » et le bouton « Transmettre
 * toutes… » soumettent chacun un formulaire ordinaire.
 *
 * **Le compte-rendu voyage par des NOMBRES et des CLÉS FERMÉES, jamais par du
 * texte** (L1-02f, D50, même discipline que `clesAvertissementCourriel`) :
 * `transmis`/`techniciens`/`echecsCourriel` sont des entiers — un nombre
 * forgé rend au plus un compte faux, jamais un texte injecté — et
 * `refusee=<id>:<cle>` ne porte qu'une clé du dictionnaire, jamais le motif
 * technique d'un refus.
 */
export async function POST(requete: Request): Promise<Response> {
  return dansUnEchangeAuth(() => traiter(requete));
}

async function traiter(requete: Request): Promise<Response> {
  const contexte = await exigerCapacite("modifier_planning");
  if (contexte === null) {
    return versLePlanning(await motifDuRefus());
  }

  const formulaire = await requete.formData();
  const idsCoches = formulaire
    .getAll("id")
    .filter((valeur): valeur is string => typeof valeur === "string");

  const ids =
    idsCoches.length > 0
      ? idsCoches
      : formulaire.get("toutes") === "1"
        ? (
            await listerPlanifieesATransmettre(contexte, {
              // DÉCISION D'ALEXIS DU 02/10/2026, POINT 7 (D141, 9CT-RETOUCHES-5)
              // — « toutes » exclut les Planifiées déjà passées ; la borne est
              // lue CÔTÉ SERVEUR, jamais depuis l'horloge de l'appareil (même
              // discipline que `debutDuJourSociete` lui-même). Elle est lue
              // dans une transaction DISTINCTE de celle du tri qu'elle borne
              // (`listerPlanifieesATransmettre` ci-dessous) : sans
              // conséquence à une seconde près, l'écart entre les deux
              // lectures étant négligeable face au grain « jour » du tri.
              aPartirDe: await avecContexteApplicatif(contexte, (tx) =>
                debutDuJourSociete(tx, contexte),
              ),
            })
          ).pretes.map((p) => p.id)
        : [];

  const { transmises, refusees } = await transmettreEnGroupe(contexte, ids);
  // UN ÉCHEC D'AVERTISSEMENT NE TRANSFORME JAMAIS UNE TRANSMISSION DÉJÀ
  // VALIDÉE EN 500 (9CT-RETOUCHES-5) : les lignes ci-dessus ont déjà écrit en
  // base, et `envoyerCourriel` ne lève jamais (lib/courriel/index.ts) — ce
  // filet ne couvre donc qu'un accident d'infrastructure sur la RELECTURE de
  // `avertirApresTransmissionGroupee`, jamais un envoi lent ou refusé par le
  // prestataire.
  let comptesRendus: readonly CompteRenduRecapitulatif[] = [];
  if (transmises.length > 0) {
    try {
      comptesRendus = await avertirApresTransmissionGroupee(
        contexte,
        transmises,
      );
    } catch (erreur) {
      console.error(
        `intervention transmettre (${transmises.join(",")})`,
        erreur,
      );
      comptesRendus = [];
    }
  }

  const parametres = new URLSearchParams();
  parametres.set("transmis", String(transmises.length));
  parametres.set("techniciens", String(comptesRendus.length));
  parametres.set(
    "echecsCourriel",
    String(comptesRendus.filter((c) => c.envoi.type !== "parti").length),
  );
  for (const refus of refusees) {
    parametres.append("refusee", `${refus.id}:${refus.cle}`);
  }
  return new Response(null, {
    status: 303,
    headers: { Location: `/planning?${parametres.toString()}` },
  });
}
